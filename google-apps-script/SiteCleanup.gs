/**
 * WAAS - WordPress Affiliate Automation System
 * SiteCleanup Module
 *
 * Site cleanup after cloning, branding updates, site info retrieval,
 * and search engine verification tag management.
 *
 * Uses endpoints from waas-settings/v1 namespace:
 * - POST /cleanup (with dry_run mode)
 * - PUT /branding
 * - GET /site-info
 * - POST /gsc-verify
 * - POST /bing-verify
 *
 * @version 3.0.0
 */

// =============================================================================
// INTERNAL API HELPERS (waas-settings/v1 namespace)
// =============================================================================

/**
 * POST request to waas-settings/v1 endpoint
 * @private
 */
function _cleanupApiPost(site, endpoint, body) {
  return makeHttpRequest(site.wpUrl + '/wp-json/waas-settings/v1' + endpoint, {
    method: 'POST',
    headers: { 'Authorization': getAuthHeader(site), 'Content-Type': 'application/json' },
    payload: JSON.stringify(body)
  });
}

/**
 * GET request to waas-settings/v1 endpoint
 * @private
 */
function _cleanupApiGet(site, endpoint) {
  return makeHttpRequest(site.wpUrl + '/wp-json/waas-settings/v1' + endpoint, {
    method: 'GET',
    headers: { 'Authorization': getAuthHeader(site) }
  });
}

/**
 * PUT request to waas-settings/v1 endpoint
 * @private
 */
function _cleanupApiPut(site, endpoint, body) {
  return makeHttpRequest(site.wpUrl + '/wp-json/waas-settings/v1' + endpoint, {
    method: 'PUT',
    headers: { 'Authorization': getAuthHeader(site), 'Content-Type': 'application/json' },
    payload: JSON.stringify(body)
  });
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Full site cleanup after cloning.
 * Removes: products, posts, waas_products, taxonomies.
 * Does NOT remove: pages, media (unless includeMedia=true).
 *
 * @param {Object} site - Site object from getSiteById()
 * @param {Object} options - Cleanup options
 * @param {boolean} options.includeMedia - Include media in cleanup (default: false)
 * @param {boolean} options.dryRun - Dry run mode — count only (default: false)
 * @param {string} options.siteTitle - Update site title after cleanup
 * @param {string} options.tagline - Update tagline after cleanup
 * @returns {Object} { success, data: { deleted, duration_seconds }, error }
 */
function cleanupClonedSite(site, options) {
  options = options || {};
  var includeMedia = options.includeMedia || false;
  var dryRun = options.dryRun || false;

  logInfo('CLEANUP', 'Starting site cleanup' + (dryRun ? ' (DRY RUN)' : '') + ': ' + site.name + ' (' + site.domain + ')', site.id);

  // Build target list
  var targets = ['products', 'posts', 'waas_products', 'taxonomies'];
  if (includeMedia) {
    targets.push('media');
  }

  // Call POST /waas-settings/v1/cleanup
  var result = _cleanupApiPost(site, '/cleanup', {
    targets: targets,
    dry_run: dryRun
  });

  if (!result.success) {
    logError('CLEANUP', 'Cleanup failed: ' + (result.error || 'Unknown error'), site.id);
    return { success: false, error: result.error || 'API request failed' };
  }

  if (dryRun) {
    logInfo('CLEANUP', 'Dry run results: ' + JSON.stringify(result.data.deleted), site.id);
  } else {
    logSuccess('CLEANUP', 'Site cleaned: ' + JSON.stringify(result.data.deleted), site.id);

    // Update branding if provided
    if (options.siteTitle || options.tagline) {
      var brandingResult = _cleanupApiPut(site, '/branding', {
        site_title: options.siteTitle || null,
        tagline: options.tagline || null
      });
      if (brandingResult.success) {
        logSuccess('CLEANUP', 'Branding updated: ' + JSON.stringify(brandingResult.data.updated), site.id);
      } else {
        logWarning('CLEANUP', 'Branding update failed: ' + (brandingResult.error || 'Unknown'), site.id);
      }
    }

    // Flush cache after cleanup
    var cacheResult = _cleanupApiPost(site, '/flush-cache', {});
    if (cacheResult.success) {
      logInfo('CLEANUP', 'Cache flushed after cleanup', site.id);
    }
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Update site branding from Sites sheet data.
 *
 * @param {Object} site - Site object from getSiteById()
 * @param {Object} branding - Optional override { siteTitle, tagline }
 * @returns {Object} { success, data, error }
 */
function updateSiteBranding(site, branding) {
  branding = branding || {};

  // If no explicit branding, read from Sites sheet
  var siteTitle = branding.siteTitle || site.name || '';
  var tagline = branding.tagline || '';

  // Try to read additional columns from Sites sheet
  if (!branding.siteTitle || !branding.tagline) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sitesSheet = ss.getSheetByName('Sites');
      if (sitesSheet && site.rowIndex) {
        var headers = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];
        var row = sitesSheet.getRange(site.rowIndex, 1, 1, sitesSheet.getLastColumn()).getValues()[0];

        // Look for Site Title, Tagline columns
        var titleIdx = headers.indexOf('Site Title');
        if (titleIdx === -1) titleIdx = headers.indexOf('Brand Display Name');
        var taglineIdx = headers.indexOf('Tagline');

        if (!branding.siteTitle && titleIdx >= 0 && row[titleIdx]) {
          siteTitle = row[titleIdx];
        }
        if (!branding.tagline && taglineIdx >= 0 && row[taglineIdx]) {
          tagline = row[taglineIdx];
        }
      }
    } catch (e) {
      logWarning('CLEANUP', 'Could not read branding from Sites sheet: ' + e.message, site.id);
    }
  }

  logInfo('CLEANUP', 'Updating branding: "' + siteTitle + '" / "' + tagline + '"', site.id);

  var result = _cleanupApiPut(site, '/branding', {
    site_title: siteTitle,
    tagline: tagline
  });

  if (result.success) {
    logSuccess('CLEANUP', 'Branding updated for ' + site.domain, site.id);
  } else {
    logError('CLEANUP', 'Branding update failed: ' + (result.error || 'Unknown'), site.id);
  }

  return result;
}

