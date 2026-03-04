/**
 * LUKO Domain Slug Finder v3.0
 * Automatyczne znajdowanie optymalnych nazw poddomeny dla niszowych stron afiliacyjnych Amazon EU.
 *
 * Stack: Google Sheets + Apps Script + SP API + Claude API + Autocomplete + DENIC
 * Architektura: 100% Google, zero n8n
 *
 * Flow: Zaznacz checkboxy w INPUT → Menu → Uruchom zaznaczone wiersze → kolejka z auto-wznowieniem
 * Wspierane rynki: DE, FR, IT, ES, UK, NL, BE, PL, SE, IE
 * Wszystkie analizy + tłumaczenia PL w jednym callu Claude.
 *
 * @version 3.0
 * @author NetAnaliza / LUKO (Lukasz Koronczok)
 */

// ==================== CONSTANTS ====================

var DSF_SP_ENDPOINT = 'https://sellingpartnerapi-eu.amazon.com';
var DSF_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
var DSF_CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
var DSF_ANTHROPIC_VERSION = '2023-06-01';

// ==================== MARKETPLACE MAP ====================

var DSF_MARKETPLACES = {
  'DE': { id: 'A1PA6795UKMFR9',  domain: 'amazon.de',      autocomplete: 'completion.amazon.de',      lang: 'de', langName: 'Deutsch',    glParam: 'de', hlParam: 'de' },
  'FR': { id: 'A13V1IB3VIYZZH',  domain: 'amazon.fr',      autocomplete: 'completion.amazon.fr',      lang: 'fr', langName: 'Français',   glParam: 'fr', hlParam: 'fr' },
  'IT': { id: 'APJ6JRA9NG5V4',   domain: 'amazon.it',      autocomplete: 'completion.amazon.it',      lang: 'it', langName: 'Italiano',   glParam: 'it', hlParam: 'it' },
  'ES': { id: 'A1RKKUPIHCS9HS',  domain: 'amazon.es',      autocomplete: 'completion.amazon.es',      lang: 'es', langName: 'Español',    glParam: 'es', hlParam: 'es' },
  'UK': { id: 'A1F83G8C2ARO7P',  domain: 'amazon.co.uk',   autocomplete: 'completion.amazon.co.uk',   lang: 'en', langName: 'English',    glParam: 'gb', hlParam: 'en' },
  'NL': { id: 'A1805IZSGTT6HS',  domain: 'amazon.nl',      autocomplete: 'completion.amazon.nl',      lang: 'nl', langName: 'Nederlands', glParam: 'nl', hlParam: 'nl' },
  'BE': { id: 'AMEN7PMS3EDWL',   domain: 'amazon.com.be',  autocomplete: 'completion.amazon.com.be',  lang: 'fr', langName: 'Français',   glParam: 'be', hlParam: 'fr' },
  'PL': { id: 'A1C3SOZRARQ6R3',  domain: 'amazon.pl',      autocomplete: 'completion.amazon.pl',      lang: 'pl', langName: 'Polski',     glParam: 'pl', hlParam: 'pl' },
  'SE': { id: 'A2NODRKZP88ZB9',  domain: 'amazon.se',      autocomplete: 'completion.amazon.se',      lang: 'sv', langName: 'Svenska',    glParam: 'se', hlParam: 'sv' },
  'IE': { id: 'A28R8C7NBKEWEA',  domain: 'amazon.ie',      autocomplete: 'completion.amazon.ie',      lang: 'en', langName: 'English',    glParam: 'ie', hlParam: 'en' }
};

// ==================== CLAUDE PROMPTS (templates — {PLACEHOLDERS} replaced at runtime) ====================

var DSF_SYSTEM_PROMPT_ANALYSIS = 'Du bist ein Experte fuer Amazon-Affiliate-Marketing und SEO fuer den Markt {MARKET_DOMAIN}. '
  + 'Du generierst eine Nischenanalyse AUSSCHLIESSLICH in der Sprache {LANG_NAME} (Sprache des Marktes). '
  + 'ZUSAETZLICH generierst du zu jedem Feld ein Zwillingsfeld mit dem Suffix _pl, das die Uebersetzung ins Polnische enthaelt. '
  + 'Jedes Array-Element wird einzeln uebersetzt — gleiche Anzahl Elemente wie im Original. '
  + 'Antworte NUR mit validem JSON. Kein Kommentar, kein Markdown.';

var DSF_USER_PROMPT_ANALYSIS = 'Analysiere diese Produktdaten von {MARKET_DOMAIN} und generiere folgendes JSON.\n\n'
  + 'PRODUKTDATEN:\n{SP_DATA}\n\n'
  + 'AUTOCOMPLETE-VORSCHLAEGE {MARKET_DOMAIN}:\n{AMAZON_SUGGESTIONS}\n\n'
  + 'AUTOCOMPLETE-VORSCHLAEGE GOOGLE ({LANG_CODE}):\n{GOOGLE_SUGGESTIONS}\n\n'
  + 'Generiere folgende JSON-Struktur. Alle Inhalte in Sprache: {LANG_NAME}.\n'
  + 'Zusaetzlich jedes Feld mit Suffix _pl = Uebersetzung auf Polnisch (gleiche Anzahl Elemente).\n\n'
  + '{\n'
  + '  "needs_and_problems": ["8-12 Beduerfnisse/Probleme in {LANG_NAME}"],\n'
  + '  "needs_and_problems_pl": ["8-12 Beduerfnisse/Probleme auf Polnisch"],\n'
  + '  "buyer_personas": ["3-5 Kaeuferprofile in {LANG_NAME}"],\n'
  + '  "buyer_personas_pl": ["3-5 Kaeuferprofile auf Polnisch"],\n'
  + '  "frequent_words": ["15-25 haeufige Woerter in {LANG_NAME}"],\n'
  + '  "frequent_words_pl": ["15-25 haeufige Woerter auf Polnisch"],\n'
  + '  "keyword_candidates": ["10-20 Schluesselwoerter in {LANG_NAME}"],\n'
  + '  "keyword_candidates_pl": ["10-20 Schluesselwoerter auf Polnisch"],\n'
  + '  "usage_situations": ["6-10 Situationen in {LANG_NAME}"],\n'
  + '  "usage_situations_pl": ["6-10 Situationen auf Polnisch"],\n'
  + '  "search_triggers": ["6-10 Suchtrigger in {LANG_NAME}"],\n'
  + '  "search_triggers_pl": ["6-10 Suchtrigger auf Polnisch"],\n'
  + '  "search_questions": ["8-15 Fragen in {LANG_NAME}"],\n'
  + '  "search_questions_pl": ["8-15 Fragen auf Polnisch"],\n'
  + '  "tips_topics": ["8-12 Ratgeberthemen in {LANG_NAME}"],\n'
  + '  "tips_topics_pl": ["8-12 Ratgeberthemen auf Polnisch"],\n'
  + '  "dont_do_topics": ["5-8 Dont-do-Themen in {LANG_NAME}"],\n'
  + '  "dont_do_topics_pl": ["5-8 Dont-do-Themen auf Polnisch"],\n'
  + '  "influencers": ["3-5 YouTube/Podcasts in {LANG_NAME} — nur wenn sicher bekannt, sonst null"],\n'
  + '  "influencers_pl": ["auf Polnisch"],\n'
  + '  "blogs_articles": ["3-5 Blogs/Portale in {LANG_NAME} — nur wenn sicher bekannt, sonst null"],\n'
  + '  "blogs_articles_pl": ["auf Polnisch"],\n'
  + '  "top_shops": ["5-10 Online-Shops in {LANG_NAME}"],\n'
  + '  "top_shops_pl": ["auf Polnisch"],\n'
  + '  "cultural_context": ["3-5 kulturelle Kontexte in {LANG_NAME}"],\n'
  + '  "cultural_context_pl": ["auf Polnisch"]\n'
  + '}';

