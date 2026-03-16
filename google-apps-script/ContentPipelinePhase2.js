/**
 * WAAS Content Pipeline — Setup Phase 2 (Site Pages + Branding + Verification)
 * 
 * Adds:
 * - New Content_Type_CP values: HOMEPAGE, CATEGORY_PAGE, BRAND_PROFILE, ABOUT_PAGE, CROSS_LINK_PAGE
 * - Sites sheet columns: Has_Patron, Patron_Brand, Niche_Description, Primary_Color
 * - Menu items for Branding, Site Check, Site Pages
 * 
 * Run: WAAS → 📋 Content Pipeline → ⚙️ Setup Phase 2
 */

function cpSetupPhase2() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var results = [];
  
  // === 1. Extend Content_Type_CP dropdown ===
  var cpSheet = ss.getSheetByName('Content Pipeline');
  if (cpSheet) {
    var headers = cpSheet.getRange(1, 1, 1, cpSheet.getLastColumn()).getValues()[0];
    var col = {};
    headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
    
    if (col['Content_Type_CP'] !== undefined) {
      var ctCol = col['Content_Type_CP'] + 1;
      var contentTypes = [
        // Existing blog types
        'LISTICLE', 'REVIEW', 'VERSUS', 'VERGLEICH', 'BUYERS_GUIDE', 'RATGEBER',
        'PROBLEM_SOLVER', 'HOW_TO', 'TUTORIAL', 'FAQ', 'QUICK_PICK',
        'SEASONAL_GUIDE', 'GIFT_GUIDE', 'COLLECTION', 'DEALS',
        'COMPARISON_TABLE', 'ALTERNATIVES', 'UPDATE', 'BUDGET_OPTIONS',
        'CASE_STUDY', 'ARTICLE', 'PRODUCT_PAGE', 'Q_AND_A',
        // New page types
        'HOMEPAGE',           // Hero + sections + featured products
        'CATEGORY_PAGE',      // Category landing with description
        'BRAND_PROFILE',      // Markenprofil / Patron page
        'ABOUT_PAGE',         // Über diese Seite (2 versions)
        'CROSS_LINK_PAGE',    // Werkzeug-Welt (links to sister sites)
        'CONTACT_PAGE',       // Kontakt
      ];
      
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(contentTypes, true)
        .setAllowInvalid(false)
        .build();
      cpSheet.getRange(2, ctCol, 998, 1).setDataValidation(rule);
      results.push('✅ Content_Type_CP dropdown updated (' + contentTypes.length + ' types)');
    }
  }
  
  // === 2. Add columns to Sites sheet ===
  var sitesSheet = ss.getSheetByName('Sites');
  if (sitesSheet) {
    var sHeaders = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];
    var sCol = {};
    sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
    
    var newSiteCols = [
      'Niche_Description',   // "Kraftstoffkanister, Benzinkanister, Reservekanister"
      'Has_Patron',          // TRUE/FALSE
      'Patron_Brand',        // "WERHE", "BW", etc.
      'Primary_Color',       // "#EF6C00"
      'Logo_WP_URL',         // URL of logo in WP Media Library
      'Logo_Media_ID',       // WP Media ID
      'Favicon_Media_ID',    // WP Media ID
      'Site_Check_Score',    // "12/15"
      'Site_Check_Date',     // Last verification date
    ];
    
    var addedCols = 0;
    newSiteCols.forEach(function(colName) {
      if (sCol[colName] !== undefined) return; // Already exists
      
      var nextCol = sitesSheet.getLastColumn() + 1;
      sitesSheet.getRange(1, nextCol).setValue(colName);
      addedCols++;
    });
    
    if (addedCols > 0) {
      results.push('✅ Sites sheet: added ' + addedCols + ' new columns');
    } else {
      results.push('⏭️ Sites sheet columns already exist');
    }
    
    // Set Has_Patron checkbox
    sHeaders = sitesSheet.getRange(1, 1, 1, sitesSheet.getLastColumn()).getValues()[0];
    sCol = {};
    sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
    
    if (sCol['Has_Patron'] !== undefined) {
      sitesSheet.getRange(2, sCol['Has_Patron'] + 1, 50, 1).insertCheckboxes();
      results.push('✅ Has_Patron checkbox set');
    }
  } else {
    results.push('❌ Sites sheet not found');
  }
  
  // === 3. Update Dropdowns_CP ===
  var ddSheet = ss.getSheetByName('Dropdowns_CP');
  if (ddSheet) {
    // Check if page content types are listed
    var ddData = ddSheet.getDataRange().getValues();
    var hasPageTypes = false;
    for (var r = 0; r < ddData.length; r++) {
      for (var c = 0; c < ddData[r].length; c++) {
        if (ddData[r][c] === 'HOMEPAGE') { hasPageTypes = true; break; }
      }
      if (hasPageTypes) break;
    }
    
    if (!hasPageTypes) {
      // Find Content_Type column in Dropdowns
      var ddHeaders = ddData[0];
      var ctIdx = -1;
      for (var i = 0; i < ddHeaders.length; i++) {
        if (ddHeaders[i].toString().indexOf('Content_Type') >= 0) { ctIdx = i; break; }
      }
      
      if (ctIdx >= 0) {
        // Find last non-empty row in that column
        var lastRow = 1;
        for (var r = 1; r < ddData.length; r++) {
          if (ddData[r][ctIdx]) lastRow = r + 1;
        }
        
        var pageTypes = ['HOMEPAGE', 'CATEGORY_PAGE', 'BRAND_PROFILE', 'ABOUT_PAGE', 'CROSS_LINK_PAGE', 'CONTACT_PAGE'];
        for (var i = 0; i < pageTypes.length; i++) {
          ddSheet.getRange(lastRow + 1 + i, ctIdx + 1).setValue(pageTypes[i]);
        }
        results.push('✅ Dropdowns_CP: added page content types');
      }
    } else {
      results.push('⏭️ Dropdowns_CP: page types already listed');
    }
  }
  
  ui.alert('⚙️ Setup Phase 2\n\n' + results.join('\n'));
}


