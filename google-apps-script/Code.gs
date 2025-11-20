/**
 * WAAS - WordPress Affiliate Automation System
 * Google Apps Script dla zarządzania produktami Amazon
 *
 * Konkretne nazwy arkuszy:
 * - AmazonAffiliateProductsDashboard (główny arkusz)
 *
 * Karty w arkuszu:
 * - ProductsToImport - lista produktów do zaimportowania
 * - ProductsDatabase - baza wszystkich produktów
 * - Settings - ustawienia i konfiguracja
 * - Logs - logi synchronizacji
 * - Analytics - statystyki i analityka
 *
 * @version 1.0.0
 */

// ============================================
// KONFIGURACJA - UZUPEŁNIJ SWOJE DANE
// ============================================

const CONFIG = {
  // URL twojego WordPressa + endpoint REST API
  WORDPRESS_URL: 'https://twoja-domena.pl',
  WORDPRESS_REST_API: 'https://twoja-domena.pl/wp-json/waas/v1',

  // Klucz API do zabezpieczenia (opcjonalny, ustawiony w ustawieniach pluginu)
  API_KEY: 'twoj-tajny-klucz-api',

  // Nazwy arkuszy (karty w Google Sheets)
  SHEETS: {
    TO_IMPORT: 'ProductsToImport',
    DATABASE: 'ProductsDatabase',
    SETTINGS: 'Settings',
    LOGS: 'Logs',
    ANALYTICS: 'Analytics'
  },

  // Kolumny w arkuszu ProductsToImport
  IMPORT_COLUMNS: {
    ASIN: 0,
    STATUS: 1,
    LAST_SYNC: 2,
    IMPORT_DATE: 3,
    CATEGORY: 4,
    NOTES: 5
  },

  // Kolumny w arkuszu ProductsDatabase
  DB_COLUMNS: {
    ASIN: 0,
    PRODUCT_NAME: 1,
    BRAND: 2,
    PRICE: 3,
    SAVINGS: 4,
    PRIME_ELIGIBLE: 5,
    AVAILABILITY: 6,
    AFFILIATE_LINK: 7,
    IMAGE_URL: 8,
    CATEGORY: 9,
    LAST_UPDATED: 10,
    WP_POST_ID: 11,
    FEATURES: 12
  }
};

// ============================================
// MENU FUNKCJE - Niestandardowe menu
// ============================================

/**
 * Tworzy niestandardowe menu przy otwarciu arkusza
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🚀 WAAS Amazon Products')
    .addItem('📥 Import produktów do WordPress', 'importProductsToWordPress')
    .addItem('🔄 Synchronizuj wszystkie produkty', 'syncAllProducts')
    .addItem('📊 Pobierz dane z WordPress', 'fetchProductsFromWordPress')
    .addSeparator()
    .addItem('⚙️ Konfiguracja początkowa', 'initialSetup')
    .addItem('🧪 Test połączenia z WordPress', 'testWordPressConnection')
    .addSeparator()
    .addItem('📖 Pomoc i dokumentacja', 'showHelp')
    .addToUi();

  Logger.log('Menu WAAS załadowane pomyślnie');
}

// ============================================
// KONFIGURACJA POCZĄTKOWA
// ============================================

/**
 * Konfiguracja początkowa - tworzy wszystkie niezbędne arkusze i nagłówki
 */
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // Utwórz arkusze jeśli nie istnieją
    createSheetIfNotExists(CONFIG.SHEETS.TO_IMPORT, getImportSheetHeaders());
    createSheetIfNotExists(CONFIG.SHEETS.DATABASE, getDatabaseSheetHeaders());
    createSheetIfNotExists(CONFIG.SHEETS.SETTINGS, getSettingsSheetHeaders());
    createSheetIfNotExists(CONFIG.SHEETS.LOGS, getLogsSheetHeaders());
    createSheetIfNotExists(CONFIG.SHEETS.ANALYTICS, getAnalyticsSheetHeaders());

    // Wypełnij Settings przykładowymi danymi
    populateSettingsSheet();

    // Dodaj przykładowe dane do ProductsToImport
    addSampleDataToImport();

    ui.alert(
      '✅ Konfiguracja zakończona!',
      'Wszystkie arkusze zostały utworzone.\n\n' +
      'Następne kroki:\n' +
      '1. Przejdź do arkusza "Settings" i wypełnij swoje dane\n' +
      '2. W WordPress przejdź do WAAS Settings i skonfiguruj API\n' +
      '3. Użyj "Test połączenia z WordPress" aby sprawdzić konfigurację',
      ui.ButtonSet.OK
    );

    logAction('Konfiguracja początkowa', 'Wszystkie arkusze utworzone pomyślnie');

  } catch (error) {
    ui.alert('❌ Błąd', 'Wystąpił błąd podczas konfiguracji: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Błąd konfiguracji: ' + error);
  }
}

