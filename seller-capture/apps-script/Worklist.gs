/**
 * Worklist.gs — operator UI for the new "Sellers Worklist" spreadsheet.
 *
 * Tabs:
 *   Worklist          – slice from BQ (max ~5k rows), the only place operators work
 *   Capture inbox     – populated by extension via Capture.gs doPost
 *   agency_blacklist  – seed from data/agency_blacklist_seed.csv, editable
 *   _operators        – operator_id | name | email | lang (en|pl)
 *   _config           – key | value (read-only; secrets live in Script Properties)
 *
 * Script Properties (required):
 *   BQ_PROJECT_ID, BQ_DATASET
 *   ENRICH_QUEUE_URL       – Cloud Run/Function endpoint that accepts seller_ids to enrich
 *   ACTION_BLAND_URL, ACTION_VAPI_URL, KARTRA_WEBHOOK_URL
 *   ENRICH_SHARED_SECRET   – HMAC for the enrichment + action endpoints
 *   SITEPATRON_SYNC_SHEET  – id of LUKO_Domain_Slug_Finder (for hand-off)
 */

const TAB_WORKLIST = 'Worklist';
const TAB_INBOX = 'Capture inbox';
const TAB_OPS = '_operators';
const TAB_CONFIG = '_config';

const WORKLIST_HEADERS = [
  '☑', 'cluster_id', 'cluster_anchor', 'seller_id', 'marketplace', 'country', 'company_name',
  'decision_maker_name', 'decision_maker_role',
  'email', 'phone', 'website',
  'agency_flag', 'confidence', 'status',
  'last_action', 'last_action_at', 'last_action_result',
  'kartra_pushed_at', 'notes', 'action'
];

const ACTION_OPTIONS = [
  '', 'AI call (Bland)', 'AI call (Vapi)',
  'Send email — intro EN', 'Send email — intro PL',
  'Send email — follow-up EN', 'Send email — follow-up PL',
  'Push to Kartra funnel', 'Push to SitePatron (converted)',
  'Mark dead', 'Skip', 'Re-enrich'
];

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const lang = _operatorLang_();
  const t = _i18n(lang);
  ui.createMenu('🦊 Luko Sellers')
    .addItem(t.refresh, 'refreshWorklist')
    .addItem(t.runSelected, 'runSelectedActions')
    .addItem(t.enrichSelected, 'enrichSelected')
    .addItem(t.enrichAllPending, 'enrichAllPending')
    .addSeparator()
    .addItem(t.openInbox, 'openInbox')
    .addItem(t.setup, 'setupWorklistSheet')
    .addItem(t.setLang, 'showLangPicker')
    .addToUi();
  _ensureTabs_();
}

function _i18n(lang) {
  const en = {
    refresh: '🔄 Refresh Worklist from BigQuery',
    runSelected: '▶️ Run selected actions',
    enrichSelected: '🔬 Re-enrich selected sellers',
    enrichAllPending: '🌱 Enrich all new (pending) captures',
    openInbox: '📥 Open Capture inbox',
    setup: '⚙️ Setup / repair sheet',
    setLang: '🌐 Language (EN/PL)',
    msgDone: 'Done: {n} processed, {ok} ok, {err} errors',
    msgNoSelection: 'Select rows via the ☑ checkbox first.',
    msgRefreshOk: 'Worklist refreshed: {n} rows.',
    pickLang: 'Pick interface language',
    pickLangBody: 'Type "en" or "pl" then OK.'
  };
  const pl = {
    refresh: '🔄 Odśwież Worklist z BigQuery',
    runSelected: '▶️ Wykonaj zaznaczone akcje',
    enrichSelected: '🔬 Ponów enrichment dla zaznaczonych',
    enrichAllPending: '🌱 Wzbogać wszystkie nowe (pending)',
    openInbox: '📥 Otwórz Capture inbox',
    setup: '⚙️ Konfiguracja / napraw arkusz',
    setLang: '🌐 Język (EN/PL)',
    msgDone: 'Zrobione: {n} wierszy, {ok} ok, {err} błędów',
    msgNoSelection: 'Najpierw zaznacz wiersze checkboxem ☑.',
    msgRefreshOk: 'Worklist odświeżony: {n} wierszy.',
    pickLang: 'Wybierz język interfejsu',
    pickLangBody: 'Wpisz "en" lub "pl" i OK.'
  };
  return lang === 'pl' ? pl : en;
}

function _fmt(s, v) { return s.replace(/\{(\w+)\}/g, (_, k) => v && v[k] != null ? v[k] : ''); }