// ============================================================================
// SITE CHECK — Runs /site-check on a domain and logs results
// ============================================================================

/**
 * Runs site verification on one or ALL domains.
 * Menu: WAAS → 📋 Content Pipeline → 🔍 Verify Site
 */
function cpVerifySite() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('🔍 Site Verification',
    'Podaj domenę (np. reservekanister.lk24.shop)\nlub "ALL" dla wszystkich stron:', 
    ui.ButtonSet.OK_CANCEL);
  
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var input = resp.getResponseText().trim();
  
  var sitesSheet = ss.getSheetByName('Sites');
  if (!sitesSheet) { ui.alert('❌ Brak karty Sites'); return; }
  
  var sitesData = sitesSheet.getDataRange().getValues();
  var sitesHeaders = sitesData[0];
  var sCol = {};
  sitesHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var sites = [];
  for (var r = 1; r < sitesData.length; r++) {
    var domain = (sitesData[r][sCol['Domain'] !== undefined ? sCol['Domain'] : 2] || '').toString().trim();
    if (!domain) continue;
    if (input === 'ALL' || input === domain) {
      sites.push({
        row: r + 1,
        domain: domain,
        name: (sitesData[r][sCol['Name'] !== undefined ? sCol['Name'] : 1] || '').toString(),
        wpUrl: (sitesData[r][sCol['WP_URL'] !== undefined ? sCol['WP_URL'] : 3] || '').toString(),
        adminUser: (sitesData[r][sCol['Admin_User'] !== undefined ? sCol['Admin_User'] : 4] || '').toString(),
        adminPass: (sitesData[r][sCol['Admin_Pass'] !== undefined ? sCol['Admin_Pass'] : 5] || '').toString(),
      });
    }
  }
  
  if (sites.length === 0) { ui.alert('❌ Nie znaleziono strony: ' + input); return; }
  
  var report = [];
  
  for (var i = 0; i < sites.length; i++) {
    var site = sites[i];
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    try {
      var auth = cpGetWPAuthForMedia(site, wpUrl);
      if (!auth.cookies || !auth.nonce) {
        report.push(site.domain + ': ❌ Auth failed');
        continue;
      }
      
      var response = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/site-check', {
        method: 'GET',
        headers: {
          'Cookie': auth.cookies,
          'X-WP-Nonce': auth.nonce,
        },
        muteHttpExceptions: true,
      });
      
      var code = response.getResponseCode();
      if (code === 200) {
        var body = JSON.parse(response.getContentText());
        var score = body.score || '?/?';
        var pct = body.percent || 0;
        var emoji = pct >= 80 ? '✅' : pct >= 60 ? '⚠️' : '❌';
        
        report.push(emoji + ' ' + site.domain + ': ' + score + ' (' + pct + '%)');
        
        // List failed checks
        if (body.checks) {
          for (var key in body.checks) {
            if (!body.checks[key].ok) {
              var detail = JSON.stringify(body.checks[key]).substring(0, 80);
              report.push('   ↳ ❌ ' + key + ': ' + detail);
            }
          }
        }
        
        // Update Sites sheet
        if (sCol['Site_Check_Score'] !== undefined) {
          sitesSheet.getRange(site.row, sCol['Site_Check_Score'] + 1).setValue(score + ' (' + pct + '%)');
        }
        if (sCol['Site_Check_Date'] !== undefined) {
          sitesSheet.getRange(site.row, sCol['Site_Check_Date'] + 1).setValue(new Date());
        }
        
      } else {
        report.push('❌ ' + site.domain + ': HTTP ' + code);
      }
    } catch(e) {
      report.push('❌ ' + site.domain + ': ' + e.message);
    }
    
    Utilities.sleep(2000);
  }
  
  var msg = '🔍 Site Verification Report\n\n' + report.join('\n');
  
  // Show in dialog (scrollable for long reports)
  var html = HtmlService.createHtmlOutput(
    '<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;">' + 
    msg.replace(/</g, '&lt;').replace(/\n/g, '<br>') + 
    '</pre>'
  ).setWidth(700).setHeight(500);
  
  ui.showModalDialog(html, '🔍 Site Verification Report');
}


