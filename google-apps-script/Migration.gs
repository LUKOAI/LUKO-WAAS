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