/**
 * Tworzy arkusz jeśli nie istnieje
 */
function createSheetIfNotExists(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    // Dodaj nagłówki
    if (headers && headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');

      // Zamroź pierwszy wiersz
      sheet.setFrozenRows(1);

      // Dostosuj szerokość kolumn
      for (let i = 1; i <= headers.length; i++) {
        sheet.autoResizeColumn(i);
      }
    }

    Logger.log('Utworzono arkusz: ' + sheetName);
  }

  return sheet;
}

/**
 * Nagłówki dla arkusza ProductsToImport
 */
function getImportSheetHeaders() {
  return [
    'ASIN',
    'Status',
    'Last Sync',
    'Import Date',
    'Category',
    'Notes'
  ];
}

/**
 * Nagłówki dla arkusza ProductsDatabase
 */
function getDatabaseSheetHeaders() {
  return [
    'ASIN',
    'Product Name',
    'Brand',
    'Price',
    'Savings %',
    'Prime Eligible',
    'Availability',
    'Affiliate Link',
    'Image URL',
    'Category',
    'Last Updated',
    'WP Post ID',
    'Features'
  ];
}

/**
 * Nagłówki dla arkusza Settings
 */
function getSettingsSheetHeaders() {
  return [
    'Setting Name',
    'Value',
    'Description'
  ];
}

/**
 * Nagłówki dla arkusza Logs
 */
function getLogsSheetHeaders() {
  return [
    'Timestamp',
    'Action',
    'Status',
    'Details',
    'ASIN'
  ];
}

/**
 * Nagłówki dla arkusza Analytics
 */
function getAnalyticsSheetHeaders() {
  return [
    'Metric',
    'Value',
    'Last Updated'
  ];
}

/**
 * Wypełnia arkusz Settings przykładowymi danymi
 */
function populateSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  const settings = [
    ['WordPress URL', 'https://twoja-domena.pl', 'Główny URL twojej strony WordPress'],
    ['WordPress API Endpoint', 'https://twoja-domena.pl/wp-json/waas/v1', 'Endpoint REST API pluginu WAAS'],
    ['API Key', 'twoj-tajny-klucz-api', 'Klucz API do zabezpieczenia (opcjonalny)'],
    ['Default Category', 'outdoor-gear', 'Domyślna kategoria dla nowych produktów'],
    ['Auto Sync Enabled', 'TRUE', 'Czy automatycznie synchronizować produkty'],
    ['Sync Interval Hours', '24', 'Co ile godzin synchronizować produkty']
  ];

  // Sprawdź czy settings już istnieją
  if (sheet.getLastRow() <= 1) {
    const range = sheet.getRange(2, 1, settings.length, 3);
    range.setValues(settings);

    // Formatowanie
    sheet.getRange('B:B').setFontWeight('bold');
  }
}

/**
 * Dodaje przykładowe dane do arkusza ProductsToImport
 */
function addSampleDataToImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.TO_IMPORT);

  // Sprawdź czy już są jakieś dane
  if (sheet.getLastRow() > 1) {
    return; // Dane już istnieją
  }

  const sampleData = [
    ['B08N5WRWNW', 'Pending', '', '', 'electronics', 'Apple AirPods Pro - przykład'],
    ['B07XJ8C8F5', 'Pending', '', '', 'electronics', 'Echo Dot - przykład'],
    ['B09G9FPHY6', 'Pending', '', '', 'electronics', 'Kindle - przykład']
  ];

  const range = sheet.getRange(2, 1, sampleData.length, 6);
  range.setValues(sampleData);

  // Dodaj kolorowanie dla statusu
  updateStatusColors(sheet);
}