var DSF_SYSTEM_PROMPT_SLUGS = 'Du bist ein Experte fuer Domain-Naming und SEO fuer den Markt {MARKET_DOMAIN}. '
  + 'Slugs generierst du in der Sprache {LANG_NAME} — das ist die Marktsprache, nicht Englisch. '
  + 'Fuer FR Slugs auf Franzoesisch, IT auf Italienisch, ES auf Spanisch, usw. '
  + 'AUSNAHME: UK und IE → auf Englisch. '
  + 'Normalisierung: e→e, e→e, e→e, c→c, n→n, ae→ae, oe→oe, ue→ue, ss→ss, o→o, a→a, a→a, e→e, s→s, usw. '
  + 'Zu jedem Textfeld fuegst du ein Zwillingsfeld _pl mit Uebersetzung auf Polnisch hinzu. '
  + 'Antworte NUR mit validem JSON-Array. Kein Kommentar.';

var DSF_USER_PROMPT_SLUGS = 'NISCHENANALYSE:\n{ANALYSIS_DATA}\n\n'
  + 'Schlage 5-8 Subdomain-Slug-Kandidaten fuer eine Amazon-Affiliate-Website auf {MARKET_DOMAIN} vor.\n\n'
  + 'KRITERIEN (alle muessen bewertet werden):\n'
  + '1. Entspricht dem Hauptbeduerfnis/Problem/Loesungsname des Kunden\n'
  + '2. Klar fuer Fachleute in dieser Nische\n'
  + '3. Idealerweise = Teil oder Ganzes des Produktnamens\n'
  + '4. IN DER SPRACHE DES MARKTES: {LANG_NAME} (kein Englisch, ausser UK/IE)\n'
  + '5. Max 2-3 Woerter (zusammengeschrieben oder mit Bindestrich)\n'
  + '6. OHNE Sonderzeichen (automatisch konvertiert)\n'
  + '7. Auf {MARKET_DOMAIN} eingegeben liefert relevante Produktergebnisse\n\n'
  + 'Fuer jeden Kandidaten:\n'
  + '- slug: fertiger normalisierter Slug (kleinbuchstaben, nur a-z0-9-)\n'
  + '- full_subdomain: slug + ".{ROOT_DOMAIN}"\n'
  + '- type: "CATEGORY_BASED" oder "NEED_BASED"\n'
  + '- rationale: max 2 Saetze Begruendung in {LANG_NAME}\n'
  + '- rationale_pl: max 2 Saetze Begruendung auf Polnisch\n'
  + '- amazon_test_phrase: Phrase zum Testen auf {MARKET_DOMAIN} in {LANG_NAME}\n'
  + '- amazon_test_phrase_pl: Uebersetzung der Phrase auf Polnisch\n'
  + '- score_criteria: Array mit 7 true/false Werten fuer Kriterien 1-7\n'
  + '- score_total: Summe der true-Werte (0-7)\n'
  + '- content_topics: 5 Artikel-Themen in {LANG_NAME}\n'
  + '- content_topics_pl: 5 Artikel-Themen auf Polnisch\n'
  + '- suggested_url_slugs: 5 Beispiel-URL-Slugs fuer Unterseiten (keine Sonderzeichen)\n\n'
  + 'Sortiere von besten zu schlechtesten (score_total absteigend).\n'
  + 'Antworte NUR mit validem JSON-Array. Kein Praeambel.';

// ==================== MENU ====================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Domain Finder')
    .addItem('Uruchom zaznaczone wiersze', 'dsfRunSelected')
    .addItem('Wznow kolejke (jesli przerwa)', 'dsfProcessQueue')
    .addSeparator()
    .addItem('Konfiguruj API Keys', 'dsfSetConfig')
    .addItem('Zainstaluj trigger', 'dsfSetupTriggers')
    .addSeparator()
    .addItem('Test: ASIN B0FRG79LF9', 'dsfRunTest')
    .addItem('Test: SP-API', 'dsfTestSpApi')
    .addItem('Test: Claude API', 'dsfTestClaude')
    .addSeparator()
    .addItem('Wyczysc kolejke', 'dsfClearQueue')
    .addItem('Usun stare triggery onEdit', 'dsfCleanupOldOnEditTriggers')
    .addItem('Migruj arkusze do v3 (nowe kolumny)', 'dsfMigrateSheets')
    .addItem('Pokaz LOG', 'dsfShowLog')
    .addToUi();
}

// ==================== DATE HELPER ====================

function dsfFormatDateDE(date) {
  var d = date || new Date();
  var pad = function(n) { return n < 10 ? '0' + n : n; };
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear()
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// ==================== SETUP & CONFIG ====================

function dsfSetupTriggers() {
  var ui = SpreadsheetApp.getUi();

  // Remove old DSF triggers (onEdit — no longer needed for auto-start)
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'dsfOnEditInstallable' || fn === 'dsfProcessQueue') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  // Also clean up any remaining onEdit triggers from the old version
  var onEditRemoved = dsfCleanupOldOnEditTriggers();
  removed += onEditRemoved;

  // Ensure all sheets exist
  dsfEnsureSheets_();

  ui.alert('Setup wykonany',
    (removed > 0 ? 'Usunieto ' + removed + ' starych triggerow.\n' : '') +
    'Zakladki utworzone: INPUT, ANALYSIS, SLUGS, ASINS, LOG.\n\n' +
    'Uzycie:\n1. Wpisz dane w INPUT\n2. Zaznacz checkbox(y) w kolumnie F\n3. Menu > Uruchom zaznaczone wiersze',
    ui.ButtonSet.OK);
}

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
    ui.alert('Konfiguracja', 'Zaktualizowano ' + updated + ' kluczy API.', ui.ButtonSet.OK);
  }
}

// ==================== TOKEN MANAGEMENT ====================