function _operatorLang_() {
  const email = (Session.getActiveUser() || {}).getEmail ? Session.getActiveUser().getEmail() : '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ops = ss.getSheetByName(TAB_OPS);
  if (!ops || !email) return 'en';
  const data = ops.getDataRange().getValues();
  const headers = data[0].map(String);
  const ie = headers.indexOf('email');
  const il = headers.indexOf('lang');
  if (ie < 0 || il < 0) return 'en';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][ie]).toLowerCase() === email.toLowerCase()) {
      return (String(data[i][il]) || 'en').toLowerCase();
    }
  }
  return 'en';
}

function showLangPicker() {
  const ui = SpreadsheetApp.getUi();
  const t = _i18n(_operatorLang_());
  const resp = ui.prompt(t.pickLang, t.pickLangBody, ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const lang = String(resp.getResponseText() || '').toLowerCase();
  if (!['en', 'pl'].includes(lang)) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ops = ss.getSheetByName(TAB_OPS) || ss.insertSheet(TAB_OPS);
  if (ops.getLastRow() === 0) {
    ops.appendRow(['operator_id', 'name', 'email', 'lang']);
  }
  const email = Session.getActiveUser().getEmail();
  const data = ops.getDataRange().getValues();
  const ie = data[0].indexOf('email');
  const il = data[0].indexOf('lang');
  let updated = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][ie]).toLowerCase() === email.toLowerCase()) {
      ops.getRange(i + 1, il + 1).setValue(lang);
      updated = true;
      break;
    }
  }
  if (!updated) ops.appendRow(['op_' + Date.now(), '', email, lang]);
}

function _ensureTabs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const tab of [TAB_WORKLIST, TAB_INBOX, 'agency_blacklist', TAB_OPS, TAB_CONFIG]) {
    if (!ss.getSheetByName(tab)) ss.insertSheet(tab);
  }
  const wl = ss.getSheetByName(TAB_WORKLIST);
  if (wl.getLastRow() === 0) {
    wl.appendRow(WORKLIST_HEADERS);
    wl.setFrozenRows(1);
  }
}

function setupWorklistSheet() {
  _ensureTabs_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wl = ss.getSheetByName(TAB_WORKLIST);
  const actionCol = WORKLIST_HEADERS.indexOf('action') + 1;
  const dv = SpreadsheetApp.newDataValidation().requireValueInList(ACTION_OPTIONS, true).build();
  wl.getRange(2, actionCol, Math.max(1, wl.getMaxRows() - 1), 1).setDataValidation(dv);
  const checkCol = WORKLIST_HEADERS.indexOf('☑') + 1;
  const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  wl.getRange(2, checkCol, Math.max(1, wl.getMaxRows() - 1), 1).setDataValidation(cbRule);

  const ops = ss.getSheetByName(TAB_OPS);
  if (ops.getLastRow() === 0) {
    ops.appendRow(['operator_id', 'name', 'email', 'lang']);
  }
  const cfg = ss.getSheetByName(TAB_CONFIG);
  if (cfg.getLastRow() === 0) {
    cfg.appendRow(['key', 'value']);
    cfg.appendRow(['worklist_filter_status', 'enriched_ok,enriched_low_confidence']);
    cfg.appendRow(['worklist_limit', '2000']);
    cfg.appendRow(['worklist_exclude_agency', 'TRUE']);
    cfg.appendRow(['worklist_exclude_customers', 'TRUE']);
  }
  SpreadsheetApp.getActive().toast('Setup OK');
}

function _config(key, dflt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName(TAB_CONFIG);
  if (!cfg) return dflt;
  const data = cfg.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) return String(data[i][1]);
  }
  return dflt;
}

