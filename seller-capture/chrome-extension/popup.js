const FIELDS = ["endpoint", "driveFolderId", "operatorId", "marketplaceOverride", "lang", "sharedSecret"];

async function applyI18n() {
  const { t } = window.__lukoI18n;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = await t(el.getAttribute("data-i18n"));
  }
}

async function load() {
  const cfg = await chrome.storage.sync.get(FIELDS);
  for (const k of FIELDS) {
    const el = document.getElementById(k);
    if (el && cfg[k] != null) el.value = cfg[k];
  }
  if (!cfg.lang) document.getElementById("lang").value = "en";
}

async function save() {
  const out = {};
  for (const k of FIELDS) out[k] = document.getElementById(k).value.trim();
  await chrome.storage.sync.set(out);
  const { t } = window.__lukoI18n;
  document.getElementById("msg").textContent = await t("popup_saved");
  document.getElementById("msg").className = "msg ok";
  await applyI18n();
}

async function test() {
  const { t } = window.__lukoI18n;
  const msg = document.getElementById("msg");
  const endpoint = document.getElementById("endpoint").value.trim();
  if (!endpoint) { msg.textContent = "no endpoint"; msg.className = "msg err"; return; }
  try {
    const r = await fetch(endpoint + (endpoint.includes("?") ? "&" : "?") + "ping=1");
    msg.textContent = await t("popup_test_ok") + ` (HTTP ${r.status})`;
    msg.className = "msg ok";
  } catch (e) {
    msg.textContent = await t("popup_test_fail", { message: e.message });
    msg.className = "msg err";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await load();
  await applyI18n();
  document.getElementById("save").addEventListener("click", save);
  document.getElementById("test").addEventListener("click", test);
  document.getElementById("lang").addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ lang: e.target.value });
    await applyI18n();
  });
});
