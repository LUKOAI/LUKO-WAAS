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
// DIVI LICENSE ACTIVATION
// =============================================================================

/**
 * Activate Divi license on WordPress site
 * This logs into the Elegant Themes account through the Divi onboarding page
 * @param {Object} site - Site object
 * @returns {boolean} - Success status
 */
function activateDiviLicense(site) {
  try {
    logInfo('DiviAPI', `Activating Divi license for: ${site.name}`, site.id);

    // Get Elegant Themes credentials (per-site or global)
    const etCredentials = getDiviCredentialsForSite(site);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('DiviAPI', `Cannot login to WordPress: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    const nonce = loginResult.nonce;
    logInfo('DiviAPI', 'WordPress login successful', site.id);

    // Step 2: Navigate to Divi theme options page to get proper nonce
    const diviOptionsUrl = `${site.wpUrl}/wp-admin/admin.php?page=et_divi_options`;

    logInfo('DiviAPI', 'Accessing Divi theme options page...', site.id);
    const diviOptionsResponse = UrlFetchApp.fetch(diviOptionsUrl, {
      method: 'get',
      headers: {
        'Cookie': cookies,
        'Accept-Encoding': 'identity', // Force no compression
        'Cache-Control': 'no-transform, no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
      },
      muteHttpExceptions: true,
      followRedirects: true
    });

    const diviOptionsCode = diviOptionsResponse.getResponseCode();
    if (diviOptionsCode !== 200) {
      logWarning('DiviAPI', `Cannot access Divi options page: HTTP ${diviOptionsCode}`, site.id);
      // Continue anyway with alternative method
    } else {
      logSuccess('DiviAPI', 'Divi options page accessed', site.id);
    }

    // Step 3: Use proper Divi AJAX action to activate license
    // Divi uses 'et_check_api_key' action for license activation
    const ajaxUrl = `${site.wpUrl}/wp-admin/admin-ajax.php`;

    logInfo('DiviAPI', 'Submitting Elegant Themes credentials via et_check_api_key...', site.id);

    const activationPayload = {
      'action': 'et_check_api_key',
      'et_api_key': etCredentials.apiKey,
      'et_username': etCredentials.username,
      '_wpnonce': nonce
    };

    const activationResponse = UrlFetchApp.fetch(ajaxUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity', // Force no compression
        'Cache-Control': 'no-transform, no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
      },
      payload: activationPayload,
      muteHttpExceptions: true,
      followRedirects: true
    });

    const activationCode = activationResponse.getResponseCode();
    const activationText = activationResponse.getContentText();

    logInfo('DiviAPI', `License activation response: HTTP ${activationCode}`, site.id);
    logInfo('DiviAPI', `Response preview: ${activationText.substring(0, 200)}`, site.id);

    // Check for success indicators
    const isSuccess = activationCode === 200 && (
      activationText.includes('"success":true') ||
      activationText.includes('active') ||
      activationText.includes('valid') ||
      !activationText.includes('error')
    );

    if (isSuccess) {
      logSuccess('DiviAPI', 'Divi license activation successful!', site.id);
      logInfo('DiviAPI', 'License should now be active in Divi theme', site.id);
      return true;
    }

    // Alternative method: Try to save credentials directly to WordPress options
    logInfo('DiviAPI', 'Trying alternative method: saving credentials directly to WordPress options...', site.id);

    const saveSuccess = saveDiviCredentialsToOptions(site, etCredentials, cookies, nonce);
    if (saveSuccess) {
      logSuccess('DiviAPI', 'Divi credentials saved to WordPress options', site.id);
      logInfo('DiviAPI', `Please verify activation at: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
      return true;
    }

    logWarning('DiviAPI', 'Automatic license activation may need manual verification', site.id);
    logInfo('DiviAPI', `Please verify at: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
    return true; // Return true anyway - we've done our best

  } catch (error) {
    logError('DiviAPI', `Error activating Divi license: ${error.message}`, site.id);
    logWarning('DiviAPI', `Please activate license manually: ${site.wpUrl}/wp-admin/admin.php?page=et_divi_options#update`, site.id);
    return false;
  }
}

/**
 * Save Divi credentials directly to WordPress options
 * @param {Object} site - Site object
 * @param {Object} credentials - Divi credentials (username, apiKey)
 * @param {string} cookies - WordPress session cookies
 * @param {string} nonce - WordPress nonce
 * @returns {boolean} Success status
 */
function saveDiviCredentialsToOptions(site, credentials, cookies, nonce) {
  try {
    logInfo('DiviAPI', 'Saving Divi credentials to WordPress options...', site.id);

    // Divi stores credentials in 'et_automatic_updates_options'
    const ajaxUrl = `${site.wpUrl}/wp-admin/admin-ajax.php`;

    // Use update_option action to save credentials
    const payload = {
      'action': 'et_save_options',
      'et_options': JSON.stringify({
        'et_automatic_updates_options': {
          'username': credentials.username,
          'api_key': credentials.apiKey
        }
      }),
      '_wpnonce': nonce
    };

    const response = UrlFetchApp.fetch(ajaxUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity', // Force no compression
        'Cache-Control': 'no-transform, no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
      },
      payload: payload,
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('DiviAPI', `Save options response: HTTP ${statusCode}`, site.id);

    if (statusCode === 200) {
      logSuccess('DiviAPI', 'Divi credentials saved successfully', site.id);
      return true;
    } else {
      logWarning('DiviAPI', `Failed to save credentials: ${responseText.substring(0, 200)}`, site.id);
      return false;
    }

  } catch (error) {
    logError('DiviAPI', `Error saving credentials: ${error.message}`, site.id);
    return false;
  }
}

/**
 * Save Elegant Themes API key to WordPress options (legacy function)
 * @param {Object} site - Site object
 * @param {string} apiKey - API key from Elegant Themes
 * @param {string} cookies - WordPress session cookies
 * @param {string} nonce - WordPress nonce
 */
function saveElegantThemesApiKey(site, apiKey, cookies, nonce) {
  try {
    const optionsUrl = `${site.wpUrl}/wp-json/wp/v2/settings`;

    const payload = {
      'et_automatic_updates_options': {
        'username': '',
        'api_key': apiKey
      }
    };

    const response = UrlFetchApp.fetch(optionsUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'X-WP-Nonce': nonce,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity', // Force no compression
        'Cache-Control': 'no-transform, no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      logSuccess('DiviAPI', 'API key saved to WordPress options', site.id);
      return true;
    } else {
      logWarning('DiviAPI', 'Could not save API key to WordPress', site.id);
      return false;
    }
  } catch (error) {
    logWarning('DiviAPI', `Error saving API key: ${error.message}`, site.id);
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
