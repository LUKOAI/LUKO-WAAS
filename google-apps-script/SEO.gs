/**
 * =====================================================================
 * SEO.gs — SEO Automation Module for WAAS (lk24.shop network)
 * =====================================================================
 * Version: 3.0.0 (2026-03-03)
 * Author:  LUKO AI
 *
 * USES EXISTING WAAS FUNCTIONS (from Core.gs, WordPressAuth.gs, SiteManager.gs):
 *   - getSiteById(id)           → site object
 *   - getAuthHeader(site)       → Basic auth header
 *   - makeHttpRequest(url, opt) → HTTP with error handling
 *   - makeAuthenticatedRequest(site, endpoint, opt) → auto-auth request
 *   - logInfo/logError/logSuccess/logWarning(category, msg, siteId)
 *   - getSitesSheet()           → Sites sheet
 *   - getAllActiveSites()       → array of active sites
 *
 * REQUIRES ON WORDPRESS:
 *   - waas-settings plugin (waas-settings.php) installed on each site
 *   - Rank Math SEO plugin active
 *   - WAAS Product Manager v1.2.4+ active
 *
 * MENU INTEGRATION (add to Menu.gs onOpen):
 *   .addSubMenu(ui.createMenu('🔍 SEO')
 *     .addItem('📝 Generate Product Meta (Selected Site)', 'seoMenuProductMeta')
 *     .addItem('📊 SEO Health Check (Selected Site)', 'seoMenuHealthCheck')
 *     .addItem('🔧 Deploy Schema Plugin (Selected Site)', 'seoMenuDeploySchema')
 *     .addItem('📡 Submit All to IndexNow (Selected Site)', 'seoMenuIndexNow')
 *     .addSeparator()
 *     .addItem('🚀 Full SEO Setup (Selected Site)', 'seoMenuFullSetup')
 *     .addItem('🔄 SEO Health Check ALL Sites', 'seoMenuHealthCheckAll'))
 * =====================================================================
 */

// Sites sheet column reference (from actual sheet):
// A=ID(0) B=SiteName(1) C=Domain(2) D=WordPressURL(3) E=AdminUsername(4)
// F=AdminPassword(5) G=DiviAPIUsername(6) H=DiviAPIKey(7)
// I=AmazonPartnerTag(8) J=Status(9) K=DiviInstalled(10) L=PluginInstalled(11)
// M=AutoInstall(12) N=LastCheck(13) O=CreatedDate(14) P=AppPassword(15)
// Q=AuthType(16) R=Notes(17) S=BrandDisplayName(18) ...

const SEO_EXTRA_COLS = {
  seoScore: 'SEO Score',
  indexNowKey: 'IndexNow Key',
  seoLastCheck: 'SEO Last Check'
};

// =============================================================================
// 1. RANKMATH CONFIGURATION
// =============================================================================

function setupRankMathOrg(site) {
  const results = [];

  const titleOptions = {
    'homepage_title': '%sitename% — %sitedesc%',
    'homepage_description': (site.name || site.domain) + ' – Ihr Ratgeber für hochwertige Produkte mit ehrlichen Tests und Vergleichen.',
    'pt_post_title': '%title% — %sitename%',
    'pt_post_description': '%excerpt%',
    'pt_page_title': '%title% — %sitename%',
    'pt_page_description': '%excerpt%',
    'pt_product_title': '%title% | %sitename%',
    'pt_product_description': '%excerpt%',
    'author_archive_title': '%name% — %sitename%',
    'date_archive_title': '%date% — %sitename%',
    'search_title': 'Suchergebnisse für "%search_query%" — %sitename%',
    '404_title': 'Seite nicht gefunden — %sitename%',
    'noindex_empty_taxonomies': 'on',
    'noindex_author_archive': 'on',
    'noindex_date_archive': 'on',
    'nofollow_image_links': 'on',
    'breadcrumbs': 'on',
    'breadcrumbs_separator': '»',
    'breadcrumbs_home_label': 'Startseite'
  };

  var r1 = _seoApiPut(site, '/option', { option_name: 'rank-math-options-titles', option_value: titleOptions });
  results.push({ step: 'titles', success: r1.success });

  var r2 = _seoApiPut(site, '/option', {
    option_name: 'rank-math-options-sitemap',
    option_value: {
      'sitemap_items_per_page': 1000,
      'pt_post_sitemap': 'on',
      'pt_page_sitemap': 'on',
      'pt_product_sitemap': 'on',
      'tax_product_cat_sitemap': 'on',
      'tax_category_sitemap': 'on',
      'author_sitemap': 'off',
      'ping_search_engines': 'on'
    }
  });
  results.push({ step: 'sitemap', success: r2.success });

  var r3 = _seoApiPut(site, '/option', {
    option_name: 'rank-math-options-general',
    option_value: {
      'support_rank_math': 'off',
      'usage_tracking': 'off',
      'frontend_seo_score': 'off',
      'attachment_redirect_urls': 'on',
      'url_strip_stopwords': 'off'
    }
  });
  results.push({ step: 'general', success: r3.success });

  var allOk = results.every(function(r) { return r.success; });
  if (allOk) {
    logSuccess('SEO', 'RankMath configured on ' + site.name, site.id);
  } else {
    logWarning('SEO', 'RankMath partially configured on ' + site.name + ': ' + JSON.stringify(results), site.id);
  }
  return { success: allOk, configured: results };
}


