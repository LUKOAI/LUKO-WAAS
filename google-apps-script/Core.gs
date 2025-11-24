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
