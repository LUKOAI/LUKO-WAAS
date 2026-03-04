/**
 * ============================================================================
 * WAAS PRICE UPDATE WEBHOOK
 * ============================================================================
 *
 * Webhook endpoint dla WordPressa do aktualizacji cen w Google Sheets
 * WordPress wyśle POST request z nowymi cenami po daily cron job
 *
 * AKTUALIZACJA: Obsługuje teraz wszystkie kolumny cenowe:
 * - Price
 * - PriceCurrency
 * - PriceFormatted
 * - PriceText
 * - Last Price Update
 *
 * INSTALACJA:
 * 1. Skopiuj ten kod do Google Apps Script
 * 2. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 3. Skopiuj Web App URL
 * 4. W WordPress Settings → WAAS → wklej URL jako "Google Sheets Webhook URL"
 *
 * ============================================================================
 */

/**
 * Handle GET requests (for testing/status check)
 * Google Apps Script may redirect POST to GET, this handles that case
 *
 * @param {Object} e - Event object
 * @returns {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'online',
    message: 'WAAS Price Webhook is active. Use POST requests from WordPress to update prices.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests from WordPress
 *
 * @param {Object} e - Event object with postData
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Parse incoming JSON
    const data = JSON.parse(e.postData.contents);

    Logger.log('Received price update webhook from WordPress');
    Logger.log('Action: ' + data.action);
    Logger.log('Updates count: ' + (data.updates ? data.updates.length : 0));

    if (data.action === 'update_prices') {
      const result = updatePricesInSheet(data.updates);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        updated: result.updated,
        failed: result.failed,
        message: `Updated ${result.updated} products, ${result.failed} failed`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action: ' + data.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('ERROR in doPost: ' + error.message);
    Logger.log('Stack: ' + error.stack);

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Update prices in Google Sheets Products tab
 * Updates all price-related columns
 *
 * @param {Array} updates - Array of {asin, price, price_currency, price_formatted, price_text, last_price_update}
 * @returns {Object} {updated: number, failed: number}
 */