// =============================================================================
// 2. PARTNER TAG FIX (P0 — Revenue Critical)
// =============================================================================

function fixPartnerTag(site) {
  var correctTag = site.partnerTag;
  if (!correctTag) {
    logError('SEO', 'No Amazon Partner Tag in Sites sheet for ' + site.name, site.id);
    return { success: false, error: 'No partnerTag in Sites sheet' };
  }

  // Read current tag — try both new format (individual option) and legacy (nested)
  var oldTag = '';
  var r1 = _seoApiGet(site, '/option', { option_name: 'waas_pm_amazon_partner_tag' });
  if (r1.success && r1.data && r1.data.value) {
    oldTag = r1.data.value;
  } else {
    // Legacy fallback: waas_pm_settings as array
    var r1b = _seoApiGet(site, '/option', { option_name: 'waas_pm_settings' });
    if (r1b.success && r1b.data && r1b.data.value) {
      var settings = r1b.data.value;
      oldTag = settings.amazon_partner_tag || settings.partner_tag || '';
    }
  }

  // Update BOTH option formats for compatibility
  var ok1 = _seoApiPut(site, '/option', { option_name: 'waas_pm_amazon_partner_tag', option_value: correctTag });
  var ok2 = _seoApiPut(site, '/option', { option_name: 'waas_pm_amazon_associate_tag', option_value: correctTag });

  if (!ok1.success && !ok2.success) {
    logError('SEO', 'Failed to update partner tag on ' + site.name, site.id);
    return { success: false, error: 'Failed to update partner tag options' };
  }

  logSuccess('SEO', 'Partner tag updated: ' + correctTag, site.id);

  // Bulk replace in content if old tag differs
  var replaceResult = { success: false };
  if (oldTag && oldTag !== correctTag) {
    replaceResult = _seoApiPost(site, '/bulk-replace', {
      old: 'tag=' + oldTag,
      new: 'tag=' + correctTag,
      targets: ['posts_content', 'postmeta', 'options'],
      preview: false
    });
    if (replaceResult.success) {
      logSuccess('SEO', 'Bulk replaced "' + oldTag + '" → "' + correctTag + '" on ' + site.name, site.id);
    }
  }

  return { success: true, correctTag: correctTag, oldTag: oldTag, replaced: replaceResult.data };
}


// =============================================================================
// 3. SMART PRODUCT META GENERATION (7 Niches)
// =============================================================================

