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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "CAPTURE") return false;
  (async () => {
    try {
      const cfg = await getConfig();
      if (!cfg.endpoint) throw new Error("Endpoint URL not configured (open extension popup)");
      const tabId = sender.tab?.id;
      const p = msg.payload;
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
  if (cmd !== "capture") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_CAPTURE" });
});

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
