/**
 * WAAS Content Pipeline — Sheet Reorganization
 * Kompaktowy widok: workflow mieści się na ekranie
 */

function cpReorganizeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Queue') || ss.getSheetByName('Content Pipeline');
  if (!sheet) { SpreadsheetApp.getUi().alert('Brak karty Content Queue / Content Pipeline'); return; }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cpIdCol = headers.indexOf('ID_CP');
  if (cpIdCol < 0) { SpreadsheetApp.getUi().alert('Brak kolumn Pipeline.'); return; }
  
  // ========== 1. PRZESUN stare kolumny NA PRAWO ==========
  if (cpIdCol > 0) {
    var oldColCount = cpIdCol;
    var lastCol = sheet.getLastColumn();
    var lastRow = Math.max(sheet.getLastRow(), 2);
    
    for (var i = 0; i < oldColCount; i++) {
      sheet.insertColumnAfter(sheet.getLastColumn());
    }
    var sourceRange = sheet.getRange(1, 1, lastRow, oldColCount);
    var targetRange = sheet.getRange(1, lastCol + 1, lastRow, oldColCount);
    sourceRange.copyTo(targetRange);
    sheet.getRange(1, lastCol + 1, 1, oldColCount)
      .setBackground('#E0E0E0').setFontColor('#9E9E9E').setFontStyle('italic');
    sheet.deleteColumns(1, oldColCount);
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  
  // ========== 2. NAZWA + TAB ==========
  sheet.setName('Content Pipeline');
  sheet.setTabColor('#EF6C00');
  
  // ========== 3. UKRYJ kolumny rzadko uzywane (konfiguracja, JSON, szczegoly) ==========
  // Zostaw widoczne TYLKO workflow: ID, Domain, Title, Keyword, ASINs, ▶Text, ▶Parse, Status, ▶Export, PostURL
  var hideColumns = [
    'Content_Type_CP', 'Headline_Type_CP', 'Headline_Strategy_CP', 
    'Text_Length_CP', 'Products_Count_CP',
    'Include_FAQ_CP', 'FAQ_Count_CP', 'Include_Culture_CP',
    'Secondary_Keywords_CP', 'Problem_Need_CP', 'Target_Audience_CP', 'Notes_CP',
    'Text_Prompt_CP', 'Text_Response_CP',
    'Final_Slug_CP', 'Excerpt_CP', 'Sections_JSON_CP',
    'Meta_Description_CP', 'SEO_Title_CP', 'Focus_Keyword_CP', 'Tags_CP',
    'FAQ_JSON_CP', 'CTAs_JSON_CP',
    'Image_Prompt_CP', 'Image_Response_CP',
    'Video_Prompt_CP', 'Video_Response_CP',
    'Quality_Details_CP', 'Select_CP',
    'Post_ID_CP',
  ];
  
  hideColumns.forEach(function(colName) {
    var idx = headers.indexOf(colName);
    if (idx >= 0) sheet.hideColumns(idx + 1);
  });
  
  // ========== 4. SZEROKOSCI widocznych kolumn ==========
  var visibleWidths = {
    'ID_CP': 95,
    'Target_Domain_CP': 185,
    'Working_Title_CP': 260,
    'Primary_Keyword_CP': 170,
    'Product_ASINs_CP': 140,
    '\u25b6Text_CP': 45,
    '\u25b6ParseText_CP': 45,
    'Final_Title_CP': 220,
    'Word_Count_CP': 50,
    '\u25b6Image_CP': 45,
    '\u25b6ParseImage_CP': 45,
    '\u25b6Video_CP': 45,
    '\u25b6ParseVideo_CP': 45,
    'Quality_Score_CP': 45,
    'Status_CP': 90,
    '\u25b6Export_CP': 45,
    'Post_URL_CP': 180,
    'Export_Date_CP': 90,
  };
  
  headers.forEach(function(h, idx) {
    if (visibleWidths[h]) sheet.setColumnWidth(idx + 1, visibleWidths[h]);
  });
  
  // ========== 5. KOLORUJ ==========
  var maxRow = Math.min(Math.max(sheet.getLastRow(), 5), 50);
  
  // Naglowki CP_ - ciemne tlo
  var firstCp = headers.indexOf('ID_CP');
  var lastCp = firstCp;
  for (var i = firstCp; i < headers.length; i++) {
    if (headers[i] && headers[i].toString().endsWith('_CP')) lastCp = i;
  }
  if (firstCp >= 0) {
    sheet.getRange(1, firstCp + 1, 1, lastCp - firstCp + 1)
      .setFontWeight('bold').setFontSize(9)
      .setBackground('#37474F').setFontColor('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  }
  
  // Kolory danych
  var colors = {};
  colors['ID_CP'] = '#FFFDE7'; colors['Target_Domain_CP'] = '#FFFDE7';
  colors['\u25b6Text_CP'] = '#BBDEFB'; colors['\u25b6ParseText_CP'] = '#BBDEFB';
  colors['\u25b6Image_CP'] = '#FFE0B2'; colors['\u25b6ParseImage_CP'] = '#FFE0B2';
  colors['\u25b6Video_CP'] = '#E1BEE7'; colors['\u25b6ParseVideo_CP'] = '#E1BEE7';
  colors['\u25b6Export_CP'] = '#A5D6A7'; colors['Select_CP'] = '#C8E6C9';
  colors['Final_Title_CP'] = '#E8F5E9'; colors['Word_Count_CP'] = '#E8F5E9';
  colors['Post_URL_CP'] = '#E8F5E9'; colors['Export_Date_CP'] = '#E8F5E9';
  colors['Quality_Score_CP'] = '#ECEFF1'; colors['Status_CP'] = '#ECEFF1';
  
  headers.forEach(function(h, idx) {
    if (colors[h]) sheet.getRange(2, idx + 1, maxRow, 1).setBackground(colors[h]);
  });
  
  // ========== 6. WYMUŚ WYSOKOSC 42px + CLIP ==========
  // Najpierw CLIP na WSZYSTKO
  sheet.getRange(2, 1, Math.min(maxRow, 200), sheet.getLastColumn())
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  
  // Potem WYMUŚ wysokosc
  for (var r = 2; r <= Math.min(maxRow + 1, 100); r++) {
    sheet.setRowHeight(r, 42);
  }
  
  // ========== 7. ZAMROZ ==========
  var tdCol = headers.indexOf('Target_Domain_CP');
  if (tdCol >= 0) sheet.setFrozenColumns(tdCol + 1);
  sheet.setFrozenRows(1);
  
  SpreadsheetApp.getUi().alert(
    'Arkusz zreorganizowany!\n\n' +
    'Widoczne: ID, Domain, Title, Keyword, ASINs, akcje, Status, Export\n' +
    'Ukryte: konfiguracja, prompty, JSON (Show columns zeby odkryc)\n' +
    'Stare kolumny na prawo\n' +
    'Wiersze 42px'
  );
}

/**
 * Pokaz WSZYSTKIE kolumny (odkryj ukryte)
 */
function cpShowAllColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) return;
  sheet.showColumns(1, sheet.getLastColumn());
  SpreadsheetApp.getUi().alert('Wszystkie kolumny odkryte.');
}

