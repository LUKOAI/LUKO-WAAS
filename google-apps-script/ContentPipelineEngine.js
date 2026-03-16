/**
 * WAAS CONTENT PIPELINE v4.2 — ENGINE MODULE
 * Prompt generation, parsing, quality score, export
 * 
 * v4.2 CHANGE: Export uses waas-direct-publish.php mu-plugin (direct SQL)
 *              → encoding safe, RankMath SEO, Divi meta, Featured Image
 * 
 * Wymaga: ContentPipeline.gs (config, setup, naming)
 *         waas-direct-publish.php (mu-plugin on WP sites)
 *         ContentPipelineImages.gs (cpGetWPAuthForMedia)
 * 
 * @version 4.2
 * @date 2026-03-06
 */

// FLOW 1: GENERATE TEXT PROMPT (BEZ mediów!)
// ============================================================================

function cpGenerateTextPrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0]; // Wiersz 1 = nagłówki
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  // Sprawdź czy kolumny Pipeline istnieją
  if (!('▶Text_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.\nUruchom najpierw: Setup Pipeline Columns');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Text_CP']] !== true) continue;
    if (!row[col['Working_Title_CP']] && !row[col['Primary_Keyword_CP']]) continue;
    
    const sheetRow = r + 1;
    
    // Auto-generate ID_CP jeśli nie ma
    if (!row[col['ID_CP']]) {
      const siteUrl = findSiteUrl(row, col);
      const cpId = cpGenerateContentId(siteUrl);
      sheet.getRange(sheetRow, col['ID_CP'] + 1).setValue(cpId);
      row[col['ID_CP']] = cpId;
    }
    
    // Auto-fill Target_Domain_CP jeśli puste (domyślne z kontekstu, edytowalne)
    if (!row[col['Target_Domain_CP']] && col['Target_Domain_CP'] !== undefined) {
      const siteUrl = findSiteUrl(row, col);
      sheet.getRange(sheetRow, col['Target_Domain_CP'] + 1).setValue(siteUrl);
    }
    
    // Zbuduj TEXT-ONLY prompt
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildTextPrompt(config);
    
    // Force text format (prevent = being interpreted as formula)
    const promptCell = sheet.getRange(sheetRow, col['Text_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Text_CP'] + 1).setValue('DONE');
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0 
      ? `✅ Wygenerowano ${generated} TEXT prompt(ów).\n\nSkopiuj prompt z kolumny Text_Prompt_CP → wklej do AI → wklej JSON do Text_Response_CP → zaznacz ▶ParseText_CP.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Text_CP.'
  );
}

function findSiteUrl(row, col) {
  // Priorytet 1: Target_Domain_CP (nowy dropdown)
  if (col['Target_Domain_CP'] !== undefined && row[col['Target_Domain_CP']]) {
    return row[col['Target_Domain_CP']].toString();
  }
  // Priorytet 2: istniejące kolumny WAAS
  const possibleCols = ['Domain', 'Site_URL', 'domain', 'site_url', 'URL'];
  for (const name of possibleCols) {
    if (col[name] !== undefined && row[col[name]]) {
      return row[col[name]].toString();
    }
  }
  return 'meisseltechnik.lk24.shop';
}


// ============================================================================
// FLOW 2: GENERATE IMAGE PROMPT (osobny od tekstu!)
// ============================================================================

function cpGenerateImagePrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  if (!('▶Image_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Image_CP']] !== true) continue;
    if (!row[col['ID_CP']]) continue;
    
    const sheetRow = r + 1;
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildImagePrompt(config);
    
    const promptCell = sheet.getRange(sheetRow, col['Image_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Image_CP'] + 1).setValue('DONE');
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0
      ? `🖼️ Wygenerowano ${generated} IMAGE prompt(ów).\n\nSkopiuj prompt → AI → JSON do Image_Response_CP → zaznacz ▶ParseImage_CP.\n\nObraz generujesz osobno (DALL-E, Midjourney, etc.) na podstawie promptu z CP Media Queue.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Image_CP.'
  );
}


// ============================================================================
// FLOW 3: GENERATE VIDEO PROMPT (osobny!)
// ============================================================================

function cpGenerateVideoPrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  if (!('▶Video_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Video_CP']] !== true) continue;
    if (!row[col['ID_CP']]) continue;
    
    const sheetRow = r + 1;
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildVideoPrompt(config);
    
    const promptCell = sheet.getRange(sheetRow, col['Video_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Video_CP'] + 1).setValue('DONE');
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0
      ? `🎬 Wygenerowano ${generated} VIDEO prompt(ów).\n\nSkopiuj prompt → AI → JSON do Video_Response_CP → zaznacz ▶ParseVideo_CP.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Video_CP.'
  );
}


// ============================================================================
// EXTRACT CONFIG z wiersza Content Queue
// ============================================================================

function cpExtractConfig(row, col) {
  const get = (name) => {
    if (col[name] !== undefined) return row[col[name]] || '';
    return '';
  };
  
  return {
    cp_id: get('ID_CP'),
    site_url: findSiteUrl(row, col),
    content_type: get('Content_Type_CP') || 'TUTORIAL',
    headline_type: get('Headline_Type_CP') || 'AUTO',
    headline_strategy: get('Headline_Strategy_CP') || 'AUTO',
    text_length: get('Text_Length_CP') || 'AUTO',
    products_count: get('Products_Count_CP') || 'AUTO',
    include_faq: get('Include_FAQ_CP') === true,
    faq_count: parseInt(get('FAQ_Count_CP')) || 5,
    include_culture: get('Include_Culture_CP') === true,
    working_title: get('Working_Title_CP'),
    primary_keyword: get('Primary_Keyword_CP'),
    secondary_keywords: get('Secondary_Keywords_CP'),
    problem_need: get('Problem_Need_CP'),
    target_audience: get('Target_Audience_CP'),
    product_asins: get('Product_ASINs_CP'),
    notes: get('Notes_CP'),
    // Istniejące kolumny z WAAS
    existing_title: get('Title') || get('title') || '',
    existing_content: get('Content') || get('content') || '',
  };
}


// ============================================================================
// BUILD TEXT PROMPT — TYLKO tekst, SEO, FAQ, CTA (BEZ mediów!)
// ============================================================================

function cpBuildTextPrompt(c) {
  const resolved = cpResolveAuto(c);
  
  // Page types use dedicated prompt builder (from ContentPipelinePages.gs)
  var pageTypes = ['HOMEPAGE','CATEGORY_PAGE','BRAND_PROFILE','ABOUT_PAGE','CROSS_LINK_PAGE','CONTACT_PAGE'];
  if (pageTypes.indexOf(resolved.content_type) >= 0 && typeof cpBuildPagePrompt === 'function') {
    return cpBuildPagePrompt(resolved);
  }
  
  // Detect brand/patron from domain context (NOT hardcoded!)
  const brandNote = resolved.notes && resolved.notes.match(/Marke:\s*(\S+)/i) 
    ? 'Marke: ' + resolved.notes.match(/Marke:\s*(\S+)/i)[1] + ' (bevorzugte Produktempfehlungen)'
    : 'Verwende die bereitgestellten Produkte (ASINs) für Empfehlungen';
  
  return `CONTENT PIPELINE — TEXT ONLY
Content-ID: ${resolved.cp_id}
WICHTIG: Generuj TYLKO tekst artykułu, SEO, FAQ i CTA.
NIE generuj promptów do zdjęć, wideo ani mediów.

=== SYSTEM ===
Site: ${resolved.site_url}
Sprache: DE (formell, "Sie")
${brandNote}
Shortcode: [waas_product asin='ASIN' layout='horizontal']
KEINE Preise nennen → "Aktuellen Preis auf Amazon prüfen"

WICHTIG: KEINEN Affiliate-Hinweis generieren — steht bereits auf der Seite.
WICHTIG: Die ERSTE Sektion darf NICHT "Einleitung" heißen — spannender inhaltlicher Untertitel!

