/**
 * SP-API Authentication & Token Management for WAAS System
 * Handles OAuth token exchange and refresh for Amazon SP-API
 *
 * Credentials stored in Script Properties (alongside PA-API keys):
 * - SP_LWA_CLIENT_ID
 * - SP_LWA_CLIENT_SECRET
 * - SP_REFRESH_TOKEN
 * - SP_SELLER_ID
 *
 * @version 1.1
 * @author NetAnaliza / LUKO
 */

// ==================== SP-API MARKETPLACE CONFIGURATION ====================

const SP_MARKETPLACE_CONFIG = {
  'DE': { marketplaceId: 'A1PA6795UKMFR9', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'de-DE', currency: 'EUR', domain: 'www.amazon.de' },
  'FR': { marketplaceId: 'A13V1IB3VIYZZH', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'fr-FR', currency: 'EUR', domain: 'www.amazon.fr' },
  'IT': { marketplaceId: 'APJ6JRA9NG5V4',  endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'it-IT', currency: 'EUR', domain: 'www.amazon.it' },
  'ES': { marketplaceId: 'A1RKKUPIHCS9HS', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'es-ES', currency: 'EUR', domain: 'www.amazon.es' },
  'UK': { marketplaceId: 'A1F83G8C2ARO7P', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'en-GB', currency: 'GBP', domain: 'www.amazon.co.uk' },
  'NL': { marketplaceId: 'A1805IZSGTT6HS', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'nl-NL', currency: 'EUR', domain: 'www.amazon.nl' },
  'BE': { marketplaceId: 'AMEN7PMS3EDWL',  endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'nl-NL', currency: 'EUR', domain: 'www.amazon.com.be' },
  'PL': { marketplaceId: 'A1C3SOZRARQ6R3', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'pl-PL', currency: 'PLN', domain: 'www.amazon.pl' },
  'SE': { marketplaceId: 'A2NODRKZP88ZB9', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'sv-SE', currency: 'SEK', domain: 'www.amazon.se' },
  'IE': { marketplaceId: 'A1QA6N5NQHZ0EW', endpoint: 'https://sellingpartnerapi-eu.amazon.com', primary: 'en-GB', currency: 'EUR', domain: 'www.amazon.ie' }
};

// ==================== CREDENTIAL MANAGEMENT (Script Properties) ====================

/**
 * Get SP-API credentials from Script Properties
 * (same place as PA_ACCESS_KEY, DIVI_API_KEY, etc.)
 */
function spGetConfig() {
  const props = PropertiesService.getScriptProperties();

  return {
    clientId: props.getProperty('SP_LWA_CLIENT_ID') || '',
    clientSecret: props.getProperty('SP_LWA_CLIENT_SECRET') || '',
    refreshToken: props.getProperty('SP_REFRESH_TOKEN') || '',
    sellerId: props.getProperty('SP_SELLER_ID') || ''
  };
}

/**
 * Check if SP-API credentials are configured
 */
function spHasCredentials() {
  try {
    const config = spGetConfig();
    return !!(config.clientId && config.clientSecret && config.refreshToken);
  } catch (e) {
    return false;
  }
}

// ==================== TOKEN MANAGEMENT ====================

/**
 * Get a fresh access token using the stored refresh token
 * Uses PropertiesService cache to avoid unnecessary token refreshes
 */
function spGetAccessToken() {
  const props = PropertiesService.getScriptProperties();

  const cachedToken = props.getProperty('SP_ACCESS_TOKEN');
  const cachedExpiry = props.getProperty('SP_TOKEN_EXPIRY');

  if (cachedToken && cachedExpiry) {
    const expiryTime = parseInt(cachedExpiry, 10);
    if (Date.now() < expiryTime - (5 * 60 * 1000)) {
      return cachedToken;
    }
  }

  const config = spGetConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error('SP-API credentials not configured.\n\nGo to: WAAS > Settings > SP-API Setup Credentials\n\nOr add manually in Script Properties:\nSP_LWA_CLIENT_ID, SP_LWA_CLIENT_SECRET, SP_REFRESH_TOKEN');
  }

  if (!config.refreshToken) {
    throw new Error('SP-API Refresh Token not configured.\n\nAdd SP_REFRESH_TOKEN in Apps Script > Project Settings > Script Properties');
  }

  const url = 'https://api.amazon.com/auth/o2/token';
  const payload = {
    'grant_type': 'refresh_token',
    'refresh_token': config.refreshToken,
    'client_id': config.clientId,
    'client_secret': config.clientSecret
  };

  const options = {
    'method': 'post',
    'contentType': 'application/x-www-form-urlencoded',
    'payload': payload,
    'muteHttpExceptions': true
  };

  Logger.log('[SP-API AUTH] Refreshing access token...');
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    let errorMsg = `Token refresh failed (HTTP ${responseCode})`;
    try {
      const error = JSON.parse(responseBody);
      errorMsg = error.error_description || error.error || errorMsg;
    } catch (e) {
      errorMsg = responseBody || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const tokens = JSON.parse(responseBody);

  props.setProperty('SP_ACCESS_TOKEN', tokens.access_token);
  props.setProperty('SP_TOKEN_EXPIRY', (Date.now() + (tokens.expires_in * 1000)).toString());

  Logger.log('[SP-API AUTH] Token refreshed successfully');
  return tokens.access_token;
}

