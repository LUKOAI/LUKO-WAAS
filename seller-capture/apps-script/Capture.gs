/**
 * Capture endpoint — receives JSON from the Chrome extension, writes to:
 *   - Sheet "Capture inbox" (live operator QA)
 *   - BigQuery sellers_raw (append) + sellers_enriched (upsert)
 *
 * Web App deployment: Execute as = me, Access = Anyone with the link.
 * Required Script Properties:
 *   CAPTURE_SHEET_ID        - Spreadsheet ID with tab "agency_blacklist"
 *   CAPTURE_SHARED_SECRET   - HMAC-SHA256 hex string (openssl rand -hex 32)
 *   BQ_PROJECT_ID
 *   BQ_DATASET              - e.g. luko_sellers
 *   AGENCY_BLACKLIST_SHEET  - tab name in CAPTURE_SHEET_ID with blacklist (default: agency_blacklist)
 */

const CAPTURE_TAB = 'Capture inbox';
const ENRICHED_TABLE = 'sellers_enriched';
const RAW_TABLE = 'sellers_raw';

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) {
    return _json({ ok: true, pong: true, time: new Date().toISOString() });
  }
  return _json({ ok: true, service: 'luko-seller-capture' });
}

function doPost(e) {
  try {
    const auth = _verifySignature_(e);
    if (!auth.ok) return _json({ ok: false, error: 'unauthorized: ' + auth.reason });
    const payload = JSON.parse(e.postData.contents);
    if (!payload.seller_id) return _json({ ok: false, error: 'seller_id missing' });

    const props = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('CAPTURE_SHEET_ID');
    const projectId = props.getProperty('BQ_PROJECT_ID');
    const dataset = props.getProperty('BQ_DATASET');
    if (!sheetId) return _json({ ok: false, error: 'CAPTURE_SHEET_ID not configured' });

    const ss = SpreadsheetApp.openById(sheetId);
    const dupCheck = projectId && dataset ? _bqLookupExisting(projectId, dataset, payload.seller_id) : null;

    const agency = _detectAgency(ss, payload);
    const flat = _flattenParsed(payload);
    flat.agency_flag = agency ? agency.name : '';
    flat.confidence_capture = _confidenceForCapture(flat);

    const row = _appendToInbox(ss, flat);
    const fieldCount = _countFilled(flat);

    if (projectId && dataset) {
      _bqInsertRaw(projectId, dataset, payload, flat);
      _bqUpsertEnriched(projectId, dataset, flat, dupCheck);
    }

    const missing = _missingFields(flat);
    return _json({
      ok: true,
      row: row,
      filled: fieldCount.filled,
      total: fieldCount.total,
      missing: missing,
      is_duplicate: !!dupCheck,
      status: dupCheck ? dupCheck.status : 'captured_pending_enrich',
      last_seen: dupCheck ? dupCheck.last_enriched_at : null,
      agency_flag: agency ? agency.name : null,
      drive_screenshot: payload.screenshot && payload.screenshot.link || null
    });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err), stack: err && err.stack });
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * HMAC-SHA256 signature check. Extension sends ts + sig as URL query params:
 *   sig = hex(HMAC_SHA256(ts + "." + body, secret))
 * Timestamp must be within ±5 minutes to prevent replay.
 *
 * IMPORTANT: must use 3-arg variant with explicit UTF-8 charset. The 2-arg
 * overload `computeHmacSha256Signature(value, key)` claims UTF-8 in docs but
 * empirically produces different output than web crypto for non-ASCII chars
 * (German ß, umlauts, Polish diacritics) that appear in seller addresses.
 */
function _verifySignature_(e) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('CAPTURE_SHARED_SECRET') || '';
  const allowUnsigned = (props.getProperty('CAPTURE_ALLOW_UNSIGNED') || '').toLowerCase() === 'true';
  if (!secret) return { ok: allowUnsigned, reason: 'no_secret_set' };

  const ts = (e && e.parameter && e.parameter.ts) || '';
  const sig = (e && e.parameter && e.parameter.sig) || '';
  if (!ts || !sig) return { ok: false, reason: 'missing_signature_headers' };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(ts, 10)) > 300) return { ok: false, reason: 'timestamp_skew' };

  const body = (e && e.postData && e.postData.contents) || '';
  const expectedBytes = Utilities.computeHmacSha256Signature(
    ts + '.' + body, secret, Utilities.Charset.UTF_8
  );
  const expected = expectedBytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

  if (expected.length !== sig.length) return { ok: false, reason: 'bad_signature' };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

