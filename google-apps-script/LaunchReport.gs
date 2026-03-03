/**
 * ============================================================================
 * WAAS Launch Report Module
 * ============================================================================
 *
 * Generate launch reports, save PDF to Drive, send email, export to Notion.
 *
 * Existing functions used (DO NOT redefine):
 *   - getSiteById(siteId)
 *   - getSiteFullInfo(site) — from SiteCleanup.gs
 *   - logInfo/logError/logSuccess/logWarning
 *   - getAPIKey(keyName)
 *
 * @version 3.0.0
 */

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Zbiera WSZYSTKIE dane o stronie w jeden obiekt raportu.
 * Używa: getSiteById, getSiteFullInfo (z SiteCleanup.gs), Products sheet
 */
function generateLaunchReport(siteId) {
  var site = getSiteById(siteId);
  if (!site) throw new Error('Site not found: ' + siteId);

  logInfo('REPORT', 'Generating launch report for: ' + site.name, siteId);

  // Pobierz dane z WP
  var siteInfo = getSiteFullInfo(site); // z SiteCleanup.gs

  // Policz produkty w arkuszu dla tej domeny
  var productCount = _countProductsForDomain(site.domain);

  var report = {
    generatedAt: new Date().toISOString(),
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      wpUrl: site.wpUrl,
      adminUrl: site.wpUrl + '/wp-admin/',
      adminUser: site.adminUser,
      partnerTag: site.partnerTag,
      status: site.status,
      createdDate: site.createdDate
    },
    wordpress: siteInfo.success ? siteInfo.data : { error: 'Could not fetch site info' },
    products: {
      inSheet: productCount,
      onSite: siteInfo.success ? (siteInfo.data.counts || {}).products || 0 : 'unknown'
    },
    seo: siteInfo.success ? (siteInfo.data.seo || {}) : {},
    plugins: siteInfo.success ? (siteInfo.data.plugins || []) : [],
    searchEngines: {
      gscVerification: siteInfo.success ? (siteInfo.data.waas || {}).gsc_verification || '' : '',
      bingVerification: siteInfo.success ? (siteInfo.data.waas || {}).bing_verification || '' : ''
    }
  };

  logSuccess('REPORT', 'Launch report generated', siteId);
  return report;
}

/**
 * Count products in Products sheet for given domain
 */
function _countProductsForDomain(domain) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
    if (!sheet) return 0;
    var data = sheet.getDataRange().getValues();
    var count = 0;
    // Find "Target Domain" column
    var headers = data[0];
    var domainCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase().indexOf('target domain') > -1) { domainCol = i; break; }
    }
    if (domainCol === -1) return 0;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][domainCol]).indexOf(domain) > -1) count++;
    }
    return count;
  } catch (e) { return 0; }
}

// =============================================================================
// HTML REPORT
// =============================================================================

/**
 * Generuje HTML raportu (do PDF lub emaila)
 */