/**
 * Clear cached token (force re-auth on next call)
 */
function spClearTokenCache() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SP_ACCESS_TOKEN');
  props.deleteProperty('SP_TOKEN_EXPIRY');
  Logger.log('[SP-API AUTH] Token cache cleared');
}

// ==================== SP-API CALL WRAPPER ====================

/**
 * Make an authenticated call to SP-API
 */
function spCallAPI(method, path, params, accessToken) {
  if (!accessToken) {
    accessToken = spGetAccessToken();
  }

  const endpoint = 'https://sellingpartnerapi-eu.amazon.com';
  let url = endpoint + path;

  if (params && Object.keys(params).length > 0) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    url += '?' + queryString;
  }

  const options = {
    method: method.toLowerCase(),
    headers: {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  Logger.log(`[SP-API] ${method} ${url}`);
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 429) {
    Logger.log('[SP-API] Rate limited (429). Waiting 2 seconds and retrying...');
    Utilities.sleep(2000);
    const retryResponse = UrlFetchApp.fetch(url, options);
    const retryCode = retryResponse.getResponseCode();
    const retryBody = retryResponse.getContentText();

    if (retryCode !== 200) {
      throw new Error(`SP-API Error ${retryCode} (after retry): ${retryBody.substring(0, 300)}`);
    }
    return JSON.parse(retryBody);
  }

  if (responseCode !== 200) {
    let errorMessage = `SP-API Error ${responseCode}`;
    try {
      const error = JSON.parse(responseBody);
      errorMessage = error.errors?.[0]?.message || error.message || errorMessage;
    } catch (e) {
      errorMessage = responseBody.substring(0, 300) || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return JSON.parse(responseBody);
}

// ==================== SETUP & CREDENTIALS UI ====================

/**
 * Setup SP-API credentials - prompts for each key and saves to Script Properties
 */
function spSetupCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const currentConfig = spGetConfig();
  const hasExisting = !!(currentConfig.clientId || currentConfig.refreshToken);

  if (hasExisting) {
    const check = ui.alert('SP-API Credentials',
      'SP-API credentials juz istnieja w Script Properties.\n\n' +
      `Client ID: ${currentConfig.clientId ? currentConfig.clientId.substring(0, 20) + '...' : '(brak)'}\n` +
      `Refresh Token: ${currentConfig.refreshToken ? '***configured***' : '(brak)'}\n` +
      `Seller ID: ${currentConfig.sellerId || '(brak)'}\n\n` +
      'Chcesz je zaktualizowac?',
      ui.ButtonSet.YES_NO);

    if (check !== ui.Button.YES) return;
  }

  // Prompt for each credential
  const fields = [
    { key: 'SP_LWA_CLIENT_ID', label: 'LWA Client ID', current: currentConfig.clientId,
      help: 'Z Amazon Seller Central > Apps & Services > Develop Apps' },
    { key: 'SP_LWA_CLIENT_SECRET', label: 'LWA Client Secret', current: currentConfig.clientSecret,
      help: 'Secret z tej samej aplikacji LWA' },
    { key: 'SP_REFRESH_TOKEN', label: 'Refresh Token', current: currentConfig.refreshToken,
      help: 'Token z procesu autoryzacji SP-API' },
    { key: 'SP_SELLER_ID', label: 'Seller ID', current: currentConfig.sellerId,
      help: 'Twoj Amazon Seller ID (np. A1XXXXXXXXXXXX)' }
  ];

  let updated = 0;
  for (const field of fields) {
    const currentDisplay = field.current ? `Obecna wartosc: ${field.current.substring(0, 15)}...` : 'Brak wartosci';
    const result = ui.prompt(
      `SP-API: ${field.label}`,
      `${field.help}\n\n${currentDisplay}\n\nWpisz nowa wartosc (lub zostaw puste aby pominac):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (result.getSelectedButton() !== ui.Button.OK) break;

    const value = result.getResponseText().trim();
    if (value) {
      props.setProperty(field.key, value);
      updated++;
    }
  }

  if (updated > 0) {
    ui.alert('SP-API Config',
      `Zaktualizowano ${updated} kluczy SP-API w Script Properties.\n\n` +
      'Przetestuj polaczenie:\nWAAS > Products > SP-API Import > Test Connection',
      ui.ButtonSet.OK);
  } else {
    ui.alert('SP-API Config',
      'Nie zaktualizowano zadnych kluczy.\n\n' +
      'Mozesz tez dodac klucze recznie:\n' +
      'Apps Script > Project Settings > Script Properties\n\n' +
      'Klucze: SP_LWA_CLIENT_ID, SP_LWA_CLIENT_SECRET, SP_REFRESH_TOKEN, SP_SELLER_ID',
      ui.ButtonSet.OK);
  }
}

/**
 * Test SP-API connection
 */
function spTestConnection() {
  const ui = SpreadsheetApp.getUi();

  try {
    const config = spGetConfig();
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      ui.alert('Brak danych',
        'SP-API credentials nie sa skonfigurowane.\n\n' +
        'Dodaj w Script Properties (Apps Script > Project Settings):\n' +
        '- SP_LWA_CLIENT_ID\n' +
        '- SP_LWA_CLIENT_SECRET\n' +
        '- SP_REFRESH_TOKEN\n\n' +
        'Lub uruchom: WAAS > Products > SP-API Import > Setup Credentials',
        ui.ButtonSet.OK);
      return;
    }

    spClearTokenCache();
    const startTime = Date.now();
    const accessToken = spGetAccessToken();
    const tokenTime = Date.now() - startTime;

    const mpConfig = SP_MARKETPLACE_CONFIG['DE'];
    const result = spCallAPI('GET', '/catalog/2022-04-01/items', {
      marketplaceIds: mpConfig.marketplaceId,
      keywords: 'test',
      pageSize: 1
    }, accessToken);

    const apiTime = Date.now() - startTime;

    ui.alert('SP-API Test',
      'Polaczenie dziala!\n\n' +
      `Token refresh: ${tokenTime}ms\n` +
      `API call: ${apiTime}ms\n` +
      `Seller ID: ${config.sellerId || 'N/A'}\n` +
      `Marketplace: DE (${mpConfig.marketplaceId})\n\n` +
      'SP-API jest gotowe do uzycia.',
      ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('SP-API Error',
      `Test nie powiodl sie:\n\n${error.message}\n\n` +
      'Sprawdz:\n' +
      '1. LWA Client ID i Secret sa poprawne\n' +
      '2. Refresh Token jest aktualny\n' +
      '3. Aplikacja ma dostep do SP-API',
      ui.ButtonSet.OK);
  }
}

/**
 * Show marketplace selection dialog for SP-API
 */
function spShowMarketplaceSelector() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'SP-API: Wybierz Marketplace',
    'Wpisz kod marketplace:\n\n' +
    'DE - Niemcy (domyslnie)\n' +
    'FR - Francja\n' +
    'UK - Wielka Brytania\n' +
    'IT - Wlochy\n' +
    'ES - Hiszpania\n' +
    'NL - Holandia\n' +
    'BE - Belgia\n' +
    'PL - Polska\n' +
    'SE - Szwecja\n' +
    'IE - Irlandia',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return null;

  let marketplace = response.getResponseText().trim().toUpperCase();
  if (!marketplace) marketplace = 'DE';

  if (!SP_MARKETPLACE_CONFIG[marketplace]) {
    ui.alert('Blad', `Nieprawidlowy marketplace: ${marketplace}\n\nDostepne: ${Object.keys(SP_MARKETPLACE_CONFIG).join(', ')}`, ui.ButtonSet.OK);
    return null;
  }

  return marketplace;
}