/**
 * Kompaktowy widok (ukryj konfiguracje i szczegoly)
 */
function cpCompactView() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Najpierw pokaz wszystkie CP_
  var firstCp = headers.indexOf('ID_CP');
  if (firstCp >= 0) {
    var lastCp = firstCp;
    for (var i = firstCp; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().endsWith('_CP')) lastCp = i;
    }
    sheet.showColumns(firstCp + 1, lastCp - firstCp + 1);
  }
  
  // Ukryj kolumny konfiguracji i szczegolow
  var hide = [
    'Content_Type_CP', 'Headline_Type_CP', 'Headline_Strategy_CP',
    'Text_Length_CP', 'Products_Count_CP',
    'Include_FAQ_CP', 'FAQ_Count_CP', 'Include_Culture_CP',
    'Secondary_Keywords_CP', 'Problem_Need_CP', 'Target_Audience_CP', 'Notes_CP',
    'Text_Prompt_CP', 'Text_Response_CP',
    'Final_Slug_CP', 'Excerpt_CP', 'Sections_JSON_CP',
    'Meta_Description_CP', 'SEO_Title_CP', 'Focus_Keyword_CP', 'Tags_CP',
    'FAQ_JSON_CP', 'CTAs_JSON_CP',
    'Image_Prompt_CP', 'Image_Response_CP',
    'Video_Prompt_CP', 'Video_Response_CP',
    'Quality_Details_CP', 'Select_CP', 'Post_ID_CP',
  ];
  
  hide.forEach(function(colName) {
    var idx = headers.indexOf(colName);
    if (idx >= 0) sheet.hideColumns(idx + 1);
  });
  
  // Wymus wysokosc
  var maxRow = Math.min(Math.max(sheet.getLastRow(), 5), 100);
  sheet.getRange(2, 1, maxRow, sheet.getLastColumn())
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  for (var r = 2; r <= maxRow; r++) {
    sheet.setRowHeight(r, 42);
  }
  
  SpreadsheetApp.getUi().alert('Widok kompaktowy aktywny.\nUzyj "Show All Columns" zeby odkryc.');
}

/**
 * Zmienia nazwy kolumn z CP_xxx na xxx_CP w arkuszu
 * Uruchom RAZ po aktualizacji kodu
 */
function cpRenameColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) { SpreadsheetApp.getUi().alert('Brak karty'); return; }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var renamed = 0;
  
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].toString();
    if (h.indexOf('CP_') === 0 && h !== 'CP_CONFIG') {
      var newName = h.substring(3) + '_CP';  // Remove CP_ prefix, add _CP suffix
      sheet.getRange(1, i + 1).setValue(newName);
      renamed++;
    }
  }
  
  // Rename tabs too
  var mq = ss.getSheetByName('CP Media Queue');
  if (mq) mq.setName('Media Queue_CP');
  var vq = ss.getSheetByName('CP Video Queue');
  if (vq) vq.setName('Video Queue_CP');
  var dd = ss.getSheetByName('CP Dropdowns');
  if (dd) dd.setName('Dropdowns_CP');
  
  SpreadsheetApp.getUi().alert('Przemianowano ' + renamed + ' kolumn z CP_xxx na xxx_CP.\nKarty też przemianowane.');
}