function dsfGetSpApiToken() {
  var props = PropertiesService.getScriptProperties();

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

  var response = UrlFetchApp.fetch('https://api.amazon.com/auth/o2/token', {
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

  return tokens.access_token;
}

// ==================== QUEUE SYSTEM ====================

/**
 * Menu action: collect checked rows from INPUT and start processing queue
 */
function dsfRunSelected() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  // Check if queue already exists
  var existingQueue = props.getProperty('DSF_QUEUE');
  if (existingQueue) {
    try {
      var q = JSON.parse(existingQueue);
      if (q.length > 0) {
        ui.alert('Kolejka aktywna',
          'Kolejka juz dziala lub jest wstrzymana (' + q.length + ' wierszy).\n\n' +
          'Uzyj "Wznow kolejke" lub "Wyczysc kolejke".',
          ui.ButtonSet.OK);
        return;
      }
    } catch (e) { /* ignore parse errors, proceed */ }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheetByName('INPUT');
  if (!inputSheet) {
    ui.alert('Brak zakladki INPUT. Uruchom najpierw: Zainstaluj trigger.');
    return;
  }

  var lastRow = inputSheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('Brak danych w zakladce INPUT.');
    return;
  }

  // Read columns A-F for all data rows
  var data = inputSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var queue = [];

  for (var i = 0; i < data.length; i++) {
    var rowNum = i + 2;
    var checkbox = data[i][5]; // Column F
    var status = (data[i][4] || '').toString().trim().toUpperCase(); // Column E

    if (checkbox === true && status !== 'DONE') {
      queue.push(rowNum);
    }
  }

  if (queue.length === 0) {
    ui.alert('Brak zaznaczonych wierszy',
      'Zaznacz checkbox(y) w kolumnie F przy wierszach do przetworzenia.\n' +
      'Wiersze ze statusem DONE sa pomijane.',
      ui.ButtonSet.OK);
    return;
  }

  // Save queue
  props.setProperty('DSF_QUEUE', JSON.stringify(queue));

  dsfLog('INFO', 'Rozpoczeto przetwarzanie kolejki: ' + queue.length + ' wierszy [' + queue.join(', ') + ']');

  ss.toast('Przetwarzam ' + queue.length + ' wierszy...', 'Domain Finder', 30);

  // Process immediately
  dsfProcessQueue();
}

/**
 * Process queue — runs items one by one, respects 6-min Apps Script limit
 */
function dsfProcessQueue() {
  var props = PropertiesService.getScriptProperties();

  var queueJson = props.getProperty('DSF_QUEUE');
  if (!queueJson) {
    dsfLog('INFO', 'Kolejka pusta — brak wierszy do przetworzenia.');
    return;
  }

  var queue;
  try {
    queue = JSON.parse(queueJson);
  } catch (e) {
    props.deleteProperty('DSF_QUEUE');
    dsfLog('ERROR', 'Nieprawidlowe dane kolejki: ' + e.message);
    return;
  }

  if (queue.length === 0) {
    props.deleteProperty('DSF_QUEUE');
    dsfLog('INFO', 'Wszystkie wiersze przetworzone.');
    dsfCleanupProcessQueueTriggers_();
    return;
  }

  dsfLog('INFO', 'Wznowienie przetwarzania — pozostalo wierszy: ' + queue.length);

  var START_TIME = Date.now();
  var MAX_RUNTIME = 5 * 60 * 1000; // 5 min (1 min buffer)

  while (queue.length > 0) {
    if ((Date.now() - START_TIME) > MAX_RUNTIME) {
      // Save remaining queue and schedule continuation
      props.setProperty('DSF_QUEUE', JSON.stringify(queue));
      dsfCleanupProcessQueueTriggers_();
      ScriptApp.newTrigger('dsfProcessQueue').timeBased().after(30000).create();
      dsfLog('WARNING', 'Przerwa — zbliza sie limit 6 min. Wznowienie za 30 sekund. Pozostalo wierszy: ' + queue.length);
      return;
    }

    var rowNum = queue.shift();
    props.setProperty('DSF_QUEUE', JSON.stringify(queue));

    try {
      dsfRunJobForRow(rowNum);
    } catch (err) {
      dsfLog('ERROR', 'Wiersz ' + rowNum + ': ' + err.message, rowNum);
      dsfUpdateInputStatus(rowNum, 'ERROR', '', 0, err.message);
    }
  }

  // All done
  props.deleteProperty('DSF_QUEUE');
  dsfLog('INFO', 'Wszystkie wiersze przetworzone.');
  dsfCleanupProcessQueueTriggers_();

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Kolejka zakonczona!', 'Domain Finder', 10);
  } catch (e) { /* toast may fail in trigger context */ }
}

/**
 * Clear queue and cancel scheduled triggers
 */
function dsfClearQueue() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('DSF_QUEUE');
  dsfCleanupProcessQueueTriggers_();
  dsfLog('INFO', 'Kolejka wyczyszczona recznie.');
  SpreadsheetApp.getUi().alert('Kolejka wyczyszczona. Wiersze nie zostaly przetworzone.');
}

/**
 * Show LOG sheet
 */
function dsfShowLog() {
  var ss = SpreadsheetApp.getActive();
  var logSheet = ss.getSheetByName('LOG');
  if (!logSheet) {
    dsfEnsureSheets_();
    logSheet = ss.getSheetByName('LOG');
  }
  if (logSheet) logSheet.activate();
}

// ==================== MAIN PIPELINE ====================

/**
 * Process a single row from INPUT sheet
 */
function dsfRunJobForRow(rowNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheetByName('INPUT');
  if (!inputSheet) throw new Error('Brak zakladki INPUT');

  // Read row data
  var rowData = inputSheet.getRange(rowNum, 1, 1, 4).getValues()[0];
  var type = (rowData[0] || '').toString().trim().toUpperCase();
  var value = (rowData[1] || '').toString().trim();
  var market = (rowData[2] || 'DE').toString().trim().toUpperCase();
  var rootDomain = (rowData[3] || 'lk24.shop').toString().trim();

  if (!type || !value) {
    throw new Error('Brak typu lub wartosci w wierszu ' + rowNum);
  }

  if (type !== 'ASIN' && type !== 'KEYWORD') {
    throw new Error('Typ musi byc ASIN lub KEYWORD (wiersz ' + rowNum + ')');
  }

  // Validate marketplace
  var marketplace = DSF_MARKETPLACES[market];
  if (!marketplace) {
    var available = Object.keys(DSF_MARKETPLACES).join(', ');
    throw new Error('Nieznany rynek: "' + market + '". Dostepne: ' + available);
  }

  // Set status to PROCESSING
  inputSheet.getRange(rowNum, 5).setValue('PROCESSING');
  inputSheet.getRange(rowNum, 7).setValue(dsfFormatDateDE());
  SpreadsheetApp.flush();

  dsfLog('INFO', 'Start przetwarzania: typ=' + type + ', wartosc=' + value + ', rynek=' + market, rowNum);

  // 1. Get SP-API token
  var accessToken = dsfGetSpApiToken();

  // 2. Fetch product data
  var spData, searchPhrase;

  if (type === 'ASIN') {
    spData = dsfCallSpApiGetItem(value, accessToken, marketplace);
    searchPhrase = dsfExtractMainPhrase(spData);
  } else {
    spData = dsfCallSpApiSearch(value, accessToken, marketplace);
    searchPhrase = value;
  }

  Utilities.sleep(500);

  // 3. Amazon Autocomplete
  var amazonSuggestions = dsfGetAmazonAutocomplete(searchPhrase, marketplace);

  // 4. Google Autocomplete
  var googleSuggestions = dsfGetGoogleAutocomplete(searchPhrase, marketplace);

  Utilities.sleep(300);

  // 5. Claude Call 1 — Analysis
  var analysisData = dsfCallClaudeAnalysis(spData, amazonSuggestions, googleSuggestions, marketplace);

  Utilities.sleep(500);

  // 6. Claude Call 2 — Slugs
  var slugsData = dsfCallClaudeSlugs(analysisData, marketplace, rootDomain);

  Utilities.sleep(300);

  // 7. DENIC Check for top 3 slugs
  var denicResults = {};
  if (slugsData.length > 0) {
    var topSlugs = slugsData.slice(0, 3).map(function(s) { return s.slug; });
    denicResults = dsfCheckDenicForTopSlugs(topSlugs);
  }

  Utilities.sleep(300);

  // 8. Additional ASINs for the website
  var additionalAsins = [];
  if (slugsData.length > 0 && slugsData[0].amazon_test_phrase) {
    additionalAsins = dsfCallSpApiSearchForAsins(slugsData[0].amazon_test_phrase, accessToken, marketplace);
  }

  // 9. Save to sheets
  dsfSaveResultsToSheets(rowNum, value, market, analysisData, slugsData, denicResults, additionalAsins, rootDomain);

  // 10. Update INPUT status
  var topSlug = slugsData.length > 0 ? slugsData[0].slug : '';
  var topScore = slugsData.length > 0 ? slugsData[0].score_total : 0;
  dsfUpdateInputStatus(rowNum, 'DONE', topSlug, topScore);

  dsfLog('INFO', 'Zakonczono: top slug = ' + topSlug + ', score = ' + topScore + '/7', rowNum);
}

