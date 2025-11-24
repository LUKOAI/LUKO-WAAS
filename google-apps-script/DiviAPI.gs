/**
 * WAAS Divi API Module
 * Integracja z Elegant Themes Divi API
 */

// =============================================================================
// DIVI API FUNCTIONS
// =============================================================================

function getDiviDownloadUrl(credentials) {
  try {
    // Elegant Themes API endpoint for product downloads
    // Uses POST method with API key and username in the body
    const apiUrl = 'https://www.elegantthemes.com/api/downloads';

    const payload = {
      'api_key': credentials.apiKey,
      'username': credentials.username,
      'product': 'Divi'
    };

    logInfo('DiviAPI', `Requesting Divi download URL from: ${apiUrl}`);

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('DiviAPI', `API response status: ${statusCode}`);

    if (statusCode === 200 && responseText) {
      // Try to parse as JSON first
      try {
        const data = JSON.parse(responseText);

        // Check various possible response formats
        if (data.download_url) {
          logSuccess('DiviAPI', 'Got Divi download URL from JSON response');
          return data.download_url;
        } else if (data.downloads && data.downloads.Divi) {
          logSuccess('DiviAPI', 'Got Divi download URL from downloads.Divi');
          return data.downloads.Divi;
        } else if (data.url) {
          logSuccess('DiviAPI', 'Got Divi download URL from url field');
          return data.url;
        } else if (typeof data === 'string' && data.startsWith('http')) {
          logSuccess('DiviAPI', 'Got Divi download URL as string');
          return data.trim();
        } else {
          logWarning('DiviAPI', `Unexpected JSON format: ${JSON.stringify(data)}`);
        }
      } catch (e) {
        // Not JSON, might be direct URL
        if (responseText.startsWith('http')) {
          logSuccess('DiviAPI', 'Got Divi download URL as plain text');
          return responseText.trim();
        }
      }
    }

    logError('DiviAPI', `API returned ${statusCode}: ${responseText.substring(0, 200)}`);
    logError('DiviAPI', `Credentials used - Username: ${credentials.username}, API Key: ${credentials.apiKey.substring(0, 10)}...`);
    throw new Error('Failed to get Divi download URL - check API credentials');
  } catch (error) {
    logError('DiviAPI', `Error getting download URL: ${error.message}`);
    throw error;
  }
}

function getDiviLayouts(credentials, category = '') {
  try {
    const apiUrl = 'https://www.elegantthemes.com/api/layouts/';

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey
      }
    });

    if (response.success && response.data) {
      let layouts = response.data;

      if (category) {
        layouts = layouts.filter(layout => layout.category === category);
      }

      return layouts;
    }

    return [];
  } catch (error) {
    logError('DiviAPI', `Error getting layouts: ${error.message}`);
    return [];
  }
}

function downloadDiviLayout(credentials, layoutId) {
  try {
    const apiUrl = `https://www.elegantthemes.com/api/layouts/${layoutId}`;

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error('Failed to download layout');
  } catch (error) {
    logError('DiviAPI', `Error downloading layout: ${error.message}`);
    throw error;
  }
}

function importDiviLayoutToSite(site, layoutData) {
  try {
    // Import layout do WordPress przez REST API
    const importUrl = `${site.wpUrl}/wp-json/divi/v1/layouts`;

    const response = makeHttpRequest(importUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(layoutData)
    });

    if (response.success) {
      logSuccess('DiviAPI', `Layout imported to site: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error importing layout: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// DIVI CLOUD INTEGRATION
// =============================================================================

function connectToDiviCloud(site, credentials) {
  try {
    logInfo('DiviAPI', `Connecting site to Divi Cloud: ${site.name}`, site.id);

    // Connect site to Divi Cloud dashboard
    const connectUrl = 'https://www.elegantthemes.com/api/cloud/connect';

    const response = makeHttpRequest(connectUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        site_url: site.wpUrl,
        site_name: site.name
      })
    });

    if (response.success) {
      logSuccess('DiviAPI', `Site connected to Divi Cloud: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error connecting to Divi Cloud: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// DIVI THEME HELPERS
// =============================================================================

function getDiviThemeOptions() {
  return {
    // Default Divi theme options
    'et_divi': {
      'logo': '',
      'fixed_nav': 'on',
      'divi_fixed_nav': 'on',
      'divi_smooth_scroll': 'on',
      'divi_back_to_top': 'on',
      'divi_minify_combine_styles': 'on',
      'divi_minify_combine_scripts': 'on',
      'divi_defer_jquery': 'on'
    }
  };
}

function applyDiviThemeOptions(site, options) {
  try {
    const updateUrl = `${site.wpUrl}/wp-json/wp/v2/options`;

    const response = makeHttpRequest(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(options)
    });

    if (response.success) {
      logSuccess('DiviAPI', `Divi options applied to: ${site.name}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('DiviAPI', `Error applying Divi options: ${error.message}`, site.id);
    return false;
  }
}