function updatePricesInSheet(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  if (!sheet) {
    throw new Error('Products sheet not found');
  }

  // Get all data
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find column indexes (case-insensitive search)
  const findColumnIndex = (name) => {
    const lowerName = name.toLowerCase();
    return headers.findIndex(h => h.toString().toLowerCase() === lowerName);
  };

  const asinColIdx = findColumnIndex('ASIN');
  const priceColIdx = findColumnIndex('Price');
  const priceCurrencyColIdx = findColumnIndex('PriceCurrency');
  const priceFormattedColIdx = findColumnIndex('PriceFormatted');
  const priceTextColIdx = findColumnIndex('PriceText');
  const lastPriceUpdateColIdx = findColumnIndex('Last Price Update');
  const priceSourceColIdx = findColumnIndex('Price Source');

  if (asinColIdx === -1) {
    throw new Error('ASIN column not found in Products sheet');
  }

  Logger.log(`Column indexes found:`);
  Logger.log(`  ASIN: ${asinColIdx}`);
  Logger.log(`  Price: ${priceColIdx}`);
  Logger.log(`  PriceCurrency: ${priceCurrencyColIdx}`);
  Logger.log(`  PriceFormatted: ${priceFormattedColIdx}`);
  Logger.log(`  PriceText: ${priceTextColIdx}`);
  Logger.log(`  Last Price Update: ${lastPriceUpdateColIdx}`);
  Logger.log(`  Price Source: ${priceSourceColIdx}`);

  let updated = 0;
  let failed = 0;

  // Process each update
  updates.forEach(update => {
    const asin = update.asin;
    const newPrice = update.price;
    const priceCurrency = update.price_currency || 'EUR';
    const priceFormatted = update.price_formatted || '';
    const priceText = update.price_text || '';
    const timestamp = update.last_price_update; // German format: DD.MM.YYYY HH:MM
    const priceSource = update.price_source || '';

    Logger.log(`Processing update for ASIN: ${asin}`);
    Logger.log(`  Price: ${newPrice}`);
    Logger.log(`  Currency: ${priceCurrency}`);
    Logger.log(`  Formatted: ${priceFormatted}`);
    Logger.log(`  Text: ${priceText}`);
    Logger.log(`  Timestamp: ${timestamp}`);
    Logger.log(`  Source: ${priceSource}`);

    // Find row with this ASIN
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][asinColIdx] === asin) {
        // Found the product!
        const rowNum = i + 1; // Sheet rows are 1-indexed

        // Update Price column
        if (priceColIdx >= 0 && newPrice !== undefined) {
          sheet.getRange(rowNum, priceColIdx + 1).setValue(newPrice);
          Logger.log(`  → Updated Price in row ${rowNum}: ${newPrice}`);
        }

        // Update PriceCurrency column
        if (priceCurrencyColIdx >= 0 && priceCurrency) {
          sheet.getRange(rowNum, priceCurrencyColIdx + 1).setValue(priceCurrency);
          Logger.log(`  → Updated PriceCurrency in row ${rowNum}: ${priceCurrency}`);
        }

        // Update PriceFormatted column
        if (priceFormattedColIdx >= 0 && priceFormatted) {
          sheet.getRange(rowNum, priceFormattedColIdx + 1).setValue(priceFormatted);
          Logger.log(`  → Updated PriceFormatted in row ${rowNum}: ${priceFormatted}`);
        }

        // Update PriceText column
        if (priceTextColIdx >= 0) {
          sheet.getRange(rowNum, priceTextColIdx + 1).setValue(priceText);
          Logger.log(`  → Updated PriceText in row ${rowNum}: ${priceText}`);
        }

        // Update Last Price Update column
        if (lastPriceUpdateColIdx >= 0 && timestamp) {
          sheet.getRange(rowNum, lastPriceUpdateColIdx + 1).setValue(timestamp);
          Logger.log(`  → Updated Last Price Update in row ${rowNum}: ${timestamp}`);
        }

        // Update Price Source column (v3)
        if (priceSourceColIdx >= 0 && priceSource) {
          sheet.getRange(rowNum, priceSourceColIdx + 1).setValue(priceSource);
          Logger.log(`  → Updated Price Source in row ${rowNum}: ${priceSource}`);
        }

        found = true;
        updated++;
        break;
      }
    }

    if (!found) {
      Logger.log(`  ✗ ASIN ${asin} not found in sheet`);
      failed++;
    }
  });

  Logger.log(`Price update complete: ${updated} updated, ${failed} failed`);

  return {
    updated: updated,
    failed: failed
  };
}

/**
 * Test function - call this to test the webhook locally
 */
function testPriceUpdateWebhook() {
  const testData = {
    action: 'update_prices',
    updates: [
      {
        asin: 'B09QMB59TM',
        price: 119.99,
        price_currency: 'EUR',
        price_formatted: '119,99 €',
        price_text: 'Aktueller Preis',
        last_price_update: '03.12.2025 15:30'
      },
      {
        asin: 'B08XYZ1234',
        price: 89.50,
        price_currency: 'EUR',
        price_formatted: '89,50 €',
        price_text: '',
        last_price_update: '03.12.2025 15:31'
      }
    ]
  };

  // Simulate POST request
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const response = doPost(e);
  Logger.log('Response: ' + response.getContent());
}

/**
 * Get the webhook URL for this Web App
 * Run this function to get the URL you need to paste in WordPress settings
 */
function getWebhookUrl() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('='.repeat(80));
  Logger.log('WEBHOOK URL:');
  Logger.log(url);
  Logger.log('='.repeat(80));
  Logger.log('');
  Logger.log('INSTRUKCJA:');
  Logger.log('1. Skopiuj powyższy URL');
  Logger.log('2. Wejdź do WordPress → Settings → WAAS Product Manager');
  Logger.log('3. W polu "Google Sheets Webhook URL" wklej ten URL');
  Logger.log('4. Zapisz ustawienia');
  Logger.log('');
  Logger.log('Teraz WordPress będzie mógł wysyłać price updates do tego Google Sheets!');
  Logger.log('='.repeat(80));

  return url;
}

// =============================================================================
// PRICE SYNC TRIGGER (v3 — Phase F)
// =============================================================================