/**
 * Get full site information (for launch report).
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} { success, data: { wp_version, site_title, ... }, error }
 */
function getSiteFullInfo(site) {
  logInfo('CLEANUP', 'Fetching site info: ' + site.domain, site.id);

  var result = _cleanupApiGet(site, '/site-info');

  if (result.success) {
    logSuccess('CLEANUP', 'Site info retrieved: ' + site.domain + ' (WP ' + result.data.wp_version + ', ' + result.data.counts.products + ' products)', site.id);
  } else {
    logError('CLEANUP', 'Failed to get site info: ' + (result.error || 'Unknown'), site.id);
  }

  return result;
}

/**
 * Add Google Search Console verification tag.
 *
 * @param {Object} site - Site object from getSiteById()
 * @param {string} verificationCode - GSC verification code
 * @returns {Object} { success, data, error }
 */
function addGSCVerification(site, verificationCode) {
  logInfo('CLEANUP', 'Adding GSC verification tag to ' + site.domain, site.id);

  var result = _cleanupApiPost(site, '/gsc-verify', {
    verification_code: verificationCode
  });

  if (result.success) {
    logSuccess('CLEANUP', 'GSC verification tag saved for ' + site.domain, site.id);
  } else {
    logError('CLEANUP', 'GSC verification failed: ' + (result.error || 'Unknown'), site.id);
  }

  return result;
}

/**
 * Add Bing Webmaster verification tag.
 *
 * @param {Object} site - Site object from getSiteById()
 * @param {string} verificationCode - Bing verification code
 * @returns {Object} { success, data, error }
 */
function addBingVerification(site, verificationCode) {
  logInfo('CLEANUP', 'Adding Bing verification tag to ' + site.domain, site.id);

  var result = _cleanupApiPost(site, '/bing-verify', {
    verification_code: verificationCode
  });

  if (result.success) {
    logSuccess('CLEANUP', 'Bing verification tag saved for ' + site.domain, site.id);
  } else {
    logError('CLEANUP', 'Bing verification failed: ' + (result.error || 'Unknown'), site.id);
  }

  return result;
}

// =============================================================================
// MENU DIALOG FUNCTIONS (called from Menu.gs)
// =============================================================================

/**
 * Site Cleanup Dialog — interactive cleanup with dry run preview
 */
function siteCleanupDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Site Cleanup', 'Podaj Site ID strony do wyczyszczenia:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var siteId = result.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) {
    ui.alert('Błąd', 'Nie znaleziono strony o ID: ' + siteId, ui.ButtonSet.OK);
    return;
  }

  // Dry run first
  var dryResult = cleanupClonedSite(site, { dryRun: true });
  if (!dryResult.success) {
    ui.alert('Błąd', 'Nie udało się sprawdzić strony: ' + (dryResult.error || 'Unknown error'), ui.ButtonSet.OK);
    return;
  }

  // Show what would be deleted
  var deleted = dryResult.data.deleted || {};
  var taxSummary = '';
  if (deleted.taxonomies) {
    var taxParts = [];
    for (var tax in deleted.taxonomies) {
      taxParts.push(tax + ': ' + deleted.taxonomies[tax]);
    }
    taxSummary = taxParts.join(', ');
  }

  var msg = 'Strona: ' + site.name + ' (' + site.domain + ')\n\n' +
    'Zostanie usunięte:\n' +
    '- Produkty WooCommerce: ' + (deleted.products || 0) + '\n' +
    '- Posty: ' + (deleted.posts || 0) + '\n' +
    '- WAAS Products (legacy): ' + (deleted.waas_products || 0) + '\n' +
    '- Taksonomie: ' + (taxSummary || 'brak') + '\n\n' +
    'Czas: ' + (dryResult.data.duration_seconds || '?') + 's\n\n' +
    'CZY NA PEWNO KONTYNUOWAĆ?';

  var confirm = ui.alert('Potwierdzenie', msg, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  // Execute real cleanup
  var cleanResult = cleanupClonedSite(site, { dryRun: false });
  if (cleanResult.success) {
    logSuccess('CLEANUP', 'Site cleaned: ' + JSON.stringify(cleanResult.data.deleted), site.id);
    ui.alert('Sukces', 'Strona wyczyszczona!\n\n' + JSON.stringify(cleanResult.data.deleted, null, 2), ui.ButtonSet.OK);
  } else {
    logError('CLEANUP', 'Cleanup failed: ' + (cleanResult.error || 'Unknown'), site.id);
    ui.alert('Błąd', 'Cleanup nie powiódł się: ' + (cleanResult.error || 'Unknown'), ui.ButtonSet.OK);
  }
}

