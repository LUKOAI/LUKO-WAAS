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

function installThemeOnWordPress(site, themeBlob) {
  try {
    logInfo('WordPressAPI', `Installing theme on: ${site.name}`, site.id);

    // Get authentication credentials
    const auth = getAuthCredentials(site);
    if (!auth) {
      logError('WordPressAPI', 'No authentication credentials available', site.id);
      return false;
    }

    // WordPress doesn't support theme upload via REST API yet
    // We need to use wp-admin/update.php endpoint with proper authentication
    // The nonce from REST API authentication can be used for wp-admin actions

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

    // Add nonce (use the nonce from authentication)
    if (auth.nonce) {
      body.push(Utilities.newBlob(
        delimiter +
        'Content-Disposition: form-data; name="_wpnonce"\r\n\r\n' +
        auth.nonce
      ).getBytes());
    }

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

    // Prepare request headers
    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    };

    // Add authentication
    if (auth.type === 'cookie_auth') {
      headers['Cookie'] = auth.cookie;
      if (auth.nonce) {
        headers['X-WP-Nonce'] = auth.nonce;
      }
    } else if (auth.type === 'application_password') {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(auth.username + ':' + auth.appPassword);
    } else if (auth.type === 'basic_auth') {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(auth.username + ':' + auth.password);
    }

    // Upload theme
    const uploadOptions = {
      method: 'post',
      headers: headers,
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
      uploadText.includes('successfully installed')
    )) {
      logSuccess('WordPressAPI', 'Theme installed successfully!', site.id);
      return true;
    } else if (uploadText.includes('already installed') || uploadText.includes('Destination folder already exists')) {
      logInfo('WordPressAPI', 'Theme already installed', site.id);
      return true;
    } else if (uploadCode === 200) {
      // Got 200 but unclear success message - assume success
      logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
      return true;
    } else {
      logWarning('WordPressAPI', `Theme installation unclear. Status: ${uploadCode}`, site.id);
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

    // Use WordPress REST API to upload plugin ZIP file
    // This is more reliable than wp-admin form upload
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    // Get authentication credentials
    const auth = getAuthCredentials(site);
    if (!auth) {
      logError('WordPressAPI', 'No authentication credentials available', site.id);
      return false;
    }

    // Build multipart form data with the plugin ZIP file
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    // Build multipart body
    let body = [];

    // Add plugin ZIP file
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="file"; filename="plugin.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    ).getBytes());
    body.push(pluginBlob.getBytes());

    // Add slug parameter (REQUIRED by WordPress REST API)
    if (pluginSlug) {
      body.push(Utilities.newBlob(
        delimiter +
        'Content-Disposition: form-data; name="slug"\r\n\r\n' +
        pluginSlug
      ).getBytes());
    }

    // Add status field to activate immediately
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="status"\r\n\r\n' +
      'active'
    ).getBytes());

    body.push(Utilities.newBlob(closeDelimiter).getBytes());

    // Merge all parts into single byte array
    const bodyBytes = [];
    for (let i = 0; i < body.length; i++) {
      const part = body[i];
      for (let j = 0; j < part.length; j++) {
        bodyBytes.push(part[j]);
      }
    }

    // Prepare request headers
    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    };

    // Add authentication
    if (auth.cookie && auth.nonce) {
      headers['Cookie'] = auth.cookie;
      headers['X-WP-Nonce'] = auth.nonce;
    } else if (auth.appPassword) {
      headers['Authorization'] = 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + auth.appPassword);
    }

    const options = {
      method: 'post',
      headers: headers,
      payload: bodyBytes,
      muteHttpExceptions: true
    };

    logInfo('WordPressAPI', 'Uploading plugin via REST API...', site.id);
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    logInfo('WordPressAPI', `REST API response code: ${statusCode}`, site.id);

    if (statusCode === 201) {
      // 201 Created - plugin installed successfully
      logSuccess('WordPressAPI', 'Plugin installed successfully via REST API', site.id);
      return true;
    } else if (statusCode === 200) {
      // 200 OK - might be already installed or updated
      logSuccess('WordPressAPI', 'Plugin uploaded successfully', site.id);
      return true;
    } else if (statusCode === 400 || statusCode === 500) {
      // Check if already installed
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.code === 'folder_exists' || errorData.code === 'plugin_already_installed') {
          logInfo('WordPressAPI', 'Plugin already installed', site.id);
          return true;
        }
        logError('WordPressAPI', `Plugin installation failed: ${errorData.message}`, site.id);
      } catch (e) {
        logError('WordPressAPI', `Plugin installation failed with status ${statusCode}`, site.id);
      }
      return false;
    } else {
      logError('WordPressAPI', `Unexpected status code: ${statusCode}`, site.id);
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

    // Check WordPress version from site info to determine activation method
    const siteInfo = getWordPressSiteInfo(site);
    const wpVersion = siteInfo ? parseFloat(siteInfo.version) : 0;

    // WordPress 5.5+ has REST API endpoint for plugin activation
    // For older versions, use cookie-based activation
    if (wpVersion >= 5.5) {
      // Use REST API for WordPress 5.5+
      const result = makeAuthenticatedRequest(site, `wp/v2/plugins/${pluginSlug}`, {
        method: 'post',
        payload: {
          status: 'active'
        }
      });

      if (result.success) {
        logSuccess('WordPressAPI', `Plugin activated: ${pluginSlug}`, site.id);
        return true;
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

    // Look for activation link with nonce
    // Format: plugins.php?action=activate&plugin=plugin-slug/plugin.php&_wpnonce=abc123
    const activateLinkRegex = new RegExp(`plugins\\.php\\?action=activate&(?:amp;)?plugin=([^&"']+)&(?:amp;)?_wpnonce=([\\w]+)`, 'g');

    let activationNonce = null;
    let pluginPath = null;
    let match;

    // Find the matching plugin by checking if the slug is in the plugin path
    while ((match = activateLinkRegex.exec(pageHtml)) !== null) {
      const foundPluginPath = match[1];
      if (foundPluginPath.includes(pluginSlug)) {
        pluginPath = foundPluginPath;
        activationNonce = match[2];
        logInfo('WordPressAPI', `Found activation link for plugin: ${pluginPath}`, site.id);
        break;
      }
    }

    if (!activationNonce || !pluginPath) {
      logWarning('WordPressAPI', `Could not find activation link for ${pluginSlug}. Plugin may already be active.`, site.id);
      // Try to verify if plugin is already active by checking for "Deactivate" link
      if (pageHtml.includes(`action=deactivate&amp;plugin=${pluginSlug}`) ||
          pageHtml.includes(`action=deactivate&plugin=${pluginSlug}`)) {
        logInfo('WordPressAPI', 'Plugin appears to be already active', site.id);
        return true;
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
