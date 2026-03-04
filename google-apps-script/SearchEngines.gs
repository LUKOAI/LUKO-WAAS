/**
 * ============================================================================
 * WAAS Search Engines Module
 * ============================================================================
 *
 * Google Search Console API + Bing Webmaster API integration.
 *
 * GSC: Uses OAuth2 via ScriptApp.getOAuthToken()
 *   Scope: https://www.googleapis.com/auth/webmasters
 *
 * Bing: Uses API key from Script Properties ('bing_webmaster_key')
 *   Get key from: https://www.bing.com/webmasters/apikey
 *
 * Existing functions used (DO NOT redefine):
 *   - getSiteById(siteId)
 *   - logInfo/logError/logSuccess/logWarning
 *   - getAPIKey(keyName)
 *   - addGSCVerification(site, verificationCode) — from SiteCleanup.gs
 *   - addBingVerification(site, verificationCode) — from SiteCleanup.gs
 *
 * @version 3.0.0
 */

// =============================================================================
// GOOGLE SEARCH CONSOLE API
// =============================================================================

/**
 * Dodaje stronę do Google Search Console.
 * Wymaga: OAuth scope webmasters
 */
function registerSiteInGSC(site) {
  var siteUrl = 'https://' + site.domain + '/';
  logInfo('GSC', 'Registering site: ' + siteUrl, site.id);

  var response = UrlFetchApp.fetch(
    'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(siteUrl),
    {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }
  );

  var code = response.getResponseCode();
  if (code === 204 || code === 200) {
    logSuccess('GSC', 'Site registered: ' + siteUrl, site.id);
    return { success: true };
  } else {
    logError('GSC', 'Registration failed: ' + response.getContentText(), site.id);
    return { success: false, error: response.getContentText() };
  }
}

/**
 * Wysyła sitemap do GSC
 */
function submitSitemapToGSC(site) {
  var siteUrl = 'https://' + site.domain + '/';
  var sitemapUrl = siteUrl + 'sitemap_index.xml';
  logInfo('GSC', 'Submitting sitemap: ' + sitemapUrl, site.id);

  var response = UrlFetchApp.fetch(
    'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(siteUrl)
    + '/sitemaps/' + encodeURIComponent(sitemapUrl),
    {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }
  );

  var code = response.getResponseCode();
  if (code === 204 || code === 200) {
    logSuccess('GSC', 'Sitemap submitted: ' + sitemapUrl, site.id);
    return { success: true };
  }
  logError('GSC', 'Sitemap failed: ' + response.getContentText(), site.id);
  return { success: false, error: response.getContentText() };
}

/**
 * Dodaje verification meta tag + rejestruje + submits sitemap.
 * verificationCode — z GSC panel (np. "google1234567890abcdef")
 */
function setupGSCForSite(site, verificationCode) {
  var results = {};

  // 1. Dodaj meta tag verification (przez waas-settings endpoint)
  if (verificationCode) {
    results.verify = addGSCVerification(site, verificationCode); // z SiteCleanup.gs
  }

  // 2. Zarejestruj stronę
  results.register = registerSiteInGSC(site);

  // 3. Wyślij sitemap
  results.sitemap = submitSitemapToGSC(site);

  return results;
}

// =============================================================================
// BING WEBMASTER API
// =============================================================================

/**
 * Dodaje stronę do Bing Webmaster Tools
 */
function registerSiteInBing(site) {
  var apiKey = getAPIKey('bing_webmaster_key');
  if (!apiKey) {
    logWarning('BING', 'No Bing API key configured', site.id);
    return { success: false, error: 'No Bing API key. Set bing_webmaster_key in Script Properties.' };
  }

  var siteUrl = 'https://' + site.domain;
  logInfo('BING', 'Registering site: ' + siteUrl, site.id);

  var response = UrlFetchApp.fetch(
    'https://ssl.bing.com/webmaster/api.svc/json/AddSite?apikey=' + apiKey,
    {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ siteUrl: siteUrl }),
      muteHttpExceptions: true
    }
  );

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 200) {
    // Bing returns 200 even for "already exists" — check response
    if (body.indexOf('already exists') > -1 || body.indexOf('AlreadyExists') > -1) {
      logInfo('BING', 'Site already registered in Bing', site.id);
      return { success: true, note: 'already_exists' };
    }
    logSuccess('BING', 'Site registered in Bing: ' + siteUrl, site.id);
    return { success: true };
  }
  logError('BING', 'Registration failed: ' + body, site.id);
  return { success: false, error: body };
}

/**
 * Wysyła sitemap do Bing
 */
