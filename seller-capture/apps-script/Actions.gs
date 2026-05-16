/**
 * Actions.gs — run selected actions from Worklist:
 *   - AI call (Bland / Vapi) via external worker endpoints
 *   - Email (Gmail via Workspace, the user's domain) — templates per language
 *   - Push to Kartra funnel webhook
 *   - Push converted seller to SitePatron (LUKO_Domain_Slug_Finder)
 *   - Re-enrich on demand
 *
 * Every action writes a row into BQ.action_log via the same project/dataset
 * used by Capture.gs, so we have a single source of truth.
 */

function runSelectedActions() {
  const rows = _getSelectedRows_();
  const lang = _operatorLang_();
  const t = _i18n(lang);
  if (!rows.length) {
    SpreadsheetApp.getActive().toast(t.msgNoSelection);
    return;
  }
  let ok = 0, err = 0;
  for (const r of rows) {
    try {
      const action = String(r.action || '').trim();
      if (!action || action === 'Skip') continue;
      const result = _dispatchAction_(action, r, lang);
      _writeBack_(r._row, action, result);
      _logAction_(r.seller_id, action, result);
      ok++;
    } catch (e) {
      err++;
      _writeBack_(r._row, r.action, { result: 'error', error: String(e.message || e) });
      _logAction_(r.seller_id, r.action, { result: 'error', error: String(e.message || e) });
    }
  }
  SpreadsheetApp.getActive().toast(_fmt(t.msgDone, { n: rows.length, ok: ok, err: err }));
}

function enrichSelected() {
  const rows = _getSelectedRows_();
  const t = _i18n(_operatorLang_());
  if (!rows.length) {
    SpreadsheetApp.getActive().toast(t.msgNoSelection);
    return;
  }
  const ids = rows.map(r => r.seller_id).filter(Boolean);
  if (!ids.length) return;
  try {
    _flipToPending_(ids);
    const exec = _triggerEnrichmentJob_(Math.max(ids.length, 20));
    for (const r of rows) {
      _logAction_(r.seller_id, 'Re-enrich', { result: 'queued', execution: (exec && exec.name) || '' });
    }
    SpreadsheetApp.getActive().toast(`Enrichment kicked off for ${ids.length} sellers. Results in ~1-5 min.`);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Enrichment trigger failed: ' + (e.message || e));
  }
}

function _dispatchAction_(action, row, lang) {
  if (action === 'AI call (Bland)') return _aiCall_('bland', row, lang);
  if (action === 'AI call (Vapi)') return _aiCall_('vapi', row, lang);
  if (action.startsWith('Send email')) return _sendEmail_(action, row, lang);
  if (action === 'Push to Kartra funnel') return _pushKartra_(row);
  if (action === 'Push to SitePatron (converted)') return _pushSitePatron_(row);
  if (action === 'Mark dead') return { result: 'marked_dead' };
  if (action === 'Re-enrich') {
    _flipToPending_([row.seller_id]);
    const exec = _triggerEnrichmentJob_(20);
    return { result: 'queued', execution: (exec && exec.name) || '' };
  }
  return { result: 'unknown_action' };
}

function _aiCall_(provider, row, lang) {
  const props = PropertiesService.getScriptProperties();
  const url = provider === 'bland' ? props.getProperty('ACTION_BLAND_URL') : props.getProperty('ACTION_VAPI_URL');
  if (!url) throw new Error(`${provider} endpoint not set`);
  if (!row.phone) throw new Error('no phone on row');
  return _signedPost_(url, {
    seller_id: row.seller_id,
    phone: row.phone,
    company_name: row.company_name,
    decision_maker_name: row.decision_maker_name,
    decision_maker_role: row.decision_maker_role,
    marketplace: row.marketplace,
    country: row.country,
    lang_for_call: _languageForMarketplace_(row.marketplace, row.country),
    operator_lang: lang
  });
}

function _languageForMarketplace_(mp, country) {
  if (country === 'DE' || /amazon\.de$/.test(mp || '')) return 'de';
  if (country === 'PL' || /amazon\.pl$/.test(mp || '')) return 'pl';
  if (country === 'FR' || /amazon\.fr$/.test(mp || '')) return 'fr';
  if (country === 'IT' || /amazon\.it$/.test(mp || '')) return 'it';
  if (country === 'ES' || /amazon\.es$/.test(mp || '')) return 'es';
  return 'en';
}

function _sendEmail_(action, row, operatorLang) {
  if (!row.email) throw new Error('no email on row');
  if (row.agency_flag) throw new Error('seller is agency-flagged; refusing to email');
  const isEN = /EN$/.test(action);
  const isFollow = /follow-up/i.test(action);
  const template = _emailTemplate_(isEN ? 'en' : 'pl', isFollow ? 'follow' : 'intro');
  const filled = _fillTemplate_(template, row);
  GmailApp.sendEmail(row.email, filled.subject, filled.text, {
    htmlBody: filled.html,
    name: 'NetAnaliza',
    replyTo: Session.getActiveUser().getEmail()
  });
  return { result: 'sent', to: row.email, template: action };
}