/**
 * Site Info Dialog — displays full site information
 */
function siteInfoDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Site Info', 'Podaj Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var siteId = result.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) {
    ui.alert('Błąd', 'Nie znaleziono strony o ID: ' + siteId, ui.ButtonSet.OK);
    return;
  }

  var infoResult = getSiteFullInfo(site);
  if (!infoResult.success) {
    ui.alert('Błąd', 'Nie udało się pobrać informacji: ' + (infoResult.error || 'Unknown'), ui.ButtonSet.OK);
    return;
  }

  var info = infoResult.data;
  var pluginNames = (info.plugins || []).map(function(p) { return p.name + ' v' + p.version; }).join('\n  ');

  var msg =
    'Site: ' + info.site_title + '\n' +
    'URL: ' + info.url + '\n' +
    'Tagline: ' + info.tagline + '\n' +
    'WP Version: ' + info.wp_version + '\n' +
    'Admin Email: ' + info.admin_email + '\n\n' +
    'Theme: ' + info.theme.name + ' v' + info.theme.version + (info.theme.child ? ' (child: ' + info.theme.child + ')' : '') + '\n\n' +
    'Counts:\n' +
    '  Products: ' + info.counts.products + '\n' +
    '  Posts: ' + info.counts.posts + '\n' +
    '  Pages: ' + info.counts.pages + '\n' +
    '  Media: ' + info.counts.media + '\n' +
    '  WAAS Products (legacy): ' + info.counts.waas_products + '\n\n' +
    'WooCommerce: ' + (info.woocommerce.active ? 'Active' : 'Inactive') + '\n' +
    '  Currency: ' + (info.woocommerce.currency || 'N/A') + '\n' +
    '  Categories: ' + info.woocommerce.categories + '\n\n' +
    'SEO:\n' +
    '  RankMath: ' + (info.seo.rank_math_active ? 'Active' : 'Inactive') + '\n' +
    '  Sitemap: ' + info.seo.sitemap_url + '\n\n' +
    'WAAS:\n' +
    '  Partner Tag: ' + (info.waas.partner_tag || 'Not set') + '\n' +
    '  Product Manager: v' + (info.waas.product_manager_version || 'N/A') + '\n' +
    '  Settings: v' + info.waas.settings_version + '\n\n' +
    'Plugins:\n  ' + (pluginNames || 'None');

  ui.alert('Site Info: ' + info.site_title, msg, ui.ButtonSet.OK);
}

/**
 * Site Branding Dialog — updates site title and tagline from Sites sheet
 */
function siteBrandingDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Update Branding', 'Podaj Site ID:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var siteId = result.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) {
    ui.alert('Błąd', 'Nie znaleziono strony o ID: ' + siteId, ui.ButtonSet.OK);
    return;
  }

  // Ask for values or use defaults from sheet
  var titleResult = ui.prompt('Site Title', 'Site Title (puste = użyj z Sites sheet "' + site.name + '"):', ui.ButtonSet.OK_CANCEL);
  if (titleResult.getSelectedButton() !== ui.Button.OK) return;
  var siteTitle = titleResult.getResponseText().trim() || site.name;

  var tagResult = ui.prompt('Tagline', 'Tagline (puste = brak zmian):', ui.ButtonSet.OK_CANCEL);
  if (tagResult.getSelectedButton() !== ui.Button.OK) return;
  var tagline = tagResult.getResponseText().trim();

  var brandResult = updateSiteBranding(site, { siteTitle: siteTitle, tagline: tagline });
  if (brandResult.success) {
    ui.alert('Sukces', 'Branding zaktualizowany:\n  Title: ' + siteTitle + '\n  Tagline: ' + (tagline || '(bez zmian)'), ui.ButtonSet.OK);
  } else {
    ui.alert('Błąd', 'Branding update failed: ' + (brandResult.error || 'Unknown'), ui.ButtonSet.OK);
  }
}