function _flattenParsed(p) {
  const x = p.parsed || {};
  return {
    seller_id: p.seller_id,
    marketplace: p.marketplace,
    url: p.url,
    captured_at: p.captured_at,
    operator_id: p.operator_id || '',
    business_name: x.business_name || '',
    business_address: x.business_address || '',
    customer_service_address: x.customer_service_address || '',
    phone: x.phone || '',
    email: x.email || '',
    trade_register_number: x.trade_register_number || '',
    vat_number: x.vat_number || '',
    business_type: x.business_type || '',
    country: x.country || _inferCountryFromMarketplace(p.marketplace),
    gpsr_raw: p.gpsr_raw || '',
    screenshot_drive_id: p.screenshot && p.screenshot.drive_id || '',
    screenshot_link: p.screenshot && p.screenshot.link || '',
    raw_text: p.raw_text || ''
  };
}

function _inferCountryFromMarketplace(mp) {
  if (!mp) return '';
  const map = {
    'amazon.com': 'US', 'amazon.de': 'DE', 'amazon.co.uk': 'UK',
    'amazon.fr': 'FR', 'amazon.it': 'IT', 'amazon.es': 'ES',
    'amazon.pl': 'PL', 'amazon.nl': 'NL', 'amazon.se': 'SE',
    'amazon.com.be': 'BE'
  };
  return map[String(mp).toLowerCase()] || '';
}

const INBOX_HEADERS = [
  'captured_at', 'operator_id', 'seller_id', 'marketplace', 'business_name',
  'country', 'business_address', 'phone', 'email', 'vat_number',
  'trade_register_number', 'agency_flag', 'confidence_capture', 'screenshot_link', 'url'
];

/**
 * Prepend single-quote to values starting with formula triggers (`+`, `=`, `@`, `-`)
 * so Sheets stores them as text. Without this, phone numbers like "+49 ..." get
 * interpreted as broken formulas → #ERROR! display.
 */
function _sanitizeForSheet(v) {
  if (v == null) return '';
  const s = String(v);
  if (/^[=+@\-]/.test(s)) return "'" + s;
  return s;
}

function _appendToInbox(ss, flat) {
  let sh = ss.getSheetByName(CAPTURE_TAB);
  if (!sh) {
    sh = ss.insertSheet(CAPTURE_TAB);
    sh.appendRow(INBOX_HEADERS);
    sh.setFrozenRows(1);
  }
  const row = INBOX_HEADERS.map(h => _sanitizeForSheet(flat[h]));
  sh.appendRow(row);
  return sh.getLastRow();
}

/**
 * One-off helper: if Capture inbox tab was created without headers (or headers
 * got deleted), inject them as row 1. Safe to re-run: detects existing header
 * by checking if cell A1 equals 'captured_at'.
 *
 * Run from Apps Script editor: dropdown "doGet" -> "repairInboxHeaders" -> Run.
 */
function repairInboxHeaders() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('CAPTURE_SHEET_ID');
  if (!sheetId) throw new Error('CAPTURE_SHEET_ID not set in Script Properties');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(CAPTURE_TAB);
  if (!sh) {
    Logger.log('No "Capture inbox" tab found — will be created on next capture.');
    return;
  }
  const firstCell = sh.getRange(1, 1).getValue();
  if (firstCell === 'captured_at') {
    Logger.log('Headers already present.');
    return;
  }
  sh.insertRowBefore(1);
  sh.getRange(1, 1, 1, INBOX_HEADERS.length).setValues([INBOX_HEADERS])
    .setFontWeight('bold').setBackground('#f3f3f3');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, INBOX_HEADERS.length);
  Logger.log('Headers injected into "Capture inbox".');
}

function _countFilled(flat) {
  const keys = ['business_name', 'business_address', 'phone', 'email', 'vat_number', 'trade_register_number', 'country', 'customer_service_address'];
  const filled = keys.filter(k => flat[k] && String(flat[k]).trim()).length;
  return { filled: filled, total: keys.length };
}

function _missingFields(flat) {
  const required = ['business_name', 'business_address'];
  return required.filter(k => !flat[k]);
}

function _confidenceForCapture(flat) {
  const c = _countFilled(flat);
  return Math.round((c.filled / c.total) * 60);
}