function _emailTemplate_(lang, kind) {
  const templates = {
    'en.intro': {
      subject: 'Quick question about {company}',
      text: 'Hi {name},\n\nI noticed {company} on Amazon ({marketplace}) — looking at your range I think we could help you build a brand site that funnels Amazon traffic to your own store.\n\nWould 15 minutes next week make sense?\n\nBest,\nŁukasz @ NetAnaliza',
      html: '<p>Hi {name},</p><p>I noticed <b>{company}</b> on Amazon ({marketplace}) — looking at your range I think we could help you build a brand site that funnels Amazon traffic to your own store.</p><p>Would 15 minutes next week make sense?</p><p>Best,<br>Łukasz @ NetAnaliza</p>'
    },
    'pl.intro': {
      subject: 'Krótkie pytanie odnośnie {company}',
      text: 'Dzień dobry {name},\n\nZauważyłem {company} na Amazon ({marketplace}). Patrząc na Wasz asortyment widzę, że moglibyśmy pomóc zbudować Wam stronę marki, która kieruje ruch z Amazona do Waszego sklepu.\n\nCzy 15 minut w przyszłym tygodniu miałoby sens?\n\nPozdrawiam,\nŁukasz, NetAnaliza',
      html: '<p>Dzień dobry {name},</p><p>Zauważyłem <b>{company}</b> na Amazon ({marketplace}). Patrząc na Wasz asortyment widzę, że moglibyśmy pomóc zbudować Wam stronę marki, która kieruje ruch z Amazona do Waszego sklepu.</p><p>Czy 15 minut w przyszłym tygodniu miałoby sens?</p><p>Pozdrawiam,<br>Łukasz, NetAnaliza</p>'
    },
    'en.follow': {
      subject: 'Re: quick question about {company}',
      text: 'Hi {name},\n\nFollowing up on my note — happy to send a 2-minute video showing exactly what we have in mind for {company}, no call needed.\n\n— Łukasz',
      html: '<p>Hi {name},</p><p>Following up on my note — happy to send a 2-minute video showing exactly what we have in mind for <b>{company}</b>, no call needed.</p><p>— Łukasz</p>'
    },
    'pl.follow': {
      subject: 'Re: krótkie pytanie odnośnie {company}',
      text: 'Dzień dobry {name},\n\nWracam do tematu — chętnie wyślę 2-minutowy filmik pokazujący dokładnie co mam na myśli dla {company}, bez rozmowy.\n\n— Łukasz',
      html: '<p>Dzień dobry {name},</p><p>Wracam do tematu — chętnie wyślę 2-minutowy filmik pokazujący dokładnie co mam na myśli dla <b>{company}</b>, bez rozmowy.</p><p>— Łukasz</p>'
    }
  };
  return templates[lang + '.' + kind];
}

function _fillTemplate_(tpl, row) {
  const name = row.decision_maker_name || '';
  const v = { name: name, company: row.company_name || '', marketplace: row.marketplace || '' };
  return {
    subject: _fmt(tpl.subject, v),
    text: _fmt(tpl.text, v),
    html: _fmt(tpl.html, v)
  };
}

function _pushKartra_(row) {
  const url = PropertiesService.getScriptProperties().getProperty('KARTRA_WEBHOOK_URL');
  if (!url) throw new Error('KARTRA_WEBHOOK_URL not set');
  return _signedPost_(url, {
    seller_id: row.seller_id,
    company: row.company_name,
    email: row.email,
    phone: row.phone,
    contact_name: row.decision_maker_name,
    country: row.country,
    marketplace: row.marketplace,
    source: 'sellers_worklist'
  });
}

function _pushSitePatron_(row) {
  const props = PropertiesService.getScriptProperties();
  const targetSheetId = props.getProperty('SITEPATRON_SYNC_SHEET');
  if (!targetSheetId) throw new Error('SITEPATRON_SYNC_SHEET not set');
  const ss = SpreadsheetApp.openById(targetSheetId);
  const sh = ss.getSheets()[0];
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const idx = (h) => headers.indexOf(h);
  const want = ['SellerID', 'Seller Name', 'Patron Company Name',
                'Patron Address Street', 'Patron Address City', 'Patron Address Country',
                'Patron Contact Phone', 'Patron Contact Email', 'Patron Website URL'];
  const missing = want.filter(c => idx(c) < 0);
  if (missing.length) throw new Error('SitePatron sheet missing columns: ' + missing.join(', '));

  const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), headers.length).getValues();
  const sidCol = idx('SellerID');
  let targetRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][sidCol]) === String(row.seller_id)) { targetRow = i + 2; break; }
  }
  if (targetRow < 0) {
    sh.appendRow([]);
    targetRow = sh.getLastRow();
  }
  const set = (col, val) => { if (val) sh.getRange(targetRow, idx(col) + 1).setValue(val); };
  set('SellerID', row.seller_id);
  set('Seller Name', row.company_name);
  set('Patron Company Name', row.company_name);
  set('Patron Contact Phone', row.phone);
  set('Patron Contact Email', row.email);
  set('Patron Website URL', row.website);
  return { result: 'synced', row: targetRow };
}

