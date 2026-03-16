/**
 * WAAS Menu System — Sheet-based menu management
 * 
 * Menu_CP sheet = źródło prawdy dla menu na każdej stronie.
 * Wzorzec: erdloch-bohren.lk24.shop
 * 
 * File: ContentPipelineMenu.gs
 */


// ============================================================================
// SETUP: Create Menu_CP sheet with erdloch-bohren template
// ============================================================================

function cpSetupMenuSheet() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheet = ss.getSheetByName('Menu_CP');
  if (sheet) {
    var confirm = ui.alert('Menu_CP już istnieje. Nadpisać?', ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;
    ss.deleteSheet(sheet);
  }
  
  sheet = ss.insertSheet('Menu_CP');
  
  // Headers
  var headers = [
    'Domain',           // A — domena docelowa
    'Position',         // B — primary / secondary
    'Order',            // C — kolejność (10, 20, 30...)
    'Title',            // D — tekst widoczny w menu
    'Parent',           // E — tytuł parent menu item (puste = top-level)
    'Type',             // F — page / category / post / custom / external
    'Slug_or_URL',      // G — slug strony/kategorii LUB pełny URL dla external
    'WP_Object_ID',     // H — ID obiektu WP (auto lub ręcznie)
    'Icon',             // I — emoji/ikona (opcjonalnie)
    'Active',           // J — TRUE/FALSE (czy widoczne w menu)
    'Notes',            // K — uwagi
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E3F2FD');
  sheet.setFrozenRows(1);
  
  // Column widths
  sheet.setColumnWidth(1, 220); // Domain
  sheet.setColumnWidth(2, 100); // Position
  sheet.setColumnWidth(3, 60);  // Order
  sheet.setColumnWidth(4, 250); // Title
  sheet.setColumnWidth(5, 200); // Parent
  sheet.setColumnWidth(6, 100); // Type
  sheet.setColumnWidth(7, 200); // Slug
  sheet.setColumnWidth(8, 80);  // WP ID
  sheet.setColumnWidth(9, 60);  // Icon
  sheet.setColumnWidth(10, 60); // Active
  sheet.setColumnWidth(11, 200); // Notes
  
  // Dropdowns
  var posRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['primary', 'secondary'], true).build();
  sheet.getRange(2, 2, 200, 1).setDataValidation(posRule);
  
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['page', 'category', 'post', 'custom', 'external'], true).build();
  sheet.getRange(2, 6, 200, 1).setDataValidation(typeRule);
  
  // Active checkboxes
  sheet.getRange(2, 10, 200, 1).insertCheckboxes();
  
  // === PRE-FILL: erdloch-bohren template (PRIMARY MENU) ===
  // This is the TEMPLATE — user changes Domain + titles for each new site
  var template = [
    // Domain,       Position,  Order, Title,                    Parent,              Type,      Slug/URL,               WP_ID, Icon, Active
    ['TEMPLATE',     'primary', 10,    'Start',                  '',                  'page',    'homepage',             '',    '',   true,  'Strona główna'],
    ['TEMPLATE',     'primary', 20,    'Ratgeber & Anleitungen', '',                  'page',    'ratgeber-anleitungen', '',    '',   true,  'Kategoria-landing 1'],
    ['TEMPLATE',     'primary', 21,    '[Post 1 Titel]',         'Ratgeber & Anleitungen', 'post', '',                  '',    '',   true,  'Podmień na swój post'],
    ['TEMPLATE',     'primary', 22,    '[Post 2 Titel]',         'Ratgeber & Anleitungen', 'post', '',                  '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 23,    '[Post 3 Titel]',         'Ratgeber & Anleitungen', 'post', '',                  '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 24,    '[Post 4 Titel]',         'Ratgeber & Anleitungen', 'post', '',                  '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 25,    '[Post 5 Titel]',         'Ratgeber & Anleitungen', 'post', '',                  '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 30,    'Wissen & Tipps',         '',                  'page',    'wissen-tipps',         '',    '',   true,  'Kategoria-landing 2'],
    ['TEMPLATE',     'primary', 31,    '[Post 6 Titel]',         'Wissen & Tipps',    'post',    '',                     '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 32,    '[Post 7 Titel]',         'Wissen & Tipps',    'post',    '',                     '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 33,    '[Post 8 Titel]',         'Wissen & Tipps',    'post',    '',                     '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 34,    '[Post 9 Titel]',         'Wissen & Tipps',    'post',    '',                     '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 35,    '[Post 10 Titel]',        'Wissen & Tipps',    'post',    '',                     '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 40,    'Werkzeug-Welt',          '',                  'page',    'werkzeug-welt',        '',    '',   true,  'Cross-links'],
    ['TEMPLATE',     'primary', 41,    '🔨 [Schwesterseite 1]',  'Werkzeug-Welt',     'external', 'https://...',         '',    '🔨', true,  ''],
    ['TEMPLATE',     'primary', 42,    '🪨 [Schwesterseite 2]',  'Werkzeug-Welt',     'external', 'https://...',         '',    '🪨', true,  ''],
    ['TEMPLATE',     'primary', 43,    '🔧 [Schwesterseite 3]',  'Werkzeug-Welt',     'external', 'https://...',         '',    '🔧', true,  ''],
    ['TEMPLATE',     'primary', 44,    '⭐ Markenprofil',        'Werkzeug-Welt',     'page',    'markenprofil',         '',    '⭐', true,  'Patron page'],
    ['TEMPLATE',     'primary', 50,    'Blog',                   '',                  'category','blog',                 '',    '',   true,  ''],
    ['TEMPLATE',     'primary', 60,    'Shop',                   '',                  'page',    'shop',                 '',    '',   true,  ''],
  ];
  
  sheet.getRange(2, 1, template.length, template[0].length).setValues(template);
  
  // Color coding
  for (var r = 0; r < template.length; r++) {
    var sheetRow = r + 2;
    if (template[r][4] === '') {
      // Top-level = blue bg
      sheet.getRange(sheetRow, 1, 1, headers.length).setBackground('#E8F0FE');
    } else {
      // Child = light gray
      sheet.getRange(sheetRow, 1, 1, headers.length).setBackground('#F8F9FA');
    }
  }
  
  ui.alert('✅ Menu_CP sheet created!\n\n' +
    'Template: 20 wierszy (wzorzec erdloch-bohren)\n\n' +
    'Jak używać:\n' +
    '1. Skopiuj wiersze TEMPLATE → zmień Domain na swoją domenę\n' +
    '2. Zmień Title na pasujące do Twojej niszy\n' +
    '3. Uzupełnij Slug_or_URL i WP_Object_ID\n' +
    '4. Odznacz Active = FALSE żeby ukryć pozycję\n' +
    '5. WAAS → Content Pipeline → 🧭 Deploy Menu');
}


