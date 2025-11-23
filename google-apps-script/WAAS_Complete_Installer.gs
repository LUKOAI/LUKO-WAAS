/**
 * WAAS - WordPress Affiliate Automation System
 * COMPLETE SINGLE-FILE INSTALLER
 *
 * =====================================================================
 * INSTRUKCJA INSTALACJI:
 * =====================================================================
 * 1. Otwórz PUSTY Google Sheets (lub ten w którym chcesz zainstalować WAAS)
 * 2. Kliknij: Extensions → Apps Script
 * 3. Usuń cały domyślny kod
 * 4. Wklej CAŁY ten plik
 * 5. Zapisz (Ctrl+S)
 * 6. Uruchom funkcję: installWAAS()
 * 7. Autoryzuj aplikację (zgody Google)
 * 8. Po instalacji ustaw GLOBALNE klucze API w Script Properties:
 *    Extensions → Apps Script → Project Settings → Script Properties
 *    - DIVI_API_USERNAME = netanaliza (same for all sites)
 *    - PA_API_ACCESS_KEY = [Twój klucz Amazon] (global)
 *    - PA_API_SECRET_KEY = [Twój secret Amazon] (global)
 *    - HOSTINGER_API_KEY = [Opcjonalnie]
 *
 *    ⚠️ WAŻNE: Per-site credentials (Divi API Key, Amazon Associate Tag)
 *    muszą być ustawione osobno dla każdej strony w zakładce Sites!
 *
 * 9. Przeładuj arkusz (F5)
 * 10. Użyj menu "⚡ WAAS" aby zacząć!
 *
 * @version 1.1.0
 * =====================================================================
 */

// =============================================================================
// GŁÓWNA FUNKCJA INSTALACYJNA
// =============================================================================

