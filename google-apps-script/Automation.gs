/**
 * WAAS - WordPress Affiliate Automation System
 * Automation Module
 *
 * Complete automation functions for full-stack installation and content deployment.
 * This module provides one-click solutions for complex multi-step operations.
 *
 * @version 2.0.0
 */

// =============================================================================
// INSTALL FULL STACK - ALL-IN-ONE INSTALLATION
// =============================================================================

/**
 * Install complete WordPress affiliate stack on a site
 *
 * This function performs ALL installation steps in sequence:
 * 1. Verify WordPress site is accessible
 * 2. Install and activate Divi theme
 * 3. Install and activate WooCommerce
 * 4. Install and activate WAAS Product Manager plugin
 * 5. Install and activate WAAS Patronage Manager plugin
 * 6. Install and activate Divi Child Theme
 * 7. Import initial set of Amazon products (optional)
 * 8. Generate initial content (optional)
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @param {Object} options - Installation options
 * @param {boolean} options.importProducts - Import initial products (default: true)
 * @param {Array<string>} options.initialAsins - ASINs to import initially
 * @param {boolean} options.generateContent - Generate initial content (default: false)
 * @returns {Object} Installation result with detailed status
 */
function installFullStack(siteId, options = {}) {
  const startTime = new Date();

  // Default options
  const config = {
    importProducts: options.importProducts !== false,
    initialAsins: options.initialAsins || [],
    generateContent: options.generateContent || false
  };

  logInfo('AUTOMATION', `Starting full stack installation for site ${siteId}`, siteId);

  try {
    // Get site details
    let site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('AUTOMATION', `Installing full stack on: ${site.name} (${site.domain})`, siteId);

    const result = {
      siteId: siteId,
      siteName: site.name,
      steps: [],
      success: false,
      startTime: startTime,
      endTime: null,
      duration: null,
      errors: []
    };

    // STEP 1: Verify WordPress accessibility and setup authentication
    logInfo('AUTOMATION', 'Step 1/8: Verifying WordPress site and setting up authentication...', siteId);
    try {
      const wpCheck = checkWordPressAvailability(site);

      if (!wpCheck.available) {
        result.steps.push({
          step: 1,
          name: 'WordPress Accessibility Check',
          status: 'FAILED',
          message: wpCheck.error || 'WordPress site not accessible',
          timestamp: new Date()
        });
        throw new Error(`WordPress site not accessible: ${wpCheck.error}`);
      }

      // AUTOMATIC APPLICATION PASSWORD SETUP - NO MANUAL STEPS!
      logInfo('AUTOMATION', 'Setting up WordPress authentication automatically...', siteId);
      const authResult = setupWordPressAuth(site);

      if (authResult.success) {
        logSuccess('AUTOMATION', `Authentication setup: ${authResult.message}`, siteId);
      } else {
        logWarning('AUTOMATION', `Auth setup warning: ${authResult.error}. Trying with existing credentials...`, siteId);
      }

      // Re-load site with new auth credentials
      site = getSiteById(siteId);

      result.steps.push({
        step: 1,
        name: 'WordPress Accessibility & Authentication',
        status: 'SUCCESS',
        message: `WordPress accessible. Auth: ${authResult.authType || 'existing'}`,
        timestamp: new Date()
      });
    } catch (error) {
      result.errors.push(`Step 1 failed: ${error.message}`);
      throw error;
    }

    // STEP 2: Install Divi theme
    logInfo('AUTOMATION', 'Step 2/8: Installing Divi theme...', siteId);
    try {
      const diviResult = installDiviOnSite(siteId, { skipDialog: true });
      result.steps.push({
        step: 2,
        name: 'Divi Theme Installation',
        status: diviResult.success ? 'SUCCESS' : 'FAILED',
        message: diviResult.message,
        timestamp: new Date()
      });

      if (!diviResult.success) {
        throw new Error(`Divi installation failed: ${diviResult.message}`);
      }

      // Wait for theme to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 2 failed: ${error.message}`);
      // Continue anyway - might already be installed
      logWarning('AUTOMATION', `Divi installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 3: Install WooCommerce
    logInfo('AUTOMATION', 'Step 3/8: Installing WooCommerce plugin...', siteId);
    try {
      const wooResult = installWooCommerceOnSite(siteId);
      result.steps.push({
        step: 3,
        name: 'WooCommerce Installation',
        status: wooResult.success ? 'SUCCESS' : 'FAILED',
        message: wooResult.message || 'WooCommerce installed successfully',
        timestamp: new Date()
      });

      if (!wooResult.success) {
        logWarning('AUTOMATION', `WooCommerce installation issue (continuing): ${wooResult.message}`, siteId);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 3 failed: ${error.message}`);
      logWarning('AUTOMATION', `WooCommerce installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 4: Install WAAS Product Manager plugin
    logInfo('AUTOMATION', 'Step 4/8: Installing WAAS Product Manager plugin...', siteId);
    try {
      const pluginResult = installPluginOnSite(siteId);
      result.steps.push({
        step: 4,
        name: 'WAAS Plugin Installation',
        status: pluginResult.success ? 'SUCCESS' : 'FAILED',
        message: pluginResult.message,
        timestamp: new Date()
      });

      if (!pluginResult.success) {
        throw new Error(`Plugin installation failed: ${pluginResult.message}`);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 4 failed: ${error.message}`);
      // Continue anyway - might already be installed
      logWarning('AUTOMATION', `Plugin installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 5: Install WAAS Patronage Manager plugin
    logInfo('AUTOMATION', 'Step 5/8: Installing WAAS Patronage Manager plugin...', siteId);
    try {
      const patronageResult = installPatronageManagerOnSite(siteId);
      result.steps.push({
        step: 5,
        name: 'WAAS Patronage Manager Installation',
        status: patronageResult.success ? 'SUCCESS' : 'FAILED',
        message: patronageResult.message,
        timestamp: new Date()
      });

      if (!patronageResult.success) {
        logWarning('AUTOMATION', `Patronage Manager installation issue (continuing): ${patronageResult.message}`, siteId);
      }

      // Wait for plugin to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 5 failed: ${error.message}`);
      logWarning('AUTOMATION', `Patronage Manager installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 6: Install Divi Child Theme
    logInfo('AUTOMATION', 'Step 6/8: Installing Divi Child Theme...', siteId);
    try {
      const childThemeResult = installDiviChildThemeOnSite(siteId);
      result.steps.push({
        step: 6,
        name: 'Divi Child Theme Installation',
        status: childThemeResult.success ? 'SUCCESS' : 'FAILED',
        message: childThemeResult.message,
        timestamp: new Date()
      });

      if (!childThemeResult.success) {
        logWarning('AUTOMATION', `Divi Child Theme installation issue (continuing): ${childThemeResult.message}`, siteId);
      }

      // Wait for theme to activate
      Utilities.sleep(3000);
    } catch (error) {
      result.errors.push(`Step 6 failed: ${error.message}`);
      logWarning('AUTOMATION', `Divi Child Theme installation issue (continuing): ${error.message}`, siteId);
    }

    // STEP 7: Import initial products (optional)
    if (config.importProducts && config.initialAsins.length > 0) {
      logInfo('AUTOMATION', `Step 7/8: Importing ${config.initialAsins.length} initial products...`, siteId);
      try {
        const importedProducts = [];
        for (const asin of config.initialAsins) {
          try {
            const productData = getAmazonProductData(asin);
            if (productData) {
              const product = addProduct(productData);
              importedProducts.push(product);
              Utilities.sleep(1000); // Rate limiting
            }
          } catch (productError) {
            logWarning('AUTOMATION', `Failed to import product ${asin}: ${productError.message}`, siteId);
          }
        }

        result.steps.push({
          step: 7,
          name: 'Product Import',
          status: importedProducts.length > 0 ? 'SUCCESS' : 'PARTIAL',
          message: `Imported ${importedProducts.length} of ${config.initialAsins.length} products`,
          products: importedProducts,
          timestamp: new Date()
        });
      } catch (error) {
        result.errors.push(`Step 7 failed: ${error.message}`);
        logWarning('AUTOMATION', `Product import issue (continuing): ${error.message}`, siteId);
      }
    } else {
      result.steps.push({
        step: 7,
        name: 'Product Import',
        status: 'SKIPPED',
        message: 'No initial products specified',
        timestamp: new Date()
      });
    }

    // STEP 8: Generate initial content (optional)
    if (config.generateContent && config.importProducts && config.initialAsins.length > 0) {
      logInfo('AUTOMATION', 'Step 8/8: Generating initial content...', siteId);
      try {
        // Generate a review for the first product
        const firstProductId = result.steps.find(s => s.step === 7)?.products?.[0]?.id;
        if (firstProductId) {
          const contentResult = generateContent(
            siteId,
            'product_review',
            [firstProductId],
            { autoPublish: false } // Keep as draft initially
          );

          result.steps.push({
            step: 8,
            name: 'Content Generation',
            status: contentResult.success ? 'SUCCESS' : 'FAILED',
            message: contentResult.message || 'Initial content generated',
            contentId: contentResult.contentId,
            timestamp: new Date()
          });
        } else {
          throw new Error('No products available for content generation');
        }
      } catch (error) {
        result.errors.push(`Step 8 failed: ${error.message}`);
        logWarning('AUTOMATION', `Content generation issue (continuing): ${error.message}`, siteId);
      }
    } else {
      result.steps.push({
        step: 8,
        name: 'Content Generation',
        status: 'SKIPPED',
        message: 'Content generation not requested',
        timestamp: new Date()
      });
    }

    // Calculate final results
    result.endTime = new Date();
    result.duration = (result.endTime - result.startTime) / 1000; // seconds

    const successfulSteps = result.steps.filter(s => s.status === 'SUCCESS').length;
    const totalSteps = result.steps.filter(s => s.status !== 'SKIPPED').length;
    result.success = successfulSteps >= 6; // At least core steps (WordPress, Divi, WooCommerce, Product Manager, Patronage Manager, Child Theme)

    if (result.success) {
      logSuccess('AUTOMATION', `Full stack installation completed: ${successfulSteps}/${totalSteps} steps successful (${result.duration}s)`, siteId);

      // Update site status in Sites sheet (uses SiteManager.gs signature)
      updateSiteStatus(siteId, 'Active', {
        diviInstalled: 'Yes',
        pluginInstalled: 'Yes'
      });
    } else {
      logError('AUTOMATION', `Full stack installation incomplete: only ${successfulSteps}/${totalSteps} steps successful`, siteId);
    }

    return result;

  } catch (error) {
    logError('AUTOMATION', `Full stack installation failed: ${error.message}`, siteId);
    throw error;
  }
}

// NOTE: installWooCommerceOnSite() is defined in SiteManager.gs (canonical version)
// NOTE: updateSiteStatus() is defined in SiteManager.gs (canonical version)
// Signature: updateSiteStatus(siteId, status, updates = {})

/**
 * Install WAAS Patronage Manager plugin on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installPatronageManagerOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('PATRONAGE', `Installing WAAS Patronage Manager on ${site.name}`, siteId);

    // Get custom plugin URL from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const pluginUrl = scriptProperties.getProperty('PATRONAGE_MANAGER_DOWNLOAD_URL');

    if (!pluginUrl) {
      logWarning('PATRONAGE', 'No custom Patronage Manager download URL configured', siteId);
      return {
        success: false,
        message: 'Patronage Manager download URL not configured in Script Properties'
      };
    }

    logInfo('PATRONAGE', `Downloading Patronage Manager from: ${pluginUrl}`, siteId);

    // Download plugin package - check for Google Drive URL first
    let pluginBlob = null;
    let isGDriveUrl = isGoogleDriveUrl(pluginUrl);

    // Check if it's a Google Drive URL/ID (use helper from SiteManager.gs)
    if (isGDriveUrl) {
      pluginBlob = downloadFromGoogleDrive(pluginUrl);
      if (pluginBlob) {
        logSuccess('PATRONAGE', `Patronage Manager downloaded from Google Drive (${(pluginBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
      } else {
        // Google Drive download failed - don't try HTTP fallback for gdrive URLs
        logError('PATRONAGE', 'Failed to download from Google Drive. Check file permissions.', siteId);
        logInfo('PATRONAGE', '', siteId);
        logInfo('PATRONAGE', '📋 TROUBLESHOOTING GOOGLE DRIVE:', siteId);
        logInfo('PATRONAGE', '1. Make sure the file ID is correct in PATRONAGE_MANAGER_DOWNLOAD_URL', siteId);
        logInfo('PATRONAGE', '2. Ensure the Google Apps Script has access to Google Drive', siteId);
        logInfo('PATRONAGE', '3. Check if the file is shared with "Anyone with the link" or the script user', siteId);
        logInfo('PATRONAGE', '', siteId);
        throw new Error('Google Drive download failed - check file permissions');
      }
    }

    // If not Google Drive, try regular HTTP URL with retry logic
    if (!pluginBlob && !isGDriveUrl) {
      const maxRetries = 3;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const delay = 2000 * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
            logInfo('PATRONAGE', `Retrying download after ${delay}ms (attempt ${attempt}/${maxRetries})...`, siteId);
            Utilities.sleep(delay);
          }

          const response = UrlFetchApp.fetch(pluginUrl, {
            muteHttpExceptions: true,
            followRedirects: true,
            headers: {
              'Accept-Encoding': 'identity',
              'Cache-Control': 'no-transform, no-cache',
              'Pragma': 'no-cache',
              'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
            }
          });

          const statusCode = response.getResponseCode();
          if (statusCode === 200) {
            pluginBlob = response.getBlob();
            logSuccess('PATRONAGE', `Patronage Manager package downloaded successfully (${(pluginBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
            break; // Success - exit retry loop
          } else if (statusCode === 404 || statusCode === 403) {
            // Don't retry on 404/403
            throw new Error(`Failed to download plugin: HTTP ${statusCode}`);
          } else {
            lastError = new Error(`HTTP ${statusCode}`);
            if (attempt < maxRetries) {
              logWarning('PATRONAGE', `Download failed with HTTP ${statusCode}, retrying...`, siteId);
            }
          }
        } catch (error) {
          lastError = error;
          const isDnsError = error.message.toLowerCase().includes('dns');
          const isRetryable = isDnsError || error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('connection');

          if (!isRetryable || error.message.includes('404') || error.message.includes('403')) {
            // Don't retry on non-retryable errors
            throw error;
          }

          if (attempt < maxRetries) {
            logWarning('PATRONAGE', `Download failed (${error.message}), retrying...`, siteId);
          } else {
            throw new Error(`Failed to download plugin after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }

      if (!pluginBlob && lastError) {
        throw lastError;
      }
    }

    if (!pluginBlob) {
      throw new Error('Failed to download plugin from any source');
    }

    // Install plugin via WordPress admin panel
    const pluginSlug = 'waas-patronage-manager';
    const installed = installPluginOnWordPress(site, pluginBlob, pluginSlug);
    if (!installed) {
      throw new Error('Plugin installation failed');
    }

    // Activate plugin (fallback jeśli instalacja nie aktywowała)
    const activated = activatePluginOnWordPress(site, pluginSlug + '/' + pluginSlug + '.php');
    if (!activated) {
      throw new Error('Failed to activate plugin');
    }

    logSuccess('PATRONAGE', 'WAAS Patronage Manager installed and activated successfully', siteId);
    return {
      success: true,
      message: 'WAAS Patronage Manager installed and activated'
    };

  } catch (error) {
    logError('PATRONAGE', `Failed to install Patronage Manager: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Install Divi Child Theme on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installDiviChildThemeOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('CHILD_THEME', `Installing Divi Child Theme on ${site.name}`, siteId);

    // Get custom theme URL from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const themeUrl = scriptProperties.getProperty('DIVI_CHILD_DOWNLOAD_URL');

    if (!themeUrl) {
      logWarning('CHILD_THEME', 'No custom Divi Child Theme download URL configured', siteId);
      return {
        success: false,
        message: 'Divi Child Theme download URL not configured in Script Properties'
      };
    }

    logInfo('CHILD_THEME', `Downloading Divi Child Theme from: ${themeUrl}`, siteId);

    // Download theme package - check for Google Drive URL first
    let themeBlob = null;
    let isGDriveUrl = isGoogleDriveUrl(themeUrl);

    // Check if it's a Google Drive URL/ID (use helper from SiteManager.gs)
    if (isGDriveUrl) {
      themeBlob = downloadFromGoogleDrive(themeUrl);
      if (themeBlob) {
        logSuccess('CHILD_THEME', `Divi Child Theme downloaded from Google Drive (${(themeBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
      } else {
        // Google Drive download failed - don't try HTTP fallback for gdrive URLs
        logError('CHILD_THEME', 'Failed to download from Google Drive. Check file permissions.', siteId);
        logInfo('CHILD_THEME', '', siteId);
        logInfo('CHILD_THEME', '📋 TROUBLESHOOTING GOOGLE DRIVE:', siteId);
        logInfo('CHILD_THEME', '1. Make sure the file ID is correct in DIVI_CHILD_DOWNLOAD_URL', siteId);
        logInfo('CHILD_THEME', '2. Ensure the Google Apps Script has access to Google Drive', siteId);
        logInfo('CHILD_THEME', '3. Check if the file is shared with "Anyone with the link" or the script user', siteId);
        logInfo('CHILD_THEME', '', siteId);
        throw new Error('Google Drive download failed - check file permissions');
      }
    }

    // If not Google Drive, try regular HTTP URL with retry logic
    if (!themeBlob && !isGDriveUrl) {
      const maxRetries = 3;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const delay = 2000 * Math.pow(2, attempt - 2); // Exponential backoff: 2s, 4s, 8s
            logInfo('CHILD_THEME', `Retrying download after ${delay}ms (attempt ${attempt}/${maxRetries})...`, siteId);
            Utilities.sleep(delay);
          }

          const response = UrlFetchApp.fetch(themeUrl, {
            muteHttpExceptions: true,
            followRedirects: true,
            headers: {
              'Accept-Encoding': 'identity',
              'Cache-Control': 'no-transform, no-cache',
              'Pragma': 'no-cache',
              'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
            }
          });

          const statusCode = response.getResponseCode();
          if (statusCode === 200) {
            themeBlob = response.getBlob();
            logSuccess('CHILD_THEME', `Divi Child Theme package downloaded successfully (${(themeBlob.getBytes().length / 1024).toFixed(2)} KB)`, siteId);
            break; // Success - exit retry loop
          } else if (statusCode === 404 || statusCode === 403) {
            // Don't retry on 404/403
            throw new Error(`Failed to download theme: HTTP ${statusCode}`);
          } else {
            lastError = new Error(`HTTP ${statusCode}`);
            if (attempt < maxRetries) {
              logWarning('CHILD_THEME', `Download failed with HTTP ${statusCode}, retrying...`, siteId);
            }
          }
        } catch (error) {
          lastError = error;
          const isDnsError = error.message.toLowerCase().includes('dns');
          const isRetryable = isDnsError || error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('connection');

          if (!isRetryable || error.message.includes('404') || error.message.includes('403')) {
            // Don't retry on non-retryable errors
            throw error;
          }

          if (attempt < maxRetries) {
            logWarning('CHILD_THEME', `Download failed (${error.message}), retrying...`, siteId);
          } else {
            throw new Error(`Failed to download theme after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }

      if (!themeBlob && lastError) {
        throw lastError;
      }
    }

    if (!themeBlob) {
      throw new Error('Failed to download theme from any source');
    }

    // Install theme via WordPress admin panel
    const installed = installThemeOnWordPress(site, themeBlob, 'divi-child-waas');
    if (!installed) {
      throw new Error('Theme installation failed');
    }

    // Activate child theme (Divi must be parent theme)
    const activated = activateThemeOnWordPress(site, 'divi-child-waas');
    if (!activated) {
      throw new Error('Failed to activate theme');
    }

    logSuccess('CHILD_THEME', 'Divi Child Theme installed and activated successfully', siteId);
    return {
      success: true,
      message: 'Divi Child Theme installed and activated'
    };

  } catch (error) {
    logError('CHILD_THEME', `Failed to install Divi Child Theme: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// DEPLOY SELECTED CONTENT - ALL-IN-ONE DEPLOYMENT
// =============================================================================

/**
 * Deploy content automatically: import products, generate content, publish to WordPress
 *
 * This function performs complete content deployment:
 * 1. Import products from Amazon (if ASINs provided)
 * 2. Generate content using Claude AI
 * 3. Publish content to WordPress site
 * 4. Update Content Queue with results
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @param {string} contentType - Type of content (product_review, comparison, buying_guide, top_list)
 * @param {Array<string>} asins - Amazon ASINs for products
 * @param {Object} options - Deployment options
 * @returns {Object} Deployment result
 */
function deploySelectedContent(siteId, contentType, asins, options = {}) {
  const startTime = new Date();

  const config = {
    autoPublish: options.autoPublish !== false,
    scheduledDate: options.scheduledDate || null,
    template: options.template || null,
    title: options.title || null
  };

  logInfo('AUTOMATION', `Starting content deployment for site ${siteId}`, siteId);

  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    const result = {
      siteId: siteId,
      contentType: contentType,
      steps: [],
      success: false,
      startTime: startTime,
      endTime: null,
      duration: null,
      errors: []
    };

    // STEP 1: Import products from Amazon
    logInfo('AUTOMATION', `Step 1/3: Importing ${asins.length} products from Amazon...`, siteId);
    const productIds = [];

    try {
      for (const asin of asins) {
        try {
          // Check if product already exists
          let product = getProductByAsin(asin);

          if (!product) {
            // Import new product
            const productData = getAmazonProductData(asin);
            if (productData) {
              product = addProduct(productData);
              logInfo('AUTOMATION', `Imported product: ${product.name} (${asin})`, siteId);
            }
          } else {
            logInfo('AUTOMATION', `Product already exists: ${product.name} (${asin})`, siteId);
          }

          if (product) {
            productIds.push(product.id);
          }

          Utilities.sleep(1000); // Rate limiting
        } catch (productError) {
          logWarning('AUTOMATION', `Failed to import product ${asin}: ${productError.message}`, siteId);
        }
      }

      result.steps.push({
        step: 1,
        name: 'Product Import',
        status: productIds.length > 0 ? 'SUCCESS' : 'FAILED',
        message: `Imported/found ${productIds.length} of ${asins.length} products`,
        productIds: productIds,
        timestamp: new Date()
      });

      if (productIds.length === 0) {
        throw new Error('No products available for content generation');
      }
    } catch (error) {
      result.errors.push(`Step 1 failed: ${error.message}`);
      throw error;
    }

    // STEP 2: Generate content
    logInfo('AUTOMATION', `Step 2/3: Generating ${contentType} content...`, siteId);
    let contentId = null;
    let generatedContent = null;

    try {
      const contentResult = generateContent(
        siteId,
        contentType,
        productIds,
        {
          title: config.title,
          template: config.template,
          autoPublish: false // We'll publish in step 3
        }
      );

      if (contentResult.success) {
        contentId = contentResult.contentId;
        generatedContent = contentResult.content;

        result.steps.push({
          step: 2,
          name: 'Content Generation',
          status: 'SUCCESS',
          message: `Generated ${contentType} content`,
          contentId: contentId,
          timestamp: new Date()
        });
      } else {
        throw new Error(contentResult.message || 'Content generation failed');
      }
    } catch (error) {
      result.errors.push(`Step 2 failed: ${error.message}`);
      throw error;
    }

    // STEP 3: Publish to WordPress
    logInfo('AUTOMATION', 'Step 3/3: Publishing content to WordPress...', siteId);

    try {
      if (!contentId || !generatedContent) {
        throw new Error('No content available for publishing');
      }

      // Publish content
      const publishResult = publishContentToWordPress(
        siteId,
        contentId,
        {
          status: config.autoPublish ? 'publish' : 'draft',
          scheduledDate: config.scheduledDate
        }
      );

      result.steps.push({
        step: 3,
        name: 'WordPress Publishing',
        status: publishResult.success ? 'SUCCESS' : 'FAILED',
        message: publishResult.message || 'Content published successfully',
        postId: publishResult.postId,
        postUrl: publishResult.postUrl,
        timestamp: new Date()
      });

      if (!publishResult.success) {
        throw new Error(publishResult.message || 'Publishing failed');
      }
    } catch (error) {
      result.errors.push(`Step 3 failed: ${error.message}`);
      throw error;
    }

    // Calculate final results
    result.endTime = new Date();
    result.duration = (result.endTime - result.startTime) / 1000;

    const successfulSteps = result.steps.filter(s => s.status === 'SUCCESS').length;
    result.success = successfulSteps === 3;

    if (result.success) {
      logSuccess('AUTOMATION', `Content deployment completed: all steps successful (${result.duration}s)`, siteId);
    } else {
      logError('AUTOMATION', `Content deployment incomplete: only ${successfulSteps}/3 steps successful`, siteId);
    }

    return result;

  } catch (error) {
    logError('AUTOMATION', `Content deployment failed: ${error.message}`, siteId);
    throw error;
  }
}

/**
 * Publish content to WordPress site
 *
 * @param {number} siteId - Site ID
 * @param {number} contentId - Content Queue ID
 * @param {Object} options - Publishing options
 * @returns {Object} Publishing result
 */
function publishContentToWordPress(siteId, contentId, options = {}) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    // Get content from Content Queue
    const contentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Content Queue');
    const contentData = contentSheet.getDataRange().getValues();

    let content = null;
    let contentRow = -1;

    for (let i = 1; i < contentData.length; i++) {
      if (contentData[i][0] === contentId) {
        content = {
          id: contentData[i][0],
          siteId: contentData[i][1],
          contentType: contentData[i][2],
          title: contentData[i][3],
          status: contentData[i][4],
          productIds: contentData[i][5],
          template: contentData[i][7],
          // Content body should be stored somewhere (e.g., in Notes or separate storage)
        };
        contentRow = i + 1;
        break;
      }
    }

    if (!content) {
      throw new Error(`Content with ID ${contentId} not found`);
    }

    // For now, we'll use a placeholder - in real implementation,
    // content body should be retrieved from where it was stored during generation
    const postData = {
      title: content.title,
      content: '<!-- Content placeholder - implement proper content storage -->',
      status: options.status || 'draft',
      date: options.scheduledDate || new Date().toISOString()
    };

    // Publish to WordPress
    const wpResult = createWordPressPost(
      site.wpUrl,
      site.adminUser,
      site.adminPass,
      postData
    );

    if (wpResult.success) {
      // Update Content Queue with publish results
      contentSheet.getRange(contentRow, 5).setValue('Published');
      contentSheet.getRange(contentRow, 10).setValue(new Date());
      contentSheet.getRange(contentRow, 11).setValue(wpResult.postId);
      contentSheet.getRange(contentRow, 12).setValue(wpResult.postUrl);

      return {
        success: true,
        postId: wpResult.postId,
        postUrl: wpResult.postUrl,
        message: 'Content published successfully'
      };
    } else {
      throw new Error(wpResult.message || 'WordPress publishing failed');
    }

  } catch (error) {
    logError('AUTOMATION', `Failed to publish content: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// AUTOMATED CHECKBOX PROCESSING
// =============================================================================

/**
 * Process sites with "Auto Install" checkbox enabled
 *
 * Scans Sites sheet for rows with Auto Install checkbox checked,
 * and triggers full stack installation for each.
 *
 * This function should be scheduled to run periodically (e.g., hourly)
 */
function processAutoInstallSites() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    logInfo('AUTOMATION', 'Processing auto-install sites...');

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Check each site (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const siteId = data[i][0];
      const autoInstall = data[i][12]; // Column 13 (0-indexed = 12)
      const status = data[i][9]; // Column 10

      // Only process if checkbox is checked and status is not "Active"
      if (autoInstall === true && status !== 'Active') {
        processed++;

        try {
          logInfo('AUTOMATION', `Auto-installing site ${siteId}...`, siteId);

          const result = installFullStack(siteId, {
            importProducts: false, // Don't import products automatically
            generateContent: false
          });

          if (result.success) {
            successful++;
            // Uncheck the Auto Install checkbox after successful installation
            sheet.getRange(row, 13).setValue(false);
            logSuccess('AUTOMATION', `Auto-install completed for site ${siteId}`, siteId);
          } else {
            failed++;
            logError('AUTOMATION', `Auto-install failed for site ${siteId}`, siteId);
          }

          // Wait between installations to avoid overwhelming servers
          Utilities.sleep(5000);

        } catch (error) {
          failed++;
          logError('AUTOMATION', `Auto-install error for site ${siteId}: ${error.message}`, siteId);
        }
      }
    }

    logInfo('AUTOMATION', `Auto-install processing complete: ${processed} processed, ${successful} successful, ${failed} failed`);

    return {
      processed: processed,
      successful: successful,
      failed: failed
    };

  } catch (error) {
    logError('AUTOMATION', `Failed to process auto-install sites: ${error.message}`);
    throw error;
  }
}

/**
 * Process content with "Deploy Content" checkbox enabled
 *
 * Scans Content Queue sheet for rows with Deploy Content checkbox checked,
 * and triggers automated deployment for each.
 *
 * This function should be scheduled to run periodically (e.g., hourly)
 */
function processContentDeployment() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Content Queue');
    const data = sheet.getDataRange().getValues();

    logInfo('AUTOMATION', 'Processing content deployment queue...');

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Check each content item (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const contentId = data[i][0];
      const siteId = data[i][1];
      const deployContent = data[i][6]; // Column 7 (0-indexed = 6)
      const status = data[i][4]; // Column 5

      // Only process if checkbox is checked and status is "Pending" or "Draft"
      if (deployContent === true && (status === 'Pending' || status === 'Draft')) {
        processed++;

        try {
          logInfo('AUTOMATION', `Auto-deploying content ${contentId}...`, siteId);

          const productIds = data[i][5]; // Column 6 - Product IDs (comma-separated)
          const contentType = data[i][2]; // Column 3

          // Parse product IDs
          const asins = productIds ? productIds.toString().split(',').map(s => s.trim()) : [];

          if (asins.length === 0) {
            throw new Error('No products specified for content generation');
          }

          const result = deploySelectedContent(siteId, contentType, asins, {
            autoPublish: true,
            title: data[i][3] // Use title from Content Queue
          });

          if (result.success) {
            successful++;
            // Uncheck the Deploy Content checkbox after successful deployment
            sheet.getRange(row, 7).setValue(false);
            // Update status
            sheet.getRange(row, 5).setValue('Published');
            logSuccess('AUTOMATION', `Content deployment completed for ${contentId}`, siteId);
          } else {
            failed++;
            sheet.getRange(row, 5).setValue('Failed');
            logError('AUTOMATION', `Content deployment failed for ${contentId}`, siteId);
          }

          // Wait between deployments
          Utilities.sleep(5000);

        } catch (error) {
          failed++;
          sheet.getRange(row, 5).setValue('Failed');
          logError('AUTOMATION', `Content deployment error for ${contentId}: ${error.message}`, siteId);
        }
      }
    }

    logInfo('AUTOMATION', `Content deployment processing complete: ${processed} processed, ${successful} successful, ${failed} failed`);

    return {
      processed: processed,
      successful: successful,
      failed: failed
    };

  } catch (error) {
    logError('AUTOMATION', `Failed to process content deployment: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// SCHEDULED AUTOMATION (Cloud Scheduler / Triggers)
// =============================================================================

/**
 * Daily Amazon product synchronization
 *
 * Updates pricing, availability, and ratings for all products in the Products sheet.
 * Should be scheduled to run daily via Google Apps Script triggers.
 */
function dailyAmazonSync() {
  try {
    logInfo('AUTOMATION', 'Starting daily Amazon product synchronization...');

    const result = syncAllProducts();

    logSuccess('AUTOMATION', `Daily sync completed: ${result.updated} products updated`);

    return result;
  } catch (error) {
    logError('AUTOMATION', `Daily sync failed: ${error.message}`);
    throw error;
  }
}

/**
 * Hourly automation check
 *
 * Checks for:
 * 1. Sites with Auto Install checkbox enabled
 * 2. Content with Deploy Content checkbox enabled
 *
 * Should be scheduled to run hourly via Google Apps Script triggers.
 */
function hourlyAutomationCheck() {
  try {
    logInfo('AUTOMATION', 'Starting hourly automation check...');

    const results = {
      autoInstall: { processed: 0, successful: 0, failed: 0 },
      contentDeploy: { processed: 0, successful: 0, failed: 0 }
    };

    // Process auto-install sites
    try {
      results.autoInstall = processAutoInstallSites();
    } catch (error) {
      logError('AUTOMATION', `Auto-install processing failed: ${error.message}`);
    }

    // Process content deployment
    try {
      results.contentDeploy = processContentDeployment();
    } catch (error) {
      logError('AUTOMATION', `Content deployment processing failed: ${error.message}`);
    }

    logSuccess('AUTOMATION', `Hourly check completed: ${results.autoInstall.processed} sites, ${results.contentDeploy.processed} content items`);

    return results;
  } catch (error) {
    logError('AUTOMATION', `Hourly automation check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Setup automated triggers
 *
 * Creates time-based triggers for:
 * - Daily Amazon sync (3 AM)
 * - Hourly automation check
 *
 * Run this function once to set up automation.
 */
function setupAutomatedTriggers() {
  try {
    // Delete existing triggers first
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'dailyAmazonSync' ||
          trigger.getHandlerFunction() === 'hourlyAutomationCheck') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Daily sync at 3 AM
    ScriptApp.newTrigger('dailyAmazonSync')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();

    // Hourly automation check
    ScriptApp.newTrigger('hourlyAutomationCheck')
      .timeBased()
      .everyHours(1)
      .create();

    logSuccess('AUTOMATION', 'Automated triggers created successfully');

    SpreadsheetApp.getUi().alert(
      '✅ Automation Triggers Created',
      'The following triggers have been set up:\n\n' +
      '1. Daily Amazon Sync - 3:00 AM every day\n' +
      '2. Hourly Automation Check - Every hour\n\n' +
      'These will run automatically in the background.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return true;
  } catch (error) {
    logError('AUTOMATION', `Failed to setup triggers: ${error.message}`);
    throw error;
  }
}

/**
 * Remove automated triggers
 *
 * Deletes all automation triggers.
 */
function removeAutomatedTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'dailyAmazonSync' ||
          trigger.getHandlerFunction() === 'hourlyAutomationCheck') {
        ScriptApp.deleteTrigger(trigger);
        deleted++;
      }
    });

    logSuccess('AUTOMATION', `Removed ${deleted} automation triggers`);

    SpreadsheetApp.getUi().alert(
      '✅ Triggers Removed',
      `${deleted} automation trigger(s) have been removed.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return deleted;
  } catch (error) {
    logError('AUTOMATION', `Failed to remove triggers: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// PHASE H: FULL ONBOARDING PIPELINE
// =============================================================================

/**
 * Pełny pipeline onboardingu nowej strony.
 * Jeden przycisk: od czyszczenia po email z raportem.
 *
 * Kroki:
 * 1. Cleanup po klonowaniu
 * 2. Setup auth (Application Password)
 * 3. Install missing plugins (check via WP REST API)
 * 4. Configure branding (Site Title, Tagline z Sites sheet)
 * 5. Products (count/note — export separately via WooCommerce Export)
 * 6. SEO setup (meta, IndexNow via waas-settings API)
 * 7. Register in search engines (GSC, Bing)
 * 8. Generate launch report + save PDF to Drive
 * 9. Send email to service@netanaliza.com
 * 10. (Optional) Export to Notion
 *
 * @param {string} siteId — ID strony w Sites sheet
 * @param {Object} options — { skipCleanup, skipProducts, skipSEO, skipSearchEngines, skipReport, skipEmail, skipNotion }
 */
function launchNewSite(siteId, options) {
  options = options || {};
  var site = getSiteById(siteId);
  if (!site) throw new Error('Site not found: ' + siteId);

  var result = { siteId: siteId, domain: site.domain, steps: [], errors: [], startTime: new Date() };

  logInfo('LAUNCH', '========================================', siteId);
  logInfo('LAUNCH', 'STARTING FULL SITE LAUNCH: ' + site.name, siteId);
  logInfo('LAUNCH', '========================================', siteId);

  // STEP 1: Cleanup
  if (!options.skipCleanup) {
    try {
      logInfo('LAUNCH', 'Step 1/10: Cleaning up cloned site...', siteId);
      var cleanup = cleanupClonedSite(site, { dryRun: false });
      result.steps.push({ step: 1, name: 'Cleanup', success: cleanup.success, data: cleanup.data });
    } catch (e) {
      result.steps.push({ step: 1, name: 'Cleanup', success: false, error: e.message });
      result.errors.push('Step 1 Cleanup: ' + e.message);
      logError('LAUNCH', 'Cleanup failed: ' + e.message, siteId);
    }
  } else {
    result.steps.push({ step: 1, name: 'Cleanup', success: true, skipped: true });
  }

  // STEP 2: Auth
  try {
    logInfo('LAUNCH', 'Step 2/10: Setting up authentication...', siteId);
    site = getSiteById(siteId); // refresh after cleanup
    
    // Always verify auth works before proceeding
    var authWorks = false;
    if (site.appPassword) {
      var baseUrl = site.wpUrl.replace(/\/+$/, '');
      var testResult = makeHttpRequest(baseUrl + '/wp-json/waas-settings/v1/auth-test', {
        method: 'GET',
        headers: { 'Authorization': getAuthHeader(site) }
      });
      authWorks = testResult.success && testResult.data && testResult.data.success;
      if (authWorks) {
        logInfo('LAUNCH', 'Existing auth verified OK', siteId);
      } else {
        logWarning('LAUNCH', 'Existing auth failed (401) — recreating...', siteId);
      }
    }
    
    if (!authWorks) {
      setupWordPressAuth(site);
      site = getSiteById(siteId); // refresh
    }
    result.steps.push({ step: 2, name: 'Auth', success: true });
  } catch (e) {
    result.steps.push({ step: 2, name: 'Auth', success: false, error: e.message });
    result.errors.push('Step 2 Auth: ' + e.message);
    logError('LAUNCH', 'Auth failed: ' + e.message, siteId);
    // Auth failure is critical — abort
    logError('LAUNCH', 'ABORTING: Cannot continue without auth', siteId);
    result.endTime = new Date();
    result.durationSeconds = Math.round((result.endTime - result.startTime) / 1000);
    return result;
  }

  // STEP 3: Install plugins
  try {
    logInfo('LAUNCH', 'Step 3/10: Checking plugins...', siteId);
    var pluginCheck = makeHttpRequest(site.wpUrl.replace(/\/+$/, '') + '/wp-json/wp/v2/plugins', {
      method: 'GET',
      headers: { 'Authorization': getAuthHeader(site) }
    });
    var activePlugins = [];
    if (pluginCheck.success && Array.isArray(pluginCheck.data)) {
      activePlugins = pluginCheck.data.filter(function(p) { return p.status === 'active'; }).map(function(p) { return p.plugin; });
    }
    result.steps.push({ step: 3, name: 'Plugins', success: true, activePlugins: activePlugins.length });
    logInfo('LAUNCH', 'Active plugins: ' + activePlugins.length, siteId);
  } catch (e) {
    result.steps.push({ step: 3, name: 'Plugins', success: false, error: e.message });
    result.errors.push('Step 3 Plugins: ' + e.message);
  }

  // STEP 4: Branding
  try {
    logInfo('LAUNCH', 'Step 4/10: Configuring branding...', siteId);
    var brandResult = updateSiteBranding(site); // z SiteCleanup.gs
    result.steps.push({ step: 4, name: 'Branding', success: brandResult.success });
  } catch (e) {
    result.steps.push({ step: 4, name: 'Branding', success: false, error: e.message });
    result.errors.push('Step 4 Branding: ' + e.message);
  }

  // STEP 5: Products (skip if no products selected)
  if (!options.skipProducts) {
    try {
      logInfo('LAUNCH', 'Step 5/10: Products...', siteId);
      var prodCount = _countProductsForDomain(site.domain); // z LaunchReport.gs
      result.steps.push({ step: 5, name: 'Products', success: true, count: prodCount, note: 'Export separately via WooCommerce Export' });
      logInfo('LAUNCH', 'Products in sheet for this domain: ' + prodCount, siteId);
    } catch (e) {
      result.steps.push({ step: 5, name: 'Products', success: false, error: e.message });
    }
  } else {
    result.steps.push({ step: 5, name: 'Products', success: true, skipped: true });
  }

  // STEP 6: SEO
  if (!options.skipSEO) {
    try {
      logInfo('LAUNCH', 'Step 6/10: SEO setup...', siteId);
      var seoResult = _seoApiPost(site, '/bulk-meta', { post_type: 'product' });
      result.steps.push({ step: 6, name: 'SEO', success: seoResult.success });
    } catch (e) {
      result.steps.push({ step: 6, name: 'SEO', success: false, error: e.message });
      result.errors.push('Step 6 SEO: ' + e.message);
    }
  } else {
    result.steps.push({ step: 6, name: 'SEO', success: true, skipped: true });
  }

  // STEP 7: Search Engines
  if (!options.skipSearchEngines) {
    try {
      logInfo('LAUNCH', 'Step 7/10: Search engine registration...', siteId);
      var seResult = registerInAllSearchEngines(site); // z SearchEngines.gs
      result.steps.push({ step: 7, name: 'Search Engines', success: true, data: seResult });
    } catch (e) {
      result.steps.push({ step: 7, name: 'Search Engines', success: false, error: e.message });
      result.errors.push('Step 7 Search Engines: ' + e.message);
    }
  } else {
    result.steps.push({ step: 7, name: 'Search Engines', success: true, skipped: true });
  }

  // STEP 8: Launch Report + Drive
  var report = null;
  var driveUrl = null;
  if (!options.skipReport) {
    try {
      logInfo('LAUNCH', 'Step 8/10: Generating report...', siteId);
      report = generateLaunchReport(siteId); // z LaunchReport.gs
      var driveResult = saveLaunchReportToDrive(siteId, report); // z LaunchReport.gs
      driveUrl = driveResult.success ? driveResult.url : null;
      result.steps.push({ step: 8, name: 'Report', success: true, driveUrl: driveUrl });
    } catch (e) {
      result.steps.push({ step: 8, name: 'Report', success: false, error: e.message });
      result.errors.push('Step 8 Report: ' + e.message);
    }
  }

  // STEP 9: Email
  if (!options.skipEmail && report) {
    try {
      logInfo('LAUNCH', 'Step 9/10: Sending launch email...', siteId);
      var emailResult = sendLaunchEmail(siteId, report, driveUrl); // z LaunchReport.gs
      result.steps.push({ step: 9, name: 'Email', success: emailResult.success });
    } catch (e) {
      result.steps.push({ step: 9, name: 'Email', success: false, error: e.message });
      result.errors.push('Step 9 Email: ' + e.message);
    }
  }

  // STEP 10: Notion — DISABLED (report saved to Drive is sufficient)
  // To re-enable: set options.skipNotion = false
  result.steps.push({ step: 10, name: 'Notion', success: true, skipped: true });

  // Summary
  result.endTime = new Date();
  result.durationSeconds = Math.round((result.endTime - result.startTime) / 1000);
  var successCount = result.steps.filter(function(s) { return s.success; }).length;

  logSuccess('LAUNCH', '========================================', siteId);
  logSuccess('LAUNCH', 'LAUNCH COMPLETE: ' + successCount + '/' + result.steps.length + ' steps OK (' + result.durationSeconds + 's)', siteId);
  logSuccess('LAUNCH', '========================================', siteId);

  return result;
}

/**
 * Dialog: NEW SITE WIZARD
 */
function newSiteWizardDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('NEW SITE WIZARD',
    'Podaj Site ID strony do pełnego onboardingu.\n\n' +
    'Pipeline: Cleanup → Auth → Plugins → Branding → SEO → GSC/Bing → Report → Email',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  var siteId = r.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) { ui.alert('Nie znaleziono strony: ' + siteId); return; }

  var confirm = ui.alert('Potwierdzenie',
    'Strona: ' + site.name + ' (' + site.domain + ')\n\n' +
    'Czy uruchomić pełny pipeline onboardingu?\n' +
    '(Cleanup, Auth, Branding, SEO, GSC, Bing, Report, Email)',
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  ui.alert('Uruchamiam...', 'Pipeline trwa 1-3 minuty. Sprawdź logi.', ui.ButtonSet.OK);

  var result = launchNewSite(siteId);

  var successCount = result.steps.filter(function(s) { return s.success; }).length;
  var msg = 'Pipeline zakończony!\n\n' +
    'Wynik: ' + successCount + '/' + result.steps.length + ' kroków OK\n' +
    'Czas: ' + result.durationSeconds + 's\n';
  if (result.errors.length > 0) {
    msg += '\nBłędy:\n' + result.errors.join('\n');
  }
  ui.alert('Launch Complete', msg, ui.ButtonSet.OK);
}

// =============================================================================
// AUTH DIAGNOSTIC TEST
// =============================================================================

/**
 * Test authentication against a site
 * Run this manually: WAAS → Automation → Test Auth
 */
function testAuthForSite() {
  var siteId = 11; // waermebildmessung
  var site = getSiteById(siteId);
  if (!site) { Logger.log('Site not found'); return; }
  
  var baseUrl = site.wpUrl.replace(/\/+$/, '');
  var authHeader = getAuthHeader(site);
  
  Logger.log('=== AUTH DIAGNOSTIC v2 ===');
  Logger.log('Site: ' + site.domain);
  Logger.log('Auth header present: ' + (authHeader ? 'YES' : 'NO'));
  Logger.log('Auth header length: ' + (authHeader ? authHeader.length : 0));
  Logger.log('App Password in sheet: ' + (site.appPassword ? 'YES (' + site.appPassword.length + ' chars): ' + site.appPassword.substring(0, 4) + '...' : 'NO'));
  Logger.log('Auth Type: ' + (site.authType || 'not set'));
  
  // Test 1: PUBLIC header-debug endpoint (no auth needed) — shows what WP REST API sees
  Logger.log('\n--- Test 1: Header debug (PUBLIC, no auth needed) ---');
  try {
    var resp1 = UrlFetchApp.fetch(baseUrl + '/wp-json/waas-settings/v1/header-debug', {
      method: 'get',
      headers: {
        'Authorization': authHeader,
        'X-WAAS-Auth': authHeader
      },
      muteHttpExceptions: true
    });
    Logger.log('Status: ' + resp1.getResponseCode());
    Logger.log('Full body: ' + resp1.getContentText());
  } catch(e) {
    Logger.log('Error: ' + e.message);
  }
  
  // Test 2: auth-test endpoint (needs auth) — verifies WP recognizes user
  Logger.log('\n--- Test 2: auth-test (requires auth) ---');
  var result2 = makeHttpRequest(baseUrl + '/wp-json/waas-settings/v1/auth-test', {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });
  Logger.log('Result: ' + JSON.stringify(result2).substring(0, 500));
  
  Logger.log('\n=== END DIAGNOSTIC v2 ===');
}

// =============================================================================
// SETUP EXISTING SITES
// =============================================================================

/**
 * Setup an existing site — installs auth, registers in search engines.
 * Prerequisites: waas-settings plugin must be installed on the site.
 * 
 * Steps:
 * 1. Check if waas-settings plugin is reachable
 * 2. Setup Application Password auth
 * 3. Test auth
 * 4. Register in Google Search Console
 * 5. Register in Bing
 * 6. Update site status in sheet
 */
function setupExistingSite(siteId) {
  var site = getSiteById(siteId);
  if (!site) throw new Error('Site not found: ' + siteId);
  
  logInfo('SETUP', 'Setting up existing site: ' + site.name + ' (' + site.domain + ')', siteId);
  
  var results = { steps: [], errors: [] };
  
  // Step 1: Check if waas-settings plugin is reachable
  try {
    logInfo('SETUP', 'Step 1/5: Checking waas-settings plugin...', siteId);
    var checkUrl = 'https://' + site.domain + '/wp-json/waas-settings/v1/header-debug';
    var resp = UrlFetchApp.fetch(checkUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      logSuccess('SETUP', 'Plugin already installed', siteId);
      results.steps.push({ step: 1, name: 'Plugin Check', success: true });
    } else {
      // Plugin not found — auto-install via cookie auth
      logInfo('SETUP', 'Plugin not found, auto-installing...', siteId);
      var installResult = installWaasSettingsPlugin(site);
      if (installResult && installResult.success) {
        logSuccess('SETUP', 'waas-settings plugin installed!', siteId);
        results.steps.push({ step: 1, name: 'Plugin Install', success: true });
        Utilities.sleep(3000); // Wait for plugin to initialize
      } else {
        throw new Error('Auto-install failed: ' + (installResult ? installResult.error : 'unknown'));
      }
    }
  } catch (e) {
    logError('SETUP', 'Plugin check failed: ' + e.message, siteId);
    results.steps.push({ step: 1, name: 'Plugin Check', success: false, error: e.message });
    results.errors.push('Step 1: ' + e.message);
    return results; // Can't continue without plugin
  }
  
  // Step 2: Setup auth
  try {
    logInfo('SETUP', 'Step 2/5: Setting up authentication...', siteId);
    var authResult = setupWordPressAuth(site); // from WordPressAuth.gs
    if (authResult && authResult.success) {
      logSuccess('SETUP', 'Auth configured', siteId);
      results.steps.push({ step: 2, name: 'Auth Setup', success: true });
    } else {
      // Auth might already exist — check
      var existingAuth = getAuthHeader(site);
      if (existingAuth) {
        logInfo('SETUP', 'Auth already exists, testing...', siteId);
        results.steps.push({ step: 2, name: 'Auth Setup', success: true, note: 'existing' });
      } else {
        throw new Error('Auth setup failed: ' + JSON.stringify(authResult));
      }
    }
  } catch (e) {
    logError('SETUP', 'Auth setup failed: ' + e.message, siteId);
    results.steps.push({ step: 2, name: 'Auth Setup', success: false, error: e.message });
    results.errors.push('Step 2: ' + e.message);
  }
  
  // Step 3: Test auth
  try {
    logInfo('SETUP', 'Step 3/5: Testing authentication...', siteId);
    site = getSiteById(siteId); // RELOAD site to get newly saved app password
    var testResult = testWordPressAuth(site); // from WordPressAuth.gs / Core.gs
    if (testResult && testResult.success) {
      logSuccess('SETUP', 'Auth works: user=' + (testResult.user || 'ok'), siteId);
      results.steps.push({ step: 3, name: 'Auth Test', success: true });
    } else {
      throw new Error('Auth test failed: ' + JSON.stringify(testResult));
    }
  } catch (e) {
    logError('SETUP', 'Auth test failed: ' + e.message, siteId);
    results.steps.push({ step: 3, name: 'Auth Test', success: false, error: e.message });
    results.errors.push('Step 3: ' + e.message);
  }
  
  // Step 4-5: Search engines
  try {
    logInfo('SETUP', 'Step 4-5/5: Registering in search engines...', siteId);
    var seResult = registerInAllSearchEngines(site);
    var seOk = Object.values(seResult).filter(function(r) { return r && r.success; }).length;
    logSuccess('SETUP', 'Search engines: ' + seOk + '/4', siteId);
    results.steps.push({ step: 4, name: 'Search Engines', success: seOk > 0, data: seResult });
  } catch (e) {
    logWarning('SETUP', 'Search engines: ' + e.message, siteId);
    results.steps.push({ step: 4, name: 'Search Engines', success: false, error: e.message });
  }
  
  var successCount = results.steps.filter(function(s) { return s.success; }).length;
  logSuccess('SETUP', 'SETUP COMPLETE: ' + successCount + '/' + results.steps.length + ' steps OK', siteId);
  
  return results;
}

/**
 * Setup ALL existing sites in the sheet that have a domain but missing auth.
 */
function setupAllExistingSites() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sites');
  var data = sheet.getDataRange().getValues();
  
  var results = [];
  var processed = 0;
  var succeeded = 0;
  
  for (var i = 1; i < data.length; i++) {
    var siteId = data[i][0];
    var domain = data[i][2]; // Column C = domain
    var status = data[i][3]; // Column D = status
    
    if (!siteId || !domain) continue;
    
    processed++;
    logInfo('SETUP', 'Processing site ' + processed + ': ' + domain + ' (ID: ' + siteId + ')');
    
    try {
      var result = setupExistingSite(siteId);
      var ok = result.steps.filter(function(s) { return s.success; }).length;
      if (ok >= 3) succeeded++; // At least plugin + auth + auth-test
      results.push({ siteId: siteId, domain: domain, success: ok >= 3, steps: ok + '/' + result.steps.length });
    } catch (e) {
      logError('SETUP', 'Failed for ' + domain + ': ' + e.message);
      results.push({ siteId: siteId, domain: domain, success: false, error: e.message });
    }
    
    Utilities.sleep(2000); // Rate limiting between sites
  }
  
  logSuccess('SETUP', 'BULK SETUP COMPLETE: ' + succeeded + '/' + processed + ' sites configured');
  return results;
}

// --- Dialogs ---

function setupExistingSiteDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    '🔧 Setup Existing Site',
    'Enter Site ID.\n\nPrerequisite: waas-settings plugin must be installed on the site.\n(Upload waas-settings.zip through WP Admin → Plugins → Add New → Upload)',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  
  var siteId = result.getResponseText().trim();
  if (!siteId) { ui.alert('No Site ID provided'); return; }
  
  var setupResult = setupExistingSite(siteId);
  var ok = setupResult.steps.filter(function(s) { return s.success; }).length;
  var total = setupResult.steps.length;
  
  var msg = 'Setup: ' + ok + '/' + total + ' steps OK\n\n';
  setupResult.steps.forEach(function(s) {
    msg += (s.success ? '✅' : '❌') + ' ' + s.name + (s.error ? ': ' + s.error : '') + '\n';
  });
  
  ui.alert('Setup Result', msg, ui.ButtonSet.OK);
}

function setupAllExistingSitesDialog() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    '🔧 Setup ALL Existing Sites',
    'This will setup auth and search engine registration for ALL sites in the sheet.\n\n' +
    'Prerequisites:\n• waas-settings plugin must be installed on each site\n• Sites must be accessible\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  var results = setupAllExistingSites();
  
  var ok = results.filter(function(r) { return r.success; }).length;
  var msg = 'Bulk Setup: ' + ok + '/' + results.length + ' sites configured\n\n';
  results.forEach(function(r) {
    msg += (r.success ? '✅' : '❌') + ' ' + r.domain + ' (' + (r.steps || r.error) + ')\n';
  });
  
  ui.alert('Bulk Setup Result', msg, ui.ButtonSet.OK);
}

/**
 * Install waas-settings plugin on a site via cookie auth (WP admin upload).
 * No existing plugin or app password needed — uses admin credentials from sheet.
 */
function installWaasSettingsPlugin(site) {
  try {
    // Step 1: Login via cookies
    logInfo('SETUP', 'Logging in to WordPress admin...', site.id);
    var loginResult = wordpressLogin(site);
    if (!loginResult.success) {
      return { success: false, error: 'Login failed: ' + loginResult.error };
    }
    var cookies = loginResult.cookies;
    
    // Step 2: Check if plugin is already in plugins list
    logInfo('SETUP', 'Checking plugins page...', site.id);
    var pluginsUrl = site.wpUrl + '/wp-admin/plugins.php';
    var pluginsResp = UrlFetchApp.fetch(pluginsUrl, {
      method: 'get',
      headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      muteHttpExceptions: true, followRedirects: true
    });
    var html = pluginsResp.getContentText();
    
    var isActive = html.indexOf('waas-settings') > -1 && html.indexOf('action=deactivate') > -1 && 
                   html.indexOf('waas-settings') < html.indexOf('action=deactivate', html.indexOf('waas-settings'));
    
    // More reliable check: look for deactivate link near waas-settings
    var waasIdx = html.indexOf('data-slug="waas-settings"');
    if (waasIdx === -1) waasIdx = html.indexOf('waas-settings/waas-settings.php');
    
    if (waasIdx > -1) {
      // Plugin exists in list - check if active (deactivate link present nearby)
      var nearbyHtml = html.substring(Math.max(0, waasIdx - 500), Math.min(html.length, waasIdx + 2000));
      if (nearbyHtml.indexOf('action=deactivate') > -1) {
        logInfo('SETUP', 'waas-settings already active!', site.id);
        return { success: true, note: 'already_active' };
      }
      
      // Plugin installed but inactive - find activation link
      logInfo('SETUP', 'Plugin installed but inactive, activating...', site.id);
      var activateMatch = nearbyHtml.match(/href="([^"]*action=activate[^"]*waas-settings[^"]*)"/);
      if (!activateMatch) {
        activateMatch = nearbyHtml.match(/href="([^"]*waas-settings[^"]*action=activate[^"]*)"/);
      }
      
      if (activateMatch) {
        var activateUrl = activateMatch[1].replace(/&amp;/g, '&');
        if (activateUrl.indexOf('http') !== 0) {
          activateUrl = site.wpUrl + '/wp-admin/' + activateUrl;
        }
        logInfo('SETUP', 'Activating via: ' + activateUrl.substring(0, 100), site.id);
        var actResp = UrlFetchApp.fetch(activateUrl, {
          method: 'get',
          headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          muteHttpExceptions: true, followRedirects: true
        });
        if (actResp.getResponseCode() === 200) {
          logSuccess('SETUP', 'Plugin activated!', site.id);
        }
      } else {
        logWarning('SETUP', 'Could not find activation link, trying direct activate URL...', site.id);
        // Try direct activation URL format
        var directUrl = site.wpUrl + '/wp-admin/plugins.php?action=activate&plugin=waas-settings%2Fwaas-settings.php&_wpnonce=';
        // Get nonce from page
        var nonceMatch = html.match(/action=activate&amp;plugin=waas-settings[^"]*_wpnonce=([a-f0-9]+)/);
        if (nonceMatch) {
          directUrl = site.wpUrl + '/wp-admin/plugins.php?action=activate&plugin=waas-settings%2Fwaas-settings.php&_wpnonce=' + nonceMatch[1];
          UrlFetchApp.fetch(directUrl, {
            method: 'get',
            headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0' },
            muteHttpExceptions: true, followRedirects: true
          });
        }
      }
    } else {
      // Plugin not installed — upload it
      logInfo('SETUP', 'Plugin not found, uploading...', site.id);
      var githubUrl = 'https://github.com/LUKOAI/LUKO-WAAS/raw/main/wordpress-plugin/waas-settings.zip';
      var zipResp = UrlFetchApp.fetch(githubUrl, { muteHttpExceptions: true, followRedirects: true });
      if (zipResp.getResponseCode() !== 200) {
        return { success: false, error: 'Failed to download ZIP from GitHub' };
      }
      var pluginBlob = zipResp.getBlob().setName('waas-settings.zip');
      logInfo('SETUP', 'Downloaded: ' + (pluginBlob.getBytes().length / 1024).toFixed(0) + ' KB', site.id);
      
      var installed = installPluginOnWordPress(site, pluginBlob, 'waas-settings');
      if (!installed) {
        return { success: false, error: 'Plugin upload failed' };
      }
      
      // After upload, WP usually auto-activates or shows activate link
      // Try activation
      activatePluginOnWordPress(site, 'waas-settings/waas-settings.php');
    }
    
    // Step 3: Verify plugin is active by hitting its endpoint
    Utilities.sleep(2000);
    var verifyUrl = 'https://' + site.domain + '/wp-json/waas-settings/v1/header-debug';
    var verifyResp = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
    if (verifyResp.getResponseCode() === 200) {
      logSuccess('SETUP', 'waas-settings plugin verified active!', site.id);
      return { success: true };
    } else {
      logWarning('SETUP', 'Plugin endpoint returned ' + verifyResp.getResponseCode() + ' — may need manual activation', site.id);
      return { success: false, error: 'Plugin installed but endpoint not responding (HTTP ' + verifyResp.getResponseCode() + ')' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
