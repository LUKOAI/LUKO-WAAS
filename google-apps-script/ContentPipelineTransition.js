/**
 * WAAS Site Transition v3 — Full auto with Claude API
 * 
 * Wymagania PRZED uruchomieniem:
 * - Sites sheet: Domain, WP URL, Username, Password, Partner Tag, Niche_Description
 * - CLAUDE_API_KEY w Script Properties
 * - MU-Plugin v1.4+ na docelowej stronie (z /cleanup i /extract-texts)
 * 
 * File: ContentPipelineTransition.gs
 */

var TRANSITION_KEY = 'WAAS_TRANSITION_STATE';
var CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ============================================================================
// CLAUDE API CALLER
// ============================================================================

function _tsCallClaude(prompt, systemPrompt, maxTokens) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return { success: false, error: 'CLAUDE_API_KEY not set in Script Properties' };
  
  var payload = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens || 4096,
    messages: [{ role: 'user', content: prompt }]
  };
  if (systemPrompt) payload.system = systemPrompt;
  
  try {
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    var body = JSON.parse(response.getContentText());
    
    if (code === 200 && body.content && body.content[0]) {
      return { success: true, text: body.content[0].text };
    }
    return { success: false, error: 'HTTP ' + code + ': ' + (body.error ? body.error.message : 'unknown') };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function _tsExtractJson(text) {
  // Extract JSON from Claude response (may have markdown fences)
  var clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Find first { and last }
  var start = clean.indexOf('{');
  var end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) clean = clean.substring(start, end + 1);
  return JSON.parse(clean);
}


// ============================================================================
// STATE MANAGEMENT (auto-resume)
// ============================================================================

function _tsGetState() {
  var raw = PropertiesService.getScriptProperties().getProperty(TRANSITION_KEY);
  return raw ? JSON.parse(raw) : null;
}
function _tsSaveState(s) {
  PropertiesService.getScriptProperties().setProperty(TRANSITION_KEY, JSON.stringify(s));
}
function _tsClearState() {
  PropertiesService.getScriptProperties().deleteProperty(TRANSITION_KEY);
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'cpTransitionResume') ScriptApp.deleteTrigger(t);
  });
}
function _tsScheduleResume(sec) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'cpTransitionResume') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cpTransitionResume').timeBased().after(sec * 1000).create();
}
function _tsLog(s, msg) {
  if (!s.log) s.log = [];
  s.log.push(Utilities.formatDate(new Date(), 'Europe/Berlin', 'HH:mm:ss') + ' ' + msg);
  if (s.log.length > 80) s.log = s.log.slice(-80);
  _tsSaveState(s);
}


// ============================================================================
// VALIDATION — check Sites sheet before starting
// ============================================================================

function _tsValidateSite(domain) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sitesSheet = ss.getSheetByName('Sites');
  if (!sitesSheet) return { ok: false, error: 'Brak karty Sites' };
  
  var data = sitesSheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  var siteRow = null;
  for (var r = 1; r < data.length; r++) {
    if ((data[r][col['Domain'] || 2] || '').toString().trim() === domain) {
      siteRow = data[r]; break;
    }
  }
  
  if (!siteRow) return { ok: false, error: 'Domena "' + domain + '" nie znaleziona w Sites sheet.\nDodaj wiersz z tą domeną.' };
  
  var missing = [];
  var get = function(name) { return col[name] !== undefined ? (siteRow[col[name]] || '').toString().trim() : ''; };
  
  if (!get('Domain')) missing.push('Domain');
  if (!get('Admin Username') && !get('Username') && !get('WP_User')) missing.push('Admin Username');
  if (!get('Admin Password') && !get('Password') && !get('WP_App_Password')) missing.push('Admin Password');
  if (!get('Amazon Partner Tag') && !get('Partner_Tag')) missing.push('Amazon Partner Tag');
  if (!get('Niche_Description')) missing.push('Niche_Description (KRYTYCZNA! Opis niszy, 2-3 zdania)');
  
  if (missing.length > 0) {
    return { ok: false, error: 'Brakujące dane w Sites sheet dla ' + domain + ':\n\n• ' + missing.join('\n• ') + '\n\nUzupełnij i spróbuj ponownie.' };
  }
  
  // Check Claude API key
  var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return { ok: false, error: 'Brak CLAUDE_API_KEY w Script Properties.\nWAAS → Settings → Setup AI Keys' };
  
  return {
    ok: true,
    siteName: get('Site Name') || get('Name') || domain.split('.')[0],
    niche: get('Niche_Description'),
    partnerTag: get('Amazon Partner Tag') || get('Partner_Tag'),
    patron: get('Patron_Brand') || '',
    primaryColor: get('Primary_Color') || '#EF6C00',
  };
}


// ============================================================================
// MASTER: Full Site Transition
// ============================================================================

