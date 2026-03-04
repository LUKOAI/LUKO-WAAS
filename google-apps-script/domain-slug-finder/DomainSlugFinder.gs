/**
 * LUKO Domain Slug Finder
 * Automatyczne znajdowanie optymalnych nazw poddomeny dla niszowych stron afiliacyjnych Amazon.de
 *
 * Stack: Google Sheets + Apps Script + SP API + Claude API + Autocomplete + DENIC
 * Architektura: 100% Google, zero n8n
 *
 * @version 2.0
 * @author NetAnaliza / LUKO (Lukasz Koronczok)
 */

// ==================== CONSTANTS ====================

const DSF_MARKETPLACE_ID = 'A1PA6795UKMFR9';
const DSF_SP_ENDPOINT = 'https://sellingpartnerapi-eu.amazon.com';
const DSF_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const DSF_CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DSF_ANTHROPIC_VERSION = '2023-06-01';

// ==================== CLAUDE PROMPTS ====================

const DSF_SYSTEM_PROMPT_ANALYSIS = `Du bist ein Experte für Amazon-Affiliate-Marketing und deutschen SEO-Markt.
Du analysierst Produktdaten aus Amazon.de und generierst eine Nischenanalyse
für den Aufbau einer Affiliate-Website.
Antworte NUR mit validem JSON. Kein Präambel, keine Markdown-Blöcke.`;

const DSF_USER_PROMPT_ANALYSIS = `Analysiere dieses Amazon.de Produkt und generiere folgendes JSON:

PRODUKTDATEN:
{SP_DATA}

AUTOCOMPLETE-VORSCHLÄGE AMAZON.DE:
{AMAZON_SUGGESTIONS}

AUTOCOMPLETE-VORSCHLÄGE GOOGLE.DE:
{GOOGLE_SUGGESTIONS}

Generiere folgende JSON-Struktur (alle Inhalte auf DEUTSCH):
{
  "needs_and_problems": ["8-12 Bedürfnisse/Probleme/Wünsche die durch diesen Produkttyp gelöst werden"],
  "buyer_personas": ["3-5 Käuferprofile mit kurzer Beschreibung"],
  "frequent_words": ["15-25 häufige Wörter aus Produktnamen und Beschreibungen"],
  "keyword_candidates": ["10-20 Schlüsselwörter/Phrasen die Bedarf und Produkt beschreiben"],
  "usage_situations": ["6-10 Situationen in denen das Produkt verwendet wird"],
  "search_triggers": ["6-10 Situationen in denen jemand beginnt online nach Lösungen zu suchen"],
  "search_questions": ["8-15 Fragen auf Deutsch die jemand bei der Suche nach Lösungen eingibt"],
  "tips_topics": ["8-12 Ratgeber-Themen auf Deutsch (was man tun sollte)"],
  "dont_do_topics": ["5-8 Themen auf Deutsch (was man NICHT tun sollte)"],
  "influencers_de": ["3-5 deutsche YouTube-Kanäle/Podcasts zu diesem Thema - nur wenn sicher bekannt, sonst null"],
  "blogs_articles_de": ["3-5 deutsche Blogs/Portale zu diesem Thema - nur wenn sicher bekannt, sonst null"],
  "top_shops_de": ["5-10 deutsche Online-Shops die diesen Produkttyp verkaufen"],
  "cultural_context": ["3-5 kulturelle Kontexte in Deutschland wo dieses Produkt/Problem im Alltag vorkommt"]
}`;

const DSF_USER_PROMPT_SLUGS = `Du bist ein Experte für Domain-Naming und deutschen SEO-Markt.

NISCHENANALYSE:
{ANALYSIS_DATA}

Schlage 5-8 Subdomain-Slug-Kandidaten für eine Amazon-Affiliate-Website vor.

KRITERIEN (alle müssen bewertet werden):
1. Entspricht dem Hauptbedürfnis/Problem/Lösungsname des Kunden
2. Klar für Fachleute in dieser Nische
3. Idealerweise = Teil oder Ganzes des Produktnamens
4. AUF DEUTSCH (kein Englisch)
5. Max 2-3 Wörter (zusammengeschrieben oder mit Bindestrich)
6. OHNE Sonderzeichen (ä→ae, ö→oe, ü→ue, ß→ss - automatisch konvertiert)
7. Auf amazon.de eingegeben liefert relevante Produktergebnisse

WICHTIG: Gib für jeden Kandidaten:
- slug: fertiger normalisierter Slug (kleinbuchstaben, kein lk24.shop, nur a-z0-9-)
- full_subdomain: slug + '.lk24.shop'
- type: 'CATEGORY_BASED' oder 'NEED_BASED'
- rationale_de: max 2 Sätze Begründung auf Deutsch
- rationale_pl: max 2 Sätze Begründung auf Polnisch (für den Eigentümer)
- amazon_test_phrase: Phrase zum Testen auf amazon.de
- score_criteria: Array mit 7 true/false Werten für Kriterien 1-7
- score_total: Summe der true-Werte (0-7)
- content_topics: 5 Artikel-/Ratgeber-Themen auf Deutsch
- suggested_url_slugs: 5 Beispiel-URL-Slugs für Unterseiten

Sortiere von besten zu schlechtesten (score_total absteigend).
Antworte NUR mit validem JSON-Array. Kein Präambel.`;

// ==================== MENU ====================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Domain Finder')
    .addItem('Konfiguruj API Keys', 'dsfSetConfig')
    .addItem('Zainstaluj trigger', 'dsfSetupTriggers')
    .addSeparator()
    .addItem('Uruchom recznie (aktywny wiersz)', 'dsfRunManual')
    .addItem('Test z ASIN B0FRG79LF9', 'dsfRunTest')
    .addSeparator()
    .addItem('Test polaczenia SP-API', 'dsfTestSpApi')
    .addItem('Test polaczenia Claude API', 'dsfTestClaude')
    .addToUi();
}

