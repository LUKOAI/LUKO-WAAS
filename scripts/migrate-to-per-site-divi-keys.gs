/**
 * WAAS 2.0 - MIGRATION SCRIPT
 * Migracja z globalnych Divi API Keys do per-site keys
 *
 * Ten skrypt dodaje nowe kolumny do istniejącego arkusza WAAS:
 * - WP API Key (kolumna G)
 * - Divi API Key (kolumna H)
 * - Amazon Associate Tag (kolumna I)
 *
 * =====================================================================
 * INSTRUKCJA UŻYCIA:
 * =====================================================================
 * 1. Otwórz swój istniejący arkusz WAAS Google Sheets
 * 2. Kliknij: Extensions → Apps Script
 * 3. Kliknij: + (New file)
 * 4. Nazwij plik: "Migration"
 * 5. Wklej CAŁY ten kod
 * 6. Zapisz (Ctrl+S)
 * 7. Uruchom funkcję: migrateToPerSiteDiviKeys()
 * 8. Autoryzuj aplikację (jeśli potrzeba)
 * 9. Sprawdź logi (View → Logs)
 * 10. Zweryfikuj zmiany w zakładce Sites
 *
 * ⚠️ WAŻNE: Po migracji musisz RĘCZNIE:
 * - Dodać Divi API Key dla każdej strony w kolumnie H
 * - Dodać Amazon Associate Tag dla każdej strony w kolumnie I
 *
 * Aby uzyskać Divi API Key:
 * 1. Wejdź na: https://www.elegantthemes.com/members-area/api/
 * 2. Kliknij: "Add New API Key"
 * 3. Wpisz nazwę: [nazwa twojej strony]
 * 4. Kliknij: "Generate API Key"
 * 5. Skopiuj 40-znakowy klucz i wklej do Sites → kolumna H
 *
 * @version 1.0.0
 * @date 2025-11-23
 * =====================================================================
 */

/**
 * GŁÓWNA FUNKCJA MIGRACJI
 */
