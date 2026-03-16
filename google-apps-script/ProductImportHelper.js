/**
 * ============================================================================
 * PRODUCT IMPORT HELPER
 * ============================================================================
 *
 * Funkcje pomocnicze dla importu produktów z Amazon PA-API
 *
 * UWAGA: Ta funkcja powinna być wywoływana PO dodaniu produktu do arkusza
 *
 * ============================================================================
 */

/**
 * Ustaw checkbox Select na TRUE dla nowo zaimportowanego produktu
 *
 * Wywołaj tę funkcję po dodaniu produktu z PA-API do arkusza:
 *
 * @example
 * // Po dodaniu produktu:
 * const rowIndex = sheet.getLastRow();
 * setProductCheckboxForPAImport(rowIndex);
 *
 * @param {number} rowIndex - Numer wiersza produktu w arkuszu
 * @param {boolean} selected - Czy zaznaczyć checkbox (domyślnie TRUE)
 */
function setProductCheckboxForPAImport(rowIndex, selected = true) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Products');

    if (!sheet) {
      throw new Error('Products sheet not found');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Znajdź kolumnę Select
    const selectColIdx = headers.indexOf('Select');
    if (selectColIdx === -1) {
      logWarning('IMPORT', 'Select column not found - run setupWooCommerceExportColumns() first');
      return false;
    }

    // Znajdź kolumnę Source
    const sourceColIdx = headers.indexOf('Source');

    // Ustaw checkbox Select (pusty = unchecked, nie FALSE)
    if (selected) {
      sheet.getRange(rowIndex, selectColIdx + 1).setValue(true);
    } else {
      // Pozostaw pusty (nie FALSE) - łatwiej kliknąć
      sheet.getRange(rowIndex, selectColIdx + 1).clearContent();
    }

    // Ustaw Source na "PA API"
    if (sourceColIdx >= 0) {
      sheet.getRange(rowIndex, sourceColIdx + 1).setValue('PA API');
    }

    logSuccess('IMPORT', `Set checkbox for row ${rowIndex} to ${selected}`);
    return true;

  } catch (error) {
    logError('IMPORT', `Error setting checkbox: ${error.message}`);
    return false;
  }
}

/**
 * Ustaw checkbox dla wielu produktów naraz
 *
 * @param {Array<number>} rowIndexes - Array z numerami wierszy
 * @param {boolean} selected - Czy zaznaczyć checkboxy
 */
function setProductCheckboxesForPAImport(rowIndexes, selected = true) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Products');

    if (!sheet) {
      throw new Error('Products sheet not found');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Znajdź kolumny
    const selectColIdx = headers.indexOf('Select');
    const sourceColIdx = headers.indexOf('Source');

    if (selectColIdx === -1) {
      logWarning('IMPORT', 'Select column not found');
      return false;
    }

    // Ustaw dla wszystkich wierszy
    let count = 0;
    for (const rowIndex of rowIndexes) {
      // Checkbox (pusty = unchecked, nie FALSE)
      if (selected) {
        sheet.getRange(rowIndex, selectColIdx + 1).setValue(true);
      } else {
        sheet.getRange(rowIndex, selectColIdx + 1).setValue('');
      }

      // Source
      if (sourceColIdx >= 0) {
        sheet.getRange(rowIndex, sourceColIdx + 1).setValue('PA API');
      }

      count++;
    }

    logSuccess('IMPORT', `Set checkboxes for ${count} products`);
    return true;

  } catch (error) {
    logError('IMPORT', `Error setting checkboxes: ${error.message}`);
    return false;
  }
}

/**
 * Ustaw domyślne wartości dla nowo dodanego produktu
 *
 * @param {number} rowIndex - Numer wiersza produktu
 * @param {Object} options - Opcje {selected: true, source: 'PA API', targetDomain: '...'}
 */
function setDefaultValuesForNewProduct(rowIndex, options = {}) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Products');

    if (!sheet) {
      throw new Error('Products sheet not found');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Domyślne wartości
    const defaults = {
      selected: options.selected !== undefined ? options.selected : true,
      source: options.source || 'PA API',
      exportStatus: options.exportStatus || 'Pending',
      targetDomain: options.targetDomain || ''
    };

    // Ustaw wartości
    const selectColIdx = headers.indexOf('Select');
    const sourceColIdx = headers.indexOf('Source');
    const exportStatusColIdx = headers.indexOf('Export Status');
    const targetDomainColIdx = headers.indexOf('Target Domain');

    if (selectColIdx >= 0) {
      sheet.getRange(rowIndex, selectColIdx + 1).setValue(defaults.selected);
    }

    if (sourceColIdx >= 0) {
      sheet.getRange(rowIndex, sourceColIdx + 1).setValue(defaults.source);
    }

    if (exportStatusColIdx >= 0) {
      sheet.getRange(rowIndex, exportStatusColIdx + 1).setValue(defaults.exportStatus);
    }

    if (targetDomainColIdx >= 0 && defaults.targetDomain) {
      sheet.getRange(rowIndex, targetDomainColIdx + 1).setValue(defaults.targetDomain);
    }

    logSuccess('IMPORT', `Set default values for row ${rowIndex}`);
    return true;

  } catch (error) {
    logError('IMPORT', `Error setting defaults: ${error.message}`);
    return false;
  }
}

/**
 * PRZYKŁAD UŻYCIA:
 *
 * Po dodaniu produktu z PA-API do arkusza, wywołaj jedną z funkcji:
 *
 * // Opcja 1: Tylko checkbox
 * setProductCheckboxForPAImport(lastRow);
 *
 * // Opcja 2: Checkbox + inne wartości
 * setDefaultValuesForNewProduct(lastRow, {
 *   selected: true,
 *   source: 'PA API',
 *   targetDomain: 'example.com'
 * });
 *
 * // Opcja 3: Dla wielu produktów naraz
 * const rowIndexes = [5, 6, 7, 8];
 * setProductCheckboxesForPAImport(rowIndexes, true);
 */