// ============================================
// IMPORT PRODUKTÓW DO WORDPRESS
// ============================================

/**
 * Importuje produkty z arkusza ProductsToImport do WordPress
 */
function importProductsToWordPress() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const importSheet = ss.getSheetByName(CONFIG.SHEETS.TO_IMPORT);

  if (!importSheet) {
    ui.alert('❌ Błąd', 'Arkusz "ProductsToImport" nie istnieje!', ui.ButtonSet.OK);
    return;
  }

  // Sprawdź konfigurację
  const wpUrl = getSettingValue('WordPress API Endpoint');
  if (!wpUrl || wpUrl.includes('twoja-domena')) {
    ui.alert(
      '⚠️ Brak konfiguracji',
      'Najpierw skonfiguruj WordPress URL w arkuszu "Settings"!',
      ui.ButtonSet.OK
    );
    return;
  }

  // Pobierz wszystkie produkty ze statusem "Pending"
  const data = importSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  let imported = 0;
  let errors = 0;
  let skipped = 0;

  // Rozpocznij import
  ui.alert(
    '🚀 Rozpoczynam import',
    'Importuję produkty do WordPress...\nTo może potrwać kilka minut.',
    ui.ButtonSet.OK
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const asin = row[CONFIG.IMPORT_COLUMNS.ASIN];
    const status = row[CONFIG.IMPORT_COLUMNS.STATUS];
    const category = row[CONFIG.IMPORT_COLUMNS.CATEGORY];

    // Pomiń jeśli już zaimportowane lub puste
    if (!asin || status === 'Imported' || status === 'Error') {
      skipped++;
      continue;
    }

    try {
      // Wyślij do WordPress
      const result = sendProductToWordPress(asin, category);

      if (result.success) {
        // Aktualizuj status w arkuszu
        const rowNum = i + 2; // +2 bo nagłówek i indeksowanie od 1
        importSheet.getRange(rowNum, CONFIG.IMPORT_COLUMNS.STATUS + 1).setValue('Imported');
        importSheet.getRange(rowNum, CONFIG.IMPORT_COLUMNS.LAST_SYNC + 1).setValue(new Date());
        importSheet.getRange(rowNum, CONFIG.IMPORT_COLUMNS.IMPORT_DATE + 1).setValue(new Date());

        // Dodaj do bazy danych
        if (result.product) {
          addProductToDatabase(result.product);
        }

        imported++;
        logAction('Import produktu', 'Success', 'Zaimportowano: ' + asin);

      } else {
        importSheet.getRange(i + 2, CONFIG.IMPORT_COLUMNS.STATUS + 1).setValue('Error');
        errors++;
        logAction('Import produktu', 'Error', result.message || 'Nieznany błąd', asin);
      }

      // Opóźnienie aby nie przekroczyć limitów API
      Utilities.sleep(1000);

    } catch (error) {
      importSheet.getRange(i + 2, CONFIG.IMPORT_COLUMNS.STATUS + 1).setValue('Error');
      errors++;
      logAction('Import produktu', 'Error', error.message, asin);
      Logger.log('Błąd importu ' + asin + ': ' + error);
    }
  }

  // Aktualizuj kolorowanie
  updateStatusColors(importSheet);

  // Aktualizuj Analytics
  updateAnalytics();

  // Pokaż wynik
  ui.alert(
    '✅ Import zakończony',
    `Zaimportowano: ${imported}\nBłędów: ${errors}\nPominiętych: ${skipped}`,
    ui.ButtonSet.OK
  );

  logAction('Import produktów', 'Completed', `Imported: ${imported}, Errors: ${errors}, Skipped: ${skipped}`);
}

/**
 * Wysyła pojedynczy produkt do WordPress
 */