// ==================== SP API CALLS ====================

function dsfCallSpApiGetItem(asin, token, marketplace) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items/' + asin
    + '?marketplaceIds=' + marketplace.id
    + '&includedData=attributes,classifications,identifiers,images,productTypes,salesRanks,summaries';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-amz-access-token': token },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 404 || code === 400) {
    throw new Error('ASIN not found on ' + marketplace.domain + ': ' + asin);
  }

  if (code === 429) {
    dsfLog('WARNING', 'SP-API rate limited, retrying in 2s...');
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
    dsfLog('ERROR', 'SP-API HTTP ' + code + ': ' + body.substring(0, 200));
    throw new Error('SP-API Error ' + code + ': ' + body.substring(0, 300));
  }

  var data = JSON.parse(body);
  var summaries = data.summaries || [];
  var summary = summaries[0] || {};
  var attributes = data.attributes || {};
  var salesRanks = data.salesRanks || [];
  var classifications = data.classifications || [];
  var images = data.images || [];

  var title = summary.itemName || '';
  var brand = summary.brand || '';
  if (!brand && attributes.brand && attributes.brand[0]) {
    brand = attributes.brand[0].value || '';
  }

  var categoryName = '';
  var browseNodeName = '';
  if (summary.browseClassification) {
    categoryName = summary.browseClassification.displayName || '';
    browseNodeName = categoryName;
  }
  if (!categoryName && classifications.length > 0) {
    var nodes = (classifications[0].classifications || []);
    if (nodes.length > 0) {
      categoryName = nodes[0].displayName || '';
      browseNodeName = categoryName;
    }
  }

  var bsrRank = '';
  var bsrCategory = '';
  for (var i = 0; i < salesRanks.length; i++) {
    if (salesRanks[i].marketplaceId === marketplace.id) {
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

  var bulletPoints = [];
  if (attributes.bullet_point) {
    for (var b = 0; b < attributes.bullet_point.length; b++) {
      var bp = attributes.bullet_point[b].value || '';
      if (bp) bulletPoints.push(bp);
    }
  }

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

  var mainImage = '';
  if (images.length > 0 && images[0].images) {
    var imgList = images[0].images;
    var mainImgObj = null;
    for (var m = 0; m < imgList.length; m++) {
      if (imgList[m].variant === 'MAIN') { mainImgObj = imgList[m]; break; }
    }
    if (!mainImgObj) mainImgObj = imgList[0];
    mainImage = mainImgObj ? mainImgObj.link || '' : '';
  }

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
    marketplace: marketplace.domain
  };
}

function dsfCallSpApiSearch(keywords, token, marketplace) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items'
    + '?keywords=' + encodeURIComponent(keywords)
    + '&marketplaceIds=' + marketplace.id
    + '&pageSize=20'
    + '&includedData=attributes,classifications,identifiers,images,salesRanks,summaries';

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
    dsfLog('ERROR', 'SP-API Search HTTP ' + code + ': ' + body.substring(0, 200));
    throw new Error('SP-API Search Error ' + code + ': ' + body.substring(0, 300));
  }

  var data = JSON.parse(body);
  var items = data.items || [];

  if (items.length === 0) {
    throw new Error('No products found for keyword: ' + keywords + ' on ' + marketplace.domain);
  }

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
    totalResults: items.length,
    marketplace: marketplace.domain
  };
}

function dsfCallSpApiSearchForAsins(keywords, token, marketplace) {
  var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items'
    + '?keywords=' + encodeURIComponent(keywords)
    + '&marketplaceIds=' + marketplace.id
    + '&pageSize=20'
    + '&includedData=attributes,classifications,images,salesRanks,summaries';

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-amz-access-token': token },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) return [];

  var data = JSON.parse(response.getContentText());
  var items = data.items || [];
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var summary = (item.summaries || [])[0] || {};
    var attrs = item.attributes || {};
    var salesRanks = item.salesRanks || [];

    var bsrRank = '';
    var bsrCategory = '';
    for (var r = 0; r < salesRanks.length; r++) {
      if (salesRanks[r].marketplaceId === marketplace.id) {
        var classRanks = salesRanks[r].classificationRanks || [];
        if (classRanks.length > 0) {
          bsrRank = classRanks[0].rank || '';
          bsrCategory = classRanks[0].title || '';
        }
        break;
      }
    }

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

    var imgUrl = '';
    var imageGroups = item.images || [];
    if (imageGroups.length > 0 && imageGroups[0].images) {
      var imgs = imageGroups[0].images;
      for (var m = 0; m < imgs.length; m++) {
        if (imgs[m].variant === 'MAIN') { imgUrl = imgs[m].link || ''; break; }
      }
      if (!imgUrl && imgs[0]) imgUrl = imgs[0].link || '';
    }

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

function dsfExtractMainPhrase(spData) {
  if (spData.categoryName) return spData.categoryName;
  if (spData.browseNodeName) return spData.browseNodeName;
  if (spData.title) {
    var words = spData.title.split(/\s+/);
    var startIdx = 0;
    if (spData.brand && words[0] && words[0].toLowerCase() === spData.brand.toLowerCase()) {
      startIdx = 1;
    }
    return words.slice(startIdx, startIdx + 3).join(' ');
  }
  return '';
}

// ==================== AUTOCOMPLETE ====================

function dsfGetAmazonAutocomplete(phrase, marketplace) {
  if (!phrase) return [];
  try {
    var url = 'https://' + marketplace.autocomplete + '/api/2017/suggestions'
      + '?limit=10&prefix=' + encodeURIComponent(phrase)
      + '&mid=' + marketplace.id + '&alias=aps';

    var response = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return [];

    var data = JSON.parse(response.getContentText());
    return (data.suggestions || []).map(function(s) { return s.value || ''; }).filter(function(s) { return s; });
  } catch (e) {
    dsfLog('WARNING', 'Amazon autocomplete error: ' + e.message);
    return [];
  }
}

function dsfGetGoogleAutocomplete(phrase, marketplace) {
  if (!phrase) return [];
  try {
    var url = 'https://suggestqueries.google.com/complete/search'
      + '?output=toolbar'
      + '&q=' + encodeURIComponent(phrase + ' kaufen')
      + '&hl=' + marketplace.hlParam + '&gl=' + marketplace.glParam;

    var response = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return [];

    var doc = XmlService.parse(response.getContentText());
    var root = doc.getRootElement();
    var completions = root.getChildren('CompleteSuggestion');
    var results = [];
    for (var i = 0; i < completions.length; i++) {
      var suggestion = completions[i].getChild('suggestion');
      if (suggestion) {
        var attr = suggestion.getAttribute('data');
        if (attr) results.push(attr.getValue());
      }
    }
    return results;
  } catch (e) {
    dsfLog('WARNING', 'Google autocomplete error: ' + e.message);
    return [];
  }
}

// ==================== CLAUDE API ====================

function dsfCallClaudeAnalysis(spData, amazonSugg, googleSugg, marketplace) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

  var systemPrompt = DSF_SYSTEM_PROMPT_ANALYSIS
    .replace(/\{MARKET_DOMAIN\}/g, marketplace.domain)
    .replace(/\{LANG_NAME\}/g, marketplace.langName);

  var userPrompt = DSF_USER_PROMPT_ANALYSIS
    .replace(/\{MARKET_DOMAIN\}/g, marketplace.domain)
    .replace(/\{LANG_NAME\}/g, marketplace.langName)
    .replace(/\{LANG_CODE\}/g, marketplace.lang)
    .replace('{SP_DATA}', JSON.stringify(spData, null, 2))
    .replace('{AMAZON_SUGGESTIONS}', JSON.stringify(amazonSugg))
    .replace('{GOOGLE_SUGGESTIONS}', JSON.stringify(googleSugg));

  var payload = {
    model: DSF_CLAUDE_MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  };

  var result = dsfCallClaudeApi_(apiKey, payload);
  var parsed = dsfParseClaudeJson_(result);

  if (!parsed) {
    dsfLog('WARNING', 'Claude analysis JSON parse failed, retrying...');
    Utilities.sleep(1000);
    result = dsfCallClaudeApi_(apiKey, payload);
    parsed = dsfParseClaudeJson_(result);
    if (!parsed) {
      dsfLog('ERROR', 'Claude analysis: invalid JSON after retry');
      throw new Error('Claude analysis returned invalid JSON after retry');
    }
  }

  return parsed;
}

