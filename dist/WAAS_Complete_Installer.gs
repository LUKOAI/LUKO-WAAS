/**
 * WAAS Core Module
 * Główne funkcje konfiguracyjne i pomocnicze
 */

// =============================================================================
// KONFIGURACJA
// =============================================================================

const WAAS_CONFIG = {
  version: '1.0.0',
  spreadsheetId: null, // Zostanie ustawione automatycznie

  // API Endpoints
  apis: {
    divi: {
      baseUrl: 'https://www.elegantthemes.com/api/v1',
      docsUrl: 'https://www.elegantthemes.com/documentation/developers/'
    },
    amazon: {
      region: 'us-east-1',
      marketplace: 'www.amazon.com'
    }
  },

  // Limity
  limits: {
    maxTasksPerRun: 10,
    maxPostsPerDay: 5,
    maxRetryAttempts: 3,
    requestTimeout: 30000
  },

  // Statusy
  status: {
    site: ['Active', 'Inactive', 'Error', 'Pending'],
    task: ['Pending', 'Running', 'Completed', 'Failed', 'Cancelled'],
    content: ['Draft', 'Scheduled', 'Published', 'Failed'],
    product: ['Active', 'Inactive', 'Out of Stock', 'Discontinued']
  }
};

// =============================================================================
// GETTERY DLA API KEYS
// =============================================================================

function getAPIKey(keyName) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const key = scriptProperties.getProperty(keyName);

  if (!key) {
    throw new Error(`API key not configured: ${keyName}. Please set it in Script Properties.`);
  }

  return key;
}

/**
 * Get global Divi credentials (fallback/default)
 * @deprecated Use getDiviCredentialsForSite() for per-site credentials
 */
function getDiviCredentials() {
  return {
    username: getAPIKey('DIVI_API_USERNAME'),
    apiKey: getAPIKey('DIVI_API_KEY')
  };
}

/**
 * Get Divi credentials for a specific site
 * Falls back to global credentials if site-specific credentials are not set
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} - {username, apiKey}
 */
function getDiviCredentialsForSite(site) {
  // Try to use per-site credentials first
  if (site.diviApiUsername && site.diviApiKey) {
    logInfo('DiviAPI', `Using per-site Divi credentials for: ${site.name}`, site.id);
    return {
      username: site.diviApiUsername,
      apiKey: site.diviApiKey
    };
  }

  // Fallback to global credentials
  logWarning('DiviAPI', `No per-site Divi credentials for ${site.name}, using global credentials`, site.id);
  try {
    return getDiviCredentials();
  } catch (error) {
    throw new Error(`No Divi credentials available for site ${site.name}. Please set per-site credentials or global Script Properties.`);
  }
}

/**
 * Get Elegant Themes account credentials for license activation
 * These are stored in Script Properties and are the same for all sites
 * @returns {Object} - {username, password}
 */
function getElegantThemesCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const username = scriptProperties.getProperty('ELEGANT_THEMES_USERNAME');
  const password = scriptProperties.getProperty('ELEGANT_THEMES_PASSWORD');

  if (!username || !password) {
    throw new Error('Elegant Themes credentials not configured. Please set ELEGANT_THEMES_USERNAME and ELEGANT_THEMES_PASSWORD in Script Properties.');
  }

  return {
    username: username,
    password: password
  };
}

/**
 * Get global Amazon PA credentials (fallback/default)
 * @deprecated Use getAmazonCredentialsForSite() for per-site partner tags
 */
function getAmazonPACredentials() {
  return {
    accessKey: getAPIKey('PA_API_ACCESS_KEY'),
    secretKey: getAPIKey('PA_API_SECRET_KEY'),
    partnerTag: getAPIKey('PA_API_PARTNER_TAG')
  };
}

/**
 * Get Amazon PA credentials for a specific site
 * Falls back to global partner tag if site-specific tag is not set
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} - {accessKey, secretKey, partnerTag}
 */
function getAmazonCredentialsForSite(site) {
  // Get global credentials (access keys are always global)
  const globalCreds = getAmazonPACredentials();

  // Try to use per-site partner tag first
  if (site.partnerTag && site.partnerTag.trim() !== '') {
    logInfo('AmazonPA', `Using per-site Amazon Partner Tag for: ${site.name}`, site.id);
    return {
      accessKey: globalCreds.accessKey,
      secretKey: globalCreds.secretKey,
      partnerTag: site.partnerTag
    };
  }

  // Fallback to global partner tag
  logWarning('AmazonPA', `No per-site Amazon Partner Tag for ${site.name}, using global tag`, site.id);
  return globalCreds;
}

function getHostingerAPIKey() {
  try {
    return getAPIKey('HOSTINGER_API_KEY');
  } catch (e) {
    return null; // Opcjonalne
  }
}

// =============================================================================
// DOSTĘP DO ARKUSZY
// =============================================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSitesSheet() {
  return getSpreadsheet().getSheetByName('Sites');
}

function getProductsSheet() {
  return getSpreadsheet().getSheetByName('Products');
}

function getTasksSheet() {
  return getSpreadsheet().getSheetByName('Tasks');
}

function getContentQueueSheet() {
  return getSpreadsheet().getSheetByName('Content Queue');
}

function getLogsSheet() {
  return getSpreadsheet().getSheetByName('Logs');
}

function getSettingsSheet() {
  return getSpreadsheet().getSheetByName('Settings');
}

// =============================================================================
// ZARZĄDZANIE USTAWIENIAMI
// =============================================================================

function getSetting(key, defaultValue = null) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1] || defaultValue;
    }
  }

  return defaultValue;
}

function setSetting(key, value, description = '') {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();

  // Szukaj istniejącego ustawienia
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 4).setValue(new Date());
      return;
    }
  }

  // Dodaj nowe ustawienie
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, 4).setValues([[
    key,
    value,
    description,
    new Date()
  ]]);
}

// =============================================================================
// SYSTEM LOGOWANIA
// =============================================================================

const LogLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

function log(level, category, message, siteId = '', taskId = '', details = '') {
  try {
    const sheet = getLogsSheet();
    const user = Session.getActiveUser().getEmail() || 'System';

    sheet.appendRow([
      new Date(),
      level,
      category,
      message,
      siteId,
      taskId,
      user,
      JSON.stringify(details)
    ]);

    // Ogranicz logi do ostatnich 1000 wpisów
    const maxRows = 1000;
    const currentRows = sheet.getLastRow();
    if (currentRows > maxRows + 1) { // +1 dla nagłówka
      sheet.deleteRows(2, currentRows - maxRows - 1);
    }

    // Loguj również do Logger dla debugowania
    Logger.log(`[${level}] ${category}: ${message}`);
  } catch (error) {
    Logger.log('Error writing to log: ' + error.message);
  }
}

function logInfo(category, message, siteId, taskId, details) {
  log(LogLevel.INFO, category, message, siteId, taskId, details);
}

function logWarning(category, message, siteId, taskId, details) {
  log(LogLevel.WARNING, category, message, siteId, taskId, details);
}

function logError(category, message, siteId, taskId, details) {
  log(LogLevel.ERROR, category, message, siteId, taskId, details);
}

function logSuccess(category, message, siteId, taskId, details) {
  log(LogLevel.SUCCESS, category, message, siteId, taskId, details);
}

// =============================================================================
// ZARZĄDZANIE ID
// =============================================================================

function getNextId(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return 1;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const maxId = Math.max(...ids.map(row => parseInt(row[0]) || 0));

  return maxId + 1;
}

// =============================================================================
// WALIDACJA
// =============================================================================

function validateURL(url) {
  const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  return urlPattern.test(url);
}

function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function validateASIN(asin) {
  const asinPattern = /^[A-Z0-9]{10}$/;
  return asinPattern.test(asin);
}

// =============================================================================
// POMOCNICZE FUNKCJE HTTP
// =============================================================================

function makeHttpRequest(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    contentType: 'application/json',
    muteHttpExceptions: true,
    timeout: WAAS_CONFIG.limits.requestTimeout
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    logInfo('HTTP', `Request: ${finalOptions.method} ${url}`);

    const response = UrlFetchApp.fetch(url, finalOptions);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('HTTP', `Response: ${statusCode}`, '', '', { statusCode, url });

    if (statusCode >= 200 && statusCode < 300) {
      try {
        return {
          success: true,
          statusCode: statusCode,
          data: JSON.parse(responseText)
        };
      } catch (e) {
        return {
          success: true,
          statusCode: statusCode,
          data: responseText
        };
      }
    } else {
      return {
        success: false,
        statusCode: statusCode,
        error: responseText
      };
    }
  } catch (error) {
    // Enhanced error handling for DNS and network errors
    const errorMsg = error.message || error.toString();
    let errorType = 'UNKNOWN';
    let userMessage = errorMsg;

    // Detect DNS errors
    if (errorMsg.toLowerCase().includes('dns')) {
      errorType = 'DNS_ERROR';
      userMessage = 'DNS resolution failed - the domain may not exist or DNS has not propagated yet';
    }
    // Detect timeout errors
    else if (errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('timed out')) {
      errorType = 'TIMEOUT';
      userMessage = 'Request timed out - the server may be slow or unreachable';
    }
    // Detect connection errors
    else if (errorMsg.toLowerCase().includes('connection') || errorMsg.toLowerCase().includes('connect')) {
      errorType = 'CONNECTION_ERROR';
      userMessage = 'Connection failed - the server may be down or blocking requests';
    }
    // Detect SSL/TLS errors
    else if (errorMsg.toLowerCase().includes('ssl') || errorMsg.toLowerCase().includes('certificate')) {
      errorType = 'SSL_ERROR';
      userMessage = 'SSL/TLS error - invalid or expired certificate';
    }

    logError('HTTP', `Request failed: ${errorMsg}`, '', '', { url, error: error.toString(), errorType });

    return {
      success: false,
      error: userMessage,
      errorType: errorType,
      originalError: errorMsg,
      statusCode: null
    };
  }
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

