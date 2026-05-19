/**
 * Capture endpoint — receives JSON from the Chrome extension, writes to:
 *   - Sheet "Capture inbox" (live operator QA)
 *   - BigQuery sellers_raw (append) + sellers_enriched (upsert)
 *
 * Web App deployment: Execute as = me, Access = Anyone with the link.
 * Required Script Properties:
 *   CAPTURE_SHEET_ID        - Spreadsheet ID
 *   CAPTURE_SHARED_SECRET   - HMAC-SHA256 hex string (openssl rand -hex 32)
 *   BQ_PROJECT_ID
 *   BQ_DATASET              - e.g. luko_sellers
 *   AGENCY_BLACKLIST_SHEET  - tab name (default: agency_blacklist)
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

    // Slug-aware dedupe: if this (seller_id, cluster_anchor) combo was already
    // captured, skip the writes and tell the extension to suppress its toast.
    // Without an anchor we fall through to per-seller_id behaviour (existing).
    if (projectId && dataset && payload.cluster_anchor) {
      const slugDup = _bqCheckClusterDupe(projectId, dataset, payload.seller_id, payload.cluster_anchor);
      if (slugDup && slugDup.exists) {
        return _json({
          ok: true,
          deduped: true,
          reason: 'already_captured_in_cluster',
          cluster_anchor: payload.cluster_anchor,
          previous_captured_at: slugDup.captured_at
        });
      }
    }

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
 * HMAC-SHA256 with EXPLICIT UTF-8. The 2-arg overload of computeHmacSha256Signature
 * claims UTF-8 in docs but empirically produces different output than web crypto
 * for non-ASCII chars (German ß, umlauts).
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

/**
 * Map structured `parsed` from content.js + top-level payload fields into the
 * 30-column flat record we persist to Sheet + BigQuery.
 *
 * Country is NEVER inferred from marketplace — only what the page actually says.
 * If the page lists "CN" or "GB", that's what we store. Lying with a default would
 * poison downstream segmentation (DE/PL skip vs foreign outreach).
 */
function _flattenParsed(p) {
  const x = p.parsed || {};
  return {
    seller_id: p.seller_id,
    marketplace: p.marketplace,
    url: p.url,
    asin: x.asin || '',
    seller_name: x.seller_name || '',
    brand: x.brand || '',
    captured_at: p.captured_at,
    operator_id: p.operator_id || '',

    business_name: x.business_name || '',
    business_type: x.business_type || '',
    representative_name: x.representative_name || '',

    street: x.street || '',
    address_line_2: x.address_line_2 || '',
    region: x.region || '',
    postal_code: x.postal_code || '',
    city: x.city || '',
    country: x.country || '',

    cs_street: x.cs_street || '',
    cs_postal_code: x.cs_postal_code || '',
    cs_city: x.cs_city || '',
    cs_region: x.cs_region || '',
    cs_country: x.cs_country || '',
    cs_differs: x.cs_differs === true ? 'TRUE' : (x.cs_differs === false ? 'FALSE' : ''),

    phone: x.phone || '',
    phone_alt: x.phone_alt || '',
    email: x.email || '',
    email_alt: x.email_alt || '',

    vat_number: x.vat_number || '',
    weee_number: x.weee_number || '',
    epr_id: x.epr_id || '',
    trade_register_number: x.trade_register_number || '',
    other_id: x.other_id || '',

    gpsr_raw: p.gpsr_raw || '',
    screenshot_drive_id: p.screenshot && p.screenshot.drive_id || '',
    screenshot_link: p.screenshot && p.screenshot.link || '',
    raw_text: p.raw_text || '',

    // Cluster context (sent by extension when Alt+G mode is active or URL has
    // #luko_slug=X fragment). Empty for ad-hoc captures.
    cluster_id: p.cluster_id || '',
    cluster_anchor: p.cluster_anchor || ''
  };
}