// ==================== SETUP & CONFIG ====================

/**
 * Setup installable onEdit trigger for INPUT sheet
 */
function dsfSetupTriggers() {
  var ui = SpreadsheetApp.getUi();

  // Remove existing DSF triggers
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dsfOnEditInstallable') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  // Install new trigger
  ScriptApp.newTrigger('dsfOnEditInstallable')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  // Ensure all sheets exist
  dsfEnsureSheets_();

  ui.alert('Trigger zainstalowany',
    (removed > 0 ? 'Usunieto ' + removed + ' starych triggerow.\n' : '') +
    'Nowy installable onEdit trigger zainstalowany.\n\n' +
    'Zaznacz checkbox w kolumnie F w zakladce INPUT aby uruchomic pipeline.',
    ui.ButtonSet.OK);
}

/**
 * Prompt user for all API keys and save to Script Properties
 */
function dsfSetConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var fields = [
    { key: 'CLAUDE_API_KEY', label: 'Claude API Key', help: 'Z console.anthropic.com > API Keys' },
    { key: 'SP_LWA_CLIENT_ID', label: 'SP-API LWA Client ID', help: 'Z Amazon Seller Central > Apps & Services > Develop Apps' },
    { key: 'SP_LWA_CLIENT_SECRET', label: 'SP-API LWA Client Secret', help: 'Secret z tej samej aplikacji LWA' },
    { key: 'SP_REFRESH_TOKEN', label: 'SP-API Refresh Token', help: 'Token z procesu autoryzacji SP-API' },
    { key: 'SP_SELLER_ID', label: 'Amazon Seller ID', help: 'Twoj Amazon Seller ID (np. A1XXXXXXXXXXXX)' }
  ];

  var updated = 0;
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var current = props.getProperty(field.key);
    var currentDisplay = current ? 'Obecna wartosc: ' + current.substring(0, 15) + '...' : 'Brak wartosci';

    var result = ui.prompt(
      'Domain Finder: ' + field.label,
      field.help + '\n\n' + currentDisplay + '\n\nWpisz nowa wartosc (lub zostaw puste aby pominac):',
      ui.ButtonSet.OK_CANCEL
    );

    if (result.getSelectedButton() !== ui.Button.OK) break;

    var value = result.getResponseText().trim();
    if (value) {
      props.setProperty(field.key, value);
      updated++;
    }
  }

  if (updated > 0) {
    ui.alert('Konfiguracja', 'Zaktualizowano ' + updated + ' kluczy API.\n\nMozesz teraz uruchomic test z menu.', ui.ButtonSet.OK);
  } else {
    ui.alert('Konfiguracja', 'Nie zaktualizowano zadnych kluczy.', ui.ButtonSet.OK);
  }
}

// ==================== TOKEN MANAGEMENT ====================

/**
 * Get SP-API access token with caching (5-min buffer)
 * Reuses existing spGetAccessToken from SPApiAuth-WAAS.gs if available,
 * otherwise uses standalone implementation.
 */
function dsfGetSpApiToken() {
  var props = PropertiesService.getScriptProperties();

  // Check cache first
  var cachedToken = props.getProperty('SP_ACCESS_TOKEN');
  var cachedExpiry = props.getProperty('SP_TOKEN_EXPIRY');

  if (cachedToken && cachedExpiry) {
    var expiryTime = parseInt(cachedExpiry, 10);
    if (Date.now() < expiryTime - (5 * 60 * 1000)) {
      return cachedToken;
    }
  }

  var clientId = props.getProperty('SP_LWA_CLIENT_ID');
  var clientSecret = props.getProperty('SP_LWA_CLIENT_SECRET');
  var refreshToken = props.getProperty('SP_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('SP-API credentials not configured. Run: Domain Finder > Konfiguruj API Keys');
  }

  var url = 'https://api.amazon.com/auth/o2/token';
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    var errorMsg = 'Token refresh failed (HTTP ' + code + ')';
    try {
      var err = JSON.parse(body);
      errorMsg = err.error_description || err.error || errorMsg;
    } catch (e) {
      errorMsg = body.substring(0, 300) || errorMsg;
    }
    throw new Error(errorMsg);
  }

  var tokens = JSON.parse(body);
  props.setProperty('SP_ACCESS_TOKEN', tokens.access_token);
  props.setProperty('SP_TOKEN_EXPIRY', (Date.now() + (tokens.expires_in * 1000)).toString());

  Logger.log('[DSF] SP-API token refreshed');
  return tokens.access_token;
}

// ==================== TRIGGER ====================

/**
 * Installable onEdit trigger — fires when checkbox in column F (INPUT sheet) is checked
 */
function dsfOnEditInstallable(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== 'INPUT') return;

    var range = e.range;
    var col = range.getColumn();
    var row = range.getRow();

    // Column F = 6, must be TRUE, must be row >= 2
    if (col !== 6 || row < 2) return;
    if (range.getValue() !== true) return;

    // Read row data
    var rowData = sheet.getRange(row, 1, 1, 4).getValues()[0];
    var type = (rowData[0] || '').toString().trim().toUpperCase();
    var value = (rowData[1] || '').toString().trim();
    var market = (rowData[2] || 'DE').toString().trim().toUpperCase();
    var rootDomain = (rowData[3] || 'lk24.shop').toString().trim();

    if (!type || !value) {
      sheet.getRange(row, 5).setValue('ERROR: Brak typu lub wartosci');
      return;
    }

    if (type !== 'ASIN' && type !== 'KEYWORD') {
      sheet.getRange(row, 5).setValue('ERROR: Typ musi byc ASIN lub KEYWORD');
      return;
    }

    // Save job to ScriptProperties
    var job = {
      row: row,
      type: type,
      value: value,
      market: market,
      rootDomain: rootDomain
    };

    var props = PropertiesService.getScriptProperties();
    props.setProperty('DSF_PENDING_JOB', JSON.stringify(job));

    // Update status
    sheet.getRange(row, 5).setValue('PROCESSING');
    sheet.getRange(row, 7).setValue(new Date());
    SpreadsheetApp.flush();

    // Schedule async job
    ScriptApp.newTrigger('dsfRunJob').timeBased().after(500).create();

  } catch (err) {
    Logger.log('[DSF] onEdit error: ' + err.message);
  }
}

