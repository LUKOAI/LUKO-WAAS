/**
 * WAAS Menu Module
 * Interfejs użytkownika i menu
 */

// =============================================================================
// MENU GŁÓWNE
// =============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ WAAS')
    .addSubMenu(ui.createMenu('🌐 Sites')
      .addItem('➕ Add New Site', 'showAddSiteDialog')
      .addItem('✅ Check Site Status', 'showCheckSiteDialog')
      .addItem('🎨 Install Divi on Site', 'showInstallDiviDialog')
      .addItem('🔌 Install Plugin on Site', 'showInstallPluginDialog')
      .addItem('🧹 Cleanup Cloned Site', 'siteCleanupDialog')
      .addItem('ℹ️ Site Full Info', 'siteInfoDialog')
      .addItem('🎨 Update Branding', 'siteBrandingDialog')
      .addSeparator()
      .addItem('🔄 Refresh All Sites', 'refreshAllSites'))
    .addSubMenu(ui.createMenu('📦 Products')
      .addItem('📥 Import by ASIN', 'showImportByAsinDialog')
      .addItem('🔍 Import by Search', 'showImportProductsDialog')
      .addItem('🔄 Update Product Data', 'showUpdateProductsDialog')
      .addItem('🔄 Sync All Products', 'syncAllProducts')
      .addSeparator()
      .addItem('📊 Product Statistics', 'showProductStats')
      .addItem('💰 Price Sync (Site)', 'priceSyncDialog')
      .addItem('🏗️ Setup Products Sheet', 'setupProductsSheet'))
    .addSubMenu(ui.createMenu('📡 SP-API Import')
      .addItem('📥 Import by ASIN', 'spMenuImportByASIN')
      .addItem('📥 Import ASIN + Warianty', 'spMenuImportWithVariants')
      .addItem('🔍 Search by Keyword', 'spMenuSearchByKeyword')
      .addItem('📋 Import from Selection', 'spMenuImportFromSelection')
      .addSeparator()
      .addItem('🔐 Setup Credentials', 'spSetupCredentials')
      .addItem('🔌 Test Connection', 'spTestConnection'))
    .addSubMenu(ui.createMenu('🛒 WooCommerce Export')
      .addItem('✅ Select All Products', 'selectAllProducts')
      .addItem('❌ Deselect All Products', 'deselectAllProducts')
      .addSeparator()
      .addItem('📤 Export Selected Products', 'showExportToWooCommerceDialog')
      .addItem('📤 Export All Products', 'exportAllToWooCommerce')
      .addSeparator()
      .addItem('🔄 Sync from WordPress', 'syncProductsFromWordPress')
      .addSeparator()
      .addItem('⚙️ Setup Export Columns', 'setupWooCommerceExportColumns')
      .addItem('🔄 Refresh Domain Dropdown', 'refreshTargetDomainDropdown'))
    .addSubMenu(ui.createMenu('📝 Content')
      .addItem('✍️ Generate Content', 'showGenerateContentDialog')
      .addItem('📤 Publish Scheduled Content', 'publishScheduledContent')
      .addItem('📋 View Content Queue', 'focusContentQueue')
      .addSeparator()
      .addItem('🗑️ Clear Failed Content', 'clearFailedContent'))
    .addSubMenu(ui.createMenu('🔍 SEO')
      .addItem('📝 Generate Product Meta (Site)', 'seoMenuProductMeta')
      .addItem('📊 SEO Health Check (Site)', 'seoMenuHealthCheck')
      .addItem('📋 Deploy Schema Plugin (Site)', 'seoMenuDeploySchema')
      .addItem('📡 Submit to IndexNow (Site)', 'seoMenuIndexNow')
      .addSeparator()
      .addItem('🚀 Full SEO Setup (Site)', 'seoMenuFullSetup')
      .addItem('📊 SEO Health Check ALL', 'seoMenuHealthCheckAll'))
    .addSubMenu(ui.createMenu('🌍 Search Engines')
      .addItem('📡 Register in Google Search Console', 'gscRegisterDialog')
      .addItem('📡 Register in Bing Webmaster', 'bingRegisterDialog')
      .addSeparator()
      .addItem('🗺️ Submit Sitemap to GSC', 'gscSitemapDialog')
      .addItem('🗺️ Submit Sitemap to Bing', 'bingSitemapDialog')
      .addSeparator()
      .addItem('✅ Verify GSC Ownership', 'gscVerifyDialog')
      .addItem('✅ Verify Bing Ownership', 'bingVerifyDialog'))
    .addSubMenu(ui.createMenu('📊 Reports')
      .addItem('📄 Generate Launch Report', 'launchReportDialog')
      .addItem('📧 Send Launch Email', 'sendLaunchEmailDialog')
      .addItem('📝 Export to Notion', 'exportToNotionDialog')
      .addItem('💾 Save Report to Drive', 'saveReportToDriveDialog'))
    .addSubMenu(ui.createMenu('⚙️ Tasks')
      .addItem('👁️ View Active Tasks', 'focusActiveTasks')
      .addItem('▶️ Run Task Queue', 'runTaskQueue')
      .addItem('🗑️ Clear Completed Tasks', 'clearCompletedTasks')
      .addSeparator()
      .addItem('🔄 Retry Failed Tasks', 'retryFailedTasks'))
    .addSubMenu(ui.createMenu('🤖 Automation')
      .addItem('🚀 Install Full Stack', 'showInstallFullStackDialog')
      .addItem('🌟 NEW SITE WIZARD (Full Pipeline)', 'newSiteWizardDialog')
      .addItem('🔧 SETUP EXISTING SITE', 'setupExistingSiteDialog')
      .addItem('🔧 SETUP ALL EXISTING SITES', 'setupAllExistingSitesDialog')
      .addItem('📤 Deploy Selected Content', 'showDeployContentDialog')
      .addSeparator()
      .addItem('⚙️ Process Auto Install Sites', 'processAutoInstallSites')
      .addItem('📝 Process Content Deployment', 'processContentDeployment')
      .addSeparator()
      .addItem('⏰ Setup Automated Triggers', 'setupAutomatedTriggers')
      .addItem('🛑 Remove Automated Triggers', 'removeAutomatedTriggers')
      .addSeparator()
      .addItem('🔄 Daily Amazon Sync (Manual)', 'dailyAmazonSync')
      .addItem('🔄 Hourly Check (Manual)', 'hourlyAutomationCheck'))
    .addSubMenu(ui.createMenu('🔧 Settings')
      .addItem('🔑 Configure API Keys', 'showAPIKeyInstructions')
      .addItem('⚙️ System Settings', 'showSettingsDialog')
      .addItem('🧪 Test Connections', 'testAllConnections')
      .addSeparator()
      .addItem('🔐 Setup Auth for Site', 'showSetupAuthDialog')
      .addSeparator()
      .addItem('📊 View Logs', 'focusLogs')
      .addItem('🗑️ Clear Old Logs', 'clearOldLogs'))
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About WAAS', 'showAbout')
    .addToUi();
}

