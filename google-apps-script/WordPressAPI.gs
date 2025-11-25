/**
 * WAAS WordPress API Module
 * Integracja z WordPress REST API
 */

// =============================================================================
// WORDPRESS REST API FUNCTIONS
// =============================================================================

function createWordPressPost(site, postData) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        title: postData.title,
        content: postData.content,
        status: postData.status || 'draft',
        comment_status: 'open',
        ping_status: 'open'
      })
    });

    if (response.success && response.data && response.data.id) {
      logSuccess('WordPressAPI', `Post created: ${postData.title} (ID: ${response.data.id})`, site.id);
      return response.data.id;
    }

    throw new Error('Failed to create post');
  } catch (error) {
    logError('WordPressAPI', `Error creating post: ${error.message}`, site.id);
    throw error;
  }
}

function updateWordPressPost(site, postId, postData) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts/${postId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(postData)
    });

    if (response.success) {
      logSuccess('WordPressAPI', `Post updated: ${postId}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error updating post: ${error.message}`, site.id);
    return false;
  }
}

function deleteWordPressPost(site, postId) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts/${postId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success) {
      logSuccess('WordPressAPI', `Post deleted: ${postId}`, site.id);
      return true;
    }

    return false;
  } catch (error) {
    logError('WordPressAPI', `Error deleting post: ${error.message}`, site.id);
    return false;
  }
}

