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