function cpSiteTransition() {
  var ui = SpreadsheetApp.getUi();
  
  // Check if running
  var existing = _tsGetState();
  if (existing && existing.status === 'running') {
    var r = ui.alert('⚠️ Transition w toku: ' + existing.domain +
      '\nStep ' + existing.currentStep + '/' + existing.totalSteps +
      '\n\nYES = Kontynuuj\nNO = Anuluj', ui.ButtonSet.YES_NO);
    if (r === ui.Button.YES) { cpTransitionResume(); return; }
    _tsClearState();
  }
  
  var resp = ui.prompt('🔄 Site Transition', 'Podaj domenę nowej strony:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  // VALIDATE
  var validation = _tsValidateSite(domain);
  if (!validation.ok) {
    ui.alert('❌ Walidacja nie przeszła\n\n' + validation.error);
    return;
  }
  
  // Test WP connection
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ cpGetSiteData failed for ' + domain); return; }
  var wpUrl = site.wpUrl || ('https://' + domain);
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) { ui.alert('❌ WordPress auth failed.\nSprawdź Username/Password w Sites sheet.'); return; }
  
  // Test cleanup endpoint
  var testResp = _cpCleanupCall(wpUrl, auth, 'inventory', {});
  if (!testResp) {
    ui.alert('❌ Endpoint /cleanup nie odpowiada.\nWgraj nowy waas-direct-publish.php (v1.4+) na ' + domain);
    return;
  }
  
  // Confirm
  var inv = testResp.results;
  var confirm = ui.alert('🔄 Site Transition — ' + domain,
    '✅ Walidacja OK\n' +
    'Site Name: ' + validation.siteName + '\n' +
    'Niche: ' + validation.niche.substring(0, 80) + '...\n' +
    'Partner Tag: ' + validation.partnerTag + '\n\n' +
    '📊 Aktualna zawartość:\n' +
    'Posts: ' + inv.posts + ' | Pages: ' + inv.pages + '\n' +
    'Products: ' + inv.products + ' | Media: ' + inv.media + '\n\n' +
    'PLAN:\n' +
    '1. Update Legal (Impressum, Datenschutz, Footer)\n' +
    '2. Delete old posts, products, tags\n' +
    '3. Clean remnants (stare nazwy)\n' +
    '4. Niche Replace (bulk str_replace from sheet)\n' +
    '5. AI Rewrite Markenprofil\n' +
    '6. Cleanup broken product shortcodes\n' +
    '7. Generate 3 basic blog posts via Claude AI\n' +
    '8. Export posts to WordPress\n' +
    '9. Deploy menu (auto via AI)\n' +
    '10. Verify site\n\n' +
    'Start?', ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  
  // Initialize state
  var state = {
    domain: domain, wpUrl: wpUrl, status: 'running',
    siteName: validation.siteName, niche: validation.niche,
    partnerTag: validation.partnerTag, patron: validation.patron,
    currentStep: 0, totalSteps: 10,
    steps: [
      { id: 'update_legal', name: 'Update Legal + Footer', done: false },
      { id: 'delete_old', name: 'Delete Old Content', done: false },
      { id: 'clean_remnants', name: 'Clean Remnants', done: false },
      { id: 'rewrite_pages', name: 'Niche Replace (Bulk str_replace)', done: false },
      { id: 'rewrite_markenprofil', name: 'AI Rewrite Markenprofil', done: false },
      { id: 'cleanup_shortcodes', name: 'Cleanup Broken Shortcodes', done: false },
      { id: 'generate_posts', name: 'Generate Blog Posts (Claude AI)', done: false },
      { id: 'export_posts', name: 'Export Posts to WordPress', done: false },
      { id: 'deploy_menu', name: 'Deploy Menu (Auto)', done: false },
      { id: 'verify', name: 'Verify Site', done: false },
    ],
    results: {}, log: [], ourPostIds: [],
    startedAt: new Date().toISOString()
  };
  
  // Collect our existing post IDs
  state.ourPostIds = _tsGetOurPostIds(domain);
  
  _tsSaveState(state);
  ui.alert('🔄 Transition Started!\n\nProces działa automatycznie.\nJeśli przekroczy limit → wznowi się sam za 30s.\n\nStatus: WAAS → Transition → 📋 Status');
  cpTransitionResume();
}


// ============================================================================
// RESUME — runs steps, respects time limit, auto-reschedules
// ============================================================================

function cpTransitionResume() {
  var state = _tsGetState();
  if (!state || state.status !== 'running') return;
  
  var startTime = new Date().getTime();
  var MAX_RT = 4.5 * 60 * 1000;
  
  var site = cpGetSiteData(state.domain);
  if (!site) { _tsLog(state, '❌ Site not found'); state.status = 'error'; _tsSaveState(state); return; }
  var wpUrl = state.wpUrl;
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) { _tsLog(state, '❌ Auth failed'); state.status = 'error'; _tsSaveState(state); return; }
  
  for (var i = 0; i < state.steps.length; i++) {
    var step = state.steps[i];
    if (step.done) continue;
    
    // Time check
    if (new Date().getTime() - startTime > MAX_RT) {
      _tsLog(state, '⏰ Time limit — resume in 30s');
      _tsScheduleResume(30);
      return;
    }
    
    state.currentStep = i + 1;
    _tsLog(state, '▶ Step ' + (i + 1) + ': ' + step.name);
    
    try {
      var result = _tsExecuteStep(state, step, wpUrl, auth, startTime, MAX_RT);
      if (result === 'TIMEOUT') {
        _tsScheduleResume(30);
        return;
      }
      step.done = true;
      _tsSaveState(state);
    } catch(e) {
      _tsLog(state, '❌ ' + step.name + ': ' + e.message);
      step.done = true;
      _tsSaveState(state);
    }
    
    Utilities.sleep(2000);
  }
  
  // DONE
  state.status = 'complete';
  state.completedAt = new Date().toISOString();
  var fi = _cpCleanupCall(wpUrl, auth, 'inventory', {});
  if (fi) state.results.final = fi.results;
  _tsSaveState(state);
  _tsWriteReport(state);
  
  // Clean triggers
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'cpTransitionResume') ScriptApp.deleteTrigger(t);
  });
}


// ============================================================================
// STEP EXECUTOR
// ============================================================================

function _tsExecuteStep(state, step, wpUrl, auth, startTime, maxRt) {
  switch (step.id) {
    
    // --- STEP 1: UPDATE LEGAL ---
    case 'update_legal':
      var legalResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/update-legal', {
        method: 'POST',
        headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ site_name: state.siteName, partner_tag: state.partnerTag }),
        muteHttpExceptions: true
      });
      _tsLog(state, legalResp.getResponseCode() === 200 ? '✅ Legal + Footer updated' : '⚠️ Legal HTTP ' + legalResp.getResponseCode());
      break;
    
    // --- STEP 2: DELETE OLD ---
    case 'delete_old':
      var dp = _cpCleanupCall(wpUrl, auth, 'delete_posts', { exclude_ids: state.ourPostIds || [] });
      var pr = _cpCleanupCall(wpUrl, auth, 'delete_products', {});
      var tg = _cpCleanupCall(wpUrl, auth, 'delete_tags', {});
      var ct = _cpCleanupCall(wpUrl, auth, 'delete_categories', { keep_slugs: ['uncategorized', 'blog'] });
      state.results.deleted = {
        posts: dp ? dp.results.deleted_posts : 0,
        products: pr ? pr.results.deleted_products : 0,
        tags: tg ? tg.results.deleted_tags : 0,
        cats: ct ? ct.results.deleted_categories : 0
      };
      _tsLog(state, '✅ Deleted: ' + state.results.deleted.posts + ' posts, ' +
        state.results.deleted.products + ' products, ' +
        state.results.deleted.tags + ' tags, ' +
        state.results.deleted.cats + ' categories');
      break;
    
    // --- STEP 3: CLEAN REMNANTS ---
    case 'clean_remnants':
      var scan = _cpCleanupCall(wpUrl, auth, 'scan_remnants', { old_names: _cpGetOldNames() });
      if (scan && !scan.results.clean) {
        var cl = _cpCleanupCall(wpUrl, auth, 'clean_remnants', {
          old_names: _cpGetOldNames(), new_name: state.siteName
        });
        state.results.cleaned = cl ? cl.results.fixed : 0;
        _tsLog(state, '✅ Cleaned ' + state.results.cleaned + ' remnants → "' + state.siteName + '"');
      } else {
        _tsLog(state, '✅ No remnants found');
      }
      break;
    
    // --- STEP 4: NICHE REPLACE (bulk str_replace from sheet) ---
    case 'rewrite_pages':
      return _tsBulkNicheReplace(state, wpUrl, auth);

    // --- STEP 4b: AI REWRITE MARKENPROFIL ---
    case 'rewrite_markenprofil':
      return _tsRewriteMarkenprofil(state, wpUrl, auth);

    // --- STEP 4c: CLEANUP BROKEN PRODUCT SHORTCODES ---
    case 'cleanup_shortcodes':
      return _tsCleanupShortcodes(state, wpUrl, auth);

    // --- STEP 5: GENERATE BLOG POSTS VIA CLAUDE ---
    case 'generate_posts':
      return _tsGeneratePostsAuto(state, wpUrl, auth, startTime, maxRt);
    
    // --- STEP 6: EXPORT POSTS TO WP ---
    case 'export_posts':
      return _tsExportPosts(state, wpUrl, auth);
    
    // --- STEP 7: DEPLOY MENU ---
    case 'deploy_menu':
      return _tsDeployMenu(state, wpUrl, auth);
    
    // --- STEP 8: VERIFY ---
    case 'verify':
      var check = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/site-check', {
        headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
        muteHttpExceptions: true
      });
      if (check.getResponseCode() === 200) {
        var sc = JSON.parse(check.getContentText());
        state.results.siteCheck = sc.score;
        _tsLog(state, '✅ Site Check: ' + sc.score + ' (' + sc.percent + '%)');
      }
      break;
  }
  return 'OK';
}


