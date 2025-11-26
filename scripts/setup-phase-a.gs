/**
 * WAAS 2.0 - Phase A: Automatic Page Creation Setup
 *
 * Ten skrypt automatycznie tworzy i konfiguruje wszystkie potrzebne arkusze
 * i dane dla Phase A - automatyczne tworzenie stron WordPress.
 *
 * INSTRUKCJA UŻYCIA:
 * 1. Otwórz swój Google Sheet (AmazonAffiliateProductsDashboard)
 * 2. Przejdź do: Extensions > Apps Script
 * 3. Skopiuj i wklej cały ten kod
 * 4. Kliknij "Run" > wybierz funkcję: setupPhaseA
 * 5. Zaakceptuj uprawnienia (jeśli pojawi się prompt)
 * 6. Gotowe! Arkusz WC_Pages został utworzony z domyślnymi danymi
 *
 * CO ROBI TEN SKRYPT:
 * - Tworzy arkusz "WC_Pages" (jeśli nie istnieje)
 * - Dodaje nagłówki kolumn
 * - Wstawia domyślne strony: Home, Shop, About, Patronage
 * - Formatuje arkusz (header, kolory, szerokości kolumn)
 * - Tworzy lub aktualizuje konfigurację w "WC_Structure_Config"
 *
 * @author LUKO AI Team
 * @version 2.0
 * @date 2025-11-26
 */

/**
 * GŁÓWNA FUNKCJA - Uruchom tę funkcję aby skonfigurować Phase A
 */
function setupPhaseA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log('🚀 Rozpoczynam konfigurację Phase A...');

  try {
    // Krok 1: Utwórz lub pobierz arkusz WC_Pages
    const pagesSheet = createOrGetSheet(ss, 'WC_Pages');

    // Krok 2: Dodaj nagłówki
    setupHeaders(pagesSheet);

    // Krok 3: Dodaj domyślne strony
    addDefaultPages(pagesSheet);

    // Krok 4: Formatuj arkusz
    formatPagesSheet(pagesSheet);

    // Krok 5: Utwórz konfigurację w WC_Structure_Config (jeśli arkusz istnieje)
    const configSheet = ss.getSheetByName('WC_Structure_Config');
    if (configSheet) {
      setupDefaultConfig(configSheet);
    } else {
      Logger.log('⚠️  Arkusz WC_Structure_Config nie istnieje - pomijam konfigurację');
    }

    // Krok 6: Pokaż komunikat sukcesu
    showSuccessMessage();

    Logger.log('✅ Konfiguracja Phase A zakończona pomyślnie!');

  } catch (error) {
    Logger.log('❌ Błąd podczas konfiguracji: ' + error.message);
    SpreadsheetApp.getUi().alert(
      '❌ Błąd konfiguracji\n\n' + error.message +
      '\n\nSprawdź logi: View > Logs'
    );
  }
}

/**
 * Tworzy nowy arkusz lub pobiera istniejący
 */
function createOrGetSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log(`📄 Tworzę nowy arkusz: ${sheetName}`);
    sheet = ss.insertSheet(sheetName);
  } else {
    Logger.log(`📄 Arkusz ${sheetName} już istnieje - czyszczę dane`);
    sheet.clear();
  }

  return sheet;
}

/**
 * Dodaje nagłówki do arkusza WC_Pages
 */
function setupHeaders(sheet) {
  Logger.log('📋 Dodaję nagłówki...');

  const headers = [
    'config_id',
    'page_id',
    'title',
    'slug',
    'parent_page_id',
    'content',
    'is_front_page',
    'is_posts_page',
    'order'
  ];

  // Ustaw nagłówki w pierwszym wierszu
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Formatuj nagłówki
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
}

/**
 * Dodaje domyślne strony do arkusza
 */