function installWAAS() {
  try {
    const ui = SpreadsheetApp.getUi();
    Logger.log('🚀 Starting WAAS installation...');

    // WAŻNE: Używamy BIEŻĄCEGO arkusza, nie tworzymy nowego!
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet.rename('WAAS - WordPress Affiliate Automation System');

    // 1. Tworzenie struktury arkuszy
    Logger.log('📊 Creating Google Sheets structure...');
    createSheetsStructure(spreadsheet);

    // 2. Konfiguracja menu i triggerów
    Logger.log('⚙️ Setting up menus and triggers...');
    setupMenusAndTriggers();

    // 3. Inicjalizacja ustawień
    Logger.log('🔧 Initializing settings...');
    initializeSettings();

    Logger.log('✅ Installation completed successfully!');
    Logger.log('📋 Spreadsheet URL: ' + spreadsheet.getUrl());
    Logger.log('⚠️ IMPORTANT: Now set your API keys in Script Properties!');

    ui.alert(
      '✅ Installation Complete!',
      'WAAS has been installed in this spreadsheet!\n\n' +
      'NEXT STEPS:\n' +
      '1. Click: Extensions → Apps Script\n' +
      '2. Click: Project Settings (⚙️ icon)\n' +
      '3. Scroll to "Script Properties"\n' +
      '4. Click "Add script property"\n' +
      '5. Add these GLOBAL properties:\n\n' +
      '   DIVI_API_USERNAME = netanaliza\n' +
      '   PA_API_ACCESS_KEY = [Your Amazon Key]\n' +
      '   PA_API_SECRET_KEY = [Your Amazon Secret]\n\n' +
      '6. Click "Save script properties"\n' +
      '7. Reload this spreadsheet (F5)\n' +
      '8. Go to "Sites" sheet and add your sites\n' +
      '   ⚠️ IMPORTANT: Each site needs its own:\n' +
      '   - Divi API Key (get from Elegant Themes)\n' +
      '   - Amazon Associate Tag\n\n' +
      '9. Use "⚡ WAAS" menu to start!',
      ui.ButtonSet.OK
    );

    return spreadsheet;
  } catch (error) {
    Logger.log('❌ Installation error: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

// =============================================================================
// TWORZENIE STRUKTURY ARKUSZY
// =============================================================================

function createSheetsStructure(spreadsheet) {
  // Usuń domyślny arkusz jeśli istnieje tylko jeden pusty
  const sheets = spreadsheet.getSheets();
  const defaultSheet = sheets[0];

  // Tworzenie arkuszy WAAS
  createSitesSheet(spreadsheet);
  createProductsSheet(spreadsheet);
  createTasksSheet(spreadsheet);
  createContentQueueSheet(spreadsheet);
  createLogsSheet(spreadsheet);
  createSettingsSheet(spreadsheet);

  // Usuń domyślny arkusz jeśli był pusty
  if (sheets.length === 1 && defaultSheet.getName().includes('Sheet')) {
    try {
      spreadsheet.deleteSheet(defaultSheet);
    } catch (e) {
      // Jeśli nie można usunąć, to OK
    }
  }

  // Ustawienie aktywnego arkusza na Sites
  spreadsheet.getSheetByName('Sites').activate();
}

function createSitesSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Sites');
  if (sheet) {
    Logger.log('Sheet "Sites" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Sites');

  // POPRAWIONA STRUKTURA - per-site Divi API Keys!
  const headers = [
    'ID',                    // A
    'Site Name',             // B
    'Domain',                // C
    'WordPress URL',         // D
    'Admin Username',        // E
    'Admin Password',        // F
    'WP API Key',            // G - NOWA KOLUMNA!
    'Divi API Key',          // H - NOWA KOLUMNA! (UNIKALNY dla każdej strony)
    'Amazon Associate Tag',  // I - NOWA KOLUMNA!
    'Status',                // J
    'Divi Installed',        // K
    'Plugin Installed',      // L
    'Last Check'             // M
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');

  // Szerokości kolumn
  sheet.setColumnWidths(1, 1, 50);    // ID
  sheet.setColumnWidths(2, 1, 200);   // Site Name
  sheet.setColumnWidths(3, 1, 250);   // Domain
  sheet.setColumnWidths(4, 1, 300);   // WordPress URL
  sheet.setColumnWidths(5, 1, 150);   // Admin Username
  sheet.setColumnWidths(6, 1, 150);   // Admin Password
  sheet.setColumnWidths(7, 1, 250);   // WP API Key
  sheet.setColumnWidths(8, 1, 350);   // Divi API Key (40 chars hex)
  sheet.setColumnWidths(9, 1, 200);   // Amazon Associate Tag
  sheet.setColumnWidths(10, 1, 100);  // Status
  sheet.setColumnWidths(11, 1, 100);  // Divi Installed
  sheet.setColumnWidths(12, 1, 120);  // Plugin Installed
  sheet.setColumnWidths(13, 1, 180);  // Last Check

  sheet.setFrozenRows(1);

  // Walidacja dla kolumny Status (J)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'deploying', 'active', 'maintenance', 'error'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('J2:J1000').setDataValidation(statusRule);

  // Walidacja dla kolumn boolean (K, L)
  const booleanRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('K2:L1000').setDataValidation(booleanRule);

  Logger.log('✅ Sites sheet created with per-site Divi API Key structure');

  return sheet;
}

function createProductsSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Products');
  if (sheet) {
    Logger.log('Sheet "Products" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Products');

  const headers = [
    'ID', 'ASIN', 'Product Name', 'Category', 'Price', 'Image URL',
    'Affiliate Link', 'Rating', 'Reviews Count', 'Status',
    'Last Updated', 'Added Date', 'Notes'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidths(1, 1, 80);    // ID
  sheet.setColumnWidths(2, 1, 120);   // ASIN
  sheet.setColumnWidths(3, 1, 300);   // Product Name
  sheet.setColumnWidths(4, 1, 150);   // Category
  sheet.setColumnWidths(5, 1, 100);   // Price
  sheet.setColumnWidths(6, 1, 250);   // Image URL
  sheet.setColumnWidths(7, 1, 300);   // Affiliate Link
  sheet.setColumnWidths(8, 1, 80);    // Rating
  sheet.setColumnWidths(9, 1, 100);   // Reviews Count
  sheet.setColumnWidths(10, 1, 100);  // Status
  sheet.setColumnWidths(11, 1, 150);  // Last Updated
  sheet.setColumnWidths(12, 1, 120);  // Added Date
  sheet.setColumnWidths(13, 1, 300);  // Notes

  sheet.setFrozenRows(1);

  return sheet;
}

function createTasksSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Tasks');
  if (sheet) {
    Logger.log('Sheet "Tasks" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Tasks');

  const headers = [
    'ID', 'Task Type', 'Site ID', 'Product IDs', 'Status', 'Priority',
    'Scheduled Date', 'Started Date', 'Completed Date', 'Result',
    'Error Message', 'Created Date', 'Notes'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#fbbc04');
  headerRange.setFontColor('#000000');

  sheet.setFrozenRows(1);

  return sheet;
}

function createContentQueueSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Content Queue');
  if (sheet) {
    Logger.log('Sheet "Content Queue" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Content Queue');

  const headers = [
    'ID', 'Site ID', 'Content Type', 'Title', 'Status', 'Product IDs',
    'Template', 'Scheduled Date', 'Published Date', 'Post ID',
    'Post URL', 'Created Date', 'Content HTML'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#ea4335');
  headerRange.setFontColor('#ffffff');

  sheet.setFrozenRows(1);

  return sheet;
}

function createLogsSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Logs');
  if (sheet) {
    Logger.log('Sheet "Logs" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Logs');

  const headers = [
    'Timestamp', 'Level', 'Category', 'Message',
    'Site ID', 'Task ID', 'User', 'Details'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#9e9e9e');
  headerRange.setFontColor('#ffffff');

  sheet.setFrozenRows(1);

  return sheet;
}

function createSettingsSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Settings');
  if (sheet) {
    Logger.log('Sheet "Settings" already exists, skipping...');
    return sheet;
  }

  sheet = spreadsheet.insertSheet('Settings');

  const headers = ['Setting Key', 'Setting Value', 'Description'];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#673ab7');
  headerRange.setFontColor('#ffffff');

  sheet.setColumnWidths(1, 1, 250);   // Setting Key
  sheet.setColumnWidths(2, 1, 300);   // Setting Value
  sheet.setColumnWidths(3, 1, 500);   // Description

  sheet.setFrozenRows(1);

  // POPRAWIONE: TYLKO GLOBALNE PARAMETRY SYSTEMOWE!
  // Per-site ustawienia (Divi API Key, Amazon Tag) są w zakładce Sites!
  const defaultSettings = [
    ['divi_api_username', 'netanaliza', 'Elegant Themes username (same for all sites)'],
    ['hostinger_ssh_host', 'ssh.lk24.shop', 'Hostinger SSH host'],
    ['hostinger_ssh_port', '65002', 'Hostinger SSH port'],
    ['hostinger_ssh_username', '', 'Hostinger SSH username (FILL IN!)'],
    ['system_notification_email', 'netanalizaltd@gmail.com', 'System-wide notification email'],
    ['max_concurrent_deployments', '3', 'Max simultaneous site deployments'],
    ['health_check_interval_hours', '24', 'Hours between automatic health checks'],
    ['deployment_script_version', '1.0.0', 'Current deployment script version'],
    ['', '', '⚠️ IMPORTANT: Amazon PA-API credentials should be in Script Properties!'],
    ['', '', '⚠️ Go to: Project Settings → Script Properties → Add:'],
    ['', '', '   PA_API_ACCESS_KEY, PA_API_SECRET_KEY'],
    ['', '', '⚠️ Per-site settings (Divi API Key, Amazon Associate Tag) are in Sites sheet!']
  ];

  sheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);

  Logger.log('✅ Settings sheet created with global parameters only');

  return sheet;
}

// =============================================================================
// KONFIGURACJA MENU I TRIGGERÓW
// =============================================================================

function setupMenusAndTriggers() {
  // Menu zostanie dodane automatycznie przy następnym otwarciu przez onOpen()
  onOpen();
}

function initializeSettings() {
  Logger.log('🔧 Initializing global settings...');

  const scriptProperties = PropertiesService.getScriptProperties();

  // POPRAWIONE: DIVI_API_KEY został usunięty - jest per-site w arkuszu Sites!
  // POPRAWIONE: PA_API_PARTNER_TAG został usunięty - jest per-site jako Amazon Associate Tag!
  const requiredKeys = [
    'DIVI_API_USERNAME',      // Global - to samo dla wszystkich stron
    'PA_API_ACCESS_KEY',      // Global - Amazon PA-API Access Key
    'PA_API_SECRET_KEY'       // Global - Amazon PA-API Secret Key
  ];

  const missingKeys = [];
  requiredKeys.forEach(key => {
    if (!scriptProperties.getProperty(key)) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length > 0) {
    Logger.log('⚠️ WARNING: Missing global API keys in Script Properties:');
    Logger.log('   ' + missingKeys.join(', '));
    Logger.log('📝 Go to: Project Settings → Script Properties → Add:');
    missingKeys.forEach(key => {
      Logger.log(`   - ${key}`);
    });
  } else {
    Logger.log('✅ All global API keys are configured');
  }

  // Sprawdź czy Divi username jest ustawiony
  const diviUsername = scriptProperties.getProperty('DIVI_API_USERNAME');
  if (diviUsername) {
    Logger.log(`✅ Divi API Username: ${diviUsername}`);
  }

  Logger.log('⚠️ IMPORTANT: Per-site settings (Divi API Key, Amazon Associate Tag) must be set in Sites sheet!');
  Logger.log('✅ Global settings initialized');
}

// =============================================================================
// FUNKCJE ZARZĄDZANIA STRONAMI (SITE MANAGEMENT)
// =============================================================================

/**
 * Walidacja Divi API Key
 * Musi być dokładnie 40 znaków HEX (0-9, a-f)
 *
 * @param {string} apiKey - Klucz do walidacji
 * @returns {boolean} - true jeśli poprawny
 */
function validateDiviApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Divi API Key = dokładnie 40 znaków hex (lowercase lub uppercase)
  const hexPattern = /^[a-f0-9]{40}$/i;
  return hexPattern.test(apiKey);
}

/**
 * Dodaje nową stronę do systemu WAAS
 *
 * @param {Object} siteData - Dane nowej strony
 * @param {string} siteData.siteName - Nazwa strony
 * @param {string} siteData.domain - Domena (np. keyword.lk24.shop)
 * @param {string} siteData.wpAdminUsername - WordPress admin username
 * @param {string} siteData.wpAdminPassword - WordPress admin password
 * @param {string} siteData.diviApiKey - UNIKALNY Divi API Key dla tej strony
 * @param {string} siteData.amazonAssociateTag - Amazon Associate Tag (opcjonalnie)
 * @returns {number} - ID nowo dodanej strony
 */
function addNewSite(siteData) {
  Logger.log(`📝 Adding new site: ${siteData.siteName}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');

  if (!sitesSheet) {
    throw new Error('Sites sheet not found!');
  }

  // Walidacja wymaganych pól
  const required = ['siteName', 'domain', 'wpAdminUsername', 'wpAdminPassword', 'diviApiKey'];
  for (const field of required) {
    if (!siteData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Walidacja Divi API Key (musi być 40 znaków hex)
  if (!validateDiviApiKey(siteData.diviApiKey)) {
    throw new Error('Invalid Divi API Key format (must be 40 hex characters). Example: c12d038b32b1f2356c705ede89bf188b0abf6a51');
  }

  // Wygeneruj nowe Site ID
  const lastRow = sitesSheet.getLastRow();
  const newSiteId = lastRow > 1 ? sitesSheet.getRange(lastRow, 1).getValue() + 1 : 1;

  // Wygeneruj WP API Key (unikalny dla tej strony)
  const domainPrefix = siteData.domain.split('.')[0];
  const wpApiKey = `waas-api-${domainPrefix}-${Date.now()}`;

  // Konstruuj WordPress URL
  const wpUrl = `https://${siteData.domain}`;

  // Dodaj nowy wiersz (zgodnie z nową strukturą kolumn)
  const newRow = [
    newSiteId,                                    // A: ID
    siteData.siteName,                            // B: Site Name
    siteData.domain,                              // C: Domain
    wpUrl,                                        // D: WordPress URL
    siteData.wpAdminUsername,                     // E: Admin Username
    siteData.wpAdminPassword,                     // F: Admin Password
    wpApiKey,                                     // G: WP API Key
    siteData.diviApiKey,                          // H: Divi API Key ← UNIKALNY!
    siteData.amazonAssociateTag || '',            // I: Amazon Associate Tag
    'pending',                                    // J: Status
    'FALSE',                                      // K: Divi Installed
    'FALSE',                                      // L: Plugin Installed
    ''                                            // M: Last Check
  ];

  sitesSheet.appendRow(newRow);

  Logger.log(`✅ Site added: ID=${newSiteId}, Name=${siteData.siteName}, Divi Key=${siteData.diviApiKey.substring(0, 8)}...`);

  // Log do Logs sheet
  logEvent('INFO', 'SITE_MANAGEMENT', `New site added: ${siteData.siteName}`, {
    siteId: newSiteId,
    domain: siteData.domain
  }, newSiteId);

  return newSiteId;
}

/**
 * Pobiera dane strony po Site ID
 *
 * @param {number} siteId - ID strony
 * @returns {Object|null} - Obiekt z danymi strony lub null
 */
function getSiteById(siteId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');

  if (!sitesSheet) {
    throw new Error('Sites sheet not found!');
  }

  const data = sitesSheet.getDataRange().getValues();

  // Szukaj wiersza z tym Site ID (kolumna A)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === siteId) {
      return {
        id: data[i][0],                    // A
        siteName: data[i][1],              // B
        domain: data[i][2],                // C
        wpUrl: data[i][3],                 // D
        wpAdminUsername: data[i][4],       // E
        wpAdminPassword: data[i][5],       // F
        wpApiKey: data[i][6],              // G
        diviApiKey: data[i][7],            // H ← UNIKALNY DLA TEJ STRONY
        amazonAssociateTag: data[i][8],    // I
        status: data[i][9],                // J
        diviInstalled: data[i][10],        // K
        pluginInstalled: data[i][11],      // L
        lastCheck: data[i][12],            // M
        rowIndex: i + 1
      };
    }
  }

  return null;
}

/**
 * Aktualizuje status strony
 *
 * @param {number} siteId - ID strony
 * @param {string} newStatus - Nowy status (pending/deploying/active/maintenance/error)
 */
function updateSiteStatus(siteId, newStatus) {
  const site = getSiteById(siteId);

  if (!site) {
    throw new Error(`Site not found: ID=${siteId}`);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');

  // Kolumna J (Status) = newStatus
  sitesSheet.getRange(site.rowIndex, 10).setValue(newStatus);

  // Kolumna M (Last Check) = teraz
  sitesSheet.getRange(site.rowIndex, 13).setValue(new Date());

  Logger.log(`✅ Site status updated: ID=${siteId}, Status=${newStatus}`);

  logEvent('INFO', 'SITE_MANAGEMENT', `Site status changed to ${newStatus}`, {
    siteId: siteId,
    oldStatus: site.status,
    newStatus: newStatus
  }, siteId);
}

/**
 * Aktualizuje status instalacji Divi dla strony
 *
 * @param {number} siteId - ID strony
 * @param {boolean} installed - true = zainstalowany, false = nie
 */
function updateSiteDiviStatus(siteId, installed) {
  const site = getSiteById(siteId);

  if (!site) {
    throw new Error(`Site not found: ID=${siteId}`);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');

  // Kolumna K (Divi Installed) = TRUE/FALSE
  sitesSheet.getRange(site.rowIndex, 11).setValue(installed ? 'TRUE' : 'FALSE');

  // Kolumna M (Last Check) = teraz
  sitesSheet.getRange(site.rowIndex, 13).setValue(new Date());

  Logger.log(`✅ Divi status updated: ID=${siteId}, Installed=${installed}`);

  logEvent('INFO', 'DEPLOYMENT', `Divi installation ${installed ? 'completed' : 'failed'}`, {
    siteId: siteId
  }, siteId);
}

/**
 * Loguje zdarzenie do zakładki Logs
 *
 * @param {string} level - INFO, WARNING, ERROR
 * @param {string} category - Kategoria (DEPLOYMENT, API, SITE_MANAGEMENT, etc.)
 * @param {string} message - Wiadomość
 * @param {Object} details - Dodatkowe szczegóły (będą przekonwertowane na JSON)
 * @param {number|null} siteId - Opcjonalnie ID strony (null = global log)
 */
function logEvent(level, category, message, details = {}, siteId = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName('Logs');

  if (!logsSheet) {
    Logger.log('⚠️ Logs sheet not found!');
    return;
  }

  const timestamp = new Date();
  const detailsJson = JSON.stringify(details);

  // Struktura Logs: Timestamp, Site ID, Level, Category, Message, Task ID, User, Details
  const logRow = [
    timestamp,           // A: Timestamp
    level,               // B: Level
    category,            // C: Category
    message,             // D: Message
    siteId || '',        // E: Site ID (puste dla global logs)
    '',                  // F: Task ID (opcjonalnie)
    '',                  // G: User (opcjonalnie)
    detailsJson          // H: Details (JSON)
  ];

  logsSheet.appendRow(logRow);

  Logger.log(`📝 Log: [${level}] [${category}] ${message}`);
}

// =============================================================================
// =============================================================================
// PONIŻEJ: WSZYSTKIE MODUŁY WAAS
// =============================================================================
// =============================================================================

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

function getDiviCredentials() {
  return {
    username: getAPIKey('DIVI_API_USERNAME'),
    apiKey: getAPIKey('DIVI_API_KEY')
  };
}

function getAmazonPACredentials() {
  return {
    accessKey: getAPIKey('PA_API_ACCESS_KEY'),
    secretKey: getAPIKey('PA_API_SECRET_KEY'),
    partnerTag: getAPIKey('PA_API_PARTNER_TAG')
  };
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
    logError('HTTP', `Request failed: ${error.message}`, '', '', { url, error: error.toString() });
    return {
      success: false,
      error: error.message
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
    .addSubMenu(ui.createMenu('🔧 Settings')
      .addItem('🔑 Configure API Keys', 'showAPIKeyInstructions')
      .addItem('⚙️ System Settings', 'showSettingsDialog')
      .addItem('🧪 Test Connections', 'testAllConnections')
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
        username: data[i][4],
        password: data[i][5],
        status: data[i][6],
        diviInstalled: data[i][7],
        pluginInstalled: data[i][8],
        lastCheck: data[i][9],
        createdDate: data[i][10],
        notes: data[i][11],
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

  // Aktualizuj status
  sheet.getRange(row, 7).setValue(status);

  // Aktualizuj last check
  sheet.getRange(row, 10).setValue(new Date());

  // Aktualizuj dodatkowe pola
  if (updates.diviInstalled !== undefined) {
    sheet.getRange(row, 8).setValue(updates.diviInstalled);
  }
  if (updates.pluginInstalled !== undefined) {
    sheet.getRange(row, 9).setValue(updates.pluginInstalled);
  }
  if (updates.notes !== undefined) {
    sheet.getRange(row, 12).setValue(updates.notes);
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
    const response = makeHttpRequest(site.wpUrl + '/wp-json/');

    if (response.success) {
      return { available: true };
    } else {
      return {
        available: false,
        error: `HTTP ${response.statusCode}: ${response.error}`
      };
    }
  } catch (error) {
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password)
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password)
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

    // 1. Pobierz Divi przez API Elegant Themes
    const diviPackage = downloadDiviPackage();
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

    // 4. Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      diviInstalled: 'Yes',
      notes: 'Divi installed and activated successfully'
    });

    logSuccess('SiteManager', `Divi installed successfully on: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Success',
      `Divi has been installed and activated on ${site.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.installDiviOnSite', siteId);
    return false;
  }
}

function downloadDiviPackage() {
  try {
    const creds = getDiviCredentials();
    logInfo('DiviAPI', 'Downloading Divi package');

    // Pobierz link do pobrania Divi
    const downloadUrl = getDiviDownloadUrl(creds);
    if (!downloadUrl) {
      return null;
    }

    // Pobierz plik
    const response = UrlFetchApp.fetch(downloadUrl);
    const blob = response.getBlob();

    logSuccess('DiviAPI', 'Divi package downloaded');
    return blob;
  } catch (error) {
    logError('DiviAPI', `Failed to download Divi: ${error.message}`);
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
    const repoUrl = 'https://github.com/LUKOAI/-LukoAmazonAffiliateManager';
    const downloadUrl = `${repoUrl}/archive/refs/heads/main.zip`;

    logInfo('PluginManager', 'Downloading plugin from GitHub');

    const response = UrlFetchApp.fetch(downloadUrl);
    const blob = response.getBlob();

    logSuccess('PluginManager', 'Plugin package downloaded');
    return blob;
  } catch (error) {
    logError('PluginManager', `Failed to download plugin: ${error.message}`);
    return null;
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
    if (data[i][6] === 'Active') {
      sites.push({
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        username: data[i][4],
        password: data[i][5]
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
    const apiUrl = 'https://www.elegantthemes.com/api/downloads/';

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        username: credentials.username,
        api_key: credentials.apiKey,
        product: 'Divi'
      })
    });

    if (response.success && response.data && response.data.download_url) {
      return response.data.download_url;
    }

    throw new Error('Failed to get Divi download URL');
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
        'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password),
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
        'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password),
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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    // WordPress nie ma bezpośredniego REST API dla instalacji motywów
    // Należy użyć WP-CLI lub innego rozwiązania
    // Placeholder implementation

    logWarning('WordPressAPI', 'Theme installation requires WP-CLI or SSH access', site.id);

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error installing theme: ${error.message}`, site.id);
    return false;
  }
}

function activateThemeOnWordPress(site, themeSlug) {
  try {
    logInfo('WordPressAPI', `Activating theme: ${themeSlug}`, site.id);

    // Wymaga dodatkowego endpointu lub WP-CLI
    // Placeholder implementation

    logWarning('WordPressAPI', 'Theme activation requires custom endpoint or WP-CLI', site.id);

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error activating theme: ${error.message}`, site.id);
    return false;
  }
}

function getActiveTheme(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/themes?status=active`;

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    // WordPress REST API nie obsługuje bezpośrednio instalacji pluginów
    // Wymaga rozszerzenia lub WP-CLI
    // Placeholder implementation

    logWarning('WordPressAPI', 'Plugin installation requires custom solution', site.id);

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error installing plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginOnWordPress(site, pluginSlug) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/plugins/${pluginSlug}`;

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        status: 'active'
      })
    });

    if (response.success) {
      logSuccess('WordPressAPI', `Plugin activated: ${pluginSlug}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error activating plugin: ${error.message}`, site.id);
    return false;
  }
}

function getInstalledPlugins(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    const authHeader = 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password);

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

    // Przygotuj nagłówki
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Date': timestamp,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      'Host': AMAZON_PA_CONFIG.endpoint
    };

    // Utwórz podpis AWS4
    const signature = createAWS4Signature(
      credentials.accessKey,
      credentials.secretKey,
      AMAZON_PA_CONFIG.region,
      AMAZON_PA_CONFIG.service,
      path,
      payload,
      timestamp
    );

    headers['Authorization'] = signature;

    // Wykonaj request
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: JSON.stringify(payload),
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

function createAWS4Signature(accessKey, secretKey, region, service, path, payload, timestamp) {
  // Simplified AWS4 signature
  // W pełnej implementacji należy użyć kompletnego algorytmu AWS Signature Version 4

  const dateStamp = timestamp.substring(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=content-type;host;x-amz-date, Signature=dummy_signature`;

  logWarning('AmazonPA', 'Using simplified AWS4 signature - implement full version for production');

  return authHeader;
}

// Note: Pełna implementacja AWS4 Signature wymaga:
// 1. Canonical Request
// 2. String to Sign
// 3. Signing Key
// 4. Signature
// Zobacz: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

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