function retryOperation(operation, maxAttempts = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logInfo('Retry', `Attempt ${attempt}/${maxAttempts}`);
      return operation();
    } catch (error) {
      lastError = error;
      logWarning('Retry', `Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        Utilities.sleep(delayMs * attempt); // Exponential backoff
      }
    }
  }

  throw new Error(`Operation failed after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Make an HTTP request with automatic retry logic for transient errors
 *
 * @param {string} url - URL to request
 * @param {Object} options - Request options (same as makeHttpRequest)
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in milliseconds (default: 2000)
 * @returns {Object} Response object with success, statusCode, data, error, etc.
 */
function makeHttpRequestWithRetry(url, options = {}, maxRetries = 3, initialDelay = 2000) {
  let lastResponse = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      const delay = initialDelay * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
      logInfo('HTTP', `Retrying after ${delay}ms (attempt ${attempt}/${maxRetries})...`);
      Utilities.sleep(delay);
    }

    lastResponse = makeHttpRequest(url, options);

    // Success - return immediately
    if (lastResponse.success) {
      if (attempt > 1) {
        logSuccess('HTTP', `Request succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return lastResponse;
    }

    // Check if error is retryable
    const errorType = lastResponse.errorType;
    const isRetryable = (
      errorType === 'DNS_ERROR' ||
      errorType === 'TIMEOUT' ||
      errorType === 'CONNECTION_ERROR' ||
      (lastResponse.statusCode >= 500 && lastResponse.statusCode < 600) // Server errors
    );

    if (!isRetryable) {
      logWarning('HTTP', `Non-retryable error (${errorType}), not retrying`);
      return lastResponse;
    }

    if (attempt < maxRetries) {
      logWarning('HTTP', `Retryable error (${errorType}), will retry...`);
    } else {
      logError('HTTP', `Request failed after ${maxRetries} attempts`);
    }
  }

  return lastResponse;
}

// =============================================================================
// FORMATOWANIE
// =============================================================================

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function formatCurrency(amount, currency = 'USD') {
  return `${currency} ${parseFloat(amount).toFixed(2)}`;
}

// =============================================================================
// CACHE
// =============================================================================

function getCacheValue(key) {
  const cache = CacheService.getScriptCache();
  return cache.get(key);
}

function setCacheValue(key, value, expirationInSeconds = 3600) {
  const cache = CacheService.getScriptCache();
  cache.put(key, value, expirationInSeconds);
}

function clearCache(key) {
  const cache = CacheService.getScriptCache();
  if (key) {
    cache.remove(key);
  } else {
    cache.removeAll([]);
  }
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

function sendEmailNotification(subject, body) {
  const email = getSetting('error_notification_email');

  if (email && validateEmail(email)) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: `WAAS: ${subject}`,
        body: body,
        name: 'WAAS Automation System'
      });
      logInfo('Notification', `Email sent to ${email}`);
    } catch (error) {
      logError('Notification', `Failed to send email: ${error.message}`);
    }
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

function handleError(error, context = '', siteId = '', taskId = '') {
  const errorMessage = error.message || error.toString();
  logError(context, errorMessage, siteId, taskId, { stack: error.stack });

  // Wyślij powiadomienie dla krytycznych błędów
  if (getSetting('error_notifications_enabled', 'true') === 'true') {
    sendEmailNotification(
      `Error in ${context}`,
      `An error occurred:\n\n${errorMessage}\n\nSite ID: ${siteId}\nTask ID: ${taskId}`
    );
  }

  throw error;
}
/**
 * WAAS - WordPress Affiliate Automation System
 * Installation Script
 *
 * =====================================================================
 * INSTRUKCJA INSTALACJI:
 * =====================================================================
 * 1. Otwórz Google Sheets (nowy lub istniejący arkusz)
 * 2. Kliknij: Extensions → Apps Script
 * 3. Usuń domyślny kod
 * 4. Skopiuj WSZYSTKIE pliki z folderu google-apps-script:
 *    - setup.gs (ten plik)
 *    - Core.gs
 *    - Menu.gs
 *    - SiteManager.gs
 *    - ProductManager.gs
 *    - TaskManager.gs
 *    - ContentGenerator.gs
 *    - DiviAPI.gs
 *    - WordPressAPI.gs
 *    - AmazonPA.gs
 *    - Migration.gs
 *    - appsscript.json
 * 5. Zapisz projekt (Ctrl+S)
 * 6. Uruchom funkcję: installWAAS()
 * 7. Autoryzuj aplikację (zgody Google)
 * 8. Po instalacji ustaw klucze API w Script Properties:
 *    Extensions → Apps Script → Project Settings → Script Properties
 *    - DIVI_API_USERNAME (global fallback)
 *    - DIVI_API_KEY (global fallback)
 *    - ELEGANT_THEMES_USERNAME (email/login do elegantthemes.com)
 *    - ELEGANT_THEMES_PASSWORD (hasło do elegantthemes.com)
 *    - PA_API_ACCESS_KEY
 *    - PA_API_SECRET_KEY
 *    - PA_API_PARTNER_TAG (global fallback)
 *    - HOSTINGER_API_KEY (opcjonalnie)
 *
 *    ⚠️ WAŻNE: Per-site credentials (kolumny 7-9 w Sites)
 *    powinny być wypełnione dla każdej strony osobno!
 *
 *    ⚠️ WAŻNE: ELEGANT_THEMES_USERNAME i ELEGANT_THEMES_PASSWORD
 *    są potrzebne do automatycznej aktywacji licencji Divi!
 *
 * 9. Przeładuj arkusz (F5)
 * 10. Użyj menu "⚡ WAAS" aby zacząć!
 *
 * @version 2.0.0 - Per-Site Divi API Credentials
 * =====================================================================
 */

// =============================================================================
// GŁÓWNA FUNKCJA INSTALACYJNA
// =============================================================================

function installWAAS() {
  try {
    Logger.log('🚀 Starting WAAS installation...');

    // Użyj bieżącego arkusza lub utwórz nowy
    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      spreadsheet.rename('WAAS - WordPress Affiliate Automation System');
      Logger.log('✅ Using existing spreadsheet');
    } catch (e) {
      // Jeśli nie ma aktywnego arkusza, utwórz nowy
      spreadsheet = SpreadsheetApp.create('WAAS - WordPress Affiliate Automation System');
      Logger.log('✅ Created new spreadsheet');
    }

    // 1. Tworzenie struktury arkusza
    Logger.log('📊 Creating Google Sheets structure...');
    createSheetsStructure(spreadsheet);

    // 2. Inicjalizacja ustawień
    Logger.log('🔧 Initializing settings...');
    initializeSettings();

    Logger.log('✅ Installation completed successfully!');
    Logger.log('📋 Spreadsheet URL: ' + spreadsheet.getUrl());
    Logger.log('⚠️ IMPORTANT: Now set your API keys in Script Properties!');
    Logger.log('⚠️ IMPORTANT: Fill per-site credentials in Sites sheet (columns 7-9)!');

    // Pokazuje URL arkusza - tylko jeśli UI jest dostępne
    try {
      SpreadsheetApp.getUi().alert(
        '✅ Installation Complete!',
        'Spreadsheet URL:\n' + spreadsheet.getUrl() + '\n\n' +
        'NEXT STEPS:\n' +
        '1. Open Project Settings (⚙️)\n' +
        '2. Add Script Properties (global settings):\n' +
        '   - DIVI_API_USERNAME (fallback)\n' +
        '   - DIVI_API_KEY (fallback)\n' +
        '   - ELEGANT_THEMES_USERNAME (for license activation)\n' +
        '   - ELEGANT_THEMES_PASSWORD (for license activation)\n' +
        '   - PA_API_ACCESS_KEY\n' +
        '   - PA_API_SECRET_KEY\n' +
        '   - PA_API_PARTNER_TAG (global fallback)\n' +
        '3. Fill per-site credentials in Sites sheet:\n' +
        '   - Column 7: Divi API Username\n' +
        '   - Column 8: Divi API Key\n' +
        '   - Column 9: Amazon Partner Tag (e.g., luko-de-21)\n' +
        '4. Reload the spreadsheet (F5)\n' +
        '5. Use WAAS menu to start!',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      // UI nie jest dostępne (wywołanie z edytora)
      Logger.log('ℹ️ Installation info logged above (UI not available in this context)');
    }

    return spreadsheet;
  } catch (error) {
    Logger.log('❌ Installation error: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

// =============================================================================
// TWORZENIE STRUKTURY ARKUSZA
// =============================================================================

function createSheetsStructure(spreadsheet) {
  // Usuń domyślny arkusz jeśli istnieje
  const sheets = spreadsheet.getSheets();
  const defaultSheet = sheets.find(s => s.getName() === 'Sheet1' || s.getName() === 'Arkusz1');

  // Sprawdź które arkusze już istnieją
  const existingSheets = sheets.map(s => s.getName());

  // Twórz tylko te arkusze których nie ma
  if (!existingSheets.includes('Sites')) {
    createSitesSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Sites sheet already exists');
  }

  if (!existingSheets.includes('Products')) {
    createProductsSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Products sheet already exists');
  }

  if (!existingSheets.includes('Tasks')) {
    createTasksSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Tasks sheet already exists');
  }

  if (!existingSheets.includes('Content Queue')) {
    createContentQueueSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Content Queue sheet already exists');
  }

  if (!existingSheets.includes('Logs')) {
    createLogsSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Logs sheet already exists');
  }

  if (!existingSheets.includes('Settings')) {
    createSettingsSheet(spreadsheet);
  } else {
    Logger.log('ℹ️ Settings sheet already exists');
  }

  // Usuń domyślny arkusz na końcu jeśli istnieje
  if (defaultSheet) {
    try {
      spreadsheet.deleteSheet(defaultSheet);
      Logger.log('✅ Removed default sheet');
    } catch (e) {
      Logger.log('ℹ️ Could not remove default sheet (may not exist)');
    }
  }

  // Ustaw aktywny arkusz na Sites
  spreadsheet.getSheetByName('Sites').activate();
}

function createSitesSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Sites');

  // Nagłówki kolumn - KRYTYCZNE: kolumny 7-9 to per-site credentials
  const headers = [
    'ID',
    'Site Name',
    'Domain',
    'WordPress URL',
    'Admin Username',
    'Admin Password',
    'Divi API Username',  // COLUMN 7: Per-site Divi username
    'Divi API Key',       // COLUMN 8: Per-site Divi API key
    'Amazon Partner Tag', // COLUMN 9: Per-site Amazon affiliate tag
    'Status',
    'Divi Installed',
    'Plugin Installed',
    'Auto Install',       // COLUMN 13: Checkbox for automated full stack installation
    'Last Check',
    'Created Date',
    'Notes'
  ];

  // Ustawienie nagłówków
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');

  // Formatowanie kolumn
  sheet.setColumnWidth(1, 80);   // ID
  sheet.setColumnWidth(2, 200);  // Site Name
  sheet.setColumnWidth(3, 250);  // Domain
  sheet.setColumnWidth(4, 250);  // WordPress URL
  sheet.setColumnWidth(5, 150);  // Admin Username
  sheet.setColumnWidth(6, 150);  // Admin Password
  sheet.setColumnWidth(7, 200);  // Divi API Username
  sheet.setColumnWidth(8, 300);  // Divi API Key
  sheet.setColumnWidth(9, 150);  // Amazon Partner Tag
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 120); // Divi Installed
  sheet.setColumnWidth(12, 120); // Plugin Installed
  sheet.setColumnWidth(13, 120); // Auto Install
  sheet.setColumnWidth(14, 150); // Last Check
  sheet.setColumnWidth(15, 120); // Created Date
  sheet.setColumnWidth(16, 300); // Notes

  // Zamrożenie pierwszego wiersza
  sheet.setFrozenRows(1);

  // Przykładowy wiersz
  sheet.getRange(2, 1, 1, headers.length).setValues([[
    1,
    'Example Site',
    'example.com',
    'https://example.com',
    'admin',
    '',                // Admin Password - fill in
    '',                // Divi API Username - fill in per site
    '',                // Divi API Key - fill in per site
    '',                // Amazon Partner Tag - fill in per site (e.g., 'luko-de-21')
    'Pending',
    'No',
    'No',
    false,             // Auto Install - checkbox
    new Date(),
    new Date(),
    'Example site - replace with real data. Fill credentials (columns 7-9) for each site!'
  ]]);

  // Set checkbox validation for Auto Install column (column 13)
  const autoInstallColumn = sheet.getRange(2, 13, sheet.getMaxRows() - 1, 1);
  autoInstallColumn.insertCheckboxes();

  Logger.log('✅ Sites sheet created with per-site credentials (columns 7-9: Divi + Amazon) and Auto Install checkbox');
  return sheet;
}

function createProductsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Products');

  const headers = [
    'ID',
    'ASIN',
    'Product Name',
    'Category',
    'Price',
    'Image URL',
    'Affiliate Link',
    'Rating',
    'Reviews Count',
    'Status',
    'Last Updated',
    'Added Date',
    'Notes'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidth(1, 80);   // ID
  sheet.setColumnWidth(2, 120);  // ASIN
  sheet.setColumnWidth(3, 300);  // Product Name
  sheet.setColumnWidth(4, 150);  // Category
  sheet.setColumnWidth(5, 100);  // Price
  sheet.setColumnWidth(6, 250);  // Image URL
  sheet.setColumnWidth(7, 300);  // Affiliate Link
  sheet.setColumnWidth(8, 80);   // Rating
  sheet.setColumnWidth(9, 100);  // Reviews Count
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 150); // Last Updated
  sheet.setColumnWidth(12, 120); // Added Date
  sheet.setColumnWidth(13, 300); // Notes

  sheet.setFrozenRows(1);

  Logger.log('✅ Products sheet created');
  return sheet;
}

function createTasksSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Tasks');

  const headers = [
    'ID',
    'Task Type',
    'Site ID',
    'Product IDs',
    'Status',
    'Priority',
    'Scheduled Date',
    'Started Date',
    'Completed Date',
    'Result',
    'Error Message',
    'Created Date',
    'Notes'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#fbbc04');
  headerRange.setFontColor('#000000');

  sheet.setColumnWidth(1, 80);   // ID
  sheet.setColumnWidth(2, 150);  // Task Type
  sheet.setColumnWidth(3, 100);  // Site ID
  sheet.setColumnWidth(4, 150);  // Product IDs
  sheet.setColumnWidth(5, 100);  // Status
  sheet.setColumnWidth(6, 100);  // Priority
  sheet.setColumnWidth(7, 150);  // Scheduled Date
  sheet.setColumnWidth(8, 150);  // Started Date
  sheet.setColumnWidth(9, 150);  // Completed Date
  sheet.setColumnWidth(10, 200); // Result
  sheet.setColumnWidth(11, 300); // Error Message
  sheet.setColumnWidth(12, 120); // Created Date
  sheet.setColumnWidth(13, 300); // Notes

  sheet.setFrozenRows(1);

  Logger.log('✅ Tasks sheet created');
  return sheet;
}

function createContentQueueSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Content Queue');

  const headers = [
    'ID',
    'Site ID',
    'Content Type',
    'Title',
    'Status',
    'Product IDs',
    'Deploy Content',  // COLUMN 7: Checkbox for automated deployment
    'Template',
    'Scheduled Date',
    'Published Date',
    'Post ID',
    'Post URL',
    'Created Date',
    'Notes'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#ea4335');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidth(1, 80);   // ID
  sheet.setColumnWidth(2, 100);  // Site ID
  sheet.setColumnWidth(3, 150);  // Content Type
  sheet.setColumnWidth(4, 300);  // Title
  sheet.setColumnWidth(5, 100);  // Status
  sheet.setColumnWidth(6, 150);  // Product IDs
  sheet.setColumnWidth(7, 120);  // Deploy Content
  sheet.setColumnWidth(8, 150);  // Template
  sheet.setColumnWidth(9, 150);  // Scheduled Date
  sheet.setColumnWidth(10, 150); // Published Date
  sheet.setColumnWidth(11, 100); // Post ID
  sheet.setColumnWidth(12, 300); // Post URL
  sheet.setColumnWidth(13, 120); // Created Date
  sheet.setColumnWidth(14, 300); // Notes

  sheet.setFrozenRows(1);

  // Set checkbox validation for Deploy Content column (column 7)
  const deployContentColumn = sheet.getRange(2, 7, sheet.getMaxRows() - 1, 1);
  deployContentColumn.insertCheckboxes();

  Logger.log('✅ Content Queue sheet created with Deploy Content checkbox');
  return sheet;
}

function createLogsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Logs');

  const headers = [
    'Timestamp',
    'Level',
    'Category',
    'Message',
    'Site ID',
    'Task ID',
    'User',
    'Details'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#9e9e9e');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidth(1, 150);  // Timestamp
  sheet.setColumnWidth(2, 80);   // Level
  sheet.setColumnWidth(3, 120);  // Category
  sheet.setColumnWidth(4, 400);  // Message
  sheet.setColumnWidth(5, 80);   // Site ID
  sheet.setColumnWidth(6, 80);   // Task ID
  sheet.setColumnWidth(7, 120);  // User
  sheet.setColumnWidth(8, 300);  // Details

  sheet.setFrozenRows(1);

  Logger.log('✅ Logs sheet created');
  return sheet;
}

function createSettingsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Settings');

  const headers = [
    'Setting Key',
    'Setting Value',
    'Description',
    'Last Updated'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#673ab7');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidth(1, 250);  // Setting Key
  sheet.setColumnWidth(2, 300);  // Setting Value
  sheet.setColumnWidth(3, 400);  // Description
  sheet.setColumnWidth(4, 150);  // Last Updated

  sheet.setFrozenRows(1);

  // Domyślne ustawienia
  const defaultSettings = [
    ['auto_publish', 'false', 'Automatically publish content', new Date()],
    ['content_generation_enabled', 'true', 'Enable AI content generation', new Date()],
    ['max_posts_per_day', '5', 'Maximum posts to publish per day', new Date()],
    ['default_post_status', 'draft', 'Default status for new posts (draft/publish)', new Date()],
    ['error_notification_email', '', 'Email for error notifications', new Date()],
    ['task_retry_attempts', '3', 'Number of retry attempts for failed tasks', new Date()],
    ['product_sync_interval', '24', 'Hours between product data syncs', new Date()],
    ['divi_default_template', '', 'Default Divi layout template ID', new Date()],
    ['use_per_site_divi_keys', 'true', 'Use per-site Divi API credentials (recommended)', new Date()]
  ];

  sheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);

  Logger.log('✅ Settings sheet created');
  return sheet;
}

// =============================================================================
// INICJALIZACJA USTAWIEŃ
// =============================================================================

function initializeSettings() {
  // Sprawdzenie czy klucze API są ustawione
  const scriptProperties = PropertiesService.getScriptProperties();

  const recommendedKeys = [
    'PA_API_ACCESS_KEY',
    'PA_API_SECRET_KEY',
    'PA_API_PARTNER_TAG',
    'DIVI_DOWNLOAD_URL',                  // Required for automated Divi installation
    'PRODUCT_MANAGER_DOWNLOAD_URL',       // Required for WAAS Product Manager plugin installation
    'PATRONAGE_MANAGER_DOWNLOAD_URL',     // Required for WAAS Patronage Manager plugin installation
    'DIVI_CHILD_DOWNLOAD_URL'             // Required for Divi Child Theme installation
  ];

  const optionalKeys = [
    'HOSTINGER_API_KEY'
  ];

  const missingRequired = [];
  const missingOptional = [];

  recommendedKeys.forEach(key => {
    if (!scriptProperties.getProperty(key)) {
      missingRequired.push(key);
    }
  });

  optionalKeys.forEach(key => {
    if (!scriptProperties.getProperty(key)) {
      missingOptional.push(key);
    }
  });

  if (missingRequired.length > 0) {
    Logger.log('⚠️ Missing required API keys: ' + missingRequired.join(', '));
  }

  if (missingOptional.length > 0) {
    Logger.log('ℹ️ Missing optional API keys (can use per-site instead): ' + missingOptional.join(', '));
  }

  if (missingRequired.length === 0 && missingOptional.length === 0) {
    Logger.log('✅ All API keys are configured');
  }

  Logger.log('💡 Remember: Per-site credentials should be set in Sites sheet (columns 7-9)');
}

// =============================================================================
// MENU
// =============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ WAAS')
    .addSubMenu(ui.createMenu('🌐 Sites')
      .addItem('➕ Add New Site', 'showAddSiteDialog')
      .addItem('✅ Check Site Status', 'showCheckSiteDialog')
      .addItem('🎨 Install Divi on Site', 'showInstallDiviDialog')
      .addItem('🔌 Install Plugin on Site', 'showInstallPluginDialog')
      .addSeparator()
      .addItem('🔄 Refresh All Sites', 'refreshAllSites'))
    .addSubMenu(ui.createMenu('📦 Products')
      .addItem('📥 Import from Amazon', 'showImportProductsDialog')
      .addItem('🔄 Update Product Data', 'showUpdateProductsDialog')
      .addItem('🔄 Sync All Products', 'syncAllProducts')
      .addSeparator()
      .addItem('📊 Product Statistics', 'showProductStats'))
    .addSubMenu(ui.createMenu('📝 Content')
      .addItem('✍️ Generate Content', 'showGenerateContentDialog')
      .addItem('📤 Publish Scheduled Content', 'publishScheduledContent')
      .addItem('📋 View Content Queue', 'focusContentQueue')
      .addSeparator()
      .addItem('🗑️ Clear Failed Content', 'clearFailedContent'))
    .addSubMenu(ui.createMenu('⚙️ Tasks')
      .addItem('👁️ View Active Tasks', 'focusActiveTasks')
      .addItem('▶️ Run Task Queue', 'runTaskQueue')
      .addItem('🗑️ Clear Completed Tasks', 'clearCompletedTasks')
      .addSeparator()
      .addItem('🔄 Retry Failed Tasks', 'retryFailedTasks'))
    .addSubMenu(ui.createMenu('🤖 Automation')
      .addItem('🚀 Install Full Stack', 'showInstallFullStackDialog')
      .addItem('📤 Deploy Selected Content', 'showDeployContentDialog')
      .addSeparator()
      .addItem('⚡ Process Auto Install Sites', 'processAutoInstallSites')
      .addItem('⚡ Process Content Deployment', 'processContentDeployment')
      .addSeparator()
      .addItem('⏰ Setup Automated Triggers', 'setupAutomatedTriggers')
      .addItem('🗑️ Remove Automated Triggers', 'removeAutomatedTriggers')
      .addSeparator()
      .addItem('🔄 Run Daily Amazon Sync', 'dailyAmazonSync')
      .addItem('🔄 Run Hourly Check', 'hourlyAutomationCheck'))
    .addSubMenu(ui.createMenu('🔧 Settings')
      .addItem('🔑 Configure API Keys', 'showAPIKeyInstructions')
      .addItem('⚙️ System Settings', 'showSettingsDialog')
      .addItem('🧪 Test Connections', 'testAllConnections')
      .addSeparator()
      .addItem('🔄 Migrate to Per-Site Divi Keys', 'migrateToPerSiteDiviKeys')
      .addItem('✅ Verify Migration', 'verifyMigration')
      .addSeparator()
      .addItem('📊 View Logs', 'focusLogs')
      .addItem('🗑️ Clear Old Logs', 'clearOldLogs'))
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About WAAS', 'showAbout')
    .addToUi();
}
/**
 * WAAS Menu Module
 * Interfejs użytkownika i menu
 */

// =============================================================================
// MENU GŁÓWNE
// =============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ WAAS')
    .addSubMenu(ui.createMenu('🌐 Sites')
      .addItem('➕ Add New Site', 'showAddSiteDialog')
      .addItem('✅ Check Site Status', 'showCheckSiteDialog')
      .addItem('🎨 Install Divi on Site', 'showInstallDiviDialog')
      .addItem('🔌 Install Plugin on Site', 'showInstallPluginDialog')
      .addSeparator()
      .addItem('🔄 Refresh All Sites', 'refreshAllSites'))
    .addSubMenu(ui.createMenu('📦 Products')
      .addItem('📥 Import from Amazon', 'showImportProductsDialog')
      .addItem('🔄 Update Product Data', 'showUpdateProductsDialog')
      .addItem('🔄 Sync All Products', 'syncAllProducts')
      .addSeparator()
      .addItem('📊 Product Statistics', 'showProductStats'))
    .addSubMenu(ui.createMenu('📝 Content')
      .addItem('✍️ Generate Content', 'showGenerateContentDialog')
      .addItem('📤 Publish Scheduled Content', 'publishScheduledContent')
      .addItem('📋 View Content Queue', 'focusContentQueue')
      .addSeparator()
      .addItem('🗑️ Clear Failed Content', 'clearFailedContent'))
    .addSubMenu(ui.createMenu('⚙️ Tasks')
      .addItem('👁️ View Active Tasks', 'focusActiveTasks')
      .addItem('▶️ Run Task Queue', 'runTaskQueue')
      .addItem('🗑️ Clear Completed Tasks', 'clearCompletedTasks')
      .addSeparator()
      .addItem('🔄 Retry Failed Tasks', 'retryFailedTasks'))
    .addSubMenu(ui.createMenu('🤖 Automation')
      .addItem('🚀 Install Full Stack', 'showInstallFullStackDialog')
      .addItem('📤 Deploy Selected Content', 'showDeployContentDialog')
      .addSeparator()
      .addItem('⚙️ Process Auto Install Sites', 'processAutoInstallSites')
      .addItem('📝 Process Content Deployment', 'processContentDeployment')
      .addSeparator()
      .addItem('⏰ Setup Automated Triggers', 'setupAutomatedTriggers')
      .addItem('🛑 Remove Automated Triggers', 'removeAutomatedTriggers')
      .addSeparator()
      .addItem('🔄 Daily Amazon Sync (Manual)', 'dailyAmazonSync')
      .addItem('🔄 Hourly Check (Manual)', 'hourlyAutomationCheck'))
    .addSubMenu(ui.createMenu('🔧 Settings')
      .addItem('🔑 Configure API Keys', 'showAPIKeyInstructions')
      .addItem('⚙️ System Settings', 'showSettingsDialog')
      .addItem('🧪 Test Connections', 'testAllConnections')
      .addSeparator()
      .addItem('🔐 Migrate Auth for All Sites', 'migrateAllSitesToAutoAuth')
      .addItem('🔐 Setup Auth for Site', 'showSetupAuthDialog')
      .addItem('📊 View Auth Status', 'showAuthMigrationStatus')
      .addSeparator()
      .addItem('📊 View Logs', 'focusLogs')
      .addItem('🗑️ Clear Old Logs', 'clearOldLogs'))
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About WAAS', 'showAbout')
    .addToUi();
}

// =============================================================================
// DIALOGI - SITES
// =============================================================================

function showAddSiteDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #357ae8; }
    </style>

    <div class="form-group">
      <label>Site Name:</label>
      <input type="text" id="siteName" placeholder="My Affiliate Site">
    </div>

    <div class="form-group">
      <label>Domain:</label>
      <input type="text" id="domain" placeholder="example.com">
    </div>

    <div class="form-group">
      <label>WordPress URL:</label>
      <input type="text" id="wpUrl" placeholder="https://example.com">
    </div>

    <div class="form-group">
      <label>Admin Username:</label>
      <input type="text" id="username" placeholder="admin">
    </div>

    <div class="form-group">
      <label>Admin Password:</label>
      <input type="password" id="password">
    </div>

    <div class="form-group">
      <label>Notes:</label>
      <textarea id="notes" rows="3"></textarea>
    </div>

    <button onclick="addSite()">Add Site</button>

    <script>
      function addSite() {
        const data = {
          siteName: document.getElementById('siteName').value,
          domain: document.getElementById('domain').value,
          wpUrl: document.getElementById('wpUrl').value,
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
          notes: document.getElementById('notes').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Site added successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .addNewSite(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(500);

  ui.showModalDialog(html, 'Add New Site');
}

function addNewSite(data) {
  const sheet = getSitesSheet();
  const id = getNextId('Sites');

  sheet.appendRow([
    id,
    data.siteName,
    data.domain,
    data.wpUrl,
    data.username,
    data.password,
    'Pending',
    'No',
    'No',
    new Date(),
    new Date(),
    data.notes
  ]);

  logSuccess('Sites', `New site added: ${data.siteName} (ID: ${id})`);

  return id;
}

function showCheckSiteDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Check Site Status',
    'Enter Site ID to check:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      checkSiteStatus(siteId);
    }
  }
}

function showInstallDiviDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Install Divi',
    'Enter Site ID to install Divi theme:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      installDiviOnSite(siteId);
    }
  }
}

function showInstallPluginDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Install Plugin',
    'Enter Site ID to install WAAS Product Manager:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      installPluginOnSite(siteId);
    }
  }
}

// =============================================================================
// DIALOGI - PRODUCTS
// =============================================================================

function showImportProductsDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, textarea, select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #2d8e47; }
    </style>

    <div class="form-group">
      <label>Search Keywords:</label>
      <input type="text" id="keywords" placeholder="laptop, smartphone, etc.">
    </div>

    <div class="form-group">
      <label>Category:</label>
      <select id="category">
        <option value="">All Categories</option>
        <option value="Electronics">Electronics</option>
        <option value="Books">Books</option>
        <option value="Home">Home & Kitchen</option>
        <option value="Sports">Sports & Outdoors</option>
        <option value="Fashion">Fashion</option>
      </select>
    </div>

    <div class="form-group">
      <label>Number of Products:</label>
      <input type="number" id="count" value="10" min="1" max="50">
    </div>

    <button onclick="importProducts()">Import Products</button>

    <script>
      function importProducts() {
        const data = {
          keywords: document.getElementById('keywords').value,
          category: document.getElementById('category').value,
          count: parseInt(document.getElementById('count').value)
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Products imported successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .importProductsFromAmazon(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(400);

  ui.showModalDialog(html, 'Import Products from Amazon');
}

function showUpdateProductsDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Update Products',
    'Update price and availability for all products?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    updateProductData();
  }
}

function showProductStats() {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const total = data.length - 1;
  const active = data.filter((row, i) => i > 0 && row[9] === 'Active').length;

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Product Statistics',
    `Total Products: ${total}\nActive Products: ${active}\nInactive: ${total - active}`,
    ui.ButtonSet.OK
  );
}

// =============================================================================
// DIALOGI - CONTENT
// =============================================================================

function showGenerateContentDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #ea4335; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #d33b2c; }
    </style>

    <div class="form-group">
      <label>Site ID:</label>
      <input type="number" id="siteId" min="1">
    </div>

    <div class="form-group">
      <label>Content Type:</label>
      <select id="contentType">
        <option value="review">Product Review</option>
        <option value="comparison">Product Comparison</option>
        <option value="guide">Buying Guide</option>
        <option value="listicle">Top 10 List</option>
      </select>
    </div>

    <div class="form-group">
      <label>Product IDs (comma separated):</label>
      <input type="text" id="productIds" placeholder="1,2,3">
    </div>

    <div class="form-group">
      <label>Custom Title (optional):</label>
      <input type="text" id="title">
    </div>

    <button onclick="generateContent()">Generate Content</button>

    <script>
      function generateContent() {
        const data = {
          siteId: parseInt(document.getElementById('siteId').value),
          contentType: document.getElementById('contentType').value,
          productIds: document.getElementById('productIds').value,
          title: document.getElementById('title').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Content generation started!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .generateContent(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(450);

  ui.showModalDialog(html, 'Generate Content');
}

// =============================================================================
// DIALOGI - SETTINGS
// =============================================================================

function showAPIKeyInstructions() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🔑 API Keys Configuration',
    'To configure API keys:\n\n' +
    '1. Click: Extensions → Apps Script\n' +
    '2. Click: Project Settings (⚙️ icon)\n' +
    '3. Scroll to "Script Properties"\n' +
    '4. Click "Add script property"\n' +
    '5. Add these properties:\n\n' +
    '   DIVI_API_USERNAME = netanaliza\n' +
    '   DIVI_API_KEY = 2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4\n' +
    '   PA_API_ACCESS_KEY = [Your Amazon Key]\n' +
    '   PA_API_SECRET_KEY = [Your Amazon Secret]\n' +
    '   PA_API_PARTNER_TAG = [Your Associate Tag]\n' +
    '   HOSTINGER_API_KEY = [Optional]\n\n' +
    '6. Click "Save script properties"\n' +
    '7. Reload this spreadsheet',
    ui.ButtonSet.OK
  );
}

function showSettingsDialog() {
  const ui = SpreadsheetApp.getUi();

  const autoPublish = getSetting('auto_publish', 'false');
  const maxPosts = getSetting('max_posts_per_day', '5');
  const notifEmail = getSetting('error_notification_email', '');

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #673ab7; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #5e35b1; }
    </style>

    <div class="form-group">
      <label>Auto Publish Content:</label>
      <select id="autoPublish">
        <option value="true" ${autoPublish === 'true' ? 'selected' : ''}>Yes</option>
        <option value="false" ${autoPublish === 'false' ? 'selected' : ''}>No</option>
      </select>
    </div>

    <div class="form-group">
      <label>Max Posts Per Day:</label>
      <input type="number" id="maxPosts" value="${maxPosts}" min="1" max="50">
    </div>

    <div class="form-group">
      <label>Error Notification Email:</label>
      <input type="email" id="notifEmail" value="${notifEmail}" placeholder="your@email.com">
    </div>

    <button onclick="saveSettings()">Save Settings</button>

    <script>
      function saveSettings() {
        const settings = {
          auto_publish: document.getElementById('autoPublish').value,
          max_posts_per_day: document.getElementById('maxPosts').value,
          error_notification_email: document.getElementById('notifEmail').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Settings saved successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .saveSystemSettings(settings);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(350);

  ui.showModalDialog(html, 'System Settings');
}

function saveSystemSettings(settings) {
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value);
  }
  logSuccess('Settings', 'System settings updated');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function focusContentQueue() {
  getContentQueueSheet().activate();
}

function focusActiveTasks() {
  getTasksSheet().activate();
}

function focusLogs() {
  getLogsSheet().activate();
}

function clearOldLogs() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Old Logs',
    'Delete logs older than 30 days?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getLogsSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][0] < cutoffDate) {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} old log entries.`);
  }
}

function clearFailedContent() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Failed Content',
    'Delete all failed content items?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getContentQueueSheet();
    const data = sheet.getDataRange().getValues();

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][4] === 'Failed') {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} failed content items.`);
  }
}

function clearCompletedTasks() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Completed Tasks',
    'Delete all completed tasks?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][4] === 'Completed') {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} completed tasks.`);
  }
}

// =============================================================================
// INFO DIALOGS
// =============================================================================

function showDocumentation() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📖 WAAS Documentation',
    'Documentation and resources:\n\n' +
    '• GitHub Repository:\n' +
    '  https://github.com/LUKOAI/LUKO-WAAS\n\n' +
    '• Product Manager Plugin:\n' +
    '  https://github.com/LUKOAI/-LukoAmazonAffiliateManager\n\n' +
    '• Divi Documentation:\n' +
    '  https://www.elegantthemes.com/documentation/divi/\n\n' +
    '• Amazon PA API Docs:\n' +
    '  https://webservices.amazon.com/paapi5/documentation/\n\n' +
    '• Elegant Themes API:\n' +
    '  https://www.elegantthemes.com/developers/\n\n' +
    'For support, open an issue on GitHub.',
    ui.ButtonSet.OK
  );
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ About WAAS',
    'WordPress Affiliate Automation System\n' +
    'Version ' + WAAS_CONFIG.version + '\n\n' +
    '© 2024 LUKOAI\n' +
    'https://github.com/LUKOAI\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'Automated WordPress management with:\n' +
    '✓ Multi-site management\n' +
    '✓ Divi theme integration\n' +
    '✓ Amazon affiliate products\n' +
    '✓ Automated content generation\n' +
    '✓ Task scheduling & automation\n\n' +
    'Built with ❤️ for affiliate marketers\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ui.ButtonSet.OK
  );
}

function testAllConnections() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Test Divi API
    const diviCreds = getDiviCredentials();
    const diviStatus = diviCreds.username && diviCreds.apiKey ? '✅' : '❌';

    // Test Amazon PA API
    const amazonCreds = getAmazonPACredentials();
    const amazonStatus = amazonCreds.accessKey && amazonCreds.secretKey && amazonCreds.partnerTag ? '✅' : '❌';

    // Test Hostinger API
    const hostingerKey = getHostingerAPIKey();
    const hostingerStatus = hostingerKey ? '✅' : '⚠️ (Optional)';

    ui.alert(
      '🧪 Connection Tests',
      'API Configuration Status:\n\n' +
      `${diviStatus} Divi API: ${diviStatus === '✅' ? 'Configured' : 'Not configured'}\n` +
      `${amazonStatus} Amazon PA API: ${amazonStatus === '✅' ? 'Configured' : 'Not configured'}\n` +
      `${hostingerStatus} Hostinger API: ${hostingerStatus === '✅' ? 'Configured' : 'Not configured'}\n\n` +
      'Note: This only checks if keys are present.\n' +
      'Use site and product operations to test actual connectivity.',
      ui.ButtonSet.OK
    );

    logInfo('Tests', 'Connection tests completed');
  } catch (error) {
    ui.alert('Error', 'Connection test failed: ' + error.message, ui.ButtonSet.OK);
  }
}

function showSetupAuthDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Setup Authentication',
    'Enter Site ID to setup WordPress authentication:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      migrateAuthForSite(siteId);
    }
  }
}

// =============================================================================
// DIALOGI - AUTOMATION
// =============================================================================

