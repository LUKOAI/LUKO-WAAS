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
    'DIVI_DOWNLOAD_URL'   // Required for automated Divi installation
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