var NICHE_META_PARSERS = {

  'erdloch-bohren': function(title) {
    var diameter = title.match(/(\d+)\s*mm/i);
    var length = title.match(/(\d+)\s*cm/i);
    var type = /[Ss]piralbohrer/.test(title) ? 'Spiralbohrer'
             : /[Ee]rdbohrer/.test(title) ? 'Erdbohrer'
             : /[Bb]ohrschnecke/.test(title) ? 'Bohrschnecke' : 'Erdbohrer';
    var meta = type;
    if (diameter) meta += ' ' + diameter[1] + ' mm';
    if (length) meta += ', ' + length[1] + ' cm lang';
    meta += ' – Perfekt für Zaunpfähle, Pflanzlöcher & Fundamentarbeiten. Jetzt Preis prüfen & bestellen.';
    return _trimMeta(meta, 120, 155);
  },

  'meisseltechnik': function(title) {
    var type = /[Ss]pitz/.test(title) ? 'Spitzmeißel'
             : /[Ff]lach/.test(title) ? 'Flachmeißel'
             : /[Bb]reit/.test(title) ? 'Breitmeißel'
             : /[Kk]anal/.test(title) ? 'Kanalmeißel' : 'Meißel';
    var sds = title.match(/SDS[\s-]?(Plus|Max|plus|max)/i);
    var meta = type;
    if (sds) meta += ' SDS-' + sds[1];
    meta += ' für Stemm- und Abbrucharbeiten. Hochwertiger Stahl, langlebig und präzise. Jetzt günstig kaufen.';
    return _trimMeta(meta, 120, 155);
  },

  'betonbohrtechnik': function(title) {
    var diameter = title.match(/(\d+)\s*mm/i);
    var type = /[Bb]ohrkrone/.test(title) ? 'Bohrkrone'
             : /[Dd]osenbohrer/.test(title) ? 'Dosenbohrer'
             : /[Kk]ernbohr/.test(title) ? 'Kernbohrkrone' : 'Betonbohrer';
    var meta = type;
    if (diameter) meta += ' ' + diameter[1] + ' mm';
    meta += ' – Präzise durch Beton, Mauerwerk & Stahlbeton. Professionelle Qualität zum besten Preis.';
    return _trimMeta(meta, 120, 155);
  },

  'saegeblatttechnik': function(title) {
    var diameter = title.match(/(\d+)\s*mm/i);
    var teeth = title.match(/(\d+)\s*[Zz]ähn/i);
    var material = /[Hh]olz/.test(title) ? 'für Holz' : /[Mm]etall/.test(title) ? 'für Metall' : '';
    var meta = 'Sägeblatt';
    if (diameter) meta += ' ' + diameter[1] + ' mm';
    if (teeth) meta += ', ' + teeth[1] + ' Zähne';
    if (material) meta += ' ' + material;
    meta += ' – Saubere Schnitte, lange Standzeit. Jetzt Preis vergleichen.';
    return _trimMeta(meta, 120, 155);
  },

  'bohradaptertechnik': function(title) {
    var from = title.match(/SDS[\s-]?(Plus|Max|plus|max)/i);
    var type = /[Aa]dapter/.test(title) ? 'Adapter'
             : /[Vv]erlängerung/.test(title) ? 'Verlängerung'
             : /[Ff]utter/.test(title) ? 'Bohrfutter' : 'Adapter';
    var meta = type;
    if (from) meta += ' SDS-' + from[1];
    meta += ' – Kompatibel mit allen gängigen Bohrhämmern. Präzise Passform, schneller Wechsel. Jetzt kaufen.';
    return _trimMeta(meta, 120, 155);
  },

  'magnetbohrmaschine': function(title) {
    var power = title.match(/(\d+)\s*[Ww]/i);
    var type = /[Mm]agnet/.test(title) ? 'Magnetbohrmaschine' : /[Ss]tänder/.test(title) ? 'Bohrständer' : 'Magnetbohrmaschine';
    var meta = type;
    if (power) meta += ' ' + power[1] + 'W';
    meta += ' – Professionelles Bohren in Stahl und Metall. Starker Magnet, präzise Führung. Jetzt kaufen.';
    return _trimMeta(meta, 120, 155);
  },

  'kernbohrung': function(title) {
    var diameter = title.match(/(\d+)\s*mm/i);
    var type = /[Nn]ass/.test(title) ? 'Nassbohrkrone' : /[Tt]rocken/.test(title) ? 'Trockenbohrkrone' : 'Kernbohrkrone';
    var meta = type;
    if (diameter) meta += ' ' + diameter[1] + ' mm';
    meta += ' – Für saubere Kernbohrungen in Beton, Mauerwerk & Stein. Top-Qualität, faire Preise.';
    return _trimMeta(meta, 120, 155);
  }
};