// =============================================================================
// DIALOGI - SITES
// =============================================================================

function showAddSiteDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #357ae8; }
    </style>

    <div class="form-group">
      <label>Site Name:</label>
      <input type="text" id="siteName" placeholder="My Affiliate Site">
    </div>

    <div class="form-group">
      <label>Domain:</label>
      <input type="text" id="domain" placeholder="example.com">
    </div>

    <div class="form-group">
      <label>WordPress URL:</label>
      <input type="text" id="wpUrl" placeholder="https://example.com">
    </div>

    <div class="form-group">
      <label>Admin Username:</label>
      <input type="text" id="username" placeholder="admin">
    </div>

    <div class="form-group">
      <label>Admin Password:</label>
      <input type="password" id="password">
    </div>

    <div class="form-group">
      <label>Notes:</label>
      <textarea id="notes" rows="3"></textarea>
    </div>

    <button onclick="addSite()">Add Site</button>

    <script>
      function addSite() {
        const data = {
          siteName: document.getElementById('siteName').value,
          domain: document.getElementById('domain').value,
          wpUrl: document.getElementById('wpUrl').value,
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
          notes: document.getElementById('notes').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Site added successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .addNewSite(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(500);

  ui.showModalDialog(html, 'Add New Site');
}

function addNewSite(data) {
  const sheet = getSitesSheet();
  const id = getNextId('Sites');

  sheet.appendRow([
    id,
    data.siteName,
    data.domain,
    data.wpUrl,
    data.username,
    data.password,
    'Pending',
    'No',
    'No',
    new Date(),
    new Date(),
    data.notes
  ]);

  logSuccess('Sites', `New site added: ${data.siteName} (ID: ${id})`);

  return id;
}

function showCheckSiteDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Check Site Status',
    'Enter Site ID to check:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      checkSiteStatus(siteId);
    }
  }
}

function showInstallDiviDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Install Divi',
    'Enter Site ID to install Divi theme:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      installDiviOnSite(siteId);
    }
  }
}

function showInstallPluginDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Install Plugin',
    'Enter Site ID to install WAAS Product Manager:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      installPluginOnSite(siteId);
    }
  }
}

// =============================================================================
// DIALOGI - PRODUCTS
// =============================================================================

// =============================================================================
// IMPORT BY ASIN DIALOG (restored from original)
// =============================================================================

function showImportByAsinDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, textarea, select { width: 100%; padding: 8px; box-sizing: border-box; }
      textarea { min-height: 150px; font-family: monospace; }
      button { background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #2d8e47; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 12px; }
      .info code { background: #d4e4fa; padding: 2px 4px; border-radius: 2px; }
    </style>

    <div class="info">
      <strong>Import Products by ASIN</strong><br>
      Enter Amazon ASINs (one per line). ASINs are 10-character codes like <code>B08N5WRWNW</code>.
    </div>

    <div class="form-group">
      <label>ASINs (one per line):</label>
      <textarea id="asins" placeholder="B08N5WRWNW
B07XJ8C8F5
B09G9FPHY6"></textarea>
    </div>

    <div class="form-group">
      <label>Category (optional):</label>
      <select id="category">
        <option value="">Auto-detect from Amazon</option>
        <option value="Automotive">Automotive</option>
        <option value="Electronics">Electronics</option>
        <option value="Home">Home & Kitchen</option>
        <option value="Sports">Sports & Outdoors</option>
        <option value="Tools">Tools & Home Improvement</option>
        <option value="Garden">Garden & Outdoor</option>
        <option value="Kitchen">Kitchen & Dining</option>
      </select>
    </div>

    <button onclick="importByAsin()">Import Products</button>

    <script>
      function importByAsin() {
        const asins = document.getElementById('asins').value.trim();
        const category = document.getElementById('category').value;

        if (!asins) {
          alert('Please enter at least one ASIN');
          return;
        }

        const asinList = asins.split(/[\\n,]+/).map(a => a.trim()).filter(a => a.length > 0);
        
        google.script.run
          .withSuccessHandler(function(result) {
            alert('Import complete! ' + (result || asinList.length + ' ASINs processed.') + ' Check the Products sheet.');
            google.script.host.close();
          })
          .withFailureHandler(function(err) {
            alert('Import error: ' + err.message);
          })
          .importProductsFromAmazon({
            asins: asinList,
            category: category,
            keywords: ''
          });
          
        alert('Import started for ' + asinList.length + ' ASINs. Check the Logs sheet for progress.');
      }
    </script>
  `)
    .setWidth(450)
    .setHeight(500);

  ui.showModalDialog(html, 'Import Products by ASIN');
}

// =============================================================================
// REFRESH DOMAIN DROPDOWN (restored from original)
// =============================================================================

function refreshTargetDomainDropdown() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const productsSheet = ss.getSheetByName('Products');
    const sitesSheet = ss.getSheetByName('Sites');

    if (!sitesSheet || !productsSheet) {
      throw new Error('Required sheets not found');
    }

    const sitesData = sitesSheet.getDataRange().getValues();
    const domains = [];

    for (let i = 1; i < sitesData.length; i++) {
      const domain = sitesData[i][2];
      if (domain) {
        domains.push(domain);
      }
    }

    if (domains.length === 0) {
      throw new Error('No domains found in Sites sheet');
    }

    const headers = productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).getValues()[0];
    const domainColIdx = headers.indexOf('Target Domain');

    if (domainColIdx === -1) {
      throw new Error('Target Domain column not found. Run Setup Export Columns first.');
    }

    const lastRow = Math.max(productsSheet.getLastRow(), 2);
    if (lastRow > 1) {
      const domainValidation = SpreadsheetApp.newDataValidation()
        .requireValueInList(domains, true)
        .build();
      productsSheet.getRange(2, domainColIdx + 1, lastRow - 1, 1).setDataValidation(domainValidation);
    }

    SpreadsheetApp.getUi().alert(
      'Success',
      'Domain dropdown updated with ' + domains.length + ' domains:\n' + domains.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    logSuccess('Products', 'Domain dropdown refreshed with ' + domains.length + ' domains');
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Error',
      'Failed to refresh dropdown: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    logError('Products', 'Failed to refresh dropdown: ' + error.message);
  }
}

// Alias
function setupProductsSheet() {
  setupWooCommerceExportColumns();
}

// =============================================================================
// PRODUCTS DIALOGS (existing)
// =============================================================================

function showImportProductsDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, textarea, select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #2d8e47; }
    </style>

    <div class="form-group">
      <label>Search Keywords:</label>
      <input type="text" id="keywords" placeholder="laptop, smartphone, etc.">
    </div>

    <div class="form-group">
      <label>Category:</label>
      <select id="category">
        <option value="">All Categories</option>
        <option value="Electronics">Electronics</option>
        <option value="Books">Books</option>
        <option value="Home">Home & Kitchen</option>
        <option value="Sports">Sports & Outdoors</option>
        <option value="Fashion">Fashion</option>
      </select>
    </div>

    <div class="form-group">
      <label>Number of Products:</label>
      <input type="number" id="count" value="10" min="1" max="50">
    </div>

    <button onclick="importProducts()">Import Products</button>

    <script>
      function importProducts() {
        const data = {
          keywords: document.getElementById('keywords').value,
          category: document.getElementById('category').value,
          count: parseInt(document.getElementById('count').value)
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Products imported successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .importProductsFromAmazon(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(400);

  ui.showModalDialog(html, 'Import Products from Amazon');
}

function showUpdateProductsDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Update Products',
    'Update price and availability for all products?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    updateProductData();
  }
}

function showProductStats() {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const total = data.length - 1;
  const active = data.filter((row, i) => i > 0 && row[9] === 'Active').length;

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Product Statistics',
    `Total Products: ${total}\nActive Products: ${active}\nInactive: ${total - active}`,
    ui.ButtonSet.OK
  );
}

// =============================================================================
// DIALOGI - CONTENT
// =============================================================================

function showGenerateContentDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #ea4335; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #d33b2c; }
    </style>

    <div class="form-group">
      <label>Site ID:</label>
      <input type="number" id="siteId" min="1">
    </div>

    <div class="form-group">
      <label>Content Type:</label>
      <select id="contentType">
        <option value="review">Product Review</option>
        <option value="comparison">Product Comparison</option>
        <option value="guide">Buying Guide</option>
        <option value="listicle">Top 10 List</option>
      </select>
    </div>

    <div class="form-group">
      <label>Product IDs (comma separated):</label>
      <input type="text" id="productIds" placeholder="1,2,3">
    </div>

    <div class="form-group">
      <label>Custom Title (optional):</label>
      <input type="text" id="title">
    </div>

    <button onclick="generateContent()">Generate Content</button>

    <script>
      function generateContent() {
        const data = {
          siteId: parseInt(document.getElementById('siteId').value),
          contentType: document.getElementById('contentType').value,
          productIds: document.getElementById('productIds').value,
          title: document.getElementById('title').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Content generation started!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .generateContent(data);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(450);

  ui.showModalDialog(html, 'Generate Content');
}

// =============================================================================
// DIALOGI - SETTINGS
// =============================================================================

function showAPIKeyInstructions() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🔑 API Keys Configuration',
    'To configure API keys:\n\n' +
    '1. Click: Extensions → Apps Script\n' +
    '2. Click: Project Settings (⚙️ icon)\n' +
    '3. Scroll to "Script Properties"\n' +
    '4. Click "Add script property"\n' +
    '5. Add these properties:\n\n' +
    '   DIVI_API_USERNAME = netanaliza\n' +
    '   DIVI_API_KEY = 2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4\n' +
    '   PA_API_ACCESS_KEY = [Your Amazon Key]\n' +
    '   PA_API_SECRET_KEY = [Your Amazon Secret]\n' +
    '   PA_API_PARTNER_TAG = [Your Associate Tag]\n' +
    '   HOSTINGER_API_KEY = [Optional]\n\n' +
    '6. Click "Save script properties"\n' +
    '7. Reload this spreadsheet',
    ui.ButtonSet.OK
  );
}

function showSettingsDialog() {
  const ui = SpreadsheetApp.getUi();

  const autoPublish = getSetting('auto_publish', 'false');
  const maxPosts = getSetting('max_posts_per_day', '5');
  const notifEmail = getSetting('error_notification_email', '');

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #673ab7; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #5e35b1; }
    </style>

    <div class="form-group">
      <label>Auto Publish Content:</label>
      <select id="autoPublish">
        <option value="true" ${autoPublish === 'true' ? 'selected' : ''}>Yes</option>
        <option value="false" ${autoPublish === 'false' ? 'selected' : ''}>No</option>
      </select>
    </div>

    <div class="form-group">
      <label>Max Posts Per Day:</label>
      <input type="number" id="maxPosts" value="${maxPosts}" min="1" max="50">
    </div>

    <div class="form-group">
      <label>Error Notification Email:</label>
      <input type="email" id="notifEmail" value="${notifEmail}" placeholder="your@email.com">
    </div>

    <button onclick="saveSettings()">Save Settings</button>

    <script>
      function saveSettings() {
        const settings = {
          auto_publish: document.getElementById('autoPublish').value,
          max_posts_per_day: document.getElementById('maxPosts').value,
          error_notification_email: document.getElementById('notifEmail').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Settings saved successfully!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .saveSystemSettings(settings);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(350);

  ui.showModalDialog(html, 'System Settings');
}

function saveSystemSettings(settings) {
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value);
  }
  logSuccess('Settings', 'System settings updated');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function focusContentQueue() {
  getContentQueueSheet().activate();
}

function focusActiveTasks() {
  getTasksSheet().activate();
}

function focusLogs() {
  getLogsSheet().activate();
}

function clearOldLogs() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Old Logs',
    'Delete logs older than 30 days?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getLogsSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][0] < cutoffDate) {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} old log entries.`);
  }
}