function generateLaunchReportHTML(report) {
  var html = '<html><head><style>'
    + 'body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }'
    + 'h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }'
    + 'h2 { color: #333; margin-top: 30px; }'
    + 'table { width: 100%; border-collapse: collapse; margin: 10px 0; }'
    + 'th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }'
    + 'th { background: #f5f5f5; }'
    + '.ok { color: #0d8043; } .warn { color: #e37400; } .err { color: #c5221f; }'
    + '.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; }'
    + '.badge-ok { background: #e6f4ea; color: #137333; }'
    + '.badge-warn { background: #fef7e0; color: #995d00; }'
    + '</style></head><body>';

  html += '<h1>WAAS Launch Report: ' + report.site.name + '</h1>';
  html += '<p>Domain: <strong>' + report.site.domain + '</strong> | Generated: ' + report.generatedAt + '</p>';

  // Site info
  html += '<h2>Site Details</h2><table>';
  html += '<tr><th>WordPress URL</th><td><a href="' + report.site.wpUrl + '">' + report.site.wpUrl + '</a></td></tr>';
  html += '<tr><th>Admin Panel</th><td><a href="' + report.site.adminUrl + '">' + report.site.adminUrl + '</a></td></tr>';
  html += '<tr><th>Admin User</th><td>' + report.site.adminUser + '</td></tr>';
  html += '<tr><th>Partner Tag</th><td>' + (report.site.partnerTag || 'NOT SET') + '</td></tr>';
  html += '<tr><th>Status</th><td>' + report.site.status + '</td></tr>';
  html += '</table>';

  // Products
  html += '<h2>Products</h2><table>';
  html += '<tr><th>In Google Sheet</th><td>' + report.products.inSheet + '</td></tr>';
  html += '<tr><th>On Website</th><td>' + report.products.onSite + '</td></tr>';
  html += '</table>';

  // WordPress info
  if (report.wordpress && !report.wordpress.error) {
    var wp = report.wordpress;
    html += '<h2>WordPress</h2><table>';
    html += '<tr><th>WP Version</th><td>' + (wp.wp_version || '?') + '</td></tr>';
    html += '<tr><th>Theme</th><td>' + ((wp.theme || {}).name || '?') + '</td></tr>';
    html += '</table>';

    // Plugins
    if (wp.plugins && wp.plugins.length) {
      html += '<h2>Plugins</h2><table><tr><th>Plugin</th><th>Active</th><th>Version</th></tr>';
      wp.plugins.forEach(function(p) {
        html += '<tr><td>' + (p.name || p.slug) + '</td>'
          + '<td>' + (p.active ? '<span class="ok">Active</span>' : '<span class="err">Inactive</span>') + '</td>'
          + '<td>' + (p.version || '?') + '</td></tr>';
      });
      html += '</table>';
    }
  }

  // SEO
  html += '<h2>SEO</h2><table>';
  html += '<tr><th>Rank Math</th><td>' + ((report.seo || {}).rank_math_active ? '<span class="ok">Active</span>' : '<span class="warn">Inactive</span>') + '</td></tr>';
  html += '<tr><th>Sitemap</th><td>' + ((report.seo || {}).sitemap_url || 'Not found') + '</td></tr>';
  html += '</table>';

  // Search Engines
  html += '<h2>Search Engines</h2><table>';
  html += '<tr><th>GSC Verification</th><td>' + (report.searchEngines.gscVerification || 'Not set') + '</td></tr>';
  html += '<tr><th>Bing Verification</th><td>' + (report.searchEngines.bingVerification || 'Not set') + '</td></tr>';
  html += '</table>';

  html += '<hr><p style="color:#999; font-size:12px;">Generated by WAAS Automation System | ' + new Date().toISOString() + '</p>';
  html += '</body></html>';
  return html;
}

// =============================================================================
// GOOGLE DRIVE
// =============================================================================

/**
 * Zapisuje raport PDF do Google Drive folder "WAAS Reports"
 * Zwraca URL do pliku
 */
function saveLaunchReportToDrive(siteId, report) {
  var html = generateLaunchReportHTML(report);
  var fileName = 'WAAS_Report_' + report.site.domain + '_'
    + Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd') + '.pdf';
  var blob = HtmlService.createHtmlOutput(html)
    .getBlob()
    .setName(fileName)
    .getAs('application/pdf');

  // Znajdź lub stwórz folder
  var folderName = 'WAAS Reports';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var file = folder.createFile(blob);
  logSuccess('REPORT', 'Report saved to Drive: ' + file.getUrl(), siteId);
  return { success: true, url: file.getUrl(), fileId: file.getId() };
}

// =============================================================================
// EMAIL
// =============================================================================

/**
 * Wysyła launch email na service@netanaliza.com
 */
