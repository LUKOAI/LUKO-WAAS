/**
 * WAAS Divi API Module
 * Integracja z Elegant Themes Divi API
 */

// =============================================================================
// DIVI API FUNCTIONS
// =============================================================================

function getDiviDownloadUrl(credentials) {
  try {
    // Check if custom Divi download URL is configured (recommended approach)
    const scriptProperties = PropertiesService.getScriptProperties();
    const customDiviUrl = scriptProperties.getProperty('DIVI_DOWNLOAD_URL');

    if (customDiviUrl) {
      logSuccess('DiviAPI', `Using custom Divi download URL from Script Properties`);
      return customDiviUrl;
    }

    logInfo('DiviAPI', 'No custom DIVI_DOWNLOAD_URL configured, trying Elegant Themes API endpoints...');

    // Elegant Themes API - trying multiple possible endpoints
    // Note: ET may not have a public download API, might require manual download
    const apiEndpoints = [
      'https://www.elegantthemes.com/api/downloads',
      'https://www.elegantthemes.com/api/product/download',
      'https://www.elegantthemes.com/api/account/downloads'
    ];

    for (const apiUrl of apiEndpoints) {
      logInfo('DiviAPI', `Trying endpoint: ${apiUrl}`);

      const payload = {
        'api_key': credentials.apiKey,
        'username': credentials.username,
        'product': 'Divi'
      };

      try {
        const response = UrlFetchApp.fetch(apiUrl, {
          method: 'POST',
          contentType: 'application/x-www-form-urlencoded',
          payload: payload,
          muteHttpExceptions: true,
          followRedirects: true
        });

        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        logInfo('DiviAPI', `Response status: ${statusCode}`);

        if (statusCode === 200 && responseText && !responseText.includes('<!doctype html>')) {
          // Try to parse as JSON first
          try {
            const data = JSON.parse(responseText);

            // Check various possible response formats
            if (data.download_url) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.download_url;
            } else if (data.downloads && data.downloads.Divi) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.downloads.Divi;
            } else if (data.url) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.url;
            } else if (typeof data === 'string' && data.startsWith('http')) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return data.trim();
            }
          } catch (e) {
            // Not JSON, might be direct URL
            if (responseText.startsWith('http')) {
              logSuccess('DiviAPI', `Got Divi download URL from: ${apiUrl}`);
              return responseText.trim();
            }
          }
        } else if (statusCode === 404) {
          logInfo('DiviAPI', `Endpoint ${apiUrl} not found, trying next...`);
        }
      } catch (e) {
        logInfo('DiviAPI', `Failed to fetch ${apiUrl}: ${e.message}`);
      }
    }

    // All endpoints failed
    logError('DiviAPI', 'Failed to get Divi download URL from all API endpoints');
    if (credentials && credentials.username && credentials.apiKey) {
      logError('DiviAPI', `Credentials used - Username: ${credentials.username}, API Key: ${credentials.apiKey.substring(0, 10)}...`);
    }
    logWarning('DiviAPI', 'Elegant Themes does not provide a public download API');
    logInfo('DiviAPI', '');
    logInfo('DiviAPI', '📋 RECOMMENDED SOLUTION:');
    logInfo('DiviAPI', '1. Download Divi theme ZIP from elegantthemes.com');
    logInfo('DiviAPI', '2. Upload it to your private storage (AWS S3, Google Cloud Storage, Dropbox, etc.)');
    logInfo('DiviAPI', '3. Set DIVI_DOWNLOAD_URL in Script Properties to your storage URL');
    logInfo('DiviAPI', '4. Automation will then download Divi automatically from your URL');
    logInfo('DiviAPI', '');
    logInfo('DiviAPI', '📖 See detailed hosting guide: docs/DIVI_HOSTING_GUIDE.md');
    logInfo('DiviAPI', '');
    throw new Error('Divi download not available. Please configure DIVI_DOWNLOAD_URL in Script Properties with your own hosted Divi ZIP URL. See docs/DIVI_HOSTING_GUIDE.md for detailed instructions.');
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