function clearFailedContent() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Failed Content',
    'Delete all failed content items?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getContentQueueSheet();
    const data = sheet.getDataRange().getValues();

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][4] === 'Failed') {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} failed content items.`);
  }
}

function clearCompletedTasks() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Clear Completed Tasks',
    'Delete all completed tasks?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();

    let deleted = 0;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][4] === 'Completed') {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    ui.alert(`Deleted ${deleted} completed tasks.`);
  }
}

// =============================================================================
// INFO DIALOGS
// =============================================================================

function showDocumentation() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📖 WAAS Documentation',
    'Documentation and resources:\n\n' +
    '• GitHub Repository:\n' +
    '  https://github.com/LUKOAI/LUKO-WAAS\n\n' +
    '• Product Manager Plugin:\n' +
    '  https://github.com/LUKOAI/-LukoAmazonAffiliateManager\n\n' +
    '• Divi Documentation:\n' +
    '  https://www.elegantthemes.com/documentation/divi/\n\n' +
    '• Amazon PA API Docs:\n' +
    '  https://webservices.amazon.com/paapi5/documentation/\n\n' +
    '• Elegant Themes API:\n' +
    '  https://www.elegantthemes.com/developers/\n\n' +
    'For support, open an issue on GitHub.',
    ui.ButtonSet.OK
  );
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ About WAAS',
    'WordPress Affiliate Automation System\n' +
    'Version ' + WAAS_CONFIG.version + '\n\n' +
    '© 2024 LUKOAI\n' +
    'https://github.com/LUKOAI\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'Automated WordPress management with:\n' +
    '✓ Multi-site management\n' +
    '✓ Divi theme integration\n' +
    '✓ Amazon affiliate products\n' +
    '✓ Automated content generation\n' +
    '✓ Task scheduling & automation\n\n' +
    'Built with ❤️ for affiliate marketers\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ui.ButtonSet.OK
  );
}

function testAllConnections() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Test Divi API
    const diviCreds = getDiviCredentials();
    const diviStatus = diviCreds.username && diviCreds.apiKey ? '✅' : '❌';

    // Test Amazon PA API
    const amazonCreds = getAmazonPACredentials();
    const amazonStatus = amazonCreds.accessKey && amazonCreds.secretKey && amazonCreds.partnerTag ? '✅' : '❌';

    // Test Hostinger API
    const hostingerKey = getHostingerAPIKey();
    const hostingerStatus = hostingerKey ? '✅' : '⚠️ (Optional)';

    ui.alert(
      '🧪 Connection Tests',
      'API Configuration Status:\n\n' +
      `${diviStatus} Divi API: ${diviStatus === '✅' ? 'Configured' : 'Not configured'}\n` +
      `${amazonStatus} Amazon PA API: ${amazonStatus === '✅' ? 'Configured' : 'Not configured'}\n` +
      `${hostingerStatus} Hostinger API: ${hostingerStatus === '✅' ? 'Configured' : 'Not configured'}\n\n` +
      'Note: This only checks if keys are present.\n' +
      'Use site and product operations to test actual connectivity.',
      ui.ButtonSet.OK
    );

    logInfo('Tests', 'Connection tests completed');
  } catch (error) {
    ui.alert('Error', 'Connection test failed: ' + error.message, ui.ButtonSet.OK);
  }
}

function showSetupAuthDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Setup Authentication',
    'Enter Site ID to setup WordPress authentication:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const siteId = parseInt(result.getResponseText());
    if (siteId) {
      migrateAuthForSite(siteId);
    }
  }
}

// =============================================================================
// DIALOGI - AUTOMATION
// =============================================================================

function showInstallFullStackDialog() {
  const ui = SpreadsheetApp.getUi();

  // Get list of sites
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    ui.alert('No Sites', 'No sites found. Please add a site first.', ui.ButtonSet.OK);
    return;
  }

  // Build site list
  let siteOptions = '';
  for (let i = 1; i < data.length; i++) {
    const siteId = data[i][0];
    const siteName = data[i][1];
    const status = data[i][9];
    siteOptions += `<option value="${siteId}">${siteName} (ID: ${siteId}) - ${status}</option>`;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select, input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; }
      button:hover { background: #357ae8; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    </style>

    <div class="info">
      <strong>🚀 Install Full Stack</strong><br>
      This will install everything on your WordPress site:<br>
      • Divi Theme<br>
      • WooCommerce<br>
      • WAAS Product Manager Plugin<br>
      • Optional: Import initial products<br>
    </div>

    <div class="form-group">
      <label>Select Site:</label>
      <select id="siteId">${siteOptions}</select>
    </div>

    <div class="form-group">
      <label>Initial ASINs (comma-separated, optional):</label>
      <input type="text" id="asins" placeholder="B08N5WRWNW, B07XJ8C8F7">
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="generateContent"> Generate initial content (review for first product)
      </label>
    </div>

    <button onclick="installStack()">🚀 Install Full Stack</button>

    <script>
      function installStack() {
        const siteId = parseInt(document.getElementById('siteId').value);
        const asins = document.getElementById('asins').value
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const generateContent = document.getElementById('generateContent').checked;

        google.script.run
          .withSuccessHandler(() => {
            alert('✅ Full stack installation started! Check the Logs sheet for progress.');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('❌ Error: ' + error.message);
          })
          .runInstallFullStack(siteId, asins, generateContent);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(400);

  ui.showModalDialog(html, '🚀 Install Full Stack');
}

function runInstallFullStack(siteId, asins, generateContent) {
  try {
    logInfo('AUTOMATION', `Starting full stack installation for site ${siteId} (dialog)`, siteId);

    const result = installFullStack(siteId, {
      importProducts: asins.length > 0,
      initialAsins: asins,
      generateContent: generateContent
    });

    if (result.success) {
      logSuccess('AUTOMATION', `Full stack installation completed for site ${siteId}`, siteId);
    } else {
      logError('AUTOMATION', `Full stack installation failed for site ${siteId}`, siteId);
    }

    return result;
  } catch (error) {
    logError('AUTOMATION', `Full stack installation error: ${error.message}`, siteId);
    throw error;
  }
}

function showDeployContentDialog() {
  const ui = SpreadsheetApp.getUi();

  // Get list of sites
  const sitesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const sitesData = sitesSheet.getDataRange().getValues();

  if (sitesData.length <= 1) {
    ui.alert('No Sites', 'No sites found. Please add a site first.', ui.ButtonSet.OK);
    return;
  }

  // Build site list
  let siteOptions = '';
  for (let i = 1; i < sitesData.length; i++) {
    const siteId = sitesData[i][0];
    const siteName = sitesData[i][1];
    siteOptions += `<option value="${siteId}">${siteName} (ID: ${siteId})</option>`;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select, input, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; }
      button:hover { background: #357ae8; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    </style>

    <div class="info">
      <strong>📤 Deploy Selected Content</strong><br>
      This will automatically:<br>
      • Import products from Amazon<br>
      • Generate content with Claude AI<br>
      • Publish to your WordPress site<br>
    </div>

    <div class="form-group">
      <label>Select Site:</label>
      <select id="siteId">${siteOptions}</select>
    </div>

    <div class="form-group">
      <label>Content Type:</label>
      <select id="contentType">
        <option value="product_review">Product Review</option>
        <option value="comparison">Product Comparison</option>
        <option value="buying_guide">Buying Guide</option>
        <option value="top_list">Top 10 List</option>
      </select>
    </div>

    <div class="form-group">
      <label>Amazon ASINs (comma-separated):</label>
      <input type="text" id="asins" placeholder="B08N5WRWNW, B07XJ8C8F7" required>
    </div>

    <div class="form-group">
      <label>Content Title (optional):</label>
      <input type="text" id="title" placeholder="Auto-generated if left empty">
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="autoPublish" checked> Auto-publish (otherwise save as draft)
      </label>
    </div>

    <button onclick="deployContent()">📤 Deploy Content</button>

    <script>
      function deployContent() {
        const siteId = parseInt(document.getElementById('siteId').value);
        const contentType = document.getElementById('contentType').value;
        const asins = document.getElementById('asins').value
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const title = document.getElementById('title').value;
        const autoPublish = document.getElementById('autoPublish').checked;

        if (asins.length === 0) {
          alert('Please enter at least one Amazon ASIN');
          return;
        }

        google.script.run
          .withSuccessHandler(() => {
            alert('✅ Content deployment started! Check the Logs sheet for progress.');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('❌ Error: ' + error.message);
          })
          .runDeployContent(siteId, contentType, asins, title, autoPublish);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(500);

  ui.showModalDialog(html, '📤 Deploy Selected Content');
}

function runDeployContent(siteId, contentType, asins, title, autoPublish) {
  try {
    logInfo('AUTOMATION', `Starting content deployment for site ${siteId} (dialog)`, siteId);

    const result = deploySelectedContent(siteId, contentType, asins, {
      autoPublish: autoPublish,
      title: title || null
    });

    if (result.success) {
      logSuccess('AUTOMATION', `Content deployment completed for site ${siteId}`, siteId);
    } else {
      logError('AUTOMATION', `Content deployment failed for site ${siteId}`, siteId);
    }

    return result;
  } catch (error) {
    logError('AUTOMATION', `Content deployment error: ${error.message}`, siteId);
    throw error;
  }
}

// =============================================================================
// DIALOG FUNCTIONS — defined in other modules:
// =============================================================================
// siteCleanupDialog(), siteInfoDialog(), siteBrandingDialog() → SiteCleanup.gs
// showExportToWooCommerceDialog() → ProductManager-WOOCOMMERCE-EXPORT.gs
// priceSyncDialog() → ProductManager-PRICE-WEBHOOK.gs
// gscRegisterDialog(), gscSitemapDialog(), gscVerifyDialog() → SearchEngines.gs
// bingRegisterDialog(), bingSitemapDialog(), bingVerifyDialog() → SearchEngines.gs
// launchReportDialog(), sendLaunchEmailDialog() → LaunchReport.gs
// exportToNotionDialog(), saveReportToDriveDialog() → LaunchReport.gs
// newSiteWizardDialog() → Automation.gs
// SEO dialog stubs — SEO.gs exists but these dialogs are not yet implemented there