// ==================== MAIN PIPELINE ====================

/**
 * Main pipeline — runs asynchronously via time-based trigger
 */
function dsfRunJob() {
  var props = PropertiesService.getScriptProperties();

  // Read and clear pending job (prevents double execution)
  var jobJson = props.getProperty('DSF_PENDING_JOB');
  props.deleteProperty('DSF_PENDING_JOB');

  // Clean up this one-time trigger
  dsfCleanupTrigger_('dsfRunJob');

  if (!jobJson) {
    Logger.log('[DSF] No pending job found');
    return;
  }

  var job;
  try {
    job = JSON.parse(jobJson);
  } catch (e) {
    Logger.log('[DSF] Invalid job JSON: ' + e.message);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 1. Get SP-API token
    var accessToken = dsfGetSpApiToken();

    // 2. Fetch product data from SP API
    var spData, searchPhrase;

    if (job.type === 'ASIN') {
      spData = dsfCallSpApiGetItem(job.value, accessToken);
      searchPhrase = dsfExtractMainPhrase(spData);
      Logger.log('[DSF] ASIN mode, search phrase: ' + searchPhrase);
    } else {
      // KEYWORD mode
      spData = dsfCallSpApiSearch(job.value, accessToken);
      searchPhrase = job.value;
      Logger.log('[DSF] KEYWORD mode, search phrase: ' + searchPhrase);
    }

    Utilities.sleep(500);

    // 3. Amazon DE Autocomplete
    var amazonSuggestions = dsfGetAmazonAutocomplete(searchPhrase);
    Logger.log('[DSF] Amazon suggestions: ' + amazonSuggestions.length);

    // 4. Google DE Autocomplete
    var googleSuggestions = dsfGetGoogleAutocomplete(searchPhrase);
    Logger.log('[DSF] Google suggestions: ' + googleSuggestions.length);

    Utilities.sleep(300);

    // 5. Claude Call 1 — Niche Analysis
    var analysisData = dsfCallClaudeAnalysis(spData, amazonSuggestions, googleSuggestions);
    Logger.log('[DSF] Analysis complete, keys: ' + Object.keys(analysisData).length);

    Utilities.sleep(500);

    // 6. Claude Call 2 — Slug Generation
    var slugsData = dsfCallClaudeSlugs(analysisData);
    Logger.log('[DSF] Slugs generated: ' + slugsData.length);

    Utilities.sleep(300);

    // 7. DENIC Check for top 3 slugs
    var denicResults = {};
    if (slugsData.length > 0) {
      var topSlugs = slugsData.slice(0, 3).map(function(s) { return s.slug; });
      denicResults = dsfCheckDenicForTopSlugs(topSlugs);
      Logger.log('[DSF] DENIC results: ' + JSON.stringify(denicResults));
    }

    Utilities.sleep(300);

    // 8. Search additional ASINs for the website using top slug's test phrase
    var additionalAsins = [];
    if (slugsData.length > 0 && slugsData[0].amazon_test_phrase) {
      var topPhrase = slugsData[0].amazon_test_phrase;
      additionalAsins = dsfCallSpApiSearchForAsins(topPhrase, accessToken);
      Logger.log('[DSF] Additional ASINs found: ' + additionalAsins.length);
    }

    // 9. Save all results to sheets
    dsfSaveResultsToSheets(job.row, job.value, analysisData, slugsData, denicResults, additionalAsins, job.rootDomain);

    // 10. Update INPUT status to DONE
    var topSlug = slugsData.length > 0 ? slugsData[0].slug : '';
    var topScore = slugsData.length > 0 ? slugsData[0].score_total : 0;
    dsfUpdateInputStatus(job.row, 'DONE', topSlug, topScore);

    ss.toast('Pipeline zakonczony! Top slug: ' + topSlug + ' (score: ' + topScore + '/7)', 'Domain Finder', 15);

  } catch (err) {
    Logger.log('[DSF] Pipeline error: ' + err.message + '\n' + err.stack);
    dsfUpdateInputStatus(job.row, 'ERROR', '', 0, err.message);
    ss.toast('Blad: ' + err.message, 'Domain Finder - ERROR', 15);
  }
}

// ==================== SP API CALLS ====================

/**
 * Fetch single product by ASIN from SP API Catalog Items
 */