function deployProductMeta(site, previewOnly) {
  if (previewOnly === undefined) previewOnly = true;
  var niche = _detectNiche(site);
  var parser = NICHE_META_PARSERS[niche];

  if (!parser) {
    logWarning('SEO', 'No meta parser for niche "' + niche + '" on ' + site.name, site.id);
    return { success: false, error: 'No parser for niche: ' + niche };
  }

  logInfo('SEO', (previewOnly ? 'PREVIEW' : 'DEPLOYING') + ' product meta for ' + site.name + ' (niche: ' + niche + ')', site.id);

  var products = _getAllWpItems(site, 'product');
  var posts = _getAllWpItems(site, 'posts');
  var allItems = products.concat(posts);

  var generated = 0, skipped = 0, failed = 0;
  var items = [];

  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i];
    var existingMeta = item.meta && item.meta.rank_math_description;
    if (existingMeta && existingMeta.length > 30) { skipped++; continue; }

    var title = item.title && item.title.rendered ? _decodeHtml(item.title.rendered) : (item.title || '');
    if (!title) { skipped++; continue; }

    var metaDesc = parser(title);
    var focusKw = _extractFocusKeyword(title, niche);

    if (!previewOnly) {
      var r = _seoApiPut(site, '/postmeta/' + item.id, {
        rank_math_description: metaDesc,
        rank_math_focus_keyword: focusKw
      });
      if (r.success) { generated++; } else { failed++; }
    } else {
      generated++;
    }

    items.push({ id: item.id, title: title.substring(0, 60), meta: metaDesc, keyword: focusKw });
  }

  logInfo('SEO', (previewOnly ? 'Preview' : 'Deployed') + ': ' + generated + ' generated, ' + skipped + ' skipped, ' + failed + ' failed', site.id);
  return { success: true, preview: previewOnly, niche: niche, generated: generated, skipped: skipped, failed: failed, total: allItems.length, items: items.slice(0, 20) };
}


function deployPageMeta(site) {
  var siteName = site.name || site.domain;
  var pages = _getAllWpItems(site, 'pages');
  var updated = 0;

  var PAGE_META = {
    'impressum': { desc: 'Impressum von ' + siteName + ' – Angaben gemäß § 5 TMG.', robots: 'noindex' },
    'datenschutz': { desc: 'Datenschutzerklärung von ' + siteName + ' – Ihre Daten sind bei uns sicher.', robots: 'noindex' },
    'datenschutzerklarung': { desc: 'Datenschutzerklärung von ' + siteName + ' – Ihre Daten sind bei uns sicher.', robots: 'noindex' },
    'kontakt': { desc: 'Kontaktieren Sie ' + siteName + ' – Wir helfen Ihnen gerne weiter.', robots: '' },
    'shop': { desc: siteName + ' Shop – Entdecken Sie unsere handverlesene Produktauswahl.', robots: '' },
    'blog': { desc: siteName + ' Blog – Ratgeber, Tests und Tipps rund um unsere Produkte.', robots: '' },
    'warenkorb': { desc: 'Warenkorb – ' + siteName, robots: 'noindex' },
    'cart': { desc: 'Cart – ' + siteName, robots: 'noindex' },
    'kasse': { desc: 'Kasse – ' + siteName, robots: 'noindex' },
    'checkout': { desc: 'Checkout – ' + siteName, robots: 'noindex' },
    'mein-konto': { desc: 'Mein Konto – ' + siteName, robots: 'noindex' },
    'my-account': { desc: 'My Account – ' + siteName, robots: 'noindex' }
  };

  for (var i = 0; i < pages.length; i++) {
    var slug = (pages[i].slug || '').toLowerCase();
    var config = PAGE_META[slug];
    if (!config) continue;
    var payload = { rank_math_description: config.desc };
    if (config.robots) payload.rank_math_robots = config.robots;
    var r = _seoApiPut(site, '/postmeta/' + pages[i].id, payload);
    if (r.success) updated++;
  }

  logSuccess('SEO', 'Page meta deployed: ' + updated + ' pages on ' + site.name, site.id);
  return { success: true, updated: updated };
}


// =============================================================================
// 4. SET SEO META ON NEW POST (called by ContentGenerator.gs)
// =============================================================================

function setPostSeoMeta(site, postId, seoData) {
  var payload = {};
  if (seoData.title) payload.rank_math_title = seoData.title;
  if (seoData.description) payload.rank_math_description = seoData.description;
  if (seoData.focusKeyword) payload.rank_math_focus_keyword = seoData.focusKeyword;
  if (seoData.robots) payload.rank_math_robots = seoData.robots;

  var result = _seoApiPut(site, '/postmeta/' + postId, payload);
  if (result.success) {
    logSuccess('SEO', 'SEO meta set on post ' + postId, site.id);
  } else {
    logWarning('SEO', 'Failed to set SEO meta on post ' + postId, site.id);
  }
  return result.success;
}


// =============================================================================
// 5. INDEXNOW SUBMISSION
// =============================================================================

function notifyIndexNow(site, url) {
  return notifyIndexNowBatch(site, [url]);
}