function _detectAgency(ss, payload) {
  const tabName = PropertiesService.getScriptProperties().getProperty('AGENCY_BLACKLIST_SHEET') || 'agency_blacklist';
  const sh = ss.getSheetByName(tabName);
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0].map(h => String(h).toLowerCase());
  const colName = headers.indexOf('name');
  const colDomain = headers.indexOf('domain');
  const colEmail = headers.indexOf('email');
  const colPhone = headers.indexOf('phone');
  const haystack = ((payload.gpsr_raw || '') + ' ' + (payload.raw_text || '')).toLowerCase();
  const parsedEmail = (payload.parsed && payload.parsed.email || '').toLowerCase();
  const parsedPhone = (payload.parsed && payload.parsed.phone || '').replace(/\s+/g, '');
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = colName >= 0 ? String(r[colName] || '').trim() : '';
    const domain = colDomain >= 0 ? String(r[colDomain] || '').toLowerCase().trim() : '';
    const email = colEmail >= 0 ? String(r[colEmail] || '').toLowerCase().trim() : '';
    const phone = colPhone >= 0 ? String(r[colPhone] || '').replace(/\s+/g, '') : '';
    if (name && haystack.includes(name.toLowerCase())) return { name: name, source: 'gpsr_raw' };
    if (domain && (haystack.includes(domain) || parsedEmail.endsWith('@' + domain))) return { name: name || domain, source: 'domain' };
    if (email && parsedEmail === email) return { name: name || email, source: 'email' };
    if (phone && parsedPhone && parsedPhone.endsWith(phone.slice(-9))) return { name: name || phone, source: 'phone' };
  }
  return null;
}

function _bqLookupExisting(projectId, dataset, sellerId) {
  const sql = `SELECT seller_id, status, last_enriched_at FROM \`${projectId}.${dataset}.${ENRICHED_TABLE}\` WHERE seller_id = @sid LIMIT 1`;
  const job = BigQuery.Jobs.query({
    query: sql,
    useLegacySql: false,
    queryParameters: [{ name: 'sid', parameterType: { type: 'STRING' }, parameterValue: { value: sellerId } }]
  }, projectId);
  const rows = (job.rows || []);
  if (!rows.length) return null;
  const fields = job.schema.fields;
  const row = {};
  rows[0].f.forEach((cell, i) => row[fields[i].name] = cell.v);
  return row;
}

function _bqInsertRaw(projectId, dataset, payload, flat) {
  BigQuery.Tabledata.insertAll({
    rows: [{
      json: {
        capture_id: Utilities.getUuid(),
        seller_id: flat.seller_id,
        marketplace: flat.marketplace,
        captured_at: flat.captured_at,
        operator_id: flat.operator_id,
        parsed_json: JSON.stringify(payload.parsed || {}),
        raw_text: payload.raw_text || '',
        gpsr_raw: payload.gpsr_raw || '',
        screenshot_drive_id: flat.screenshot_drive_id || '',
        url: flat.url
      }
    }]
  }, projectId, dataset, RAW_TABLE);
}

function _bqUpsertEnriched(projectId, dataset, flat, existing) {
  const merge = `
    MERGE \`${projectId}.${dataset}.${ENRICHED_TABLE}\` T
    USING (SELECT @sid AS seller_id) S
    ON T.seller_id = S.seller_id
    WHEN MATCHED THEN UPDATE SET
      marketplace = COALESCE(NULLIF(@marketplace,''), T.marketplace),
      business_name = COALESCE(NULLIF(@business_name,''), T.business_name),
      business_address = COALESCE(NULLIF(@business_address,''), T.business_address),
      country = COALESCE(NULLIF(@country,''), T.country),
      phone_raw = COALESCE(NULLIF(@phone,''), T.phone_raw),
      email_raw = COALESCE(NULLIF(@email,''), T.email_raw),
      vat = COALESCE(NULLIF(@vat,''), T.vat),
      registry_id = COALESCE(NULLIF(@registry,''), T.registry_id),
      agency_flag = NULLIF(@agency,''),
      last_captured_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      seller_id, marketplace, business_name, business_address, country,
      phone_raw, email_raw, vat, registry_id, agency_flag, status, last_captured_at
    ) VALUES (
      @sid, @marketplace, @business_name, @business_address, @country,
      @phone, @email, @vat, @registry, NULLIF(@agency,''), 'captured_pending_enrich', CURRENT_TIMESTAMP()
    )
  `;
  const params = [
    { name: 'sid', type: 'STRING', value: flat.seller_id },
    { name: 'marketplace', type: 'STRING', value: flat.marketplace },
    { name: 'business_name', type: 'STRING', value: flat.business_name },
    { name: 'business_address', type: 'STRING', value: flat.business_address },
    { name: 'country', type: 'STRING', value: flat.country },
    { name: 'phone', type: 'STRING', value: flat.phone },
    { name: 'email', type: 'STRING', value: flat.email },
    { name: 'vat', type: 'STRING', value: flat.vat_number },
    { name: 'registry', type: 'STRING', value: flat.trade_register_number },
    { name: 'agency', type: 'STRING', value: flat.agency_flag }
  ];
  BigQuery.Jobs.query({
    query: merge,
    useLegacySql: false,
    queryParameters: params.map(p => ({
      name: p.name, parameterType: { type: p.type }, parameterValue: { value: p.value }
    }))
  }, projectId);
}