// ============================================================================
// REWRITE PAGES — extract → Claude API → apply (fully automatic)
// ============================================================================

function _tsRewritePagesAuto(state, wpUrl, auth, startTime, maxRt) {
  // Get page list if not cached
  if (!state.pagesToRewrite) {
    var pr = UrlFetchApp.fetch(wpUrl + '/wp-json/wp/v2/pages?per_page=50&_fields=id,title,slug,status', {
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce }, muteHttpExceptions: true
    });
    if (pr.getResponseCode() !== 200) { _tsLog(state, '❌ Cannot get pages'); return 'OK'; }
    var pages = JSON.parse(pr.getContentText());
    var skip = ['impressum', 'datenschutzerklaerung', 'datenschutz', 'amazon-partnerhinweis',
      'partnerhinweis', 'shop', 'warenkorb', 'mein-konto', 'kasse'];
    state.pagesToRewrite = pages
      .filter(function(p) { return p.status === 'publish' && skip.indexOf(p.slug) === -1; })
      .map(function(p) { return { id: p.id, title: p.title.rendered, slug: p.slug, done: false }; });
    state.pageIdx = 0;
    _tsSaveState(state);
  }
  
  for (var i = state.pageIdx; i < state.pagesToRewrite.length; i++) {
    // Time check
    if (new Date().getTime() - startTime > maxRt) {
      state.pageIdx = i;
      _tsSaveState(state);
      _tsLog(state, '⏰ Rewrite paused at page ' + (i + 1) + '/' + state.pagesToRewrite.length);
      return 'TIMEOUT';
    }
    
    var pg = state.pagesToRewrite[i];
    if (pg.done) continue;
    
    try {
      // 1. Extract texts
      var exResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/extract-texts/' + pg.id, {
        headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce }, muteHttpExceptions: true
      });
      if (exResp.getResponseCode() !== 200) { pg.done = true; continue; }
      var extracted = JSON.parse(exResp.getContentText());
      if (extracted.texts_found === 0) { pg.done = true; _tsLog(state, '  ⏭️ ' + pg.slug + ' (no texts)'); continue; }
      
      // 2. Build prompt
      var texts = extracted.texts.map(function(t) { return { idx: t.idx, type: t.type, text: t.text }; });
      var prompt = _tsBuildRewritePrompt(state, pg, texts, extracted.meta);
      
      // 3. Call Claude
      _tsLog(state, '  🤖 ' + pg.slug + ' → Claude (' + extracted.texts_found + ' texts)...');
      var aiResult = _tsCallClaude(prompt, 'Du bist ein professioneller deutscher Website-Texter. Antworte NUR mit JSON.', 4096);
      
      if (!aiResult.success) {
        _tsLog(state, '  ❌ Claude error: ' + aiResult.error);
        pg.done = true; continue;
      }
      
      // 4. Parse and apply
      var rewrite = _tsExtractJson(aiResult.text);
      if (rewrite.page_rewrite && rewrite.page_rewrite.replacements) {
        var payload = {
          post_id: pg.id,
          replacements: rewrite.page_rewrite.replacements,
          meta: rewrite.page_rewrite.meta || {},
          new_title: rewrite.page_rewrite.new_title || '',
          new_slug: rewrite.page_rewrite.new_slug || ''
        };
        
        var applyResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/replace-texts', {
          method: 'POST',
          headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
          payload: JSON.stringify(payload), muteHttpExceptions: true
        });
        
        if (applyResp.getResponseCode() === 200) {
          var applyResult = JSON.parse(applyResp.getContentText());
          _tsLog(state, '  ✅ ' + pg.slug + ' → ' + (applyResult.replacements_made || 0) + ' replacements applied');
        } else {
          _tsLog(state, '  ⚠️ ' + pg.slug + ' apply failed: HTTP ' + applyResp.getResponseCode());
        }
      } else {
        _tsLog(state, '  ⚠️ ' + pg.slug + ' — no replacements in Claude response');
      }
      
      pg.done = true;
    } catch(e) {
      _tsLog(state, '  ❌ ' + pg.slug + ': ' + e.message);
      pg.done = true;
    }
    
    state.pageIdx = i + 1;
    _tsSaveState(state);
    Utilities.sleep(3000); // Rate limit
  }
  
  return 'OK';
}

function _tsBuildRewritePrompt(state, page, texts, meta) {
  var textList = texts.map(function(t) {
    return '[' + t.idx + '] (' + t.type + '): "' + t.text + '"';
  }).join('\n');
  
  return 'DIVI PAGE TEXT REWRITE\n\n' +
    'Website: "' + state.siteName + '"\n' +
    'Nische: ' + state.niche + '\n' +
    (state.patron ? 'Markenpartner: ' + state.patron + '\n' : '') +
    'Seite: ' + page.slug + ' ("' + page.title + '")\n\n' +
    'AUFGABE: Schreibe JEDEN der folgenden Texte neu, passend zur Nische "' + state.niche + '".\n' +
    'BEWAHRE: Gleiche Länge (±20%), gleichen Ton, gleiche Struktur.\n\n' +
    'REGELN:\n' +
    '- Professionell, "Sie"-Form, deutsch\n' +
    '- Konkreter Bezug zur Nische\n' +
    '- Gleiche Textlänge wie Original\n' +
    '- Button-Text: kurz (2-4 Wörter)\n' +
    '- Heading: SEO-freundlich\n' +
    '- Keine erfundenen Zahlen/Statistiken\n\n' +
    'ORIGINAL-TEXTE:\n' + textList + '\n\n' +
    'ORIGINAL-META:\n' +
    '  title: "' + (meta.post_title || '') + '"\n' +
    '  keyword: "' + (meta.rank_math_focus_keyword || '') + '"\n\n' +
    'Antworte NUR mit diesem JSON:\n' +
    '{"page_rewrite":{"page_id":' + page.id + ',"new_title":"Neuer Titel","new_slug":"neuer-slug","meta":{"rank_math_title":"SEO Titel | ' + state.siteName + '","rank_math_description":"150-160 Zeichen","rank_math_focus_keyword":"hauptkeyword"},"replacements":[{"old":"EXAKTER Original-Text","new":"Neuer Text"}]}}\n\n' +
    'WICHTIG: "old" muss EXAKT dem Original entsprechen. Jeder Text braucht ein replacement.';
}


// ============================================================================
// GENERATE BLOG POSTS — Claude creates 3 posts for the niche
// ============================================================================