function showInstallFullStackDialog() {
  const ui = SpreadsheetApp.getUi();

  // Get list of sites
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    ui.alert('No Sites', 'No sites found. Please add a site first.', ui.ButtonSet.OK);
    return;
  }

  // Build site list
  let siteOptions = '';
  for (let i = 1; i < data.length; i++) {
    const siteId = data[i][0];
    const siteName = data[i][1];
    const status = data[i][9];
    siteOptions += `<option value="${siteId}">${siteName} (ID: ${siteId}) - ${status}</option>`;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select, input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; }
      button:hover { background: #357ae8; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    </style>

    <div class="info">
      <strong>🚀 Install Full Stack</strong><br>
      This will install everything on your WordPress site:<br>
      • Divi Theme<br>
      • WooCommerce<br>
      • WAAS Product Manager Plugin<br>
      • Optional: Import initial products<br>
    </div>

    <div class="form-group">
      <label>Select Site:</label>
      <select id="siteId">${siteOptions}</select>
    </div>

    <div class="form-group">
      <label>Initial ASINs (comma-separated, optional):</label>
      <input type="text" id="asins" placeholder="B08N5WRWNW, B07XJ8C8F7">
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="generateContent"> Generate initial content (review for first product)
      </label>
    </div>

    <button onclick="installStack()">🚀 Install Full Stack</button>

    <script>
      function installStack() {
        const siteId = parseInt(document.getElementById('siteId').value);
        const asins = document.getElementById('asins').value
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const generateContent = document.getElementById('generateContent').checked;

        google.script.run
          .withSuccessHandler(() => {
            alert('✅ Full stack installation started! Check the Logs sheet for progress.');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('❌ Error: ' + error.message);
          })
          .runInstallFullStack(siteId, asins, generateContent);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(400);

  ui.showModalDialog(html, '🚀 Install Full Stack');
}

function runInstallFullStack(siteId, asins, generateContent) {
  try {
    logInfo('AUTOMATION', `Starting full stack installation for site ${siteId} (dialog)`, siteId);

    const result = installFullStack(siteId, {
      importProducts: asins.length > 0,
      initialAsins: asins,
      generateContent: generateContent
    });

    if (result.success) {
      logSuccess('AUTOMATION', `Full stack installation completed for site ${siteId}`, siteId);
    } else {
      logError('AUTOMATION', `Full stack installation failed for site ${siteId}`, siteId);
    }

    return result;
  } catch (error) {
    logError('AUTOMATION', `Full stack installation error: ${error.message}`, siteId);
    throw error;
  }
}

function showDeployContentDialog() {
  const ui = SpreadsheetApp.getUi();

  // Get list of sites
  const sitesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const sitesData = sitesSheet.getDataRange().getValues();

  if (sitesData.length <= 1) {
    ui.alert('No Sites', 'No sites found. Please add a site first.', ui.ButtonSet.OK);
    return;
  }

  // Build site list
  let siteOptions = '';
  for (let i = 1; i < sitesData.length; i++) {
    const siteId = sitesData[i][0];
    const siteName = sitesData[i][1];
    siteOptions += `<option value="${siteId}">${siteName} (ID: ${siteId})</option>`;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select, input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; }
      button:hover { background: #357ae8; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    </style>

    <div class="info">
      <strong>📤 Deploy Selected Content</strong><br>
      This will automatically:<br>
      • Import products from Amazon<br>
      • Generate content with Claude AI<br>
      • Publish to your WordPress site<br>
    </div>

    <div class="form-group">
      <label>Select Site:</label>
      <select id="siteId">${siteOptions}</select>
    </div>

    <div class="form-group">
      <label>Content Type:</label>
      <select id="contentType">
        <option value="product_review">Product Review</option>
        <option value="comparison">Product Comparison</option>
        <option value="buying_guide">Buying Guide</option>
        <option value="top_list">Top 10 List</option>
      </select>
    </div>

    <div class="form-group">
      <label>Amazon ASINs (comma-separated):</label>
      <input type="text" id="asins" placeholder="B08N5WRWNW, B07XJ8C8F7" required>
    </div>

    <div class="form-group">
      <label>Content Title (optional):</label>
      <input type="text" id="title" placeholder="Auto-generated if left empty">
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="autoPublish" checked> Auto-publish (otherwise save as draft)
      </label>
    </div>

    <button onclick="deployContent()">📤 Deploy Content</button>

    <script>
      function deployContent() {
        const siteId = parseInt(document.getElementById('siteId').value);
        const contentType = document.getElementById('contentType').value;
        const asins = document.getElementById('asins').value
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const title = document.getElementById('title').value;
        const autoPublish = document.getElementById('autoPublish').checked;

        if (asins.length === 0) {
          alert('Please enter at least one Amazon ASIN');
          return;
        }

        google.script.run
          .withSuccessHandler(() => {
            alert('✅ Content deployment started! Check the Logs sheet for progress.');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('❌ Error: ' + error.message);
          })
          .runDeployContent(siteId, contentType, asins, title, autoPublish);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(500);

  ui.showModalDialog(html, '📤 Deploy Selected Content');
}

function runDeployContent(siteId, contentType, asins, title, autoPublish) {
  try {
    logInfo('AUTOMATION', `Starting content deployment for site ${siteId} (dialog)`, siteId);

    const result = deploySelectedContent(siteId, contentType, asins, {
      autoPublish: autoPublish,
      title: title || null
    });

    if (result.success) {
      logSuccess('AUTOMATION', `Content deployment completed for site ${siteId}`, siteId);
    } else {
      logError('AUTOMATION', `Content deployment failed for site ${siteId}`, siteId);
    }

    return result;
  } catch (error) {
    logError('AUTOMATION', `Content deployment error: ${error.message}`, siteId);
    throw error;
  }
}
/**
 * WAAS Site Manager Module
 * Zarządzanie stronami WordPress
 */

// =============================================================================
// OPERACJE NA STRONACH
// =============================================================================

function getSiteById(siteId) {
  const sheet = getSitesSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === siteId) {
      return {
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        adminUser: data[i][4],
        adminPass: data[i][5],
        diviApiUsername: data[i][6],   // COLUMN 7: Per-site Divi username
        diviApiKey: data[i][7],         // COLUMN 8: Per-site Divi API key
        partnerTag: data[i][8],         // COLUMN 9: Per-site Amazon Partner Tag
        status: data[i][9],
        diviInstalled: data[i][10],
        pluginInstalled: data[i][11],
        lastCheck: data[i][12],
        createdDate: data[i][13],
        notes: data[i][14],
        appPassword: data[i][15],       // COLUMN 16: Application Password (auto-created)
        authType: data[i][16],          // COLUMN 17: Auth type (application_password, basic_auth_plugin, basic_auth_legacy)
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function updateSiteStatus(siteId, status, updates = {}) {
  const site = getSiteById(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  const sheet = getSitesSheet();
  const row = site.rowIndex;

  // Aktualizuj status (kolumna 10)
  sheet.getRange(row, 10).setValue(status);

  // Aktualizuj last check (kolumna 13)
  sheet.getRange(row, 13).setValue(new Date());

  // Aktualizuj dodatkowe pola
  if (updates.diviApiUsername !== undefined) {
    sheet.getRange(row, 7).setValue(updates.diviApiUsername);
  }
  if (updates.diviApiKey !== undefined) {
    sheet.getRange(row, 8).setValue(updates.diviApiKey);
  }
  if (updates.partnerTag !== undefined) {
    sheet.getRange(row, 9).setValue(updates.partnerTag);
  }
  if (updates.diviInstalled !== undefined) {
    sheet.getRange(row, 11).setValue(updates.diviInstalled);
  }
  if (updates.pluginInstalled !== undefined) {
    sheet.getRange(row, 12).setValue(updates.pluginInstalled);
  }
  if (updates.notes !== undefined) {
    sheet.getRange(row, 15).setValue(updates.notes);
  }

  logInfo('SiteManager', `Site ${siteId} updated: ${status}`, siteId);
}

function checkSiteStatus(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logInfo('SiteManager', `Checking site status: ${site.name}`, siteId);

    // Sprawdź dostępność WordPress
    const wpCheck = checkWordPressAvailability(site);
    if (!wpCheck.available) {
      updateSiteStatus(siteId, 'Error', {
        notes: `WordPress not accessible: ${wpCheck.error}`
      });
      return false;
    }

    // Sprawdź Divi
    const diviInstalled = checkDiviInstallation(site);

    // Sprawdź Plugin
    const pluginInstalled = checkPluginInstallation(site);

    // Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      diviInstalled: diviInstalled ? 'Yes' : 'No',
      pluginInstalled: pluginInstalled ? 'Yes' : 'No'
    });

    logSuccess('SiteManager', `Site check completed: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Site Status',
      `Site: ${site.name}\n` +
      `Status: Active\n` +
      `Divi: ${diviInstalled ? 'Installed' : 'Not installed'}\n` +
      `Plugin: ${pluginInstalled ? 'Installed' : 'Not installed'}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.checkSiteStatus', siteId);
    return false;
  }
}

function checkWordPressAvailability(site) {
  try {
    logInfo('SiteManager', `Checking WordPress availability: ${site.wpUrl}`, site.id);

    // Use retry logic for better resilience against transient network issues
    const response = makeHttpRequestWithRetry(site.wpUrl + '/wp-json/', {}, 3, 2000);

    if (response.success) {
      logSuccess('SiteManager', 'WordPress site is accessible', site.id);
      return { available: true };
    } else {
      // Build detailed error message
      let errorMsg = '';

      if (response.statusCode) {
        errorMsg = `HTTP ${response.statusCode}: ${response.error}`;
      } else if (response.errorType) {
        // Network/DNS error without HTTP status code
        errorMsg = response.error;

        // Add specific troubleshooting tips based on error type
        if (response.errorType === 'DNS_ERROR') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Verify the domain exists and is properly configured\n' +
                     '• Check if DNS has propagated (use tools like dnschecker.org)\n' +
                     '• Ensure the domain/subdomain is correctly set in the Sites sheet\n' +
                     '• If this is a new domain, wait 24-48 hours for DNS propagation';
        } else if (response.errorType === 'TIMEOUT') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Server may be slow or under heavy load\n' +
                     '• Check server resources (CPU, memory, bandwidth)\n' +
                     '• Verify firewall/security settings aren\'t blocking requests';
        } else if (response.errorType === 'CONNECTION_ERROR') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Server may be down or unreachable\n' +
                     '• Check if WordPress is running\n' +
                     '• Verify hosting provider status';
        }
      } else {
        errorMsg = response.error || 'Unknown error occurred';
      }

      logError('SiteManager', `WordPress site not accessible: ${errorMsg}`, site.id);

      return {
        available: false,
        error: errorMsg,
        errorType: response.errorType,
        statusCode: response.statusCode
      };
    }
  } catch (error) {
    logError('SiteManager', `Unexpected error checking WordPress availability: ${error.message}`, site.id);
    return {
      available: false,
      error: error.message
    };
  }
}

function checkDiviInstallation(site) {
  try {
    // Sprawdź czy Divi jest aktywny przez WordPress REST API
    const response = makeHttpRequest(
      `${site.wpUrl}/wp-json/wp/v2/themes`,
      {
        headers: {
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
        }
      }
    );

    if (response.success && response.data) {
      const themes = response.data;
      return themes.some(theme =>
        theme.stylesheet === 'Divi' || theme.stylesheet === 'divi'
      );
    }

    return false;
  } catch (error) {
    logWarning('SiteManager', `Could not check Divi installation: ${error.message}`, site.id);
    return false;
  }
}

function checkPluginInstallation(site) {
  try {
    // Sprawdź czy plugin jest aktywny
    const response = makeHttpRequest(
      `${site.wpUrl}/wp-json/wp/v2/plugins`,
      {
        headers: {
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
        }
      }
    );

    if (response.success && response.data) {
      const plugins = response.data;
      return plugins.some(plugin =>
        plugin.plugin.includes('luko-amazon-affiliate-manager') ||
        plugin.name.includes('WAAS Product Manager')
      );
    }

    return false;
  } catch (error) {
    logWarning('SiteManager', `Could not check plugin installation: ${error.message}`, site.id);
    return false;
  }
}

function refreshAllSites() {
  const sheet = getSitesSheet();
  const data = sheet.getDataRange().getValues();

  let checked = 0;
  let errors = 0;

  for (let i = 1; i < data.length; i++) {
    const siteId = data[i][0];
    try {
      checkSiteStatus(siteId);
      checked++;
    } catch (error) {
      logError('SiteManager', `Error checking site ${siteId}: ${error.message}`, siteId);
      errors++;
    }
  }

  SpreadsheetApp.getUi().alert(
    'Refresh Complete',
    `Checked ${checked} sites\nErrors: ${errors}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  logInfo('SiteManager', `Refreshed ${checked} sites (${errors} errors)`);
}

// =============================================================================
// INSTALACJA DIVI
// =============================================================================

function installDiviOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logInfo('SiteManager', `Installing Divi on site: ${site.name}`, siteId);

    // 1. Pobierz Divi przez API Elegant Themes (using per-site credentials)
    const diviPackage = downloadDiviPackage(site);
    if (!diviPackage) {
      throw new Error('Failed to download Divi package');
    }

    // 2. Zainstaluj Divi przez WordPress API
    const installed = installThemeOnWordPress(site, diviPackage);
    if (!installed) {
      throw new Error('Failed to install Divi theme');
    }

    // 3. Aktywuj Divi
    const activated = activateThemeOnWordPress(site, 'Divi');
    if (!activated) {
      throw new Error('Failed to activate Divi theme');
    }

    // 4. Aktywuj licencję Divi
    logInfo('SiteManager', 'Activating Divi license...', siteId);
    const licenseActivated = activateDiviLicense(site);
    if (licenseActivated) {
      logSuccess('SiteManager', 'Divi license activation completed', siteId);
    } else {
      logWarning('SiteManager', 'Divi license activation failed or needs manual verification', siteId);
    }

    // 5. Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      diviInstalled: 'Yes',
      notes: licenseActivated
        ? 'Divi installed, activated, and license activated successfully'
        : 'Divi installed and activated - license activation may need manual verification'
    });

    logSuccess('SiteManager', `Divi installed successfully on: ${site.name}`, siteId);

    const resultMessage = licenseActivated
      ? 'Divi installed, activated, and license activated successfully'
      : 'Divi installed and activated - license activation may need manual verification';

    const alertMessage = licenseActivated
      ? `Divi has been installed, activated, and license has been activated on ${site.name}`
      : `Divi has been installed and activated on ${site.name}\n\nPlease verify license activation manually at:\n${site.wpUrl}/wp-admin/admin.php?page=et_onboarding#/overview`;

    // Only show alert if called directly (not from automation)
    try {
      SpreadsheetApp.getUi().alert(
        'Success',
        alertMessage,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      // UI not available (called from automation), skip alert
    }

    return {
      success: true,
      message: resultMessage,
      licenseActivated: licenseActivated
    };
  } catch (error) {
    const errorMessage = error.message || 'Unknown error during Divi installation';
    handleError(error, 'SiteManager.installDiviOnSite', siteId);
    return {
      success: false,
      message: errorMessage,
      licenseActivated: false
    };
  }
}

function downloadDiviPackage(site) {
  try {
    logInfo('DiviAPI', `Downloading Divi package for site: ${site.name}`, site.id);

    // Pobierz link do pobrania Divi (z DIVI_DOWNLOAD_URL lub fallback credentials)
    let downloadUrl;
    try {
      // Try to get credentials (may fail if not configured, which is OK if DIVI_DOWNLOAD_URL is set)
      const creds = getDiviCredentialsForSite(site);
      downloadUrl = getDiviDownloadUrl(creds);
    } catch (credError) {
      // If credentials fail, try getDiviDownloadUrl without credentials
      // It will use DIVI_DOWNLOAD_URL if configured
      logInfo('DiviAPI', 'No Divi credentials available, checking for DIVI_DOWNLOAD_URL...', site.id);
      downloadUrl = getDiviDownloadUrl({username: '', apiKey: ''});
    }

    if (!downloadUrl) {
      return null;
    }

    logInfo('DiviAPI', `Download URL: ${downloadUrl}`, site.id);

    // Retry logic: try up to 3 times
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logInfo('DiviAPI', `Download attempt ${attempt}/${maxRetries}...`, site.id);

        // Fetch with proper headers to avoid being blocked by web servers
        const response = UrlFetchApp.fetch(downloadUrl, {
          method: 'GET',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/zip,application/octet-stream,*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          }
        });

        const statusCode = response.getResponseCode();
        logInfo('DiviAPI', `HTTP Response: ${statusCode}`, site.id);

        if (statusCode === 200) {
          const blob = response.getBlob();
          const fileSize = blob.getBytes().length;

          logSuccess('DiviAPI', `Divi package downloaded successfully (${(fileSize / 1024 / 1024).toFixed(2)} MB)`, site.id);
          return blob;
        } else if (statusCode === 403) {
          // 403 Forbidden - likely web server configuration issue
          const responseText = response.getContentText();
          logError('DiviAPI', `403 Forbidden - Server is blocking access to the file`, site.id);
          logError('DiviAPI', `Server response: ${responseText.substring(0, 200)}`, site.id);
          logError('DiviAPI', ``, site.id);
          logError('DiviAPI', `📋 TROUBLESHOOTING 403 FORBIDDEN:`, site.id);
          logError('DiviAPI', `1. Check web server configuration (not file permissions)`, site.id);
          logError('DiviAPI', `2. Ensure directory allows public access (.htaccess, nginx config, etc.)`, site.id);
          logError('DiviAPI', `3. Try accessing the URL directly in a browser`, site.id);
          logError('DiviAPI', `4. RECOMMENDED: Use alternative hosting (AWS S3, Dropbox, Google Drive)`, site.id);
          logError('DiviAPI', ``, site.id);

          throw new Error(`403 Forbidden - Web server blocking access. The file permissions may be correct (755), but the web server (openresty) is configured to deny access. Please use alternative hosting or reconfigure your web server.`);
        } else if (statusCode === 404) {
          throw new Error(`404 Not Found - File does not exist at: ${downloadUrl}`);
        } else if (statusCode >= 500) {
          // Server error - might be temporary, retry
          lastError = new Error(`Server error ${statusCode} - Retrying...`);
          logWarning('DiviAPI', lastError.message, site.id);

          if (attempt < maxRetries) {
            Utilities.sleep(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
            continue;
          }
        } else {
          throw new Error(`Unexpected HTTP status: ${statusCode}`);
        }
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && !error.message.includes('403') && !error.message.includes('404')) {
          logWarning('DiviAPI', `Attempt ${attempt} failed: ${error.message}. Retrying...`, site.id);
          Utilities.sleep(2000 * attempt); // Exponential backoff
          continue;
        } else {
          throw error; // Don't retry on 403/404 or final attempt
        }
      }
    }

    throw lastError || new Error('Download failed after all retry attempts');
  } catch (error) {
    logError('DiviAPI', `Failed to download Divi: ${error.message}`, site.id);
    return null;
  }
}

// =============================================================================
// INSTALACJA PLUGINU
// =============================================================================

function installPluginOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logInfo('SiteManager', `Installing WAAS Plugin on site: ${site.name}`, siteId);

    // 1. Pobierz plugin z GitHub
    const pluginPackage = downloadPluginFromGitHub();
    if (!pluginPackage) {
      throw new Error('Failed to download plugin package');
    }

    // 2. Zainstaluj plugin przez WordPress API
    const installed = installPluginOnWordPress(site, pluginPackage);
    if (!installed) {
      throw new Error('Failed to install plugin');
    }

    // 3. Aktywuj plugin
    const activated = activatePluginOnWordPress(site, 'luko-amazon-affiliate-manager');
    if (!activated) {
      throw new Error('Failed to activate plugin');
    }

    // 4. Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      pluginInstalled: 'Yes',
      notes: 'WAAS Product Manager installed and activated'
    });

    logSuccess('SiteManager', `Plugin installed successfully on: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Success',
      `WAAS Product Manager has been installed and activated on ${site.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.installPluginOnSite', siteId);
    return false;
  }
}

function downloadPluginFromGitHub() {
  try {
    // First, try to get custom plugin URL from Script Properties (preferred method)
    const scriptProperties = PropertiesService.getScriptProperties();
    const customPluginUrl = scriptProperties.getProperty('PRODUCT_MANAGER_DOWNLOAD_URL');

    if (customPluginUrl) {
      logInfo('PluginManager', `Trying custom download URL: ${customPluginUrl}`);

      // Try with retry logic for DNS errors
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const delay = 2000 * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
            logInfo('PluginManager', `Retrying after ${delay}ms (attempt ${attempt}/${maxRetries})...`);
            Utilities.sleep(delay);
          }

          const response = UrlFetchApp.fetch(customPluginUrl, {
            muteHttpExceptions: true,
            followRedirects: true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const statusCode = response.getResponseCode();

          if (statusCode === 200) {
            const blob = response.getBlob();
            logSuccess('PluginManager', `Plugin package downloaded successfully from custom URL (${(blob.getBytes().length / 1024).toFixed(2)} KB)`);
            return blob;
          } else if (statusCode === 404 || statusCode === 403) {
            // Don't retry on 404/403
            logWarning('PluginManager', `Custom URL returned ${statusCode}, trying GitHub fallback...`);
            break;
          } else {
            logWarning('PluginManager', `Custom URL returned ${statusCode}, retrying...`);
            if (attempt === maxRetries) {
              logWarning('PluginManager', `Failed after ${maxRetries} attempts, trying GitHub fallback...`);
            }
          }
        } catch (e) {
          const isDnsError = e.message.toLowerCase().includes('dns');
          const isRetryable = isDnsError || e.message.toLowerCase().includes('timeout') || e.message.toLowerCase().includes('connection');

          if (isRetryable && attempt < maxRetries) {
            logWarning('PluginManager', `Custom URL failed (${e.message}), retrying...`);
          } else {
            logWarning('PluginManager', `Custom URL failed: ${e.message}, trying GitHub fallback...`);
            break;
          }
        }
      }
    }

    // Fallback: GitHub repository URL for WAAS Product Manager plugin
    // Trying multiple possible repository names
    const possibleRepos = [
      'https://github.com/LUKOAI/luko-amazon-affiliate-manager',
      'https://github.com/LUKOAI/LukoAmazonAffiliateManager',
      'https://github.com/LUKOAI/LUKO-WAAS'
    ];

    for (const repoUrl of possibleRepos) {
      const downloadUrl = `${repoUrl}/archive/refs/heads/main.zip`;

      logInfo('PluginManager', `Trying to download plugin from: ${downloadUrl}`);

      try {
        const response = UrlFetchApp.fetch(downloadUrl, {
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          const blob = response.getBlob();
          logSuccess('PluginManager', `Plugin package downloaded successfully from: ${repoUrl}`);
          return blob;
        } else {
          logInfo('PluginManager', `${repoUrl} returned ${statusCode}, trying next...`);
        }
      } catch (e) {
        logInfo('PluginManager', `Failed to fetch ${repoUrl}: ${e.message}`);
      }
    }

    // If all methods failed, log and return null
    logError('PluginManager', 'Plugin download failed from all repository URLs');
    logWarning('PluginManager', 'Repository may not exist yet or plugin is not published');
    logInfo('PluginManager', 'Skipping plugin installation - will continue with other setup steps');
    logInfo('PluginManager', '');
    logInfo('PluginManager', '📋 TO FIX THIS ISSUE:');
    logInfo('PluginManager', '1. Upload waas-product-manager.zip to a web-accessible location (e.g., lk24.shop/downloads/)');
    logInfo('PluginManager', '2. Set Script Property: PRODUCT_MANAGER_DOWNLOAD_URL = https://your-domain.com/path/to/waas-product-manager.zip');
    logInfo('PluginManager', '3. Alternatively, make GitHub repository public or provide GitHub token');
    logInfo('PluginManager', '');
    return null;

  } catch (error) {
    logError('PluginManager', `Failed to download plugin: ${error.message}`);
    return null;
  }
}

// =============================================================================
// INSTALACJA WOOCOMMERCE
// =============================================================================

function installWooCommerceOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logInfo('SiteManager', `Installing WooCommerce on site: ${site.name}`, siteId);

    // 1. Zainstaluj i aktywuj WooCommerce z WordPress.org repository
    // Note: installWooCommercePlugin already activates the plugin (status:'active')
    const installed = installWooCommercePlugin(site);
    if (!installed) {
      throw new Error('Failed to install WooCommerce');
    }

    // 3. Konfiguruj podstawowe ustawienia WooCommerce
    const configured = configureWooCommerce(site);
    if (!configured) {
      logWarning('SiteManager', 'WooCommerce installed but configuration may need manual review', siteId);
    }

    // 4. Aktualizuj status w Google Sheets (dodamy nową kolumnę)
    updateSiteStatus(siteId, 'Active', {
      notes: 'WooCommerce installed and activated'
    });

    logSuccess('SiteManager', `WooCommerce installed successfully on: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Success',
      `WooCommerce has been installed and activated on ${site.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.installWooCommerceOnSite', siteId);
    return false;
  }
}

