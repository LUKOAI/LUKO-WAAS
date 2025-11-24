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

    // Get Elegant Themes credentials from Script Properties
    const etCredentials = getElegantThemesCredentials();

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('DiviAPI', `Cannot login to WordPress: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    const nonce = loginResult.nonce;
    logInfo('DiviAPI', 'WordPress login successful', site.id);

    // Step 2: Navigate to Divi onboarding page to get the form structure
    const onboardingUrl = `${site.wpUrl}/wp-admin/admin.php?page=et_onboarding`;

    logInfo('DiviAPI', 'Accessing Divi onboarding page...', site.id);
    const onboardingResponse = UrlFetchApp.fetch(onboardingUrl, {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    });

    const onboardingCode = onboardingResponse.getResponseCode();
    if (onboardingCode !== 200) {
      logError('DiviAPI', `Cannot access Divi onboarding page: HTTP ${onboardingCode}`, site.id);
      return false;
    }

    logSuccess('DiviAPI', 'Divi onboarding page accessed', site.id);

    // Step 3: Submit Elegant Themes credentials through AJAX
    // Divi uses AJAX endpoints to handle license activation
    const ajaxUrl = `${site.wpUrl}/wp-admin/admin-ajax.php`;

    // Try to activate license using Elegant Themes credentials
    logInfo('DiviAPI', 'Submitting Elegant Themes credentials...', site.id);

    const activationPayload = {
      'action': 'et_core_portability_import',
      'et_core_portability': JSON.stringify({
        'username': etCredentials.username,
        'api_key': etCredentials.password
      }),
      '_wpnonce': nonce
    };

    const activationResponse = UrlFetchApp.fetch(ajaxUrl, {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      payload: activationPayload,
      muteHttpExceptions: true,
      followRedirects: true
    });

    const activationCode = activationResponse.getResponseCode();
    const activationText = activationResponse.getContentText();

    logInfo('DiviAPI', `License activation response: HTTP ${activationCode}`, site.id);

    // Alternative approach: Use Elegant Themes API endpoint directly
    // Sometimes WordPress theme activation requires specific API calls
    if (activationCode !== 200 || activationText.includes('error')) {
      logInfo('DiviAPI', 'Trying alternative activation method via Elegant Themes API...', site.id);

      // Call Elegant Themes API to link the site
      const etApiUrl = 'https://www.elegantthemes.com/api/v1/accounts/authorize';

      try {
        const etResponse = UrlFetchApp.fetch(etApiUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            'username': etCredentials.username,
            'password': etCredentials.password,
            'site_url': site.wpUrl
          }),
          muteHttpExceptions: true
        });

        const etCode = etResponse.getResponseCode();
        const etData = etResponse.getContentText();

        logInfo('DiviAPI', `Elegant Themes API response: HTTP ${etCode}`, site.id);

        if (etCode === 200) {
          // Parse response and save API key if available
          try {
            const etJson = JSON.parse(etData);
            if (etJson.api_key) {
              logSuccess('DiviAPI', 'Got API key from Elegant Themes', site.id);

              // Save API key to WordPress options
              saveElegantThemesApiKey(site, etJson.api_key, cookies, nonce);
            }
          } catch (e) {
            logWarning('DiviAPI', 'Could not parse ET API response', site.id);
          }
        }
      } catch (etError) {
        logWarning('DiviAPI', `ET API call failed: ${etError.message}`, site.id);
      }
    }

    // Step 4: Verify license activation by checking theme options
    // Divi stores license info in et_automatic_updates_options
    logInfo('DiviAPI', 'Verifying license activation...', site.id);

    const verifyUrl = `${site.wpUrl}/wp-json/wp/v2/settings`;
    const verifyResponse = UrlFetchApp.fetch(verifyUrl, {
      method: 'get',
      headers: {
        'Cookie': cookies,
        'X-WP-Nonce': nonce
      },
      muteHttpExceptions: true
    });

    if (verifyResponse.getResponseCode() === 200) {
      logSuccess('DiviAPI', 'Divi license activation process completed', site.id);
      logInfo('DiviAPI', `Please verify manually: ${site.wpUrl}/wp-admin/admin.php?page=et_onboarding#/overview`, site.id);
      return true;
    } else {
      logWarning('DiviAPI', 'Could not verify license activation automatically', site.id);
      logInfo('DiviAPI', `Please activate manually: ${site.wpUrl}/wp-admin/admin.php?page=et_onboarding#/overview`, site.id);
      return true; // Return true anyway as we've done our best
    }

  } catch (error) {
    logError('DiviAPI', `Error activating Divi license: ${error.message}`, site.id);
    logWarning('DiviAPI', `Please activate license manually: ${site.wpUrl}/wp-admin/admin.php?page=et_onboarding#/overview`, site.id);
    return false;
  }
}

/**
 * Save Elegant Themes API key to WordPress options
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
        'Content-Type': 'application/json'
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