function _tsGeneratePostsAuto(state, wpUrl, auth, startTime, maxRt) {
  if (state.generatedPosts) { _tsLog(state, '⏭️ Posts already generated'); return 'OK'; }
  
  _tsLog(state, '🤖 Generating 3 blog posts via Claude...');
  
  var currentYear = new Date().getFullYear();

  var prompt = 'CONTENT GENERATION FÜR AFFILIATE-WEBSITE\n\n' +
    'Website: "' + state.siteName + '" (' + state.domain + ')\n' +
    'Nische: ' + state.niche + '\n' +
    (state.patron ? 'Markenpartner: ' + state.patron + '\n' : '') +
    'Amazon Partner Tag: ' + state.partnerTag + '\n' +
    'Aktuelles Jahr: ' + currentYear + '\n\n' +
    'AUFGABE: Erstelle 3 komplett verschiedene Blog-Artikel für diese Nische.\n\n' +
    'ANFORDERUNGEN PRO ARTIKEL:\n' +
    '- 1200-1800 Wörter\n' +
    '- Professionell, "Sie"-Form, deutsch\n' +
    '- SEO-optimiert (Keyword im Titel, H2s, erste 100 Wörter)\n' +
    '- Aktuelles Jahr ' + currentYear + ' im Titel oder Einleitung verwenden (z.B. "Ratgeber ' + currentYear + '")\n' +
    '- NIEMALS den Amazon-Partnerhinweis/Disclosure im Artikeltext einfügen! Der Hinweis "Als Amazon-Partner verdiene ich an qualifizierten Verkäufen" erscheint AUTOMATISCH im Footer der Website. NICHT im Artikel wiederholen!\n' +
    '- Mindestens 4 H2-Sektionen mit content_html\n' +
    '- Fazit-Sektion am Ende\n' +
    '- Keine Preise nennen → "Aktuellen Preis auf Amazon prüfen"\n\n' +
    'ARTIKEL-TYPEN:\n' +
    '1. RATGEBER — umfassende Kaufberatung (z.B. "Worauf achten beim Kauf von [Produkt]?")\n' +
    '2. HOW_TO — praktische Anleitung (z.B. "Wie Sie [Aufgabe] richtig erledigen")\n' +
    '3. PROBLEM_SOLVER — Problemlösung (z.B. "[Problem]? So lösen Sie es")\n\n' +
    'OUTPUT: NUR JSON, kein anderer Text:\n' +
    '{"posts":[{"title":"SEO H1","slug":"url-slug","excerpt":"160 Zeichen","keyword":"focus keyword","seo_title":"Max 60 Zeichen | ' + state.siteName + '","meta_description":"160 Zeichen","tags":["tag1","tag2"],' +
    '"sections":[{"heading":"H2 Überschrift","content_html":"<p>HTML content...</p>","type":"text"}],"word_count":1400}]}\n\n' +
    'WICHTIG:\n' +
    '- content_html muss valides HTML sein (<p>, <h3>, <ul>, <li>, <strong>, <table>)\n' +
    '- Jeder Artikel MUSS sich thematisch deutlich unterscheiden\n' +
    '- Echte, nützliche Inhalte — kein Fülltext\n' +
    '- Sections: mindestens 4 pro Artikel, mit heading + content_html + type\n' +
    '- KEIN Amazon-Partnerhinweis/Disclosure im Text — erscheint automatisch im Footer';
  
  var aiResult = _tsCallClaude(prompt,
    'Du bist ein erfahrener deutscher SEO-Texter für Amazon Affiliate Websites. Antworte NUR mit JSON. Kein Text davor oder danach.',
    16000);
  
  if (!aiResult.success) {
    _tsLog(state, '❌ Claude error: ' + aiResult.error);
    return 'OK';
  }
  
  try {
    var data = _tsExtractJson(aiResult.text);
    if (data.posts && data.posts.length > 0) {
      state.generatedPosts = data.posts;
      _tsSaveState(state);
      _tsLog(state, '✅ Generated ' + data.posts.length + ' posts: ' +
        data.posts.map(function(p) { return '"' + p.title.substring(0, 40) + '"'; }).join(', '));
    } else {
      _tsLog(state, '⚠️ No posts in Claude response');
    }
  } catch(e) {
    _tsLog(state, '❌ JSON parse error: ' + e.message);
  }
  
  return 'OK';
}


// ============================================================================
// EXPORT POSTS TO WORDPRESS
// ============================================================================

function _tsExportPosts(state, wpUrl, auth) {
  if (!state.generatedPosts || state.generatedPosts.length === 0) {
    _tsLog(state, '⏭️ No posts to export');
    return 'OK';
  }
  
  var exported = 0;
  
  for (var p = 0; p < state.generatedPosts.length; p++) {
    var post = state.generatedPosts[p];
    if (post.exported) continue;
    
    try {
      // Build Divi content
      var sections = post.sections || [];
      var content = _tsBuildDiviContent(sections);
      
      // Publish via pipeline
      var payload = {
        title: post.title,
        slug: post.slug,
        content: content,
        status: 'draft',
        excerpt: post.excerpt || '',
        post_type: 'post',
        category: 'Blog',
        tags: (post.tags || []).join(', '),
        meta: {
          rank_math_title: post.seo_title || post.title,
          rank_math_description: post.meta_description || post.excerpt,
          rank_math_focus_keyword: post.keyword || ''
        }
      };
      
      var pubResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/publish', {
        method: 'POST',
        headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
        payload: JSON.stringify(payload), muteHttpExceptions: true
      });
      
      if (pubResp.getResponseCode() === 200) {
        var result = JSON.parse(pubResp.getContentText());
        post.exported = true;
        post.postId = result.post_id;
        exported++;
        
        // Track as our post
        if (!state.ourPostIds) state.ourPostIds = [];
        state.ourPostIds.push(result.post_id);
        
        _tsLog(state, '  ✅ "' + post.title.substring(0, 40) + '" → #' + result.post_id);
      } else {
        _tsLog(state, '  ❌ Export failed: HTTP ' + pubResp.getResponseCode());
      }
    } catch(e) {
      _tsLog(state, '  ❌ ' + post.title.substring(0, 30) + ': ' + e.message);
      post.exported = true;
    }
    
    _tsSaveState(state);
    Utilities.sleep(2000);
  }
  
  _tsLog(state, '✅ Exported ' + exported + ' posts as DRAFT');
  return 'OK';
}

function _tsBuildDiviContent(sections) {
  var V = '5.0.0-public-beta.8.2';
  var esc = function(s) { return (s||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\n/g,'\\n'); };
  var sO = '<!-- wp:divi/section {"builderVersion":"' + V + '"} -->';
  var sC = '<!-- /wp:divi/section -->';
  var rO = '<!-- wp:divi/row {"builderVersion":"' + V + '"} -->';
  var rC = '<!-- /wp:divi/row -->';
  var cO = '<!-- wp:divi/column {"builderVersion":"' + V + '"} -->';
  var cC = '<!-- /wp:divi/column -->';
  var parts = ['<!-- wp:divi/placeholder -->'];
  sections.forEach(function(s) {
    parts.push(sO, rO, cO);
    if (s.heading) parts.push('<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"' + esc(s.heading) + '"}}}} /-->');
    if (s.content_html) parts.push('<!-- wp:divi/text {"content":{"innerContent":{"desktop":{"value":"' + esc(s.content_html) + '"}}}} /-->');
    parts.push(cC, rC, sC);
  });
  parts.push('<!-- /wp:divi/placeholder -->');
  return parts.join('\n');
}


// ============================================================================
// DEPLOY MENU — from Menu_CP sheet or auto-create basic menu
// ============================================================================

