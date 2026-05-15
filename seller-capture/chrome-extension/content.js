(async function () {
  const { t } = window.__lukoI18n;
  const { show } = window.__lukoToast;

  const selectorsUrl = chrome.runtime.getURL("selectors.json");
  const SELECTORS = await fetch(selectorsUrl).then(r => r.json());

  function detectMarketplace() {
    const host = location.hostname.replace(/^www\./, "");
    return host;
  }

  function getSellerIdFromUrl() {
    const url = new URL(location.href);
    return url.searchParams.get("seller") || url.searchParams.get("isAmazonFulfilled") && null;
  }

  function findSection() {
    for (const sel of SELECTORS.section_anchors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    const headings = [...document.querySelectorAll("h1,h2,h3,h4")]
      .filter(h => /detailed seller information|detaillierte verk|détails du vendeur|información detallada|szczegółowe inf/i.test(h.textContent));
    if (headings.length) {
      let n = headings[0].nextElementSibling;
      while (n && n.children && n.children.length === 0) n = n.nextElementSibling;
      return n || headings[0].parentElement;
    }
    return null;
  }

  function normalizeLabel(raw) {
    return raw.toLowerCase().replace(/[:：]\s*$/, "").trim();
  }

  function matchKey(labelText) {
    const norm = normalizeLabel(labelText);
    for (const [key, aliases] of Object.entries(SELECTORS.label_map)) {
      if (aliases.some(a => norm === a || norm.startsWith(a + " ") || norm.endsWith(" " + a))) return key;
    }
    return null;
  }

  function parseByLi(section) {
    const out = {};
    const lis = section.querySelectorAll("li");
    for (const li of lis) {
      const bold = li.querySelector(".a-text-bold, b, strong, span");
      if (!bold) continue;
      const labelText = bold.textContent || "";
      const key = matchKey(labelText);
      if (!key) continue;
      let value;
      const nested = li.querySelector("ul");
      if (nested) {
        value = [...nested.querySelectorAll("li")].map(x => x.textContent.trim()).filter(Boolean).join(", ");
      } else {
        value = li.textContent.replace(labelText, "").replace(/^[:：]\s*/, "").trim();
      }
      if (value) out[key] = value;
    }
    return out;
  }

  function parseByRegex(rawText) {
    const out = {};
    const lines = rawText.split(/\n+/).map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([^:：]{2,60})[:：]\s*(.*)$/);
      if (!m) continue;
      const key = matchKey(m[1]);
      if (!key) continue;
      let val = m[2].trim();
      if (!val && lines[i + 1] && !/:[\s]/.test(lines[i + 1])) val = lines[i + 1].trim();
      if (val) out[key] = val;
    }
    return out;
  }

  function findGpsrResponsible(rawText) {
    const lower = rawText.toLowerCase();
    for (const lbl of SELECTORS.gpsr_responsible_section_labels) {
      const idx = lower.indexOf(lbl);
      if (idx >= 0) {
        return rawText.slice(idx, idx + 800);
      }
    }
    return null;
  }

  async function capture() {
    try {
      show("info", await t("toast_capturing"));
      const section = findSection();
      if (!section) throw new Error("seller info section not found");
      const rawText = section.innerText;
      const parsed = { ...parseByRegex(rawText), ...parseByLi(section) };
      const gpsrRaw = findGpsrResponsible(document.body.innerText || "");
      const seller_id = getSellerIdFromUrl();
      if (!seller_id) throw new Error("seller_id missing from URL");
      const payload = {
        seller_id,
        marketplace: detectMarketplace(),
        url: location.href,
        captured_at: new Date().toISOString(),
        parsed,
        raw_text: rawText,
        gpsr_raw: gpsrRaw,
        ua: navigator.userAgent
      };
      const resp = await chrome.runtime.sendMessage({ type: "CAPTURE", payload });
      if (!resp || !resp.ok) {
        show("err", await t("toast_error", { message: (resp && resp.error) || "no response" }), 10000);
        return;
      }
      const r = resp.result || {};
      if (r.is_duplicate) {
        show("warn", await t("toast_duplicate", { row: r.row, status: r.status || "?", date: r.last_seen || "?" }), 8000);
      } else if (r.missing && r.missing.length) {
        show("warn", await t("toast_partial", { missing: r.missing.join(", ") }), 8000);
      } else {
        show("ok", await t("toast_ok", { row: r.row, filled: r.filled, total: r.total }));
      }
      if (r.agency_flag) {
        show("warn", await t("toast_agency_flag", { agency: r.agency_flag }), 12000);
      }
    } catch (e) {
      show("err", await t("toast_error", { message: e.message || String(e) }), 10000);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "TRIGGER_CAPTURE") capture();
  });
  window.__lukoCapture = capture;
})();