function notifyIndexNowBatch(site, urls) {
  if (!urls || urls.length === 0) return false;
  var key = _getOrCreateIndexNowKey(site);
  var host = site.domain || site.wpUrl.replace(/https?:\/\//, '').replace(/\/.*/, '');

  var response = makeHttpRequest('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({
      host: host,
      key: key,
      keyLocation: 'https://' + host + '/' + key + '.txt',
      urlList: urls.slice(0, 10000)
    })
  });

  if (response.success || response.statusCode === 200 || response.statusCode === 202) {
    logSuccess('SEO', 'IndexNow: ' + urls.length + ' URLs submitted for ' + site.name, site.id);
    return true;
  }
  logWarning('SEO', 'IndexNow failed: ' + response.statusCode, site.id);
  return false;
}

function submitAllToIndexNow(site) {
  var posts = _getAllWpItems(site, 'posts');
  var products = _getAllWpItems(site, 'product');
  var pages = _getAllWpItems(site, 'pages');
  var urls = posts.concat(products).concat(pages).filter(function(i) { return i.link; }).map(function(i) { return i.link; });
  if (urls.length === 0) return { success: true, submitted: 0 };
  var ok = notifyIndexNowBatch(site, urls);
  return { success: ok, submitted: urls.length };
}


// =============================================================================
// 6. SEO HEALTH CHECK
// =============================================================================

function runSeoHealthCheck(site) {
  logInfo('SEO', 'Running SEO health check on ' + site.name + '...', site.id);
  var checks = [];

  checks.push({ name: 'Rank Math Active', passed: _checkPluginActive(site, 'rank-math'), critical: true });
  checks.push({ name: 'WAAS Product Manager Active', passed: _checkPluginActive(site, 'waas-product-manager'), critical: true });
  checks.push({ name: 'WooCommerce Active', passed: _checkPluginActive(site, 'woocommerce'), critical: false });
  checks.push({ name: 'Partner Tag Correct', passed: _checkPartnerTag(site), critical: true });
  checks.push({ name: 'Homepage Meta Description', passed: _checkHomepageMeta(site), critical: true });
  checks.push({ name: 'Sitemap Accessible', passed: _checkSitemap(site), critical: true });
  checks.push({ name: 'robots.txt Present', passed: _checkRobots(site), critical: false });
  checks.push({ name: 'SSL Active (HTTPS)', passed: site.wpUrl && site.wpUrl.indexOf('https://') === 0, critical: true });
  checks.push({ name: 'REST API Accessible', passed: _checkRestApi(site), critical: true });
  checks.push({ name: 'waas-settings Plugin Active', passed: _checkWaasSettingsPlugin(site), critical: false });

  var passed = checks.filter(function(c) { return c.passed; }).length;
  var total = checks.length;
  var score = Math.round((passed / total) * 100);

  _updateSeoField(site, 'seoScore', score);
  _updateSeoField(site, 'seoLastCheck', new Date().toISOString());

  logInfo('SEO', 'Health check: ' + score + '% (' + passed + '/' + total + ') for ' + site.name, site.id);
  return { score: score, checks: checks, passed: passed, total: total, site: site.name };
}


// =============================================================================
// 7. DEPLOY SCHEMA MU-PLUGIN
// =============================================================================

function deploySchemaPlugin(site) {
  var result = _seoApiPost(site, '/deploy-mu-plugin', {
    filename: 'lk24-schema.php',
    content: _getSchemaPluginCode()
  });
  if (result.success) logSuccess('SEO', 'Schema mu-plugin deployed on ' + site.name, site.id);
  else logError('SEO', 'Failed to deploy schema plugin on ' + site.name, site.id);
  return result;
}


// =============================================================================
// 8. FULL SEO SETUP
// =============================================================================

function runFullSeoSetup(site) {
  logInfo('SEO', '=== FULL SEO SETUP starting for ' + site.name + ' ===', site.id);
  var results = {};

  results.rankmath = setupRankMathOrg(site);
  logInfo('SEO', 'Step 1/6 RankMath: ' + (results.rankmath.success ? '✅' : '❌'), site.id);

  results.partnerTag = fixPartnerTag(site);
  logInfo('SEO', 'Step 2/6 Partner Tag: ' + (results.partnerTag.success ? '✅' : '❌'), site.id);

  results.productMeta = deployProductMeta(site, false);
  logInfo('SEO', 'Step 3/6 Product Meta: ' + (results.productMeta.generated || 0) + ' generated', site.id);

  results.pageMeta = deployPageMeta(site);
  logInfo('SEO', 'Step 4/6 Page Meta: ' + (results.pageMeta.updated || 0) + ' pages', site.id);

  results.schema = deploySchemaPlugin(site);
  logInfo('SEO', 'Step 5/6 Schema: ' + (results.schema.success ? '✅' : '❌'), site.id);

  results.healthCheck = runSeoHealthCheck(site);
  logInfo('SEO', 'Step 6/6 Health: ' + results.healthCheck.score + '%', site.id);

  logSuccess('SEO', '=== FULL SEO SETUP completed — Score: ' + results.healthCheck.score + '% ===', site.id);
  return results;
}