function _tsDeployMenu(state, wpUrl, auth) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuSheet = ss.getSheetByName('Menu_CP');
  
  // Check if menu exists for this domain
  var hasMenu = false;
  if (menuSheet) {
    var menuData = menuSheet.getDataRange().getValues();
    for (var r = 1; r < menuData.length; r++) {
      if ((menuData[r][0] || '').toString().trim() === state.domain) { hasMenu = true; break; }
    }
  }
  
  if (hasMenu) {
    // Use existing cpDeployMenu logic
    try {
      // Read menu items from sheet
      var menuItems = _tsReadMenuFromSheet(state.domain, menuSheet);
      if (menuItems.length > 0) {
        var menuResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/set-menu', {
          method: 'POST',
          headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
          payload: JSON.stringify({ menu_name: 'Hauptmenü', items: menuItems }),
          muteHttpExceptions: true
        });
        if (menuResp.getResponseCode() === 200) {
          var mr = JSON.parse(menuResp.getContentText());
          _tsLog(state, '✅ Menu deployed: ' + mr.items_created + ' items');
        }
      }
    } catch(e) {
      _tsLog(state, '⚠️ Menu deploy error: ' + e.message);
    }
  } else {
    // Fallback: auto-generate menu from existing pages via Claude AI
    _tsLog(state, '📋 No menu in Menu_CP — generating auto-menu via AI...');
    return _tsAutoMenu(state, wpUrl, auth);
  }
  return 'OK';
}

function _tsReadMenuFromSheet(domain, sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  var items = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if ((row[col['Domain']] || '').toString().trim() !== domain) continue;
    if (row[col['Active']] !== true) continue;
    
    var item = {
      title: (row[col['Title']] || '').toString().trim(),
      parent: (row[col['Parent']] || '').toString().trim(),
      type: (row[col['Type']] || 'custom').toString().trim(),
      slug: (row[col['Slug_or_URL']] || '').toString().trim(),
      object_id: parseInt(row[col['WP_Object_ID']] || 0),
      order: parseInt(row[col['Order']] || 0)
    };
    if (item.type === 'external') { item.url = item.slug; item.type = 'custom'; }
    items.push(item);
  }
  items.sort(function(a, b) { return a.order - b.order; });
  return items;
}


// ============================================================================
// MARKENPROFIL AI REWRITE — rewrite brand profile page via Claude
// ============================================================================

function _tsRewriteMarkenprofil(state, wpUrl, auth) {
  // 1. Find markenprofil page
  var pagesResp = UrlFetchApp.fetch(wpUrl + '/wp-json/wp/v2/pages?per_page=50&_fields=id,title,slug,status', {
    headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce }, muteHttpExceptions: true
  });
  if (pagesResp.getResponseCode() !== 200) {
    _tsLog(state, '⚠️ Markenprofil: cannot get pages');
    return 'OK';
  }
  var pages = JSON.parse(pagesResp.getContentText());
  var mp = null;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].slug === 'markenprofil' && pages[i].status === 'publish') { mp = pages[i]; break; }
  }
  if (!mp) {
    _tsLog(state, '⏭️ Markenprofil: page not found — skip');
    return 'OK';
  }

  // 2. Generate NEW Markenprofil content via Claude AI
  //    Approach: generate complete Divi 5 sections, then publish via /update-content
  //    This avoids the fragile extract→replace approach that fails with 20+ text blocks
  _tsLog(state, '🤖 Markenprofil: generating new content via Claude AI...');

  var nicheShort = state.niche.split('.')[0].split(',')[0].trim();

  var prompt = 'MARKENPROFIL — NEUE SEITE GENERIEREN\n\n' +
    'Website: "' + state.siteName + '" (' + state.domain + ')\n' +
    'Nische: ' + state.niche + '\n\n' +
    'KONTEXT: Diese Website ist ein UNABHÄNGIGES Informationsportal über ' + nicheShort + '. ' +
    'Es ist KEINE Herstellerseite, KEINE Marke und KEIN Hersteller. ' +
    'Das Portal bietet Ratgeber, Tests, Vergleiche und Kaufberatung.\n\n' +
    'AUFGABE: Erstelle den kompletten Seiteninhalt für "Über uns / Markenprofil".\n\n' +
    'INHALT MUSS ENTHALTEN:\n' +
    '1. Headline: "Über ' + state.siteName + '"\n' +
    '2. Einleitung: Wer wir sind — unabhängiges Informationsportal für ' + nicheShort + '\n' +
    '3. Was wir bieten: Produktvergleiche, Ratgeber, Anleitungen, aktuelle Tests\n' +
    '4. Unser Versprechen: ehrliche, unabhängige Empfehlungen\n' +
    '5. Wie wir arbeiten: Produkte recherchieren, vergleichen, Erfahrungen teilen\n' +
    '6. Amazon-Partnerschaft: Kurzer Hinweis dass wir als Amazon-Partner Produkte verlinken\n\n' +
    'VERBOTEN:\n' +
    '- KEINE Firmenhistorie, KEINE Gründergeschichte\n' +
    '- KEINE persönlichen Namen (keine WERonika, HElena, oder andere)\n' +
    '- KEINE Telefonnummern, E-Mail-Adressen, Postanschriften\n' +
    '- KEINE Herstellerkontakte oder Firmendaten\n' +
    '- KEINE erfundenen Zahlen oder Statistiken\n\n' +
    'FORMAT: Professionell, "Sie"-Form, deutsch, 400-600 Wörter gesamt.\n\n' +
    'Antworte NUR mit JSON:\n' +
    '{"sections":[{"heading":"Überschrift","content_html":"<p>HTML...</p>"},...],\n' +
    '"seo_title":"Über uns | ' + state.siteName + '",\n' +
    '"meta_description":"' + state.siteName + ' — Ihr unabhängiges Portal für ' + nicheShort + '. Ratgeber, Tests und Produktvergleiche.",\n' +
    '"focus_keyword":"' + nicheShort + ' Ratgeber"}';

  var aiResult = _tsCallClaude(prompt,
    'Du bist ein professioneller deutscher Website-Texter. Erstelle Inhalte für ein unabhängiges Informationsportal. Antworte NUR mit JSON.',
    4096);

  if (!aiResult.success) {
    _tsLog(state, '❌ Markenprofil Claude error: ' + aiResult.error);
    return 'OK';
  }

  // 3. Parse response and build Divi 5 content
  try {
    var data = _tsExtractJson(aiResult.text);
    if (!data.sections || data.sections.length === 0) {
      _tsLog(state, '⚠️ Markenprofil: no sections in Claude response');
      return 'OK';
    }

    // Build Divi 5 block content from sections
    var content = _tsBuildDiviContent(data.sections);

    // 4. Update the page via WP REST API (direct update, not replace-texts)
    var updatePayload = {
      title: 'Über ' + state.siteName,
      content: content
    };

    var updateResp = UrlFetchApp.fetch(wpUrl + '/wp-json/wp/v2/pages/' + mp.id, {
      method: 'POST',
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
      payload: JSON.stringify(updatePayload), muteHttpExceptions: true
    });

    if (updateResp.getResponseCode() === 200) {
      // Update SEO meta via postmeta
      var metaUpdates = {};
      if (data.seo_title) metaUpdates.rank_math_title = data.seo_title;
      if (data.meta_description) metaUpdates.rank_math_description = data.meta_description;
      if (data.focus_keyword) metaUpdates.rank_math_focus_keyword = data.focus_keyword;

      if (Object.keys(metaUpdates).length > 0) {
        // Use replace-texts endpoint just for meta (no replacements, just meta)
        UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/replace-texts', {
          method: 'POST',
          headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
          payload: JSON.stringify({ post_id: mp.id, replacements: [], meta: metaUpdates }),
          muteHttpExceptions: true
        });
      }

      state.results.markenprofil = { sections: data.sections.length, method: 'full_replace' };
      _tsLog(state, '✅ Markenprofil rewritten: ' + data.sections.length + ' sections (full content replace)');
    } else {
      _tsLog(state, '⚠️ Markenprofil update failed: HTTP ' + updateResp.getResponseCode());
    }
  } catch(e) {
    _tsLog(state, '❌ Markenprofil error: ' + e.message);
  }

  return 'OK';
}