=== QUALITÄTSREGELN (PFLICHT!) ===
VERBOTEN — sofortiger Qualitätsverlust:
- Erfundene Statistiken: "ADAC-Studie zeigt 20%", "TÜV-Tests belegen 80%"
- Erfundene Experten-Rollen: "als Langzeit-Prepper", "als Sicherheitsexperte"
- Konkrete Bußgeld-Beträge: "bis 500€/25.000€" → stattdessen "kann zu Bußgeldern führen"
- "nach aktuellem Kenntnisstand (ohne Gewähr)" → stattdessen "Stand 2026, prüfen Sie bei Ihrer Behörde"
- Generische Phrasen: "In der heutigen Zeit...", "Es gibt viele Möglichkeiten..."
- Superlative ohne Beleg: "das BESTE aller Zeiten"
- Passive Konstruktionen wo aktiv möglich

ERLAUBT und ERWÜNSCHT:
- Echte Fakten mit Quellennennung im Text: "Laut GefStoffV...", "Die DIN 7274 definiert..."
- Natürliche Praxisperspektive: "In der Praxis zeigt sich...", "Erfahrungsgemäß..."
- Konkrete Details: Maße, Gewichte, Zeitangaben, Szenarien
- E-E-A-T: Erfahrung + Expertise + Autorität + Vertrauen
- Pro Produkt: Stärke + Schwäche + konkreter Einsatz
- Sicherheitshinweis-Box: <div style="background:#FFF8E1;border-left:4px solid #FF8F00;padding:12px;margin:16px 0;border-radius:4px;">
- Profi-Tipp-Box: <div style="background:#E8F5E9;border-left:4px solid #4CAF50;padding:12px;margin:16px 0;border-radius:4px;">

=== HEADLINE ===
Typ: ${resolved.headline_type}
${cpGetHeadlinePattern(resolved.headline_type)}
Strategie: ${resolved.headline_strategy}
Arbeitstitel: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
${resolved.secondary_keywords ? 'Sekundär: "' + resolved.secondary_keywords + '"' : ''}

=== CONTENT ===
Content_Type: ${resolved.content_type}
Wortanzahl: ${resolved.word_min}–${resolved.word_max}
${resolved.problem_need ? 'Problem: ' + resolved.problem_need : ''}
${resolved.target_audience ? 'Zielgruppe: ' + resolved.target_audience : ''}
${resolved.notes ? 'Operator-Hinweise (PRIORITÄT!): ' + resolved.notes : ''}

${cpGetContentStructure(resolved.content_type)}

=== PRODUKTE ===
ASINs: ${resolved.product_asins || 'keine'}
Anzahl: ~${resolved.products_resolved}
ALLE bereitgestellten ASINs verwenden! Jedes Produkt mit eigenem Anwendungsfall.
Shortcode-Format (IMMER so!):
<!-- PRODUCT: ASIN -->
[waas_product asin='ASIN' layout='horizontal']
NIE: <div> wrapper, <a href="#">, placeholder links

${resolved.include_faq ? `=== FAQ ===
Erstelle ${resolved.faq_count} FAQ-Paare:
- problem_questions (2-3): Fragen zum Problem
- product_questions (1-2): Fragen zum Werkzeug
- general_questions (1-2): Allgemeine Fragen
Antworten: 40-80 Wörter, präzise, KEINE erfundenen Zahlen.` : ''}

${resolved.include_culture ? cpGetCultureNote() : ''}

=== JSON FORMAT (NUR TEXT!) ===
Antworte NUR mit JSON. Kein Text davor oder danach.

{
  "content_id": "${resolved.cp_id}",
  "article": {
    "title": "SEO H1 Titel (Keyword vorne, max 80 Zeichen)",
    "slug": "url-slug",
    "short_headline": "Max 40 Zeichen",
    "excerpt": "140-160 Zeichen, Keyword + Handlungsaufforderung",
    "sections": [
      {"heading": "Spannender H2 (NIEMALS Einleitung!)", "content_html": "<p>Praxis-HTML...</p>", "type": "text"},
      {"heading": "Fazit und Empfehlung", "content_html": "<p>Zusammenfassung + Produkt + CTA</p>", "type": "fazit"}
    ],
    "products_shortcodes": ["[waas_product asin='ASIN' layout='horizontal']"],
    "word_count": ${resolved.word_min}
  },
  "seo": {
    "meta_description": "140-160 Zeichen",
    "seo_title": "Max 60 Zeichen | SiteName",
    "focus_keyword": "${resolved.primary_keyword}",
    "secondary_keywords": [],
    "tags": [],
    "schema_type": "HowTo"
  },
  "ctas": {
    "product_view": "Produkt auf Amazon ansehen",
    "related_guide": "Passender Ratgeber: [Titel]",
    "category": "Alle [Kategorie] Anleitungen"
  }${resolved.include_faq ? `,
  "faq": [
    {"q": "Konkrete Frage?", "a": "50-80 Wörter, praxisnah, OHNE erfundene Zahlen"}
  ]` : ''}
}`;
}



// ============================================================================
// BUILD IMAGE PROMPT
// ============================================================================

function cpBuildImagePrompt(c) {
  const resolved = cpResolveAuto(c);
  
  // Ile ilustracji potrzebujemy
  const illustCount = 2; // default
  
  // Generuj Media IDs
  const fiId = cpGenerateMediaId(resolved.cp_id, 'FEATURED_IMAGE');
  const ilIds = [];
  for (let i = 1; i <= illustCount; i++) {
    ilIds.push(cpGenerateMediaId(resolved.cp_id, 'ILLUSTRATION', i));
  }
  
  return `CONTENT PIPELINE — IMAGE PACKAGE
Content-ID: ${resolved.cp_id}
WAŻNE: Generuj TYLKO opisy zdjęć, ALT texty, captions i prompty do generowania obrazów.
NIE generuj tekstu artykułu — ten jest już gotowy.

=== KONTEKST ===
Artykuł: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
Site: ${resolved.site_url}
Marke: Siehe Produktdaten
Bildstil: Professionelle Werkstatt-Fotografie, warmes Licht, sauberer Arbeitsplatz

=== SYSTEM NAZEWNICTWA ===
Featured Image ID: ${fiId}
${ilIds.map((id, i) => `Illustration ${i + 1} ID: ${id}`).join('\n')}
Filename-Format: {media_id_lowercase}-{keyword-slug}.jpg

=== JSON FORMAT ===
Antworte NUR mit JSON:

{
  "content_id": "${resolved.cp_id}",
  "featured_image": {
    "media_id": "${fiId}",
    "ai_prompt": "Detaillierte Beschreibung für AI-Bildgenerierung: [fotorealistisch, Setting, Perspektive, Beleuchtung, Komposition. Produkte sichtbar.]",
    "alt_text": "Keyword-optimierter Alt-Text",
    "title": "Bild-Titel",
    "caption": "Bildunterschrift",
    "overlay_text": "Kurzer Text fürs Bild",
    "branding": "Site-Logo falls vorhanden, Produkt-Branding",
    "dimensions": "1200x630",
    "style_notes": "Fotorealistisch, Werkstatt, warmes Licht",
    "filename": "${fiId.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg"
  },
  "illustrations": [
    ${ilIds.map((id, i) => `{
      "media_id": "${id}",
      "ai_prompt": "Beschreibung Illustration ${i + 1}...",
      "alt_text": "Alt-Text",
      "caption": "Bildunterschrift",
      "placement": "Nach Sektion ${i + 2}",
      "dimensions": "800x450",
      "filename": "${id.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg"
    }`).join(',\n    ')}
  ]
}`;
}


// ============================================================================
// BUILD VIDEO PROMPT — TYLKO wideo scenariusz
// ============================================================================

function cpBuildVideoPrompt(c) {
  const resolved = cpResolveAuto(c);
  const vdId = cpGenerateMediaId(resolved.cp_id, 'VIDEO', 1);
  const thId = cpGenerateMediaId(resolved.cp_id, 'THUMBNAIL', 1);
  
  return `CONTENT PIPELINE — VIDEO PACKAGE
