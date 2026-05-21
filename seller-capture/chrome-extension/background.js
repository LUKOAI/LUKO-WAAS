async function getConfig() {
  return await chrome.storage.sync.get([
    "endpoint", "driveFolderId", "operatorId", "lang", "marketplaceOverride", "sharedSecret"
  ]);
}

function hexFromBytes(bytes) {
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hexFromBytes(sig);
}

async function captureScreenshot(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}

async function uploadToDrive(dataUrl, filename, folderId) {
  if (!folderId) return null;
  const token = await new Promise((resolve, reject) =>
    chrome.identity.getAuthToken({ interactive: true }, (t) =>
      t ? resolve(t) : reject(new Error(chrome.runtime.lastError?.message || "no token"))
    )
  );
  const base64 = dataUrl.split(",")[1];
  const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const meta = { name: filename, parents: [folderId], mimeType: "image/png" };
  const boundary = "luko_" + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, bin, tail], { type: `multipart/related; boundary=${boundary}` });
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function postToEndpoint(endpoint, payload, sharedSecret) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  let url = endpoint;
  if (sharedSecret) {
    const sig = await hmacSha256Hex(sharedSecret, ts + "." + body);
    url += (url.includes("?") ? "&" : "?") + `ts=${encodeURIComponent(ts)}&sig=${encodeURIComponent(sig)}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok: false, error: `non-JSON response: ${text.slice(0, 200)}` }; }
  if (!res.ok && json.ok !== false) json = { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  return json;
}

// Per-seller debounce: even after fixing the content-script multi-inject
// (see content.js __lukoCaptureLoaded guard), keep this safety net so that
// double Alt+S taps / popup-button clicks / SPA navigations can't produce
// duplicate captures of the same seller. Window: 5 seconds.
const _recentCaptures = new Map();  // seller_id -> last capture timestamp (ms)
const CAPTURE_DEBOUNCE_MS = 5000;

// ─── Cluster (competitor-group) state ────────────────────────────────────
//
// A cluster groups multiple captures around the same anchor — either:
//   • a search slug ("stichsaegeblaetter-holz") if the URL we capture from
//     carries  #luko_slug=...  in its fragment (auto-mode, comes from the
//     LUKO_Domain_Slug_Finder workbook), or
//   • an Amazon ASIN if the operator pressed Alt+G on an Amazon ASIN page
//     (manual mode).
//
// Active cluster lives in chrome.storage.local:
//   { activeCluster: { id: "C-ABC1234", anchor: "stichsaegeblaetter-holz",
//                      anchorKind: "slug"|"asin", startedAt: 1234567890,
//                      count: 3 } }
//
// auto-mode rule: when a CAPTURE arrives with a slug fragment, we compare
// against the active cluster — same anchor → keep cluster_id; different
// anchor → silently rotate (end old, start new with the new slug).

const CLUSTER_KEY = 'activeCluster';

function _generateClusterId() {
  // Format: C-<5 base36 chars from random + ms suffix> → 7-9 chars total
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  const t = Date.now().toString(36).slice(-3).toUpperCase();
  return 'C-' + r + t;
}

async function getActiveCluster() {
  const { [CLUSTER_KEY]: ac } = await chrome.storage.local.get([CLUSTER_KEY]);
  return ac || null;
}

async function setActiveCluster(cluster) {
  if (cluster) {
    await chrome.storage.local.set({ [CLUSTER_KEY]: cluster });
  } else {
    await chrome.storage.local.remove([CLUSTER_KEY]);
  }
  await _updateBadge(cluster);
}

async function _updateBadge(cluster) {
  if (cluster) {
    await chrome.action.setBadgeText({ text: String(cluster.count || 0) });
    await chrome.action.setBadgeBackgroundColor({ color: '#1f9d55' });  // green
    await chrome.action.setTitle({ title: `Cluster ${cluster.id} (${cluster.anchorKind}=${cluster.anchor}) — ${cluster.count} captures. Alt+G to end.` });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Capture seller (Alt+S). Alt+G starts a cluster.' });
  }
}

// Extract a slug from a tab URL's #luko_slug=… fragment (or ?luko_slug=… query
// param as a fallback for environments that strip fragments).
function _slugFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const q = u.searchParams.get('luko_slug');
    if (q) return decodeURIComponent(q);
    if (u.hash) {
      const m = u.hash.match(/(?:^#|[#&])luko_slug=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
  } catch (_) { /* malformed URL — give up silently */ }
  return null;
}

// Extract the ASIN from an Amazon URL (matches /dp/ASIN, /gp/product/ASIN,
// /sp?...&asin=ASIN). Used as the cluster anchor in Alt+G manual mode.
function _asinFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Try /dp/<asin> or /gp/product/<asin>
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/);
    if (m) return m[1];
    // Try ?asin=<asin> (seller storefront URLs)
    const qa = u.searchParams.get('asin');
    if (qa && /^[A-Z0-9]{10}$/.test(qa)) return qa;
  } catch (_) {}
  return null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "CAPTURE") return false;
  const sid = msg.payload && msg.payload.seller_id;
  if (sid) {
    const now = Date.now();
    const last = _recentCaptures.get(sid) || 0;
    if (now - last < CAPTURE_DEBOUNCE_MS) {
      sendResponse({ ok: true, deduped: true, error: null });
      return true;
    }
    _recentCaptures.set(sid, now);
    // Lazy cleanup of stale entries (keep map small over a long session).
    if (_recentCaptures.size > 100) {
      const cutoff = now - CAPTURE_DEBOUNCE_MS * 10;
      for (const [k, v] of _recentCaptures) {
        if (v < cutoff) _recentCaptures.delete(k);
      }
    }
  }
  (async () => {
    try {
      const cfg = await getConfig();
      if (!cfg.endpoint) throw new Error("Endpoint URL not configured (open extension popup)");
      const tabId = sender.tab?.id;
      const p = msg.payload;

      // Cluster resolution: prefer URL fragment (slug-anchored auto mode), fall
      // back to currently-active manual cluster (Alt+G). If a slug fragment is
      // present but differs from the active cluster's anchor, silently rotate.
      //
      // IMPORTANT: read the URL from msg.payload.url (content.js captured it
      // via window.location.href, fragment intact) instead of sender.tab.url
      // (Chrome MV3 sometimes strips #fragments from sender.tab.url).
      try {
        const tabUrl = (p && p.url) || sender.tab?.url || '';
        const slug = _slugFromUrl(tabUrl);
        let active = await getActiveCluster();
        if (slug) {
          if (!active || active.anchor !== slug) {
            active = {
              id: _generateClusterId(),
              anchor: slug,
              anchorKind: 'slug',
              startedAt: Date.now(),
              count: 0
            };
          }
        }
        if (active) {
          p.cluster_id = active.id;
          p.cluster_anchor = active.anchor;
          active.count = (active.count || 0) + 1;
          await setActiveCluster(active);
        }
      } catch (e) {
        console.warn('[Luko Capture] cluster resolution failed:', e);
      }
      if (cfg.marketplaceOverride) p.marketplace = cfg.marketplaceOverride;
      p.operator_id = cfg.operatorId || "unknown";

      let screenshot = null;
      try {
        const dataUrl = tabId ? await captureScreenshot(tabId) : null;
        if (dataUrl && cfg.driveFolderId) {
          const fname = `${p.marketplace}_${p.seller_id}_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
          const up = await uploadToDrive(dataUrl, fname, cfg.driveFolderId);
          screenshot = { drive_id: up.id, link: up.webViewLink };
        } else if (dataUrl) {
          screenshot = { inline_b64_len: dataUrl.length };
        }
      } catch (e) {
        screenshot = { error: e.message };
      }
      p.screenshot = screenshot;

      const result = await postToEndpoint(cfg.endpoint, p, cfg.sharedSecret);
      sendResponse({ ok: !!result.ok, result, error: result.error });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});

