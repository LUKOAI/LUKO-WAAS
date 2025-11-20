/**
 * WAAS - WordPress Affiliate Automation System
 * Installation Script
 *
 * INSTRUKCJA INSTALACJI:
 * 1. Skopiuj całą zawartość tego pliku
 * 2. Wejdź na https://script.google.com
 * 3. Kliknij "Nowy projekt"
 * 4. Wklej ten kod i zapisz
 * 5. Uruchom funkcję: installWAAS()
 * 6. Autoryzuj skrypt (zgody Google)
 * 7. Po instalacji ustaw klucze API w Script Properties:
 *    - DIVI_API_USERNAME
 *    - DIVI_API_KEY
 *    - PA_API_ACCESS_KEY
 *    - PA_API_SECRET_KEY
 *    - PA_API_PARTNER_TAG
 *    - HOSTINGER_API_KEY (opcjonalnie)
 *
 * @version 1.0.0
 */

// =============================================================================
// GŁÓWNA FUNKCJA INSTALACYJNA
// =============================================================================

function installWAAS() {
  try {
    Logger.log('🚀 Starting WAAS installation...');

    // 1. Tworzenie arkusza Google Sheets
    Logger.log('📊 Creating Google Sheets structure...');
    const spreadsheet = createSpreadsheetsStructure();

    // 2. Instalacja wszystkich skryptów
    Logger.log('📝 Installing script files...');
    installAllScripts();

    // 3. Konfiguracja menu i triggerów
    Logger.log('⚙️ Setting up menus and triggers...');
    setupMenusAndTriggers();

    // 4. Inicjalizacja ustawień
    Logger.log('🔧 Initializing settings...');
    initializeSettings();

    Logger.log('✅ Installation completed successfully!');
    Logger.log('📋 Spreadsheet URL: ' + spreadsheet.getUrl());
    Logger.log('⚠️ IMPORTANT: Now set your API keys in Script Properties!');

    // Pokazuje URL arkusza
    SpreadsheetApp.getUi().alert(
      'Installation Complete!\n\n' +
      'Spreadsheet URL:\n' + spreadsheet.getUrl() + '\n\n' +
      'NEXT STEPS:\n' +
      '1. Open Project Settings (⚙️)\n' +
      '2. Add Script Properties:\n' +
      '   - DIVI_API_USERNAME\n' +
      '   - DIVI_API_KEY\n' +
      '   - PA_API_ACCESS_KEY\n' +
      '   - PA_API_SECRET_KEY\n' +
      '   - PA_API_PARTNER_TAG\n' +
      '3. Reload the spreadsheet\n' +
      '4. Use WAAS menu to start!'
    );

    return spreadsheet;
  } catch (error) {
    Logger.log('❌ Installation error: ' + error.message);
    throw error;
  }
}

// =============================================================================
// TWORZENIE STRUKTURY ARKUSZA
// =============================================================================

function createSpreadsheetsStructure() {
  // Tworzenie nowego arkusza
  const spreadsheet = SpreadsheetApp.create('WAAS - WordPress Affiliate Automation System');
  const spreadsheetId = spreadsheet.getId();

  // Usunięcie domyślnego arkusza
  const defaultSheet = spreadsheet.getSheets()[0];

  // Tworzenie arkuszy
  createSitesSheet(spreadsheet);
  createProductsSheet(spreadsheet);
  createTasksSheet(spreadsheet);
  createContentQueueSheet(spreadsheet);
  createLogsSheet(spreadsheet);
  createSettingsSheet(spreadsheet);

  // Usunięcie domyślnego arkusza
  spreadsheet.deleteSheet(defaultSheet);

  // Ustawienie aktywnego arkusza na Sites
  spreadsheet.getSheetByName('Sites').activate();

  return spreadsheet;
}

function createSitesSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('Sites');

  // Nagłówki kolumn
  const headers = [
    'ID',
    'Site Name',
    'Domain',
    'WordPress URL',
    'Admin Username',
    'Admin Password',
    'Status',
    'Divi Installed',
    'Plugin Installed',
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
  sheet.setColumnWidth(7, 100);  // Status
  sheet.setColumnWidth(8, 120);  // Divi Installed
  sheet.setColumnWidth(9, 120);  // Plugin Installed
  sheet.setColumnWidth(10, 150); // Last Check
  sheet.setColumnWidth(11, 120); // Created Date
  sheet.setColumnWidth(12, 300); // Notes

  // Zamrożenie pierwszego wiersza
  sheet.setFrozenRows(1);

  // Przykładowy wiersz
  sheet.getRange(2, 1, 1, headers.length).setValues([[
    1,
    'Example Site',
    'example.com',
    'https://example.com',
    'admin',
    '',
    'Active',
    'No',
    'No',
    new Date(),
    new Date(),
    'Example site - replace with real data'
  ]]);

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
  sheet.setColumnWidth(7, 150);  // Template
  sheet.setColumnWidth(8, 150);  // Scheduled Date
  sheet.setColumnWidth(9, 150);  // Published Date
  sheet.setColumnWidth(10, 100); // Post ID
  sheet.setColumnWidth(11, 300); // Post URL
  sheet.setColumnWidth(12, 120); // Created Date
  sheet.setColumnWidth(13, 300); // Notes

  sheet.setFrozenRows(1);

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
    ['divi_default_template', '', 'Default Divi layout template ID', new Date()]
  ];

  sheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);

  return sheet;
}

// =============================================================================
// INSTALACJA SKRYPTÓW
// =============================================================================

function installAllScripts() {
  Logger.log('Installing Core.gs...');
  installCoreScript();

  Logger.log('Installing SiteManager.gs...');
  installSiteManagerScript();

  Logger.log('Installing ProductManager.gs...');
  installProductManagerScript();

  Logger.log('Installing ContentGenerator.gs...');
  installContentGeneratorScript();

  Logger.log('Installing TaskManager.gs...');
  installTaskManagerScript();

  Logger.log('Installing DiviAPI.gs...');
  installDiviAPIScript();

  Logger.log('Installing WordPressAPI.gs...');
  installWordPressAPIScript();

  Logger.log('Installing AmazonPA.gs...');
  installAmazonPAScript();

  Logger.log('Installing Utils.gs...');
  installUtilsScript();

  Logger.log('Installing Menu.gs...');
  installMenuScript();
}

function installCoreScript() {
  // Ten plik zawiera główne funkcje konfiguracyjne
  // Będzie utworzony jako osobny plik w projekcie
}

function installSiteManagerScript() {
  // Zarządzanie stronami WordPress
}

function installProductManagerScript() {
  // Zarządzanie produktami afiliacyjnymi
}

function installContentGeneratorScript() {
  // Generowanie treści
}

function installTaskManagerScript() {
  // Zarządzanie zadaniami
}

function installDiviAPIScript() {
  // Integracja z Divi
}

function installWordPressAPIScript() {
  // Integracja z WordPress
}

function installAmazonPAScript() {
  // Integracja z Amazon Product Advertising API
}

function installUtilsScript() {
  // Funkcje pomocnicze
}

function installMenuScript() {
  // Menu i UI
}

// =============================================================================
// KONFIGURACJA MENU I TRIGGERÓW
// =============================================================================

function setupMenusAndTriggers() {
  // Menu zostanie dodane automatycznie przez onOpen()
  // Triggery można dodać ręcznie lub tutaj programatically
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ WAAS')
    .addSubMenu(ui.createMenu('🌐 Sites')
      .addItem('Add New Site', 'addNewSite')
      .addItem('Check Site Status', 'checkSiteStatus')
      .addItem('Install Divi on Site', 'installDiviOnSite')
      .addItem('Install Plugin on Site', 'installPluginOnSite'))
    .addSubMenu(ui.createMenu('📦 Products')
      .addItem('Import Products from Amazon', 'importProductsFromAmazon')
      .addItem('Update Product Data', 'updateProductData')
      .addItem('Sync All Products', 'syncAllProducts'))
    .addSubMenu(ui.createMenu('📝 Content')
      .addItem('Generate Content', 'generateContent')
      .addItem('Publish Scheduled Content', 'publishScheduledContent')
      .addItem('View Content Queue', 'viewContentQueue'))
    .addSubMenu(ui.createMenu('⚙️ Tasks')
      .addItem('View Active Tasks', 'viewActiveTasks')
      .addItem('Run Task Queue', 'runTaskQueue')
      .addItem('Clear Completed Tasks', 'clearCompletedTasks'))
    .addSubMenu(ui.createMenu('🔧 Settings')
      .addItem('Configure API Keys', 'showAPIKeyInstructions')
      .addItem('Test Connections', 'testAllConnections')
      .addItem('View Logs', 'viewLogs'))
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
}