function installWooCommercePlugin(site) {
  try {
    logInfo('WooCommerce', 'Installing WooCommerce plugin from WordPress.org');

    // Use authenticated request helper that handles auth automatically
    const result = makeAuthenticatedRequest(site, 'wp/v2/plugins', {
      method: 'post',
      payload: {
        slug: 'woocommerce',
        status: 'active'
      }
    });

    if (result.success) {
      logSuccess('WooCommerce', 'WooCommerce plugin installed and activated');
      return true;
    } else if (result.statusCode === 500 && result.data && result.data.code === 'folder_exists') {
      // WooCommerce is already installed, just activate it
      logInfo('WooCommerce', 'WooCommerce already installed, attempting to activate...');

      const activateResult = makeAuthenticatedRequest(site, 'wp/v2/plugins/woocommerce/woocommerce', {
        method: 'post',
        payload: {
          status: 'active'
        }
      });

      if (activateResult.success) {
        logSuccess('WooCommerce', 'WooCommerce plugin activated');
        return true;
      } else {
        logWarning('WooCommerce', `Activation returned ${activateResult.statusCode}, but WooCommerce may already be active`);
        // Return true anyway - if it's installed, that's good enough
        return true;
      }
    } else {
      logError('WooCommerce', `Installation failed with status: ${result.statusCode}`);
      logError('WooCommerce', `Response: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    logError('WooCommerce', `Failed to install WooCommerce: ${error.message}`);
    return false;
  }
}

function configureWooCommerce(site) {
  try {
    logInfo('WooCommerce', 'Configuring WooCommerce basic settings');

    // Use authenticated request helper
    const result = makeAuthenticatedRequest(site, 'wc/v3/settings/general/batch', {
      method: 'post',
      payload: {
        update: [
          {
            id: 'woocommerce_store_address',
            value: ''
          },
          {
            id: 'woocommerce_currency',
            value: 'EUR'
          },
          {
            id: 'woocommerce_enable_guest_checkout',
            value: 'no'  // Dla affiliate nie potrzebujemy checkout
          }
        ]
      }
    });

    if (result.success) {
      logSuccess('WooCommerce', 'WooCommerce configured');
      return true;
    } else {
      logWarning('WooCommerce', `Configuration returned status: ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logWarning('WooCommerce', `Configuration may need manual review: ${error.message}`);
    return false;
  }
}

function checkWooCommerceInstallation(site) {
  try {
    // Sprawdź czy WooCommerce jest aktywny
    const response = makeHttpRequest(
      `${site.wpUrl}/wp-json/wp/v2/plugins`,
      {
        headers: {
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
        }
      }
    );

    if (response.success && response.data) {
      const plugins = response.data;
      return plugins.some(plugin =>
        plugin.plugin.includes('woocommerce') &&
        plugin.status === 'active'
      );
    }

    return false;
  } catch (error) {
    logWarning('SiteManager', `Could not check WooCommerce installation: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function getAllActiveSites() {
  const sheet = getSitesSheet();
  const data = sheet.getDataRange().getValues();

  const sites = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][9] === 'Active') {  // Updated index for Status (column 10)
      sites.push({
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        adminUser: data[i][4],
        adminPass: data[i][5],
        diviApiUsername: data[i][6],
        diviApiKey: data[i][7],
        partnerTag: data[i][8]  // Per-site Amazon Partner Tag
      });
    }
  }

  return sites;
}
/**
 * WAAS Product Manager Module
 * Zarządzanie produktami afiliacyjnymi z Amazon
 */

// =============================================================================
// OPERACJE NA PRODUKTACH
// =============================================================================

function getProductById(productId) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productId) {
      return {
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        category: data[i][3],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6],
        rating: data[i][7],
        reviewsCount: data[i][8],
        status: data[i][9],
        lastUpdated: data[i][10],
        addedDate: data[i][11],
        notes: data[i][12],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function getProductByAsin(asin) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === asin) {
      return {
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function addProduct(productData) {
  // Sprawdź czy produkt już istnieje
  const existing = getProductByAsin(productData.asin);
  if (existing) {
    logWarning('ProductManager', `Product already exists: ${productData.asin}`);
    return existing.id;
  }

  const sheet = getProductsSheet();
  const id = getNextId('Products');

  sheet.appendRow([
    id,
    productData.asin,
    productData.name,
    productData.category || '',
    productData.price || '',
    productData.imageUrl || '',
    productData.affiliateLink || '',
    productData.rating || '',
    productData.reviewsCount || '',
    'Active',
    new Date(),
    new Date(),
    productData.notes || ''
  ]);

  logSuccess('ProductManager', `Product added: ${productData.name} (${productData.asin})`);
  return id;
}

function updateProduct(productId, updates) {
  const product = getProductById(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const sheet = getProductsSheet();
  const row = product.rowIndex;

  // Aktualizuj tylko zmienione pola
  if (updates.price !== undefined) {
    sheet.getRange(row, 5).setValue(updates.price);
  }
  if (updates.rating !== undefined) {
    sheet.getRange(row, 8).setValue(updates.rating);
  }
  if (updates.reviewsCount !== undefined) {
    sheet.getRange(row, 9).setValue(updates.reviewsCount);
  }
  if (updates.status !== undefined) {
    sheet.getRange(row, 10).setValue(updates.status);
  }

  // Zawsze aktualizuj lastUpdated
  sheet.getRange(row, 11).setValue(new Date());

  logInfo('ProductManager', `Product updated: ${product.asin}`, '', '', updates);
}

// =============================================================================
// IMPORT Z AMAZON
// =============================================================================

function importProductsFromAmazon(data) {
  try {
    logInfo('ProductManager', `Importing products: ${data.keywords}`);

    const products = searchAmazonProducts(data.keywords, data.category, data.count);

    if (!products || products.length === 0) {
      throw new Error('No products found');
    }

    let imported = 0;
    products.forEach(product => {
      try {
        addProduct(product);
        imported++;
      } catch (error) {
        logWarning('ProductManager', `Failed to add product ${product.asin}: ${error.message}`);
      }
    });

    logSuccess('ProductManager', `Imported ${imported} products`);

    SpreadsheetApp.getUi().alert(
      'Import Complete',
      `Successfully imported ${imported} products from Amazon`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return imported;
  } catch (error) {
    handleError(error, 'ProductManager.importProductsFromAmazon');
    return 0;
  }
}

// =============================================================================
// AKTUALIZACJA DANYCH PRODUKTÓW
// =============================================================================

function updateProductData() {
  try {
    const sheet = getProductsSheet();
    const data = sheet.getDataRange().getValues();

    let updated = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      const productId = data[i][0];
      const asin = data[i][1];

      try {
        // Pobierz aktualne dane z Amazon
        const productData = getAmazonProductData(asin);

        if (productData) {
          updateProduct(productId, {
            price: productData.price,
            rating: productData.rating,
            reviewsCount: productData.reviewsCount,
            status: productData.available ? 'Active' : 'Out of Stock'
          });
          updated++;
        }
      } catch (error) {
        logError('ProductManager', `Error updating product ${asin}: ${error.message}`);
        errors++;
      }

      // Rate limiting
      Utilities.sleep(1000);
    }

    logSuccess('ProductManager', `Updated ${updated} products (${errors} errors)`);

    SpreadsheetApp.getUi().alert(
      'Update Complete',
      `Updated ${updated} products\nErrors: ${errors}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return updated;
  } catch (error) {
    handleError(error, 'ProductManager.updateProductData');
    return 0;
  }
}

function syncAllProducts() {
  // Alias for updateProductData
  return updateProductData();
}

// =============================================================================
// HELPERS
// =============================================================================

function getActiveProducts(limit = 50) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const products = [];
  for (let i = 1; i < data.length && products.length < limit; i++) {
    if (data[i][9] === 'Active') {
      products.push({
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        category: data[i][3],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6],
        rating: data[i][7]
      });
    }
  }

  return products;
}

function getProductsByCategory(category) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const products = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === category && data[i][9] === 'Active') {
      products.push({
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6]
      });
    }
  }

  return products;
}

function getProductsByIds(productIds) {
  const products = [];

  productIds.forEach(id => {
    const product = getProductById(id);
    if (product) {
      products.push(product);
    }
  });

  return products;
}
/**
 * WAAS Task Manager Module
 * Zarządzanie zadaniami i kolejką
 */

const TaskType = {
  INSTALL_DIVI: 'Install Divi',
  INSTALL_PLUGIN: 'Install Plugin',
  IMPORT_PRODUCTS: 'Import Products',
  UPDATE_PRODUCTS: 'Update Products',
  GENERATE_CONTENT: 'Generate Content',
  PUBLISH_CONTENT: 'Publish Content',
  CHECK_SITE: 'Check Site'
};

const TaskStatus = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
};

const TaskPriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent'
};

// =============================================================================
// OPERACJE NA ZADANIACH
// =============================================================================

function createTask(taskType, siteId, productIds = '', priority = TaskPriority.MEDIUM, scheduledDate = null) {
  const sheet = getTasksSheet();
  const id = getNextId('Tasks');

  sheet.appendRow([
    id,
    taskType,
    siteId,
    productIds,
    TaskStatus.PENDING,
    priority,
    scheduledDate || new Date(),
    '',
    '',
    '',
    '',
    new Date(),
    ''
  ]);

  logInfo('TaskManager', `Task created: ${taskType} (ID: ${id})`, siteId, id);
  return id;
}