// =============================================================================
// MENU FUNCTIONS
// =============================================================================

function _seoGetSelectedSite() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== 'Sites') {
    SpreadsheetApp.getUi().alert('⚠️ Go to "Sites" tab and select a site row.');
    return null;
  }
  var row = sheet.getActiveRange().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('⚠️ Select a site row (not header).'); return null; }
  var siteId = sheet.getRange(row, 1).getValue();
  if (!siteId) { SpreadsheetApp.getUi().alert('⚠️ No site ID found.'); return null; }
  return getSiteById(siteId);
}

function seoMenuProductMeta() {
  var site = _seoGetSelectedSite(); if (!site) return;
  var ui = SpreadsheetApp.getUi();
  var preview = deployProductMeta(site, true);
  if (!preview.success) { ui.alert('❌ Error', preview.error, ui.ButtonSet.OK); return; }

  var text = 'Niche: ' + preview.niche + '\nTotal: ' + preview.total + '\nWill generate: ' + preview.generated + '\nSkip (has meta): ' + preview.skipped + '\n\n--- Examples ---\n';
  for (var i = 0; i < Math.min(preview.items.length, 5); i++) {
    var it = preview.items[i];
    text += '\n[' + it.id + '] ' + it.title + '\n  → ' + it.meta + '\n  → KW: ' + it.keyword + '\n';
  }

  if (ui.alert('📝 Preview', text, ui.ButtonSet.YES_NO) === ui.Button.YES) {
    var result = deployProductMeta(site, false);
    ui.alert('✅ Done', result.generated + ' meta descriptions generated!', ui.ButtonSet.OK);
  }
}

