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
    const response = makeHttpRequest(site.wpUrl + '/wp-json/');

    if (response.success) {
      return { available: true };
    } else {
      return {
        available: false,
        error: `HTTP ${response.statusCode}: ${response.error}`
      };
    }
  } catch (error) {
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

    // 4. Aktualizuj status
    updateSiteStatus(siteId, 'Active', {
      diviInstalled: 'Yes',
      notes: 'Divi installed and activated successfully'
    });

    logSuccess('SiteManager', `Divi installed successfully on: ${site.name}`, siteId);

    SpreadsheetApp.getUi().alert(
      'Success',
      `Divi has been installed and activated on ${site.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    handleError(error, 'SiteManager.installDiviOnSite', siteId);
    return false;
  }
}

function downloadDiviPackage(site) {
  try {
    const creds = getDiviCredentialsForSite(site);
    logInfo('DiviAPI', `Downloading Divi package for site: ${site.name}`, site.id);

    // Pobierz link do pobrania Divi
    const downloadUrl = getDiviDownloadUrl(creds);
    if (!downloadUrl) {
      return null;
    }

    // Pobierz plik
    const response = UrlFetchApp.fetch(downloadUrl);
    const blob = response.getBlob();

    logSuccess('DiviAPI', `Divi package downloaded for: ${site.name}`, site.id);
    return blob;
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
    // GitHub repository URL for WAAS Product Manager plugin
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

    // If all repos failed, log and return null
    logError('PluginManager', 'Plugin download failed from all repository URLs');
    logWarning('PluginManager', 'Repository may not exist yet or plugin is not published');
    logInfo('PluginManager', 'Skipping plugin installation - will continue with other setup steps');
    logInfo('PluginManager', 'To fix: Ensure plugin repository exists at one of the tried URLs');
    return null;

  } catch (error) {
    logError('PluginManager', `Failed to download plugin: ${error.message}`);
    logInfo('PluginManager', 'To fix: Create the GitHub repository or provide direct plugin ZIP URL');
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
