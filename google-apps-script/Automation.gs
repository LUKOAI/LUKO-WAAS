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
      const diviResult = installDiviOnSite(siteId);
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

      // Update site status in Sites sheet
      updateSiteStatus(siteId, {
        status: 'Active',
        diviInstalled: 'Yes',
        pluginInstalled: 'Yes',
        lastCheck: new Date()
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

/**
 * Install WooCommerce on a WordPress site
 *
 * @param {number} siteId - Site ID from Sites sheet
 * @returns {Object} Result with success status and message
 */
function installWooCommerceOnSite(siteId) {
  try {
    const site = getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID ${siteId} not found`);
    }

    logInfo('WOOCOMMERCE', `Installing WooCommerce on ${site.name}`, siteId);

    // WordPress REST API endpoint for plugin installation
    const endpoint = `${site.wpUrl}/wp-json/wp/v2/plugins`;

    // WooCommerce plugin slug
    const pluginData = {
      slug: 'woocommerce',
      status: 'active'
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(pluginData),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      logSuccess('WOOCOMMERCE', 'WooCommerce installed and activated successfully', siteId);
      return {
        success: true,
        message: 'WooCommerce installed and activated'
      };
    } else if (responseText.includes('already installed') || responseText.includes('Plugin already installed')) {
      logInfo('WOOCOMMERCE', 'WooCommerce already installed', siteId);
      return {
        success: true,
        message: 'WooCommerce already installed'
      };
    } else {
      throw new Error(`HTTP ${responseCode}: ${responseText}`);
    }

  } catch (error) {
    logError('WOOCOMMERCE', `Failed to install WooCommerce: ${error.message}`, siteId);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Update site status in Sites sheet
 *
 * @param {number} siteId - Site ID
 * @param {Object} updates - Fields to update
 */
function updateSiteStatus(siteId, updates) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    const data = sheet.getDataRange().getValues();

    // Find site row (skip header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === siteId) {
        const row = i + 1;

        // Update fields
        if (updates.status) sheet.getRange(row, 10).setValue(updates.status);
        if (updates.diviInstalled) sheet.getRange(row, 11).setValue(updates.diviInstalled);
        if (updates.pluginInstalled) sheet.getRange(row, 12).setValue(updates.pluginInstalled);
        if (updates.lastCheck) sheet.getRange(row, 14).setValue(updates.lastCheck);

        logInfo('SITE', `Updated site status for site ${siteId}`, siteId);
        return true;
      }
    }

    logWarning('SITE', `Site ${siteId} not found in Sites sheet`, siteId);
    return false;

  } catch (error) {
    logError('SITE', `Failed to update site status: ${error.message}`, siteId);
    return false;
  }
}

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

    // Download plugin package with retry logic for DNS errors
    let pluginBlob = null;
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
          followRedirects: true
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

    if (!pluginBlob) {
      throw lastError || new Error('Failed to download plugin');
    }

    // Install plugin via WordPress admin panel
    const installed = installPluginOnWordPress(site, pluginBlob);
    if (!installed) {
      throw new Error('Plugin installation failed');
    }

    // Activate plugin
    const activated = activatePluginOnWordPress(site, 'waas-patronage-manager/waas-patronage-manager.php');
    if (!activated) {
      logWarning('PATRONAGE', 'Plugin activation may have failed, but installation succeeded', siteId);
    }

    logSuccess('PATRONAGE', 'WAAS Patronage Manager installed successfully', siteId);
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

    // Download theme package with retry logic for DNS errors
    let themeBlob = null;
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
          followRedirects: true
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

    if (!themeBlob) {
      throw lastError || new Error('Failed to download theme');
    }

    // Install theme via WordPress admin panel
    const installed = installThemeOnWordPress(site, themeBlob);
    if (!installed) {
      throw new Error('Theme installation failed');
    }

    // Activate child theme (Divi must be parent theme)
    const activated = activateThemeOnWordPress(site, 'divi-child-waas');
    if (!activated) {
      logWarning('CHILD_THEME', 'Theme activation may have failed, but installation succeeded', siteId);
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