function addDefaultPages(sheet) {
  Logger.log('📝 Dodaję domyślne strony...');

  const defaultPages = [
    // Home Page
    [
      'default',
      'home',
      'Home',
      'home',
      '',
      '[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text]<h1>Welcome to Our Store</h1><p>Your trusted source for quality products and expert reviews.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section][et_pb_section][et_pb_row][et_pb_column type="4_4"][waas_featured_products limit="6"][/et_pb_column][/et_pb_row][/et_pb_section]',
      'TRUE',
      'FALSE',
      1
    ],
    // Shop Page
    [
      'default',
      'shop',
      'Shop',
      'shop',
      '',
      '[woocommerce_shop]',
      'FALSE',
      'FALSE',
      2
    ],
    // About Page
    [
      'default',
      'about',
      'About Us',
      'about',
      '',
      '[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text]<h1>About Us</h1><p>We are passionate about helping you find the best products through honest reviews and detailed comparisons.</p><h2>What We Do</h2><ul><li>✓ In-depth product reviews</li><li>✓ Expert recommendations</li><li>✓ Price comparisons</li><li>✓ Buying guides</li></ul><h2>Why Trust Us?</h2><p>All our reviews are based on thorough research and real-world testing. We are committed to providing unbiased information to help you make informed decisions.</p><h2>Disclosure</h2><p>We participate in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
      'FALSE',
      'FALSE',
      3
    ],
    // Patronage Page
    [
      'default',
      'patronage',
      'Patronage',
      'patronage',
      '',
      '[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text]<h1>Support Us</h1><p>Love our content? Support us through Patronage and get exclusive benefits!</p><h2>Patronage Benefits</h2>[patronage_benefits_list]<h2>Become a Patron</h2><p>Choose your support level:</p>[patronage_pricing_table]<h2>Already a Patron?</h2><p>Thank you for your support! Access your exclusive benefits here:</p>[patronage_login_form][/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
      'FALSE',
      'FALSE',
      4
    ]
  ];

  // Wstaw dane zaczynając od wiersza 2 (wiersz 1 to nagłówki)
  sheet.getRange(2, 1, defaultPages.length, defaultPages[0].length)
       .setValues(defaultPages);

  Logger.log(`✅ Dodano ${defaultPages.length} domyślne strony`);
}

/**
 * Formatuje arkusz WC_Pages
 */
function formatPagesSheet(sheet) {
  Logger.log('🎨 Formatuję arkusz...');

  // Ustaw szerokości kolumn
  const columnWidths = [
    120,  // config_id
    100,  // page_id
    150,  // title
    120,  // slug
    150,  // parent_page_id
    500,  // content (szeroka!)
    120,  // is_front_page
    120,  // is_posts_page
    80    // order
  ];

  columnWidths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });

  // Zaznacz kolumnę content innym kolorem (żółty = "uwaga, długi tekst!")
  const contentColumn = sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1);
  contentColumn.setBackground('#fff3cd');

  // Wyśrodkuj kolumny boolean i order
  sheet.getRange(2, 7, sheet.getMaxRows() - 1, 3).setHorizontalAlignment('center');

  // Zamroź pierwszy wiersz (nagłówki)
  sheet.setFrozenRows(1);

  Logger.log('✅ Formatowanie zakończone');
}

/**
 * Dodaje domyślną konfigurację do WC_Structure_Config
 */
function setupDefaultConfig(configSheet) {
  Logger.log('⚙️  Dodaję konfigurację w WC_Structure_Config...');

  try {
    // Sprawdź czy arkusz ma nagłówki
    const headers = configSheet.getRange(1, 1, 1, configSheet.getLastColumn()).getValues()[0];

    if (headers.length === 0 || headers[0] === '') {
      Logger.log('⚠️  Arkusz WC_Structure_Config jest pusty - pomijam');
      return;
    }

    // Znajdź indeksy kolumn
    const configIdCol = headers.indexOf('config_id') + 1;
    const structureNameCol = headers.indexOf('structure_name') + 1;
    const executeCol = headers.indexOf('execute') + 1;
    const statusCol = headers.indexOf('status') + 1;

    if (configIdCol === 0) {
      Logger.log('⚠️  Nie znaleziono kolumny config_id - pomijam');
      return;
    }

    // Sprawdź czy konfiguracja 'default-pages' już istnieje
    const dataRange = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, configSheet.getLastColumn());
    const data = dataRange.getValues();

    let configExists = false;
    data.forEach(row => {
      if (row[configIdCol - 1] === 'default-pages') {
        configExists = true;
      }
    });

    if (configExists) {
      Logger.log('ℹ️  Konfiguracja default-pages już istnieje - pomijam');
      return;
    }

    // Dodaj nową konfigurację
    const newRow = configSheet.getLastRow() + 1;

    if (structureNameCol > 0) {
      configSheet.getRange(newRow, structureNameCol).setValue('Default Pages Setup');
    }
    if (configIdCol > 0) {
      configSheet.getRange(newRow, configIdCol).setValue('default-pages');
    }
    if (executeCol > 0) {
      configSheet.getRange(newRow, executeCol).setValue(false);
    }
    if (statusCol > 0) {
      configSheet.getRange(newRow, statusCol).setValue('ready');
    }

    Logger.log('✅ Dodano konfigurację default-pages');

  } catch (error) {
    Logger.log('⚠️  Nie udało się dodać konfiguracji: ' + error.message);
  }
}

/**
 * Pokazuje komunikat sukcesu
 */
