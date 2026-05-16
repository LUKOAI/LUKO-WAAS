(function () {
  const HOST_ID = "luko-toast-host";
  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host.shadowRoot;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;";
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .t{font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         padding:12px 14px;border-radius:8px;margin-bottom:8px;max-width:380px;
         box-shadow:0 6px 24px rgba(0,0,0,.18);color:#fff;animation:s .18s ease-out;}
      .ok{background:#16a34a}.warn{background:#d97706}.err{background:#dc2626}.info{background:#2563eb}
      .x{float:right;margin-left:8px;cursor:pointer;opacity:.8}
      @keyframes s{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}
    `;
    root.appendChild(style);
    return root;
  }
  function show(kind, msg, ttlMs = 6000) {
    const root = ensureHost();
    const el = document.createElement("div");
    el.className = `t ${kind}`;
    el.innerHTML = `<span class="x" title="close">×</span><div></div>`;
    el.querySelector("div").textContent = msg;
    el.querySelector(".x").addEventListener("click", () => el.remove());
    root.appendChild(el);
    if (ttlMs) setTimeout(() => el.remove(), ttlMs);
  }
  window.__lukoToast = { show };
})();