function dsfCallSpApiGetItem(asin, token) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items/' + asin +
    '?marketplaceIds=' + DSF_MARKETPLACE_ID +
    '&includedData=attributes,classifications,identifiers,images,productTypes,salesRanks,summaries';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-amz-access-token': token },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 404 || code === 400) {
    throw new Error('ASIN not found on amazon.de: ' + asin);
  }

  if (code === 429) {
    Logger.log('[DSF] SP-API rate limited, retrying in 2s...');
    Utilities.sleep(2000);
    response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-amz-access-token': token },
      muteHttpExceptions: true
    });
    code = response.getResponseCode();
    body = response.getContentText();
  }

  if (code !== 200) {
    throw new Error('SP-API Error ' + code + ': ' + body.substring(0, 300));
  }

  var data = JSON.parse(body);

  // Extract key fields
  var summaries = data.summaries || [];
  var summary = summaries[0] || {};
  var attributes = data.attributes || {};
  var salesRanks = data.salesRanks || [];
  var classifications = data.classifications || [];
  var images = data.images || [];

  // Title
  var title = summary.itemName || '';

  // Brand
  var brand = summary.brand || '';
  if (!brand && attributes.brand && attributes.brand[0]) {
    brand = attributes.brand[0].value || '';
  }

  // Category / Browse Node
  var categoryName = '';
  var browseNodeName = '';
  if (summary.browseClassification) {
    categoryName = summary.browseClassification.displayName || '';
    browseNodeName = summary.browseClassification.displayName || '';
  }
  if (!categoryName && classifications.length > 0) {
    var classGroup = classifications[0];
    var nodes = classGroup.classifications || [];
    if (nodes.length > 0) {
      categoryName = nodes[0].displayName || '';
      browseNodeName = nodes[0].displayName || '';
    }
  }

  // BSR
  var bsrRank = '';
  var bsrCategory = '';
  for (var i = 0; i < salesRanks.length; i++) {
    if (salesRanks[i].marketplaceId === DSF_MARKETPLACE_ID) {
      var classRanks = salesRanks[i].classificationRanks || [];
      if (classRanks.length > 0) {
        bsrRank = classRanks[0].rank || '';
        bsrCategory = classRanks[0].title || '';
      }
      if (!bsrRank) {
        var displayRanks = salesRanks[i].displayGroupRanks || [];
        if (displayRanks.length > 0) {
          bsrRank = displayRanks[0].rank || '';
          bsrCategory = displayRanks[0].title || '';
        }
      }
      break;
    }
  }

  // Bullet points
  var bulletPoints = [];
  if (attributes.bullet_point) {
    for (var b = 0; b < attributes.bullet_point.length; b++) {
      var bp = attributes.bullet_point[b].value || '';
      if (bp) bulletPoints.push(bp);
    }
  }

  // Price
  var price = '';
  var currency = 'EUR';
  if (attributes.list_price && attributes.list_price[0]) {
    var priceData = attributes.list_price[0];
    if (priceData.value_with_tax !== undefined) {
      var rawVal = priceData.value_with_tax;
      price = (Number.isInteger(rawVal) && rawVal > 100) ?
        (rawVal / 100).toFixed(2) : parseFloat(rawVal).toFixed(2);
    } else if (priceData.value) {
      price = priceData.value.toString();
    }
    currency = priceData.currency || 'EUR';
  }

  // Primary image
  var mainImage = '';
  if (images.length > 0 && images[0].images) {
    var imgList = images[0].images;
    var mainImgObj = imgList.find(function(img) { return img.variant === 'MAIN'; }) || imgList[0];
    mainImage = mainImgObj ? mainImgObj.link || '' : '';
  }

  // Product type
  var productType = '';
  if (data.productTypes && data.productTypes[0]) {
    productType = data.productTypes[0].productType || '';
  }

  return {
    asin: asin,
    title: title,
    brand: brand,
    categoryName: categoryName,
    browseNodeName: browseNodeName,
    bsrRank: bsrRank,
    bsrCategory: bsrCategory,
    bulletPoints: bulletPoints,
    price: price,
    currency: currency,
    mainImage: mainImage,
    productType: productType,
    rawAttributes: attributes,
    rawSummary: summary
  };
}

/**
 * Search products by keyword via SP API (returns summary data for analysis)
 */
function dsfCallSpApiSearch(keywords, token) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items' +
    '?keywords=' + encodeURIComponent(keywords) +
    '&marketplaceIds=' + DSF_MARKETPLACE_ID +
    '&pageSize=20' +
    '&includedData=attributes,classifications,identifiers,images,salesRanks,summaries';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-amz-access-token': token },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 429) {
    Utilities.sleep(2000);
    response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-amz-access-token': token },
      muteHttpExceptions: true
    });
    code = response.getResponseCode();
    body = response.getContentText();
  }

  if (code !== 200) {
    throw new Error('SP-API Search Error ' + code + ': ' + body.substring(0, 300));
  }

  var data = JSON.parse(body);
  var items = data.items || [];

  if (items.length === 0) {
    throw new Error('No products found for keyword: ' + keywords);
  }

  // Aggregate data from top results
  var titles = [];
  var categories = [];
  var bulletPoints = [];
  var brands = [];

  for (var i = 0; i < Math.min(items.length, 10); i++) {
    var item = items[i];
    var summary = (item.summaries || [])[0] || {};
    if (summary.itemName) titles.push(summary.itemName);
    if (summary.brand) brands.push(summary.brand);
    if (summary.browseClassification && summary.browseClassification.displayName) {
      categories.push(summary.browseClassification.displayName);
    }
    var attrs = item.attributes || {};
    if (attrs.bullet_point) {
      for (var b = 0; b < Math.min(attrs.bullet_point.length, 3); b++) {
        if (attrs.bullet_point[b].value) bulletPoints.push(attrs.bullet_point[b].value);
      }
    }
  }

  // Build aggregated product data object
  var topItem = items[0];
  var topSummary = (topItem.summaries || [])[0] || {};

  return {
    asin: topItem.asin || '',
    title: topSummary.itemName || '',
    brand: topSummary.brand || '',
    categoryName: categories.length > 0 ? categories[0] : '',
    browseNodeName: categories.length > 0 ? categories[0] : '',
    bsrRank: '',
    bsrCategory: '',
    bulletPoints: bulletPoints.slice(0, 10),
    price: '',
    currency: 'EUR',
    mainImage: '',
    productType: '',
    searchKeyword: keywords,
    topTitles: titles.slice(0, 5),
    topBrands: brands.slice(0, 5),
    topCategories: categories.slice(0, 5),
    totalResults: items.length
  };
}

/**
 * Search ASINs for the website (simpler call, returns ASIN details for ASINS tab)
 */