function getWordPressPosts(site, params = {}) {
  try {
    let apiUrl = `${site.wpUrl}/wp-json/wp/v2/posts`;

    // Add query parameters
    const queryParams = [];
    if (params.per_page) queryParams.push(`per_page=${params.per_page}`);
    if (params.status) queryParams.push(`status=${params.status}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);

    if (queryParams.length > 0) {
      apiUrl += '?' + queryParams.join('&');
    }

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    logError('WordPressAPI', `Error getting posts: ${error.message}`, site.id);
    return [];
  }
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

function installThemeOnWordPress(site, themeBlob, themeSlug) {
  try {
    logInfo('WordPressAPI', `Installing theme on: ${site.name}`, site.id);

    // Step 1: Login and check if theme is already installed
    logInfo('WordPressAPI', 'Checking if theme is already installed...', site.id);
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;

    // Check themes page to see if theme already exists
    const themesPageUrl = `${site.wpUrl}/wp-admin/themes.php`;
    const checkOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const checkResponse = UrlFetchApp.fetch(themesPageUrl, checkOptions);
    const themesPageHtml = checkResponse.getContentText();

    // Check if theme slug appears in the themes list
    if (themeSlug && (themesPageHtml.includes(`data-slug="${themeSlug}"`) ||
        themesPageHtml.includes(`themes.php?action=activate&amp;stylesheet=${themeSlug}`) ||
        themesPageHtml.includes(`themes.php?action=activate&stylesheet=${themeSlug}`))) {
      logInfo('WordPressAPI', `Theme ${themeSlug} is already installed`, site.id);
      return true; // Return true, will be activated separately
    }

    // Step 2: Get upload nonce from theme-install page
    logInfo('WordPressAPI', 'Getting upload nonce from theme-install page...', site.id);
    const installPageUrl = `${site.wpUrl}/wp-admin/theme-install.php?tab=upload`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(installPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // Extract nonce from the upload form
    const nonceMatch = pageHtml.match(/<input[^>]*name="_wpnonce"[^>]*value="([^"]+)"/i) ||
                       pageHtml.match(/name="_wpnonce"[^>]*value="([^"]+)"/i) ||
                       pageHtml.match(/_wpnonce["\s]*[:=]["\s]*["']([^"']+)["']/i);

    if (!nonceMatch) {
      logWarning('WordPressAPI', 'Could not extract upload nonce, trying with REST API nonce...', site.id);
    }

    const uploadNonce = nonceMatch ? nonceMatch[1] : loginResult.nonce;
    logInfo('WordPressAPI', 'Got upload nonce', site.id);

    // Step 3: Upload theme via wp-admin
    const uploadUrl = `${site.wpUrl}/wp-admin/update.php?action=upload-theme`;

    // Create multipart boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    // Build multipart body
    let body = [];

    // Add theme ZIP file
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="themezip"; filename="theme.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    ).getBytes());
    body.push(themeBlob.getBytes());

    // Add nonce
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="_wpnonce"\r\n\r\n' +
      uploadNonce
    ).getBytes());

    // Add action field
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="action"\r\n\r\n' +
      'install-theme-upload'
    ).getBytes());

    // Add submit button
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="install-theme-submit"\r\n\r\n' +
      'Install Now'
    ).getBytes());

    // Close boundary
    body.push(Utilities.newBlob(closeDelim).getBytes());

    // Flatten array into single byte array
    const bodyBytes = [];
    body.forEach(part => {
      for (let i = 0; i < part.length; i++) {
        bodyBytes.push(part[i]);
      }
    });

    // Upload theme
    const uploadOptions = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: bodyBytes,
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', 'Uploading theme ZIP via wp-admin...', site.id);
    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);
    const uploadCode = uploadResponse.getResponseCode();
    const uploadText = uploadResponse.getContentText();

    logInfo('WordPressAPI', `Upload response code: ${uploadCode}`, site.id);

    // Check for success indicators in response
    if (uploadCode === 200 && (
      uploadText.includes('Theme installed successfully') ||
      uploadText.includes('Theme installation was successful') ||
      uploadText.includes('successfully installed') ||
      uploadText.includes('Activate')
    )) {
      logSuccess('WordPressAPI', 'Theme installed successfully!', site.id);
      return true;
    } else if (uploadText.includes('already installed') ||
               uploadText.includes('Destination folder already exists') ||
               uploadText.includes('folder already exists')) {
      logInfo('WordPressAPI', 'Theme already installed', site.id);
      return true;
    } else if (uploadCode === 200) {
      // Got 200 but unclear success message - assume success
      logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
      return true;
    } else {
      logWarning('WordPressAPI', `Theme installation unclear. Status: ${uploadCode}`, site.id);

      // Check again if theme appeared in themes list
      if (themeSlug) {
        const recheckResponse = UrlFetchApp.fetch(themesPageUrl, checkOptions);
        const recheckHtml = recheckResponse.getContentText();
        if (recheckHtml.includes(`data-slug="${themeSlug}"`) ||
            recheckHtml.includes(`stylesheet=${themeSlug}`)) {
          logInfo('WordPressAPI', `Theme ${themeSlug} detected in themes list after upload`, site.id);
          return true;
        }
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error installing theme: ${error.message}`, site.id);
    return false;
  }
}

