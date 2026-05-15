(function () {
  const cache = {};
  async function load(lang) {
    if (cache[lang]) return cache[lang];
    const url = chrome.runtime.getURL(`i18n/${lang}.json`);
    const res = await fetch(url);
    cache[lang] = await res.json();
    return cache[lang];
  }
  function fmt(s, vars) {
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ""));
  }
  async function t(key, vars) {
    const { lang = "en" } = await chrome.storage.sync.get(["lang"]);
    const dict = await load(lang).catch(() => null) || await load("en");
    return fmt(dict[key] || key, vars);
  }
  window.__lukoI18n = { t, load, fmt };
})();