function showSuccessMessage() {
  const ui = SpreadsheetApp.getUi();

  const message =
    '✅ Phase A skonfigurowana pomyślnie!\n\n' +
    'Co zostało utworzone:\n' +
    '📄 Arkusz "WC_Pages" z 4 domyślnymi stronami:\n' +
    '   • Home (strona główna)\n' +
    '   • Shop (WooCommerce)\n' +
    '   • About (O nas + Amazon disclosure)\n' +
    '   • Patronage (wsparcie)\n\n' +
    'NASTĘPNE KROKI:\n' +
    '1. Możesz edytować zawartość stron w kolumnie "content"\n' +
    '2. Dodaj własne strony (skopiuj wiersz i zmień dane)\n' +
    '3. W arkuszu WC_Structure_Config ustaw execute=TRUE aby wygenerować plugin\n' +
    '4. Plugin automatycznie utworzy strony w WordPress\n\n' +
    'Dokumentacja: docs/PHASE_A_PAGE_AUTOMATION.md';

  ui.alert('🎉 Sukces!', message, ui.ButtonSet.OK);
}

/**
 * FUNKCJA POMOCNICZA: Eksportuj do CSV
 * Zapisuje arkusz WC_Pages jako CSV do pobrania
 */
function exportPagesAsCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('WC_Pages');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Arkusz WC_Pages nie istnieje!\n\nUruchom najpierw setupPhaseA()');
    return;
  }

  // Pobierz wszystkie dane
  const data = sheet.getDataRange().getValues();

  // Konwertuj do CSV
  const csv = data.map(row => {
    return row.map(cell => {
      // Escapuj cudzysłowy i dodaj cudzysłowy jeśli zawiera przecinek
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',');
  }).join('\n');

  Logger.log('📄 CSV wygenerowany (' + csv.length + ' znaków)');
  Logger.log('Skopiuj poniższy CSV:\n\n' + csv);

  SpreadsheetApp.getUi().alert(
    'CSV wygenerowany!\n\n' +
    'Sprawdź logi: View > Logs\n' +
    'Tam znajdziesz pełny CSV do skopiowania.'
  );
}

/**
 * FUNKCJA POMOCNICZA: Wyczyść arkusz
 * Usuwa wszystkie dane z WC_Pages (ale nie usuwa arkusza)
 */
function clearPagesSheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '⚠️  Potwierdzenie',
    'Czy na pewno chcesz wyczyścić arkusz WC_Pages?\n\n' +
    'Wszystkie dane zostaną usunięte!\n\n' +
    'Możesz potem uruchomić setupPhaseA() aby je przywrócić.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('WC_Pages');

    if (sheet) {
      sheet.clear();
      Logger.log('🗑️  Arkusz WC_Pages wyczyszczony');
      ui.alert('✅ Arkusz WC_Pages został wyczyszczony');
    } else {
      ui.alert('❌ Arkusz WC_Pages nie istnieje');
    }
  } else {
    Logger.log('ℹ️  Anulowano czyszczenie arkusza');
  }
}

/**
 * FUNKCJA POMOCNICZA: Dodaj menu do Google Sheets
 * Automatycznie dodaje menu "WAAS Phase A" do arkusza
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🚀 WAAS Phase A')
    .addItem('⚙️  Setup Phase A (utwórz arkusz WC_Pages)', 'setupPhaseA')
    .addSeparator()
    .addItem('📄 Eksportuj jako CSV', 'exportPagesAsCSV')
    .addItem('🗑️  Wyczyść arkusz WC_Pages', 'clearPagesSheet')
    .addSeparator()
    .addItem('📚 Dokumentacja', 'showDocumentation')
    .addToUi();
}

/**
 * Pokazuje link do dokumentacji
 */
function showDocumentation() {
  const ui = SpreadsheetApp.getUi();

  ui.alert(
    '📚 Dokumentacja Phase A',
    'Pełna dokumentacja znajduje się w pliku:\n\n' +
    'docs/PHASE_A_PAGE_AUTOMATION.md\n\n' +
    'W repozytorium GitHub:\n' +
    'https://github.com/LUKOAI/LUKO-WAAS\n\n' +
    'Szablon CSV:\n' +
    'docs/templates/default_pages.csv',
    ui.ButtonSet.OK
  );
}

/**
 * ==============================================================
 * INSTRUKCJA INSTALACJI MENU:
 * ==============================================================
 *
 * Aby dodać menu "WAAS Phase A" do Google Sheets:
 *
 * 1. Skopiuj funkcję onOpen() (powyżej) do swojego projektu
 * 2. Odśwież stronę Google Sheets (F5)
 * 3. W menu głównym zobaczysz: "🚀 WAAS Phase A"
 *
 * Menu zawiera:
 * - Setup Phase A (utwórz arkusz WC_Pages)
 * - Eksportuj jako CSV
 * - Wyczyść arkusz WC_Pages
 * - Dokumentacja
 *
 * ==============================================================
 */
