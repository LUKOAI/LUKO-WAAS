/**
 * WAAS Content Pipeline — Setup Additions v4.3
 * 
 * Run ONCE to add new columns and sheets for:
 * - Post_Type_CP (post/page dropdown)
 * - Existing_Post_ID_CP (for updating existing pages)
 * - Category_Queue_CP sheet
 * 
 * Menu: WAAS → Content Pipeline → ⚙️ Setup v4.3 Additions
 */

function cpSetupV43Additions() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var results = [];
  
  // === 1. Add columns to Content Pipeline ===
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (cpSheet) {
    var headers = cpSheet.getRange(1, 1, 1, cpSheet.getLastColumn()).getValues()[0];
    var existingCols = {};
    headers.forEach(function(h, i) { existingCols[h.toString().trim()] = i; });
    
    var newCols = [
      { name: 'Post_Type_CP', after: 'Content_Type_CP' },
      { name: 'Existing_Post_ID_CP', after: 'Post_ID_CP' },
    ];
    
    newCols.forEach(function(nc) {
      if (existingCols[nc.name] !== undefined) {
        results.push('⏭️ ' + nc.name + ' already exists');
        return;
      }
      
      // Find position to insert
      var afterIdx = existingCols[nc.after];
      var insertCol;
      if (afterIdx !== undefined) {
        insertCol = afterIdx + 2; // +1 for 0-index, +1 for after
      } else {
        insertCol = cpSheet.getLastColumn() + 1;
      }
      
      cpSheet.insertColumnAfter(insertCol - 1);
      cpSheet.getRange(1, insertCol).setValue(nc.name);
      
      results.push('✅ ' + nc.name + ' added at column ' + insertCol);
      
      // Update existingCols for subsequent inserts
      headers = cpSheet.getRange(1, 1, 1, cpSheet.getLastColumn()).getValues()[0];
      existingCols = {};
      headers.forEach(function(h, i) { existingCols[h.toString().trim()] = i; });
    });
    
    // Add dropdown for Post_Type_CP
    if (existingCols['Post_Type_CP'] !== undefined) {
      var ptCol = existingCols['Post_Type_CP'] + 1;
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['post', 'page'], true)
        .setAllowInvalid(false)
        .build();
      cpSheet.getRange(2, ptCol, 998, 1).setDataValidation(rule);
      // Default to 'post'
      for (var r = 2; r <= Math.min(cpSheet.getLastRow(), 100); r++) {
        if (!cpSheet.getRange(r, ptCol).getValue()) {
          cpSheet.getRange(r, ptCol).setValue('post');
        }
      }
      results.push('✅ Post_Type_CP dropdown set (post/page)');
    }
  } else {
    results.push('❌ Content Pipeline sheet not found');
  }
  
  // === 2. Create Category_Queue_CP sheet ===
  var catSheet = ss.getSheetByName('Category_Queue_CP');
  if (!catSheet) {
    catSheet = ss.insertSheet('Category_Queue_CP');
    
    var catHeaders = [
      'Domain',              // A — Target domain
      'Category_Name',       // B — Name
      'Slug',                // C — URL slug
      'Description',         // D — Category description (AI generated)
      'Parent_Slug',         // E — Parent category slug (for hierarchy)
      'SEO_Title',           // F — RankMath title
      'SEO_Description',     // G — RankMath description
      '▶Export_Cat',         // H — Checkbox for export
      'Status',              // I — Export status
      'Term_ID',             // J — WP term ID after export
      'Notes',               // K
    ];
    
    catSheet.getRange(1, 1, 1, catHeaders.length).setValues([catHeaders]);
    catSheet.getRange(1, 1, 1, catHeaders.length).setFontWeight('bold').setBackground('#E8F5E9');
    
    // Set checkbox for export column
    catSheet.getRange(2, 8, 200, 1).insertCheckboxes();
    
    // Set column widths
    catSheet.setColumnWidth(1, 200); // Domain
    catSheet.setColumnWidth(2, 180); // Name
    catSheet.setColumnWidth(3, 150); // Slug
    catSheet.setColumnWidth(4, 400); // Description
    catSheet.setColumnWidth(5, 120); // Parent
    catSheet.setColumnWidth(6, 200); // SEO Title
    catSheet.setColumnWidth(7, 300); // SEO Desc
    
    // Freeze header
    catSheet.setFrozenRows(1);
    
    results.push('✅ Category_Queue_CP sheet created');
  } else {
    results.push('⏭️ Category_Queue_CP already exists');
  }
  
  ui.alert('⚙️ Setup v4.3 Additions\n\n' + results.join('\n'));
}