// Order matters — this drives the Sheet column layout.
// `seller_name` = Amazon storefront display name (h1#seller-name).
// `brand` = actual product brand (Amazon "Marke" field on product page — empty until
//           we add product-page capture).
const INBOX_HEADERS = [
  'captured_at', 'operator_id', 'seller_id', 'marketplace', 'asin', 'seller_name', 'brand',
  'business_name', 'business_type', 'representative_name',
  'street', 'address_line_2', 'postal_code', 'city', 'region', 'country',
  'cs_street', 'cs_postal_code', 'cs_city', 'cs_country', 'cs_differs',
  'phone', 'phone_alt', 'email', 'email_alt',
  'vat_number', 'weee_number', 'epr_id', 'trade_register_number', 'other_id',
  'agency_flag', 'confidence_capture', 'screenshot_link', 'url'
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
    sh.getRange(1, 1, 1, INBOX_HEADERS.length).setValues([INBOX_HEADERS])
      .setFontWeight('bold').setBackground('#f3f3f3');
    sh.setFrozenRows(1);
  } else {
    // Idempotent header repair — if extra columns were added in code, append them
    const firstRow = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    if (firstRow[0] !== 'captured_at' || firstRow.length < INBOX_HEADERS.length) {
      // Wipe and rewrite headers
      sh.getRange(1, 1, 1, Math.max(firstRow.length, INBOX_HEADERS.length)).clearContent();
      sh.getRange(1, 1, 1, INBOX_HEADERS.length).setValues([INBOX_HEADERS])
        .setFontWeight('bold').setBackground('#f3f3f3');
      sh.setFrozenRows(1);
    }
  }
  const row = INBOX_HEADERS.map(h => _sanitizeForSheet(flat[h]));
  sh.appendRow(row);
  return sh.getLastRow();
}

/**
 * One-off helper: delete pre-v2 capture rows (which were saved under the 15-column
 * schema and now appear with shifted data under the 33-column schema). Run AFTER
 * re-capturing those sellers (the new captures overwrite BQ data via MERGE on
 * seller_id — only the Sheet history shows stale rows).
 *
 * Usage: in Apps Script dropdown, select cleanOldInboxRows -> Run.
 */
function cleanOldInboxRows() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('CAPTURE_SHEET_ID');
  if (!sheetId) throw new Error('CAPTURE_SHEET_ID not set');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(CAPTURE_TAB);
  if (!sh) { Logger.log('No Capture inbox tab'); return; }
  const data = sh.getDataRange().getValues();
  if (data.length < 2) { Logger.log('Empty inbox'); return; }
  // A row is "old format" if column 5 (asin column, 0-indexed 4) contains something
  // that doesn't look like an ASIN (B0XXXXXXXX or 10-char alphanumeric).
  const asinRe = /^[A-Z0-9]{10}$/;
  const toDelete = [];
  for (let i = 1; i < data.length; i++) {
    const asinCell = String(data[i][4] || '').trim();
    // Old rows have business_name in column 5 (e.g. "Gusti Leder GmbH"), or empty
    if (asinCell && !asinRe.test(asinCell)) toDelete.push(i + 1);
    // Also delete fully-blank rows (e.g. from earlier appendRow with empty headers)
    const allBlank = data[i].every(c => c === '' || c == null);
    if (allBlank) toDelete.push(i + 1);
  }
  // Delete from bottom to preserve indices
  toDelete.sort((a, b) => b - a).forEach(rowNum => sh.deleteRow(rowNum));
  Logger.log('Deleted ' + toDelete.length + ' old/blank rows.');
}
function repairInboxHeaders() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('CAPTURE_SHEET_ID');
  if (!sheetId) throw new Error('CAPTURE_SHEET_ID not set in Script Properties');
  const ss = SpreadsheetApp.openById(sheetId);
  let sh = ss.getSheetByName(CAPTURE_TAB);
  if (!sh) {
    sh = ss.insertSheet(CAPTURE_TAB);
  }
  const firstCell = sh.getLastColumn() ? sh.getRange(1, 1).getValue() : '';
  if (firstCell !== 'captured_at') {
    if (sh.getLastRow() > 0) sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, INBOX_HEADERS.length).setValues([INBOX_HEADERS])
      .setFontWeight('bold').setBackground('#f3f3f3');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, INBOX_HEADERS.length);
    Logger.log('Headers injected into "Capture inbox" (' + INBOX_HEADERS.length + ' cols).');
  } else {
    // Maybe schema grew — rewrite full header row
    sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), INBOX_HEADERS.length)).clearContent();
    sh.getRange(1, 1, 1, INBOX_HEADERS.length).setValues([INBOX_HEADERS])
      .setFontWeight('bold').setBackground('#f3f3f3');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, INBOX_HEADERS.length);
    Logger.log('Headers refreshed (' + INBOX_HEADERS.length + ' cols).');
  }
}