function refreshWorklist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wl = ss.getSheetByName(TAB_WORKLIST);
  const projectId = PropertiesService.getScriptProperties().getProperty('BQ_PROJECT_ID');
  const dataset = PropertiesService.getScriptProperties().getProperty('BQ_DATASET');
  if (!projectId || !dataset) {
    SpreadsheetApp.getUi().alert('Script Properties BQ_PROJECT_ID / BQ_DATASET not set');
    return;
  }
  const statuses = (_config('worklist_filter_status', 'enriched_ok,enriched_low_confidence') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const limit = parseInt(_config('worklist_limit', '2000'), 10);
  const excludeAgency = _config('worklist_exclude_agency', 'TRUE').toUpperCase() === 'TRUE';
  const excludeCustomers = _config('worklist_exclude_customers', 'TRUE').toUpperCase() === 'TRUE';

  const where = [];
  if (statuses.length) {
    where.push('status IN UNNEST(@statuses)');
  }
  if (excludeAgency) where.push("(agency_flag IS NULL OR agency_flag = '')");
  if (excludeCustomers) where.push("status != 'is_customer'");

  const sql = `
    SELECT seller_id, marketplace, country, company_name,
           decision_maker_name, decision_maker_role,
           email, phone, website,
           agency_flag, confidence_overall, status,
           last_action_at,
           cluster_id, cluster_anchor
    FROM \`${projectId}.${dataset}.sellers_enriched\`
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      cluster_id NULLS LAST,
      cluster_anchor NULLS LAST,
      confidence_overall DESC NULLS LAST,
      last_captured_at DESC
    LIMIT @lim
  `;
  const job = BigQuery.Jobs.query({
    query: sql,
    useLegacySql: false,
    queryParameters: [
      { name: 'lim', parameterType: { type: 'INT64' }, parameterValue: { value: String(limit) } },
      { name: 'statuses', parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } },
        parameterValue: { arrayValues: statuses.map(s => ({ value: s })) } }
    ]
  }, projectId);

  const fields = (job.schema && job.schema.fields || []).map(f => f.name);
  const rows = job.rows || [];

  const out = [WORKLIST_HEADERS];
  for (const r of rows) {
    const cells = {};
    r.f.forEach((cell, i) => cells[fields[i]] = cell.v);
    out.push([
      false,
      cells.cluster_id || '',
      cells.cluster_anchor || '',
      cells.seller_id || '',
      cells.marketplace || '',
      cells.country || '',
      cells.company_name || '',
      cells.decision_maker_name || '',
      cells.decision_maker_role || '',
      cells.email || '',
      cells.phone || '',
      cells.website || '',
      cells.agency_flag || '',
      cells.confidence_overall || 0,
      cells.status || '',
      '', cells.last_action_at || '', '',
      '', '', ''
    ]);
  }
  wl.clear();
  wl.getRange(1, 1, out.length, WORKLIST_HEADERS.length).setValues(out);
  wl.setFrozenRows(1);
  setupWorklistSheet();
  _applyClusterColors_(wl, out);
  const t = _i18n(_operatorLang_());
  SpreadsheetApp.getActive().toast(_fmt(t.msgRefreshOk, { n: rows.length }));
}

// Pastel-ish palette — distinct enough on white background, soft enough not
// to fight foreground text. Cycles via modulo for clusters #11+.
const CLUSTER_PALETTE = [
  '#fde2e2', '#fff4d6', '#e0f3df', '#d6e9ff', '#ead4f0',
  '#ffe5cc', '#d5f0ee', '#f9d6e6', '#e8e8d6', '#dde6e8'
];

function _applyClusterColors_(wl, out) {
  // out[0] is header row, out[1..n] are data. We group by cluster_id when
  // present, falling back to cluster_anchor — older captures (pre-cluster_id
  // backfill) carry only the anchor, but rows sharing the same anchor still
  // belong to the same group visually.
  if (!out || out.length < 2) return;
  const dataRows = out.length - 1;
  const cidCol = WORKLIST_HEADERS.indexOf('cluster_id');
  const cacCol = WORKLIST_HEADERS.indexOf('cluster_anchor');
  if (cidCol < 0 && cacCol < 0) return;

  function keyFor(row) {
    const id = cidCol >= 0 ? String(row[cidCol] || '').trim() : '';
    if (id) return 'id:' + id;
    const anc = cacCol >= 0 ? String(row[cacCol] || '').trim() : '';
    return anc ? 'a:' + anc : '';
  }

  // Assign each unique cluster key the next palette color in order encountered.
  const colorByKey = {};
  let nextIdx = 0;
  for (let r = 1; r < out.length; r++) {
    const k = keyFor(out[r]);
    if (k && !(k in colorByKey)) {
      colorByKey[k] = CLUSTER_PALETTE[nextIdx % CLUSTER_PALETTE.length];
      nextIdx++;
    }
  }
  if (nextIdx === 0) return;

  const ncols = WORKLIST_HEADERS.length;
  const bgs = new Array(dataRows);
  for (let r = 0; r < dataRows; r++) {
    const color = colorByKey[keyFor(out[r + 1])] || null;
    const row = new Array(ncols);
    for (let c = 0; c < ncols; c++) row[c] = color;
    bgs[r] = row;
  }
  wl.getRange(2, 1, dataRows, ncols).setBackgrounds(bgs);
}

function _getSelectedRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wl = ss.getSheetByName(TAB_WORKLIST);
  const last = wl.getLastRow();
  if (last < 2) return [];
  const data = wl.getRange(2, 1, last - 1, WORKLIST_HEADERS.length).getValues();
  const out = [];
  data.forEach((row, i) => {
    if (row[0] === true) {
      const rec = {};
      WORKLIST_HEADERS.forEach((h, j) => rec[h] = row[j]);
      rec._row = i + 2;
      out.push(rec);
    }
  });
  return out;
}

function openInbox() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TAB_INBOX);
  if (sh) ss.setActiveSheet(sh);
}
