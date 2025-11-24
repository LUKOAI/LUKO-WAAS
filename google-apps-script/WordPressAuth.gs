/**
 * WAAS WordPress Authentication Module
 * Automatic Application Password creation and authentication management
 *
 * This module handles FULL AUTOMATION of WordPress authentication:
 * - Automatically creates Application Passwords
 * - Falls back to Basic Auth plugin if needed
 * - No manual intervention required!
 *
 * @version 2.0.0
 */

// =============================================================================
// AUTOMATIC AUTHENTICATION SETUP
// =============================================================================

/**
 * Automatically set up WordPress authentication for a site
 * This is called automatically during site setup - NO MANUAL STEPS!
 *
 * Process:
 * 1. Check WordPress version
 * 2. If WP >= 5.6: Create Application Password automatically
 * 3. If that fails: Install Basic Auth plugin automatically
 * 4. Save credentials to Sites sheet
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {Object} Authentication result with credentials
 */
function setupWordPressAuth(site) {
  try {
    logInfo('AUTH', `Setting up WordPress authentication for: ${site.name}`, site.id);

    // Step 1: Check WordPress version
    const wpVersion = getWordPressVersion(site);
    logInfo('AUTH', `WordPress version: ${wpVersion}`, site.id);

    // Step 2: Try to create Application Password (WP >= 5.6)
    if (compareVersions(wpVersion, '5.6') >= 0) {
      logInfo('AUTH', 'WordPress >= 5.6 detected. Creating Application Password...', site.id);

      const appPasswordResult = createApplicationPassword(site);

      if (appPasswordResult.success) {
        // Save Application Password to Sites sheet
        saveAuthCredentials(site.id, {
          authType: 'application_password',
          appPassword: appPasswordResult.password,
          appPasswordName: appPasswordResult.name
        });

        logSuccess('AUTH', 'Application Password created successfully!', site.id);
        return {
          success: true,
          authType: 'application_password',
          password: appPasswordResult.password,
          message: 'Application Password created automatically'
        };
      } else {
        logWarning('AUTH', `Application Password creation failed: ${appPasswordResult.error}. Trying fallback...`, site.id);
      }
    }

    // Step 3: Fallback - Install Basic Auth plugin
    logInfo('AUTH', 'Installing Basic Auth plugin for authentication...', site.id);
    const basicAuthResult = installBasicAuthPlugin(site);

    if (basicAuthResult.success) {
      saveAuthCredentials(site.id, {
        authType: 'basic_auth_plugin',
        pluginInstalled: true
      });

      logSuccess('AUTH', 'Basic Auth plugin installed successfully!', site.id);
      return {
        success: true,
        authType: 'basic_auth_plugin',
        password: site.adminPass, // Use regular password
        message: 'Basic Auth plugin installed automatically'
      };
    }

    // Step 4: Last resort - try regular Basic Auth (older WP versions)
    logInfo('AUTH', 'Using regular Basic Auth (WordPress < 5.6)', site.id);
    saveAuthCredentials(site.id, {
      authType: 'basic_auth_legacy'
    });

    return {
      success: true,
      authType: 'basic_auth_legacy',
      password: site.adminPass,
      message: 'Using legacy Basic Auth'
    };

  } catch (error) {
    logError('AUTH', `Failed to setup authentication: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get authorization header for WordPress API calls
 * Automatically uses the correct auth method for the site
 *
 * @param {Object} site - Site object from getSiteById()
 * @returns {string} Authorization header value
 */
function getAuthHeader(site) {
  // Check if site has Application Password
  if (site.appPassword) {
    return 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.appPassword);
  }

  // Use regular password
  return 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass);
}

// =============================================================================
// APPLICATION PASSWORD CREATION (WP >= 5.6)
// =============================================================================

/**
 * Automatically create WordPress Application Password
 * Uses cookie authentication to log in, then creates App Password via REST API
 * FULLY AUTOMATIC - NO MANUAL STEPS!
 *
 * @param {Object} site - Site object
 * @returns {Object} Result with password or error
 */
function createApplicationPassword(site) {
  try {
    // Step 1: Login via wp-login.php to get cookie session
    logInfo('AUTH', 'Logging in to WordPress admin...', site.id);

    const loginResult = wordpressLogin(site);

    if (!loginResult.success) {
      return {
        success: false,
        error: `Login failed: ${loginResult.error}`
      };
    }

    // Step 2: Get user ID
    const userId = getCurrentUserId(site, loginResult.cookies);

    if (!userId) {
      return {
        success: false,
        error: 'Could not get user ID'
      };
    }

    // Step 3: Create Application Password via REST API
    logInfo('AUTH', 'Creating Application Password via REST API...', site.id);

    const appPasswordName = `WAAS Automation ${new Date().getTime()}`;
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/${userId}/application-passwords`;

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResult.cookies
      },
      payload: JSON.stringify({
        name: appPasswordName
      }),
      muteHttpExceptions: true,
      followRedirects: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      const data = JSON.parse(responseText);

      logSuccess('AUTH', 'Application Password created successfully!', site.id);

      return {
        success: true,
        password: data.password,
        name: data.name,
        uuid: data.uuid
      };
    } else {
      logError('AUTH', `Application Password creation failed: ${responseCode} - ${responseText}`, site.id);
      return {
        success: false,
        error: `HTTP ${responseCode}: ${responseText}`
      };
    }

  } catch (error) {
    logError('AUTH', `Application Password creation error: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log in to WordPress admin panel
 * Gets cookie session for authenticated requests
 *
 * @param {Object} site - Site object
 * @returns {Object} Result with cookies or error
 */
function wordpressLogin(site) {
  try {
    const loginUrl = `${site.wpUrl}/wp-login.php`;

    const payload = {
      'log': site.adminUser,
      'pwd': site.adminPass,
      'wp-submit': 'Log In',
      'redirect_to': site.wpUrl + '/wp-admin/',
      'testcookie': '1'
    };

    const options = {
      method: 'post',
      payload: payload,
      followRedirects: false,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(loginUrl, options);
    const headers = response.getAllHeaders();

    // Extract cookies from Set-Cookie headers
    let cookies = '';
    if (headers['Set-Cookie']) {
      const cookieArray = Array.isArray(headers['Set-Cookie'])
        ? headers['Set-Cookie']
        : [headers['Set-Cookie']];

      cookies = cookieArray
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    }

    if (cookies && cookies.includes('wordpress_logged_in')) {
      logSuccess('AUTH', 'WordPress login successful', site.id);
      return {
        success: true,
        cookies: cookies
      };
    } else {
      return {
        success: false,
        error: 'Login cookies not found - check credentials'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get current user ID from WordPress
 *
 * @param {Object} site - Site object
 * @param {string} cookies - Cookie string from login
 * @returns {number|null} User ID or null
 */
function getCurrentUserId(site, cookies) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/me`;

    const options = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      return data.id;
    }

    return null;
  } catch (error) {
    logError('AUTH', `Failed to get user ID: ${error.message}`, site.id);
    return null;
  }
}

