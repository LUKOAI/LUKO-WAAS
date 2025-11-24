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
        adminUser: data[i][4],
        adminPass: data[i][5],
        diviApiUsername: data[i][6],   // COLUMN 7: Per-site Divi username
        diviApiKey: data[i][7],         // COLUMN 8: Per-site Divi API key
        partnerTag: data[i][8],         // COLUMN 9: Per-site Amazon Partner Tag
        status: data[i][9],
        diviInstalled: data[i][10],
        pluginInstalled: data[i][11],
        lastCheck: data[i][12],
        createdDate: data[i][13],
        notes: data[i][14],
        appPassword: data[i][15],       // COLUMN 16: Application Password (auto-created)
        authType: data[i][16],          // COLUMN 17: Auth type (application_password, basic_auth_plugin, basic_auth_legacy)
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

  // Aktualizuj status (kolumna 10)
  sheet.getRange(row, 10).setValue(status);

  // Aktualizuj last check (kolumna 13)
  sheet.getRange(row, 13).setValue(new Date());

  // Aktualizuj dodatkowe pola
  if (updates.diviApiUsername !== undefined) {
    sheet.getRange(row, 7).setValue(updates.diviApiUsername);
  }
  if (updates.diviApiKey !== undefined) {
    sheet.getRange(row, 8).setValue(updates.diviApiKey);
  }
  if (updates.partnerTag !== undefined) {
    sheet.getRange(row, 9).setValue(updates.partnerTag);
  }
  if (updates.diviInstalled !== undefined) {
    sheet.getRange(row, 11).setValue(updates.diviInstalled);
  }
  if (updates.pluginInstalled !== undefined) {
    sheet.getRange(row, 12).setValue(updates.pluginInstalled);
  }
  if (updates.notes !== undefined) {
    sheet.getRange(row, 15).setValue(updates.notes);
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
    logInfo('SiteManager', `Checking WordPress availability: ${site.wpUrl}`, site.id);

    // Use retry logic for better resilience against transient network issues
    const response = makeHttpRequestWithRetry(site.wpUrl + '/wp-json/', {}, 3, 2000);

    if (response.success) {
      logSuccess('SiteManager', 'WordPress site is accessible', site.id);
      return { available: true };
    } else {
      // Build detailed error message
      let errorMsg = '';

      if (response.statusCode) {
        errorMsg = `HTTP ${response.statusCode}: ${response.error}`;
      } else if (response.errorType) {
        // Network/DNS error without HTTP status code
        errorMsg = response.error;

        // Add specific troubleshooting tips based on error type
        if (response.errorType === 'DNS_ERROR') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Verify the domain exists and is properly configured\n' +
                     '• Check if DNS has propagated (use tools like dnschecker.org)\n' +
                     '• Ensure the domain/subdomain is correctly set in the Sites sheet\n' +
                     '• If this is a new domain, wait 24-48 hours for DNS propagation';
        } else if (response.errorType === 'TIMEOUT') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Server may be slow or under heavy load\n' +
                     '• Check server resources (CPU, memory, bandwidth)\n' +
                     '• Verify firewall/security settings aren\'t blocking requests';
        } else if (response.errorType === 'CONNECTION_ERROR') {
          errorMsg += '\n\nTroubleshooting:\n' +
                     '• Server may be down or unreachable\n' +
                     '• Check if WordPress is running\n' +
                     '• Verify hosting provider status';
        }
      } else {
        errorMsg = response.error || 'Unknown error occurred';
      }

      logError('SiteManager', `WordPress site not accessible: ${errorMsg}`, site.id);

      return {
        available: false,
        error: errorMsg,
        errorType: response.errorType,
        statusCode: response.statusCode
      };
    }
  } catch (error) {
    logError('SiteManager', `Unexpected error checking WordPress availability: ${error.message}`, site.id);
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
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

    // 1. Pobierz Divi przez API Elegant Themes (using per-site credentials)
    const diviPackage = downloadDiviPackage(site);
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

    // 4. Aktywuj licencję Divi
    logInfo('SiteManager', 'Activating Divi license...', siteId);
    const licenseActivated = activateDiviLicense(site);
    if (licenseActivated) {
      logSuccess('SiteManager', 'Divi license activation completed', siteId);
    } else {
      logWarning('SiteManager', 'Divi license activation failed or needs manual verification', siteId);
    }

    // 5. Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      diviInstalled: 'Yes',
      notes: licenseActivated
        ? 'Divi installed, activated, and license activated successfully'
        : 'Divi installed and activated - license activation may need manual verification'
    });

    logSuccess('SiteManager', `Divi installed successfully on: ${site.name}`, siteId);

    const resultMessage = licenseActivated
      ? 'Divi installed, activated, and license activated successfully'
      : 'Divi installed and activated - license activation may need manual verification';

    const alertMessage = licenseActivated
      ? `Divi has been installed, activated, and license has been activated on ${site.name}`
      : `Divi has been installed and activated on ${site.name}\n\nPlease verify license activation manually at:\n${site.wpUrl}/wp-admin/admin.php?page=et_onboarding#/overview`;

    // Only show alert if called directly (not from automation)
    try {
      SpreadsheetApp.getUi().alert(
        'Success',
        alertMessage,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      // UI not available (called from automation), skip alert
    }

    return {
      success: true,
      message: resultMessage,
      licenseActivated: licenseActivated
    };
  } catch (error) {
    const errorMessage = error.message || 'Unknown error during Divi installation';
    handleError(error, 'SiteManager.installDiviOnSite', siteId);
    return {
      success: false,
      message: errorMessage,
      licenseActivated: false
    };
  }
}