// ============================================================================
// DEPLOY MENU — Read Menu_CP sheet and create menu in WordPress
// ============================================================================

function cpDeployMenu() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('🧭 Deploy Menu',
    'Podaj domenę (np. reservekanister.lk24.shop):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ Site not found: ' + domain); return; }
  
  var menuSheet = ss.getSheetByName('Menu_CP');
  if (!menuSheet) { ui.alert('❌ Menu_CP sheet not found. Run Setup first.'); return; }
  
  var data = menuSheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  // Filter rows for this domain
  var primaryItems = [];
  var secondaryItems = [];
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var rowDomain = (row[col['Domain']] || '').toString().trim();
    if (rowDomain !== domain) continue;
    
    var active = row[col['Active']];
    if (active !== true && active !== 'TRUE') continue;
    
    var item = {
      title: (row[col['Title']] || '').toString().trim(),
      parent: (row[col['Parent']] || '').toString().trim(),
      type: (row[col['Type']] || 'custom').toString().trim(),
      slug: (row[col['Slug_or_URL']] || '').toString().trim(),
      object_id: parseInt(row[col['WP_Object_ID']] || 0),
      order: parseInt(row[col['Order']] || 0),
      icon: (row[col['Icon']] || '').toString().trim(),
    };
    
    // Add icon to title if present
    if (item.icon && item.title.indexOf(item.icon) < 0) {
      item.title = item.icon + ' ' + item.title;
    }
    
    // For external links, set URL
    if (item.type === 'external') {
      item.url = item.slug;
      item.type = 'custom';
    }
    
    // For custom type with URL
    if (item.type === 'custom' && item.slug && item.slug.indexOf('http') === 0) {
      item.url = item.slug;
    }
    
    var position = (row[col['Position']] || 'primary').toString().trim();
    if (position === 'secondary') {
      secondaryItems.push(item);
    } else {
      primaryItems.push(item);
    }
  }
  
  if (primaryItems.length === 0) {
    ui.alert('❌ Brak wierszy menu dla domeny: ' + domain + '\n\nUzupełnij Menu_CP sheet.');
    return;
  }
  
  // Sort by order
  primaryItems.sort(function(a, b) { return a.order - b.order; });
  secondaryItems.sort(function(a, b) { return a.order - b.order; });
  
  // Preview
  var preview = 'PRIMARY MENU (' + primaryItems.length + ' items):\n';
  primaryItems.forEach(function(item) {
    preview += (item.parent ? '  └ ' : '• ') + item.title + ' (' + item.type + ')\n';
  });
  if (secondaryItems.length > 0) {
    preview += '\nSECONDARY MENU (' + secondaryItems.length + ' items):\n';
    secondaryItems.forEach(function(item) {
      preview += (item.parent ? '  └ ' : '• ') + item.title + ' (' + item.type + ')\n';
    });
  }
  
  var confirm = ui.alert('🧭 Menu Preview — ' + domain,
    preview + '\nDeploy?', ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  
  // Deploy
  var wpUrl = site.wpUrl || ('https://' + domain);
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) { ui.alert('❌ Auth failed'); return; }
  
  var results = [];
  
  // Deploy PRIMARY menu
  if (primaryItems.length > 0) {
    var resp1 = _cpDeployMenuToWP(wpUrl, auth, 'Hauptmenü', primaryItems);
    results.push('Primary: ' + (resp1.success ? '✅ ' + resp1.items_created + ' items' : '❌ ' + resp1.error));
  }
  
  // Deploy SECONDARY menu
  if (secondaryItems.length > 0) {
    var resp2 = _cpDeployMenuToWP(wpUrl, auth, 'Sekundärmenü', secondaryItems);
    results.push('Secondary: ' + (resp2.success ? '✅ ' + resp2.items_created + ' items' : '❌ ' + resp2.error));
  }
  
  ui.alert('🧭 Menu Deploy\n\n' + results.join('\n') + '\n\nSprawdź stronę w incognito.');
}