function seoMenuHealthCheck() {
  var site = _seoGetSelectedSite(); if (!site) return;
  var result = runSeoHealthCheck(site);
  var msg = '🏆 Score: ' + result.score + '% (' + result.passed + '/' + result.total + ')\n\n';
  for (var i = 0; i < result.checks.length; i++) {
    var c = result.checks[i];
    msg += (c.passed ? '✅' : '❌') + ' ' + c.name + (c.critical ? ' (CRITICAL)' : '') + '\n';
  }
  SpreadsheetApp.getUi().alert('SEO Health: ' + site.name, msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function seoMenuDeploySchema() {
  var site = _seoGetSelectedSite(); if (!site) return;
  var result = deploySchemaPlugin(site);
  SpreadsheetApp.getUi().alert(result.success ? '✅ Deployed' : '❌ Error',
    result.success ? 'Schema mu-plugin deployed on ' + site.name : 'Failed', SpreadsheetApp.getUi().ButtonSet.OK);
}

function seoMenuIndexNow() {
  var site = _seoGetSelectedSite(); if (!site) return;
  var result = submitAllToIndexNow(site);
  SpreadsheetApp.getUi().alert(result.success ? '✅ IndexNow' : '❌ Error',
    result.submitted + ' URLs submitted for ' + site.name, SpreadsheetApp.getUi().ButtonSet.OK);
}

function seoMenuFullSetup() {
  var site = _seoGetSelectedSite(); if (!site) return;
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('🚀 Full SEO Setup', 'Run complete SEO setup on ' + site.name + '?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var results = runFullSeoSetup(site);
  var msg = 'RankMath: ' + (results.rankmath.success ? '✅' : '❌') + '\n';
  msg += 'Partner Tag: ' + (results.partnerTag.success ? '✅' : '❌') + '\n';
  msg += 'Product Meta: ' + (results.productMeta.generated || 0) + ' generated\n';
  msg += 'Page Meta: ' + (results.pageMeta.updated || 0) + ' pages\n';
  msg += 'Schema: ' + (results.schema.success ? '✅' : '❌') + '\n';
  msg += '\n🏆 SEO Score: ' + results.healthCheck.score + '%';
  ui.alert('🚀 Complete', msg, ui.ButtonSet.OK);
}

function seoMenuHealthCheckAll() {
  var sites = getAllActiveSites();
  if (!sites || sites.length === 0) { SpreadsheetApp.getUi().alert('No active sites.'); return; }
  var summary = '';
  for (var i = 0; i < sites.length; i++) {
    var site = getSiteById(sites[i].id);
    if (!site) continue;
    try {
      var result = runSeoHealthCheck(site);
      summary += (result.score >= 80 ? '✅' : '⚠️') + ' ' + site.name + ': ' + result.score + '%\n';
    } catch (e) {
      summary += '❌ ' + site.name + ': ' + e.message + '\n';
    }
  }
  SpreadsheetApp.getUi().alert('🏆 SEO Health — All Sites', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}


// =============================================================================
// PRIVATE: waas-settings API helpers
// =============================================================================

function _seoApiGet(site, endpoint, params) {
  var url = site.wpUrl + '/wp-json/waas-settings/v1' + endpoint;
  if (params) {
    var qs = Object.keys(params).map(function(k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    url += '?' + qs;
  }
  return makeHttpRequest(url, { method: 'GET', headers: { 'Authorization': getAuthHeader(site) } });
}

function _seoApiPut(site, endpoint, body) {
  return makeHttpRequest(site.wpUrl + '/wp-json/waas-settings/v1' + endpoint, {
    method: 'PUT',
    headers: { 'Authorization': getAuthHeader(site), 'Content-Type': 'application/json' },
    payload: JSON.stringify(body)
  });
}

function _seoApiPost(site, endpoint, body) {
  return makeHttpRequest(site.wpUrl + '/wp-json/waas-settings/v1' + endpoint, {
    method: 'POST',
    headers: { 'Authorization': getAuthHeader(site), 'Content-Type': 'application/json' },
    payload: JSON.stringify(body)
  });
}


// =============================================================================
// PRIVATE: WordPress data helpers
// =============================================================================

function _getAllWpItems(site, postType) {
  var allItems = [];
  var page = 1;
  var perPage = 100;
  var endpoint = postType === 'product' ? 'wc/v3/products' : 'wp/v2/' + postType;

  while (true) {
    var url = site.wpUrl + '/wp-json/' + endpoint + '?per_page=' + perPage + '&page=' + page + '&status=publish';
    var response = makeHttpRequest(url, { method: 'GET', headers: { 'Authorization': getAuthHeader(site) } });
    if (!response.success || !response.data || !Array.isArray(response.data) || response.data.length === 0) break;
    allItems = allItems.concat(response.data);
    if (response.data.length < perPage) break;
    page++;
    if (page > 50) break;
  }
  return allItems;
}


// =============================================================================
// PRIVATE: Niche detection
// =============================================================================

function _detectNiche(site) {
  var domain = site.domain || '';
  var match = domain.match(/^([a-z0-9-]+)\.lk24\.shop$/i);
  if (match) return match[1];
  var name = (site.name || '').toLowerCase();
  var niches = Object.keys(NICHE_META_PARSERS);
  for (var i = 0; i < niches.length; i++) {
    if (name.indexOf(niches[i].replace(/-/g, '')) >= 0) return niches[i];
  }
  return 'unknown';
}


// =============================================================================
// PRIVATE: Meta & keyword helpers
// =============================================================================

function _trimMeta(text, minLen, maxLen) {
  if (text.length <= maxLen) return text;
  var trimmed = text.substring(0, maxLen);
  var lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > minLen ? trimmed.substring(0, lastSpace) : trimmed) + '…';
}

function _extractFocusKeyword(title, niche) {
  var cleaned = title
    .replace(/\b(WERHE|Bosch|Makita|Hilti|DeWalt|Metabo|SDS[\s-]?(Plus|Max)|[A-Z0-9]{2,}-[A-Z0-9]+)\b/gi, '')
    .replace(/\d+\s*(mm|cm|m|W|kg|Stk|er)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return cleaned.split(' ').filter(function(w) { return w.length > 2; }).slice(0, 4).join(' ').toLowerCase();
}

function _decodeHtml(html) {
  return html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8211;/g, '–').replace(/<[^>]+>/g, '');
}


// =============================================================================
// PRIVATE: IndexNow key
// =============================================================================

function _getOrCreateIndexNowKey(site) {
  var sheet = getSitesSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keyCol = headers.indexOf('IndexNow Key');
  if (keyCol === -1) {
    keyCol = sheet.getLastColumn();
    sheet.getRange(1, keyCol + 1).setValue('IndexNow Key');
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === site.id) {
      var existing = data[i][keyCol];
      if (existing && String(existing).length > 10) return String(existing);
      var key = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
      sheet.getRange(i + 1, keyCol + 1).setValue(key);
      return key;
    }
  }
  return Utilities.getUuid().replace(/-/g, '').substring(0, 32);
}


// =============================================================================
// PRIVATE: SEO field update in Sites sheet
// =============================================================================

function _updateSeoField(site, fieldName, value) {
  try {
    var sheet = getSitesSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var label = SEO_EXTRA_COLS[fieldName] || fieldName;
    var col = headers.indexOf(label);
    if (col === -1) {
      col = sheet.getLastColumn();
      sheet.getRange(1, col + 1).setValue(label);
    }
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === site.id) {
        sheet.getRange(i + 1, col + 1).setValue(value);
        return;
      }
    }
  } catch (e) {
    logWarning('SEO', 'Could not update ' + fieldName + ': ' + e.message, site.id);
  }
}


// =============================================================================
// PRIVATE: Health check sub-checks
// =============================================================================

function _checkPluginActive(site, pluginSlug) {
  try {
    var r = makeHttpRequest(site.wpUrl + '/wp-json/wp/v2/plugins', { headers: { 'Authorization': getAuthHeader(site) } });
    if (r.success && Array.isArray(r.data)) {
      return r.data.some(function(p) { return p.plugin && p.plugin.toLowerCase().indexOf(pluginSlug) >= 0 && p.status === 'active'; });
    }
    return false;
  } catch (e) { return false; }
}

function _checkPartnerTag(site) {
  try {
    // Try new format first (individual option)
    var r = _seoApiGet(site, '/option', { option_name: 'waas_pm_amazon_partner_tag' });
    if (r.success && r.data && r.data.value) return r.data.value === site.partnerTag;
    // Legacy fallback
    var r2 = _seoApiGet(site, '/option', { option_name: 'waas_pm_settings' });
    if (r2.success && r2.data && r2.data.value) return (r2.data.value.amazon_partner_tag || '') === site.partnerTag;
    return false;
  } catch (e) { return false; }
}

function _checkHomepageMeta(site) {
  try {
    var r = _seoApiGet(site, '/option', { option_name: 'rank-math-options-titles' });
    if (r.success && r.data && r.data.value) return (r.data.value.homepage_description || '').length > 20;
    return false;
  } catch (e) { return false; }
}

function _checkSitemap(site) {
  try { var r = makeHttpRequest(site.wpUrl + '/sitemap_index.xml'); return r.success; } catch (e) { return false; }
}

function _checkRobots(site) {
  try { var r = makeHttpRequest(site.wpUrl + '/robots.txt'); return r.success; } catch (e) { return false; }
}

function _checkRestApi(site) {
  try { var r = makeHttpRequest(site.wpUrl + '/wp-json/'); return r.success; } catch (e) { return false; }
}

function _checkWaasSettingsPlugin(site) {
  try { var r = _seoApiGet(site, '/diagnostics'); return r.success; } catch (e) { return false; }
}


// =============================================================================
// PRIVATE: Schema mu-plugin code
// =============================================================================

function _getSchemaPluginCode() {
  return '<?php\n'
    + '/**\n * Plugin Name: LK24 Schema Helper\n * Description: FAQ schema for affiliate pages\n * Version: 1.0.0\n */\n'
    + 'if (!defined("ABSPATH")) exit;\n\n'
    + 'add_action("wp_footer", function() {\n'
    + '  if (!is_singular()) return;\n'
    + '  global $post;\n'
    + '  if (!$post) return;\n'
    + '  $content = $post->post_content;\n'
    + '  preg_match_all("/<h[34][^>]*>(.+?)<\\/h[34]>\\s*<p>(.+?)<\\/p>/is", $content, $matches, PREG_SET_ORDER);\n'
    + '  if (empty($matches)) return;\n'
    + '  $items = [];\n'
    + '  foreach ($matches as $m) {\n'
    + '    $q = strip_tags($m[1]);\n'
    + '    $a = strip_tags($m[2]);\n'
    + '    if (strlen($q) > 10 && strlen($a) > 20 && substr($q, -1) === "?") {\n'
    + '      $items[] = ["@type" => "Question", "name" => $q, "acceptedAnswer" => ["@type" => "Answer", "text" => $a]];\n'
    + '    }\n'
    + '  }\n'
    + '  if (!empty($items)) {\n'
    + '    $schema = ["@context" => "https://schema.org", "@type" => "FAQPage", "mainEntity" => $items];\n'
    + '    echo \'<script type="application/ld+json">\' . json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . \'</script>\';\n'
    + '  }\n'
    + '});\n';
}
