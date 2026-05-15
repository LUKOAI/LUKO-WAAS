/**
 * Capture endpoint — receives JSON from the Chrome extension, writes to:
 *   - Sheet "Capture inbox" (live operator QA)
 *   - BigQuery sellers_raw (append) + sellers_enriched (upsert)
 *
 * Web App deployment: Execute as = me, Access = Anyone with the link.
 * Required Script Properties:
 *   CAPTURE_SHEET_ID        - Spreadsheet ID with tabs "Capture inbox" and "_config"
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
    if (!auth.ok) {
      return _json({
        ok: false,
        error: 'unauthorized: ' + auth.reason,
        debug: auth.debug || null
      });
    }
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
 * HMAC-SHA256 signature check. Extension sends:
 *   ts and sig as URL query parameters
 *   sig = hex(HMAC_SHA256(ts + "." + body, secret))
 * Timestamp must be within ±5 minutes to prevent replay.
 *
 * On bad_signature, returns full debug payload in `debug` to help diagnose mismatches
 * between client and server (secret typo, body transformation, etc.).
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
  if (Math.abs(now - parseInt(ts, 10)) > 300) {
    return {
      ok: false,
      reason: 'timestamp_skew',
      debug: { server_now: now, client_ts: parseInt(ts, 10), skew_sec: now - parseInt(ts, 10) }
    };
  }

  const body = (e && e.postData && e.postData.contents) || '';
  const expectedBytes = Utilities.computeHmacSha256Signature(ts + '.' + body, secret);
  const expected = expectedBytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

  // SHA-256 of body alone — for byte-identity check against client
  const bodyHashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body, Utilities.Charset.UTF_8);
  const bodyHash = bodyHashBytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

  let diff = 0;
  if (expected.length !== sig.length) {
    diff = 1;
  } else {
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (diff === 0) return { ok: true };

  return {
    ok: false,
    reason: 'bad_signature',
    debug: {
      secret_len: secret.length,
      secret_first6: secret.substring(0, 6),
      secret_last6: secret.substring(secret.length - 6),
      secret_is_hex: /^[0-9a-fA-F]+$/.test(secret),
      ts_received: ts,
      ts_len: ts.length,
      sig_received: sig,
      sig_len: sig.length,
      sig_expected: expected,
      sig_expected_len: expected.length,
      body_len: body.length,
      body_sha256: bodyHash,
      body_first120: body.substring(0, 120),
      body_last60: body.substring(Math.max(0, body.length - 60))
    }
  };
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
    country: x.country || '',
    gpsr_raw: p.gpsr_raw || '',
    screenshot_drive_id: p.screenshot && p.screenshot.drive_id || '',
    screenshot_link: p.screenshot && p.screenshot.link || '',
    raw_text: p.raw_text || ''
  };
}

const INBOX_HEADERS = [
  'captured_at', 'operator_id', 'seller_id', 'marketplace', 'business_name',
  'country', 'business_address', 'phone', 'email', 'vat_number',
  'trade_register_number', 'agency_flag', 'confidence_capture', 'screenshot_link', 'url'
];

function _appendToInbox(ss, flat) {
  let sh = ss.getSheetByName(CAPTURE_TAB);
  if (!sh) {
    sh = ss.insertSheet(CAPTURE_TAB);
    sh.appendRow(INBOX_HEADERS);
    sh.setFrozenRows(1);
  }
  const row = INBOX_HEADERS.map(h => flat[h] != null ? flat[h] : '');
  sh.appendRow(row);
  return sh.getLastRow();
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
      phone_raw = COALESCE(NULLIF(@phone,''), T.phone_raw),
      email_raw = COALESCE(NULLIF(@email,''), T.email_raw),
      vat = COALESCE(NULLIF(@vat,''), T.vat),
      registry_id = COALESCE(NULLIF(@registry,''), T.registry_id),
      agency_flag = NULLIF(@agency,''),
      last_captured_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      seller_id, marketplace, business_name, business_address, phone_raw, email_raw,
      vat, registry_id, agency_flag, status, last_captured_at
    ) VALUES (
      @sid, @marketplace, @business_name, @business_address, @phone, @email,
      @vat, @registry, NULLIF(@agency,''), 'captured_pending_enrich', CURRENT_TIMESTAMP()
    )
  `;
  const params = [
    { name: 'sid', type: 'STRING', value: flat.seller_id },
    { name: 'marketplace', type: 'STRING', value: flat.marketplace },
    { name: 'business_name', type: 'STRING', value: flat.business_name },
    { name: 'business_address', type: 'STRING', value: flat.business_address },
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