// ============================================================================
// CLEANUP BROKEN SHORTCODES — remove [waas_product ...] from content
// ============================================================================

function _tsCleanupShortcodes(state, wpUrl, auth) {
  // 1. Dry run — see how many posts are affected
  _tsLog(state, '🔎 Cleanup shortcodes: scanning...');
  try {
    var scanResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-niche/v1/cleanup-shortcodes', {
      method: 'POST',
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ dry_run: true }),
      muteHttpExceptions: true
    });

    if (scanResp.getResponseCode() !== 200) {
      _tsLog(state, '⚠️ Cleanup shortcodes: endpoint not available (HTTP ' + scanResp.getResponseCode() + ')');
      return 'OK';
    }

    var scanResult = JSON.parse(scanResp.getContentText());
    var affected = scanResult.results.affected_posts || 0;

    if (affected === 0) {
      _tsLog(state, '✅ No broken shortcodes found');
      return 'OK';
    }

    _tsLog(state, '  📊 Found ' + affected + ' posts with [waas_product] shortcodes');

    // 2. Execute cleanup
    var execResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-niche/v1/cleanup-shortcodes', {
      method: 'POST',
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ dry_run: false }),
      muteHttpExceptions: true
    });

    if (execResp.getResponseCode() === 200) {
      var execResult = JSON.parse(execResp.getContentText());
      state.results.shortcodesCleanup = { affected: execResult.results.affected_posts };
      _tsLog(state, '✅ Cleaned shortcodes from ' + execResult.results.affected_posts + ' posts');
    } else {
      _tsLog(state, '⚠️ Cleanup shortcodes execute failed: HTTP ' + execResp.getResponseCode());
    }
  } catch(e) {
    _tsLog(state, '❌ Cleanup shortcodes error: ' + e.message);
  }

  return 'OK';
}


// ============================================================================
// AUTO-MENU — generate hierarchical menu from existing pages via Claude AI
// ============================================================================

function _tsAutoMenu(state, wpUrl, auth) {
  // 1. Get site structure (pages list)
  try {
    var structResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/get-site-structure', {
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
      muteHttpExceptions: true
    });
    if (structResp.getResponseCode() !== 200) {
      _tsLog(state, '❌ Auto-menu: get-site-structure failed (HTTP ' + structResp.getResponseCode() + ')');
      return 'OK';
    }
    var structure = JSON.parse(structResp.getContentText());
    var pages = structure.pages || [];
    if (pages.length === 0) {
      _tsLog(state, '⚠️ Auto-menu: no pages found');
      return 'OK';
    }
  } catch(e) {
    _tsLog(state, '❌ Auto-menu: ' + e.message);
    return 'OK';
  }

  // 2. Filter out legal/utility pages
  var skipSlugs = ['impressum', 'datenschutzerklaerung', 'datenschutz', 'amazon-partnerhinweis',
    'partnerhinweis', 'warenkorb', 'mein-konto', 'kasse', 'widerrufsbelehrung'];
  var menuPages = pages.filter(function(p) {
    return skipSlugs.indexOf(p.slug) === -1;
  });

  if (menuPages.length === 0) {
    _tsLog(state, '⚠️ Auto-menu: all pages are legal/utility — skip');
    return 'OK';
  }

  // 3. Build page list for Claude prompt
  var pageList = menuPages.map(function(p, i) {
    return (i + 1) + '. "' + p.title + '" (ID: ' + p.id + ', slug: ' + p.slug + ')';
  }).join('\n');

  var prompt = 'Erstelle ein logisches Navigationsmenü für die Website "' + state.siteName + '".\n' +
    'Nische: ' + state.niche + '\n\n' +
    'Vorhandene Seiten:\n' + pageList + '\n\n' +
    'REGELN:\n' +
    '- Homepage (slug: leer oder "home" oder erste Seite) → Menütitel "Start", immer erster Punkt\n' +
    '- Blog/Ratgeber-Seite → eigener Hauptpunkt\n' +
    '- Markenprofil → eigener Hauptpunkt (wenn vorhanden)\n' +
    '- Shop-Seite → eigener Hauptpunkt (wenn vorhanden)\n' +
    '- Legal-Seiten (Impressum, Datenschutz, Partnerhinweis, Warenkorb) → NICHT im Menü\n' +
    '- Restliche Seiten → logisch gruppieren: thematisch verwandte Seiten als Unterpunkte unter einem Hauptpunkt\n' +
    '- Maximal 6 Hauptpunkte, maximal 4 Unterpunkte pro Hauptpunkt\n' +
    '- Menütitel: kurz (2-3 Wörter), benutzerfreundlich\n\n' +
    'Antworte NUR mit JSON-Array:\n' +
    '[{"title":"Start","page_id":70,"children":[]},{"title":"Werkzeuge","page_id":31,"children":[{"title":"Ratgeber","page_id":28}]},...]';

  // 4. Call Claude AI
  _tsLog(state, '🤖 Auto-menu: calling Claude AI for ' + menuPages.length + ' pages...');
  var aiResult = _tsCallClaude(prompt,
    'Du bist ein Website-Menü-Experte. Erstelle eine klare, logische Navigation. Antworte NUR mit einem JSON-Array. Kein Text davor oder danach.',
    2048);

  if (!aiResult.success) {
    _tsLog(state, '❌ Auto-menu Claude error: ' + aiResult.error);
    return 'OK';
  }

  // 5. Parse Claude response
  var hierarchy;
  try {
    var clean = aiResult.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var start = clean.indexOf('[');
    var end = clean.lastIndexOf(']');
    if (start >= 0 && end > start) clean = clean.substring(start, end + 1);
    hierarchy = JSON.parse(clean);
  } catch(e) {
    _tsLog(state, '❌ Auto-menu JSON parse error: ' + e.message);
    _tsLog(state, '  Raw: ' + aiResult.text.substring(0, 200));
    return 'OK';
  }

  if (!Array.isArray(hierarchy) || hierarchy.length === 0) {
    _tsLog(state, '⚠️ Auto-menu: empty hierarchy from Claude');
    return 'OK';
  }

  // 6. Convert hierarchy to flat set-menu format (parents BEFORE children!)
  var menuItems = [];
  hierarchy.forEach(function(item) {
    menuItems.push({
      title: item.title || '',
      type: 'page',
      object_id: item.page_id || 0,
      parent: ''
    });
    if (item.children && item.children.length > 0) {
      item.children.forEach(function(child) {
        menuItems.push({
          title: child.title || '',
          type: 'page',
          object_id: child.page_id || 0,
          parent: item.title || ''
        });
      });
    }
  });

  if (menuItems.length === 0) {
    _tsLog(state, '⚠️ Auto-menu: no items after conversion');
    return 'OK';
  }

  // 7. Deploy menu via set-menu endpoint
  _tsLog(state, '🔄 Auto-menu: deploying ' + menuItems.length + ' items...');
  try {
    var menuResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/set-menu', {
      method: 'POST',
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ menu_name: 'Hauptmenü', items: menuItems }),
      muteHttpExceptions: true
    });

    if (menuResp.getResponseCode() === 200) {
      var mr = JSON.parse(menuResp.getContentText());
      state.results.autoMenu = { items: mr.items_created, hierarchy: hierarchy.length + ' top-level' };
      _tsLog(state, '✅ Auto-menu deployed: ' + mr.items_created + ' items (' + hierarchy.length + ' top-level)');
    } else {
      _tsLog(state, '❌ Auto-menu set-menu failed: HTTP ' + menuResp.getResponseCode());
    }
  } catch(e) {
    _tsLog(state, '❌ Auto-menu deploy error: ' + e.message);
  }

  return 'OK';
}