function _cpDeployMenuToWP(wpUrl, auth, menuName, items) {
  try {
    var response = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/set-menu', {
      method: 'POST',
      headers: {
        'Cookie': auth.cookies,
        'X-WP-Nonce': auth.nonce,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({ menu_name: menuName, items: items }),
      muteHttpExceptions: true,
    });
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      return { success: false, error: 'HTTP ' + response.getResponseCode() };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
}


// ============================================================================
// IMPORT MENU — Read current menu from WordPress into Menu_CP sheet
// ============================================================================

function cpImportMenu() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('📥 Import Menu from WordPress',
    'Podaj domenę:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ Site not found'); return; }
  
  var wpUrl = site.wpUrl || ('https://' + domain);
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) { ui.alert('❌ Auth failed'); return; }
  
  var structResp = UrlFetchApp.fetch(wpUrl + '/wp-json/waas-pipeline/v1/get-site-structure', {
    headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
    muteHttpExceptions: true,
  });
  
  if (structResp.getResponseCode() !== 200) {
    ui.alert('❌ HTTP ' + structResp.getResponseCode());
    return;
  }
  
  var structure = JSON.parse(structResp.getContentText());
  
  var menuSheet = ss.getSheetByName('Menu_CP');
  if (!menuSheet) { ui.alert('❌ Menu_CP not found. Run Setup first.'); return; }
  
  var headers = menuSheet.getRange(1, 1, 1, menuSheet.getLastColumn()).getValues()[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  var imported = 0;
  
  // Build parent title map for nesting
  var parentMap = {}; // menu_item_id → title
  
  structure.menus.forEach(function(menu) {
    var position = menu.name.toLowerCase().indexOf('sekund') >= 0 ? 'secondary' : 'primary';
    var order = 0;
    
    // First pass: build parent map
    menu.items.forEach(function(item) {
      parentMap[item.id] = item.title;
    });
    
    // Second pass: create rows
    menu.items.forEach(function(item) {
      order += 10;
      
      var parentTitle = '';
      if (item.parent && item.parent !== '0' && parentMap[item.parent]) {
        parentTitle = parentMap[item.parent];
      }
      
      var type = 'custom';
      var slug = item.url || '';
      if (item.type === 'post_type') type = 'page';
      if (item.type === 'taxonomy') type = 'category';
      if (slug.indexOf('http') === 0 && slug.indexOf(domain) < 0) type = 'external';
      
      var newRow = new Array(headers.length).fill('');
      newRow[col['Domain']] = domain;
      newRow[col['Position']] = position;
      newRow[col['Order']] = order;
      newRow[col['Title']] = item.title;
      newRow[col['Parent']] = parentTitle;
      newRow[col['Type']] = type;
      newRow[col['Slug_or_URL']] = slug;
      newRow[col['Active']] = true;
      
      menuSheet.appendRow(newRow);
      imported++;
    });
  });
  
  ui.alert('📥 Menu Import\n\n✅ Zaimportowano ' + imported + ' pozycji z ' + domain + 
    '\n\nSprawdź kartę Menu_CP, dostosuj i odpal Deploy Menu.');
}