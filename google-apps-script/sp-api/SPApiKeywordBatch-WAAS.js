/**
 * SP-API Keyword Batch Search for WAAS System
 *
 * Pozwala wprowadzic liste fraz wyszukiwania w karcie "Search_Keywords"
 * i jednym klikniecciem zaimportowac produkty z Amazon SP-API dla wszystkich
 * zaznaczonych wierszy (Search = TRUE) - sekwencyjnie, czekajac az kazda
 * operacja sie zakonczy zanim wystartuje nastepna.
 *
 * Karta zawiera kolumny:
 *   - ID                 (auto-increment)
 *   - Keyword            (fraza do wyszukania)
 *   - Marketplace        (dropdown z SP_MARKETPLACE_CONFIG, domyslnie DE)
 *   - Limit              (ile produktow zaimportowac, domyslnie 10)
 *   - Search             (checkbox - zaznacz TRUE aby wlaczyc wiersz do batcha)
 *   - Status             (PENDING / DONE / FAILED / SKIPPED)
 *   - Last Search Date   (data wykonania, format DD.MM.YYYY HH:MM)
 *   - Found              (ile produktow znaleziono w wyszukiwaniu)
 *   - Imported           (ile zaimportowano do Products tab)
 *   - Notes              (komunikat bledu / dodatkowe informacje)
 *
 * Po zakonczeniu udanego wyszukiwania checkbox "Search" w danym wierszu
 * zostaje zamieniony na wartosc "DONE" (jak w Products przy WooCommerce
 * Export), a data wpisana do "Last Search Date".
 *
 * @version 1.0
 * @author NetAnaliza / LUKO
 */

const SP_KEYWORDS_SHEET = 'Search_Keywords';
const SP_KEYWORDS_HEADERS = [
  'ID',
  'Keyword',
  'Marketplace',
  'Limit',
  'Search',
  'Status',
  'Last Search Date',
  'Found',
  'Imported',
  'Notes'
];

// ==================== SETUP ====================

/**
 * Menu: Setup / repair Search_Keywords sheet.
 * Tworzy karte jezeli nie istnieje, dodaje brakujace kolumny,
 * ustawia walidacje (dropdown marketplace, checkbox Search) oraz
 * formatowanie warunkowe.
 */
function spSetupSearchKeywordsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SP_KEYWORDS_SHEET);
  const created = !sheet;

  if (!sheet) {
    sheet = ss.insertSheet(SP_KEYWORDS_SHEET);
  }

  // Naglowki (zachowaj istniejace, dodaj brakujace na koncu)
  const lastCol = sheet.getLastColumn();
  const existingHeaders = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().trim())
    : [];

  const missing = SP_KEYWORDS_HEADERS.filter(h => !existingHeaders.includes(h));
  if (missing.length > 0) {
    const startCol = (existingHeaders.length > 0 ? existingHeaders.length : 0) + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  }

  // Po dodaniu - swiezy mapping
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold').setBackground('#1c4587').setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  const headers = headerRange.getValues()[0];
  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h.toString().trim()] = i + 1; });

  // Walidacja: Marketplace (dropdown)
  if (colIdx['Marketplace']) {
    const marketplaceCodes = Object.keys(SP_MARKETPLACE_CONFIG);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(marketplaceCodes, true)
      .setAllowInvalid(false)
      .setHelpText('Wybierz marketplace Amazon')
      .build();
    sheet.getRange(2, colIdx['Marketplace'], sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }

  // Walidacja: Search (checkbox)
  if (colIdx['Search']) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, colIdx['Search'], sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }

  // Formatowanie warunkowe: DONE = zielony, FAILED = czerwony, PENDING = zolty
  if (colIdx['Status']) {
    const statusRange = sheet.getRange(2, colIdx['Status'], sheet.getMaxRows() - 1, 1);
    const rules = sheet.getConditionalFormatRules().filter(r => {
      return r.getRanges().every(rg => rg.getA1Notation() !== statusRange.getA1Notation());
    });
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('DONE')
      .setBackground('#d9ead3')
      .setRanges([statusRange])
      .build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('FAILED')
      .setBackground('#f4cccc')
      .setRanges([statusRange])
      .build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PENDING')
      .setBackground('#fff2cc')
      .setRanges([statusRange])
      .build());
    sheet.setConditionalFormatRules(rules);
  }

  // Szerokosci kolumn
  if (colIdx['Keyword'])           sheet.setColumnWidth(colIdx['Keyword'], 280);
  if (colIdx['Marketplace'])       sheet.setColumnWidth(colIdx['Marketplace'], 110);
  if (colIdx['Limit'])             sheet.setColumnWidth(colIdx['Limit'], 80);
  if (colIdx['Search'])            sheet.setColumnWidth(colIdx['Search'], 80);
  if (colIdx['Status'])            sheet.setColumnWidth(colIdx['Status'], 100);
  if (colIdx['Last Search Date'])  sheet.setColumnWidth(colIdx['Last Search Date'], 150);
  if (colIdx['Found'])             sheet.setColumnWidth(colIdx['Found'], 80);
  if (colIdx['Imported'])          sheet.setColumnWidth(colIdx['Imported'], 90);
  if (colIdx['Notes'])             sheet.setColumnWidth(colIdx['Notes'], 320);

  SpreadsheetApp.getUi().alert(
    'Search_Keywords',
    created
      ? `Karta "${SP_KEYWORDS_SHEET}" utworzona.\n\nWprowadz frazy, ustaw Marketplace + Limit, zaznacz checkbox Search i uruchom: WAAS > SP-API Import > Run Keyword Batch.`
      : `Karta "${SP_KEYWORDS_SHEET}" zaktualizowana${missing.length ? ' (dodano ' + missing.length + ' kolumn).' : '.'}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ==================== BATCH RUN ====================

const SP_KEYWORDS_CONTINUATION_TRIGGER = 'spRunKeywordBatchContinuation';

/**
 * Menu entry: pyta uzytkownika i uruchamia batch.
 */
function spRunKeywordBatch() {
  _spRunKeywordBatchInternal({ skipConfirm: false });
}

/**
 * Trigger entry: wywolywane automatycznie przez ScriptApp gdy poprzedni
 * przebieg trafil na timeout i zostawil wiersze PENDING. Sprzata wlasny
 * trigger na starcie i leci dalej bez UI.
 */
function spRunKeywordBatchContinuation() {
  _spKeywordsCleanupTriggers();
  _spRunKeywordBatchInternal({ skipConfirm: true, fromTrigger: true });
}

function _spRunKeywordBatchInternal(opts) {
  opts = opts || {};
  const fromTrigger = !!opts.fromTrigger;
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { ui = null; }

  function notify(title, msg) {
    if (ui) ui.alert(title, msg, ui.ButtonSet.OK);
    else Logger.log(`[SP-API Keyword Batch] ${title}: ${msg}`);
  }

  if (!spHasCredentials()) {
    notify('SP-API nie skonfigurowane', 'Brak danych SP-API.\n\nUruchom: WAAS > SP-API Import > Setup Credentials');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SP_KEYWORDS_SHEET);
  if (!sheet) {
    notify('Brak karty', `Karta "${SP_KEYWORDS_SHEET}" nie istnieje.`);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    if (!fromTrigger) notify('Brak danych', 'Karta jest pusta. Wprowadz frazy i zaznacz Search.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().trim());
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  for (const name of ['Keyword', 'Search']) {
    if (col[name] === undefined) {
      notify('Brak kolumny', `Karta ${SP_KEYWORDS_SHEET} nie ma kolumny "${name}".`);
      return;
    }
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const queue = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const searchVal = row[col['Search']];
    const isChecked = searchVal === true || searchVal === 'TRUE' || searchVal === 'true';
    if (!isChecked) continue;

    const keyword = (row[col['Keyword']] || '').toString().trim();
    if (!keyword) continue;

    let marketplace = (col['Marketplace'] !== undefined ? row[col['Marketplace']] : '')
      .toString().trim().toUpperCase() || 'DE';
    if (!SP_MARKETPLACE_CONFIG[marketplace]) marketplace = 'DE';

    let limit = parseInt(col['Limit'] !== undefined ? row[col['Limit']] : '', 10);
    if (isNaN(limit) || limit <= 0) limit = 10;

    queue.push({ rowIndex: i + 2, keyword, marketplace, limit });
  }

  if (queue.length === 0) {
    if (!fromTrigger) notify('Brak zaznaczonych wierszy', 'Zaznacz checkbox "Search" w wierszach do przetworzenia i sprobuj ponownie.');
    _spKeywordsCleanupTriggers();
    return;
  }

  if (!opts.skipConfirm && ui) {
    const confirm = ui.alert(
      'Uruchomic batch?',
      `Znaleziono ${queue.length} zaznaczonych fraz do przetworzenia.\n\n` +
      queue.slice(0, 8).map(q => `  - "${q.keyword}" (${q.marketplace}, limit ${q.limit})`).join('\n') +
      (queue.length > 8 ? `\n  ... + ${queue.length - 8} kolejnych` : '') +
      '\n\nKazda fraza jest przetwarzana sekwencyjnie. Jezeli batch trafi w timeout Apps Script,' +
      ' pozostale wiersze zostana automatycznie wznowione za 1 minute.',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  }

  const accessToken = spGetAccessToken();
  const startTime = Date.now();
  const maxTime = 5 * 60 * 1000;

  const stats = { done: 0, failed: 0, skipped: 0, totalImported: 0 };
  let timedOut = false;

  for (let q = 0; q < queue.length; q++) {
    const item = queue[q];

    if (Date.now() - startTime > maxTime) {
      _spKeywordsWriteRow(sheet, col, item.rowIndex, {
        status: 'PENDING',
        notes: 'Przerwano - timeout Apps Script. Auto-wznowienie za 1 min.'
      });
      stats.skipped++;
      timedOut = true;
      continue;
    }

    ss.toast(`(${q + 1}/${queue.length}) Szukam "${item.keyword}" w ${item.marketplace}...`, 'SP-API Keyword Batch', 30);

    try {
      const mpConfig = SP_MARKETPLACE_CONFIG[item.marketplace];
      const searchResults = spSearchProducts(item.keyword, mpConfig, accessToken, 5);

      if (!searchResults || searchResults.length === 0) {
        _spKeywordsWriteRow(sheet, col, item.rowIndex, {
          status: 'FAILED',
          date: _spKeywordsNow(),
          found: 0,
          imported: 0,
          notes: 'Brak wynikow w SP-API',
          markDone: false
        });
        stats.failed++;
        continue;
      }

      const importCount = Math.min(item.limit, searchResults.length);
      const asinsToImport = searchResults.slice(0, importCount).map(r => r.asin);

      ss.toast(`(${q + 1}/${queue.length}) Importuje ${asinsToImport.length} produktow dla "${item.keyword}"...`, 'SP-API Keyword Batch', 30);
      const results = spFetchAndWriteProducts(asinsToImport, item.marketplace, { fetchVariants: false });

      const notes = `success=${results.success}, skipped=${results.skipped}, failed=${results.failed}` +
        (results.errors && results.errors.length ? ` | ${results.errors.slice(0, 3).join('; ')}` : '');

      _spKeywordsWriteRow(sheet, col, item.rowIndex, {
        status: 'DONE',
        date: _spKeywordsNow(),
        found: searchResults.length,
        imported: results.success,
        notes: notes,
        markDone: true
      });
      stats.done++;
      stats.totalImported += results.success;

    } catch (err) {
      _spKeywordsWriteRow(sheet, col, item.rowIndex, {
        status: 'FAILED',
        date: _spKeywordsNow(),
        notes: `Blad: ${err.message}`.substring(0, 500),
        markDone: false
      });
      stats.failed++;
      Logger.log(`[SP-API Keyword Batch] Row ${item.rowIndex} "${item.keyword}": ${err.message}`);
    }

    SpreadsheetApp.flush();
  }

  let suffix = '';
  if (timedOut) {
    _spKeywordsScheduleContinuation();
    suffix = '\n\nPozostalo ' + stats.skipped + ' wierszy PENDING - auto-wznowienie za 1 minute.';
  } else {
    _spKeywordsCleanupTriggers();
  }

  const summary =
    `Przetworzono: ${queue.length} fraz\n` +
    `  DONE:     ${stats.done}\n` +
    `  FAILED:   ${stats.failed}\n` +
    `  SKIPPED:  ${stats.skipped} (timeout)\n\n` +
    `Lacznie zaimportowano do Products: ${stats.totalImported} produktow.` +
    suffix;

  if (ui && !fromTrigger) {
    ui.alert('SP-API Keyword Batch - zakonczone', summary, ui.ButtonSet.OK);
  } else {
    ss.toast(`DONE=${stats.done}, FAILED=${stats.failed}, PENDING=${stats.skipped}, imported=${stats.totalImported}` + (timedOut ? ' (auto-wznowienie za 1 min)' : ''), 'SP-API Keyword Batch', 20);
    Logger.log(`[SP-API Keyword Batch] ${summary.replace(/\n/g, ' | ')}`);
  }
}

/**
 * Instaluje jednorazowy trigger spRunKeywordBatchContinuation za ~1 minute.
 * Najpierw kasuje istniejace triggery zeby nie skumulowac duplikatow.
 */
function _spKeywordsScheduleContinuation() {
  _spKeywordsCleanupTriggers();
  ScriptApp.newTrigger(SP_KEYWORDS_CONTINUATION_TRIGGER)
    .timeBased()
    .after(60 * 1000)
    .create();
  Logger.log('[SP-API Keyword Batch] Continuation trigger installed (+60s)');
}

/**
 * Usuwa wszystkie zainstalowane triggery kontynuacji.
 */
function _spKeywordsCleanupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction() === SP_KEYWORDS_CONTINUATION_TRIGGER) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  if (removed) Logger.log(`[SP-API Keyword Batch] Removed ${removed} continuation trigger(s).`);
}

// ==================== HELPERS ====================

function _spKeywordsNow() {
  return Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
}

/**
 * Zapisz wynik dla pojedynczego wiersza.
 * Jezeli markDone=true, zamienia checkbox Search na wartosc tekstowa "DONE"
 * (tak jak w Products przy WooCommerce Export).
 */
function _spKeywordsWriteRow(sheet, col, rowIndex, update) {
  if (update.status !== undefined && col['Status'] !== undefined) {
    sheet.getRange(rowIndex, col['Status'] + 1).setValue(update.status);
  }
  if (update.date !== undefined && col['Last Search Date'] !== undefined) {
    sheet.getRange(rowIndex, col['Last Search Date'] + 1).setValue(update.date);
  }
  if (update.found !== undefined && col['Found'] !== undefined) {
    sheet.getRange(rowIndex, col['Found'] + 1).setValue(update.found);
  }
  if (update.imported !== undefined && col['Imported'] !== undefined) {
    sheet.getRange(rowIndex, col['Imported'] + 1).setValue(update.imported);
  }
  if (update.notes !== undefined && col['Notes'] !== undefined) {
    sheet.getRange(rowIndex, col['Notes'] + 1).setValue(update.notes);
  }
  if (update.markDone && col['Search'] !== undefined) {
    const cell = sheet.getRange(rowIndex, col['Search'] + 1);
    cell.clearDataValidations();
    cell.setValue('DONE');
  }
}