function sendProductToWordPress(asin, category) {
  const wpUrl = getSettingValue('WordPress API Endpoint');
  const apiKey = getSettingValue('API Key');

  const url = wpUrl + '/products/import';

  const payload = {
    products: [asin],
    category: category || ''
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'X-API-Key': apiKey
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 200 && responseBody.success) {
      return {
        success: true,
        product: responseBody.results ? responseBody.results[0] : null
      };
    } else {
      return {
        success: false,
        message: responseBody.message || 'Błąd importu'
      };
    }

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ============================================
// SYNCHRONIZACJA PRODUKTÓW
// ============================================

/**
 * Synchronizuje wszystkie produkty z WordPress
 */
function syncAllProducts() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

  if (!dbSheet) {
    ui.alert('❌ Błąd', 'Arkusz "ProductsDatabase" nie istnieje!', ui.ButtonSet.OK);
    return;
  }

  // Pobierz wszystkie ASINy z bazy danych
  const data = dbSheet.getDataRange().getValues();
  const rows = data.slice(1);

  let updated = 0;
  let errors = 0;

  ui.alert(
    '🔄 Rozpoczynam synchronizację',
    'Synchronizuję ' + rows.length + ' produktów...\nTo może potrwać kilka minut.',
    ui.ButtonSet.OK
  );

  for (let i = 0; i < rows.length; i++) {
    const asin = rows[i][CONFIG.DB_COLUMNS.ASIN];

    if (!asin) {
      continue;
    }

    try {
      const productData = fetchProductFromWordPress(asin);

      if (productData) {
        updateProductInDatabase(i + 2, productData); // +2 bo nagłówek i indeksowanie od 1
        updated++;
      } else {
        errors++;
      }

      Utilities.sleep(500);

    } catch (error) {
      errors++;
      Logger.log('Błąd synchronizacji ' + asin + ': ' + error);
    }
  }

  // Aktualizuj Analytics
  updateAnalytics();

  ui.alert(
    '✅ Synchronizacja zakończona',
    `Zaktualizowano: ${updated}\nBłędów: ${errors}`,
    ui.ButtonSet.OK
  );

  logAction('Synchronizacja produktów', 'Completed', `Updated: ${updated}, Errors: ${errors}`);
}

/**
 * Pobiera dane produktu z WordPress
 */
function fetchProductFromWordPress(asin) {
  const wpUrl = getSettingValue('WordPress API Endpoint');
  const apiKey = getSettingValue('API Key');

  const url = wpUrl + '/products/sync/' + asin;

  const options = {
    method: 'post',
    headers: {
      'X-API-Key': apiKey
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const responseBody = JSON.parse(response.getContentText());

      if (responseBody.success && responseBody.data) {
        return responseBody.data;
      }
    }

    return null;

  } catch (error) {
    Logger.log('Błąd pobierania produktu: ' + error);
    return null;
  }
}

/**
 * Pobiera wszystkie produkty z WordPress
 */
function fetchProductsFromWordPress() {
  const ui = SpreadsheetApp.getUi();
  const wpUrl = getSettingValue('WordPress API Endpoint');
  const apiKey = getSettingValue('API Key');

  const url = wpUrl + '/products/list';

  const options = {
    method: 'get',
    headers: {
      'X-API-Key': apiKey
    },
    muteHttpExceptions: true
  };

  try {
    ui.alert('📊 Pobieranie danych...', 'Pobieram produkty z WordPress...', ui.ButtonSet.OK);

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const responseBody = JSON.parse(response.getContentText());

      if (responseBody.success && responseBody.products) {
        const products = responseBody.products;

        // Wyczyść bazę danych i dodaj wszystkie produkty
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

        // Wyczyść dane (zachowaj nagłówek)
        if (dbSheet.getLastRow() > 1) {
          dbSheet.deleteRows(2, dbSheet.getLastRow() - 1);
        }

        // Dodaj produkty
        products.forEach((product, index) => {
          addProductToDatabase(product);
        });

        updateAnalytics();

        ui.alert(
          '✅ Pobrano produkty',
          `Pobrano ${products.length} produktów z WordPress`,
          ui.ButtonSet.OK
        );

        logAction('Pobieranie produktów', 'Success', `Pobrano ${products.length} produktów`);

      } else {
        ui.alert('❌ Błąd', 'Nie udało się pobrać produktów', ui.ButtonSet.OK);
      }

    } else {
      ui.alert('❌ Błąd', 'Błąd połączenia z WordPress (kod: ' + responseCode + ')', ui.ButtonSet.OK);
    }

  } catch (error) {
    ui.alert('❌ Błąd', 'Wystąpił błąd: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Błąd pobierania produktów: ' + error);
  }
}