function dsfCallSpApiSearchForAsins(keywords, token) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items' +
    '?keywords=' + encodeURIComponent(keywords) +
    '&marketplaceIds=' + DSF_MARKETPLACE_ID +
    '&pageSize=20' +
    '&includedData=attributes,classifications,images,salesRanks,summaries';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-amz-access-token': token },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    Logger.log('[DSF] ASIN search failed: HTTP ' + code);
    return [];
  }

  var data = JSON.parse(response.getContentText());
  var items = data.items || [];
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var summary = (item.summaries || [])[0] || {};
    var salesRanks = item.salesRanks || [];
    var attrs = item.attributes || {};

    // BSR
    var bsrRank = '';
    var bsrCategory = '';
    for (var r = 0; r < salesRanks.length; r++) {
      if (salesRanks[r].marketplaceId === DSF_MARKETPLACE_ID) {
        var classRanks = salesRanks[r].classificationRanks || [];
        if (classRanks.length > 0) {
          bsrRank = classRanks[0].rank || '';
          bsrCategory = classRanks[0].title || '';
        }
        break;
      }
    }

    // Price
    var price = '';
    if (attrs.list_price && attrs.list_price[0]) {
      var pd = attrs.list_price[0];
      if (pd.value_with_tax !== undefined) {
        var rv = pd.value_with_tax;
        price = (Number.isInteger(rv) && rv > 100) ? (rv / 100).toFixed(2) : parseFloat(rv).toFixed(2);
      } else if (pd.value) {
        price = pd.value.toString();
      }
    }

    // Image
    var imgUrl = '';
    var imageGroups = item.images || [];
    if (imageGroups.length > 0 && imageGroups[0].images) {
      var mainImg = imageGroups[0].images.find(function(img) { return img.variant === 'MAIN'; });
      imgUrl = mainImg ? mainImg.link || '' : (imageGroups[0].images[0] ? imageGroups[0].images[0].link || '' : '');
    }

    // Category
    var category = '';
    if (summary.browseClassification) {
      category = summary.browseClassification.displayName || '';
    }

    results.push({
      asin: item.asin,
      title: summary.itemName || '',
      price: price,
      category: category,
      bsrRank: bsrRank,
      bsrCategory: bsrCategory,
      imageUrl: imgUrl
    });
  }

  return results;
}

/**
 * Extract main search phrase from SP API data
 * Priority: CategoryName > BrowseNodeDisplayName > first 2-3 words of Title
 */
function dsfExtractMainPhrase(spData) {
  if (spData.categoryName) {
    return spData.categoryName;
  }
  if (spData.browseNodeName) {
    return spData.browseNodeName;
  }
  if (spData.title) {
    var words = spData.title.split(/\s+/);
    // Skip brand name if it's the first word
    var startIdx = 0;
    if (spData.brand && words[0] && words[0].toLowerCase() === spData.brand.toLowerCase()) {
      startIdx = 1;
    }
    return words.slice(startIdx, startIdx + 3).join(' ');
  }
  return '';
}

// ==================== AUTOCOMPLETE ====================

/**
 * Get Amazon DE autocomplete suggestions
 */
function dsfGetAmazonAutocomplete(phrase) {
  if (!phrase) return [];

  try {
    var url = 'https://completion.amazon.de/api/2017/suggestions' +
      '?limit=10' +
      '&prefix=' + encodeURIComponent(phrase) +
      '&mid=' + DSF_MARKETPLACE_ID +
      '&alias=aps';

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log('[DSF] Amazon autocomplete failed: HTTP ' + code);
      return [];
    }

    var data = JSON.parse(response.getContentText());
    var suggestions = data.suggestions || [];
    return suggestions.map(function(s) { return s.value || ''; }).filter(function(s) { return s; });

  } catch (e) {
    Logger.log('[DSF] Amazon autocomplete error: ' + e.message);
    return [];
  }
}

/**
 * Get Google DE autocomplete suggestions
 */
function dsfGetGoogleAutocomplete(phrase) {
  if (!phrase) return [];

  try {
    var url = 'https://suggestqueries.google.com/complete/search' +
      '?output=toolbar' +
      '&q=' + encodeURIComponent(phrase + ' kaufen') +
      '&hl=de&gl=de';

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log('[DSF] Google autocomplete failed: HTTP ' + code);
      return [];
    }

    var xmlText = response.getContentText();
    var doc = XmlService.parse(xmlText);
    var root = doc.getRootElement();
    var completions = root.getChildren('CompleteSuggestion');
    var results = [];

    for (var i = 0; i < completions.length; i++) {
      var suggestion = completions[i].getChild('suggestion');
      if (suggestion) {
        var data = suggestion.getAttribute('data');
        if (data) results.push(data.getValue());
      }
    }

    return results;

  } catch (e) {
    Logger.log('[DSF] Google autocomplete error: ' + e.message);
    return [];
  }
}

// ==================== CLAUDE API ====================

/**
 * Claude Call 1: Niche Analysis
 */
function dsfCallClaudeAnalysis(spData, amazonSugg, googleSugg) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured. Run: Domain Finder > Konfiguruj API Keys');
  }

  // Build user prompt
  var userPrompt = DSF_USER_PROMPT_ANALYSIS
    .replace('{SP_DATA}', JSON.stringify(spData, null, 2))
    .replace('{AMAZON_SUGGESTIONS}', JSON.stringify(amazonSugg))
    .replace('{GOOGLE_SUGGESTIONS}', JSON.stringify(googleSugg));

  var payload = {
    model: DSF_CLAUDE_MODEL,
    max_tokens: 4000,
    system: DSF_SYSTEM_PROMPT_ANALYSIS,
    messages: [{ role: 'user', content: userPrompt }]
  };

  var result = dsfCallClaudeApi_(apiKey, payload);

  // Parse JSON response
  var parsed = dsfParseClaudeJson_(result);
  if (!parsed) {
    // Retry once
    Logger.log('[DSF] Claude analysis JSON parse failed, retrying...');
    Utilities.sleep(1000);
    result = dsfCallClaudeApi_(apiKey, payload);
    parsed = dsfParseClaudeJson_(result);
    if (!parsed) {
      throw new Error('Claude analysis returned invalid JSON after retry');
    }
  }

  return parsed;
}