function dsfCallClaudeSlugs(analysisData, marketplace, rootDomain) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('CLAUDE_API_KEY');
  if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

  var systemPrompt = DSF_SYSTEM_PROMPT_SLUGS
    .replace(/\{MARKET_DOMAIN\}/g, marketplace.domain)
    .replace(/\{LANG_NAME\}/g, marketplace.langName);

  var userPrompt = DSF_USER_PROMPT_SLUGS
    .replace(/\{MARKET_DOMAIN\}/g, marketplace.domain)
    .replace(/\{LANG_NAME\}/g, marketplace.langName)
    .replace('{ROOT_DOMAIN}', rootDomain)
    .replace('{ANALYSIS_DATA}', JSON.stringify(analysisData, null, 2));

  var payload = {
    model: DSF_CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  };

  var result = dsfCallClaudeApi_(apiKey, payload);
  var parsed = dsfParseClaudeJson_(result);

  if (!parsed) {
    dsfLog('WARNING', 'Claude slugs JSON parse failed, retrying...');
    Utilities.sleep(1000);
    result = dsfCallClaudeApi_(apiKey, payload);
    parsed = dsfParseClaudeJson_(result);
    if (!parsed) {
      dsfLog('ERROR', 'Claude slugs: invalid JSON after retry');
      throw new Error('Claude slugs returned invalid JSON after retry');
    }
  }

  var slugsArray = Array.isArray(parsed) ? parsed : [parsed];

  for (var i = 0; i < slugsArray.length; i++) {
    if (slugsArray[i].slug) {
      slugsArray[i].slug = dsfNormalizeSlug(slugsArray[i].slug);
    }
    if (typeof slugsArray[i].score_total !== 'number') {
      var criteria = slugsArray[i].score_criteria || [];
      var total = 0;
      for (var c = 0; c < criteria.length; c++) {
        if (criteria[c] === true) total++;
      }
      slugsArray[i].score_total = total;
    }
  }

  slugsArray.sort(function(a, b) { return (b.score_total || 0) - (a.score_total || 0); });
  return slugsArray;
}

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
      errMsg = err.error && err.error.message ? err.error.message : (err.message || errMsg);
    } catch (e) {
      errMsg = body.substring(0, 300);
    }

    // Detect billing/credit errors
    var lower = errMsg.toLowerCase();
    if (lower.indexOf('credit') >= 0 || lower.indexOf('balance') >= 0 ||
        lower.indexOf('billing') >= 0 || lower.indexOf('quota') >= 0) {
      var billingMsg = 'BRAK SRODKOW W API CLAUDE — doladuj konto na console.anthropic.com';
      dsfLog('ERROR', billingMsg);
      throw new Error(billingMsg);
    }

    dsfLog('ERROR', 'Claude API HTTP ' + code + ': ' + errMsg);
    throw new Error(errMsg);
  }

  var data = JSON.parse(body);
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Claude API returned empty response');
  }

  return data.content[0].text;
}

function dsfParseClaudeJson_(text) {
  if (!text) return null;
  var cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Attempt 1: direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt 2: repair truncated JSON — close open strings, arrays, objects
    var repaired = dsfRepairTruncatedJson_(cleaned);
    if (repaired) {
      try {
        var result = JSON.parse(repaired);
        dsfLog('WARNING', 'Claude JSON was truncated but repaired successfully (output was cut off by max_tokens)');
        return result;
      } catch (e2) {
        // repair failed too
      }
    }

    dsfLog('ERROR', 'JSON parse error: ' + e.message + ' | Text length: ' + cleaned.length + ' | Start: ' + cleaned.substring(0, 150));
    return null;
  }
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces/strings.
 * This handles the common case where Claude's output is cut off by max_tokens.
 */
function dsfRepairTruncatedJson_(text) {
  if (!text) return null;

  var repaired = text;

  // Remove trailing incomplete key-value pair or array element
  // Look for last complete structure (ends with ], }, ", or a value)
  repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*(\[?\s*"?[^}\]]*)?$/, '');
  repaired = repaired.replace(/,\s*"[^"]*$/, '');
  repaired = repaired.replace(/,\s*$/, '');

  // Count open/close brackets
  var inString = false;
  var escape = false;
  var stack = [];

  for (var i = 0; i < repaired.length; i++) {
    var ch = repaired[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
    } else if (ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
    }
  }

  // If we're still inside a string, close it
  if (inString) {
    repaired += '"';
  }

  // Close remaining open brackets/braces in reverse order
  while (stack.length > 0) {
    var open = stack.pop();
    // Remove any trailing comma before closing
    repaired = repaired.replace(/,\s*$/, '');
    repaired += (open === '{') ? '}' : ']';
  }

  return repaired;
}

// ==================== SLUG NORMALIZATION ====================

function dsfNormalizeSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    // Niemiecki
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    // Francuski
    .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ùû]/g, 'u')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    // Wloski / Hiszpanski
    .replace(/[áà]/g, 'a').replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
    // Skandynawski (SE)
    .replace(/ø/g, 'o').replace(/å/g, 'a')
    // Polski
    .replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ś/g, 's').replace(/ć/g, 'c')
    .replace(/ź/g, 'z').replace(/ż/g, 'z').replace(/ń/g, 'n').replace(/ł/g, 'l')
    // Ogolne
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