// ============================================================================
// STATUS / CANCEL
// ============================================================================

function cpTransitionStatus() {
  var ui = SpreadsheetApp.getUi();
  var state = _tsGetState();
  if (!state) { ui.alert('Brak aktywnego transition.'); return; }
  
  var sl = state.steps.map(function(s, i) {
    return (s.done ? '✅' : (i + 1 === state.currentStep ? '▶' : '⏳')) + ' ' + (i + 1) + '. ' + s.name;
  }).join('\n');
  var log = (state.log || []).slice(-15).join('\n');
  
  ui.alert('🔄 Transition — ' + state.domain + '\n\n' +
    'Status: ' + state.status + '\n' +
    'Step: ' + state.currentStep + '/' + state.totalSteps + '\n\n' +
    sl + '\n\n--- Log ---\n' + log);
}

function cpTransitionCancel() {
  _tsClearState();
  SpreadsheetApp.getUi().alert('Cancelled. State cleared.');
}


// ============================================================================
// INDIVIDUAL STEPS (available separately from menu)
// ============================================================================

function cpTransitionInventory() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('📊 Inventory', 'Domain:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var d = resp.getResponseText().trim();
  var site = cpGetSiteData(d); if (!site) { ui.alert('Not found'); return; }
  var w = site.wpUrl || ('https://' + d);
  var a = cpGetWPAuthForMedia(site, w); if (!a.cookies) { ui.alert('Auth fail'); return; }
  var inv = _cpCleanupCall(w, a, 'inventory', {});
  if (!inv) { ui.alert('Failed — is new mu-plugin installed?'); return; }
  var r = inv.results;
  ui.alert('📊 ' + d + '\n\nPosts: ' + r.posts + '\nPages: ' + r.pages + '\nProducts: ' + r.products + '\nMedia: ' + r.media + '\nCategories: ' + r.categories + '\nTags: ' + r.tags);
}

function cpTransitionScanRemnants() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('🔎 Scan Remnants', 'Domain:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var d = resp.getResponseText().trim();
  var site = cpGetSiteData(d); if (!site) { ui.alert('Not found'); return; }
  var w = site.wpUrl || ('https://' + d);
  var a = cpGetWPAuthForMedia(site, w); if (!a.cookies) { ui.alert('Auth fail'); return; }
  var sc = _cpCleanupCall(w, a, 'scan_remnants', { old_names: _cpGetOldNames() });
  if (!sc) { ui.alert('Failed'); return; }
  if (sc.results.clean) { ui.alert('✅ Clean!'); return; }
  var msg = '';
  for (var n in sc.results.remnants) { var r = sc.results.remnants[n]; msg += '"' + n + '": ' + r.options + ' opt, ' + r.postmeta + ' meta, ' + r.posts + ' posts\n'; }
  ui.alert('🔎 Remnants:\n\n' + msg);
}

function cpTransitionCleanRemnants() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('🧽 Clean', 'Domain:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var d = resp.getResponseText().trim();
  var v = _tsValidateSite(d);
  if (!v.ok) { ui.alert(v.error); return; }
  var site = cpGetSiteData(d); var w = site.wpUrl || ('https://' + d);
  var a = cpGetWPAuthForMedia(site, w); if (!a.cookies) { ui.alert('Auth fail'); return; }
  var r = _cpCleanupCall(w, a, 'clean_remnants', { old_names: _cpGetOldNames(), new_name: v.siteName });
  ui.alert('✅ Cleaned ' + (r.results.fixed || 0) + ' → "' + v.siteName + '"');
}


// ============================================================================
// NICHE REPLACE — deterministic bulk str_replace (replaces AI rewrite)
// ============================================================================

function _tsBulkNicheReplace(state, wpUrl, auth) {
  // 1. Read replacement pairs from Transition_Map_CP sheet
  var pairs = _tsGetReplacementPairs(state.domain);
  if (pairs.length === 0) {
    _tsLog(state, '⚠️ No replacement pairs in Transition_Map_CP for ' + state.domain + ' — skip');
    return 'OK';
  }

  // 2. Dry run first (via standalone waas-niche-replace.php endpoint)
  _tsLog(state, '🔎 Niche Replace: ' + pairs.length + ' pairs — dry run...');
  var scanResult = _tsNicheReplaceCall(wpUrl, auth, pairs, true);
  if (scanResult && scanResult.results && scanResult.results.stats) {
    var totalHits = 0;
    scanResult.results.stats.forEach(function(s) { totalHits += (s.hits || 0); });
    _tsLog(state, '  📊 Dry run: ' + totalHits + ' total hits across ' + pairs.length + ' pairs');
    if (totalHits === 0) {
      _tsLog(state, '  ✅ Nothing to replace — all clean');
      return 'OK';
    }
  }

  // 3. Execute replacement
  _tsLog(state, '🔄 Executing niche replace...');
  var result = _tsNicheReplaceCall(wpUrl, auth, pairs, false);

  if (result && result.success) {
    state.results.nicheReplace = result.results;
    _tsLog(state, '✅ Niche replace done: ' + result.results.pairs_processed + ' pairs applied');
  } else {
    _tsLog(state, '❌ Niche replace failed: ' + (result ? JSON.stringify(result).substring(0, 200) : 'no response'));
  }

  return 'OK';
}

/**
 * Call standalone waas-niche-replace.php endpoint (bypasses OPcache issue)
 * Endpoint: POST /wp-json/waas-niche/v1/replace
 */
function _tsNicheReplaceCall(wpUrl, auth, pairs, dryRun) {
  try {
    var r = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-niche/v1/replace', {
      method: 'POST',
      headers: {
        'Cookie': auth.cookies,
        'X-WP-Nonce': auth.nonce,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ pairs: pairs, dry_run: !!dryRun }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() === 200) {
      return JSON.parse(r.getContentText());
    }
    Logger.log('Niche replace HTTP ' + r.getResponseCode() + ': ' + r.getContentText().substring(0, 300));
    return null;
  } catch(e) {
    Logger.log('Niche replace error: ' + e.message);
    return null;
  }
}

function _tsGetReplacementPairs(targetDomain) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transition_Map_CP');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });

  var pairs = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var rowTarget = (row[col['Target_Domain']] || '').toString().trim();
    if (rowTarget !== targetDomain && rowTarget !== '*') continue;
    if (row[col['Active']] !== true && row[col['Active']].toString().toUpperCase() !== 'TRUE') continue;

    var oldTerm = (row[col['Source_Term']] || '').toString().trim();
    var newTerm = (row[col['Target_Term']] || '').toString().trim();
    if (!oldTerm || !newTerm || oldTerm === newTerm) continue;

    var priority = parseInt(row[col['Priority']] || 0) || 0;
    pairs.push({ old: oldTerm, new: newTerm, priority: priority });
  }

  // Sort: highest priority first, then longest string first
  pairs.sort(function(a, b) {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.old.length - a.old.length;
  });

  return pairs;
}