chrome.commands.onCommand.addListener(async (cmd) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (cmd === "capture") {
    await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_CAPTURE" });
    return;
  }

  if (cmd === "toggle-cluster") {
    const active = await getActiveCluster();
    if (active) {
      // End cluster: stash a snapshot for the popup to display, then clear.
      await setActiveCluster(null);
      await _toastInTab(tab.id, 'ok',
        `Cluster ended: ${active.id} (${active.anchorKind}=${active.anchor}) — ${active.count} captures.`);
      return;
    }
    // Start cluster: prefer slug fragment, fall back to ASIN from URL.
    const slug = _slugFromUrl(tab.url);
    const asin = _asinFromUrl(tab.url);
    if (!slug && !asin) {
      await _toastInTab(tab.id, 'err',
        'Cannot start cluster: no slug (#luko_slug=) and no ASIN found on this page. Open an Amazon ASIN page or a slug-tagged link first.');
      return;
    }
    const cluster = {
      id: _generateClusterId(),
      anchor: slug || asin,
      anchorKind: slug ? 'slug' : 'asin',
      startedAt: Date.now(),
      count: 0
    };
    await setActiveCluster(cluster);
    await _toastInTab(tab.id, 'info',
      `Cluster started: ${cluster.id} (${cluster.anchorKind}=${cluster.anchor}). Alt+S to add sellers, Alt+G to end.`);
    return;
  }
});

async function _toastInTab(tabId, level, text) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "TOAST", level: level, text: text });
  } catch (_) {
    // Content script not loaded on this tab (e.g. chrome://) — silent fail.
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_CAPTURE" });
});

// First-time install / update: load defaults from config.json so a freshly
// unpacked extension is fully configured without making the operator fill
// 6 fields in the popup. Values starting with "PLACEHOLDER_" are skipped
// (treated as not-yet-set), so the popup will still show empties for them.
// Existing storage values are NEVER overwritten — long-time users keep
// whatever they configured manually.
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const resp = await fetch(chrome.runtime.getURL("config.json"));
    if (!resp.ok) return;
    const defaults = await resp.json();
    const keys = Object.keys(defaults);
    const existing = await chrome.storage.sync.get(keys);
    const toSet = {};
    for (const k of keys) {
      const v = defaults[k];
      if (typeof v === "string" && v.startsWith("PLACEHOLDER_")) continue;
      if (existing[k] === undefined || existing[k] === null || existing[k] === "") {
        toSet[k] = v;
      }
    }
    if (Object.keys(toSet).length) {
      await chrome.storage.sync.set(toSet);
      console.log("[Luko Capture] Loaded defaults from config.json:", Object.keys(toSet));
    }
  } catch (e) {
    console.warn("[Luko Capture] Failed to load config.json:", e);
  }
});