// ==================== DENIC CHECK ====================

function dsfCheckDenicForTopSlugs(slugs) {
  var results = {};
  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    try {
      var response = UrlFetchApp.fetch('https://rdap.denic.de/domain/' + slug + '.de', {
        method: 'head',
        muteHttpExceptions: true,
        followRedirects: true
      });
      var code = response.getResponseCode();
      results[slug] = code === 404 ? 'FREE' : (code === 200 ? 'TAKEN' : 'UNKNOWN');
      Utilities.sleep(300);
    } catch (e) {
      results[slug] = 'UNKNOWN';
    }
  }
  return results;
}

// ==================== LOGGING ====================

/**
 * Write log entry to LOG sheet (newest on top — insert at row 2)
 */
function dsfLog(level, message, rowNum) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('LOG');
    if (!logSheet) {
      dsfEnsureSheets_();
      logSheet = ss.getSheetByName('LOG');
      if (!logSheet) return;
    }

    var row = [
      dsfFormatDateDE(),
      level || 'INFO',
      rowNum || '-',
      message || ''
    ];

    // Insert at row 2 (below header) — newest on top
    logSheet.insertRowBefore(2);
    logSheet.getRange(2, 1, 1, 4).setValues([row]);

    // Color formatting
    var rowRange = logSheet.getRange(2, 1, 1, 4);
    if (level === 'ERROR') {
      rowRange.setFontColor('#cc0000').setBackground('#fff9c4');
    } else if (level === 'WARNING') {
      rowRange.setFontColor('#e65100').setBackground('#ffffff');
    } else {
      rowRange.setFontColor('#2e7d32').setBackground('#ffffff');
    }

    Logger.log('[DSF/' + level + '] ' + (rowNum ? 'Row ' + rowNum + ': ' : '') + message);
  } catch (e) {
    Logger.log('[DSF/LOG_ERROR] ' + e.message + ' | Original: [' + level + '] ' + message);
  }
}

// ==================== SHEETS MANAGEMENT ====================

// ==================== SHEET DEFINITIONS (v3) ====================

var DSF_SHEET_INPUT_HEADERS = [
  'Typ', 'Wartosc', 'Rynek', 'Root Domain', 'Status',
  'Trigger', 'Timestamp zlecenia', 'Timestamp ukonczenia',
  'Top Slug', 'Score', 'Error'
];

var DSF_SHEET_ANALYSIS_HEADERS = [
  'INPUT_Row', 'ASIN/Keyword', 'Rynek',
  'Potrzeby & Problemy', 'Potrzeby & Problemy (PL)',
  'Buyer Personas', 'Buyer Personas (PL)',
  'Czeste Slowa', 'Czeste Slowa (PL)',
  'Keyword Kandydaci', 'Keyword Kandydaci (PL)',
  'Sytuacje Uzycia', 'Sytuacje Uzycia (PL)',
  'Triggery Szukania', 'Triggery Szukania (PL)',
  'Pytania', 'Pytania (PL)',
  'Tematy Poradnikowe', 'Tematy Poradnikowe (PL)',
  'Czego Nie Robic', 'Czego Nie Robic (PL)',
  'Influencerzy', 'Influencerzy (PL)',
  'Blogi', 'Blogi (PL)',
  'Top Sklepy', 'Top Sklepy (PL)',
  'Kontekst Kulturowy', 'Kontekst Kulturowy (PL)',
  'Timestamp'
];

var DSF_SHEET_SLUGS_HEADERS = [
  'INPUT_Row', 'full_subdomain', 'slug', 'root_domain', 'type',
  'Uzasadnienie', 'Uzasadnienie (PL)',
  'Amazon Test Phrase', 'Amazon Test Phrase (PL)',
  'score_total',
  'criteria_1', 'criteria_2', 'criteria_3', 'criteria_4',
  'criteria_5', 'criteria_6', 'criteria_7',
  'Content Topics', 'Content Topics (PL)',
  'URL Slugs',
  'de_domain_status', 'status', 'Timestamp'
];

var DSF_SHEET_ASINS_HEADERS = [
  'INPUT_Row', 'Target_Slug', 'ASIN', 'Title', 'Price (EUR)',
  'Category', 'BSR_rank', 'BSR_category', 'Image_URL',
  'Product_URL', 'Timestamp'
];

var DSF_SHEET_LOG_HEADERS = [
  'Timestamp', 'Poziom', 'Wiersz INPUT', 'Wiadomosc'
];

// ==================== SHEET MANAGEMENT ====================

/**
 * Ensure all sheets exist AND have correct v3 headers.
 * Creates missing sheets. For existing sheets, calls dsfUpdateSheetHeaders_ to add new columns.
 */
function dsfEnsureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- INPUT ---
  var inputSheet = ss.getSheetByName('INPUT');
  if (!inputSheet) {
    inputSheet = ss.insertSheet('INPUT');
    inputSheet.getRange(1, 1, 1, DSF_SHEET_INPUT_HEADERS.length).setValues([DSF_SHEET_INPUT_HEADERS]);
    inputSheet.getRange('F2:F100').insertCheckboxes();
    inputSheet.getRange('C2:C100').setValue('DE');
    inputSheet.getRange('D2:D100').setValue('lk24.shop');
    dsfFormatHeaderRow_(inputSheet, DSF_SHEET_INPUT_HEADERS.length, '#4285f4', '#ffffff');
    inputSheet.setFrozenRows(1);
    inputSheet.setColumnWidth(1, 80);
    inputSheet.setColumnWidth(2, 200);
    inputSheet.setColumnWidth(5, 120);
    inputSheet.setColumnWidth(9, 200);
  }

  // Data validation for Rynek column (C) — always apply
  var rynekRange = inputSheet.getRange('C2:C1000');
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['DE','FR','IT','ES','UK','NL','BE','PL','SE','IE'], true)
    .setAllowInvalid(false)
    .build();
  rynekRange.setDataValidation(rule);

  // --- ANALYSIS ---
  var analysisSheet = ss.getSheetByName('ANALYSIS');
  if (!analysisSheet) {
    analysisSheet = ss.insertSheet('ANALYSIS');
    analysisSheet.getRange(1, 1, 1, DSF_SHEET_ANALYSIS_HEADERS.length).setValues([DSF_SHEET_ANALYSIS_HEADERS]);
    analysisSheet.setFrozenRows(1);
    dsfColorAnalysisHeaders_(analysisSheet, DSF_SHEET_ANALYSIS_HEADERS);
  } else {
    dsfUpdateSheetHeaders_(analysisSheet, DSF_SHEET_ANALYSIS_HEADERS);
    dsfColorAnalysisHeaders_(analysisSheet, DSF_SHEET_ANALYSIS_HEADERS);
  }

  // --- SLUGS ---
  var slugsSheet = ss.getSheetByName('SLUGS');
  if (!slugsSheet) {
    slugsSheet = ss.insertSheet('SLUGS');
    slugsSheet.getRange(1, 1, 1, DSF_SHEET_SLUGS_HEADERS.length).setValues([DSF_SHEET_SLUGS_HEADERS]);
    slugsSheet.setFrozenRows(1);
    dsfColorSlugsHeaders_(slugsSheet, DSF_SHEET_SLUGS_HEADERS);
    slugsSheet.setColumnWidth(2, 250);
    slugsSheet.setColumnWidth(6, 300);
    slugsSheet.setColumnWidth(7, 300);
  } else {
    dsfUpdateSheetHeaders_(slugsSheet, DSF_SHEET_SLUGS_HEADERS);
    dsfColorSlugsHeaders_(slugsSheet, DSF_SHEET_SLUGS_HEADERS);
  }

  // --- ASINS ---
  var asinsSheet = ss.getSheetByName('ASINS');
  if (!asinsSheet) {
    asinsSheet = ss.insertSheet('ASINS');
    asinsSheet.getRange(1, 1, 1, DSF_SHEET_ASINS_HEADERS.length).setValues([DSF_SHEET_ASINS_HEADERS]);
    dsfFormatHeaderRow_(asinsSheet, DSF_SHEET_ASINS_HEADERS.length, '#ea4335', '#ffffff');
    asinsSheet.setFrozenRows(1);
    asinsSheet.setColumnWidth(4, 300);
  }

  // --- LOG ---
  var logSheet = ss.getSheetByName('LOG');
  if (!logSheet) {
    logSheet = ss.insertSheet('LOG');
    logSheet.getRange(1, 1, 1, DSF_SHEET_LOG_HEADERS.length).setValues([DSF_SHEET_LOG_HEADERS]);
    dsfFormatHeaderRow_(logSheet, DSF_SHEET_LOG_HEADERS.length, '#424242', '#ffffff');
    logSheet.setFrozenRows(1);
    logSheet.setColumnWidth(1, 160);
    logSheet.setColumnWidth(2, 80);
    logSheet.setColumnWidth(3, 100);
    logSheet.setColumnWidth(4, 600);
  }
}

