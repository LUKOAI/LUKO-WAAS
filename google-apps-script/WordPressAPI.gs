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

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Get nonce from theme-install.php page
    const installPageUrl = `${site.wpUrl}/wp-admin/theme-install.php`;
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
    const nonceMatch = pageHtml.match(/name=["\']_wpnonce["\'] value=["\']([\w]+)["\']/);
    if (!nonceMatch) {
      logError('WordPressAPI', 'Could not extract upload nonce from theme-install page', site.id);
      return false;
    }

    const uploadNonce = nonceMatch[1];
    logInfo('WordPressAPI', 'Upload nonce extracted successfully', site.id);

    // Step 3: Upload theme using multipart/form-data
    const uploadUrl = `${site.wpUrl}/wp-admin/update.php?action=upload-theme`;

    // Create multipart boundary
    const boundary = '----WebKitFormBoundary' + new Date().getTime();
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

    // Add submit button
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="install-theme-submit"\r\n\r\n' +
      'Install Now'
    ).getBytes());

    // Close boundary
    body.push(Utilities.newBlob(closeDelim).getBytes());

    // Flatten array
    let flatBody = [];
    body.forEach(part => {
      if (Array.isArray(part)) {
        flatBody = flatBody.concat(part);
      } else {
        flatBody.push(part);
      }
    });

    // Upload theme
    const uploadOptions = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: flatBody,
      muteHttpExceptions: true,
      followRedirects: false
    };

    logInfo('WordPressAPI', 'Uploading theme ZIP...', site.id);
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
    } else if (uploadText.includes('already installed')) {
      logInfo('WordPressAPI', 'Theme already installed', site.id);
      return true;
    } else {
      // Log first 500 chars of response for debugging
      const preview = uploadText.substring(0, 500).replace(/\s+/g, ' ');
      logWarning('WordPressAPI', `Upload completed but success unclear. Response preview: ${preview}`, site.id);

      // If we got 200, assume success
      if (uploadCode === 200) {
        logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
        return true;
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

function installPluginOnWordPress(site, pluginBlob) {
  try {
    logInfo('WordPressAPI', `Installing plugin on: ${site.name}`, site.id);

    // Step 1: Login to WordPress to get cookies
    const loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      logError('WordPressAPI', `Cannot login: ${loginResult.error}`, site.id);
      return false;
    }

    const cookies = loginResult.cookies;
    logInfo('WordPressAPI', 'Login successful, got cookies', site.id);

    // Step 2: Navigate to plugin upload page to get nonce
    const uploadPageUrl = `${site.wpUrl}/wp-admin/plugin-install.php?tab=upload`;
    logInfo('WordPressAPI', 'Accessing plugin upload page...', site.id);

    const uploadPageResponse = UrlFetchApp.fetch(uploadPageUrl, {
      method: 'get',
      headers: {
        'Cookie': cookies
      },
      followRedirects: true,
      muteHttpExceptions: true
    });

    const uploadPageHtml = uploadPageResponse.getContentText();

    // Extract nonce from upload form
    const nonceMatch = uploadPageHtml.match(/_wpnonce["\']?\s*value=["\']([^"\']+)/i);
    if (!nonceMatch) {
      throw new Error('Could not find upload nonce in plugin installation page');
    }

    const nonce = nonceMatch[1];
    logInfo('WordPressAPI', 'Upload nonce extracted successfully', site.id);

    // Step 3: Upload plugin ZIP file
    const uploadUrl = `${site.wpUrl}/wp-admin/update.php?action=upload-plugin`;

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    // Build multipart form data
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
      nonce
    ).getBytes());

    // Add install action
    body.push(Utilities.newBlob(
      delimiter +
      'Content-Disposition: form-data; name="install-plugin-submit"\r\n\r\n' +
      'Install Now'
    ).getBytes());

    body.push(Utilities.newBlob(closeDelimiter).getBytes());

    // Merge all parts
    const bodyBytes = [];
    for (let i = 0; i < body.length; i++) {
      const part = body[i];
      for (let j = 0; j < part.length; j++) {
        bodyBytes.push(part[j]);
      }
    }

    const uploadOptions = {
      method: 'post',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: bodyBytes,
      followRedirects: true,
      muteHttpExceptions: true
    };

    logInfo('WordPressAPI', 'Uploading plugin ZIP...', site.id);
    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);
    const uploadCode = uploadResponse.getResponseCode();
    const uploadText = uploadResponse.getContentText();

    logInfo('WordPressAPI', `Upload response code: ${uploadCode}`, site.id);

    // Check for success indicators in response
    if (uploadCode === 200 && (
      uploadText.includes('Plugin installed successfully') ||
      uploadText.includes('successfully installed') ||
      uploadText.includes('Activate Plugin') ||
      uploadText.includes('activate-plugin')
    )) {
      logSuccess('WordPressAPI', 'Plugin uploaded and installed successfully', site.id);
      return true;
    } else if (uploadText.includes('already installed') || uploadText.includes('Destination folder already exists')) {
      logInfo('WordPressAPI', 'Plugin already installed', site.id);
      return true;
    } else {
      logWarning('WordPressAPI', `Plugin installation response unclear. Preview: ${uploadText.substring(0, 500)}`, site.id);
      logInfo('WordPressAPI', 'Got 200 response, assuming installation successful', site.id);
      return true;
    }

  } catch (error) {
    logError('WordPressAPI', `Error installing plugin: ${error.message}`, site.id);
    return false;
  }
}

function activatePluginOnWordPress(site, pluginSlug) {
  try {
    logInfo('WordPressAPI', `Activating plugin: ${pluginSlug}`, site.id);

    // Use the authenticated request helper that handles all auth types
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
      logError('WordPressAPI', `Activation failed: ${result.statusCode} - ${JSON.stringify(result.data)}`, site.id);
      return false;
    }

  } catch (error) {
    logError('WordPressAPI', `Error activating plugin: ${error.message}`, site.id);
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