function sendLaunchEmail(siteId, report, driveUrl) {
  var emailTo = 'service@netanaliza.com';
  var subject = 'WAAS: Nowa strona gotowa — ' + report.site.domain;

  var html = generateLaunchReportHTML(report);

  // Dodaj link do Drive na górze
  if (driveUrl) {
    html = html.replace('<h1>', '<p><a href="' + driveUrl + '">PDF Report on Google Drive</a></p><h1>');
  }

  MailApp.sendEmail({
    to: emailTo,
    subject: subject,
    htmlBody: html,
    name: 'WAAS Automation System'
  });

  logSuccess('REPORT', 'Launch email sent to ' + emailTo, siteId);
  return { success: true, to: emailTo };
}

// =============================================================================
// NOTION EXPORT (optional)
// =============================================================================

/**
 * Eksportuje raport do Notion database.
 * Wymaga: notion_integration_key w Script Properties
 * Wymaga: notion_database_id w Script Properties (ID bazy danych Notion)
 */
function exportToNotion(siteId, report) {
  var notionKey = getAPIKey('notion_integration_key');
  var dbId = getAPIKey('notion_database_id');

  if (!notionKey || !dbId) {
    logWarning('NOTION', 'Notion not configured (missing key or database ID)', siteId);
    return { success: false, error: 'Notion not configured. Set notion_integration_key and notion_database_id in Script Properties.' };
  }

  var response = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + notionKey,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        'Name': { title: [{ text: { content: report.site.name + ' — ' + report.site.domain } }] },
        'Domain': { url: 'https://' + report.site.domain },
        'Status': { select: { name: report.site.status || 'Active' } },
        'Products': { number: report.products.onSite || 0 },
        'Partner Tag': { rich_text: [{ text: { content: report.site.partnerTag || '' } }] },
        'Created': { date: { start: new Date().toISOString().split('T')[0] } }
      }
    }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code === 200) {
    var data = JSON.parse(response.getContentText());
    logSuccess('NOTION', 'Exported to Notion: ' + data.url, siteId);
    return { success: true, url: data.url };
  }
  logError('NOTION', 'Notion export failed: ' + response.getContentText(), siteId);
  return { success: false, error: response.getContentText() };
}

// =============================================================================
// DIALOGI MENU
// =============================================================================

function launchReportDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Launch Report', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var siteId = r.getResponseText().trim();
  var site = getSiteById(siteId);
  if (!site) { ui.alert('Nie znaleziono strony'); return; }

  var report = generateLaunchReport(siteId);
  var driveResult = saveLaunchReportToDrive(siteId, report);

  ui.alert('Raport wygenerowany!',
    'Domain: ' + report.site.domain + '\n' +
    'Products: ' + report.products.onSite + '\n' +
    'PDF: ' + (driveResult.success ? driveResult.url : 'Error saving'),
    ui.ButtonSet.OK);
}

function sendLaunchEmailDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Send Launch Email', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var siteId = r.getResponseText().trim();

  var report = generateLaunchReport(siteId);
  var driveResult = saveLaunchReportToDrive(siteId, report);
  var emailResult = sendLaunchEmail(siteId, report, driveResult.success ? driveResult.url : null);

  ui.alert(emailResult.success
    ? 'Email wysłany na service@netanaliza.com!'
    : 'Błąd: ' + (emailResult.error || 'unknown'));
}

function exportToNotionDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Export to Notion', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var siteId = r.getResponseText().trim();

  var report = generateLaunchReport(siteId);
  var result = exportToNotion(siteId, report);

  ui.alert(result.success
    ? 'Wyeksportowano do Notion!\n' + result.url
    : 'Błąd: ' + result.error);
}

function saveReportToDriveDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Save to Drive', 'Site ID:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var siteId = r.getResponseText().trim();

  var report = generateLaunchReport(siteId);
  var result = saveLaunchReportToDrive(siteId, report);

  ui.alert(result.success
    ? 'Raport zapisany!\n' + result.url
    : 'Błąd: ' + (result.error || 'unknown'));
}