/**
 * Update headers of an existing sheet to match the expected v3 layout.
 * Strategy: completely replaces header row 1 with the new headers.
 * Also detects and removes old v2 "pretty" sub-header row 2.
 * Existing data rows are preserved — new columns get empty values.
 */
function dsfUpdateSheetHeaders_(sheet, expectedHeaders) {
  var lastCol = sheet.getLastColumn();
  var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Check if headers already match
  if (currentHeaders.length === expectedHeaders.length) {
    var match = true;
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (currentHeaders[i].toString().trim() !== expectedHeaders[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Headers match, but still check for old row 2 sub-headers
      dsfRemoveOldSubHeaderRow_(sheet);
      return;
    }
  }

  // Write new header row
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Remove old v2 "pretty" sub-header row 2 if present
  dsfRemoveOldSubHeaderRow_(sheet);

  Logger.log('[DSF] Updated headers for sheet "' + sheet.getName() + '": ' + expectedHeaders.length + ' columns (was ' + lastCol + ')');
}

/**
 * Detect and delete old v2 formatted sub-header row (row 2).
 * Old v2 sheets had a "pretty" row 2 with styled column names like:
 *   ANALYSIS: "INPUT\nRow", "ASIN /\nKeyword", "1. Potrzeby\n& Problemy" ...
 *   SLUGS: "INPUT\nRow", "Full Subdomain\n(gotowe do użycia)", "Slug" ...
 * These are no longer needed in v3 — row 1 IS the header.
 */
function dsfRemoveOldSubHeaderRow_(sheet) {
  if (sheet.getLastRow() < 2) return; // No row 2

  var row2Val = sheet.getRange(2, 1).getValue().toString().trim();

  // Old v2 sub-headers always had "INPUT\nRow" or "INPUT Row" in A2
  // Real data rows have numeric INPUT_Row values (1, 2, 3...)
  if (row2Val === 'INPUT\nRow' || row2Val === 'INPUT Row' || row2Val === 'INPUT\r\nRow') {
    sheet.deleteRow(2);
    Logger.log('[DSF] Deleted old v2 sub-header row 2 from sheet "' + sheet.getName() + '"');
  }
}

/**
 * Color ANALYSIS headers: purple for data fields, light yellow for PL translations
 */
function dsfColorAnalysisHeaders_(sheet, headers) {
  for (var h = 0; h < headers.length; h++) {
    var cell = sheet.getRange(1, h + 1);
    if (headers[h].indexOf('(PL)') >= 0) {
      cell.setBackground('#fffde7').setFontColor('#1a237e');
    } else {
      cell.setBackground('#7b1fa2').setFontColor('#ffffff');
    }
  }
}

/**
 * Color SLUGS headers: yellow for data fields, light yellow for PL translations
 */
function dsfColorSlugsHeaders_(sheet, headers) {
  for (var s = 0; s < headers.length; s++) {
    var cell = sheet.getRange(1, s + 1);
    if (headers[s].indexOf('(PL)') >= 0) {
      cell.setBackground('#fffde7').setFontColor('#1a237e');
    } else {
      cell.setBackground('#fbbc04').setFontColor('#000000');
    }
  }
}

/**
 * Simple header formatting helper
 */
function dsfFormatHeaderRow_(sheet, numCols, bgColor, fontColor) {
  sheet.getRange(1, 1, 1, numCols).setFontWeight('bold').setBackground(bgColor).setFontColor(fontColor);
}

/**
 * Menu action: Migrate all sheets to v3 format (new columns, colors, validation).
 * Safe to run multiple times — idempotent.
 */
function dsfMigrateSheets() {
  var ui = SpreadsheetApp.getUi();

  dsfEnsureSheets_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Report what happened
  var report = 'Migracja arkuszy do v3 zakonczona!\n\n';

  var sheets = ['INPUT', 'ANALYSIS', 'SLUGS', 'ASINS', 'LOG'];
  for (var i = 0; i < sheets.length; i++) {
    var sheet = ss.getSheetByName(sheets[i]);
    if (sheet) {
      report += sheets[i] + ': ' + sheet.getLastColumn() + ' kolumn\n';
    } else {
      report += sheets[i] + ': BRAK (blad)\n';
    }
  }

  report += '\nANALYSIS: ' + DSF_SHEET_ANALYSIS_HEADERS.length + ' kolumn (13 pol + 13 PL + 3 meta)';
  report += '\nSLUGS: ' + DSF_SHEET_SLUGS_HEADERS.length + ' kolumn (z kolumnami PL)';
  report += '\n\nStary wiersz 2 z v2 naglowkami zostal usuniety (jesli istnial).';
  report += '\nNowe analizy beda juz poprawnie zapisywane.';

  dsfLog('INFO', 'Migracja arkuszy do v3 wykonana');

  ui.alert('Migracja v3', report, ui.ButtonSet.OK);
}

function dsfSaveResultsToSheets(inputRow, inputValue, market, analysis, slugs, denicResults, asins, rootDomain) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = dsfFormatDateDE();

  dsfEnsureSheets_();

  // --- ANALYSIS ---
  var analysisSheet = ss.getSheetByName('ANALYSIS');
  analysisSheet.appendRow([
    inputRow,
    inputValue,
    market,
    JSON.stringify(analysis.needs_and_problems || []),
    JSON.stringify(analysis.needs_and_problems_pl || []),
    JSON.stringify(analysis.buyer_personas || []),
    JSON.stringify(analysis.buyer_personas_pl || []),
    JSON.stringify(analysis.frequent_words || []),
    JSON.stringify(analysis.frequent_words_pl || []),
    JSON.stringify(analysis.keyword_candidates || []),
    JSON.stringify(analysis.keyword_candidates_pl || []),
    JSON.stringify(analysis.usage_situations || []),
    JSON.stringify(analysis.usage_situations_pl || []),
    JSON.stringify(analysis.search_triggers || []),
    JSON.stringify(analysis.search_triggers_pl || []),
    JSON.stringify(analysis.search_questions || []),
    JSON.stringify(analysis.search_questions_pl || []),
    JSON.stringify(analysis.tips_topics || []),
    JSON.stringify(analysis.tips_topics_pl || []),
    JSON.stringify(analysis.dont_do_topics || []),
    JSON.stringify(analysis.dont_do_topics_pl || []),
    JSON.stringify(analysis.influencers || []),
    JSON.stringify(analysis.influencers_pl || []),
    JSON.stringify(analysis.blogs_articles || []),
    JSON.stringify(analysis.blogs_articles_pl || []),
    JSON.stringify(analysis.top_shops || []),
    JSON.stringify(analysis.top_shops_pl || []),
    JSON.stringify(analysis.cultural_context || []),
    JSON.stringify(analysis.cultural_context_pl || []),
    now
  ]);

  // --- SLUGS ---
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
      s.rationale || '',
      s.rationale_pl || '',
      s.amazon_test_phrase || '',
      s.amazon_test_phrase_pl || '',
      s.score_total || 0,
      criteria[0] === true ? 'TRUE' : 'FALSE',
      criteria[1] === true ? 'TRUE' : 'FALSE',
      criteria[2] === true ? 'TRUE' : 'FALSE',
      criteria[3] === true ? 'TRUE' : 'FALSE',
      criteria[4] === true ? 'TRUE' : 'FALSE',
      criteria[5] === true ? 'TRUE' : 'FALSE',
      criteria[6] === true ? 'TRUE' : 'FALSE',
      JSON.stringify(s.content_topics || []),
      JSON.stringify(s.content_topics_pl || []),
      JSON.stringify(s.suggested_url_slugs || []),
      deStatus,
      'IDEA',
      now
    ]);
  }

  // --- ASINS ---
  var asinsSheet = ss.getSheetByName('ASINS');
  var targetSlug = slugs.length > 0 ? slugs[0].slug : '';
  var marketplace = DSF_MARKETPLACES[market] || DSF_MARKETPLACES['DE'];

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
      'https://' + marketplace.domain + '/dp/' + (a.asin || ''),
      now
    ]);
  }

  SpreadsheetApp.flush();
}