function activateThemeOnWordPress(site, themeSlug) {
  try {
    logInfo('WordPressAPI', `Activating theme: ${themeSlug}`, site.id);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Get nonce from themes.php page
    const themesPageUrl = `${site.wpUrl}/wp-admin/themes.php`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(themesPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // Look for activation link with nonce
    // Format: themes.php?action=activate&amp;stylesheet=Divi&amp;_wpnonce=abc123
    const activateLinkRegex = new RegExp(`themes\\.php\\?action=activate&(?:amp;)?stylesheet=${themeSlug}&(?:amp;)?_wpnonce=([\\w]+)`, 'i');
    const linkMatch = pageHtml.match(activateLinkRegex);

    let activationNonce;
    if (linkMatch) {
      activationNonce = linkMatch[1];
      logInfo('WordPressAPI', 'Activation nonce extracted from link', site.id);
    } else {
      // Fallback: look for any _wpnonce on the page
      const fallbackMatch = pageHtml.match(/["\']_wpnonce["\'][^"\']*["\']([\\w]+)["\']/);
      if (fallbackMatch) {
        activationNonce = fallbackMatch[1];
        logInfo('WordPressAPI', 'Using fallback nonce from page', site.id);
      } else {
        logError('WordPressAPI', 'Could not extract activation nonce', site.id);
        return false;
      }
    }

    // Step 3: Activate theme
    const activateUrl = `${site.wpUrl}/wp-admin/themes.php?action=activate&stylesheet=${themeSlug}&_wpnonce=${activationNonce}`;

    const activateOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', `Activating theme: ${themeSlug}...`, site.id);
    const activateResponse = UrlFetchApp.fetch(activateUrl, activateOptions);
    const activateCode = activateResponse.getResponseCode();
    const activateText = activateResponse.getContentText();

    logInfo('WordPressAPI', `Activation response code: ${activateCode}`, site.id);

    // Check for success indicators
    if (activateCode === 200 && (
      activateText.includes('New theme activated') ||
      activateText.includes('theme activated') ||
      activateText.includes(`"${themeSlug}"`) ||
      activateText.includes('Active:')
    )) {
      logSuccess('WordPressAPI', `Theme ${themeSlug} activated successfully!`, site.id);
      return true;
    } else if (activateText.includes('already active')) {
      logInfo('WordPressAPI', `Theme ${themeSlug} already active`, site.id);
      return true;
    } else {
      // Log response preview for debugging
      const preview = activateText.substring(0, 500).replace(/\s+/g, ' ');
      logWarning('WordPressAPI', `Activation response unclear. Preview: ${preview}`, site.id);

      // If we got 200, assume success
      if (activateCode === 200) {
        logInfo('WordPressAPI', 'Got 200 response, assuming activation successful', site.id);
        return true;
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error activating theme: ${error.message}`, site.id);
    return false;
  }
}

function getActiveTheme(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/themes?status=active`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error getting active theme: ${error.message}`, site.id);
    return null;
  }
}

// =============================================================================
// PLUGIN MANAGEMENT
// =============================================================================

function installPluginOnWordPress(site, pluginBlob, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Installing plugin on: ${site.name}`, site.id);

    // Step 1: Check if plugin is already installed
    logInfo('WordPressAPI', 'Checking if plugin is already installed...', site.id);
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;

    // Check plugins page to see if plugin already exists
    const pluginsPageUrl = `${site.wpUrl}/wp-admin/plugins.php`;
    const checkOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const checkResponse = UrlFetchApp.fetch(pluginsPageUrl, checkOptions);
    const pluginsPageHtml = checkResponse.getContentText();

    // Check if plugin slug appears in the plugins list
    if (pluginsPageHtml.includes(`data-slug="${pluginSlug}"`) ||
        pluginsPageHtml.includes(`/${pluginSlug}/`) ||
        pluginsPageHtml.includes(pluginSlug + '.php')) {
      logInfo('WordPressAPI', `Plugin ${pluginSlug} is already installed`, site.id);
      return true; // Return true, will be activated separately
    }

    // Step 2: Get upload nonce from plugin-install page
    logInfo('WordPressAPI', 'Getting upload nonce from plugin-install page...', site.id);
    const installPageUrl = `${site.wpUrl}/wp-admin/plugin-install.php?tab=upload`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(installPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // Extract nonce from the upload form
    // Look for: <input type="hidden" name="_wpnonce" value="abc123" />
    const nonceMatch = pageHtml.match(/<input[^>]*name="_wpnonce"[^>]*value="([^"]+)"/i) ||
                       pageHtml.match(/name="_wpnonce"[^>]*value="([^"]+)"/i) ||
                       pageHtml.match(/_wpnonce["\s]*[:=]["\s]*["']([^"']+)["']/i);

    if (!nonceMatch) {
      logWarning('WordPressAPI', 'Could not extract upload nonce, trying with REST API nonce...', site.id);
    }

    const uploadNonce = nonceMatch ? nonceMatch[1] : loginResult.nonce;
    logInfo('WordPressAPI', 'Got upload nonce', site.id);

    // Step 3: Upload plugin via wp-admin
    const uploadUrl = `${site.wpUrl}/wp-admin/update.php?action=upload-plugin`;

    // Create multipart boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    // Build multipart body
    let body = [];

    // Add plugin ZIP file
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="pluginzip"; filename="plugin.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    ).getBytes());
    body.push(pluginBlob.getBytes());

    // Add nonce
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="_wpnonce"\r\n\r\n' +
      uploadNonce
    ).getBytes());

    // Add action field
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="action"\r\n\r\n' +
      'install-plugin-upload'
    ).getBytes());

    // Add submit button
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="install-plugin-submit"\r\n\r\n' +
      'Install Now'
    ).getBytes());

    // Close boundary
    body.push(Utilities.newBlob(closeDelim).getBytes());

    // Flatten array into single byte array
    const bodyBytes = [];
    body.forEach(part => {
      for (let i = 0; i < part.length; i++) {
        bodyBytes.push(part[i]);
      }
    });

    // Upload plugin
    const uploadOptions = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: bodyBytes,
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', 'Uploading plugin ZIP via wp-admin...', site.id);
    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);
    const uploadCode = uploadResponse.getResponseCode();
    const uploadText = uploadResponse.getContentText();

    logInfo('WordPressAPI', `Upload response code: ${uploadCode}`, site.id);

    // Check for success indicators in response
    if (uploadCode === 200 && (
      uploadText.includes('Plugin installed successfully') ||
      uploadText.includes('Plugin installation was successful') ||
      uploadText.includes('successfully installed') ||
      uploadText.includes('Activate Plugin')
    )) {
      logSuccess('WordPressAPI', 'Plugin installed successfully!', site.id);
      return true;
    } else if (uploadText.includes('already installed') ||
               uploadText.includes('Destination folder already exists') ||
               uploadText.includes('folder already exists')) {
      logInfo('WordPressAPI', 'Plugin already installed', site.id);
      return true;
    } else if (uploadCode === 200) {
      // Got 200 but unclear success message - assume success
      logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
      return true;
    } else {
      logWarning('WordPressAPI', `Plugin installation unclear. Status: ${uploadCode}`, site.id);

      // Check again if plugin appeared in plugins list
      const recheckResponse = UrlFetchApp.fetch(pluginsPageUrl, checkOptions);
      const recheckHtml = recheckResponse.getContentText();
      if (recheckHtml.includes(`data-slug="${pluginSlug}"`) ||
          recheckHtml.includes(`/${pluginSlug}/`) ||
          recheckHtml.includes(pluginSlug + '.php')) {
        logInfo('WordPressAPI', `Plugin ${pluginSlug} detected in plugins list after upload`, site.id);
        return true;
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error installing plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginOnWordPress(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Activating plugin: ${pluginSlug}`, site.id);

    // Check if plugin is already active
    if (isPluginActive(site, pluginSlug)) {
      logInfo('WordPressAPI', `Plugin ${pluginSlug} is already active`, site.id);
      return true;
    }

    // Check WordPress version from site info to determine activation method
    const siteInfo = getWordPressSiteInfo(site);
    const wpVersion = siteInfo ? parseFloat(siteInfo.version) : 0;

    // WordPress 5.5+ has REST API endpoint for plugin activation
    // For older versions, use cookie-based activation
    if (wpVersion >= 5.5) {
      // Use REST API for WordPress 5.5+
      // IMPORTANT: pluginSlug for REST API must be URL-encoded (e.g., "waas-product-manager%2Fwaas-product-manager")
      const encodedSlug = encodeURIComponent(pluginSlug);
      const result = makeAuthenticatedRequest(site, `wp/v2/plugins/${encodedSlug}`, {
        method: 'post',
        payload: {
          status: 'active'
        }
      });

      if (result.success) {
        logSuccess('WordPressAPI', `Plugin activated via REST API: ${pluginSlug}`, site.id);
        return true;
      } else if (result.statusCode === 404) {
        // Plugin not found, might not be installed yet
        logError('WordPressAPI', `Plugin not found (404): ${pluginSlug} - plugin may not be installed`, site.id);
        return false;
      } else {
        logError('WordPressAPI', `REST API activation failed: ${result.statusCode} - ${JSON.stringify(result.data)}`, site.id);
        // Fall back to cookie-based activation
        logInfo('WordPressAPI', 'Trying cookie-based activation as fallback...', site.id);
      }
    }

    // Cookie-based activation for WordPress < 5.5 or when REST API fails
    return activatePluginViaCookies(site, pluginSlug);

  } catch (error) {
    logError('WordPressAPI', `Error activating plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginViaCookies(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Activating plugin via cookies: ${pluginSlug}`, site.id);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Get nonce from plugins.php page
    const pluginsPageUrl = `${site.wpUrl}/wp-admin/plugins.php`;
    const pageOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const pageResponse = UrlFetchApp.fetch(pluginsPageUrl, pageOptions);
    const pageHtml = pageResponse.getContentText();

    // First check if plugin is already active by looking for deactivate link
    // This must be checked BEFORE looking for activation link
    const deactivateLinkRegex = new RegExp(`plugins\\.php\\?action=deactivate&(?:amp;)?plugin=([^&"']+)`, 'g');
    let deactivateMatch;
    const allDeactivateLinks = [];

    while ((deactivateMatch = deactivateLinkRegex.exec(pageHtml)) !== null) {
      const foundPluginPath = deactivateMatch[1];
      allDeactivateLinks.push(foundPluginPath);
      if (foundPluginPath.includes(pluginSlug)) {
        logInfo('WordPressAPI', `Plugin ${pluginSlug} is already active (found deactivate link for: ${foundPluginPath})`, site.id);
        return true;
      }
    }

    logInfo('WordPressAPI', `Plugin ${pluginSlug} not found in active plugins. Active plugins: ${allDeactivateLinks.length}`, site.id);

    // Plugin is not active, look for activation link with nonce
    // Format: plugins.php?action=activate&plugin=plugin-slug/plugin.php&_wpnonce=abc123
    const activateLinkRegex = new RegExp(`plugins\\.php\\?action=activate&(?:amp;)?plugin=([^&"']+)&(?:amp;)?_wpnonce=([\\w]+)`, 'g');

    let activationNonce = null;
    let pluginPath = null;
    let match;
    const allInactivePlugins = [];

    // Find the matching plugin by checking if the slug is in the plugin path
    while ((match = activateLinkRegex.exec(pageHtml)) !== null) {
      const foundPluginPath = match[1];
      allInactivePlugins.push(foundPluginPath);
      if (foundPluginPath.includes(pluginSlug)) {
        pluginPath = foundPluginPath;
        activationNonce = match[2];
        logInfo('WordPressAPI', `Found activation link for plugin: ${pluginPath}`, site.id);
        break;
      }
    }

    if (!activationNonce || !pluginPath) {
      logWarning('WordPressAPI', `Could not find activation link for ${pluginSlug}. Inactive plugins found: ${allInactivePlugins.length}`, site.id);
      if (allInactivePlugins.length > 0 && allInactivePlugins.length <= 10) {
        logInfo('WordPressAPI', `Inactive plugins: ${allInactivePlugins.join(', ')}`, site.id);
      }
      return false;
    }

    // Step 3: Activate plugin
    const activateUrl = `${site.wpUrl}/wp-admin/plugins.php?action=activate&plugin=${encodeURIComponent(pluginPath)}&_wpnonce=${activationNonce}`;

    const activateOptions = {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    logInfo('WordPressAPI', `Activating plugin: ${pluginPath}...`, site.id);
    const activateResponse = UrlFetchApp.fetch(activateUrl, activateOptions);
    const activateCode = activateResponse.getResponseCode();
    const activateText = activateResponse.getContentText();

    logInfo('WordPressAPI', `Activation response code: ${activateCode}`, site.id);

    // Check for success indicators
    if (activateCode === 200 && (
      activateText.includes('Plugin activated') ||
      activateText.includes('plugin activated') ||
      activateText.includes('has been activated') ||
      activateText.includes('Deactivate')
    )) {
      logSuccess('WordPressAPI', `Plugin ${pluginSlug} activated successfully!`, site.id);
      return true;
    } else if (activateText.includes('already active')) {
      logInfo('WordPressAPI', `Plugin ${pluginSlug} already active`, site.id);
      return true;
    } else {
      // Log response preview for debugging
      const preview = activateText.substring(0, 500).replace(/\s+/g, ' ');
      logWarning('WordPressAPI', `Activation response unclear. Preview: ${preview}`, site.id);

      // If we got 200, assume success
      if (activateCode === 200) {
        logInfo('WordPressAPI', 'Got 200 response, assuming activation successful', site.id);
        return true;
      }

      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error in cookie-based activation: ${error.message}`, site.id);
    return false;
  }
}

function getInstalledPlugins(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    logError('WordPressAPI', `Error getting plugins: ${error.message}`, site.id);
    return [];
  }
}

/**
 * Check if a plugin is active
 * @param {Object} site - Site object
 * @param {string} pluginSlug - Plugin slug (e.g., "waas-product-manager/waas-product-manager.php")
 * @returns {boolean} True if plugin is active
 */
function isPluginActive(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Checking if plugin is active: ${pluginSlug}`, site.id);

    const plugins = getInstalledPlugins(site);

    // Search for plugin in the list
    const plugin = plugins.find(p =>
      p.plugin === pluginSlug ||
      p.plugin.includes(pluginSlug) ||
      (p.name && p.name.includes('WAAS'))
    );

    if (plugin) {
      const isActive = plugin.status === 'active';
      logInfo('WordPressAPI', `Plugin ${pluginSlug} found. Status: ${plugin.status}`, site.id);
      return isActive;
    } else {
      logInfo('WordPressAPI', `Plugin ${pluginSlug} not found in installed plugins`, site.id);
      return false;
    }
  } catch (error) {
    logError('WordPressAPI', `Error checking plugin status: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// MEDIA MANAGEMENT
// =============================================================================

function uploadMediaToWordPress(site, imageUrl, title = '', altText = '') {
  try {
    // Pobierz obraz
    const imageResponse = UrlFetchApp.fetch(imageUrl);
    const imageBlob = imageResponse.getBlob();

    // Upload do WordPress
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/media`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${title || 'image.jpg'}"`,
        'Content-Type': imageBlob.getContentType()
      },
      payload: imageBlob.getBytes()
    });

    if (response.success && response.data && response.data.id) {
      // Ustaw alt text
      if (altText) {
        updateMediaMeta(site, response.data.id, { alt_text: altText });
      }

      logSuccess('WordPressAPI', `Media uploaded (ID: ${response.data.id})`, site.id);
      return response.data;
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error uploading media: ${error.message}`, site.id);
    return null;
  }
}

function updateMediaMeta(site, mediaId, meta) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/wp/v2/media/${mediaId}`;

    const authHeader = getAuthHeader(site);

    const response = makeHttpRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(meta)
    });

    return response.success;
  } catch (error) {
    logError('WordPressAPI', `Error updating media meta: ${error.message}`, site.id);
    return false;
  }
}

// =============================================================================
// SITE INFO
// =============================================================================

function getWordPressSiteInfo(site) {
  try {
    const apiUrl = `${site.wpUrl}/wp-json/`;

    const response = makeHttpRequest(apiUrl);

    if (response.success && response.data) {
      return {
        name: response.data.name,
        description: response.data.description,
        url: response.data.url,
        version: response.data.version || 'Unknown'
      };
    }

    return null;
  } catch (error) {
    logError('WordPressAPI', `Error getting site info: ${error.message}`, site.id);
    return null;
  }
}