// ============================================
// OPERACJE NA BAZIE DANYCH
// ============================================

/**
 * Dodaje produkt do bazy danych
 */
function addProductToDatabase(product) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

  if (!dbSheet) {
    return;
  }

  // Sprawdź czy produkt już istnieje
  const existingRow = findProductRow(product.asin);

  const rowData = [
    product.asin || '',
    product.title || '',
    product.brand || '',
    product.price || '',
    product.savings_percentage || '',
    product.prime_eligible ? 'YES' : 'NO',
    product.availability || '',
    product.affiliate_link || '',
    product.image_url || '',
    product.category || '',
    new Date(),
    product.id || product.post_id || '',
    Array.isArray(product.features) ? product.features.join('; ') : product.features || ''
  ];

  if (existingRow > 0) {
    // Aktualizuj istniejący wiersz
    const range = dbSheet.getRange(existingRow, 1, 1, rowData.length);
    range.setValues([rowData]);
  } else {
    // Dodaj nowy wiersz
    dbSheet.appendRow(rowData);
  }
}

/**
 * Aktualizuje produkt w bazie danych
 */
function updateProductInDatabase(rowNum, product) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

  const rowData = [
    product.asin || '',
    product.title || '',
    product.brand || '',
    product.price || '',
    product.savings_percentage || '',
    product.prime_eligible ? 'YES' : 'NO',
    product.availability || '',
    product.affiliate_link || '',
    product.image_url || '',
    product.category || '',
    new Date(),
    product.id || product.post_id || '',
    Array.isArray(product.features) ? product.features.join('; ') : product.features || ''
  ];

  const range = dbSheet.getRange(rowNum, 1, 1, rowData.length);
  range.setValues([rowData]);
}

/**
 * Znajduje wiersz produktu w bazie danych
 */
function findProductRow(asin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

  const data = dbSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.DB_COLUMNS.ASIN] === asin) {
      return i + 1; // +1 bo indeksowanie od 1
    }
  }

  return -1;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Pobiera wartość z arkusza Settings
 */
function getSettingValue(settingName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!settingsSheet) {
    return CONFIG.WORDPRESS_REST_API; // Fallback do domyślnego
  }

  const data = settingsSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === settingName) {
      return data[i][1];
    }
  }

  return null;
}

/**
 * Loguje akcję do arkusza Logs
 */
function logAction(action, status, details, asin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);

  if (!logsSheet) {
    return;
  }

  logsSheet.appendRow([
    new Date(),
    action,
    status,
    details || '',
    asin || ''
  ]);

  // Ogranicz do ostatnich 1000 wpisów
  if (logsSheet.getLastRow() > 1001) {
    logsSheet.deleteRows(2, logsSheet.getLastRow() - 1001);
  }
}

/**
 * Aktualizuje kolorowanie statusów
 */
function updateStatusColors(sheet) {
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const status = data[i][CONFIG.IMPORT_COLUMNS.STATUS];
    const cell = sheet.getRange(i + 1, CONFIG.IMPORT_COLUMNS.STATUS + 1);

    if (status === 'Imported') {
      cell.setBackground('#d4edda').setFontColor('#155724');
    } else if (status === 'Error') {
      cell.setBackground('#f8d7da').setFontColor('#721c24');
    } else if (status === 'Pending') {
      cell.setBackground('#fff3cd').setFontColor('#856404');
    }
  }
}

/**
 * Aktualizuje Analytics
 */
function updateAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const analyticsSheet = ss.getSheetByName(CONFIG.SHEETS.ANALYTICS);
  const dbSheet = ss.getSheetByName(CONFIG.SHEETS.DATABASE);

  if (!analyticsSheet || !dbSheet) {
    return;
  }

  const totalProducts = Math.max(0, dbSheet.getLastRow() - 1);
  const importSheet = ss.getSheetByName(CONFIG.SHEETS.TO_IMPORT);
  const pendingImports = importSheet ? countStatusInSheet(importSheet, 'Pending') : 0;

  const metrics = [
    ['Total Products', totalProducts, new Date()],
    ['Pending Imports', pendingImports, new Date()],
    ['Last Sync', new Date().toLocaleString(), new Date()]
  ];

  // Wyczyść dane (zachowaj nagłówek)
  if (analyticsSheet.getLastRow() > 1) {
    analyticsSheet.deleteRows(2, analyticsSheet.getLastRow() - 1);
  }

  const range = analyticsSheet.getRange(2, 1, metrics.length, 3);
  range.setValues(metrics);
}