// ============================================================================
// TRANSITION MAP SHEET — setup and populate
// ============================================================================

function cpSetupTransitionMapSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName('Transition_Map_CP');
  if (existing) {
    SpreadsheetApp.getUi().alert('Sheet "Transition_Map_CP" already exists.');
    return;
  }

  var sheet = ss.insertSheet('Transition_Map_CP');
  var headers = ['Source_Template', 'Source_Term', 'Target_Term', 'Target_Domain', 'Type', 'Priority', 'Active', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4a86c8').setFontColor('white');
  sheet.setFrozenRows(1);

  // Column widths
  sheet.setColumnWidth(1, 220); // Source_Template
  sheet.setColumnWidth(2, 200); // Source_Term
  sheet.setColumnWidth(3, 200); // Target_Term
  sheet.setColumnWidth(4, 220); // Target_Domain
  sheet.setColumnWidth(5, 100); // Type
  sheet.setColumnWidth(6, 80);  // Priority
  sheet.setColumnWidth(7, 70);  // Active
  sheet.setColumnWidth(8, 250); // Notes

  // Data validation for Type column
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['brand', 'product', 'technical', 'description', 'category', 'slug', 'meta'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 5, 500, 1).setDataValidation(typeRule);

  // Checkboxes for Active column
  sheet.getRange(2, 7, 500, 1).insertCheckboxes();

  SpreadsheetApp.getUi().alert('✅ Sheet "Transition_Map_CP" created.\n\nUse "Populate Map for Domain" to add template rows for a target domain.');
}

function cpPopulateTransitionMap() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transition_Map_CP');
  if (!sheet) { ui.alert('❌ Sheet "Transition_Map_CP" not found.\nUse "Setup Transition Map" first.'); return; }

  var resp = ui.prompt('📋 Populate Transition Map',
    'Enter the TARGET domain (e.g., rasenkante.lk24.shop):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var targetDomain = resp.getResponseText().trim();

  var resp2 = ui.prompt('📋 Source Template',
    'Enter the SOURCE template domain (default: erdloch-bohren.lk24.shop):', ui.ButtonSet.OK_CANCEL);
  var sourceTemplate = 'erdloch-bohren.lk24.shop';
  if (resp2.getSelectedButton() === ui.Button.OK && resp2.getResponseText().trim()) {
    sourceTemplate = resp2.getResponseText().trim();
  }

  // Template terms for erdloch-bohren (extend as needed)
  var templateTerms = [
    { term: 'Erdloch-Bohren', type: 'brand', priority: 100, notes: 'Site name / brand' },
    { term: 'Erdbohrer', type: 'product', priority: 90, notes: 'Main product category' },
    { term: 'Erdlochbohrer', type: 'product', priority: 90, notes: 'Product variant' },
    { term: 'Erdloch bohren', type: 'technical', priority: 85, notes: 'Main action' },
    { term: 'Bohrung', type: 'technical', priority: 80, notes: 'Technical noun' },
    { term: 'Bohren', type: 'technical', priority: 70, notes: 'Action verb' },
    { term: 'Bohrtiefe', type: 'technical', priority: 75, notes: 'Technical term' },
    { term: 'Bohrdurchmesser', type: 'technical', priority: 75, notes: 'Technical term' },
    { term: 'Erdbohrer-Ratgeber', type: 'category', priority: 80, notes: 'Category name' },
    { term: 'Bohr-Tipps', type: 'category', priority: 80, notes: 'Category name' },
    { term: 'Zaunpfahl', type: 'product', priority: 70, notes: 'Related product' },
    { term: 'Pflanzloch', type: 'technical', priority: 70, notes: 'Use case' },
  ];

  var rows = templateTerms.map(function(t) {
    return [sourceTemplate, t.term, '', targetDomain, t.type, t.priority, true, t.notes + ' — FILL Target_Term!'];
  });

  var lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);

  // Re-apply checkboxes
  sheet.getRange(lastRow + 1, 7, rows.length, 1).insertCheckboxes();
  // Highlight empty Target_Term cells
  sheet.getRange(lastRow + 1, 3, rows.length, 1).setBackground('#FFEB3B');

  ui.alert('✅ Added ' + rows.length + ' template rows for ' + targetDomain + '.\n\n' +
    '⚠️ FILL IN the yellow Target_Term column!\n' +
    'Then run Transition to apply.');
}


// ============================================================================
// REPORT + HELPERS
// ============================================================================

function _tsWriteReport(state) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ls = ss.getSheetByName('Logs');
  if (!ls) { ls = ss.insertSheet('Logs'); ls.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Type', 'Message']]).setFontWeight('bold'); }
  var d = state.results.deleted || {};
  var summary = 'TRANSITION COMPLETE: ' + state.domain +
    ' | Del: ' + (d.posts || 0) + 'p ' + (d.products || 0) + 'pr ' + (d.cats || 0) + 'c ' + (d.tags || 0) + 't' +
    ' | Cleaned: ' + (state.results.cleaned || 0) +
    ' | Posts: ' + (state.generatedPosts ? state.generatedPosts.length : 0) +
    ' | Check: ' + (state.results.siteCheck || '?');
  ls.appendRow([new Date(), 'TRANSITION', summary]);
  (state.log || []).forEach(function(e) { ls.appendRow([new Date(), 'TR_LOG', e]); });
}

function _tsGetOurPostIds(domain) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cpSheet = ss.getSheetByName('Content Pipeline');
  if (!cpSheet) return [];
  var d = cpSheet.getDataRange().getValues(); var h = d[0]; var c = {};
  h.forEach(function(hh, i) { c[hh.toString().trim()] = i; });
  var ids = [];
  for (var r = 1; r < d.length; r++) {
    if ((d[r][c['Target_Domain_CP']] || '').toString().trim() !== domain) continue;
    var pid = parseInt(d[r][c['Post_ID_CP']] || 0);
    var eid = parseInt(d[r][c['Existing_Post_ID_CP']] || 0);
    if (pid > 0) ids.push(pid); if (eid > 0) ids.push(eid);
  }
  return ids;
}

function _cpCleanupCall(wpUrl, auth, action, params) {
  try {
    params.action = action;
    var r = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/cleanup', {
      method: 'POST',
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
      payload: JSON.stringify(params), muteHttpExceptions: true
    });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
  } catch(e) { return null; }
}

function _cpGetOldNames() {
  return ['MeißelTechnik','Meisseltechnik','meisseltechnik','WERHE Meißel','WERHE Werkzeug',
    'Erdloch-Bohren','Erdbohrer Ratgeber','Passgenaue LKW','KRAM TRUCK',
    'Sägeblatttechnik','Bohradaptertechnik','Betonbohrtechnik','Betonsägetechnik',
    'Rasenkante Cortenstahl','Magnetbohrmaschine'];
}

function _cpGetSiteNameFromSheet(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); var s = ss.getSheetByName('Sites');
  if (!s) return d.split('.')[0]; var dd = s.getDataRange().getValues(); var h = dd[0]; var c = {};
  h.forEach(function(hh, i) { c[hh.toString().trim()] = i; });
  for (var r = 1; r < dd.length; r++) { if ((dd[r][c['Domain'] || 2] || '').toString().trim() === d) return (dd[r][c['Site Name'] || c['Name'] || 1] || '').toString() || d.split('.')[0]; }
  return d.split('.')[0];
}