function _signedPost_(url, body) {
  const secret = PropertiesService.getScriptProperties().getProperty('ENRICH_SHARED_SECRET') || '';
  const ts = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify(body);
  const sig = Utilities.computeHmacSha256Signature(ts + '.' + payload, secret)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Luko-Timestamp': ts, 'X-Luko-Signature': sig },
    payload: payload,
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  let json = {};
  try { json = JSON.parse(resp.getContentText()); } catch { json = { raw: resp.getContentText().slice(0, 500) }; }
  if (code >= 400) throw new Error(`endpoint HTTP ${code}: ${json.error || JSON.stringify(json)}`);
  return json;
}

function _writeBack_(rowIndex, action, result) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wl = ss.getSheetByName(TAB_WORKLIST);
  const colLast = WORKLIST_HEADERS.indexOf('last_action') + 1;
  const colLastAt = WORKLIST_HEADERS.indexOf('last_action_at') + 1;
  const colLastRes = WORKLIST_HEADERS.indexOf('last_action_result') + 1;
  const colKartra = WORKLIST_HEADERS.indexOf('kartra_pushed_at') + 1;
  wl.getRange(rowIndex, colLast).setValue(action);
  wl.getRange(rowIndex, colLastAt).setValue(new Date());
  wl.getRange(rowIndex, colLastRes).setValue(result && result.result || JSON.stringify(result || {}).slice(0, 200));
  if (action === 'Push to Kartra funnel') wl.getRange(rowIndex, colKartra).setValue(new Date());
}

function _logAction_(seller_id, action, result) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('BQ_PROJECT_ID');
  const dataset = props.getProperty('BQ_DATASET');
  if (!projectId || !dataset) return;
  BigQuery.Tabledata.insertAll({
    rows: [{
      json: {
        action_id: Utilities.getUuid(),
        seller_id: seller_id,
        action_type: action,
        operator_id: Session.getActiveUser().getEmail(),
        payload: JSON.stringify({}),
        result: (result && result.result) || 'unknown',
        result_at: new Date().toISOString(),
        external_id: (result && (result.id || result.call_id || result.message_id)) || ''
      }
    }]
  }, projectId, dataset, 'action_log');
}

// ─── Cloud Run Job trigger helpers ─────────────────────────────────────────
//
// Re-enrich flow:
//   1) flip selected sellers' status back to 'captured_pending_enrich' in BQ
//   2) trigger luko-enrichment-worker Cloud Run Job — it pulls pending rows,
//      enriches via the source pipeline, writes back enriched fields.
// Defaults match deploy: region=europe-west1, job name=luko-enrichment-worker.
// Override via Script Properties if you ever redeploy elsewhere.

function _flipToPending_(sellerIds) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('BQ_PROJECT_ID');
  const dataset = props.getProperty('BQ_DATASET');
  if (!projectId || !dataset) {
    throw new Error('BQ_PROJECT_ID / BQ_DATASET not configured in Script Properties');
  }
  // Build IN-list with single-quote escaping for SQL safety.
  const inList = sellerIds.map(s => "'" + String(s).replace(/'/g, "''") + "'").join(',');
  const sql =
    'UPDATE `' + projectId + '.' + dataset + '.sellers_enriched` ' +
    "SET status='captured_pending_enrich' " +
    'WHERE seller_id IN (' + inList + ')';
  const job = BigQuery.Jobs.query({ query: sql, useLegacySql: false }, projectId);
  return job;
}

function _triggerEnrichmentJob_(limit) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('BQ_PROJECT_ID');
  const region = props.getProperty('CLOUD_RUN_REGION') || 'europe-west1';
  const jobName = props.getProperty('CLOUD_RUN_JOB_NAME') || 'luko-enrichment-worker';
  if (!projectId) throw new Error('BQ_PROJECT_ID not configured (used as GCP project)');

  const url = 'https://run.googleapis.com/v2/projects/' + projectId +
              '/locations/' + region + '/jobs/' + jobName + ':run';
  const token = ScriptApp.getOAuthToken();
  const body = {
    overrides: {
      containerOverrides: [{
        args: ['pending', '--limit=' + String(Math.max(parseInt(limit, 10) || 20, 1))]
      }]
    }
  };
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    throw new Error('Cloud Run jobs.run failed (' + resp.getResponseCode() + '): ' +
                    resp.getContentText().slice(0, 300));
  }
  return JSON.parse(resp.getContentText());
}