function _countFilled(flat) {
  const keys = ['business_name', 'street', 'city', 'postal_code', 'country',
                'phone', 'email', 'vat_number', 'trade_register_number',
                'weee_number', 'representative_name'];
  const filled = keys.filter(k => flat[k] && String(flat[k]).trim()).length;
  return { filled: filled, total: keys.length };
}

function _missingFields(flat) {
  const required = ['business_name', 'street', 'city', 'country'];
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
  const haystack = ((payload.gpsr_raw || '') + ' ' + (payload.raw_text || '') +
                    ' ' + (payload.legal_block_raw || '') + ' ' + (payload.bv_block_raw || '')).toLowerCase();
  const parsed = payload.parsed || {};
  const parsedEmail = String(parsed.email || '').toLowerCase();
  const parsedEmailAlt = String(parsed.email_alt || '').toLowerCase();
  const parsedPhone = String(parsed.phone || '').replace(/\s+/g, '');
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = colName >= 0 ? String(r[colName] || '').trim() : '';
    const domain = colDomain >= 0 ? String(r[colDomain] || '').toLowerCase().trim() : '';
    const email = colEmail >= 0 ? String(r[colEmail] || '').toLowerCase().trim() : '';
    const phone = colPhone >= 0 ? String(r[colPhone] || '').replace(/\s+/g, '') : '';
    if (name && haystack.includes(name.toLowerCase())) return { name: name, source: 'gpsr_raw' };
    if (domain && (haystack.includes(domain) ||
                   parsedEmail.endsWith('@' + domain) ||
                   parsedEmailAlt.endsWith('@' + domain))) {
      return { name: name || domain, source: 'domain' };
    }
    if (email && (parsedEmail === email || parsedEmailAlt === email)) return { name: name || email, source: 'email' };
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

// Returns { exists: bool, captured_at?: string } for a (seller_id, cluster_anchor)
// pair. Hits sellers_raw because that's append-only — sellers_enriched only
// keeps the last cluster_anchor seen, so we'd miss prior captures under
// different clusters there.
function _bqCheckClusterDupe(projectId, dataset, sellerId, clusterAnchor) {
  if (!sellerId || !clusterAnchor) return { exists: false };
  const sql = `
    SELECT MAX(captured_at) AS captured_at
    FROM \`${projectId}.${dataset}.${RAW_TABLE}\`
    WHERE seller_id = @sid AND cluster_anchor = @anchor
  `;
  const job = BigQuery.Jobs.query({
    query: sql,
    useLegacySql: false,
    queryParameters: [
      { name: 'sid', parameterType: { type: 'STRING' }, parameterValue: { value: sellerId } },
      { name: 'anchor', parameterType: { type: 'STRING' }, parameterValue: { value: clusterAnchor } }
    ]
  }, projectId);
  const rows = job.rows || [];
  if (!rows.length) return { exists: false };
  const ts = rows[0].f && rows[0].f[0] && rows[0].f[0].v;
  return ts ? { exists: true, captured_at: ts } : { exists: false };
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
        url: flat.url,
        cluster_id: flat.cluster_id || null,
        cluster_anchor: flat.cluster_anchor || null
      }
    }]
  }, projectId, dataset, RAW_TABLE);
}