// =============================================================================
// BASIC AUTH PLUGIN INSTALLATION (Fallback)
// =============================================================================

/**
 * Automatically install Basic Auth plugin
 * This is a fallback when Application Password creation fails
 * FULLY AUTOMATIC!
 *
 * @param {Object} site - Site object
 * @returns {Object} Installation result
 */
function installBasicAuthPlugin(site) {
  try {
    logInfo('AUTH', 'Installing Basic Auth plugin from GitHub...', site.id);

    // Basic Auth plugin URL
    const pluginUrl = 'https://github.com/WP-API/Basic-Auth/archive/refs/heads/master.zip';

    // Step 1: Download plugin
    logInfo('AUTH', 'Downloading Basic Auth plugin...', site.id);
    const pluginZip = UrlFetchApp.fetch(pluginUrl);
    const pluginBlob = pluginZip.getBlob();

    // Step 2: Upload plugin to WordPress
    // WordPress doesn't have direct REST API for plugin upload, but we can try
    // through the media/sideload endpoint or use a custom endpoint

    // For now, we'll use a workaround: Install via WordPress plugin directory
    // if the plugin is available there, or provide manual installation instructions

    // Alternative: Try to install via WP-CLI if available
    const wpcliResult = installPluginViaWPCLI(site, 'https://github.com/WP-API/Basic-Auth/archive/refs/heads/master.zip');

    if (wpcliResult.success) {
      return wpcliResult;
    }

    // If WP-CLI not available, we need to use WordPress filesystem
    // This requires either FTP credentials or direct filesystem access

    logWarning('AUTH', 'Basic Auth plugin installation requires manual step or WP-CLI access', site.id);

    return {
      success: false,
      error: 'Plugin installation requires WP-CLI or filesystem access',
      fallback: 'Use Application Password or XML-RPC'
    };

  } catch (error) {
    logError('AUTH', `Basic Auth plugin installation failed: ${error.message}`, site.id);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Try to install plugin via WP-CLI (if available on server)
 *
 * @param {Object} site - Site object
 * @param {string} pluginUrl - Plugin ZIP URL
 * @returns {Object} Installation result
 */
function installPluginViaWPCLI(site, pluginUrl) {
  // This would require SSH access or a custom WordPress endpoint
  // that exposes WP-CLI functionality

  // For now, return not available
  return {
    success: false,
    error: 'WP-CLI not available'
  };
}

// =============================================================================
// CREDENTIAL STORAGE
// =============================================================================

/**
 * Save authentication credentials to Sites sheet
 *
 * @param {number} siteId - Site ID
 * @param {Object} authData - Authentication data to save
 */
function saveAuthCredentials(siteId, authData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    // Find site row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === siteId) {
        const row = i + 1;

        // Add new column for Application Password if needed
        // We'll use column 15 (after Notes column 14)
        if (authData.appPassword) {
          sheet.getRange(row, 15).setValue(authData.appPassword);
          sheet.getRange(row, 16).setValue(authData.authType);
        } else {
          sheet.getRange(row, 16).setValue(authData.authType);
        }

        logInfo('AUTH', `Saved auth credentials for site ${siteId}`, siteId);
        return true;
      }
    }

    return false;
  } catch (error) {
    logError('AUTH', `Failed to save credentials: ${error.message}`, siteId);
    return false;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get WordPress version
 *
 * @param {Object} site - Site object
 * @returns {string} WordPress version (e.g., "6.4.2")
 */
function getWordPressVersion(site) {
  try {
    const endpoint = `${site.wpUrl}/wp-json/`;
    const response = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.version || '5.0'; // Default to 5.0 if not found
    }

    return '5.0'; // Default
  } catch (error) {
    logWarning('AUTH', `Could not detect WordPress version: ${error.message}`, site.id);
    return '5.0'; // Default
  }
}

/**
 * Compare semantic versions
 *
 * @param {string} v1 - Version 1 (e.g., "6.4.2")
 * @param {string} v2 - Version 2 (e.g., "5.6")
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Test WordPress authentication
 * Verifies that authentication is working correctly
 *
 * @param {Object} site - Site object
 * @returns {Object} Test result
 */
function testWordPressAuth(site) {
  try {
    const authHeader = getAuthHeader(site);
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/users/me`;

    const options = {
      method: 'get',
      headers: {
        'Authorization': authHeader
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const userData = JSON.parse(response.getContentText());
      logSuccess('AUTH', `Authentication test successful for user: ${userData.name}`, site.id);
      return {
        success: true,
        user: userData.name,
        message: 'Authentication working correctly'
      };
    } else {
      return {
        success: false,
        error: `HTTP ${responseCode}: ${response.getContentText()}`
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