/**
 * Claude Call 2: Slug Generation
 */
function dsfCallClaudeSlugs(analysisData) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  var userPrompt = DSF_USER_PROMPT_SLUGS
    .replace('{ANALYSIS_DATA}', JSON.stringify(analysisData, null, 2));

  var payload = {
    model: DSF_CLAUDE_MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: userPrompt }]
  };

  var result = dsfCallClaudeApi_(apiKey, payload);
  var parsed = dsfParseClaudeJson_(result);

  if (!parsed) {
    Logger.log('[DSF] Claude slugs JSON parse failed, retrying...');
    Utilities.sleep(1000);
    result = dsfCallClaudeApi_(apiKey, payload);
    parsed = dsfParseClaudeJson_(result);
    if (!parsed) {
      throw new Error('Claude slugs returned invalid JSON after retry');
    }
  }

  // Ensure it's an array
  var slugsArray = Array.isArray(parsed) ? parsed : [parsed];

  // Normalize slugs and sort
  for (var i = 0; i < slugsArray.length; i++) {
    if (slugsArray[i].slug) {
      slugsArray[i].slug = dsfNormalizeSlug(slugsArray[i].slug);
    }
    if (typeof slugsArray[i].score_total !== 'number') {
      // Count true values in score_criteria
      var criteria = slugsArray[i].score_criteria || [];
      var total = 0;
      for (var c = 0; c < criteria.length; c++) {
        if (criteria[c] === true) total++;
      }
      slugsArray[i].score_total = total;
    }
  }

  // Sort by score_total descending
  slugsArray.sort(function(a, b) { return (b.score_total || 0) - (a.score_total || 0); });

  return slugsArray;
}

/**
 * Internal: Call Claude API
 */
function dsfCallClaudeApi_(apiKey, payload) {
  var response = UrlFetchApp.fetch(DSF_CLAUDE_API_URL, {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': DSF_ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    var errMsg = 'Claude API Error ' + code;
    try {
      var err = JSON.parse(body);
      errMsg = err.error?.message || err.message || errMsg;
    } catch (e) {
      errMsg = body.substring(0, 300);
    }
    throw new Error(errMsg);
  }

  var data = JSON.parse(body);
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Claude API returned empty response');
  }

  return data.content[0].text;
}

/**
 * Internal: Parse JSON from Claude response (handles markdown code blocks)
 */
function dsfParseClaudeJson_(text) {
  if (!text) return null;

  // Strip markdown code blocks if present
  var cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log('[DSF] JSON parse error: ' + e.message + '\nText: ' + cleaned.substring(0, 200));
    return null;
  }
}

// ==================== SLUG NORMALIZATION ====================

/**
 * Normalize slug: ä→ae, ö→oe, ü→ue, ß→ss, lowercase, only a-z0-9-, max 40 chars
 */
function dsfNormalizeSlug(text) {
  if (!text) return '';

  var slug = text.toLowerCase();

  // German umlaut conversions
  slug = slug.replace(/ä/g, 'ae');
  slug = slug.replace(/ö/g, 'oe');
  slug = slug.replace(/ü/g, 'ue');
  slug = slug.replace(/ß/g, 'ss');

  // Replace spaces and underscores with hyphens
  slug = slug.replace(/[\s_]+/g, '-');

  // Remove anything that's not a-z, 0-9, or hyphen
  slug = slug.replace(/[^a-z0-9-]/g, '');

  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, '-');

  // Trim hyphens from start/end
  slug = slug.replace(/^-+|-+$/g, '');

  // Max 40 chars
  if (slug.length > 40) {
    slug = slug.substring(0, 40).replace(/-+$/, '');
  }

  return slug;
}

// ==================== DENIC CHECK ====================

/**
 * Check DENIC RDAP for domain availability (informational only)
 */
function dsfCheckDenicForTopSlugs(slugs) {
  var results = {};

  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    try {
      var url = 'https://rdap.denic.de/domain/' + slug + '.de';
      var response = UrlFetchApp.fetch(url, {
        method: 'head',
        muteHttpExceptions: true,
        followRedirects: true
      });

      var code = response.getResponseCode();
      if (code === 404) {
        results[slug] = 'FREE';
      } else if (code === 200) {
        results[slug] = 'TAKEN';
      } else {
        results[slug] = 'UNKNOWN';
      }

      Utilities.sleep(300);
    } catch (e) {
      Logger.log('[DSF] DENIC check failed for ' + slug + ': ' + e.message);
      results[slug] = 'UNKNOWN';
    }
  }

  return results;
}

// ==================== SHEETS MANAGEMENT ====================

/**
 * Ensure all required sheets exist with proper headers
 */
function dsfEnsureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // INPUT sheet
  var inputSheet = ss.getSheetByName('INPUT');
  if (!inputSheet) {
    inputSheet = ss.insertSheet('INPUT');
    inputSheet.getRange(1, 1, 1, 11).setValues([[
      'Typ', 'Wartosc', 'Rynek', 'Root Domain', 'Status',
      'Trigger', 'Timestamp zlecenia', 'Timestamp ukonczenia',
      'Top Slug', 'Score', 'Error'
    ]]);
    // Set column F as checkboxes for data rows
    inputSheet.getRange('F2:F100').insertCheckboxes();
    // Set defaults
    inputSheet.getRange('C2:C100').setValue('DE');
    inputSheet.getRange('D2:D100').setValue('lk24.shop');
    // Format header
    inputSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    inputSheet.setFrozenRows(1);
    inputSheet.setColumnWidth(1, 80);
    inputSheet.setColumnWidth(2, 200);
    inputSheet.setColumnWidth(5, 120);
    inputSheet.setColumnWidth(9, 200);
  }

  // ANALYSIS sheet
  var analysisSheet = ss.getSheetByName('ANALYSIS');
  if (!analysisSheet) {
    analysisSheet = ss.insertSheet('ANALYSIS');
    analysisSheet.getRange(1, 1, 1, 16).setValues([[
      'INPUT_Row', 'ASIN/Keyword', 'needs_and_problems', 'buyer_personas',
      'frequent_words', 'keyword_candidates', 'usage_situations',
      'search_triggers', 'search_questions', 'tips_topics', 'dont_do_topics',
      'influencers_de', 'blogs_articles_de', 'top_shops_de', 'cultural_context',
      'Timestamp'
    ]]);
    analysisSheet.getRange(1, 1, 1, 16).setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
    analysisSheet.setFrozenRows(1);
  }

  // SLUGS sheet
  var slugsSheet = ss.getSheetByName('SLUGS');
  if (!slugsSheet) {
    slugsSheet = ss.insertSheet('SLUGS');
    slugsSheet.getRange(1, 1, 1, 21).setValues([[
      'INPUT_Row', 'full_subdomain', 'slug', 'root_domain', 'type',
      'rationale_de', 'rationale_pl', 'amazon_test_phrase', 'score_total',
      'criteria_1', 'criteria_2', 'criteria_3', 'criteria_4',
      'criteria_5', 'criteria_6', 'criteria_7',
      'content_topics', 'suggested_url_slugs', 'de_domain_status',
      'status', 'Timestamp'
    ]]);
    slugsSheet.getRange(1, 1, 1, 21).setFontWeight('bold').setBackground('#fbbc04').setFontColor('#000000');
    slugsSheet.setFrozenRows(1);
    slugsSheet.setColumnWidth(2, 250);
    slugsSheet.setColumnWidth(6, 300);
    slugsSheet.setColumnWidth(7, 300);
  }

  // ASINS sheet
  var asinsSheet = ss.getSheetByName('ASINS');
  if (!asinsSheet) {
    asinsSheet = ss.insertSheet('ASINS');
    asinsSheet.getRange(1, 1, 1, 11).setValues([[
      'INPUT_Row', 'Target_Slug', 'ASIN', 'Title', 'Price (EUR)',
      'Category', 'BSR_rank', 'BSR_category', 'Image_URL',
      'Product_URL', 'Timestamp'
    ]]);
    asinsSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#ea4335').setFontColor('#ffffff');
    asinsSheet.setFrozenRows(1);
    asinsSheet.setColumnWidth(4, 300);
  }
}

/**
 * Save all results to respective sheets
 */
function dsfSaveResultsToSheets(inputRow, inputValue, analysis, slugs, denicResults, asins, rootDomain) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();

  // Ensure sheets exist
  dsfEnsureSheets_();

  // --- ANALYSIS sheet ---
  var analysisSheet = ss.getSheetByName('ANALYSIS');
  analysisSheet.appendRow([
    inputRow,
    inputValue,
    JSON.stringify(analysis.needs_and_problems || []),
    JSON.stringify(analysis.buyer_personas || []),
    JSON.stringify(analysis.frequent_words || []),
    JSON.stringify(analysis.keyword_candidates || []),
    JSON.stringify(analysis.usage_situations || []),
    JSON.stringify(analysis.search_triggers || []),
    JSON.stringify(analysis.search_questions || []),
    JSON.stringify(analysis.tips_topics || []),
    JSON.stringify(analysis.dont_do_topics || []),
    JSON.stringify(analysis.influencers_de || []),
    JSON.stringify(analysis.blogs_articles_de || []),
    JSON.stringify(analysis.top_shops_de || []),
    JSON.stringify(analysis.cultural_context || []),
    now
  ]);

  // --- SLUGS sheet ---
  var slugsSheet = ss.getSheetByName('SLUGS');
  for (var i = 0; i < slugs.length; i++) {
    var s = slugs[i];
    var criteria = s.score_criteria || [];
    var fullSubdomain = (s.slug || '') + '.' + rootDomain;
    var deStatus = denicResults[s.slug] || 'UNKNOWN';

    slugsSheet.appendRow([
      inputRow,
      fullSubdomain,
      s.slug || '',
      rootDomain,
      s.type || '',
      s.rationale_de || '',
      s.rationale_pl || '',
      s.amazon_test_phrase || '',
      s.score_total || 0,
      criteria[0] === true ? 'TRUE' : 'FALSE',
      criteria[1] === true ? 'TRUE' : 'FALSE',
      criteria[2] === true ? 'TRUE' : 'FALSE',
      criteria[3] === true ? 'TRUE' : 'FALSE',
      criteria[4] === true ? 'TRUE' : 'FALSE',
      criteria[5] === true ? 'TRUE' : 'FALSE',
      criteria[6] === true ? 'TRUE' : 'FALSE',
      JSON.stringify(s.content_topics || []),
      JSON.stringify(s.suggested_url_slugs || []),
      deStatus,
      'IDEA',
      now
    ]);
  }

  // --- ASINS sheet ---
  var asinsSheet = ss.getSheetByName('ASINS');
  var targetSlug = slugs.length > 0 ? slugs[0].slug : '';

  for (var j = 0; j < asins.length; j++) {
    var a = asins[j];
    asinsSheet.appendRow([
      inputRow,
      targetSlug,
      a.asin || '',
      a.title || '',
      a.price || '',
      a.category || '',
      a.bsrRank || '',
      a.bsrCategory || '',
      a.imageUrl || '',
      'https://www.amazon.de/dp/' + (a.asin || ''),
      now
    ]);
  }

  SpreadsheetApp.flush();
}

