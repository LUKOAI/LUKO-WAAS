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
        username: data[i][4],
        password: data[i][5],
        status: data[i][6],
        diviInstalled: data[i][7],
        pluginInstalled: data[i][8],
        lastCheck: data[i][9],
        createdDate: data[i][10],
        notes: data[i][11],
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

  // Aktualizuj status
  sheet.getRange(row, 7).setValue(status);

  // Aktualizuj last check
  sheet.getRange(row, 10).setValue(new Date());

  // Aktualizuj dodatkowe pola
  if (updates.diviInstalled !== undefined) {
    sheet.getRange(row, 8).setValue(updates.diviInstalled);
  }
  if (updates.pluginInstalled !== undefined) {
    sheet.getRange(row, 9).setValue(updates.pluginInstalled);
  }
  if (updates.notes !== undefined) {
    sheet.getRange(row, 12).setValue(updates.notes);
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password)
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
          'Authorization': 'Basic ' + Utilities.base64Encode(site.username + ':' + site.password)
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

    // 1. Pobierz Divi przez API Elegant Themes
    const diviPackage = downloadDiviPackage();
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

function downloadDiviPackage() {
  try {
    const creds = getDiviCredentials();
    logInfo('DiviAPI', 'Downloading Divi package');

    // Pobierz link do pobrania Divi
    const downloadUrl = getDiviDownloadUrl(creds);
    if (!downloadUrl) {
      return null;
    }

    // Pobierz plik
    const response = UrlFetchApp.fetch(downloadUrl);
    const blob = response.getBlob();

    logSuccess('DiviAPI', 'Divi package downloaded');
    return blob;
  } catch (error) {
    logError('DiviAPI', `Failed to download Divi: ${error.message}`);
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
    const repoUrl = 'https://github.com/LUKOAI/-LukoAmazonAffiliateManager';
    const downloadUrl = `${repoUrl}/archive/refs/heads/main.zip`;

    logInfo('PluginManager', 'Downloading plugin from GitHub');

    const response = UrlFetchApp.fetch(downloadUrl);
    const blob = response.getBlob();

    logSuccess('PluginManager', 'Plugin package downloaded');
    return blob;
  } catch (error) {
    logError('PluginManager', `Failed to download plugin: ${error.message}`);
    return null;
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
    if (data[i][6] === 'Active') {
      sites.push({
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        username: data[i][4],
        password: data[i][5]
      });
    }
  }

  return sites;
}