// ============================================================================
// SET BRANDING — Upload logo/favicon and set in Divi
// ============================================================================

/**
 * Sets logo + favicon on a site from Media Library IDs.
 * Menu: WAAS → 📋 Content Pipeline → 🎨 Set Branding
 */
function cpSetBranding() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('🎨 Set Branding',
    'Podaj domenę:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ Site not found: ' + domain); return; }
  
  // Read branding data from Sites sheet
  var sitesSheet = ss.getSheetByName('Sites');
  var sitesData = sitesSheet.getDataRange().getValues();
  var sHeaders = sitesData[0];
  var sCol = {};
  sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var siteRow = null;
  for (var r = 1; r < sitesData.length; r++) {
    if ((sitesData[r][sCol['Domain'] || 2] || '').toString().trim() === domain) {
      siteRow = sitesData[r];
      break;
    }
  }
  
  if (!siteRow) { ui.alert('❌ Site row not found'); return; }
  
  var logoMediaId = parseInt(siteRow[sCol['Logo_Media_ID']] || 0);
  var faviconMediaId = parseInt(siteRow[sCol['Favicon_Media_ID']] || 0);
  var primaryColor = (siteRow[sCol['Primary_Color']] || '').toString().trim();
  
  if (!logoMediaId && !faviconMediaId && !primaryColor) {
    ui.alert('⚠️ Brak danych brandingowych w Sites sheet.\nUzupełnij kolumny: Logo_Media_ID, Favicon_Media_ID, Primary_Color');
    return;
  }
  
  var wpUrl = site.wpUrl || ('https://' + site.domain);
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) { ui.alert('❌ Auth failed'); return; }
  
  var payload = {};
  if (logoMediaId) payload.logo_media_id = logoMediaId;
  if (faviconMediaId) payload.favicon_media_id = faviconMediaId;
  if (primaryColor) payload.primary_color = primaryColor;
  payload.logo_alt = site.name || domain;
  
  var response = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/set-branding', {
    method: 'POST',
    headers: {
      'Cookie': auth.cookies,
      'X-WP-Nonce': auth.nonce,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  
  var code = response.getResponseCode();
  if (code === 200) {
    var body = JSON.parse(response.getContentText());
    ui.alert('🎨 Branding Set\n\n' + JSON.stringify(body.results, null, 2));
  } else {
    ui.alert('❌ HTTP ' + code + '\n' + response.getContentText().substring(0, 300));
  }
}