/**
 * Liczy wiersze z określonym statusem
 */
function countStatusInSheet(sheet, status) {
  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.IMPORT_COLUMNS.STATUS] === status) {
      count++;
    }
  }

  return count;
}

/**
 * Test połączenia z WordPress
 */
function testWordPressConnection() {
  const ui = SpreadsheetApp.getUi();
  const wpUrl = getSettingValue('WordPress API Endpoint');
  const apiKey = getSettingValue('API Key');

  if (!wpUrl || wpUrl.includes('twoja-domena')) {
    ui.alert(
      '⚠️ Brak konfiguracji',
      'Najpierw skonfiguruj WordPress URL w arkuszu "Settings"!',
      ui.ButtonSet.OK
    );
    return;
  }

  const url = wpUrl + '/products/list';

  const options = {
    method: 'get',
    headers: {
      'X-API-Key': apiKey
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const responseBody = JSON.parse(response.getContentText());

      ui.alert(
        '✅ Połączenie działa!',
        `Pomyślnie połączono z WordPress!\n\nOdpowiedź: ${JSON.stringify(responseBody, null, 2).substring(0, 200)}...`,
        ui.ButtonSet.OK
      );

      logAction('Test połączenia', 'Success', 'Połączenie z WordPress działa');

    } else {
      ui.alert(
        '❌ Błąd połączenia',
        `Błąd HTTP: ${responseCode}\n\nSprawdź URL i uprawnienia w WordPress.`,
        ui.ButtonSet.OK
      );

      logAction('Test połączenia', 'Error', `HTTP ${responseCode}`);
    }

  } catch (error) {
    ui.alert(
      '❌ Błąd',
      `Nie udało się połączyć z WordPress:\n\n${error.message}`,
      ui.ButtonSet.OK
    );

    logAction('Test połączenia', 'Error', error.message);
  }
}

/**
 * Pokazuje pomoc
 */
function showHelp() {
  const ui = SpreadsheetApp.getUi();

  const helpText = `
📖 WAAS - WordPress Affiliate Automation System
================================================

🚀 SZYBKI START:
1. Kliknij "Konfiguracja początkowa" w menu WAAS
2. Wypełnij dane w arkuszu "Settings"
3. Skonfiguruj plugin WAAS w WordPress
4. Użyj "Test połączenia" aby sprawdzić konfigurację

📊 ARKUSZE:
• ProductsToImport - dodaj ASINy produktów do importu
• ProductsDatabase - wszystkie zaimportowane produkty
• Settings - konfiguracja
• Logs - historia operacji
• Analytics - statystyki

🔧 FUNKCJE:
• Import produktów - importuje produkty do WordPress
• Synchronizacja - aktualizuje ceny i dostępność
• Pobierz dane - pobiera wszystkie produkty z WordPress

📝 PRZYKŁADOWE ASINY:
• B08N5WRWNW - Apple AirPods Pro
• B07XJ8C8F5 - Echo Dot 4th Gen
• B09G9FPHY6 - Kindle Paperwhite

💡 WSPARCIE:
Zobacz README.md w repozytorium GitHub
  `;

  ui.alert('📖 Pomoc - WAAS', helpText, ui.ButtonSet.OK);
}

// ============================================
// WEB APP ENDPOINT (dla webhooków z WordPress)
// ============================================

/**
 * Obsługuje POST requesty z WordPress
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);

    // Weryfikuj API key
    const apiKey = getSettingValue('API Key');
    if (params.api_key !== apiKey) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Unauthorized'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Obsłuż różne akcje
    if (params.action === 'sync_product') {
      const product = params.product;
      addProductToDatabase(product);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Product synced to Google Sheets'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Obsługuje GET requesty
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'WAAS Google Apps Script is running',
    version: '1.0.0'
  })).setMimeType(ContentService.MimeType.JSON);
}