function _bqUpsertEnriched(projectId, dataset, flat, existing) {
  // MERGE only updates fields that are NON-EMPTY in the capture. We never blank
  // an enriched value with a fresh empty capture (would lose enrichment work).
  const merge = `
    MERGE \`${projectId}.${dataset}.${ENRICHED_TABLE}\` T
    USING (SELECT @sid AS seller_id) S
    ON T.seller_id = S.seller_id
    WHEN MATCHED THEN UPDATE SET
      marketplace          = COALESCE(NULLIF(@marketplace,''),          T.marketplace),
      asin_example         = COALESCE(NULLIF(@asin,''),                 T.asin_example),
      seller_name          = COALESCE(NULLIF(@seller_name,''),          T.seller_name),
      brand                = COALESCE(NULLIF(@brand,''),                T.brand),
      business_name        = COALESCE(NULLIF(@business_name,''),        T.business_name),
      business_type        = COALESCE(NULLIF(@business_type,''),        T.business_type),
      representative_name  = COALESCE(NULLIF(@representative_name,''),  T.representative_name),
      street               = COALESCE(NULLIF(@street,''),               T.street),
      address_line_2       = COALESCE(NULLIF(@address_line_2,''),       T.address_line_2),
      region               = COALESCE(NULLIF(@region,''),               T.region),
      postal_code          = COALESCE(NULLIF(@postal_code,''),          T.postal_code),
      city                 = COALESCE(NULLIF(@city,''),                 T.city),
      country              = COALESCE(NULLIF(@country,''),              T.country),
      business_address     = COALESCE(NULLIF(@business_address,''),     T.business_address),
      cs_street            = COALESCE(NULLIF(@cs_street,''),            T.cs_street),
      cs_postal_code       = COALESCE(NULLIF(@cs_postal_code,''),       T.cs_postal_code),
      cs_city              = COALESCE(NULLIF(@cs_city,''),              T.cs_city),
      cs_region            = COALESCE(NULLIF(@cs_region,''),            T.cs_region),
      cs_country           = COALESCE(NULLIF(@cs_country,''),           T.cs_country),
      cs_differs           = COALESCE(@cs_differs,                       T.cs_differs),
      phone_raw            = COALESCE(NULLIF(@phone,''),                T.phone_raw),
      phone_alt            = COALESCE(NULLIF(@phone_alt,''),            T.phone_alt),
      email_raw            = COALESCE(NULLIF(@email,''),                T.email_raw),
      email_alt            = COALESCE(NULLIF(@email_alt,''),            T.email_alt),
      vat_number           = COALESCE(NULLIF(@vat,''),                  T.vat_number),
      weee_number          = COALESCE(NULLIF(@weee,''),                 T.weee_number),
      epr_id               = COALESCE(NULLIF(@epr,''),                  T.epr_id),
      registry_id          = COALESCE(NULLIF(@registry,''),             T.registry_id),
      other_id             = COALESCE(NULLIF(@other_id,''),             T.other_id),
      agency_flag          = NULLIF(@agency,''),
      cluster_id           = COALESCE(NULLIF(@cluster_id,''),       T.cluster_id),
      cluster_anchor       = COALESCE(NULLIF(@cluster_anchor,''),   T.cluster_anchor),
      last_captured_at     = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      seller_id, marketplace, asin_example, seller_name, brand,
      business_name, business_type, representative_name,
      street, address_line_2, region, postal_code, city, country, business_address,
      cs_street, cs_postal_code, cs_city, cs_region, cs_country, cs_differs,
      phone_raw, phone_alt, email_raw, email_alt,
      vat_number, weee_number, epr_id, registry_id, other_id,
      agency_flag, cluster_id, cluster_anchor, status, last_captured_at
    ) VALUES (
      @sid, @marketplace, @asin, @seller_name, @brand,
      @business_name, @business_type, @representative_name,
      @street, @address_line_2, @region, @postal_code, @city, @country, @business_address,
      @cs_street, @cs_postal_code, @cs_city, @cs_region, @cs_country, @cs_differs,
      @phone, @phone_alt, @email, @email_alt,
      @vat, @weee, @epr, @registry, @other_id,
      NULLIF(@agency,''), NULLIF(@cluster_id,''), NULLIF(@cluster_anchor,''),
      'captured_pending_enrich', CURRENT_TIMESTAMP()
    )
  `;
  const businessAddressBlob = [flat.street, flat.address_line_2, flat.postal_code + ' ' + flat.city, flat.region, flat.country]
    .filter(s => s && String(s).trim()).join(', ');
  const params = [
    { name: 'sid', type: 'STRING', value: flat.seller_id },
    { name: 'marketplace', type: 'STRING', value: flat.marketplace },
    { name: 'asin', type: 'STRING', value: flat.asin },
    { name: 'seller_name', type: 'STRING', value: flat.seller_name },
    { name: 'brand', type: 'STRING', value: flat.brand },
    { name: 'business_name', type: 'STRING', value: flat.business_name },
    { name: 'business_type', type: 'STRING', value: flat.business_type },
    { name: 'representative_name', type: 'STRING', value: flat.representative_name },
    { name: 'street', type: 'STRING', value: flat.street },
    { name: 'address_line_2', type: 'STRING', value: flat.address_line_2 },
    { name: 'region', type: 'STRING', value: flat.region },
    { name: 'postal_code', type: 'STRING', value: flat.postal_code },
    { name: 'city', type: 'STRING', value: flat.city },
    { name: 'country', type: 'STRING', value: flat.country },
    { name: 'business_address', type: 'STRING', value: businessAddressBlob },
    { name: 'cs_street', type: 'STRING', value: flat.cs_street },
    { name: 'cs_postal_code', type: 'STRING', value: flat.cs_postal_code },
    { name: 'cs_city', type: 'STRING', value: flat.cs_city },
    { name: 'cs_region', type: 'STRING', value: flat.cs_region },
    { name: 'cs_country', type: 'STRING', value: flat.cs_country },
    { name: 'cs_differs', type: 'BOOL', value: flat.cs_differs === 'TRUE' ? 'true' : (flat.cs_differs === 'FALSE' ? 'false' : null) },
    { name: 'phone', type: 'STRING', value: flat.phone },
    { name: 'phone_alt', type: 'STRING', value: flat.phone_alt },
    { name: 'email', type: 'STRING', value: flat.email },
    { name: 'email_alt', type: 'STRING', value: flat.email_alt },
    { name: 'vat', type: 'STRING', value: flat.vat_number },
    { name: 'weee', type: 'STRING', value: flat.weee_number },
    { name: 'epr', type: 'STRING', value: flat.epr_id },
    { name: 'registry', type: 'STRING', value: flat.trade_register_number },
    { name: 'other_id', type: 'STRING', value: flat.other_id },
    { name: 'agency', type: 'STRING', value: flat.agency_flag },
    { name: 'cluster_id', type: 'STRING', value: flat.cluster_id },
    { name: 'cluster_anchor', type: 'STRING', value: flat.cluster_anchor }
  ];
  const queryRequest = {
    query: merge,
    useLegacySql: false,
    queryParameters: params.map(p => ({
      name: p.name,
      parameterType: { type: p.type },
      parameterValue: p.value == null ? { value: null } : { value: String(p.value) }
    }))
  };
  // BigQuery serialises DML per row, so two captures of the same seller back-to-back
  // (or capture racing with the Cloud Run enrichment worker's write-back) collide
  // with "Could not serialize access to table ... due to concurrent update". That
  // error is transient and retry-safe — the MERGE is idempotent (only fills
  // non-empty fields, never blanks). Try up to 4 times with exponential backoff.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      BigQuery.Jobs.query(queryRequest, projectId);
      return;
    } catch (e) {
      lastErr = e;
      const msg = String((e && e.message) || e || '');
      if (msg.indexOf('serialize') < 0 && msg.indexOf('concurrent update') < 0) {
        throw e;
      }
      Utilities.sleep(500 * Math.pow(2, attempt));  // 0.5s, 1s, 2s, 4s
    }
  }
  throw lastErr;
}