function downloadDiviPackage(site) {
  try {
    logInfo('DiviAPI', `Downloading Divi package for site: ${site.name}`, site.id);

    // Pobierz link do pobrania Divi (z DIVI_DOWNLOAD_URL lub fallback credentials)
    let downloadUrl;
    try {
      // Try to get credentials (may fail if not configured, which is OK if DIVI_DOWNLOAD_URL is set)
      const creds = getDiviCredentialsForSite(site);
      downloadUrl = getDiviDownloadUrl(creds);
    } catch (credError) {
      // If credentials fail, try getDiviDownloadUrl without credentials
      // It will use DIVI_DOWNLOAD_URL if configured
      logInfo('DiviAPI', 'No Divi credentials available, checking for DIVI_DOWNLOAD_URL...', site.id);
      downloadUrl = getDiviDownloadUrl({username: '', apiKey: ''});
    }

    if (!downloadUrl) {
      return null;
    }

    logInfo('DiviAPI', `Download URL: ${downloadUrl}`, site.id);

    // Retry logic: try up to 3 times
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logInfo('DiviAPI', `Download attempt ${attempt}/${maxRetries}...`, site.id);

        // Fetch with proper headers to avoid being blocked by web servers
        const response = UrlFetchApp.fetch(downloadUrl, {
          method: 'GET',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/zip,application/octet-stream,*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          }
        });

        const statusCode = response.getResponseCode();
        logInfo('DiviAPI', `HTTP Response: ${statusCode}`, site.id);

        if (statusCode === 200) {
          const blob = response.getBlob();
          const fileSize = blob.getBytes().length;

          logSuccess('DiviAPI', `Divi package downloaded successfully (${(fileSize / 1024 / 1024).toFixed(2)} MB)`, site.id);
          return blob;
        } else if (statusCode === 403) {
          // 403 Forbidden - likely web server configuration issue
          const responseText = response.getContentText();
          logError('DiviAPI', `403 Forbidden - Server is blocking access to the file`, site.id);
          logError('DiviAPI', `Server response: ${responseText.substring(0, 200)}`, site.id);
          logError('DiviAPI', ``, site.id);
          logError('DiviAPI', `📋 TROUBLESHOOTING 403 FORBIDDEN:`, site.id);
          logError('DiviAPI', `1. Check web server configuration (not file permissions)`, site.id);
          logError('DiviAPI', `2. Ensure directory allows public access (.htaccess, nginx config, etc.)`, site.id);
          logError('DiviAPI', `3. Try accessing the URL directly in a browser`, site.id);
          logError('DiviAPI', `4. RECOMMENDED: Use alternative hosting (AWS S3, Dropbox, Google Drive)`, site.id);
          logError('DiviAPI', ``, site.id);

          throw new Error(`403 Forbidden - Web server blocking access. The file permissions may be correct (755), but the web server (openresty) is configured to deny access. Please use alternative hosting or reconfigure your web server.`);
        } else if (statusCode === 404) {
          throw new Error(`404 Not Found - File does not exist at: ${downloadUrl}`);
        } else if (statusCode >= 500) {
          // Server error - might be temporary, retry
          lastError = new Error(`Server error ${statusCode} - Retrying...`);
          logWarning('DiviAPI', lastError.message, site.id);

          if (attempt < maxRetries) {
            Utilities.sleep(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
            continue;
          }
        } else {
          throw new Error(`Unexpected HTTP status: ${statusCode}`);
        }
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && !error.message.includes('403') && !error.message.includes('404')) {
          logWarning('DiviAPI', `Attempt ${attempt} failed: ${error.message}. Retrying...`, site.id);
          Utilities.sleep(2000 * attempt); // Exponential backoff
          continue;
        } else {
          throw error; // Don't retry on 403/404 or final attempt
        }
      }
    }

    throw lastError || new Error('Download failed after all retry attempts');
  } catch (error) {
    logError('DiviAPI', `Failed to download Divi: ${error.message}`, site.id);
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
    // First, try to get custom plugin URL from Script Properties (preferred method)
    const scriptProperties = PropertiesService.getScriptProperties();
    const customPluginUrl = scriptProperties.getProperty('PRODUCT_MANAGER_DOWNLOAD_URL');

    if (customPluginUrl) {
      logInfo('PluginManager', `Trying custom download URL: ${customPluginUrl}`);

      try {
        const response = UrlFetchApp.fetch(customPluginUrl, {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          const blob = response.getBlob();
          logSuccess('PluginManager', `Plugin package downloaded successfully from custom URL (${(blob.getBytes().length / 1024).toFixed(2)} KB)`);
          return blob;
        } else {
          logWarning('PluginManager', `Custom URL returned ${statusCode}, trying GitHub fallback...`);
        }
      } catch (e) {
        logWarning('PluginManager', `Custom URL failed: ${e.message}, trying GitHub fallback...`);
      }
    }

    // Fallback: GitHub repository URL for WAAS Product Manager plugin
    // Trying multiple possible repository names
    const possibleRepos = [
      'https://github.com/LUKOAI/luko-amazon-affiliate-manager',
      'https://github.com/LUKOAI/LukoAmazonAffiliateManager',
      'https://github.com/LUKOAI/LUKO-WAAS'
    ];

    for (const repoUrl of possibleRepos) {
      const downloadUrl = `${repoUrl}/archive/refs/heads/main.zip`;

      logInfo('PluginManager', `Trying to download plugin from: ${downloadUrl}`);

      try {
        const response = UrlFetchApp.fetch(downloadUrl, {
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          const blob = response.getBlob();
          logSuccess('PluginManager', `Plugin package downloaded successfully from: ${repoUrl}`);
          return blob;
        } else {
          logInfo('PluginManager', `${repoUrl} returned ${statusCode}, trying next...`);
        }
      } catch (e) {
        logInfo('PluginManager', `Failed to fetch ${repoUrl}: ${e.message}`);
      }
    }

    // If all methods failed, log and return null
    logError('PluginManager', 'Plugin download failed from all repository URLs');
    logWarning('PluginManager', 'Repository may not exist yet or plugin is not published');
    logInfo('PluginManager', 'Skipping plugin installation - will continue with other setup steps');
    logInfo('PluginManager', '');
    logInfo('PluginManager', '📋 TO FIX THIS ISSUE:');
    logInfo('PluginManager', '1. Upload waas-product-manager.zip to a web-accessible location (e.g., lk24.shop/downloads/)');
    logInfo('PluginManager', '2. Set Script Property: PRODUCT_MANAGER_DOWNLOAD_URL = https://your-domain.com/path/to/waas-product-manager.zip');
    logInfo('PluginManager', '3. Alternatively, make GitHub repository public or provide GitHub token');
    logInfo('PluginManager', '');
    return null;

  } catch (error) {
    logError('PluginManager', `Failed to download plugin: ${error.message}`);
    return null;
  }
}

// =============================================================================
// INSTALACJA WOOCOMMERCE
// =============================================================================

function installWooCommerceOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    logInfo('SiteManager', `Installing WooCommerce on site: ${site.name}`, siteId);

    // 1. Zainstaluj i aktywuj WooCommerce z WordPress.org repository
    // Note: installWooCommercePlugin already activates the plugin (status:'active')
    const installed = installWooCommercePlugin(site);
    if (!installed) {
      throw new Error('Failed to install WooCommerce');
    }

    // 3. Konfiguruj podstawowe ustawienia WooCommerce
    const configured = configureWooCommerce(site);
    if (!configured) {
      logWarning('SiteManager', 'WooCommerce installed but configuration may need manual review', siteId);
    }

    // 4. Aktualizuj status w Google Sheets (dodamy nową kolumnę)
    updateSiteStatus(siteId, 'Active', {
      notes: 'WooCommerce installed and activated'
    });

    logSuccess('SiteManager', `WooCommerce installed successfully on: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Success',
      `WooCommerce has been installed and activated on ${site.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.installWooCommerceOnSite', siteId);
    return false;
  }
}

function installWooCommercePlugin(site) {
  try {
    logInfo('WooCommerce', 'Installing WooCommerce plugin from WordPress.org');

    // Use authenticated request helper that handles auth automatically
    const result = makeAuthenticatedRequest(site, 'wp/v2/plugins', {
      method: 'post',
      payload: {
        slug: 'woocommerce',
        status: 'active'
      }
    });

    if (result.success) {
      logSuccess('WooCommerce', 'WooCommerce plugin installed and activated');
      return true;
    } else if (result.statusCode === 500 && result.data && result.data.code === 'folder_exists') {
      // WooCommerce is already installed, just activate it
      logInfo('WooCommerce', 'WooCommerce already installed, attempting to activate...');

      const activateResult = makeAuthenticatedRequest(site, 'wp/v2/plugins/woocommerce/woocommerce', {
        method: 'post',
        payload: {
          status: 'active'
        }
      });

      if (activateResult.success) {
        logSuccess('WooCommerce', 'WooCommerce plugin activated');
        return true;
      } else {
        logWarning('WooCommerce', `Activation returned ${activateResult.statusCode}, but WooCommerce may already be active`);
        // Return true anyway - if it's installed, that's good enough
        return true;
      }
    } else {
      logError('WooCommerce', `Installation failed with status: ${result.statusCode}`);
      logError('WooCommerce', `Response: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    logError('WooCommerce', `Failed to install WooCommerce: ${error.message}`);
    return false;
  }
}

function configureWooCommerce(site) {
  try {
    logInfo('WooCommerce', 'Configuring WooCommerce basic settings');

    // Use authenticated request helper
    const result = makeAuthenticatedRequest(site, 'wc/v3/settings/general/batch', {
      method: 'post',
      payload: {
        update: [
          {
            id: 'woocommerce_store_address',
            value: ''
          },
          {
            id: 'woocommerce_currency',
            value: 'EUR'
          },
          {
            id: 'woocommerce_enable_guest_checkout',
            value: 'no'  // Dla affiliate nie potrzebujemy checkout
          }
        ]
      }
    });

    if (result.success) {
      logSuccess('WooCommerce', 'WooCommerce configured');
      return true;
    } else {
      logWarning('WooCommerce', `Configuration returned status: ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logWarning('WooCommerce', `Configuration may need manual review: ${error.message}`);
    return false;
  }
}

function checkWooCommerceInstallation(site) {
  try {
    // Sprawdź czy WooCommerce jest aktywny
    const response = makeHttpRequest(
      `${site.wpUrl}/wp-json/wp/v2/plugins`,
      {
        headers: {
          'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
        }
      }
    );

    if (response.success && response.data) {
      const plugins = response.data;
      return plugins.some(plugin =>
        plugin.plugin.includes('woocommerce') &&
        plugin.status === 'active'
      );
    }

    return false;
  } catch (error) {
    logWarning('SiteManager', `Could not check WooCommerce installation: ${error.message}`, site.id);
    return false;
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
    if (data[i][9] === 'Active') {  // Updated index for Status (column 10)
      sites.push({
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        adminUser: data[i][4],
        adminPass: data[i][5],
        diviApiUsername: data[i][6],
        diviApiKey: data[i][7],
        partnerTag: data[i][8]  // Per-site Amazon Partner Tag
      });
    }
  }

  return sites;
}