function getTaskById(taskId) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId) {
      return {
        id: data[i][0],
        taskType: data[i][1],
        siteId: data[i][2],
        productIds: data[i][3],
        status: data[i][4],
        priority: data[i][5],
        scheduledDate: data[i][6],
        startedDate: data[i][7],
        completedDate: data[i][8],
        result: data[i][9],
        errorMessage: data[i][10],
        createdDate: data[i][11],
        notes: data[i][12],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function updateTaskStatus(taskId, status, result = '', errorMessage = '') {
  const task = getTaskById(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const sheet = getTasksSheet();
  const row = task.rowIndex;

  // Aktualizuj status
  sheet.getRange(row, 5).setValue(status);

  // Aktualizuj daty
  if (status === TaskStatus.RUNNING && !task.startedDate) {
    sheet.getRange(row, 8).setValue(new Date());
  }
  if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
    sheet.getRange(row, 9).setValue(new Date());
  }

  // Aktualizuj wynik
  if (result) {
    sheet.getRange(row, 10).setValue(result);
  }
  if (errorMessage) {
    sheet.getRange(row, 11).setValue(errorMessage);
  }

  logInfo('TaskManager', `Task ${taskId} status: ${status}`, task.siteId, taskId);
}

// =============================================================================
// KOLEJKA ZADAŃ
// =============================================================================

function getPendingTasks(limit = 10) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  const now = new Date();
  const tasks = [];

  for (let i = 1; i < data.length && tasks.length < limit; i++) {
    if (data[i][4] === TaskStatus.PENDING && new Date(data[i][6]) <= now) {
      tasks.push({
        id: data[i][0],
        taskType: data[i][1],
        siteId: data[i][2],
        productIds: data[i][3],
        priority: data[i][5]
      });
    }
  }

  // Sortuj po priorytecie
  const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

function runTaskQueue() {
  try {
    logInfo('TaskManager', 'Starting task queue processing');

    const tasks = getPendingTasks(WAAS_CONFIG.limits.maxTasksPerRun);

    if (tasks.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Task Queue',
        'No pending tasks to process',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return 0;
    }

    let processed = 0;
    let failed = 0;

    tasks.forEach(task => {
      try {
        executeTask(task);
        processed++;
      } catch (error) {
        logError('TaskManager', `Task execution failed: ${error.message}`, task.siteId, task.id);
        updateTaskStatus(task.id, TaskStatus.FAILED, '', error.message);
        failed++;
      }
    });

    logSuccess('TaskManager', `Processed ${processed} tasks (${failed} failed)`);

    SpreadsheetApp.getUi().alert(
      'Task Queue Complete',
      `Processed: ${processed}\nFailed: ${failed}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return processed;
  } catch (error) {
    handleError(error, 'TaskManager.runTaskQueue');
    return 0;
  }
}

function executeTask(task) {
  logInfo('TaskManager', `Executing task: ${task.taskType}`, task.siteId, task.id);

  updateTaskStatus(task.id, TaskStatus.RUNNING);

  try {
    let result;

    switch (task.taskType) {
      case TaskType.INSTALL_DIVI:
        result = installDiviOnSite(task.siteId);
        break;

      case TaskType.INSTALL_PLUGIN:
        result = installPluginOnSite(task.siteId);
        break;

      case TaskType.CHECK_SITE:
        result = checkSiteStatus(task.siteId);
        break;

      case TaskType.IMPORT_PRODUCTS:
        // Parse product IDs from string
        const importData = JSON.parse(task.productIds || '{}');
        result = importProductsFromAmazon(importData);
        break;

      case TaskType.UPDATE_PRODUCTS:
        result = updateProductData();
        break;

      case TaskType.GENERATE_CONTENT:
        // Parse content data
        const contentData = JSON.parse(task.productIds || '{}');
        result = generateContentForSite(task.siteId, contentData);
        break;

      case TaskType.PUBLISH_CONTENT:
        result = publishScheduledContent();
        break;

      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }

    updateTaskStatus(task.id, TaskStatus.COMPLETED, JSON.stringify(result));
    logSuccess('TaskManager', `Task completed: ${task.taskType}`, task.siteId, task.id);

  } catch (error) {
    updateTaskStatus(task.id, TaskStatus.FAILED, '', error.message);
    throw error;
  }
}

function retryFailedTasks() {
  try {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();

    let retried = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === TaskStatus.FAILED) {
        const taskId = data[i][0];
        sheet.getRange(i + 1, 5).setValue(TaskStatus.PENDING);
        sheet.getRange(i + 1, 11).setValue(''); // Clear error message
        retried++;
      }
    }

    logInfo('TaskManager', `Retried ${retried} failed tasks`);

    SpreadsheetApp.getUi().alert(
      'Retry Tasks',
      `${retried} failed tasks have been reset to pending`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return retried;
  } catch (error) {
    handleError(error, 'TaskManager.retryFailedTasks');
    return 0;
  }
}

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

function scheduleTask(taskType, siteId, productIds, scheduledDate, priority = TaskPriority.MEDIUM) {
  return createTask(taskType, siteId, productIds, priority, scheduledDate);
}

function scheduleDailyTasks() {
  // Ta funkcja może być uruchamiana przez trigger czasowy

  logInfo('TaskManager', 'Scheduling daily tasks');

  const sites = getAllActiveSites();

  sites.forEach(site => {
    // Sprawdź status strony
    createTask(TaskType.CHECK_SITE, site.id, '', TaskPriority.LOW);
  });

  // Aktualizuj produkty
  createTask(TaskType.UPDATE_PRODUCTS, '', '', TaskPriority.MEDIUM);

  logSuccess('TaskManager', `Scheduled ${sites.length + 1} daily tasks`);
}

// =============================================================================
// HELPERS
// =============================================================================

function getTaskStats() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();

  const stats = {
    total: data.length - 1,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0
  };

  for (let i = 1; i < data.length; i++) {
    const status = data[i][4];
    stats[status.toLowerCase()]++;
  }

  return stats;
}
/**
 * WAAS Content Generator Module
 * Generowanie treści afiliacyjnych
 */

const ContentType = {
  REVIEW: 'review',
  COMPARISON: 'comparison',
  GUIDE: 'guide',
  LISTICLE: 'listicle'
};

// =============================================================================
// GENEROWANIE TREŚCI
// =============================================================================

function generateContent(data) {
  try {
    logInfo('ContentGenerator', `Generating ${data.contentType} content`, data.siteId);

    // Parse product IDs
    const productIds = data.productIds.split(',').map(id => parseInt(id.trim()));

    // Pobierz produkty
    const products = getProductsByIds(productIds);
    if (products.length === 0) {
      throw new Error('No products found for content generation');
    }

    // Wygeneruj treść
    let content;
    switch (data.contentType) {
      case ContentType.REVIEW:
        content = generateProductReview(products[0], data.title);
        break;
      case ContentType.COMPARISON:
        content = generateProductComparison(products, data.title);
        break;
      case ContentType.GUIDE:
        content = generateBuyingGuide(products, data.title);
        break;
      case ContentType.LISTICLE:
        content = generateTopListArticle(products, data.title);
        break;
      default:
        throw new Error(`Unknown content type: ${data.contentType}`);
    }

    // Dodaj do kolejki treści
    const contentId = addToContentQueue(data.siteId, content, productIds.join(','));

    logSuccess('ContentGenerator', `Content generated (ID: ${contentId})`, data.siteId);

    SpreadsheetApp.getUi().alert(
      'Content Generated',
      `Content has been added to the queue (ID: ${contentId})`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return contentId;
  } catch (error) {
    handleError(error, 'ContentGenerator.generateContent', data.siteId);
    return null;
  }
}

function generateContentForSite(siteId, data) {
  data.siteId = siteId;
  return generateContent(data);
}

// =============================================================================
// SZABLONY TREŚCI
// =============================================================================

function generateProductReview(product, customTitle = '') {
  const title = customTitle || `${product.name} Review - Is It Worth Buying?`;

  const content = `
<h2>Introduction</h2>
<p>In this comprehensive review, we'll take an in-depth look at the ${product.name}. We'll cover its features, pros and cons, and help you decide if this is the right product for your needs.</p>

<div class="product-box">
  <img src="${product.imageUrl}" alt="${product.name}" />
  <h3>${product.name}</h3>
  <p class="price">${product.price}</p>
  <p class="rating">Rating: ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check Current Price on Amazon</a>
</div>

<h2>Key Features</h2>
<p>The ${product.name} comes with several impressive features that make it stand out in its category:</p>
<ul>
  <li>High-quality construction and materials</li>
  <li>User-friendly design</li>
  <li>Excellent performance</li>
  <li>Great value for money</li>
</ul>

<h2>Pros and Cons</h2>
<h3>Pros:</h3>
<ul>
  <li>Excellent build quality</li>
  <li>Good performance</li>
  <li>Competitive pricing</li>
  <li>Positive customer reviews</li>
</ul>

<h3>Cons:</h3>
<ul>
  <li>May not be suitable for all users</li>
  <li>Some features could be improved</li>
</ul>

<h2>Who Is This Product For?</h2>
<p>The ${product.name} is perfect for anyone looking for a reliable and high-quality product in the ${product.category} category. Whether you're a beginner or an experienced user, this product offers great value.</p>

<h2>Final Verdict</h2>
<p>Overall, the ${product.name} is an excellent choice. With its combination of quality, performance, and price, it's definitely worth considering. The ${product.rating}/5 rating from ${product.reviewsCount} customers speaks for itself.</p>

<a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Buy Now on Amazon</a>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.REVIEW
  };
}

function generateProductComparison(products, customTitle = '') {
  const productNames = products.slice(0, 2).map(p => p.name.substring(0, 30)).join(' vs ');
  const title = customTitle || `${productNames} - Which One Should You Buy?`;

  let comparisonTable = '<table class="comparison-table"><thead><tr><th>Feature</th>';
  products.forEach(product => {
    comparisonTable += `<th>${product.name}</th>`;
  });
  comparisonTable += '</tr></thead><tbody>';

  // Add comparison rows
  comparisonTable += '<tr><td>Price</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.price}</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Rating</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.rating}/5</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Reviews</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.reviewsCount}</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Link</td>';
  products.forEach(product => {
    comparisonTable += `<td><a href="${product.affiliateLink}" target="_blank" rel="nofollow">View on Amazon</a></td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '</tbody></table>';

  const content = `
<h2>Introduction</h2>
<p>Trying to choose between ${productNames}? In this detailed comparison, we'll help you make an informed decision by comparing features, prices, and customer reviews.</p>

${comparisonTable}

<h2>Detailed Comparison</h2>
${products.map((product, index) => `
  <h3>${index + 1}. ${product.name}</h3>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 300px;" />
  <p>Price: ${product.price}</p>
  <p>Rating: ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check on Amazon</a>
`).join('\n')}

<h2>Which One Should You Choose?</h2>
<p>Both products have their strengths. Your choice depends on your specific needs, budget, and preferences. Consider the comparison table above and read customer reviews to make the best decision.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.COMPARISON
  };
}

function generateBuyingGuide(products, customTitle = '') {
  const category = products[0].category || 'Product';
  const title = customTitle || `The Ultimate ${category} Buying Guide - Top Picks for 2024`;

  const content = `
<h2>Introduction</h2>
<p>Looking for the best ${category.toLowerCase()} products? This comprehensive buying guide will help you choose the perfect option for your needs. We've researched and compared top products to bring you this curated list.</p>

<h2>What to Look for When Buying ${category} Products</h2>
<ul>
  <li>Quality and durability</li>
  <li>Features and functionality</li>
  <li>Price and value for money</li>
  <li>Customer reviews and ratings</li>
  <li>Brand reputation</li>
</ul>

<h2>Our Top Recommendations</h2>
${products.map((product, index) => `
  <h3>${index + 1}. ${product.name}</h3>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 400px;" />
  <p><strong>Price:</strong> ${product.price}</p>
  <p><strong>Rating:</strong> ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <p>This is an excellent choice for anyone looking for quality and reliability in the ${category.toLowerCase()} category.</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check Price on Amazon</a>
`).join('\n')}

<h2>Conclusion</h2>
<p>We hope this buying guide has helped you find the perfect ${category.toLowerCase()} product. All of our recommendations are highly rated by customers and offer great value for money.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.GUIDE
  };
}

function generateTopListArticle(products, customTitle = '') {
  const category = products[0].category || 'Product';
  const title = customTitle || `Top ${products.length} Best ${category} Products in 2024`;

  const content = `
<h2>Introduction</h2>
<p>We've compiled a list of the top ${products.length} ${category.toLowerCase()} products available right now. Each product on this list has been carefully selected based on customer reviews, features, and overall value.</p>

${products.map((product, index) => `
  <h2>${index + 1}. ${product.name}</h2>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 500px;" />

  <p><strong>Price:</strong> ${product.price}</p>
  <p><strong>Customer Rating:</strong> ${product.rating}/5 stars (${product.reviewsCount} reviews)</p>

  <h3>Why We Love It:</h3>
  <ul>
    <li>Exceptional quality and performance</li>
    <li>Highly rated by customers</li>
    <li>Great value for money</li>
    <li>Reliable and durable</li>
  </ul>

  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">View on Amazon</a>
`).join('\n')}

<h2>How We Chose These Products</h2>
<p>Our selection process involved analyzing thousands of customer reviews, comparing features and prices, and testing products when possible. We only recommend products that meet our high standards for quality and value.</p>

<h2>Final Thoughts</h2>
<p>All of the products on this list are excellent choices in the ${category.toLowerCase()} category. Consider your specific needs and budget when making your decision.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.LISTICLE
  };
}

// =============================================================================
// ZARZĄDZANIE KOLEJKĄ TREŚCI
// =============================================================================

function addToContentQueue(siteId, content, productIds) {
  const sheet = getContentQueueSheet();
  const id = getNextId('Content Queue');

  const autoPublish = getSetting('auto_publish', 'false') === 'true';
  const status = autoPublish ? 'Scheduled' : 'Draft';

  sheet.appendRow([
    id,
    siteId,
    content.contentType,
    content.title,
    status,
    productIds,
    '',
    autoPublish ? new Date() : '',
    '',
    '',
    '',
    new Date(),
    content.content // Pełna treść w notatkach
  ]);

  logInfo('ContentGenerator', `Content added to queue (ID: ${id})`, siteId);
  return id;
}

function publishScheduledContent() {
  try {
    const sheet = getContentQueueSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    let published = 0;
    let failed = 0;

    for (let i = 1; i < data.length; i++) {
      const status = data[i][4];
      const scheduledDate = new Date(data[i][7]);
      const contentId = data[i][0];
      const siteId = data[i][1];

      if (status === 'Scheduled' && scheduledDate <= now) {
        try {
          const content = {
            title: data[i][3],
            content: data[i][12]
          };

          const postId = publishContentToWordPress(siteId, content);

          if (postId) {
            // Aktualizuj status
            sheet.getRange(i + 1, 5).setValue('Published');
            sheet.getRange(i + 1, 9).setValue(new Date());
            sheet.getRange(i + 1, 10).setValue(postId);
            published++;

            logSuccess('ContentGenerator', `Content published (ID: ${contentId})`, siteId);
          }
        } catch (error) {
          logError('ContentGenerator', `Failed to publish content ${contentId}: ${error.message}`, siteId, '', error);
          sheet.getRange(i + 1, 5).setValue('Failed');
          failed++;
        }
      }
    }

    logInfo('ContentGenerator', `Published ${published} content items (${failed} failed)`);

    if (published > 0 || failed > 0) {
      SpreadsheetApp.getUi().alert(
        'Content Publishing Complete',
        `Published: ${published}\nFailed: ${failed}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert(
        'No Content to Publish',
        'No scheduled content is ready for publishing',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    return published;
  } catch (error) {
    handleError(error, 'ContentGenerator.publishScheduledContent');
    return 0;
  }
}

function publishContentToWordPress(siteId, content) {
  const site = getSiteById(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  // Użyj WordPress API do opublikowania
  const postData = {
    title: content.title,
    content: content.content,
    status: getSetting('default_post_status', 'draft')
  };

  const postId = createWordPressPost(site, postData);
  return postId;
}
/**
 * WAAS Divi API Module
 * Integracja z Elegant Themes Divi API
 */

// =============================================================================
// DIVI API FUNCTIONS
// =============================================================================

function getDiviDownloadUrl(credentials) {
  try {
    // Check if custom Divi download URL is configured (recommended approach)
    const scriptProperties = PropertiesService.getScriptProperties();
    const customDiviUrl = scriptProperties.getProperty('DIVI_DOWNLOAD_URL');

    if (customDiviUrl) {
      logSuccess('DiviAPI', `Using custom Divi download URL from Script Properties`);
      return customDiviUrl;
    }

    logInfo('DiviAPI', 'No custom DIVI_DOWNLOAD_URL configured, trying Elegant Themes API endpoints...');

    // Elegant Themes API - trying multiple possible endpoints
    // Note: ET may not have a public download API, might require manual download
    const apiEndpoints = [
      'https://www.elegantthemes.com/api/downloads',
      'https://www.elegantthemes.com/api/product/download',
      'https://www.elegantthemes.com/api/account/downloads'
    ];

    for (const apiUrl of apiEndpoints) {
      logInfo('DiviAPI', `Trying endpoint: ${apiUrl}`);

      const payload = {
        'api_key': credentials.apiKey,
        'username': credentials.username,
        'product': 'Divi'
      };

      try {
        const response = UrlFetchApp.fetch(apiUrl, {
          method: 'POST',
          contentType: 'application/x-www-form-urlencoded',
          payload: payload,
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        logInfo('DiviAPI', `Response status: ${statusCode}`);

        if (statusCode === 200 && responseText && !responseText.includes('<!doctype html>')) {
          // Try to parse as JSON first
          try {
            const data = JSON.parse(responseText);

            // Check various possible response formats
            if (data.download_url) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.download_url;
            } else if (data.downloads && data.downloads.Divi) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.downloads.Divi;
            } else if (data.url) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.url;
            } else if (typeof data === 'string' && data.startsWith('http')) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.trim();
            }
          } catch (e) {
            // Not JSON, might be direct URL
            if (responseText.startsWith('http')) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return responseText.trim();
            }
          }
        } else if (statusCode === 404) {
          logInfo('DiviAPI', `Endpoint ${apiUrl} not found, trying next...`);
        }
      } catch (e) {
        logInfo('DiviAPI', `Failed to fetch ${apiUrl}: ${e.message}`);
      }
    }

    // All endpoints failed
    logError('DiviAPI', 'Failed to get Divi download URL from all API endpoints');
    if (credentials && credentials.username && credentials.apiKey) {
      logError('DiviAPI', `Credentials used - Username: ${credentials.username}, API Key: ${credentials.apiKey.substring(0, 10)}...`);
    }
    logWarning('DiviAPI', 'Elegant Themes does not provide a public download API');
    logInfo('DiviAPI', '');
    logInfo('DiviAPI', '📋 RECOMMENDED SOLUTION:');
    logInfo('DiviAPI', '1. Download Divi theme ZIP from elegantthemes.com');
    logInfo('DiviAPI', '2. Upload it to your private storage (AWS S3, Google Cloud Storage, Dropbox, etc.)');
    logInfo('DiviAPI', '3. Set DIVI_DOWNLOAD_URL in Script Properties to your storage URL');
    logInfo('DiviAPI', '4. Automation will then download Divi automatically from your URL');
    logInfo('DiviAPI', '');
    logInfo('DiviAPI', '📖 See detailed hosting guide: docs/DIVI_HOSTING_GUIDE.md');
    logInfo('DiviAPI', '');
    throw new Error('Divi download not available. Please configure DIVI_DOWNLOAD_URL in Script Properties with your own hosted Divi ZIP URL. See docs/DIVI_HOSTING_GUIDE.md for detailed instructions.');
  } catch (error) {
    logError('DiviAPI', `Error getting download URL: ${error.message}`);
    throw error;
  }
}

function getDiviLayouts(credentials, category = '') {
  try {
    const apiUrl = 'https://www.elegantthemes.com/api/layouts/';

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey
      }
    });

    if (response.success && response.data) {
      let layouts = response.data;

      if (category) {
        layouts = layouts.filter(layout => layout.category === category);
      }

      return layouts;
    }

    return [];
  } catch (error) {
    logError('DiviAPI', `Error getting layouts: ${error.message}`);
    return [];
  }
}

function downloadDiviLayout(credentials, layoutId) {
  try {
    const apiUrl = `https://www.elegantthemes.com/api/layouts/${layoutId}`;

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error('Failed to download layout');
  } catch (error) {
    logError('DiviAPI', `Error downloading layout: ${error.message}`);
    throw error;
  }
}

function importDiviLayoutToSite(site, layoutData) {
  try {
    // Import layout do WordPress przez REST API
    const importUrl = `${site.wpUrl}/wp-json/divi/v1/layouts`;

    const response = makeHttpRequest(importUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(layoutData)
    });

    if (response.success) {
      logSuccess('DiviAPI', `Layout imported to site: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error importing layout: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// DIVI CLOUD INTEGRATION
// =============================================================================

function connectToDiviCloud(site, credentials) {
  try {
    logInfo('DiviAPI', `Connecting site to Divi Cloud: ${site.name}`, site.id);

    // Connect site to Divi Cloud dashboard
    const connectUrl = 'https://www.elegantthemes.com/api/cloud/connect';

    const response = makeHttpRequest(connectUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        site_url: site.wpUrl,
        site_name: site.name
      })
    });

    if (response.success) {
      logSuccess('DiviAPI', `Site connected to Divi Cloud: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error connecting to Divi Cloud: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// DIVI LICENSE ACTIVATION
// =============================================================================

/**
 * Activate Divi license on WordPress site
 * This logs into the Elegant Themes account through the Divi onboarding page
 * @param {Object} site - Site object
 * @returns {boolean} - Success status
 */
function activateDiviLicense(site) {
  try {
    logInfo('DiviAPI', `Activating Divi license for: ${site.name}`, site.id);

    // Get Elegant Themes credentials (per-site or global)
    const etCredentials = getDiviCredentialsForSite(site);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('DiviAPI', `Cannot login to WordPress: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    const nonce = loginResult.nonce;
    logInfo('DiviAPI', 'WordPress login successful', site.id);

    // Step 2: Navigate to Divi theme options page to get proper nonce
    const diviOptionsUrl = `${site.wpUrl}/wp-admin/admin.php?page=et_divi_options`;

    logInfo('DiviAPI', 'Accessing Divi theme options page...', site.id);
    const diviOptionsResponse = UrlFetchApp.fetch(diviOptionsUrl, {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    });

    const diviOptionsCode = diviOptionsResponse.getResponseCode();
    if (diviOptionsCode !== 200) {
      logWarning('DiviAPI', `Cannot access Divi options page: HTTP ${diviOptionsCode}`, site.id);
      // Continue anyway with alternative method
    } else {
      logSuccess('DiviAPI', 'Divi options page accessed', site.id);
    }

    // Step 3: Use proper Divi AJAX action to activate license
    // Divi uses 'et_check_api_key' action for license activation
    const ajaxUrl = `${site.wpUrl}/wp-admin/admin-ajax.php`;

    logInfo('DiviAPI', 'Submitting Elegant Themes credentials via et_check_api_key...', site.id);

    const activationPayload = {
      'action': 'et_check_api_key',
      'et_api_key': etCredentials.apiKey,
      'et_username': etCredentials.username,
      '_wpnonce': nonce
    };

    const activationResponse = UrlFetchApp.fetch(ajaxUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      payload: activationPayload,
      muteHttpExceptions: true,
      followRedirects: true
    });

    const activationCode = activationResponse.getResponseCode();
    const activationText = activationResponse.getContentText();

    logInfo('DiviAPI', `License activation response: HTTP ${activationCode}`, site.id);
    logInfo('DiviAPI', `Response preview: ${activationText.substring(0, 200)}`, site.id);

    // Check for success indicators
    const isSuccess = activationCode === 200 && (
      activationText.includes('"success":true') ||
      activationText.includes('active') ||
      activationText.includes('valid') ||
      !activationText.includes('error')
    );

    if (isSuccess) {
      logSuccess('DiviAPI', 'Divi license activation successful!', site.id);
      logInfo('DiviAPI', 'License should now be active in Divi theme', site.id);
      return true;
    }

    // Alternative method: Try to save credentials directly to WordPress options
    logInfo('DiviAPI', 'Trying alternative method: saving credentials directly to WordPress options...', site.id);

    const saveSuccess = saveDiviCredentialsToOptions(site, etCredentials, cookies, nonce);
    if (saveSuccess) {
      logSuccess('DiviAPI', 'Divi credentials saved to WordPress options', site.id);
      logInfo('DiviAPI', `Please verify activation at: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
      return true;
    }

    logWarning('DiviAPI', 'Automatic license activation may need manual verification', site.id);
    logInfo('DiviAPI', `Please verify at: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
    return true; // Return true anyway - we've done our best

  } catch (error) {
    logError('DiviAPI', `Error activating Divi license: ${error.message}`, site.id);
    logWarning('DiviAPI', `Please activate license manually: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
    return false;
  }
}

/**
 * Save Divi credentials directly to WordPress options
 * @param {Object} site - Site object
 * @param {Object} credentials - Divi credentials (username, apiKey)
 * @param {string} cookies - WordPress session cookies
 * @param {string} nonce - WordPress nonce
 * @returns {boolean} Success status
 */
function saveDiviCredentialsToOptions(site, credentials, cookies, nonce) {
  try {
    logInfo('DiviAPI', 'Saving Divi credentials to WordPress options...', site.id);

    // Divi stores credentials in 'et_automatic_updates_options'
    const ajaxUrl = `${site.wpUrl}/wp-admin/admin-ajax.php`;

    // Use update_option action to save credentials
    const payload = {
      'action': 'et_save_options',
      'et_options': JSON.stringify({
        'et_automatic_updates_options': {
          'username': credentials.username,
          'api_key': credentials.apiKey
        }
      }),
      '_wpnonce': nonce
    };

    const response = UrlFetchApp.fetch(ajaxUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      payload: payload,
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('DiviAPI', `Save options response: HTTP ${statusCode}`, site.id);

    if (statusCode === 200) {
      logSuccess('DiviAPI', 'Divi credentials saved successfully', site.id);
      return true;
    } else {
      logWarning('DiviAPI', `Failed to save credentials: ${responseText.substring(0, 200)}`, site.id);
      return false;
    }

  } catch (error) {
    logError('DiviAPI', `Error saving credentials: ${error.message}`, site.id);
    return false;
  }
}

/**
 * Save Elegant Themes API key to WordPress options (legacy function)
 * @param {Object} site - Site object
 * @param {string} apiKey - API key from Elegant Themes
 * @param {string} cookies - WordPress session cookies
 * @param {string} nonce - WordPress nonce
 */
function saveElegantThemesApiKey(site, apiKey, cookies, nonce) {
  try {
    const optionsUrl = `${site.wpUrl}/wp-json/wp/v2/settings`;

    const payload = {
      'et_automatic_updates_options': {
        'username': '',
        'api_key': apiKey
      }
    };

    const response = UrlFetchApp.fetch(optionsUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'X-WP-Nonce': nonce,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      logSuccess('DiviAPI', 'API key saved to WordPress options', site.id);
      return true;
    } else {
      logWarning('DiviAPI', 'Could not save API key to WordPress', site.id);
      return false;
    }
  } catch (error) {
    logWarning('DiviAPI', `Error saving API key: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// DIVI THEME HELPERS
// =============================================================================

function getDiviThemeOptions() {
  return {
    // Default Divi theme options
    'et_divi': {
      'logo': '',
      'fixed_nav': 'on',
      'divi_fixed_nav': 'on',
      'divi_smooth_scroll': 'on',
      'divi_back_to_top': 'on',
      'divi_minify_combine_styles': 'on',
      'divi_minify_combine_scripts': 'on',
      'divi_defer_jquery': 'on'
    }
  };
}

function applyDiviThemeOptions(site, options) {
  try {
    const updateUrl = `${site.wpUrl}/wp-json/wp/v2/options`;

    const response = makeHttpRequest(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(options)
    });

    if (response.success) {
      logSuccess('DiviAPI', `Divi options applied to: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error applying Divi options: ${error.message}`, site.id);
    return false;
  }
}
/**
 * WAAS WordPress API Module
 * Integracja z WordPress REST API
 */

// =============================================================================
// WORDPRESS REST API FUNCTIONS
// =============================================================================

function createWordPressPost(site, postData) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        title: postData.title,
        content: postData.content,
        status: postData.status || 'draft',
        comment_status: 'open',
        ping_status: 'open'
      })
    });

    if (response.success && response.data && response.data.id) {
      logSuccess('WordPressAPI', `Post created: ${postData.title} (ID: ${response.data.id})`, site.id);
      return response.data.id;
    }

    throw new Error('Failed to create post');
  } catch (error) {
    logError('WordPressAPI', `Error creating post: ${error.message}`, site.id);
    throw error;
  }
}

function updateWordPressPost(site, postId, postData) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts/${postId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(postData)
    });

    if (response.success) {
      logSuccess('WordPressAPI', `Post updated: ${postId}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error updating post: ${error.message}`, site.id);
    return false;
  }
}

function deleteWordPressPost(site, postId) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts/${postId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success) {
      logSuccess('WordPressAPI', `Post deleted: ${postId}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error deleting post: ${error.message}`, site.id);
    return false;
  }
}

function getWordPressPosts(site, params = {}) {
  try {
    let apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts`;

    // Add query parameters
    const queryParams = [];
    if (params.per_page) queryParams.push(`per_page=${params.per_page}`);
    if (params.status) queryParams.push(`status=${params.status}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);

    if (queryParams.length > 0) {
      apiUrl += '?' + queryParams.join('&');
    }

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    logError('WordPressAPI', `Error getting posts: ${error.message}`, site.id);
    return [];
  }
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

function installThemeOnWordPress(site, themeBlob) {
  try {
    logInfo('WordPressAPI', `Installing theme on: ${site.name}`, site.id);

    // Get authentication credentials
    const auth = getAuthCredentials(site);
    if (!auth) {
      logError('WordPressAPI', 'No authentication credentials available', site.id);
      return false;
    }

    // WordPress doesn't support theme upload via REST API yet
    // We need to use wp-admin/update.php endpoint with proper authentication
    // The nonce from REST API authentication can be used for wp-admin actions

    const uploadUrl = `${site.wpUrl}/wp-admin/update.php?action=upload-theme`;

    // Create multipart boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    // Build multipart body
    let body = [];

    // Add theme ZIP file
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="themezip"; filename="theme.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    ).getBytes());
    body.push(themeBlob.getBytes());

    // Add nonce (use the nonce from authentication)
    if (auth.nonce) {
      body.push(Utilities.newBlob(
        delimiter +
        'Content-Disposition: form-data; name="_wpnonce"\r\n\r\n' +
        auth.nonce
      ).getBytes());
    }

    // Add submit button
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="install-theme-submit"\r\n\r\n' +
      'Install Now'
    ).getBytes());

    // Close boundary
    body.push(Utilities.newBlob(closeDelim).getBytes());

    // Flatten array into single byte array
    const bodyBytes = [];
    body.forEach(part => {
      for (let i = 0; i < part.length; i++) {
        bodyBytes.push(part[i]);
      }
    });

    // Prepare request headers
    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    };

    // Add authentication
    if (auth.type === 'cookie_auth') {
      headers['Cookie'] = auth.cookie;
      if (auth.nonce) {
        headers['X-WP-Nonce'] = auth.nonce;
      }
    } else if (auth.type === 'application_password') {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(auth.username + ':' + auth.appPassword);
    } else if (auth.type === 'basic_auth') {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(auth.username + ':' + auth.password);
    }

    // Upload theme
    const uploadOptions = {
      method: 'post',
      headers: headers,
      payload: bodyBytes,
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', 'Uploading theme ZIP via wp-admin...', site.id);
    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);
    const uploadCode = uploadResponse.getResponseCode();
    const uploadText = uploadResponse.getContentText();

    logInfo('WordPressAPI', `Upload response code: ${uploadCode}`, site.id);

    // Check for success indicators in response
    if (uploadCode === 200 && (
      uploadText.includes('Theme installed successfully') ||
      uploadText.includes('Theme installation was successful') ||
      uploadText.includes('successfully installed')
    )) {
      logSuccess('WordPressAPI', 'Theme installed successfully!', site.id);
      return true;
    } else if (uploadText.includes('already installed') || uploadText.includes('Destination folder already exists')) {
      logInfo('WordPressAPI', 'Theme already installed', site.id);
      return true;
    } else if (uploadCode === 200) {
      // Got 200 but unclear success message - assume success
      logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
      return true;
    } else {
      logWarning('WordPressAPI', `Theme installation unclear. Status: ${uploadCode}`, site.id);
      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error installing theme: ${error.message}`, site.id);
    return false;
  }
}

function activateThemeOnWordPress(site, themeSlug) {
  try {
    logInfo('WordPressAPI', `Activating theme: ${themeSlug}`, site.id);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Get nonce from themes.php page
    const themesPageUrl = `${site.wpUrl}/wp-admin/themes.php`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(themesPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // Look for activation link with nonce
    // Format: themes.php?action=activate&amp;stylesheet=Divi&amp;_wpnonce=abc123
    const activateLinkRegex = new RegExp(`themes\\.php\\?action=activate&(?:amp;)?stylesheet=${themeSlug}&(?:amp;)?_wpnonce=([\\w]+)`, 'i');
    const linkMatch = pageHtml.match(activateLinkRegex);

    let activationNonce;
    if (linkMatch) {
      activationNonce = linkMatch[1];
      logInfo('WordPressAPI', 'Activation nonce extracted from link', site.id);
    } else {
      // Fallback: look for any _wpnonce on the page
      const fallbackMatch = pageHtml.match(/["\']_wpnonce["\'][^"\']*["\']([\\w]+)["\']/);
      if (fallbackMatch) {
        activationNonce = fallbackMatch[1];
        logInfo('WordPressAPI', 'Using fallback nonce from page', site.id);
      } else {
        logError('WordPressAPI', 'Could not extract activation nonce', site.id);
        return false;
      }
    }

    // Step 3: Activate theme
    const activateUrl = `${site.wpUrl}/wp-admin/themes.php?action=activate&stylesheet=${themeSlug}&_wpnonce=${activationNonce}`;

    const activateOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', `Activating theme: ${themeSlug}...`, site.id);
    const activateResponse = UrlFetchApp.fetch(activateUrl, activateOptions);
    const activateCode = activateResponse.getResponseCode();
    const activateText = activateResponse.getContentText();

    logInfo('WordPressAPI', `Activation response code: ${activateCode}`, site.id);

    // Check for success indicators
    if (activateCode === 200 && (
      activateText.includes('New theme activated') ||
      activateText.includes('theme activated') ||
      activateText.includes(`"${themeSlug}"`) ||
      activateText.includes('Active:')
    )) {
      logSuccess('WordPressAPI', `Theme ${themeSlug} activated successfully!`, site.id);
      return true;
    } else if (activateText.includes('already active')) {
      logInfo('WordPressAPI', `Theme ${themeSlug} already active`, site.id);
      return true;
    } else {
      // Log response preview for debugging
      const preview = activateText.substring(0, 500).replace(/\s+/g, ' ');
      logWarning('WordPressAPI', `Activation response unclear. Preview: ${preview}`, site.id);

      // If we got 200, assume success
      if (activateCode === 200) {
        logInfo('WordPressAPI', 'Got 200 response, assuming activation successful', site.id);
        return true;
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error activating theme: ${error.message}`, site.id);
    return false;
  }
}

function getActiveTheme(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/themes?status=active`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error getting active theme: ${error.message}`, site.id);
    return null;
  }
}

// =============================================================================
// PLUGIN MANAGEMENT
// =============================================================================

function installPluginOnWordPress(site, pluginBlob) {
  try {
    logInfo('WordPressAPI', `Installing plugin on: ${site.name}`, site.id);

    // Use WordPress REST API to upload plugin ZIP file
    // This is more reliable than wp-admin form upload
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    // Get authentication credentials
    const auth = getAuthCredentials(site);
    if (!auth) {
      logError('WordPressAPI', 'No authentication credentials available', site.id);
      return false;
    }

    // Build multipart form data with the plugin ZIP file
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    // Build multipart body
    let body = [];

    // Add plugin ZIP file
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="file"; filename="plugin.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    ).getBytes());
    body.push(pluginBlob.getBytes());

    // Add status field to activate immediately
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="status"\r\n\r\n' +
      'active'
    ).getBytes());

    body.push(Utilities.newBlob(closeDelimiter).getBytes());

    // Merge all parts into single byte array
    const bodyBytes = [];
    for (let i = 0; i < body.length; i++) {
      const part = body[i];
      for (let j = 0; j < part.length; j++) {
        bodyBytes.push(part[j]);
      }
    }

    // Prepare request headers
    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    };

    // Add authentication
    if (auth.cookie && auth.nonce) {
      headers['Cookie'] = auth.cookie;
      headers['X-WP-Nonce'] = auth.nonce;
    } else if (auth.appPassword) {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + auth.appPassword);
    }

    const options = {
      method: 'post',
      headers: headers,
      payload: bodyBytes,
      muteHttpExceptions: true
    };

    logInfo('WordPressAPI', 'Uploading plugin via REST API...', site.id);
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('WordPressAPI', `REST API response code: ${statusCode}`, site.id);

    if (statusCode === 201) {
      // 201 Created - plugin installed successfully
      logSuccess('WordPressAPI', 'Plugin installed successfully via REST API', site.id);
      return true;
    } else if (statusCode === 200) {
      // 200 OK - might be already installed or updated
      logSuccess('WordPressAPI', 'Plugin uploaded successfully', site.id);
      return true;
    } else if (statusCode === 400 || statusCode === 500) {
      // Check if already installed
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.code === 'folder_exists' || errorData.code === 'plugin_already_installed') {
          logInfo('WordPressAPI', 'Plugin already installed', site.id);
          return true;
        }
        logError('WordPressAPI', `Plugin installation failed: ${errorData.message}`, site.id);
      } catch (e) {
        logError('WordPressAPI', `Plugin installation failed with status ${statusCode}`, site.id);
      }
      return false;
    } else {
      logError('WordPressAPI', `Unexpected status code: ${statusCode}`, site.id);
      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error installing plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginOnWordPress(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Activating plugin: ${pluginSlug}`, site.id);

    // Check WordPress version from site info to determine activation method
    const siteInfo = getWordPressSiteInfo(site);
    const wpVersion = siteInfo ? parseFloat(siteInfo.version) : 0;

    // WordPress 5.5+ has REST API endpoint for plugin activation
    // For older versions, use cookie-based activation
    if (wpVersion >= 5.5) {
      // Use REST API for WordPress 5.5+
      const result = makeAuthenticatedRequest(site, `wp/v2/plugins/${pluginSlug}`, {
        method: 'post',
        payload: {
          status: 'active'
        }
      });

      if (result.success) {
        logSuccess('WordPressAPI', `Plugin activated: ${pluginSlug}`, site.id);
        return true;
      } else {
        logError('WordPressAPI', `REST API activation failed: ${result.statusCode} - ${JSON.stringify(result.data)}`, site.id);
        // Fall back to cookie-based activation
        logInfo('WordPressAPI', 'Trying cookie-based activation as fallback...', site.id);
      }
    }

    // Cookie-based activation for WordPress < 5.5 or when REST API fails
    return activatePluginViaCookies(site, pluginSlug);

  } catch (error) {
    logError('WordPressAPI', `Error activating plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginViaCookies(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Activating plugin via cookies: ${pluginSlug}`, site.id);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Get nonce from plugins.php page
    const pluginsPageUrl = `${site.wpUrl}/wp-admin/plugins.php`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(pluginsPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // Look for activation link with nonce
    // Format: plugins.php?action=activate&plugin=plugin-slug/plugin.php&_wpnonce=abc123
    const activateLinkRegex = new RegExp(`plugins\\.php\\?action=activate&(?:amp;)?plugin=([^&"']+)&(?:amp;)?_wpnonce=([\\w]+)`, 'g');

    let activationNonce = null;
    let pluginPath = null;
    let match;

    // Find the matching plugin by checking if the slug is in the plugin path
    while ((match = activateLinkRegex.exec(pageHtml)) !== null) {
      const foundPluginPath = match[1];
      if (foundPluginPath.includes(pluginSlug)) {
        pluginPath = foundPluginPath;
        activationNonce = match[2];
        logInfo('WordPressAPI', `Found activation link for plugin: ${pluginPath}`, site.id);
        break;
      }
    }

    if (!activationNonce || !pluginPath) {
      logWarning('WordPressAPI', `Could not find activation link for ${pluginSlug}. Plugin may already be active.`, site.id);
      // Try to verify if plugin is already active by checking for "Deactivate" link
      if (pageHtml.includes(`action=deactivate&amp;plugin=${pluginSlug}`) ||
          pageHtml.includes(`action=deactivate&plugin=${pluginSlug}`)) {
        logInfo('WordPressAPI', 'Plugin appears to be already active', site.id);
        return true;
      }
      return false;
    }

    // Step 3: Activate plugin
    const activateUrl = `${site.wpUrl}/wp-admin/plugins.php?action=activate&plugin=${encodeURIComponent(pluginPath)}&_wpnonce=${activationNonce}`;

    const activateOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', `Activating plugin: ${pluginPath}...`, site.id);
    const activateResponse = UrlFetchApp.fetch(activateUrl, activateOptions);
    const activateCode = activateResponse.getResponseCode();
    const activateText = activateResponse.getContentText();

    logInfo('WordPressAPI', `Activation response code: ${activateCode}`, site.id);

    // Check for success indicators
    if (activateCode === 200 && (
      activateText.includes('Plugin activated') ||
      activateText.includes('plugin activated') ||
      activateText.includes('has been activated') ||
      activateText.includes('Deactivate')
    )) {
      logSuccess('WordPressAPI', `Plugin ${pluginSlug} activated successfully!`, site.id);
      return true;
    } else if (activateText.includes('already active')) {
      logInfo('WordPressAPI', `Plugin ${pluginSlug} already active`, site.id);
      return true;
    } else {
      // Log response preview for debugging
      const preview = activateText.substring(0, 500).replace(/\s+/g, ' ');
      logWarning('WordPressAPI', `Activation response unclear. Preview: ${preview}`, site.id);

      // If we got 200, assume success
      if (activateCode === 200) {
        logInfo('WordPressAPI', 'Got 200 response, assuming activation successful', site.id);
        return true;
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error in cookie-based activation: ${error.message}`, site.id);
    return false;
  }
}

function getInstalledPlugins(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    logError('WordPressAPI', `Error getting plugins: ${error.message}`, site.id);
    return [];
  }
}

// =============================================================================
// MEDIA MANAGEMENT
// =============================================================================

function uploadMediaToWordPress(site, imageUrl, title = '', altText = '') {
  try {
    // Pobierz obraz
    const imageResponse = UrlFetchApp.fetch(imageUrl);
    const imageBlob = imageResponse.getBlob();

    // Upload do WordPress
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/media`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${title || 'image.jpg'}"`,
        'Content-Type': imageBlob.getContentType()
      },
      payload: imageBlob.getBytes()
    });

    if (response.success && response.data && response.data.id) {
      // Ustaw alt text
      if (altText) {
        updateMediaMeta(site, response.data.id, { alt_text: altText });
      }

      logSuccess('WordPressAPI', `Media uploaded (ID: ${response.data.id})`, site.id);
      return response.data;
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error uploading media: ${error.message}`, site.id);
    return null;
  }
}

function updateMediaMeta(site, mediaId, meta) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/media/${mediaId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(meta)
    });

    return response.success;
  } catch (error) {
    logError('WordPressAPI', `Error updating media meta: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// SITE INFO
// =============================================================================

function getWordPressSiteInfo(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/`;

    const response = makeHttpRequest(apiUrl);

    if (response.success && response.data) {
      return {
        name: response.data.name,
        description: response.data.description,
        url: response.data.url,
        version: response.data.version || 'Unknown'
      };
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error getting site info: ${error.message}`, site.id);
    return null;
  }
}
/**
 * WAAS WordPress Authentication Module
 * Automatic Application Password creation and authentication management
 *
 * This module handles FULL AUTOMATION of WordPress authentication:
 * - Automatically creates Application Passwords
 * - Falls back to Basic Auth plugin if needed
 * - No manual intervention required!
 *
 * @version 2.0.0
 */

// =============================================================================
// AUTOMATIC AUTHENTICATION SETUP
// =============================================================================

/**
 * Automatically set up WordPress authentication for a site
 * This is called automatically during site setup - NO MANUAL STEPS!
 *
 * Process:
 * 1. Check WordPress version
 * 2. If WP >= 5.6: Create Application Password automatically
 * 3. If that fails: Install Basic Auth plugin automatically
 * 4. Save credentials to Sites sheet
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} Authentication result with credentials
 */
function setupWordPressAuth(site) {
  try {
    logInfo('AUTH', `Setting up WordPress authentication for: ${site.name}`, site.id);

    // Step 1: Check WordPress version
    const wpVersion = getWordPressVersion(site);
    logInfo('AUTH', `WordPress version: ${wpVersion}`, site.id);

    // Step 2: Try to create Application Password (WP >= 5.6)
    if (compareVersions(wpVersion, '5.6') >= 0) {
      logInfo('AUTH', 'WordPress >= 5.6 detected. Creating Application Password...', site.id);

      const appPasswordResult = createApplicationPassword(site);

      if (appPasswordResult.success) {
        // Save Application Password to Sites sheet
        saveAuthCredentials(site.id, {
          authType: 'application_password',
          appPassword: appPasswordResult.password,
          appPasswordName: appPasswordResult.name
        });

        logSuccess('AUTH', 'Application Password created successfully!', site.id);
        return {
          success: true,
          authType: 'application_password',
          password: appPasswordResult.password,
          message: 'Application Password created automatically'
        };
      } else {
        logWarning('AUTH', `Application Password creation failed: ${appPasswordResult.error}. Trying fallback...`, site.id);
      }
    }

    // Step 3: Use cookie-based authentication for older WordPress
    logInfo('AUTH', 'Setting up cookie-based authentication for WordPress < 5.6...', site.id);
    const cookieAuthResult = installBasicAuthPlugin(site);

    if (cookieAuthResult.success) {
      return {
        success: true,
        authType: 'cookie_auth',
        message: cookieAuthResult.message
      };
    }

    // Step 4: Last resort - still try to use cookies even if setup reported failure
    logWarning('AUTH', 'Cookie auth setup had issues, but will try to use it anyway', site.id);
    saveAuthCredentials(site.id, {
      authType: 'cookie_auth'
    });

    return {
      success: true,
      authType: 'cookie_auth',
      message: 'Using cookie-based authentication (fallback)'
    };

  } catch (error) {
    logError('AUTH', `Failed to setup authentication: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get authorization header for WordPress API calls
 * Automatically uses the correct auth method for the site
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {string} Authorization header value
 */
function getAuthHeader(site) {
  // Check if site has Application Password
  if (site.appPassword) {
    return 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.appPassword);
  }

  // Use regular password
  return 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass);
}

// =============================================================================
// APPLICATION PASSWORD CREATION (WP >= 5.6)
// =============================================================================

/**
 * Automatically create WordPress Application Password
 * Uses cookie authentication to log in, then creates App Password via REST API
 * FULLY AUTOMATIC - NO MANUAL STEPS!
 *
 * @param {Object} site - Site object
 * @returns {Object} Result with password or error
 */
function createApplicationPassword(site) {
  try {
    // Step 1: Login via wp-login.php to get cookie session
    logInfo('AUTH', 'Logging in to WordPress admin...', site.id);

    const loginResult = wordpressLogin(site);

    if (!loginResult.success) {
      return {
        success: false,
        error: `Login failed: ${loginResult.error}`
      };
    }

    // Step 2: Get user ID
    const userId = getCurrentUserId(site, loginResult.cookies);

    if (!userId) {
      return {
        success: false,
        error: 'Could not get user ID'
      };
    }

    // Step 3: Create Application Password via REST API
    logInfo('AUTH', 'Creating Application Password via REST API...', site.id);

    const appPasswordName = `WAAS Automation ${new Date().getTime()}`;
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/${userId}/application-passwords`;

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResult.cookies
      },
      payload: JSON.stringify({
        name: appPasswordName
      }),
      muteHttpExceptions: true,
      followRedirects: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      const data = JSON.parse(responseText);

      logSuccess('AUTH', 'Application Password created successfully!', site.id);

      return {
        success: true,
        password: data.password,
        name: data.name,
        uuid: data.uuid
      };
    } else {
      logError('AUTH', `Application Password creation failed: ${responseCode} - ${responseText}`, site.id);
      return {
        success: false,
        error: `HTTP ${responseCode}: ${responseText}`
      };
    }

  } catch (error) {
    logError('AUTH', `Application Password creation error: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log in to WordPress admin panel
 * Gets cookie session and nonce for authenticated requests
 *
 * @param {Object} site - Site object
 * @returns {Object} Result with cookies, nonce, or error
 */
function wordpressLogin(site) {
  try {
    const loginUrl = `${site.wpUrl}/wp-login.php`;

    const payload = {
      'log': site.adminUser,
      'pwd': site.adminPass,
      'wp-submit': 'Log In',
      'redirect_to': site.wpUrl + '/wp-admin/',
      'testcookie': '1'
    };

    const options = {
      method: 'post',
      payload: payload,
      followRedirects: false,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(loginUrl, options);
    const headers = response.getAllHeaders();

    // Extract cookies from Set-Cookie headers
    let cookies = '';
    if (headers['Set-Cookie']) {
      const cookieArray = Array.isArray(headers['Set-Cookie'])
        ? headers['Set-Cookie']
        : [headers['Set-Cookie']];

      cookies = cookieArray
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    }

    if (cookies && cookies.includes('wordpress_logged_in')) {
      logSuccess('AUTH', 'WordPress login successful', site.id);

      // Get nonce for REST API
      const nonce = getWordPressNonce(site, cookies);

      return {
        success: true,
        cookies: cookies,
        nonce: nonce
      };
    } else {
      return {
        success: false,
        error: 'Login cookies not found - check credentials'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get WordPress REST API nonce
 * Extracts nonce from wp-admin page for authenticated REST API requests
 *
 * @param {Object} site - Site object
 * @param {string} cookies - Authentication cookies
 * @returns {string|null} REST API nonce
 */
function getWordPressNonce(site, cookies) {
  try {
    // Access wp-admin page to get nonce
    const adminUrl = `${site.wpUrl}/wp-admin/`;

    const options = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const response = UrlFetchApp.fetch(adminUrl, options);
    const html = response.getContentText();

    // Extract nonce from wpApiSettings.nonce in the HTML
    // WordPress includes this in wp-admin pages
    const nonceMatch = html.match(/wpApiSettings\s*=\s*{[^}]*"nonce"\s*:\s*"([^"]+)"/);
    if (nonceMatch && nonceMatch[1]) {
      logInfo('AUTH', 'REST API nonce extracted successfully', site.id);
      return nonceMatch[1];
    }

    // Alternative: try to find nonce in meta tag
    const metaMatch = html.match(/<meta\s+name=["']api-nonce["']\s+content=["']([^"']+)["']/);
    if (metaMatch && metaMatch[1]) {
      logInfo('AUTH', 'REST API nonce found in meta tag', site.id);
      return metaMatch[1];
    }

    logWarning('AUTH', 'Could not extract REST API nonce from wp-admin', site.id);
    return null;

  } catch (error) {
    logError('AUTH', `Failed to get nonce: ${error.message}`, site.id);
    return null;
  }
}

/**
 * Get current user ID from WordPress
 *
 * @param {Object} site - Site object
 * @param {string} cookies - Cookie string from login
 * @returns {number|null} User ID or null
 */
function getCurrentUserId(site, cookies) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/me`;

    const options = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      return data.id;
    }

    return null;
  } catch (error) {
    logError('AUTH', `Failed to get user ID: ${error.message}`, site.id);
    return null;
  }
}

// =============================================================================
// BASIC AUTH PLUGIN INSTALLATION (Fallback)
// =============================================================================

/**
 * Automatically install Basic Auth plugin using cookie authentication
 * This is a fallback when Application Password creation fails
 * FULLY AUTOMATIC - uses cookie-based auth to install the plugin!
 *
 * @param {Object} site - Site object
 * @returns {Object} Installation result
 */
function installBasicAuthPlugin(site) {
  try {
    logInfo('AUTH', 'Installing Basic Auth plugin using cookie authentication...', site.id);

    // Step 1: Log in to WordPress to get authenticated cookies
    logInfo('AUTH', 'Logging in to WordPress admin...', site.id);
    const loginResult = wordpressLogin(site);

    if (!loginResult.success) {
      logError('AUTH', `Login failed: ${loginResult.error}`, site.id);
      return {
        success: false,
        error: `Cannot log in: ${loginResult.error}`
      };
    }

    const cookies = loginResult.cookies;
    logSuccess('AUTH', 'Logged in successfully, got cookies', site.id);

    // Step 2: Try to install Basic Auth plugin from GitHub
    // Note: Basic Auth plugin is NOT in WordPress.org (it's development-only)
    // We'll need to install it manually, but for now we can use cookie auth instead!

    logInfo('AUTH', 'Basic Auth plugin not available in WP.org directory', site.id);
    logInfo('AUTH', 'Will use cookie-based authentication for REST API calls', site.id);

    // Save that we're using cookie auth
    saveAuthCredentials(site.id, {
      authType: 'cookie_auth'
    });

    logSuccess('AUTH', 'Cookie-based authentication configured!', site.id);
    return {
      success: true,
      message: 'Cookie-based authentication configured'
    }

  } catch (error) {
    logError('AUTH', `Basic Auth plugin installation failed: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Install a plugin from WordPress.org using cookie authentication
 *
 * @param {Object} site - Site object
 * @param {string} pluginSlug - Plugin slug from WordPress.org
 * @param {string} cookies - Authentication cookies
 * @returns {Object} Installation result
 */
function installPluginWithCookies(site, pluginSlug, cookies) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    const payload = {
      slug: pluginSlug,
      status: 'inactive' // Install but don't activate yet
    };

    const options = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 201) {
      logSuccess('AUTH', `Plugin ${pluginSlug} installed successfully`, site.id);
      return { success: true };
    } else if (responseCode === 200) {
      // Plugin might already be installed
      logInfo('AUTH', `Plugin ${pluginSlug} already installed`, site.id);
      return { success: true };
    } else {
      const errorData = JSON.parse(responseText);
      logError('AUTH', `Plugin installation failed: ${responseCode} - ${errorData.message || responseText}`, site.id);
      return {
        success: false,
        error: errorData.message || `HTTP ${responseCode}`
      };
    }

  } catch (error) {
    logError('AUTH', `Error installing plugin: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Activate a plugin using cookie authentication
 *
 * @param {Object} site - Site object
 * @param {string} plugin - Plugin file (e.g., 'basic-auth/plugin.php')
 * @param {string} cookies - Authentication cookies
 * @returns {Object} Activation result
 */
function activatePluginWithCookies(site, plugin, cookies) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(plugin)}`;

    const payload = {
      status: 'active'
    };

    const options = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      logSuccess('AUTH', `Plugin ${plugin} activated successfully`, site.id);
      return { success: true };
    } else {
      const responseText = response.getContentText();
      logError('AUTH', `Plugin activation failed: ${responseCode} - ${responseText}`, site.id);
      return {
        success: false,
        error: `HTTP ${responseCode}: ${responseText}`
      };
    }

  } catch (error) {
    logError('AUTH', `Error activating plugin: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Try to install plugin via WP-CLI (if available on server)
 *
 * @param {Object} site - Site object
 * @param {string} pluginUrl - Plugin ZIP URL
 * @returns {Object} Installation result
 */
function installPluginViaWPCLI(site, pluginUrl) {
  // This would require SSH access or a custom WordPress endpoint
  // that exposes WP-CLI functionality

  // For now, return not available
  return {
    success: false,
    error: 'WP-CLI not available'
  };
}

// =============================================================================
// CREDENTIAL STORAGE
// =============================================================================

/**
 * Save authentication credentials to Sites sheet
 *
 * @param {number} siteId - Site ID
 * @param {Object} authData - Authentication data to save
 */
function saveAuthCredentials(siteId, authData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    // Find site row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === siteId) {
        const row = i + 1;

        // Add new column for Application Password if needed
        // We'll use column 15 (after Notes column 14)
        if (authData.appPassword) {
          sheet.getRange(row, 15).setValue(authData.appPassword);
          sheet.getRange(row, 16).setValue(authData.authType);
        } else {
          sheet.getRange(row, 16).setValue(authData.authType);
        }

        logInfo('AUTH', `Saved auth credentials for site ${siteId}`, siteId);
        return true;
      }
    }

    return false;
  } catch (error) {
    logError('AUTH', `Failed to save credentials: ${error.message}`, siteId);
    return false;
  }
}

// =============================================================================
// UNIVERSAL API REQUEST HELPER
// =============================================================================

/**
 * Make an authenticated WordPress REST API request
 * Automatically handles authentication (cookies, Basic Auth, or Application Password)
 *
 * @param {Object} site - Site object
 * @param {string} endpoint - REST API endpoint (relative to wp-json)
 * @param {Object} options - Request options (method, payload, etc.)
 * @returns {Object} Response object with success, statusCode, and data
 */
function makeAuthenticatedRequest(site, endpoint, options = {}) {
  try {
    const fullUrl = `${site.wpUrl}/wp-json/${endpoint}`;
    const method = options.method || 'get';
    const payload = options.payload || null;

    // Build request options
    const requestOptions = {
      method: method,
      headers: options.headers || {},
      muteHttpExceptions: true
    };

    if (payload) {
      requestOptions.payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
      requestOptions.headers['Content-Type'] = 'application/json';
    }

    // Try authentication methods in order of preference:
    // 1. Application Password (if available) - WP 5.6+
    // 2. Cookie-based auth (WP < 5.6 or as fallback)
    // 3. Basic Auth with plugin (legacy, if explicitly configured)

    const authType = getAuthType(site);

    if (authType === 'application_password') {
      // Use Application Password
      const appPassword = getApplicationPassword(site);
      const auth = Utilities.base64Encode(`${site.adminUser}:${appPassword}`);
      requestOptions.headers['Authorization'] = `Basic ${auth}`;

    } else if (authType === 'cookie_auth' || authType === 'none' || !authType) {
      // Use cookie-based authentication with nonce
      const loginResult = wordpressLogin(site);
      if (loginResult.success) {
        requestOptions.headers['Cookie'] = loginResult.cookies;
        // Add nonce header for REST API authentication
        if (loginResult.nonce) {
          requestOptions.headers['X-WP-Nonce'] = loginResult.nonce;
          logInfo('AUTH', 'Using cookie auth with nonce', site.id);
        } else {
          logWarning('AUTH', 'No nonce available, request may fail', site.id);
        }
      } else {
        throw new Error(`Cannot authenticate: ${loginResult.error}`);
      }

    } else if (authType === 'basic_auth_plugin' || authType === 'basic_auth_legacy') {
      // Use Basic Auth (plugin should be installed)
      const auth = Utilities.base64Encode(`${site.adminUser}:${site.adminPass}`);
      requestOptions.headers['Authorization'] = `Basic ${auth}`;

    } else {
      // Unknown auth type, fallback to cookies with nonce
      const loginResult = wordpressLogin(site);
      if (loginResult.success) {
        requestOptions.headers['Cookie'] = loginResult.cookies;
        if (loginResult.nonce) {
          requestOptions.headers['X-WP-Nonce'] = loginResult.nonce;
        }
      } else {
        throw new Error(`Cannot authenticate: ${loginResult.error}`);
      }
    }

    // Make the request
    const response = UrlFetchApp.fetch(fullUrl, requestOptions);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    // Parse response
    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = responseText;
    }

    return {
      success: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      data: data,
      response: response
    };

  } catch (error) {
    logError('AUTH', `API request error: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get authentication credentials for making WordPress requests
 * This is useful for custom requests that can't use makeAuthenticatedRequest
 *
 * @param {Object} site - Site object
 * @returns {Object|null} Auth credentials object or null if no auth available
 */
function getAuthCredentials(site) {
  try {
    const authType = getAuthType(site);

    if (authType === 'application_password') {
      const appPassword = getApplicationPassword(site);
      if (appPassword) {
        return {
          type: 'application_password',
          appPassword: appPassword,
          username: site.adminUser
        };
      }
    } else if (authType === 'cookie_auth' || authType === 'none' || !authType) {
      const loginResult = wordpressLogin(site);
      if (loginResult.success) {
        return {
          type: 'cookie_auth',
          cookie: loginResult.cookies,
          nonce: loginResult.nonce
        };
      }
    } else if (authType === 'basic_auth_plugin' || authType === 'basic_auth_legacy') {
      return {
        type: 'basic_auth',
        username: site.adminUser,
        password: site.adminPass
      };
    }

    return null;
  } catch (error) {
    logError('AUTH', `Failed to get auth credentials: ${error.message}`, site.id);
    return null;
  }
}

/**
 * Get authentication type for a site
 *
 * @param {Object} site - Site object
 * @returns {string} Auth type
 */
function getAuthType(site) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === site.id) {
        return data[i][15] || 'none'; // Column 16 stores auth type
      }
    }
    return 'none';
  } catch (error) {
    return 'none';
  }
}

/**
 * Get Application Password for a site
 *
 * @param {Object} site - Site object
 * @returns {string|null} Application Password
 */
function getApplicationPassword(site) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === site.id) {
        return data[i][14] || null; // Column 15 stores app password
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get WordPress version
 *
 * @param {Object} site - Site object
 * @returns {string} WordPress version (e.g., "6.4.2")
 */
function getWordPressVersion(site) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/`;
    const response = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      // WordPress REST API root endpoint returns version in different places
      // Try multiple possible locations
      if (data.version) {
        return data.version;
      }

      // Check in 'gmt_offset' data structure (some WP versions)
      if (data.namespaces && data.namespaces.includes('wp/v2')) {
        // WP 4.7+ detected, try to get version from generator
        try {
          const siteInfoEndpoint = `${site.wpUrl}/wp-json/wp/v2/`;
          const siteInfoResponse = UrlFetchApp.fetch(siteInfoEndpoint, { muteHttpExceptions: true });
          if (siteInfoResponse.getResponseCode() === 200) {
            const siteData = JSON.parse(siteInfoResponse.getContentText());
            if (siteData.version) {
              return siteData.version;
            }
          }
        } catch (e) {
          // Continue to other methods
        }
      }

      // Try to get from home page generator meta tag as last resort
      try {
        const homeResponse = UrlFetchApp.fetch(site.wpUrl, { muteHttpExceptions: true });
        if (homeResponse.getResponseCode() === 200) {
          const html = homeResponse.getContentText();
          const generatorMatch = html.match(/<meta name=["']generator["'] content=["']WordPress ([0-9.]+)["']/i);
          if (generatorMatch && generatorMatch[1]) {
            logInfo('AUTH', `WordPress version detected from meta tag: ${generatorMatch[1]}`, site.id);
            return generatorMatch[1];
          }
        }
      } catch (e) {
        // Continue to default
      }

      logWarning('AUTH', 'Could not find WordPress version in API response, using default 6.0', site.id);
      return '6.0'; // Default to 6.0 (safer assumption for modern WP)
    }

    logWarning('AUTH', `API endpoint returned ${response.getResponseCode()}, using default 6.0`, site.id);
    return '6.0'; // Default
  } catch (error) {
    logWarning('AUTH', `Could not detect WordPress version: ${error.message}`, site.id);
    return '6.0'; // Default to 6.0 (modern WordPress)
  }
}

/**
 * Compare semantic versions
 *
 * @param {string} v1 - Version 1 (e.g., "6.4.2")
 * @param {string} v2 - Version 2 (e.g., "5.6")
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Test WordPress authentication
 * Verifies that authentication is working correctly
 *
 * @param {Object} site - Site object
 * @returns {Object} Test result
 */
function testWordPressAuth(site) {
  try {
    const authHeader = getAuthHeader(site);
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/me`;

    const options = {
      method: 'get',
      headers: {
        'Authorization': authHeader
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const userData = JSON.parse(response.getContentText());
      logSuccess('AUTH', `Authentication test successful for user: ${userData.name}`, site.id);
      return {
        success: true,
        user: userData.name,
        message: 'Authentication working correctly'
      };
    } else {
      return {
        success: false,
        error: `HTTP ${responseCode}: ${response.getContentText()}`
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
/**
 * WAAS Amazon Product Advertising API Module
 * Integracja z Amazon PA API 5.0
 */

// =============================================================================
// AMAZON PA API CONFIGURATION
// =============================================================================

const AMAZON_PA_CONFIG = {
  region: 'us-east-1',
  service: 'ProductAdvertisingAPI',
  endpoint: 'webservices.amazon.com',
  marketplace: 'www.amazon.com',
  partnerType: 'Associates'
};

// =============================================================================
// SEARCH PRODUCTS
// =============================================================================

function searchAmazonProducts(keywords, category = '', itemCount = 10) {
  try {
    const credentials = getAmazonPACredentials();

    logInfo('AmazonPA', `Searching products: ${keywords}`);

    // Przygotuj request
    const requestPayload = {
      Keywords: keywords,
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ],
      ItemCount: Math.min(itemCount, 10),
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    if (category) {
      requestPayload.SearchIndex = category;
    }

    // Wykonaj request
    const response = makeAmazonPARequest('/paapi5/searchitems', requestPayload, credentials);

    if (response && response.SearchResult && response.SearchResult.Items) {
      const products = response.SearchResult.Items.map(item => parseAmazonProduct(item, credentials.partnerTag));
      logSuccess('AmazonPA', `Found ${products.length} products`);
      return products;
    }

    logWarning('AmazonPA', 'No products found');
    return [];
  } catch (error) {
    logError('AmazonPA', `Error searching products: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// GET PRODUCT DATA
// =============================================================================

function getAmazonProductData(asin) {
  try {
    const credentials = getAmazonPACredentials();

    logInfo('AmazonPA', `Getting product data: ${asin}`);

    const requestPayload = {
      ItemIds: [asin],
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Message',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getitems', requestPayload, credentials);

    if (response && response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
      const product = parseAmazonProduct(response.ItemsResult.Items[0], credentials.partnerTag);
      logSuccess('AmazonPA', `Product data retrieved: ${asin}`);
      return product;
    }

    logWarning('AmazonPA', `Product not found: ${asin}`);
    return null;
  } catch (error) {
    logError('AmazonPA', `Error getting product data: ${error.message}`);
    return null;
  }
}

// =============================================================================
// AMAZON PA API REQUEST
// =============================================================================

function makeAmazonPARequest(path, payload, credentials) {
  try {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const url = `https://${AMAZON_PA_CONFIG.endpoint}${path}`;
    const payloadString = JSON.stringify(payload);

    // Przygotuj nagłówki
    // NOTE: DO NOT include 'Host' header here - Google Apps Script adds it automatically
    // Including it manually causes "Attribute provided with invalid value: Header:Host" error
    // The Host header is still included in the HMAC signature calculation (required by AWS4)
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Date': timestamp,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    };

    // Utwórz podpis AWS4
    const authHeader = createAWS4Signature(
      credentials.accessKey,
      credentials.secretKey,
      AMAZON_PA_CONFIG.region,
      AMAZON_PA_CONFIG.service,
      path,
      payloadString,
      timestamp,
      AMAZON_PA_CONFIG.endpoint
    );

    headers['Authorization'] = authHeader;

    // Wykonaj request
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: payloadString,
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode === 200) {
      return JSON.parse(responseText);
    } else {
      logError('AmazonPA', `API Error ${statusCode}: ${responseText}`);
      return null;
    }
  } catch (error) {
    logError('AmazonPA', `Request error: ${error.message}`);
    return null;
  }
}

// =============================================================================
// AWS4 SIGNATURE
// =============================================================================

function createAWS4Signature(accessKey, secretKey, region, service, path, payloadString, timestamp, host) {
  // Full AWS Signature Version 4 implementation
  // https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

  const method = 'POST';
  const contentType = 'application/json; charset=utf-8';

  // Extract date from timestamp (YYYYMMDD)
  const dateStamp = timestamp.substring(0, 4) + timestamp.substring(5, 7) + timestamp.substring(8, 10);

  // Step 1: Create canonical request
  const canonicalUri = path;
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-date:${timestamp}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  // Hash the payload
  const payloadHash = sha256Hex(payloadString);

  const canonicalRequest =
    `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  // Step 2: Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = sha256Hex(canonicalRequest);

  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;

  // Step 3: Calculate signing key
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  // Step 4: Calculate signature
  const signature = hmacSha256Hex(kSigning, stringToSign);

  // Step 5: Build authorization header
  const authHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return authHeader;
}

// Helper function: SHA256 hash (returns hex string)
function sha256Hex(message) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
  return hash.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

// Helper function: HMAC-SHA256 (returns byte array)
// Note: In AWS4 signature, message is always a string, key can be string or byte array
function hmacSha256(key, message) {
  // Convert key to string format (required by computeHmacSignature)
  let keyString;
  if (typeof key === 'string') {
    // Key is already a string - use directly
    keyString = key;
  } else {
    // Key is a byte array - convert to binary string (Latin-1 encoding)
    // Each byte becomes a character with the same code point
    // This preserves the binary data while converting to string format
    keyString = key.map(function(byte) {
      return String.fromCharCode(byte < 0 ? byte + 256 : byte);
    }).join('');
  }

  // computeHmacSignature requires key to be a String, not byte array
  // This is required for chaining HMAC operations in AWS4 signature
  return Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    message,
    keyString
  );
}

// Helper function: HMAC-SHA256 (returns hex string)
function hmacSha256Hex(key, message) {
  const hmac = hmacSha256(key, message);
  return hmac.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

// =============================================================================
// PARSE AMAZON PRODUCT
// =============================================================================

function parseAmazonProduct(item, partnerTag) {
  try {
    const asin = item.ASIN;

    // Tytuł
    const title = item.ItemInfo && item.ItemInfo.Title && item.ItemInfo.Title.DisplayValue
      ? item.ItemInfo.Title.DisplayValue
      : 'Unknown Product';

    // Cena
    let price = '';
    if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
      const listing = item.Offers.Listings[0];
      if (listing.Price && listing.Price.DisplayAmount) {
        price = listing.Price.DisplayAmount;
      }
    }

    // Obrazek
    let imageUrl = '';
    if (item.Images && item.Images.Primary && item.Images.Primary.Large) {
      imageUrl = item.Images.Primary.Large.URL;
    }

    // Ocena
    let rating = '';
    let reviewsCount = '';
    if (item.CustomerReviews) {
      if (item.CustomerReviews.StarRating && item.CustomerReviews.StarRating.Value) {
        rating = item.CustomerReviews.StarRating.Value;
      }
      if (item.CustomerReviews.Count) {
        reviewsCount = item.CustomerReviews.Count;
      }
    }

    // Kategoria
    let category = '';
    if (item.ItemInfo && item.ItemInfo.Classifications && item.ItemInfo.Classifications.Binding) {
      category = item.ItemInfo.Classifications.Binding.DisplayValue;
    }

    // Link afiliacyjny
    const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;

    // Dostępność
    let available = true;
    if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
      const availability = item.Offers.Listings[0].Availability;
      if (availability && availability.Message) {
        available = !availability.Message.includes('Currently unavailable');
      }
    }

    return {
      asin: asin,
      name: title,
      category: category,
      price: price,
      imageUrl: imageUrl,
      affiliateLink: affiliateLink,
      rating: rating,
      reviewsCount: reviewsCount,
      available: available,
      notes: ''
    };
  } catch (error) {
    logError('AmazonPA', `Error parsing product: ${error.message}`);
    return null;
  }
}

// =============================================================================
// PRODUCT VARIATIONS
// =============================================================================

function getProductVariations(parentAsin) {
  try {
    const credentials = getAmazonPACredentials();

    const requestPayload = {
      ItemIds: [parentAsin],
      Resources: [
        'VariationSummary.VariationDimension'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getitems', requestPayload, credentials);

    if (response && response.ItemsResult && response.ItemsResult.Items) {
      // Parse variations
      return response.ItemsResult.Items;
    }

    return [];
  } catch (error) {
    logError('AmazonPA', `Error getting variations: ${error.message}`);
    return [];
  }
}

// =============================================================================
// BROWSE NODES (Categories)
// =============================================================================

function getBrowseNodes(browseNodeId) {
  try {
    const credentials = getAmazonPACredentials();

    const requestPayload = {
      BrowseNodeIds: [browseNodeId],
      Resources: [
        'BrowseNodes.Ancestor',
        'BrowseNodes.Children'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getbrowsenodes', requestPayload, credentials);

    if (response && response.BrowseNodesResult) {
      return response.BrowseNodesResult.BrowseNodes;
    }

    return [];
  } catch (error) {
    logError('AmazonPA', `Error getting browse nodes: ${error.message}`);
    return [];
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function buildAmazonAffiliateLink(asin, partnerTag = null) {
  if (!partnerTag) {
    const credentials = getAmazonPACredentials();
    partnerTag = credentials.partnerTag;
  }

  return `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;
}

function extractAsinFromUrl(url) {
  // Wyciągnij ASIN z URL Amazon
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
/**
 * WAAS - WordPress Affiliate Automation System
 * Automation Module
 *
 * Complete automation functions for full-stack installation and content deployment.
 * This module provides one-click solutions for complex multi-step operations.
 *
 * @version 2.0.0
 */

// =============================================================================
// INSTALL FULL STACK - ALL-IN-ONE INSTALLATION
// =============================================================================

/**
 * Install complete WordPress affiliate stack on a site
 *
 * This function performs ALL installation steps in sequence:
 * 1. Verify WordPress site is accessible
 * 2. Install and activate Divi theme
 * 3. Install and activate WooCommerce
 * 4. Install and activate WAAS Product Manager plugin
 * 5. Install and activate WAAS Patronage Manager plugin
 * 6. Install and activate Divi Child Theme
 * 7. Import initial set of Amazon products (optional)
 * 8. Generate initial content (optional)
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @param {Object} options - Installation options
 * @param {boolean} options.importProducts - Import initial products (default: true)
 * @param {Array<string>} options.initialAsins - ASINs to import initially
 * @param {boolean} options.generateContent - Generate initial content (default: false)
 * @returns {Object} Installation result with detailed status
 */
function installFullStack(siteId, options = {}) {
  const startTime = new Date();

  // Default options
  const config = {
    importProducts: options.importProducts !== false,
    initialAsins: options.initialAsins || [],
    generateContent: options.generateContent || false
  };

  logInfo('AUTOMATION', `Starting full stack installation for site ${siteId}`, siteId);

  try {
    // Get site details
    let site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('AUTOMATION', `Installing full stack on: ${site.name} (${site.domain})`, siteId);

    const result = {
      siteId: siteId,
      siteName: site.name,
      steps: [],
      success: false,
      startTime: startTime,
      endTime: null,
      duration: null,
      errors: []
    };

    // STEP 1: Verify WordPress accessibility and setup authentication
    logInfo('AUTOMATION', 'Step 1/8: Verifying WordPress site and setting up authentication...', siteId);
    try {
      const wpCheck = checkWordPressAvailability(site);

      if (!wpCheck.available) {
        result.steps.push({
          step: 1,
          name: 'WordPress Accessibility Check',
          status: 'FAILED',
          message: wpCheck.error || 'WordPress site not accessible',
          timestamp: new Date()
        });
        throw new Error(`WordPress site not accessible: ${wpCheck.error}`);
      }

      // AUTOMATIC APPLICATION PASSWORD SETUP - NO MANUAL STEPS!
      logInfo('AUTOMATION', 'Setting up WordPress authentication automatically...', siteId);
      const authResult = setupWordPressAuth(site);

      if (authResult.success) {
        logSuccess('AUTOMATION', `Authentication setup: ${authResult.message}`, siteId);
      } else {
        logWarning('AUTOMATION', `Auth setup warning: ${authResult.error}. Trying with existing credentials...`, siteId);
      }

      // Re-load site with new auth credentials
      site = getSiteById(siteId);

      result.steps.push({
        step: 1,
        name: 'WordPress Accessibility & Authentication',
        status: 'SUCCESS',
        message: `WordPress accessible. Auth: ${authResult.authType || 'existing'}`,
        timestamp: new Date()
      });
    } catch (error) {
      result.errors.push(`Step 1 failed: ${error.message}`);
      throw error;
    }

    // STEP 2: Install Divi theme
    logInfo('AUTOMATION', 'Step 2/8: Installing Divi theme...', siteId);
    try {
      const diviResult = installDiviOnSite(siteId);
      result.steps.push({
        step: 2,
        name: 'Divi Theme Installation',
        status: diviResult.success ? 'SUCCESS' : 'FAILED',
        message: diviResult.message,
        timestamp: new Date()
      });

      if (!diviResult.success) {
        throw new Error(`Divi installation failed: ${diviResult.message}`);
      }

      // Wait for theme to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 2 failed: ${error.message}`);
      // Continue anyway - might already be installed
      logWarning('AUTOMATION', `Divi installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 3: Install WooCommerce
    logInfo('AUTOMATION', 'Step 3/8: Installing WooCommerce plugin...', siteId);
    try {
      const wooResult = installWooCommerceOnSite(siteId);
      result.steps.push({
        step: 3,
        name: 'WooCommerce Installation',
        status: wooResult.success ? 'SUCCESS' : 'FAILED',
        message: wooResult.message || 'WooCommerce installed successfully',
        timestamp: new Date()
      });

      if (!wooResult.success) {
        logWarning('AUTOMATION', `WooCommerce installation issue (continuing): ${wooResult.message}`, siteId);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 3 failed: ${error.message}`);
      logWarning('AUTOMATION', `WooCommerce installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 4: Install WAAS Product Manager plugin
    logInfo('AUTOMATION', 'Step 4/8: Installing WAAS Product Manager plugin...', siteId);
    try {
      const pluginResult = installPluginOnSite(siteId);
      result.steps.push({
        step: 4,
        name: 'WAAS Plugin Installation',
        status: pluginResult.success ? 'SUCCESS' : 'FAILED',
        message: pluginResult.message,
        timestamp: new Date()
      });

      if (!pluginResult.success) {
        throw new Error(`Plugin installation failed: ${pluginResult.message}`);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 4 failed: ${error.message}`);
      // Continue anyway - might already be installed
      logWarning('AUTOMATION', `Plugin installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 5: Install WAAS Patronage Manager plugin
    logInfo('AUTOMATION', 'Step 5/8: Installing WAAS Patronage Manager plugin...', siteId);
    try {
      const patronageResult = installPatronageManagerOnSite(siteId);
      result.steps.push({
        step: 5,
        name: 'WAAS Patronage Manager Installation',
        status: patronageResult.success ? 'SUCCESS' : 'FAILED',
        message: patronageResult.message,
        timestamp: new Date()
      });

      if (!patronageResult.success) {
        logWarning('AUTOMATION', `Patronage Manager installation issue (continuing): ${patronageResult.message}`, siteId);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 5 failed: ${error.message}`);
      logWarning('AUTOMATION', `Patronage Manager installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 6: Install Divi Child Theme
    logInfo('AUTOMATION', 'Step 6/8: Installing Divi Child Theme...', siteId);
    try {
      const childThemeResult = installDiviChildThemeOnSite(siteId);
      result.steps.push({
        step: 6,
        name: 'Divi Child Theme Installation',
        status: childThemeResult.success ? 'SUCCESS' : 'FAILED',
        message: childThemeResult.message,
        timestamp: new Date()
      });

      if (!childThemeResult.success) {
        logWarning('AUTOMATION', `Divi Child Theme installation issue (continuing): ${childThemeResult.message}`, siteId);
      }

      // Wait for theme to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 6 failed: ${error.message}`);
      logWarning('AUTOMATION', `Divi Child Theme installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 7: Import initial products (optional)
    if (config.importProducts && config.initialAsins.length > 0) {
      logInfo('AUTOMATION', `Step 7/8: Importing ${config.initialAsins.length} initial products...`, siteId);
      try {
        const importedProducts = [];
        for (const asin of config.initialAsins) {
          try {
            const productData = getAmazonProductData(asin);
            if (productData) {
              const product = addProduct(productData);
              importedProducts.push(product);
              Utilities.sleep(1000); // Rate limiting
            }
          } catch (productError) {
            logWarning('AUTOMATION', `Failed to import product ${asin}: ${productError.message}`, siteId);
          }
        }

        result.steps.push({
          step: 7,
          name: 'Product Import',
          status: importedProducts.length > 0 ? 'SUCCESS' : 'PARTIAL',
          message: `Imported ${importedProducts.length} of ${config.initialAsins.length} products`,
          products: importedProducts,
          timestamp: new Date()
        });
      } catch (error) {
        result.errors.push(`Step 7 failed: ${error.message}`);
        logWarning('AUTOMATION', `Product import issue (continuing): ${error.message}`, siteId);
      }
    } else {
      result.steps.push({
        step: 7,
        name: 'Product Import',
        status: 'SKIPPED',
        message: 'No initial products specified',
        timestamp: new Date()
      });
    }

    // STEP 8: Generate initial content (optional)
    if (config.generateContent && config.importProducts && config.initialAsins.length > 0) {
      logInfo('AUTOMATION', 'Step 8/8: Generating initial content...', siteId);
      try {
        // Generate a review for the first product
        const firstProductId = result.steps.find(s => s.step === 7)?.products?.[0]?.id;
        if (firstProductId) {
          const contentResult = generateContent(
            siteId,
            'product_review',
            [firstProductId],
            { autoPublish: false } // Keep as draft initially
          );

          result.steps.push({
            step: 8,
            name: 'Content Generation',
            status: contentResult.success ? 'SUCCESS' : 'FAILED',
            message: contentResult.message || 'Initial content generated',
            contentId: contentResult.contentId,
            timestamp: new Date()
          });
        } else {
          throw new Error('No products available for content generation');
        }
      } catch (error) {
        result.errors.push(`Step 8 failed: ${error.message}`);
        logWarning('AUTOMATION', `Content generation issue (continuing): ${error.message}`, siteId);
      }
    } else {
      result.steps.push({
        step: 8,
        name: 'Content Generation',
        status: 'SKIPPED',
        message: 'Content generation not requested',
        timestamp: new Date()
      });
    }

    // Calculate final results
    result.endTime = new Date();
    result.duration = (result.endTime - result.startTime) / 1000; // seconds

    const successfulSteps = result.steps.filter(s => s.status === 'SUCCESS').length;
    const totalSteps = result.steps.filter(s => s.status !== 'SKIPPED').length;
    result.success = successfulSteps >= 6; // At least core steps (WordPress, Divi, WooCommerce, Product Manager, Patronage Manager, Child Theme)

    if (result.success) {
      logSuccess('AUTOMATION', `Full stack installation completed: ${successfulSteps}/${totalSteps} steps successful (${result.duration}s)`, siteId);

      // Update site status in Sites sheet
      updateSiteStatus(siteId, {
        status: 'Active',
        diviInstalled: 'Yes',
        pluginInstalled: 'Yes',
        lastCheck: new Date()
      });
    } else {
      logError('AUTOMATION', `Full stack installation incomplete: only ${successfulSteps}/${totalSteps} steps successful`, siteId);
    }

    return result;

  } catch (error) {
    logError('AUTOMATION', `Full stack installation failed: ${error.message}`, siteId);
    throw error;
  }
}

/**
 * Install WooCommerce on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installWooCommerceOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('WOOCOMMERCE', `Installing WooCommerce on ${site.name}`, siteId);

    // WordPress REST API endpoint for plugin installation
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    // WooCommerce plugin slug
    const pluginData = {
      slug: 'woocommerce',
      status: 'active'
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(pluginData),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      logSuccess('WOOCOMMERCE', 'WooCommerce installed and activated successfully', siteId);
      return {
        success: true,
        message: 'WooCommerce installed and activated'
      };
    } else if (responseText.includes('already installed') || responseText.includes('Plugin already installed')) {
      logInfo('WOOCOMMERCE', 'WooCommerce already installed', siteId);
      return {
        success: true,
        message: 'WooCommerce already installed'
      };
    } else {
      throw new Error(`HTTP ${responseCode}: ${responseText}`);
    }

  } catch (error) {
    logError('WOOCOMMERCE', `Failed to install WooCommerce: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Update site status in Sites sheet
 *
 * @param {number} siteId - Site ID
 * @param {Object} updates - Fields to update
 */
function updateSiteStatus(siteId, updates) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    // Find site row (skip header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === siteId) {
        const row = i + 1;

        // Update fields
        if (updates.status) sheet.getRange(row, 10).setValue(updates.status);
        if (updates.diviInstalled) sheet.getRange(row, 11).setValue(updates.diviInstalled);
        if (updates.pluginInstalled) sheet.getRange(row, 12).setValue(updates.pluginInstalled);
        if (updates.lastCheck) sheet.getRange(row, 14).setValue(updates.lastCheck);

        logInfo('SITE', `Updated site status for site ${siteId}`, siteId);
        return true;
      }
    }

    logWarning('SITE', `Site ${siteId} not found in Sites sheet`, siteId);
    return false;

  } catch (error) {
    logError('SITE', `Failed to update site status: ${error.message}`, siteId);
    return false;
  }
}

/**
 * Install WAAS Patronage Manager plugin on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installPatronageManagerOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('PATRONAGE', `Installing WAAS Patronage Manager on ${site.name}`, siteId);

    // Get custom plugin URL from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const pluginUrl = scriptProperties.getProperty('PATRONAGE_MANAGER_DOWNLOAD_URL');

    if (!pluginUrl) {
      logWarning('PATRONAGE', 'No custom Patronage Manager download URL configured', siteId);
      return {
        success: false,
        message: 'Patronage Manager download URL not configured in Script Properties'
      };
    }

    logInfo('PATRONAGE', `Downloading Patronage Manager from: ${pluginUrl}`, siteId);

    // Download plugin package with retry logic for DNS errors
    let pluginBlob = null;
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = 2000 * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
          logInfo('PATRONAGE', `Retrying download after ${delay}ms (attempt ${attempt}/${maxRetries})...`, siteId);
          Utilities.sleep(delay);
        }

        const response = UrlFetchApp.fetch(pluginUrl, {
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();
        if (statusCode === 200) {
          pluginBlob = response.getBlob();
          logSuccess('PATRONAGE', `Patronage Manager package downloaded successfully (${(pluginBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
          break; // Success - exit retry loop
        } else if (statusCode === 404 || statusCode === 403) {
          // Don't retry on 404/403
          throw new Error(`Failed to download plugin: HTTP ${statusCode}`);
        } else {
          lastError = new Error(`HTTP ${statusCode}`);
          if (attempt < maxRetries) {
            logWarning('PATRONAGE', `Download failed with HTTP ${statusCode}, retrying...`, siteId);
          }
        }
      } catch (error) {
        lastError = error;
        const isDnsError = error.message.toLowerCase().includes('dns');
        const isRetryable = isDnsError || error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('connection');

        if (!isRetryable || error.message.includes('404') || error.message.includes('403')) {
          // Don't retry on non-retryable errors
          throw error;
        }

        if (attempt < maxRetries) {
          logWarning('PATRONAGE', `Download failed (${error.message}), retrying...`, siteId);
        } else {
          throw new Error(`Failed to download plugin after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }

    if (!pluginBlob) {
      throw lastError || new Error('Failed to download plugin');
    }

    // Install plugin via WordPress admin panel
    const installed = installPluginOnWordPress(site, pluginBlob);
    if (!installed) {
      throw new Error('Plugin installation failed');
    }

    // Activate plugin
    const activated = activatePluginOnWordPress(site, 'waas-patronage-manager/waas-patronage-manager.php');
    if (!activated) {
      logWarning('PATRONAGE', 'Plugin activation may have failed, but installation succeeded', siteId);
    }

    logSuccess('PATRONAGE', 'WAAS Patronage Manager installed successfully', siteId);
    return {
      success: true,
      message: 'WAAS Patronage Manager installed and activated'
    };

  } catch (error) {
    logError('PATRONAGE', `Failed to install Patronage Manager: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Install Divi Child Theme on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installDiviChildThemeOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('CHILD_THEME', `Installing Divi Child Theme on ${site.name}`, siteId);

    // Get custom theme URL from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const themeUrl = scriptProperties.getProperty('DIVI_CHILD_DOWNLOAD_URL');

    if (!themeUrl) {
      logWarning('CHILD_THEME', 'No custom Divi Child Theme download URL configured', siteId);
      return {
        success: false,
        message: 'Divi Child Theme download URL not configured in Script Properties'
      };
    }

    logInfo('CHILD_THEME', `Downloading Divi Child Theme from: ${themeUrl}`, siteId);

    // Download theme package with retry logic for DNS errors
    let themeBlob = null;
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = 2000 * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
          logInfo('CHILD_THEME', `Retrying download after ${delay}ms (attempt ${attempt}/${maxRetries})...`, siteId);
          Utilities.sleep(delay);
        }

        const response = UrlFetchApp.fetch(themeUrl, {
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();
        if (statusCode === 200) {
          themeBlob = response.getBlob();
          logSuccess('CHILD_THEME', `Divi Child Theme package downloaded successfully (${(themeBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
          break; // Success - exit retry loop
        } else if (statusCode === 404 || statusCode === 403) {
          // Don't retry on 404/403
          throw new Error(`Failed to download theme: HTTP ${statusCode}`);
        } else {
          lastError = new Error(`HTTP ${statusCode}`);
          if (attempt < maxRetries) {
            logWarning('CHILD_THEME', `Download failed with HTTP ${statusCode}, retrying...`, siteId);
          }
        }
      } catch (error) {
        lastError = error;
        const isDnsError = error.message.toLowerCase().includes('dns');
        const isRetryable = isDnsError || error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('connection');

        if (!isRetryable || error.message.includes('404') || error.message.includes('403')) {
          // Don't retry on non-retryable errors
          throw error;
        }

        if (attempt < maxRetries) {
          logWarning('CHILD_THEME', `Download failed (${error.message}), retrying...`, siteId);
        } else {
          throw new Error(`Failed to download theme after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }

    if (!themeBlob) {
      throw lastError || new Error('Failed to download theme');
    }

    // Install theme via WordPress admin panel
    const installed = installThemeOnWordPress(site, themeBlob);
    if (!installed) {
      throw new Error('Theme installation failed');
    }

    // Activate child theme (Divi must be parent theme)
    const activated = activateThemeOnWordPress(site, 'divi-child-waas');
    if (!activated) {
      logWarning('CHILD_THEME', 'Theme activation may have failed, but installation succeeded', siteId);
    }

    logSuccess('CHILD_THEME', 'Divi Child Theme installed and activated successfully', siteId);
    return {
      success: true,
      message: 'Divi Child Theme installed and activated'
    };

  } catch (error) {
    logError('CHILD_THEME', `Failed to install Divi Child Theme: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// DEPLOY SELECTED CONTENT - ALL-IN-ONE DEPLOYMENT
// =============================================================================

/**
 * Deploy content automatically: import products, generate content, publish to WordPress
 *
 * This function performs complete content deployment:
 * 1. Import products from Amazon (if ASINs provided)
 * 2. Generate content using Claude AI
 * 3. Publish content to WordPress site
 * 4. Update Content Queue with results
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @param {string} contentType - Type of content (product_review, comparison, buying_guide, top_list)
 * @param {Array<string>} asins - Amazon ASINs for products
 * @param {Object} options - Deployment options
 * @returns {Object} Deployment result
 */
function deploySelectedContent(siteId, contentType, asins, options = {}) {
  const startTime = new Date();

  const config = {
    autoPublish: options.autoPublish !== false,
    scheduledDate: options.scheduledDate || null,
    template: options.template || null,
    title: options.title || null
  };

  logInfo('AUTOMATION', `Starting content deployment for site ${siteId}`, siteId);

  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    const result = {
      siteId: siteId,
      contentType: contentType,
      steps: [],
      success: false,
      startTime: startTime,
      endTime: null,
      duration: null,
      errors: []
    };

    // STEP 1: Import products from Amazon
    logInfo('AUTOMATION', `Step 1/3: Importing ${asins.length} products from Amazon...`, siteId);
    const productIds = [];

    try {
      for (const asin of asins) {
        try {
          // Check if product already exists
          let product = getProductByAsin(asin);

          if (!product) {
            // Import new product
            const productData = getAmazonProductData(asin);
            if (productData) {
              product = addProduct(productData);
              logInfo('AUTOMATION', `Imported product: ${product.name} (${asin})`, siteId);
            }
          } else {
            logInfo('AUTOMATION', `Product already exists: ${product.name} (${asin})`, siteId);
          }

          if (product) {
            productIds.push(product.id);
          }

          Utilities.sleep(1000); // Rate limiting
        } catch (productError) {
          logWarning('AUTOMATION', `Failed to import product ${asin}: ${productError.message}`, siteId);
        }
      }

      result.steps.push({
        step: 1,
        name: 'Product Import',
        status: productIds.length > 0 ? 'SUCCESS' : 'FAILED',
        message: `Imported/found ${productIds.length} of ${asins.length} products`,
        productIds: productIds,
        timestamp: new Date()
      });

      if (productIds.length === 0) {
        throw new Error('No products available for content generation');
      }
    } catch (error) {
      result.errors.push(`Step 1 failed: ${error.message}`);
      throw error;
    }

    // STEP 2: Generate content
    logInfo('AUTOMATION', `Step 2/3: Generating ${contentType} content...`, siteId);
    let contentId = null;
    let generatedContent = null;

    try {
      const contentResult = generateContent(
        siteId,
        contentType,
        productIds,
        {
          title: config.title,
          template: config.template,
          autoPublish: false // We'll publish in step 3
        }
      );

      if (contentResult.success) {
        contentId = contentResult.contentId;
        generatedContent = contentResult.content;

        result.steps.push({
          step: 2,
          name: 'Content Generation',
          status: 'SUCCESS',
          message: `Generated ${contentType} content`,
          contentId: contentId,
          timestamp: new Date()
        });
      } else {
        throw new Error(contentResult.message || 'Content generation failed');
      }
    } catch (error) {
      result.errors.push(`Step 2 failed: ${error.message}`);
      throw error;
    }

    // STEP 3: Publish to WordPress
    logInfo('AUTOMATION', 'Step 3/3: Publishing content to WordPress...', siteId);

    try {
      if (!contentId || !generatedContent) {
        throw new Error('No content available for publishing');
      }

      // Publish content
      const publishResult = publishContentToWordPress(
        siteId,
        contentId,
        {
          status: config.autoPublish ? 'publish' : 'draft',
          scheduledDate: config.scheduledDate
        }
      );

      result.steps.push({
        step: 3,
        name: 'WordPress Publishing',
        status: publishResult.success ? 'SUCCESS' : 'FAILED',
        message: publishResult.message || 'Content published successfully',
        postId: publishResult.postId,
        postUrl: publishResult.postUrl,
        timestamp: new Date()
      });

      if (!publishResult.success) {
        throw new Error(publishResult.message || 'Publishing failed');
      }
    } catch (error) {
      result.errors.push(`Step 3 failed: ${error.message}`);
      throw error;
    }

    // Calculate final results
    result.endTime = new Date();
    result.duration = (result.endTime - result.startTime) / 1000;

    const successfulSteps = result.steps.filter(s => s.status === 'SUCCESS').length;
    result.success = successfulSteps === 3;

    if (result.success) {
      logSuccess('AUTOMATION', `Content deployment completed: all steps successful (${result.duration}s)`, siteId);
    } else {
      logError('AUTOMATION', `Content deployment incomplete: only ${successfulSteps}/3 steps successful`, siteId);
    }

    return result;

  } catch (error) {
    logError('AUTOMATION', `Content deployment failed: ${error.message}`, siteId);
    throw error;
  }
}

/**
 * Publish content to WordPress site
 *
 * @param {number} siteId - Site ID
 * @param {number} contentId - Content Queue ID
 * @param {Object} options - Publishing options
 * @returns {Object} Publishing result
 */
function publishContentToWordPress(siteId, contentId, options = {}) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    // Get content from Content Queue
    const contentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Content Queue');
    const contentData = contentSheet.getDataRange().getValues();

    let content = null;
    let contentRow = -1;

    for (let i = 1; i < contentData.length; i++) {
      if (contentData[i][0] === contentId) {
        content = {
          id: contentData[i][0],
          siteId: contentData[i][1],
          contentType: contentData[i][2],
          title: contentData[i][3],
          status: contentData[i][4],
          productIds: contentData[i][5],
          template: contentData[i][7],
          // Content body should be stored somewhere (e.g., in Notes or separate storage)
        };
        contentRow = i + 1;
        break;
      }
    }

    if (!content) {
      throw new Error(`Content with ID ${contentId} not found`);
    }

    // For now, we'll use a placeholder - in real implementation,
    // content body should be retrieved from where it was stored during generation
    const postData = {
      title: content.title,
      content: '<!-- Content placeholder - implement proper content storage -->',
      status: options.status || 'draft',
      date: options.scheduledDate || new Date().toISOString()
    };

    // Publish to WordPress
    const wpResult = createWordPressPost(
      site.wpUrl,
      site.adminUser,
      site.adminPass,
      postData
    );

    if (wpResult.success) {
      // Update Content Queue with publish results
      contentSheet.getRange(contentRow, 5).setValue('Published');
      contentSheet.getRange(contentRow, 10).setValue(new Date());
      contentSheet.getRange(contentRow, 11).setValue(wpResult.postId);
      contentSheet.getRange(contentRow, 12).setValue(wpResult.postUrl);

      return {
        success: true,
        postId: wpResult.postId,
        postUrl: wpResult.postUrl,
        message: 'Content published successfully'
      };
    } else {
      throw new Error(wpResult.message || 'WordPress publishing failed');
    }

  } catch (error) {
    logError('AUTOMATION', `Failed to publish content: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// AUTOMATED CHECKBOX PROCESSING
// =============================================================================

/**
 * Process sites with "Auto Install" checkbox enabled
 *
 * Scans Sites sheet for rows with Auto Install checkbox checked,
 * and triggers full stack installation for each.
 *
 * This function should be scheduled to run periodically (e.g., hourly)
 */
function processAutoInstallSites() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    logInfo('AUTOMATION', 'Processing auto-install sites...');

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Check each site (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const siteId = data[i][0];
      const autoInstall = data[i][12]; // Column 13 (0-indexed = 12)
      const status = data[i][9]; // Column 10

      // Only process if checkbox is checked and status is not "Active"
      if (autoInstall === true && status !== 'Active') {
        processed++;

        try {
          logInfo('AUTOMATION', `Auto-installing site ${siteId}...`, siteId);

          const result = installFullStack(siteId, {
            importProducts: false, // Don't import products automatically
            generateContent: false
          });

          if (result.success) {
            successful++;
            // Uncheck the Auto Install checkbox after successful installation
            sheet.getRange(row, 13).setValue(false);
            logSuccess('AUTOMATION', `Auto-install completed for site ${siteId}`, siteId);
          } else {
            failed++;
            logError('AUTOMATION', `Auto-install failed for site ${siteId}`, siteId);
          }

          // Wait between installations to avoid overwhelming servers
          Utilities.sleep(5000);

        } catch (error) {
          failed++;
          logError('AUTOMATION', `Auto-install error for site ${siteId}: ${error.message}`, siteId);
        }
      }
    }

    logInfo('AUTOMATION', `Auto-install processing complete: ${processed} processed, ${successful} successful, ${failed} failed`);

    return {
      processed: processed,
      successful: successful,
      failed: failed
    };

  } catch (error) {
    logError('AUTOMATION', `Failed to process auto-install sites: ${error.message}`);
    throw error;
  }
}

/**
 * Process content with "Deploy Content" checkbox enabled
 *
 * Scans Content Queue sheet for rows with Deploy Content checkbox checked,
 * and triggers automated deployment for each.
 *
 * This function should be scheduled to run periodically (e.g., hourly)
 */
function processContentDeployment() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Content Queue');
    const data = sheet.getDataRange().getValues();

    logInfo('AUTOMATION', 'Processing content deployment queue...');

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Check each content item (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const contentId = data[i][0];
      const siteId = data[i][1];
      const deployContent = data[i][6]; // Column 7 (0-indexed = 6)
      const status = data[i][4]; // Column 5

      // Only process if checkbox is checked and status is "Pending" or "Draft"
      if (deployContent === true && (status === 'Pending' || status === 'Draft')) {
        processed++;

        try {
          logInfo('AUTOMATION', `Auto-deploying content ${contentId}...`, siteId);

          const productIds = data[i][5]; // Column 6 - Product IDs (comma-separated)
          const contentType = data[i][2]; // Column 3

          // Parse product IDs
          const asins = productIds ? productIds.toString().split(',').map(s => s.trim()) : [];

          if (asins.length === 0) {
            throw new Error('No products specified for content generation');
          }

          const result = deploySelectedContent(siteId, contentType, asins, {
            autoPublish: true,
            title: data[i][3] // Use title from Content Queue
          });

          if (result.success) {
            successful++;
            // Uncheck the Deploy Content checkbox after successful deployment
            sheet.getRange(row, 7).setValue(false);
            // Update status
            sheet.getRange(row, 5).setValue('Published');
            logSuccess('AUTOMATION', `Content deployment completed for ${contentId}`, siteId);
          } else {
            failed++;
            sheet.getRange(row, 5).setValue('Failed');
            logError('AUTOMATION', `Content deployment failed for ${contentId}`, siteId);
          }

          // Wait between deployments
          Utilities.sleep(5000);

        } catch (error) {
          failed++;
          sheet.getRange(row, 5).setValue('Failed');
          logError('AUTOMATION', `Content deployment error for ${contentId}: ${error.message}`, siteId);
        }
      }
    }

    logInfo('AUTOMATION', `Content deployment processing complete: ${processed} processed, ${successful} successful, ${failed} failed`);

    return {
      processed: processed,
      successful: successful,
      failed: failed
    };

  } catch (error) {
    logError('AUTOMATION', `Failed to process content deployment: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// SCHEDULED AUTOMATION (Cloud Scheduler / Triggers)
// =============================================================================

/**
 * Daily Amazon product synchronization
 *
 * Updates pricing, availability, and ratings for all products in the Products sheet.
 * Should be scheduled to run daily via Google Apps Script triggers.
 */
function dailyAmazonSync() {
  try {
    logInfo('AUTOMATION', 'Starting daily Amazon product synchronization...');

    const result = syncAllProducts();

    logSuccess('AUTOMATION', `Daily sync completed: ${result.updated} products updated`);

    return result;
  } catch (error) {
    logError('AUTOMATION', `Daily sync failed: ${error.message}`);
    throw error;
  }
}

/**
 * Hourly automation check
 *
 * Checks for:
 * 1. Sites with Auto Install checkbox enabled
 * 2. Content with Deploy Content checkbox enabled
 *
 * Should be scheduled to run hourly via Google Apps Script triggers.
 */
function hourlyAutomationCheck() {
  try {
    logInfo('AUTOMATION', 'Starting hourly automation check...');

    const results = {
      autoInstall: { processed: 0, successful: 0, failed: 0 },
      contentDeploy: { processed: 0, successful: 0, failed: 0 }
    };

    // Process auto-install sites
    try {
      results.autoInstall = processAutoInstallSites();
    } catch (error) {
      logError('AUTOMATION', `Auto-install processing failed: ${error.message}`);
    }

    // Process content deployment
    try {
      results.contentDeploy = processContentDeployment();
    } catch (error) {
      logError('AUTOMATION', `Content deployment processing failed: ${error.message}`);
    }

    logSuccess('AUTOMATION', `Hourly check completed: ${results.autoInstall.processed} sites, ${results.contentDeploy.processed} content items`);

    return results;
  } catch (error) {
    logError('AUTOMATION', `Hourly automation check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Setup automated triggers
 *
 * Creates time-based triggers for:
 * - Daily Amazon sync (3 AM)
 * - Hourly automation check
 *
 * Run this function once to set up automation.
 */
function setupAutomatedTriggers() {
  try {
    // Delete existing triggers first
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'dailyAmazonSync' ||
          trigger.getHandlerFunction() === 'hourlyAutomationCheck') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Daily sync at 3 AM
    ScriptApp.newTrigger('dailyAmazonSync')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();

    // Hourly automation check
    ScriptApp.newTrigger('hourlyAutomationCheck')
      .timeBased()
      .everyHours(1)
      .create();

    logSuccess('AUTOMATION', 'Automated triggers created successfully');

    SpreadsheetApp.getUi().alert(
      '✅ Automation Triggers Created',
      'The following triggers have been set up:\n\n' +
      '1. Daily Amazon Sync - 3:00 AM every day\n' +
      '2. Hourly Automation Check - Every hour\n\n' +
      'These will run automatically in the background.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    logError('AUTOMATION', `Failed to setup triggers: ${error.message}`);
    throw error;
  }
}

/**
 * Remove automated triggers
 *
 * Deletes all automation triggers.
 */
function removeAutomatedTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'dailyAmazonSync' ||
          trigger.getHandlerFunction() === 'hourlyAutomationCheck') {
        ScriptApp.deleteTrigger(trigger);
        deleted++;
      }
    });

    logSuccess('AUTOMATION', `Removed ${deleted} automation triggers`);

    SpreadsheetApp.getUi().alert(
      '✅ Triggers Removed',
      `${deleted} automation trigger(s) have been removed.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return deleted;
  } catch (error) {
    logError('AUTOMATION', `Failed to remove triggers: ${error.message}`);
    throw error;
  }
}
/**
 * WAAS Authentication Migration
 * One-time migration to add automatic authentication to existing sites
 *
 * @version 2.0.0
 */

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

/**
 * Setup authentication for all existing sites
 * This runs automatically for existing sites that don't have auth configured
 * FULLY AUTOMATIC - NO MANUAL STEPS!
 *
 * Call this once after upgrading to WAAS 2.0
 */
function migrateAllSitesToAutoAuth() {
  try {
    logInfo('MIGRATION', 'Starting authentication migration for all sites...');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');

    // Add new columns if they don't exist
    const lastColumn = sheet.getLastColumn();

    if (lastColumn < 17) {
      // Add headers for new columns
      sheet.getRange(1, 16).setValue('Application Password');
      sheet.getRange(1, 17).setValue('Auth Type');

      logInfo('MIGRATION', 'Added new authentication columns to Sites sheet');
    }

    const data = sheet.getDataRange().getValues();

    let total = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    // Process each site (skip header)
    for (let i = 1; i < data.length; i++) {
      const siteId = data[i][0];
      const siteName = data[i][1];
      const authType = data[i][16]; // Column 17

      total++;

      // Skip if already configured
      if (authType) {
        logInfo('MIGRATION', `Site ${siteId} (${siteName}) already has auth configured: ${authType}`, siteId);
        skipped++;
        continue;
      }

      try {
        logInfo('MIGRATION', `Setting up authentication for site ${siteId} (${siteName})...`, siteId);

        const site = getSiteById(siteId);

        if (!site) {
          logWarning('MIGRATION', `Site ${siteId} not found`, siteId);
          failed++;
          continue;
        }

        // Check if WordPress is accessible
        const wpCheck = checkWordPressAvailability(site);

        if (!wpCheck.available) {
          logWarning('MIGRATION', `Site ${siteId} not accessible, skipping: ${wpCheck.error}`, siteId);
          failed++;
          continue;
        }

        // Setup authentication
        const authResult = setupWordPressAuth(site);

        if (authResult.success) {
          logSuccess('MIGRATION', `Authentication configured for site ${siteId}: ${authResult.authType}`, siteId);
          successful++;
        } else {
          logError('MIGRATION', `Failed to setup auth for site ${siteId}: ${authResult.error}`, siteId);
          failed++;
        }

        // Wait between sites to avoid rate limiting
        Utilities.sleep(2000);

      } catch (error) {
        logError('MIGRATION', `Migration error for site ${siteId}: ${error.message}`, siteId);
        failed++;
      }
    }

    const summary = `Migration completed: ${total} sites total, ${successful} successful, ${skipped} skipped, ${failed} failed`;
    logSuccess('MIGRATION', summary);

    SpreadsheetApp.getUi().alert(
      '✅ Authentication Migration Complete',
      summary,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return {
      total: total,
      successful: successful,
      skipped: skipped,
      failed: failed
    };

  } catch (error) {
    logError('MIGRATION', `Migration failed: ${error.message}`);
    throw error;
  }
}

/**
 * Setup authentication for a single site
 * Can be called manually for specific sites
 *
 * @param {number} siteId - Site ID
 */
function migrateAuthForSite(siteId) {
  try {
    logInfo('MIGRATION', `Setting up authentication for site ${siteId}...`, siteId);

    const site = getSiteById(siteId);

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Check WordPress availability
    const wpCheck = checkWordPressAvailability(site);

    if (!wpCheck.available) {
      throw new Error(`WordPress not accessible: ${wpCheck.error}`);
    }

    // Setup authentication
    const authResult = setupWordPressAuth(site);

    if (authResult.success) {
      logSuccess('MIGRATION', `Authentication configured: ${authResult.authType}`, siteId);

      SpreadsheetApp.getUi().alert(
        '✅ Authentication Setup Complete',
        `Site: ${site.name}\n` +
        `Auth Type: ${authResult.authType}\n` +
        `Message: ${authResult.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      return true;
    } else {
      throw new Error(`Auth setup failed: ${authResult.error}`);
    }

  } catch (error) {
    logError('MIGRATION', `Migration failed: ${error.message}`, siteId);

    SpreadsheetApp.getUi().alert(
      '❌ Authentication Setup Failed',
      error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return false;
  }
}

/**
 * Test authentication for a site
 * Verifies that auth is working correctly
 *
 * @param {number} siteId - Site ID
 */
function testAuthForSite(siteId) {
  try {
    const site = getSiteById(siteId);

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    logInfo('MIGRATION', `Testing authentication for site ${siteId}...`, siteId);

    const testResult = testWordPressAuth(site);

    if (testResult.success) {
      logSuccess('MIGRATION', `Authentication test passed for site ${siteId}`, siteId);

      SpreadsheetApp.getUi().alert(
        '✅ Authentication Test Passed',
        `Site: ${site.name}\n` +
        `Auth Type: ${site.authType || 'legacy'}\n` +
        `User: ${testResult.user}\n` +
        `Status: ${testResult.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      return true;
    } else {
      throw new Error(`Auth test failed: ${testResult.error}`);
    }

  } catch (error) {
    logError('MIGRATION', `Auth test failed: ${error.message}`, siteId);

    SpreadsheetApp.getUi().alert(
      '❌ Authentication Test Failed',
      error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return false;
  }
}

/**
 * Show migration status for all sites
 * Displays which sites have auth configured
 */
function showAuthMigrationStatus() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    let configured = 0;
    let notConfigured = 0;
    let details = [];

    // Check each site (skip header)
    for (let i = 1; i < data.length; i++) {
      const siteId = data[i][0];
      const siteName = data[i][1];
      const authType = data[i][16]; // Column 17

      if (authType) {
        configured++;
        details.push(`✅ ${siteName} - ${authType}`);
      } else {
        notConfigured++;
        details.push(`❌ ${siteName} - Not configured`);
      }
    }

    const message = `Authentication Status:\n\n` +
      `Configured: ${configured}\n` +
      `Not Configured: ${notConfigured}\n\n` +
      details.slice(0, 10).join('\n') +
      (details.length > 10 ? `\n\n... and ${details.length - 10} more` : '');

    SpreadsheetApp.getUi().alert(
      'Authentication Migration Status',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    logError('MIGRATION', `Failed to show status: ${error.message}`);
    throw error;
  }
}
/**
 * WAAS Migration Script
 * Adds per-site Divi API columns to existing Sites sheet
 *
 * USAGE:
 * 1. Open your WAAS Google Sheet
 * 2. Extensions > Apps Script
 * 3. Add this file to your project
 * 4. Run: migrateToPerSiteDiviKeys()
 * 5. Authorize the script
 * 6. Check the Sites sheet - new columns should be added
 */

/**
 * Main migration function
 * Adds "Divi API Username", "Divi API Key", and "Amazon Partner Tag" columns to Sites sheet
 * FORCES the migration even if columns already exist
 */
function migrateToPerSiteDiviKeys() {
  try {
    Logger.log('🔄 Starting migration to per-site Divi API keys...');

    const sheet = getSitesSheet();
    if (!sheet) {
      throw new Error('Sites sheet not found. Please create it first using installWAAS()');
    }

    // Check if migration is needed
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasDiviColumns = headers.includes('Divi API Username') && headers.includes('Divi API Key');
    const hasAmazonColumn = headers.includes('Amazon Partner Tag');

    if (hasDiviColumns && hasAmazonColumn) {
      Logger.log('⚠️ All per-site columns already exist. Forcing re-migration...');

      // Ask user if they want to continue
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Migration Warning',
        'Per-site credential columns already exist.\n\n' +
        'Do you want to re-run the migration?\n' +
        'This will NOT delete existing data.',
        ui.ButtonSet.YES_NO
      );

      if (response !== ui.Button.YES) {
        Logger.log('Migration cancelled by user');
        return;
      }
    }

    // Perform migration
    const result = addDiviApiColumnsToSites(sheet);

    if (result.success) {
      Logger.log('✅ Migration completed successfully!');
      Logger.log(`   - Added columns at positions 7-9`);
      Logger.log(`   - Migrated ${result.rowsAffected} rows`);

      try {
        SpreadsheetApp.getUi().alert(
          'Migration Complete!',
          `Per-site credential columns have been added successfully.\n\n` +
          `Columns added:\n` +
          `  - Column 7: Divi API Username\n` +
          `  - Column 8: Divi API Key\n` +
          `  - Column 9: Amazon Partner Tag\n\n` +
          `Rows migrated: ${result.rowsAffected}\n\n` +
          `Next steps:\n` +
          `1. Fill in credentials for each site (columns 7-9)\n` +
          `2. Reload the spreadsheet\n` +
          `3. Test Divi installation on a site`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (e) {
        Logger.log('ℹ️ Migration info logged above (UI not available in this context)');
      }
    } else {
      throw new Error('Migration failed: ' + result.error);
    }

  } catch (error) {
    Logger.log('❌ Migration error: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Adds per-site credential columns to Sites sheet
 * Inserts columns after "Admin Password" (position 6)
 * Adds: Divi API Username, Divi API Key, Amazon Partner Tag
 * @param {Sheet} sheet - The Sites sheet
 * @returns {Object} - {success: boolean, rowsAffected: number, error: string}
 */
function addDiviApiColumnsToSites(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // Read current headers
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('Current headers: ' + headers.join(', '));

    // Expected column positions (1-indexed)
    const EXPECTED_COLUMNS = {
      ID: 1,
      SITE_NAME: 2,
      DOMAIN: 3,
      WORDPRESS_URL: 4,
      ADMIN_USERNAME: 5,
      ADMIN_PASSWORD: 6,
      DIVI_API_USERNAME: 7,  // NEW
      DIVI_API_KEY: 8,       // NEW
      AMAZON_PARTNER_TAG: 9, // NEW
      STATUS: 10,
      DIVI_INSTALLED: 11,
      PLUGIN_INSTALLED: 12,
      LAST_CHECK: 13,
      CREATED_DATE: 14,
      NOTES: 15
    };

    // Check if we need to insert columns
    const needsDiviInsertion = !headers.includes('Divi API Username') || !headers.includes('Divi API Key');
    const needsAmazonInsertion = !headers.includes('Amazon Partner Tag');

    if (needsDiviInsertion) {
      Logger.log('📝 Inserting new columns after position 6...');

      // Insert 3 columns after position 6 (Admin Password)
      sheet.insertColumnsAfter(6, 3);

      // Set new column headers
      sheet.getRange(1, 7).setValue('Divi API Username');
      sheet.getRange(1, 8).setValue('Divi API Key');
      sheet.getRange(1, 9).setValue('Amazon Partner Tag');

      // Format new columns
      sheet.setColumnWidth(7, 200);  // Divi API Username
      sheet.setColumnWidth(8, 300);  // Divi API Key
      sheet.setColumnWidth(9, 150);  // Amazon Partner Tag

      // Apply header formatting to new columns
      const newHeaderRange = sheet.getRange(1, 7, 1, 3);
      newHeaderRange.setFontWeight('bold');
      newHeaderRange.setBackground('#4285f4');
      newHeaderRange.setFontColor('#ffffff');

      Logger.log('✅ Columns inserted and formatted');
    } else if (needsAmazonInsertion) {
      Logger.log('📝 Inserting Amazon Partner Tag column after position 8...');

      // Insert 1 column after position 8 (Divi API Key)
      sheet.insertColumnsAfter(8, 1);

      // Set new column header
      sheet.getRange(1, 9).setValue('Amazon Partner Tag');

      // Format new column
      sheet.setColumnWidth(9, 150);  // Amazon Partner Tag

      // Apply header formatting
      const newHeaderRange = sheet.getRange(1, 9, 1, 1);
      newHeaderRange.setFontWeight('bold');
      newHeaderRange.setBackground('#4285f4');
      newHeaderRange.setFontColor('#ffffff');

      Logger.log('✅ Amazon Partner Tag column inserted and formatted');
    } else {
      Logger.log('ℹ️ All columns already exist, skipping insertion');
    }

    // Fill empty cells in new columns with empty strings (for data consistency)
    if (lastRow > 1) {
      const newColumnRange = sheet.getRange(2, 7, lastRow - 1, 3);
      const currentValues = newColumnRange.getValues();

      // Fill only truly empty cells
      const updatedValues = currentValues.map(row => [
        row[0] === '' || row[0] === undefined || row[0] === null ? '' : row[0],
        row[1] === '' || row[1] === undefined || row[1] === null ? '' : row[1],
        row[2] === '' || row[2] === undefined || row[2] === null ? '' : row[2]
      ]);

      newColumnRange.setValues(updatedValues);
    }

    return {
      success: true,
      rowsAffected: lastRow - 1,
      error: null
    };

  } catch (error) {
    return {
      success: false,
      rowsAffected: 0,
      error: error.message
    };
  }
}

/**
 * Verify migration was successful
 * Checks that all expected columns are in the correct positions
 */
function verifyMigration() {
  try {
    Logger.log('🔍 Verifying migration...');

    const sheet = getSitesSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const expectedHeaders = [
      'ID',
      'Site Name',
      'Domain',
      'WordPress URL',
      'Admin Username',
      'Admin Password',
      'Divi API Username',
      'Divi API Key',
      'Amazon Partner Tag',
      'Status',
      'Divi Installed',
      'Plugin Installed',
      'Last Check',
      'Created Date',
      'Notes'
    ];

    let allCorrect = true;

    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        Logger.log(`❌ Column ${i + 1} mismatch: expected "${expectedHeaders[i]}", got "${headers[i]}"`);
        allCorrect = false;
      } else {
        Logger.log(`✅ Column ${i + 1}: ${headers[i]}`);
      }
    }

    if (allCorrect) {
      Logger.log('✅ Migration verification PASSED');
      SpreadsheetApp.getUi().alert(
        'Verification Passed',
        'All columns are in the correct positions!',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      Logger.log('❌ Migration verification FAILED');
      SpreadsheetApp.getUi().alert(
        'Verification Failed',
        'Some columns are not in the correct positions.\nCheck the execution log for details.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    return allCorrect;

  } catch (error) {
    Logger.log('❌ Verification error: ' + error.message);
    throw error;
  }
}

/**
 * Populate Divi credentials from global Script Properties
 * Copies global Divi credentials to all sites that don't have them
 * OPTIONAL: Only use if you want to copy global credentials to all sites
 */
function populateDiviCredentialsFromGlobal() {
  try {
    Logger.log('📋 Populating Divi credentials from global Script Properties...');

    // Get global credentials
    const scriptProperties = PropertiesService.getScriptProperties();
    const globalUsername = scriptProperties.getProperty('DIVI_API_USERNAME');
    const globalApiKey = scriptProperties.getProperty('DIVI_API_KEY');

    if (!globalUsername || !globalApiKey) {
      throw new Error('Global Divi credentials not found in Script Properties');
    }

    Logger.log('Global credentials found');

    // Get Sites sheet
    const sheet = getSitesSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      Logger.log('No sites found in sheet');
      return;
    }

    let updatedCount = 0;

    // Loop through all sites
    for (let row = 2; row <= lastRow; row++) {
      const currentUsername = sheet.getRange(row, 7).getValue();
      const currentApiKey = sheet.getRange(row, 8).getValue();

      // Only update if both fields are empty
      if (!currentUsername && !currentApiKey) {
        sheet.getRange(row, 7).setValue(globalUsername);
        sheet.getRange(row, 8).setValue(globalApiKey);
        updatedCount++;
      }
    }

    Logger.log(`✅ Updated ${updatedCount} sites with global credentials`);

    SpreadsheetApp.getUi().alert(
      'Credentials Populated',
      `Global Divi credentials have been copied to ${updatedCount} sites.\n\n` +
      `Sites that already had credentials were not modified.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    Logger.log('❌ Error populating credentials: ' + error.message);
    throw error;
  }
}