/**
 * Update INPUT sheet status for a given row
 */
function dsfUpdateInputStatus(row, status, topSlug, topScore, errorMsg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('INPUT');
  if (!sheet) return;

  // Column E = Status
  sheet.getRange(row, 5).setValue(status);
  // Column H = Timestamp ukonczenia
  sheet.getRange(row, 8).setValue(new Date());

  if (topSlug) {
    // Column I = Top slug
    sheet.getRange(row, 9).setValue(topSlug);
  }
  if (topScore !== undefined && topScore !== null) {
    // Column J = Score
    sheet.getRange(row, 10).setValue(topScore);
  }
  if (errorMsg) {
    // Column K = Error message
    sheet.getRange(row, 11).setValue(errorMsg);
  }

  // Uncheck the trigger checkbox (Column F)
  sheet.getRange(row, 6).setValue(false);

  SpreadsheetApp.flush();
}

// ==================== MANUAL & TEST FUNCTIONS ====================

/**
 * Run pipeline manually for the active row in INPUT sheet
 */
function dsfRunManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  if (sheet.getName() !== 'INPUT') {
    SpreadsheetApp.getUi().alert('Przejdz do zakladki INPUT i wybierz wiersz do przetworzenia.');
    return;
  }

  var row = sheet.getActiveCell().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Wybierz wiersz z danymi (wiersz 2+).');
    return;
  }

  var rowData = sheet.getRange(row, 1, 1, 4).getValues()[0];
  var type = (rowData[0] || '').toString().trim().toUpperCase();
  var value = (rowData[1] || '').toString().trim();
  var market = (rowData[2] || 'DE').toString().trim().toUpperCase();
  var rootDomain = (rowData[3] || 'lk24.shop').toString().trim();

  if (!type || !value) {
    SpreadsheetApp.getUi().alert('Wiersz ' + row + ' nie ma wypelnionych kolumn Typ i Wartosc.');
    return;
  }

  // Set up job and run directly
  var props = PropertiesService.getScriptProperties();
  var job = {
    row: row,
    type: type,
    value: value,
    market: market,
    rootDomain: rootDomain
  };

  props.setProperty('DSF_PENDING_JOB', JSON.stringify(job));
  sheet.getRange(row, 5).setValue('PROCESSING');
  sheet.getRange(row, 7).setValue(new Date());
  SpreadsheetApp.flush();

  ss.toast('Pipeline uruchomiony dla wiersza ' + row + '...', 'Domain Finder', 30);

  // Run directly (not via trigger, since it's manual)
  dsfRunJob();
}

/**
 * Quick test with ASIN B0FRG79LF9 (WERHE Stichsaegeblaetter)
 */
function dsfRunTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Ensure sheets exist
  dsfEnsureSheets_();

  var inputSheet = ss.getSheetByName('INPUT');
  var lastRow = inputSheet.getLastRow();
  var testRow = lastRow + 1;

  // Insert test row
  inputSheet.getRange(testRow, 1, 1, 4).setValues([['ASIN', 'B0FRG79LF9', 'DE', 'lk24.shop']]);
  inputSheet.getRange(testRow, 6).insertCheckboxes();
  inputSheet.getRange(testRow, 6).setValue(false);

  // Set up job and run
  var props = PropertiesService.getScriptProperties();
  var job = {
    row: testRow,
    type: 'ASIN',
    value: 'B0FRG79LF9',
    market: 'DE',
    rootDomain: 'lk24.shop'
  };

  props.setProperty('DSF_PENDING_JOB', JSON.stringify(job));
  inputSheet.getRange(testRow, 5).setValue('PROCESSING');
  inputSheet.getRange(testRow, 7).setValue(new Date());
  SpreadsheetApp.flush();

  ss.toast('Test uruchomiony z ASIN B0FRG79LF9...', 'Domain Finder', 60);

  dsfRunJob();
}

// ==================== TEST CONNECTION FUNCTIONS ====================

/**
 * Test SP-API connection
 */
function dsfTestSpApi() {
  var ui = SpreadsheetApp.getUi();

  try {
    var token = dsfGetSpApiToken();

    var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items' +
      '?keywords=test&marketplaceIds=' + DSF_MARKETPLACE_ID + '&pageSize=1&includedData=summaries';

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-amz-access-token': token },
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();

    if (code === 200) {
      ui.alert('SP-API Test', 'Polaczenie dziala!\n\nHTTP 200 OK\nMarketplace: DE (' + DSF_MARKETPLACE_ID + ')', ui.ButtonSet.OK);
    } else {
      ui.alert('SP-API Test', 'Blad: HTTP ' + code + '\n\n' + response.getContentText().substring(0, 300), ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('SP-API Test', 'Blad: ' + e.message, ui.ButtonSet.OK);
  }
}

/**
 * Test Claude API connection
 */
function dsfTestClaude() {
  var ui = SpreadsheetApp.getUi();

  try {
    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('CLAUDE_API_KEY');

    if (!apiKey) {
      ui.alert('Claude Test', 'CLAUDE_API_KEY nie jest skonfigurowany.\nUruchom: Domain Finder > Konfiguruj API Keys', ui.ButtonSet.OK);
      return;
    }

    var payload = {
      model: DSF_CLAUDE_MODEL,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Antworte mit: "OK"' }]
    };

    var result = dsfCallClaudeApi_(apiKey, payload);

    ui.alert('Claude Test', 'Polaczenie dziala!\n\nModel: ' + DSF_CLAUDE_MODEL + '\nOdpowiedz: ' + result.substring(0, 100), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Claude Test', 'Blad: ' + e.message, ui.ButtonSet.OK);
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Clean up one-time triggers by handler function name
 */
function dsfCleanupTrigger_(handlerName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handlerName &&
        triggers[i].getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