function migrateToPerSiteDiviKeys() {
  Logger.log('🚀 Starting WAAS 2.0 migration...');
  Logger.log('📋 This script will add new columns to Sites sheet:');
  Logger.log('   - Column G: WP API Key');
  Logger.log('   - Column H: Divi API Key (per-site!)');
  Logger.log('   - Column I: Amazon Associate Tag (per-site!)');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 1. Migracja zakładki Sites
    migrateSitesSheet(ss);

    // 2. Migracja zakładki Settings (opcjonalnie)
    migrateSettingsSheet(ss);

    // 3. Wyświetl podsumowanie
    showMigrationSummary(ss);

    Logger.log('✅ Migration completed successfully!');

  } catch (error) {
    Logger.log('❌ Migration error: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Migracja zakładki Sites - dodanie nowych kolumn
 */
function migrateSitesSheet(spreadsheet) {
  Logger.log('📊 Migrating Sites sheet...');

  const sitesSheet = spreadsheet.getSheetByName('Sites');

  if (!sitesSheet) {
    throw new Error('Sites sheet not found! Make sure you are running this in a WAAS spreadsheet.');
  }

  // Pobierz aktualne nagłówki
  const headers = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];

  Logger.log('Current headers: ' + headers.join(', '));

  // Sprawdź czy migracja już została wykonana
  if (headers.includes('Divi API Key')) {
    Logger.log('⚠️ Migration already completed! Divi API Key column already exists.');
    Logger.log('Skipping Sites sheet migration...');
    return;
  }

  // STARA STRUKTURA (przed migracją):
  // A: ID
  // B: Site Name
  // C: Domain
  // D: WordPress URL
  // E: Admin Username
  // F: Admin Password
  // G: Status (STARA POZYCJA!)
  // H: Divi Installed (STARA POZYCJA!)
  // I: Plugin Installed (STARA POZYCJA!)
  // J: Last Check (STARA POZYCJA!)
  // K: Created Date (OPCJONALNIE)
  // L: Notes (OPCJONALNIE)

  // NOWA STRUKTURA (po migracji):
  // A: ID
  // B: Site Name
  // C: Domain
  // D: WordPress URL
  // E: Admin Username
  // F: Admin Password
  // G: WP API Key (NOWA KOLUMNA!)
  // H: Divi API Key (NOWA KOLUMNA!)
  // I: Amazon Associate Tag (NOWA KOLUMNA!)
  // J: Status (PRZENIESIONA Z G)
  // K: Divi Installed (PRZENIESIONA Z H)
  // L: Plugin Installed (PRZENIESIONA Z I)
  // M: Last Check (PRZENIESIONA Z J)

  Logger.log('Adding 3 new columns after "Admin Password" (column F)...');

  // Wstaw 3 nowe kolumny PO kolumnie F (Admin Password)
  sitesSheet.insertColumnsAfter(6, 3);  // Po kolumnie F dodaj 3 kolumny

  // Ustaw nagłówki dla nowych kolumn
  sitesSheet.getRange('G1').setValue('WP API Key');
  sitesSheet.getRange('H1').setValue('Divi API Key');
  sitesSheet.getRange('I1').setValue('Amazon Associate Tag');

  // Formatowanie nagłówków
  sitesSheet.getRange('G1:I1')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // Ustaw szerokości kolumn
  sitesSheet.setColumnWidth(7, 250);   // WP API Key
  sitesSheet.setColumnWidth(8, 350);   // Divi API Key
  sitesSheet.setColumnWidth(9, 200);   // Amazon Associate Tag

  // Wygeneruj WP API Keys dla istniejących stron
  const lastRow = sitesSheet.getLastRow();

  if (lastRow > 1) {
    Logger.log(`Generating WP API Keys for ${lastRow - 1} existing sites...`);

    for (let i = 2; i <= lastRow; i++) {
      const domain = sitesSheet.getRange(i, 3).getValue();  // Kolumna C: Domain

      if (domain) {
        const domainPrefix = domain.split('.')[0];
        const wpApiKey = `waas-api-${domainPrefix}-${Date.now()}-migrated`;

        sitesSheet.getRange(i, 7).setValue(wpApiKey);  // Kolumna G: WP API Key

        Logger.log(`  Site ${i - 1}: Generated WP API Key for ${domain}`);
      }
    }
  }

  // Dodaj instrukcje w kolumnie H (Divi API Key)
  if (lastRow > 1) {
    sitesSheet.getRange('H2').setNote(
      '⚠️ WYMAGANE: Dodaj unikalny Divi API Key dla tej strony!\n\n' +
      'Jak uzyskać Divi API Key:\n' +
      '1. Wejdź na: https://www.elegantthemes.com/members-area/api/\n' +
      '2. Kliknij: "Add New API Key"\n' +
      '3. Wpisz nazwę: [nazwa tej strony]\n' +
      '4. Kliknij: "Generate API Key"\n' +
      '5. Skopiuj 40-znakowy klucz\n' +
      '6. Wklej tutaj\n\n' +
      'Format: 40 znaków hex (np. c12d038b32b1f2356c705ede89bf188b0abf6a51)'
    );
  }

  // Dodaj instrukcje w kolumnie I (Amazon Associate Tag)
  if (lastRow > 1) {
    sitesSheet.getRange('I2').setNote(
      'OPCJONALNE: Amazon Associate Tag dla tej strony\n\n' +
      'Format: yoursite-20\n' +
      'Jeśli puste, będzie używany globalny tag z Script Properties'
    );
  }

  Logger.log('✅ Sites sheet migrated successfully!');
  Logger.log(`   - Added column G: WP API Key (auto-generated for ${lastRow - 1} sites)`);
  Logger.log('   - Added column H: Divi API Key (⚠️ REQUIRES MANUAL INPUT!)');
  Logger.log('   - Added column I: Amazon Associate Tag (optional)');
}

/**
 * Migracja zakładki Settings - usunięcie per-site ustawień
 */
function migrateSettingsSheet(spreadsheet) {
  Logger.log('⚙️ Migrating Settings sheet...');

  const settingsSheet = spreadsheet.getSheetByName('Settings');

  if (!settingsSheet) {
    Logger.log('⚠️ Settings sheet not found, skipping...');
    return;
  }

  Logger.log('⚠️ WARNING: Settings sheet should contain ONLY global parameters!');
  Logger.log('   Per-site settings (auto_publish, max_posts_per_day, etc.) should be removed.');
  Logger.log('   Manual review recommended.');

  // Lista błędnych per-site ustawień, które powinny być usunięte
  const perSiteSettings = [
    'auto_publish',
    'content_generation_enabled',
    'max_posts_per_day',
    'default_post_status',
    'divi_default_template'
  ];

  const data = settingsSheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const settingKey = data[i][0];

    if (perSiteSettings.includes(settingKey)) {
      rowsToDelete.push(i + 1);  // +1 bo liczymy od 1
      Logger.log(`   ⚠️ Found per-site setting to remove: ${settingKey} (row ${i + 1})`);
    }
  }

  if (rowsToDelete.length > 0) {
    Logger.log(`   Removing ${rowsToDelete.length} per-site settings from Settings sheet...`);

    // Usuń wiersze od końca (aby indeksy się nie przesuwały)
    rowsToDelete.reverse();

    for (const rowNum of rowsToDelete) {
      settingsSheet.deleteRow(rowNum);
      Logger.log(`   ✅ Deleted row ${rowNum}`);
    }
  }

  // Dodaj informacje o globalnych parametrach
  const globalSettings = [
    ['', '', ''],
    ['', '', '⚠️ IMPORTANT: This sheet should contain ONLY global parameters!'],
    ['', '', 'Per-site settings (Divi API Key, Amazon Associate Tag) are in Sites sheet!'],
    ['', '', ''],
    ['divi_api_username', 'netanaliza', 'Elegant Themes username (same for all sites)'],
    ['hostinger_ssh_host', 'ssh.lk24.shop', 'Hostinger SSH host'],
    ['hostinger_ssh_port', '65002', 'Hostinger SSH port'],
    ['system_notification_email', 'netanalizaltd@gmail.com', 'System-wide notification email']
  ];

  Logger.log('   Adding global parameter examples...');

  const lastRow = settingsSheet.getLastRow();
  settingsSheet.getRange(lastRow + 1, 1, globalSettings.length, 3).setValues(globalSettings);

  Logger.log('✅ Settings sheet migrated successfully!');
}