// =============================================================================
// INICJALIZACJA USTAWIEŃ
// =============================================================================

function initializeSettings() {
  // Sprawdzenie czy klucze API są ustawione
  const scriptProperties = PropertiesService.getScriptProperties();

  const requiredKeys = [
    'DIVI_API_USERNAME',
    'DIVI_API_KEY',
    'PA_API_ACCESS_KEY',
    'PA_API_SECRET_KEY',
    'PA_API_PARTNER_TAG'
  ];

  const missingKeys = [];
  requiredKeys.forEach(key => {
    if (!scriptProperties.getProperty(key)) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length > 0) {
    Logger.log('⚠️ Missing API keys: ' + missingKeys.join(', '));
  } else {
    Logger.log('✅ All API keys are configured');
  }
}

// =============================================================================
// FUNKCJE POMOCNICZE MENU
// =============================================================================

function showAPIKeyInstructions() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'API Keys Configuration',
    'To configure API keys:\n\n' +
    '1. Click on Extensions > Apps Script\n' +
    '2. Click on Project Settings (⚙️)\n' +
    '3. Scroll to "Script Properties"\n' +
    '4. Add the following properties:\n\n' +
    'DIVI_API_USERNAME - Your Divi username\n' +
    'DIVI_API_KEY - Your Divi API key\n' +
    'PA_API_ACCESS_KEY - Amazon PA API Access Key\n' +
    'PA_API_SECRET_KEY - Amazon PA API Secret Key\n' +
    'PA_API_PARTNER_TAG - Amazon Associate Tag\n' +
    'HOSTINGER_API_KEY - Hostinger API Key (optional)\n\n' +
    '5. Click "Save script properties"',
    ui.ButtonSet.OK
  );
}

function showDocumentation() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'WAAS Documentation',
    'Documentation and guides:\n\n' +
    '• GitHub: https://github.com/LUKOAI/LUKO-WAAS\n' +
    '• Product Manager: https://github.com/LUKOAI/-LukoAmazonAffiliateManager\n' +
    '• Divi Documentation: https://www.elegantthemes.com/documentation/divi/\n' +
    '• Amazon PA API: https://webservices.amazon.com/paapi5/documentation/\n\n' +
    'For support, check the GitHub repository.',
    ui.ButtonSet.OK
  );
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'About WAAS',
    'WordPress Affiliate Automation System v1.0.0\n\n' +
    '© 2024 LUKOAI\n' +
    'https://github.com/LUKOAI/LUKO-WAAS\n\n' +
    'Automated WordPress site management with:\n' +
    '• Divi theme integration\n' +
    '• Amazon affiliate products\n' +
    '• Automated content generation\n' +
    '• Multi-site management\n\n' +
    'Developed with ❤️ for affiliate marketers',
    ui.ButtonSet.OK
  );
}

function testAllConnections() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Testing connections - this feature will be implemented in the full version.');
}

// Placeholder functions for menu items
function addNewSite() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function checkSiteStatus() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function installDiviOnSite() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function installPluginOnSite() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function importProductsFromAmazon() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function updateProductData() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function syncAllProducts() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function generateContent() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function publishScheduledContent() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function viewContentQueue() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function viewActiveTasks() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function runTaskQueue() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function clearCompletedTasks() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
function viewLogs() { SpreadsheetApp.getUi().alert('This feature will be implemented in the full version.'); }