/**
 * Trigger price sync for a specific site via REST API.
 * Calls POST /waas-settings/v1/price-sync on the WordPress site.
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} { success, data: { updated, failed, skipped, total, source_stats, duration_seconds }, error }
 */
function triggerPriceSyncForSite(site) {
  logInfo('PRICE_SYNC', 'Triggering price sync for: ' + site.name + ' (' + site.domain + ')', site.id);

  var result = makeHttpRequest(site.wpUrl.replace(/\/+$/, '') + '/wp-json/waas-settings/v1/price-sync', {
    method: 'POST',
    headers: { 'Authorization': getAuthHeader(site), 'Content-Type': 'application/json' },
    payload: JSON.stringify({})
  });

  if (!result.success) {
    logError('PRICE_SYNC', 'Price sync failed: ' + (result.error || 'Unknown error'), site.id);
    return { success: false, error: result.error || 'API request failed' };
  }

  var data = result.data || {};
  logSuccess('PRICE_SYNC',
    'Price sync completed for ' + site.domain + ': ' +
    data.updated + ' updated, ' + data.failed + ' failed, ' + data.skipped + ' skipped' +
    ' (PA-API: ' + (data.source_stats && data.source_stats.pa_api || 0) +
    ', SP-API: ' + (data.source_stats && data.source_stats.sp_api || 0) + ')' +
    ' [' + (data.duration_seconds || '?') + 's]',
    site.id
  );

  return {
    success: true,
    data: data
  };
}

/**
 * Price Sync Dialog — trigger price update for a specific site
 * Called from Menu.gs
 */
function priceSyncDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Price Sync', 'Podaj Site ID strony do synchronizacji cen:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var siteId = result.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) {
    ui.alert('Błąd', 'Nie znaleziono strony o ID: ' + siteId, ui.ButtonSet.OK);
    return;
  }

  // Confirm
  var confirm = ui.alert('Price Sync',
    'Uruchomić synchronizację cen dla:\n\n' +
    'Site: ' + site.name + '\n' +
    'Domain: ' + site.domain + '\n\n' +
    'To uruchomi daily price update (PA-API/SP-API) na WordPressie.\n' +
    'Kontynuować?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Trigger sync
  var syncResult = triggerPriceSyncForSite(site);

  if (syncResult.success) {
    var d = syncResult.data;
    var sourceInfo = '';
    if (d.source_stats) {
      sourceInfo = '\n\nŹródła:\n  PA-API: ' + (d.source_stats.pa_api || 0) + '\n  SP-API: ' + (d.source_stats.sp_api || 0);
    }
    ui.alert('Sukces',
      'Synchronizacja cen zakończona!\n\n' +
      'Zaktualizowano: ' + (d.updated || 0) + '\n' +
      'Błędy: ' + (d.failed || 0) + '\n' +
      'Pominięte: ' + (d.skipped || 0) + '\n' +
      'Łącznie produktów: ' + (d.total || 0) + '\n' +
      'Czas: ' + (d.duration_seconds || '?') + 's' +
      sourceInfo +
      '\n\nKonfiguracja źródła: ' + (d.price_source_config || 'auto'),
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('Błąd', 'Price sync nie powiódł się: ' + (syncResult.error || 'Unknown'), ui.ButtonSet.OK);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create missing price columns in Products sheet
 * Run this once if columns are missing
 */
function createPriceColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  if (!sheet) {
    Logger.log('Products sheet not found!');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const requiredColumns = [
    'Price',
    'PriceCurrency',
    'PriceFormatted',
    'PriceText',
    'Last Price Update',
    'Price Source'
  ];

  let addedColumns = 0;

  requiredColumns.forEach(colName => {
    const exists = headers.some(h => h.toString().toLowerCase() === colName.toLowerCase());

    if (!exists) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(colName);
      Logger.log(`Added column: ${colName} at position ${nextCol}`);
      addedColumns++;
    } else {
      Logger.log(`Column already exists: ${colName}`);
    }
  });

  if (addedColumns > 0) {
    Logger.log(`\n✓ Added ${addedColumns} new columns to Products sheet`);
  } else {
    Logger.log('\n✓ All required columns already exist');
  }
}