Content-ID: ${resolved.cp_id}
Video-ID: ${vdId}
WAŻNE: Generuj TYLKO scenariusz wideo, voiceover texty i thumbnail opis.

=== KONTEKST ===
Artykuł: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
Site: ${resolved.site_url}
Marke: Siehe Produktdaten
Ziellänge: 3-5 Minuten
Stil: Professionell, Praxis-orientiert, Werkstatt-Setting

=== JSON FORMAT ===
{
  "content_id": "${resolved.cp_id}",
  "video_id": "${vdId}",
  "video": {
    "title": "YouTube-optimierter Titel (max 60 Zeichen)",
    "description": "YouTube-Beschreibung (150-200 Wörter, mit Keywords)",
    "tags": ["tag1", "tag2"],
    "category": "Bildung",
    "duration_target": "3-5 Min",
    "scenes": [
      {
        "nr": 1,
        "duration_sec": 15,
        "visual": "Beschreibung was zu sehen ist",
        "voiceover": "Sprechtext für diese Szene",
        "overlay_text": "Text der auf dem Bildschirm erscheint"
      }
    ],
    "vo_script_complete": "Kompletter Voiceover-Text (alle Szenen zusammen)",
    "overlay_texts_complete": "Alle Overlay-Texte (zusammen, nummeriert)"
  },
  "thumbnail": {
    "media_id": "${thId}",
    "ai_prompt": "Beschreibung für Thumbnail-Generierung...",
    "overlay_text": "Text auf Thumbnail",
    "alt_text": "Alt-Text",
    "filename": "${thId.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg",
    "dimensions": "1280x720"
  }
}`;
}


// ============================================================================
// PARSE FUNCTIONS
// ============================================================================

function cpParseTextResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + CP_CONFIG.CONTENT_QUEUE_SHEET + '" nicht gefunden!');
    return;
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h.toString().trim()] = i);
  
  // Robust column finder — handles unicode ▶ issues after rename
  const findCol = (name) => {
    if (col[name] !== undefined) return col[name];
    // Fallback: search by partial match
    for (let h in col) {
      if (h.indexOf('ParseText') >= 0 && h.indexOf('_CP') >= 0 && h.indexOf('Prompt') < 0 && h.indexOf('Response') < 0) return col[h];
    }
    return undefined;
  };
  const findColByKey = (key) => {
    if (col[key] !== undefined) return col[key];
    for (let h in col) {
      if (h.replace(/[^a-zA-Z0-9_]/g, '').indexOf(key.replace(/[^a-zA-Z0-9_]/g, '')) >= 0) return col[h];
    }
    return undefined;
  };
  
  const parseCol = findCol('ParseText_CP');
  const respCol = findColByKey('Text_Response_CP');
  
  Logger.log('PARSE: parseCol=' + parseCol + ', respCol=' + respCol);
  Logger.log('PARSE: Headers sample: ' + headers.slice(0, 30).join(' | '));
  
  if (parseCol === undefined) {
    SpreadsheetApp.getUi().alert('Kolumne ParseText_CP nicht gefunden!\nHeaders: ' + headers.join(', ').substring(0, 500));
    return;
  }
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[parseCol] !== true) continue;
    
    const jsonStr = row[respCol !== undefined ? respCol : col['Text_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      var cleanedStr = cpCleanJson(jsonStr);
      var json = cpSafeParseJson(cleanedStr);

      const sheetRow = r + 1;
      const set = (name, val) => {
        if (col[name] !== undefined && val) sheet.getRange(sheetRow, col[name] + 1).setValue(val);
      };
      
      // Article
      if (json.article) {
        set('Final_Title_CP', json.article.title);
        set('Final_Slug_CP', json.article.slug);
        set('Excerpt_CP', json.article.excerpt);
        set('Sections_JSON_CP', JSON.stringify(json.article.sections));
        set('Word_Count_CP', json.article.word_count);
      }
      
      // SEO
      if (json.seo) {
        set('Meta_Description_CP', json.seo.meta_description);
        set('SEO_Title_CP', json.seo.seo_title);
        set('Focus_Keyword_CP', json.seo.focus_keyword);
        set('Tags_CP', Array.isArray(json.seo.tags) ? json.seo.tags.join(', ') : json.seo.tags);
      }
      
      // FAQ
      if (json.faq) set('FAQ_JSON_CP', JSON.stringify(json.faq));
      
      // CTAs
      if (json.ctas) set('CTAs_JSON_CP', JSON.stringify(json.ctas));
      
      // Status
      set('Status_CP', '📝 Text Ready');
      
      // Quality
      const score = cpCalculateScore(json, row, col);
      set('Quality_Score_CP', score.total);
      set('Quality_Details_CP', score.details);
      
      // Mark as DONE with date
      sheet.getRange(sheetRow, parseCol + 1).setValue('DONE');
      parsed++;
      
    } catch (e) {
      Logger.log(`Parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`📝 Sparsowano ${parsed} TEXT response(ów).`);
}

function cpParseImageResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const mq = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mq) { SpreadsheetApp.getUi().alert('❌ Brak karty CP Media Queue'); return; }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶ParseImage_CP']] !== true) continue;
    
    const jsonStr = row[col['Image_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      var json = cpSafeParseJson(cpCleanJson(jsonStr));
      const contentId = row[col['ID_CP']];
      
      // Featured Image → Media Queue
      if (json.featured_image) {
        cpAddToMediaQueue(mq, json.featured_image, contentId, 'FEATURED_IMAGE');
      }
      
      // Illustrations → Media Queue
      if (json.illustrations && Array.isArray(json.illustrations)) {
        json.illustrations.forEach(ill => {
          cpAddToMediaQueue(mq, ill, contentId, 'ILLUSTRATION');
        });
      }
      
      // Infographic
      if (json.infographic) {
        cpAddToMediaQueue(mq, json.infographic, contentId, 'INFOGRAPHIC');
      }
      
      // Update status
      const sheetRow = r + 1;
      const currentStatus = row[col['Status_CP']];
      if (currentStatus === '📝 Text Ready') {
        sheet.getRange(sheetRow, col['Status_CP'] + 1).setValue('🖼️ Images Ready');
      }
      
      sheet.getRange(sheetRow, col['▶ParseImage_CP'] + 1).setValue('DONE');
      parsed++;
      
    } catch (e) {
      Logger.log(`Image parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`🖼️ Sparsowano ${parsed} IMAGE response(ów).\nSprawdź kartę CP Media Queue.`);
}

function cpParseVideoResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const vq = ss.getSheetByName(CP_CONFIG.VIDEO_QUEUE_SHEET);
  if (!vq) { SpreadsheetApp.getUi().alert('❌ Brak karty CP Video Queue'); return; }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶ParseVideo_CP']] !== true) continue;
    
    const jsonStr = row[col['Video_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      var json = cpSafeParseJson(cpCleanJson(jsonStr));
      const contentId = row[col['ID_CP']];
      
      // Video → Video Queue
      if (json.video) {
        cpAddToVideoQueue(vq, json, contentId);
      }
      
      // Thumbnail → Media Queue
      if (json.thumbnail) {
        const mq = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
        if (mq) cpAddToMediaQueue(mq, json.thumbnail, contentId, 'THUMBNAIL');
      }
      
      // Update status
      const sheetRow = r + 1;
      sheet.getRange(sheetRow, col['Status_CP'] + 1).setValue('🎬 Video Ready');
      sheet.getRange(sheetRow, col['▶ParseVideo_CP'] + 1).setValue('DONE');
      parsed++;
      
    } catch (e) {
      Logger.log(`Video parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`🎬 Sparsowano ${parsed} VIDEO response(ów).\nSprawdź kartę CP Video Queue.`);
}


// ============================================================================
// HELPERS — Media/Video Queue inserts
// ============================================================================

function cpAddToMediaQueue(mq, data, contentId, mediaType) {
  const newRow = Math.max(mq.getLastRow(), 1) + 1;
  const vals = [
    data.media_id || '',           // Media_ID
    contentId,                      // Content_ID
    mediaType,                      // Media_Type
    data.alt_text || '',            // Alt_Text
    data.title || '',               // Image_Title
    data.caption || '',             // Caption
    data.overlay_text || '',        // Overlay_Text
    data.branding || '',            // Branding
    data.ai_prompt || '',           // AI_Image_Prompt
    data.style_notes || '',         // Style_Notes
    data.dimensions || '1200x630',  // Dimensions
    '',                             // AI_Target
    data.filename || '',            // Filename
    '',                             // File_URL
    '',                             // WP_Media_ID
    '',                             // WP_Media_URL
    '⏳ Pending',                   // Status
    data.placement || '',           // Placement
    '',                             // Notes
  ];
  mq.getRange(newRow, 1, 1, vals.length).setValues([vals]);
}

function cpAddToVideoQueue(vq, json, contentId) {
  const v = json.video;
  const newRow = Math.max(vq.getLastRow(), 1) + 1;
  const vals = [
    json.video_id || '',                    // Video_ID
    contentId,                               // Content_ID
    v.title || '',                           // Video_Title
    v.description || '',                     // Video_Description
    Array.isArray(v.tags) ? v.tags.join(', ') : (v.tags || ''), // Tags
    v.category || '',                        // Category
    v.duration_target || '',                 // Duration
    JSON.stringify(v.scenes || []),           // Scenes_JSON
    v.vo_script_complete || '',              // VO_Script
    v.overlay_texts_complete || '',          // Overlay_Texts
    json.thumbnail?.media_id || '',          // Thumb_ID
    json.thumbnail?.ai_prompt || '',         // Thumb_Prompt
    json.thumbnail?.alt_text || '',          // Thumb_Alt
    json.thumbnail?.filename || '',          // Thumb_Filename
    '',                                      // AI_Target
    '',                                      // Video_Filename
    '',                                      // Video_URL
    '',                                      // YouTube_ID
    '',                                      // WP_Embed
    '⏳ Pending',                            // Status
    '',                                      // Notes
  ];
  vq.getRange(newRow, 1, 1, vals.length).setValues([vals]);
}


// ============================================================================
// QUALITY SCORE
// ============================================================================

function cpCalculateScore(json, row, col) {
  const checks = [];
  let total = 0;
  
  const keyword = (row[col['Primary_Keyword_CP']] || '').toLowerCase();
  const title = (json.article?.title || '').toLowerCase();
  
  // 1. Keyword in title (15)
  if (keyword && title.includes(keyword)) { checks.push('✅ KW in Title(15)'); total += 15; }
  else { checks.push('❌ KW missing(0/15)'); }
  
  // 2. Meta desc (10)
  const meta = json.seo?.meta_description || '';
  if (meta.length >= 120 && meta.length <= 165) { checks.push('✅ Meta(10)'); total += 10; }
  else if (meta.length > 0) { checks.push('⚠️ Meta len(5/10)'); total += 5; }
  else { checks.push('❌ No meta(0/10)'); }
  
  // 3. Sections (15)
  const sections = json.article?.sections || [];
  if (sections.length >= 3) { checks.push(`✅ ${sections.length} sects(15)`); total += 15; }
  else { checks.push('❌ Few sects(0/15)'); }
  
  // 4. Word count (10)
  if ((json.article?.word_count || 0) >= 800) { checks.push('✅ Words(10)'); total += 10; }
  else { checks.push('❌ Short(0/10)'); }
  
  // 5. Products (15)
  if ((json.article?.products_shortcodes || []).length > 0) { checks.push('✅ Products(15)'); total += 15; }
  else { checks.push('⚠️ No products(7/15)'); total += 7; }
  
  // 7. FAQ (10)
  if (json.faq) { checks.push('✅ FAQ(10)'); total += 10; }
  else if (row[col['Include_FAQ_CP']] !== true) { checks.push('— FAQ skip(10)'); total += 10; }
  else { checks.push('❌ No FAQ(0/10)'); }
  
  // 8. CTAs (10)
  const ctaCount = Object.values(json.ctas || {}).filter(v => v && v.length > 0).length;
  if (ctaCount >= 3) { checks.push(`✅ ${ctaCount} CTAs(10)`); total += 10; }
  else { checks.push('⚠️ Few CTAs(5/10)'); total += 5; }
  
  // 9. Slug (10)
  const slug = json.article?.slug || '';
  if (slug && /^[a-z0-9-]+$/.test(slug)) { checks.push('✅ Slug(10)'); total += 10; }
  else { checks.push('❌ Bad slug(0/10)'); }
  
  // 10. SEO Title (5) — NEW
  if (json.seo?.seo_title) { checks.push('✅ SEO Title(5)'); total += 5; }
  else { checks.push('❌ No SEO Title(0/5)'); }
  
  return { total, details: checks.join(' | ') };
}


// ============================================================================
// RESOLVE AUTO + HELPERS
// ============================================================================

function cpResolveAuto(c) {
  const r = {...c};
  
  // Content Type → Text Length
  if (r.text_length === 'AUTO' || !r.text_length) {
    const map = { 'TUTORIAL': 'STANDARD', 'RATGEBER': 'STANDARD', 'HOW_TO': 'MEDIUM', 'PROBLEM_SOLVER': 'STANDARD', 'FAQ': 'SHORT', 'VERGLEICH': 'MEDIUM', 'REVIEW': 'MEDIUM', 'LISTICLE': 'STANDARD', 'GLOSSAR': 'MICRO' };
    r.text_length = map[r.content_type] || 'STANDARD';
  }
  const ranges = { 'MICRO': [300,500], 'SHORT': [500,800], 'MEDIUM': [800,1200], 'STANDARD': [1200,1800], 'LONG': [1800,2500], 'DEEP_DIVE': [2500,4000] };
  r.word_min = (ranges[r.text_length] || [1200,1800])[0];
  r.word_max = (ranges[r.text_length] || [1200,1800])[1];
  
  // Products
  if (r.products_count === 'AUTO' || !r.products_count) {
    const map = { 'TUTORIAL': 'FEW', 'RATGEBER': 'SEVERAL', 'REVIEW': 'SINGLE', 'LISTICLE': 'SEVERAL', 'GLOSSAR': 'NONE' };
    r.products_count = map[r.content_type] || 'FEW';
  }
  const prodMap = { 'NONE': 0, 'SINGLE': 1, 'FEW': 3, 'SEVERAL': 5, 'MANY': 8 };
  r.products_resolved = prodMap[r.products_count] || 3;
  
  // Headline
  if (r.headline_type === 'AUTO' || !r.headline_type) {
    const map = { 'TUTORIAL': 'STEP_BY_STEP', 'RATGEBER': 'GUIDE', 'HOW_TO': 'HOW_TO', 'PROBLEM_SOLVER': 'PROBLEM', 'VERGLEICH': 'COMPARISON', 'REVIEW': 'DIRECT', 'LISTICLE': 'NUMBERED_LIST' };
    r.headline_type = map[r.content_type] || 'HOW_TO';
  }
  if (r.headline_strategy === 'AUTO' || !r.headline_strategy) {
    const map = { 'PROBLEM': 'THREAT', 'SOCIAL_PROOF': 'SOCIAL_PROOF', 'CURIOSITY': 'CURIOSITY', 'CARLTON': 'CARLTON', 'MYTH_BUSTER': 'THREAT', 'CONTRARIAN': 'CURIOSITY' };
    r.headline_strategy = map[r.headline_type] || 'GAIN';
  }
  
  return r;
}

function cpGetHeadlinePattern(type) {
  const patterns = {
    'HOW_TO': 'Pattern: "Wie Sie [Ergebnis] — [Zusatznutzen]"',
    'STEP_BY_STEP': 'Pattern: "[Aufgabe]: Schritt für Schritt zum [Ergebnis]"',
    'GUIDE': 'Pattern: "[A] oder [B]? Der große Ratgeber"',
    'QUESTION': 'Pattern: "Welcher [X] für welche [Y]?"',
    'DIRECT': 'Pattern: "[Thema] — [Aspekt 1], [Aspekt 2], [Aspekt 3]"',
    'COMPARISON': 'Pattern: "[A] oder [B]? Direkter Vergleich"',
    'NUMBERED_LIST': 'Pattern: "Die [Zahl] besten [X] für [Y]"',
    'BEST_OF_YEAR': 'Pattern: "Die besten [X] in 2026"',
    'SUPERLATIVE_LIST': 'Pattern: "Die [Zahl] stärksten [X]"',
    'PROBLEM': 'Pattern: "[Problem]? Das können Sie tun"',
    'EVEN_IF': 'Pattern: "[Ergebnis] — selbst wenn [Worst Case]"',
    'BEFORE_AFTER': 'Pattern: "Von [Vorher] zu [Nachher]: So geht\'s"',
    'RESCUE': 'Pattern: "Das hilft wenn [alles schiefgeht]"',
    'IF_THEN': 'Pattern: "Wenn Sie [X], dann brauchen Sie [Y]"',
    'CARLTON': 'Pattern: "Wir zeigen [Gruppe] wie [Ergebnis] — selbst wenn [Worst Case]"',
    'CURIOSITY': 'Pattern: "Was die meisten über [X] nicht wissen"',
    'SOCIAL_PROOF': 'Pattern: "Warum Profis auf [X] schwören"',
    'MYTH_BUSTER': 'Pattern: "Die größte Lüge über [X]"',
    'CONTRARIAN': 'Pattern: "Warum Sie NICHT [X] sollten"',
  };
  return patterns[type] || '';
}

function cpGetContentStructure(type) {
  // Check page types first (from ContentPipelinePages.gs)
  if (typeof cpGetPageStructure === 'function') {
    var pageStruct = cpGetPageStructure(type);
    if (pageStruct) return pageStruct;
  }
  
  const structures = {
    'TUTORIAL': `Aufbau: 1.Spannender Einstieg(NICHT "Einleitung"!) 2.Werkzeug&Material(Tabelle) 3.Vorbereitung 4.Schritt-für-Schritt(4-8 Schritte) 5.Häufige Fehler 6.Profi-Tipps 7.Fazit(type:"fazit")`,
    'RATGEBER': `Aufbau: 1.Spannender Einstieg(NICHT "Einleitung"!) 2.Überblick Kategorien 3.Kaufkriterien 4.Produktvergleich(Tabelle) 5.Empfehlung nach Anwendungsfall 6.Fazit(type:"fazit")`,
    'HOW_TO': `Aufbau: 1.Spannender Einstieg(NICHT "Einleitung"!) 2.Was Sie brauchen 3.Anleitung(3-6 Schritte) 4.Zusammenfassung(type:"fazit")`,
    'PROBLEM_SOLVER': `Aufbau: 1.Problem-Beschreibung(spannender Titel!) 2.Ursache(Diagnose) 3.Lösung(Schritte) 4.Vorbeugung 5.Werkzeug-Empfehlung(type:"fazit")`,
    'REVIEW': `Aufbau: 1.Erster Eindruck(spannender Titel!) 2.Technische Daten(Tabelle) 3.Praxistest 4.Vorteile 5.Nachteile(ehrlich!) 6.Fazit&Bewertung(type:"fazit")`,
    'LISTICLE': `Aufbau: 1.Spannender Einstieg(NICHT "Einleitung"!) 2.Listenpunkte(je 100-200 Wörter) 3.Optional:Vergleichstabelle 4.Fazit(type:"fazit",Top-Pick)`,
    'VERGLEICH': `Aufbau: 1.Spannender Einstieg(NICHT "Einleitung"!) 2.Kurzvergleich(Tabelle) 3.Produkt A 4.Produkt B 5.Direkter Vergleich 6.Klarer Gewinner(type:"fazit")`,
    'SEASONAL': `Aufbau: 1.Saisonaler Aufhänger(NICHT "Einleitung"!) 2.Projekttipps 3.Produktempfehlungen 4.Fazit(type:"fazit")`,
    'CATEGORY_DESCRIPTION': `Aufbau: Fließtext 150-300 Wörter. Keyword vorne. Kein Shortcode. Keine Sektionen-Unterteilung. NUR 1 Sektion type:"text".`,
    'BRAND_DESCRIPTION': `Aufbau: 1."Unser Partner: [Markenname]" 2.Qualität, Erfahrung, Zuverlässigkeit 3.Kontaktdaten wenn vorhanden 4."Warum wir empfehlen"(type:"fazit"). 200-400 Wörter.`,
    'GLOSSAR': `Aufbau: 1.Definition(NICHT "Einleitung"!) 2.Erklärung mit Praxisbezug 3.Fazit(type:"fazit")`,
  };
  return structures[type] || structures['TUTORIAL'];
}

function cpGetCultureNote() {
  return `=== KULTUR (Deutschland) ===
Gründlich, sicherheitsbewusst. Schutzbrille+Gehörschutz+Staubmaske erwähnen.
Qualitätsorientiert, Preis-Leistung argumentieren. "Sie" durchgängig.`;
}

function cpCleanJson(str) {
  var s = str.toString().trim();
  
  // Remove BOM
  s = s.replace(/^\uFEFF/, '');
  
  // Remove markdown code fences (```json ... ```)
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  s = s.replace(/\s*```\s*$/i, '');
  
  // Remove any text BEFORE first { and AFTER last }
  var firstBrace = s.indexOf('{');
  var lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  
  // Fix smart quotes → regular quotes
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  
  // Fix escaped newlines that got double-escaped in Sheets
  s = s.replace(/\\\\n/g, '\\n');
  s = s.replace(/\\\\"/g, '\\"');
  
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  
  return s.trim();
}

function cpSafeParseJson(cleanedStr) {
  // Try 1: Direct parse
  try {
    return JSON.parse(cleanedStr);
  } catch(e1) {
    // Try 2: Fix shortcode attributes
    var fixed = cleanedStr
      .replace(/\\\\/g, '\\')
      .replace(/asin=\\"([^"]+)\\"/g, "asin='$1'")
      .replace(/layout=\\"([^"]+)\\"/g, "layout='$1'");
    try {
      return JSON.parse(fixed);
    } catch(e2) {
      // Try 3: Extract article object
      var artMatch = cleanedStr.match(/"article"\s*:\s*(\{[\s\S]*?"word_count"\s*:\s*\d+\s*\})/);
      if (artMatch) {
        try { return { article: JSON.parse(artMatch[1]) }; } catch(e3) {}
      }
      throw e1;
    }
  }
}

function cpSlugify(str) {
  return (str || 'untitled')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}


// ============================================================================
// PREVIEW
// ============================================================================

function cpPreviewArticle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const row = sheet.getActiveCell().getRow();
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  const r = data[row - 1];
  const title = r[col['Final_Title_CP']] || 'Ohne Titel';
  const sectionsStr = r[col['Sections_JSON_CP']];
  const score = r[col['Quality_Score_CP']] || '?';
  
  let body = '';
  if (sectionsStr) {
    try {
      const sections = JSON.parse(sectionsStr);
      sections.forEach(s => {
        if (s.type === 'fazit') {
          body += `<div style="background:#EF6C00;padding:25px 30px;margin:25px 0;border-radius:8px;color:#fff;"><h2 style="color:#fff;margin-top:0;">${s.heading}</h2>${s.content_html}</div>`;
        } else {
          body += `<h2>${s.heading}</h2>${s.content_html}`;
        }
      });
    } catch (e) {
      body = '<p>JSON parse error</p>';
    }
  }
  
  const html = HtmlService.createHtmlOutput(`
    <style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#1B5E20;border-bottom:3px solid #EF6C00;padding-bottom:10px}h2{color:#37474F;margin-top:25px}.score{position:fixed;top:10px;right:10px;background:#1B5E20;color:white;padding:8px 15px;border-radius:8px;font-size:14px}</style>
    <div class="score">Score: ${score}/105</div>
    <h1>${title}</h1>
    <p style="font-size:12px;color:#999;">${r[col['ID_CP']] || ''}</p>
    ${body}
  `).setWidth(900).setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(html, `👁️ ${title}`);
}


// ============================================================================
// ============================================================================
// ===  EXPORT SECTION — v4.2: Direct SQL via waas-pipeline endpoint       ===
// ===  Everything below this line is NEW/CHANGED in v4.2                  ===
// ============================================================================
// ============================================================================


// ============================================================================
// EXPORT TO WORDPRESS
// ============================================================================

function cpExportToWordPress() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + CP_CONFIG.CONTENT_QUEUE_SHEET + '" nicht gefunden!');
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  
  if (!('▶Export_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  var exported = 0;
  var errors = [];
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (row[col['▶Export_CP']] !== true) continue;
    
    var sheetRow = r + 1;
    var domain = row[col['Target_Domain_CP']];
    
    if (!domain) { errors.push('Wiersz ' + sheetRow + ': Brak Target_Domain_CP'); continue; }
    
    var sectionsJson = row[col['Sections_JSON_CP']];
    var title = row[col['Final_Title_CP']];
    if (!sectionsJson || !title) { errors.push('Wiersz ' + sheetRow + ': Brak sparsowanego tekstu.'); continue; }
    
    try {
      var site = cpGetSiteData(domain);
      if (!site) { errors.push('Wiersz ' + sheetRow + ': Site "' + domain + '" nie znaleziony.'); continue; }
      
      // Build Divi 5 content
      var sections = JSON.parse(sectionsJson);
      var diviContent = cpBuildDivi5Content(sections);
      
      // Find Featured Image from Media Queue
      var contentId = (row[col['ID_CP']] || '').toString();
      var featuredMediaId = cpFindFeaturedMediaId_(ss, contentId);
      
      // Find Illustrations from Media Queue
      var illustrations = cpFindIllustrations_(ss, contentId);
      
      // Collect all data for the endpoint
      var postType = (col['Post_Type_CP'] !== undefined ? (row[col['Post_Type_CP']] || '').toString() : '').toLowerCase();
      if (postType !== 'page') postType = 'post'; // default to post
      
      var existingId = col['Existing_Post_ID_CP'] !== undefined ? parseInt(row[col['Existing_Post_ID_CP']]) || 0 : 0;
      
      var postData = {
        title: title,
        slug: (row[col['Final_Slug_CP']] || '').toString(),
        content: diviContent,
        status: 'draft',
        excerpt: (row[col['Excerpt_CP']] || '').toString(),
        post_type: postType,
        existing_id: existingId,
        seo: {
          seo_title: (row[col['SEO_Title_CP']] || '').toString(),
          meta_description: (row[col['Meta_Description_CP']] || '').toString(),
          focus_keyword: (row[col['Focus_Keyword_CP']] || row[col['Primary_Keyword_CP']] || '').toString(),
        },
        featured_media: featuredMediaId || null,
        illustrations: illustrations,
        tags: (row[col['Tags_CP']] || '').toString(),
        categories: postType === 'post' ? ['Blog'] : [],
      };
      
      Logger.log('EXPORT: → ' + domain + ': "' + title.substring(0, 50) + '" Content: ' + diviContent.length + ' chars, FI: ' + (featuredMediaId || 'none'));
      
      var result = cpPublishToWP(site, postData);
      
      if (result.success) {
        var set = function(name, val) {
          if (col[name] !== undefined && val) sheet.getRange(sheetRow, col[name] + 1).setValue(val);
        };
        
        set('Post ID', result.postId);
        set('Post URL', result.postUrl);
        set('Post_ID_CP', result.postId);
        set('Post_URL_CP', result.postUrl);
        
        var dateStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
        set('Export_Date_CP', dateStr);
        set('Published Date', dateStr);
        set('Status_CP', result.encodingOk ? '📤 Published' : '⚠️ Encoding Issue');
        
        sheet.getRange(sheetRow, col['▶Export_CP'] + 1).setValue('DONE');
        exported++;
        
        // Mark Featured Image as set
        if (featuredMediaId) cpMarkFeaturedAsSet_(ss, contentId);
        
        // Mark Illustrations as in content
        if (illustrations.length > 0) cpMarkIllustrationsAsSet_(ss, contentId);
        
      } else {
        errors.push('Wiersz ' + sheetRow + ': ' + result.error);
      }
    } catch (e) {
      errors.push('Wiersz ' + sheetRow + ': ' + e.message);
    }
  }
  
  var msg = exported > 0 
    ? '📤 Wyeksportowano ' + exported + ' artykuł(ów) jako DRAFT.\n\n' +
      '✅ Direct SQL (encoding safe)\n' +
      '✅ RankMath SEO meta\n' +
      '✅ Divi Builder meta\n' +
      '✅ Featured Image\n' +
      '✅ Illustrations in content\n\n' +
      'Sprawdź w WordPress → Posts → Drafts.'
    : '⚠️ Brak wierszy do eksportu.';
  if (errors.length > 0) msg += '\n\n⚠️ Błędy (' + errors.length + '):\n' + errors.join('\n');
  SpreadsheetApp.getUi().alert(msg);
}


// ============================================================================
// PUBLISH TO WP — via waas-pipeline/v1/publish (Direct SQL, encoding safe)
// ============================================================================

function cpPublishToWP(site, postData) {
  try {
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    var auth = cpGetWPAuthForMedia(site, wpUrl);
    
    if (!auth.cookies || !auth.nonce) {
      return { success: false, error: 'Auth failed — check credentials in Sites sheet for ' + site.domain };
    }
    
    // Choose endpoint based on whether we're creating or updating
    var endpoint;
    if (postData.existing_id && postData.existing_id > 0) {
      // Update existing post/page
      endpoint = wpUrl + '/wp-json/waas-pipeline/v1/update-content';
      Logger.log('EXPORT: Updating existing post/page ID=' + postData.existing_id);
    } else {
      // Create new post/page
      endpoint = wpUrl + '/wp-json/waas-pipeline/v1/publish';
    }
    
    var payload = {
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: postData.excerpt || '',
      status: postData.status || 'draft',
      post_type: postData.post_type || 'post',
      seo: postData.seo || {},
      categories: postData.categories || [],
      tags: postData.tags || '',
      illustrations: postData.illustrations || [],
    };
    
    // For update mode, set post_id
    if (postData.existing_id && postData.existing_id > 0) {
      payload.post_id = postData.existing_id;
    }
    
    if (postData.featured_media) {
      payload.featured_media = parseInt(postData.featured_media);
    }
    
    var response = UrlFetchApp.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Cookie': auth.cookies,
        'X-WP-Nonce': auth.nonce,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    
    var code = response.getResponseCode();
    var bodyText = response.getContentText();
    
    Logger.log('EXPORT: HTTP ' + code + ', body: ' + bodyText.substring(0, 300));
    
    if (code === 200 || code === 201) {
      var body = JSON.parse(bodyText);
      if (body.success) {
        return {
          success: true,
          postId: body.post_id,
          postUrl: body.post_url,
          encodingOk: body.encoding_ok !== false,
        };
      }
      return { success: false, error: 'Endpoint returned success=false' };
    } else if (code === 404) {
      return { success: false, error: 'Endpoint /waas-pipeline/v1/publish not found!\nInstall waas-direct-publish.php in wp-content/mu-plugins/ on ' + site.domain };
    } else {
      try {
        var errBody = JSON.parse(bodyText);
        return { success: false, error: 'WP ' + code + ': ' + (errBody.message || errBody.code || '') };
      } catch(e) {
        return { success: false, error: 'WP ' + code + ': ' + bodyText.substring(0, 200) };
      }
    }
  } catch (e) {
    return { success: false, error: 'HTTP Error: ' + e.message };
  }
}


// ============================================================================
// FIND + MARK FEATURED IMAGE in Media Queue
// ============================================================================

function cpFindFeaturedMediaId_(ss, contentId) {
  if (!contentId) return null;
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mqSheet) return null;
  
  var mqData = mqSheet.getDataRange().getValues();
  var mqHeaders = mqData[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  for (var r = 1; r < mqData.length; r++) {
    var row = mqData[r];
    if ((row[mqCol['Media_Type']] || '').toString().trim() === 'FEATURED_IMAGE' &&
        (row[mqCol['Content_ID']] || '').toString().trim() === contentId &&
        row[mqCol['WP_Media_ID']]) {
      return parseInt(row[mqCol['WP_Media_ID']]);
    }
  }
  return null;
}

function cpMarkFeaturedAsSet_(ss, contentId) {
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mqSheet) return;
  var mqData = mqSheet.getDataRange().getValues();
  var mqHeaders = mqData[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  for (var r = 1; r < mqData.length; r++) {
    if ((mqData[r][mqCol['Media_Type']] || '').toString().trim() === 'FEATURED_IMAGE' &&
        (mqData[r][mqCol['Content_ID']] || '').toString().trim() === contentId) {
      mqSheet.getRange(r + 1, mqCol['Status'] + 1).setValue('🖼️ Featured Set');
      break;
    }
  }
}

/**
 * Find uploaded illustrations for a content ID from Media Queue
 * Returns array of {wp_media_id, url, alt, caption} for PHP endpoint
 */
function cpFindIllustrations_(ss, contentId) {
  if (!contentId) return [];
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mqSheet) return [];
  
  var mqData = mqSheet.getDataRange().getValues();
  var mqHeaders = mqData[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  var results = [];
  
  for (var r = 1; r < mqData.length; r++) {
    var row = mqData[r];
    var mType = (row[mqCol['Media_Type']] || '').toString().trim();
    var mContentId = (row[mqCol['Content_ID']] || '').toString().trim();
    var wpMediaId = row[mqCol['WP_Media_ID']];
    var wpMediaUrl = (row[mqCol['WP_Media_URL']] || '').toString().trim();
    var status = (row[mqCol['Status']] || '').toString().trim();
    
    if (mType !== 'ILLUSTRATION') continue;
    if (mContentId !== contentId) continue;
    if (!wpMediaId || !wpMediaUrl) continue;
    // Don't filter by status — re-exports need illustrations too
    
    results.push({
      wp_media_id: parseInt(wpMediaId),
      url: wpMediaUrl,
      alt: (row[mqCol['Alt_Text']] || '').toString(),
      caption: (row[mqCol['Caption']] || '').toString(),
    });
  }
  
  Logger.log('EXPORT: Found ' + results.length + ' illustrations for ' + contentId);
  return results;
}

/**
 * Mark illustrations as inserted in content
 */
function cpMarkIllustrationsAsSet_(ss, contentId) {
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mqSheet) return;
  var mqData = mqSheet.getDataRange().getValues();
  var mqHeaders = mqData[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  for (var r = 1; r < mqData.length; r++) {
    if ((mqData[r][mqCol['Media_Type']] || '').toString().trim() === 'ILLUSTRATION' &&
        (mqData[r][mqCol['Content_ID']] || '').toString().trim() === contentId &&
        mqData[r][mqCol['WP_Media_ID']]) {
      mqSheet.getRange(r + 1, mqCol['Status'] + 1).setValue('📎 In Content');
    }
  }
}


// ============================================================================
// cpGetSiteData — reads Sites sheet
// ============================================================================

function cpGetSiteData(domain) {
  if (typeof getSiteByDomain_ === 'function') {
    return getSiteByDomain_(domain);
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sites');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (data[r][2] === domain) {
      return {
        id: data[r][0], name: data[r][1], domain: data[r][2],
        wpUrl: data[r][3], adminUser: data[r][4], adminPass: data[r][5],
        appPassword: data[r][14] || null,
      };
    }
  }
  return null;
}


// ============================================================================
// BUILD DIVI 5 CONTENT — v4.3: Fazit as styled section (NOT fullwidth-header)
// ============================================================================

function cpBuildDivi5Content(sections) {
  var DIVI_V = '5.0.0-public-beta.8.2';
  
  // Encode HTML for Divi 5 JSON values
  var esc = function(s) {
    return (s || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\n/g, '\\n');
  };
  
  var sOpen = '<!-- wp:divi/section {"builderVersion":"' + DIVI_V + '"} -->';
  var sClose = '<!-- /wp:divi/section -->';
  var rOpen = '<!-- wp:divi/row {"builderVersion":"' + DIVI_V + '"} -->';
  var rClose = '<!-- /wp:divi/row -->';
  var cOpen = '<!-- wp:divi/column {"builderVersion":"' + DIVI_V + '"} -->';
  var cClose = '<!-- /wp:divi/column -->';
  
  var heading = function(t) {
    return '<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"' + esc(t) + '"}}}} /-->';
  };
  
  var text = function(h) {
    return '<!-- wp:divi/text {"content":{"innerContent":{"desktop":{"value":"' + esc(h) + '"}}}} /-->';
  };
  
  // Fazit = Plain HTML div with orange background inside regular Divi text module
  // Same approach as info boxes (yellow/green) which render perfectly
  var buildFazit = function(title, contentHtml) {
    var cleanContent = contentHtml;
    var ctaHtml = '';
    
    // Extract Amazon CTA link from content
    var ctaMatch = cleanContent.match(/<a[^>]*href=["']([^"']*amazon[^"']*)["'][^>]*>([^<]*)<\/a>/i);
    if (ctaMatch) {
      var ctaUrl = ctaMatch[1];
      var ctaText = ctaMatch[2].replace(/[→►▶]/g, '').trim();
      cleanContent = cleanContent.replace(ctaMatch[0], '').trim();
      ctaHtml = '<p style="margin-bottom:0;"><a href="' + ctaUrl + '" target="_blank" rel="nofollow noopener sponsored" ' +
        'style="display:inline-block;background:#fff;color:#EF6C00;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:10px;">' +
        ctaText + ' →</a></p>';
    }
    
    // Also try plain text CTA (e.g. "Aktuellen Preis auf Amazon prüfen")
    if (!ctaHtml) {
      var plainCta = cleanContent.match(/<p[^>]*>([^<]*(?:Amazon|amazon)[^<]*)<\/p>/i);
      if (plainCta) {
        cleanContent = cleanContent.replace(plainCta[0], '').trim();
        ctaHtml = '<p style="margin-bottom:0;"><a href="https://www.amazon.de" target="_blank" rel="nofollow noopener sponsored" ' +
          'style="display:inline-block;background:#fff;color:#EF6C00;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:10px;">' +
          plainCta[1].trim() + ' →</a></p>';
      }
    }
    
    var fazitHtml = '<div style="background:#EF6C00;padding:25px 30px;margin:25px 0;border-radius:8px;color:#ffffff;line-height:1.7;">' +
      '<h3 style="margin-top:0;color:#fff;font-size:22px;">' + (title || 'Fazit') + '</h3>' +
      cleanContent.replace(/<p>/g, '<p style="color:#ffffff;">') +
      ctaHtml +
      '</div>';
    
    return sOpen + '\n' + rOpen + '\n' + cOpen + '\n' +
      text(fazitHtml) + '\n' +
      cClose + '\n' + rClose + '\n' + sClose;
  };
  
  // Assemble
  var parts = ['<!-- wp:divi/placeholder -->'];
  
  sections.forEach(function(s) {
    if (s.type === 'fazit') {
      parts.push(buildFazit(s.heading, s.content_html || ''));
    } else {
      parts.push(sOpen, rOpen, cOpen);
      if (s.heading) parts.push(heading(s.heading));
      if (s.content_html) parts.push(text(s.content_html));
      parts.push(cClose, rClose, sClose);
    }
  });
  
  parts.push('<!-- /wp:divi/placeholder -->');
  return parts.join('\n');
}


// ============================================================================
// EXPORT LEGAL PAGES — Impressum, Datenschutz, Partnerhinweis
// ============================================================================

/**
 * Updates legal pages on selected domain(s).
 * Uses waas-pipeline/v1/update-legal endpoint.
 * Reads site_name and niche_description from Sites sheet.
 * Menu: WAAS → Content Pipeline → Update Legal Pages
 */
function cpExportLegalPages() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Ask which domain
  var resp = ui.prompt('📋 Legal Pages Update',
    'Podaj domenę (np. reservekanister.lk24.shop)\nlub "ALL" dla wszystkich stron:', 
    ui.ButtonSet.OK_CANCEL);
  
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var input = resp.getResponseText().trim();
  
  var sitesSheet = ss.getSheetByName('Sites');
  if (!sitesSheet) { ui.alert('❌ Brak karty Sites'); return; }
  
  var sitesData = sitesSheet.getDataRange().getValues();
  var sitesHeaders = sitesData[0];
  var sCol = {};
  sitesHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var sites = [];
  for (var r = 1; r < sitesData.length; r++) {
    var domain = (sitesData[r][sCol['Domain'] || 2] || '').toString().trim();
    if (!domain) continue;
    if (input === 'ALL' || input === domain) {
      sites.push({
        domain: domain,
        name: (sitesData[r][sCol['Name'] || 1] || '').toString(),
        wpUrl: (sitesData[r][sCol['WP_URL'] || 3] || '').toString(),
        adminUser: (sitesData[r][sCol['Admin_User'] || 4] || '').toString(),
        adminPass: (sitesData[r][sCol['Admin_Pass'] || 5] || '').toString(),
        niche: (sitesData[r][sCol['Niche_Description'] !== undefined ? sCol['Niche_Description'] : -1] || '').toString(),
        partnerTag: (sitesData[r][sCol['Partner_Tag'] !== undefined ? sCol['Partner_Tag'] : (sCol['Amazon_Tag'] !== undefined ? sCol['Amazon_Tag'] : -1)] || '').toString(),
      });
    }
  }
  
  if (sites.length === 0) { ui.alert('❌ Nie znaleziono strony: ' + input); return; }
  
  var results = [];
  var errors = [];
  
  for (var i = 0; i < sites.length; i++) {
    var site = sites[i];
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    try {
      var auth = cpGetWPAuthForMedia(site, wpUrl);
      if (!auth.cookies || !auth.nonce) {
        errors.push(site.domain + ': Auth failed');
        continue;
      }
      
      var payload = {
        site_name: site.name || site.domain,
        site_domain: site.domain,
        niche_description: site.niche || '',
        partner_tag: site.partnerTag || '',
        pages: ['impressum', 'datenschutz', 'partnerhinweis'],
      };
      
      var response = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/update-legal', {
        method: 'POST',
        headers: {
          'Cookie': auth.cookies,
          'X-WP-Nonce': auth.nonce,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      
      var code = response.getResponseCode();
      if (code === 200) {
        var body = JSON.parse(response.getContentText());
        results.push(site.domain + ': ✅ ' + JSON.stringify(body.results));
      } else {
        errors.push(site.domain + ': HTTP ' + code);
      }
    } catch(e) {
      errors.push(site.domain + ': ' + e.message);
    }
    
    Utilities.sleep(2000);
  }
  
  var msg = '📋 Legal Pages Update\n\n';
  msg += '✅ Aktualizowane: ' + results.length + '\n';
  if (results.length > 0) msg += results.join('\n') + '\n';
  if (errors.length > 0) msg += '\n❌ Błędy:\n' + errors.join('\n');
  ui.alert(msg);
}


// ============================================================================
// EXPORT CATEGORIES — from Content Pipeline to WordPress
// ============================================================================

/**
 * Exports categories from Category Queue sheet to WordPress.
 * Uses waas-pipeline/v1/export-category endpoint.
 * Menu: WAAS → Content Pipeline → Export Categories
 */
function cpExportCategories() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var catSheet = ss.getSheetByName('Category_Queue_CP');
  
  if (!catSheet) {
    // Try alternative names
    catSheet = ss.getSheetByName('Categories_CP') || ss.getSheetByName('Dropdowns_CP');
    if (!catSheet) {
      ui.alert('❌ Brak karty Category_Queue_CP.\n\nStwórz kartę z kolumnami:\nDomain | Category_Name | Slug | Description | Parent_Slug | SEO_Title | SEO_Description | ▶Export_Cat');
      return;
    }
  }
  
  var data = catSheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  var exported = 0;
  var errors = [];
  var authCache = {};
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    
    // Check for export checkbox
    var exportFlag = col['▶Export_Cat'] !== undefined ? row[col['▶Export_Cat']] : true;
    if (exportFlag !== true && exportFlag !== 'TRUE') continue;
    
    var domain = (row[col['Domain'] || col['Target_Domain_CP'] || 0] || '').toString().trim();
    var catName = (row[col['Category_Name'] || col['Name'] || 1] || '').toString().trim();
    
    if (!domain || !catName) continue;
    
    var site = cpGetSiteData(domain);
    if (!site) { errors.push(catName + ': Site not found: ' + domain); continue; }
    
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    if (!authCache[domain]) {
      authCache[domain] = cpGetWPAuthForMedia(site, wpUrl);
    }
    var auth = authCache[domain];
    if (!auth.cookies || !auth.nonce) { errors.push(catName + ': Auth failed'); continue; }
    
    var payload = {
      name: catName,
      slug: (row[col['Slug'] || 2] || '').toString(),
      description: (row[col['Description'] || 3] || '').toString(),
      parent_slug: (row[col['Parent_Slug'] || 4] || '').toString(),
      seo_title: (row[col['SEO_Title'] || 5] || '').toString(),
      seo_description: (row[col['SEO_Description'] || 6] || '').toString(),
    };
    
    try {
      var response = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/export-category', {
        method: 'POST',
        headers: {
          'Cookie': auth.cookies,
          'X-WP-Nonce': auth.nonce,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      
      var code = response.getResponseCode();
      if (code === 200) {
        var body = JSON.parse(response.getContentText());
        if (body.success) {
          var sheetRow = r + 1;
          if (col['▶Export_Cat'] !== undefined) catSheet.getRange(sheetRow, col['▶Export_Cat'] + 1).setValue('DONE');
          exported++;
        } else {
          errors.push(catName + ': ' + JSON.stringify(body));
        }
      } else {
        errors.push(catName + ': HTTP ' + code);
      }
    } catch(e) {
      errors.push(catName + ': ' + e.message);
    }
    
    Utilities.sleep(500);
  }
  
  var msg = '📁 Categories Export\n\n✅ Exported: ' + exported;
  if (errors.length > 0) msg += '\n\n❌ Errors:\n' + errors.join('\n');
  ui.alert(msg);
}


// ============================================================================
// MENU PATCH — add these entries to Menu.gs
// ============================================================================
// .addItem('📋 Update Legal Pages', 'cpExportLegalPages')
// .addItem('📁 Export Categories', 'cpExportCategories')