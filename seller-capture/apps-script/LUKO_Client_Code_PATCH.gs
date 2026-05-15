/**
 * SECURITY PATCH for the existing LUKO_Client_Code Web App.
 *
 * Problem (from audit §4):
 *   - LUKO_Client_Code is deployed as access=ANYONE_ANONYMOUS and receives Kartra
 *     webhooks that write to LUKO_API_Keys_Database. Any URL holder can inject
 *     fake licenses or leads.
 *
 * Fix:
 *   - Keep ANYONE_ANONYMOUS (Kartra cannot send custom headers reliably) BUT
 *     require a shared secret in the POST body as `_secret` field, and validate
 *     against KARTRA_WEBHOOK_SECRET in Script Properties.
 *   - Constant-time compare to prevent timing leaks.
 *   - Reject if missing/invalid; log to a separate "_audit" tab.
 *
 * Deployment (manual):
 *   1. Open LUKO_Client_Code in script.google.com (scriptId
 *      1vHQjcih6xnM9UhLNJWfqCtaqUfenRsfAgfTP_NBEtXf-QfFRjzjPr0fb).
 *   2. Set Script Property KARTRA_WEBHOOK_SECRET = <strong random string>.
 *   3. Wrap the existing doPost handler — call _verifyKartraSecret_(e) at top.
 *   4. In Kartra outbound webhook config add `_secret` field with the same value.
 *   5. Deploy new version (Manage Deployments → New version).
 */

function _verifyKartraSecret_(e) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('KARTRA_WEBHOOK_SECRET') || '';
  if (!expected) {
    return { ok: false, reason: 'server_secret_not_set' };
  }
  let provided = '';
  try {
    if (e && e.parameter && e.parameter._secret) {
      provided = String(e.parameter._secret);
    } else if (e && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      provided = String(body._secret || '');
    }
  } catch (_) {
    return { ok: false, reason: 'parse_error' };
  }
  if (provided.length !== expected.length) {
    return { ok: false, reason: 'bad_secret_length' };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (diff !== 0) return { ok: false, reason: 'bad_secret' };
  return { ok: true };
}

function _auditLog_(event, e) {
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('AUDIT_SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId());
    let sh = ss.getSheetByName('_audit');
    if (!sh) {
      sh = ss.insertSheet('_audit');
      sh.appendRow(['timestamp', 'event', 'remote', 'body_preview']);
    }
    sh.appendRow([
      new Date().toISOString(),
      event,
      (e && e.parameter && e.parameter.from) || '',
      ((e && e.postData && e.postData.contents) || '').slice(0, 500)
    ]);
  } catch (_) { /* never throw from audit logger */ }
}

/**
 * Wrap the existing handler. Replace the original `doPost` with:
 *
 *   function doPost(e) {
 *     const auth = _verifyKartraSecret_(e);
 *     if (!auth.ok) {
 *       _auditLog_('reject:' + auth.reason, e);
 *       return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
 *         .setMimeType(ContentService.MimeType.JSON);
 *     }
 *     _auditLog_('accept', e);
 *     return _originalDoPost_(e);   // your existing logic, renamed
 *   }
 */