function dsfUpdateInputStatus(row, status, topSlug, topScore, errorMsg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('INPUT');
  if (!sheet) return;

  sheet.getRange(row, 5).setValue(status);
  sheet.getRange(row, 8).setValue(dsfFormatDateDE());

  if (topSlug) sheet.getRange(row, 9).setValue(topSlug);
  if (topScore !== undefined && topScore !== null) sheet.getRange(row, 10).setValue(topScore);
  if (errorMsg) sheet.getRange(row, 11).setValue(errorMsg);

  // Uncheck trigger
  sheet.getRange(row, 6).setValue(false);

  SpreadsheetApp.flush();
}

// ==================== TEST & MANUAL ====================

function dsfRunManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  if (sheet.getName() !== 'INPUT') {
    SpreadsheetApp.getUi().alert('Przejdz do zakladki INPUT i wybierz wiersz.');
    return;
  }

  var row = sheet.getActiveCell().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Wybierz wiersz z danymi (wiersz 2+).');
    return;
  }

  dsfLog('INFO', 'Reczne uruchomienie dla wiersza ' + row, row);
  ss.toast('Przetwarzam wiersz ' + row + '...', 'Domain Finder', 60);

  try {
    dsfRunJobForRow(row);
    ss.toast('Wiersz ' + row + ' zakonczony!', 'Domain Finder', 10);
  } catch (e) {
    ss.toast('Blad: ' + e.message, 'Domain Finder - ERROR', 15);
  }
}

function dsfRunTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  dsfEnsureSheets_();

  var inputSheet = ss.getSheetByName('INPUT');
  var lastRow = inputSheet.getLastRow();
  var testRow = lastRow + 1;

  inputSheet.getRange(testRow, 1, 1, 4).setValues([['ASIN', 'B0FRG79LF9', 'DE', 'lk24.shop']]);
  inputSheet.getRange(testRow, 6).insertCheckboxes();
  inputSheet.getRange(testRow, 6).setValue(false);

  dsfLog('INFO', 'Test uruchomiony: ASIN B0FRG79LF9, rynek DE', testRow);
  ss.toast('Test: ASIN B0FRG79LF9 (wiersz ' + testRow + ')...', 'Domain Finder', 60);

  try {
    dsfRunJobForRow(testRow);
    ss.toast('Test zakonczony!', 'Domain Finder', 10);
  } catch (e) {
    ss.toast('Blad: ' + e.message, 'Domain Finder - ERROR', 15);
  }
}

function dsfTestSpApi() {
  var ui = SpreadsheetApp.getUi();
  try {
    var token = dsfGetSpApiToken();
    var url = DSF_SP_ENDPOINT + '/catalog/2022-04-01/items'
      + '?keywords=test&marketplaceIds=' + DSF_MARKETPLACES['DE'].id + '&pageSize=1&includedData=summaries';

    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-amz-access-token': token },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      ui.alert('SP-API Test', 'Polaczenie dziala!\nHTTP 200 OK', ui.ButtonSet.OK);
    } else {
      ui.alert('SP-API Test', 'Blad: HTTP ' + response.getResponseCode(), ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('SP-API Test', 'Blad: ' + e.message, ui.ButtonSet.OK);
  }
}

function dsfTestClaude() {
  var ui = SpreadsheetApp.getUi();
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!apiKey) {
      ui.alert('Claude Test', 'CLAUDE_API_KEY nie jest skonfigurowany.', ui.ButtonSet.OK);
      return;
    }
    var result = dsfCallClaudeApi_(apiKey, {
      model: DSF_CLAUDE_MODEL,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Reply with: OK' }]
    });
    ui.alert('Claude Test', 'Polaczenie dziala!\nModel: ' + DSF_CLAUDE_MODEL + '\nOdpowiedz: ' + result.substring(0, 100), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Claude Test', 'Blad: ' + e.message, ui.ButtonSet.OK);
  }
}

// ==================== LEGACY TRIGGER STUB ====================

/**
 * Stub for old installable onEdit trigger — does nothing.
 * Prevents "Script function not found: dsfOnEditInstallable" errors
 * until user runs "Zainstaluj trigger" to clean up old triggers.
 */
function dsfOnEditInstallable(e) {
  // Intentionally empty — old auto-trigger no longer used.
  // Run "Domain Finder > Zainstaluj trigger" to remove this trigger.
}

// ==================== HELPERS ====================

function dsfCleanupProcessQueueTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dsfProcessQueue') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Remove all old onEdit triggers that reference dsfOnEditInstallable.
 * Called from dsfSetupTriggers and can be run manually.
 */
function dsfCleanupOldOnEditTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dsfOnEditInstallable') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  if (removed > 0) {
    dsfLog('INFO', 'Usunieto ' + removed + ' starych triggerow onEdit (dsfOnEditInstallable)');
  }
  return removed;
}