function submitSitemapToBing(site) {
  var apiKey = getAPIKey('bing_webmaster_key');
  if (!apiKey) return { success: false, error: 'No Bing API key' };

  var siteUrl = 'https://' + site.domain;
  var sitemapUrl = siteUrl + '/sitemap_index.xml';

  var response = UrlFetchApp.fetch(
    'https://ssl.bing.com/webmaster/api.svc/json/SubmitFeed?apikey=' + apiKey,
    {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ siteUrl: siteUrl, feedUrl: sitemapUrl }),
      muteHttpExceptions: true
    }
  );

  var code = response.getResponseCode();
  if (code === 200) {
    logSuccess('BING', 'Sitemap submitted to Bing: ' + sitemapUrl, site.id);
    return { success: true };
  }
  logError('BING', 'Sitemap failed: ' + response.getContentText(), site.id);
  return { success: false, error: response.getContentText() };
}

/**
 * Pełny setup Bing: verification + register + sitemap
 */
function setupBingForSite(site, verificationCode) {
  var results = {};
  if (verificationCode) {
    results.verify = addBingVerification(site, verificationCode);
  }
  results.register = registerSiteInBing(site);
  results.sitemap = submitSitemapToBing(site);
  return results;
}

// =============================================================================
// ZBIORCZE FUNKCJE
// =============================================================================

/**
 * Rejestruje stronę we WSZYSTKICH wyszukiwarkach
 */
function registerInAllSearchEngines(site) {
  logInfo('SEARCH_ENGINES', 'Registering in all search engines: ' + site.domain, site.id);
  var results = {};
  
  // GSC — may fail if API not enabled in GCP project
  try {
    results.gsc = registerSiteInGSC(site);
  } catch (e) {
    logWarning('GSC', 'Registration error (non-fatal): ' + e.message, site.id);
    results.gsc = { success: false, error: e.message };
  }
  
  try {
    results.gscSitemap = submitSitemapToGSC(site);
  } catch (e) {
    logWarning('GSC', 'Sitemap error (non-fatal): ' + e.message, site.id);
    results.gscSitemap = { success: false, error: e.message };
  }
  
  // Bing — may fail if no API key configured
  try {
    results.bing = registerSiteInBing(site);
  } catch (e) {
    logWarning('BING', 'Registration skipped: ' + e.message, site.id);
    results.bing = { success: false, error: e.message };
  }
  
  try {
    results.bingSitemap = submitSitemapToBing(site);
  } catch (e) {
    logWarning('BING', 'Sitemap skipped: ' + e.message, site.id);
    results.bingSitemap = { success: false, error: e.message };
  }
  
  // Count successes
  var total = Object.keys(results).length;
  var ok = Object.values(results).filter(function(r) { return r && r.success; }).length;
  logSuccess('SEARCH_ENGINES', ok + '/' + total + ' registrations succeeded', site.id);
  
  return results;
}

// =============================================================================
// DIALOGI MENU
// =============================================================================

function gscRegisterDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('GSC Registration', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(result.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r = registerSiteInGSC(site);
  ui.alert(r.success ? 'Zarejestrowano w GSC!' : 'Błąd: ' + r.error);
}

function gscSitemapDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('GSC Sitemap', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(result.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r = submitSitemapToGSC(site);
  ui.alert(r.success ? 'Sitemap wysłany do GSC!' : 'Błąd: ' + r.error);
}

function bingRegisterDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Bing Registration', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(result.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r = registerSiteInBing(site);
  ui.alert(r.success ? 'Zarejestrowano w Bing!' : 'Błąd: ' + r.error);
}

function bingSitemapDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Bing Sitemap', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(result.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r = submitSitemapToBing(site);
  ui.alert(r.success ? 'Sitemap wysłany do Bing!' : 'Błąd: ' + r.error);
}

function gscVerifyDialog() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('GSC Verify', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(r1.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r2 = ui.prompt('GSC Verify', 'Verification code (np. google1234abcd):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;

  var r = addGSCVerification(site, r2.getResponseText().trim());
  ui.alert(r.success ? 'Meta tag dodany!' : 'Błąd: ' + (r.error || 'unknown'));
}

function bingVerifyDialog() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('Bing Verify', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var site = getSiteById(r1.getResponseText().trim());
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var r2 = ui.prompt('Bing Verify', 'Verification code:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;

  var r = addBingVerification(site, r2.getResponseText().trim());
  ui.alert(r.success ? 'Bing verification dodany!' : 'Błąd: ' + (r.error || 'unknown'));
}