/**
 * Wyświetl podsumowanie migracji
 */
function showMigrationSummary(spreadsheet) {
  const ui = SpreadsheetApp.getUi();

  const sitesSheet = spreadsheet.getSheetByName('Sites');
  const siteCount = sitesSheet ? sitesSheet.getLastRow() - 1 : 0;

  Logger.log('');
  Logger.log('========================================');
  Logger.log('PODSUMOWANIE MIGRACJI WAAS 2.0');
  Logger.log('========================================');
  Logger.log(`✅ Sites sheet: ${siteCount} sites migrated`);
  Logger.log('✅ New columns added:');
  Logger.log('   - Column G: WP API Key (auto-generated)');
  Logger.log('   - Column H: Divi API Key (⚠️ REQUIRES MANUAL INPUT!)');
  Logger.log('   - Column I: Amazon Associate Tag (optional)');
  Logger.log('');
  Logger.log('⚠️ NEXT STEPS:');
  Logger.log('1. Go to Sites sheet');
  Logger.log('2. For EACH site, add Divi API Key in column H');
  Logger.log('   Get it from: https://www.elegantthemes.com/members-area/api/');
  Logger.log('3. Optionally add Amazon Associate Tag in column I');
  Logger.log('4. Update Script Properties:');
  Logger.log('   - Remove: DIVI_API_KEY (now per-site!)');
  Logger.log('   - Remove: PA_API_PARTNER_TAG (now per-site!)');
  Logger.log('   - Keep: DIVI_API_USERNAME, PA_API_ACCESS_KEY, PA_API_SECRET_KEY');
  Logger.log('');
  Logger.log('========================================');

  ui.alert(
    '✅ Migration Complete!',
    'WAAS 2.0 migration completed successfully!\n\n' +
    `Migrated ${siteCount} sites.\n\n` +
    '⚠️ IMPORTANT - MANUAL STEPS REQUIRED:\n\n' +
    '1. Go to "Sites" sheet\n' +
    '2. For EACH site, fill in column H (Divi API Key)\n' +
    '   Get unique key from:\n' +
    '   https://www.elegantthemes.com/members-area/api/\n\n' +
    '3. Optionally fill column I (Amazon Associate Tag)\n\n' +
    '4. Update Script Properties:\n' +
    '   Extensions → Apps Script → Project Settings\n' +
    '   Remove: DIVI_API_KEY, PA_API_PARTNER_TAG\n' +
    '   (these are now per-site in Sites sheet!)\n\n' +
    'Check Execution log for details (View → Logs)',
    ui.ButtonSet.OK
  );
}

/**
 * Funkcja testowa - sprawdź strukturę przed migracją
 */
function checkCurrentStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');

  if (!sitesSheet) {
    Logger.log('❌ Sites sheet not found!');
    return;
  }

  Logger.log('📊 Current Sites sheet structure:');
  Logger.log('========================================');

  const headers = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];

  for (let i = 0; i < headers.length; i++) {
    const columnLetter = String.fromCharCode(65 + i);  // 65 = 'A'
    Logger.log(`Column ${columnLetter}: ${headers[i]}`);
  }

  Logger.log('========================================');
  Logger.log(`Total columns: ${headers.length}`);
  Logger.log(`Total rows (including header): ${sitesSheet.getLastRow()}`);
  Logger.log(`Sites count: ${sitesSheet.getLastRow() - 1}`);
}
