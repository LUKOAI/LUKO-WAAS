/**
 * Amazon seller page scraper v2.
 *
 * Parses TWO impressum blocks that coexist on Amazon seller pages:
 *   1. "Gesetzliche Anbieterkennung" / "Impressum" — free-text legal notice (often
 *      contains Geschäftsführer name, WEEE, fax — unique data).
 *   2. "Business-Verkäufer" / "Impressum & Info zum Verkäufer" — structured key:value
 *      block with separate Geschäftsadresse + Kundendienstadresse subsections
 *      (gives us street/postal/city/region/country as separate fields, plus the
 *      customer-service address which is often a warehouse or fulfillment agent).
 *
 * Output (`parsed`) is fully structured — no monolithic address blob.
 */
(async function () {
  const { t } = window.__lukoI18n;
  const { show } = window.__lukoToast;

  // ===== Utilities =====

  function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
  function tidyMultiline(s) { return (s || "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n"); }

  function detectMarketplace() {
    return location.hostname.replace(/^www\./, "");
  }

  function getSellerIdFromUrl() {
    return new URL(location.href).searchParams.get("seller") || null;
  }

  // Pull ASIN from the URL we landed on (?asin=...) or referrer, fallback to /dp/XXXXXX.
  function getAsin() {
    const here = new URL(location.href);
    const a = here.searchParams.get("asin");
    if (a) return a;
    const m = location.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/);
    if (m) return m[1];
    if (document.referrer) {
      try {
        const r = new URL(document.referrer);
        const ra = r.searchParams.get("asin");
        if (ra) return ra;
        const rm = r.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/);
        if (rm) return rm[1];
      } catch {}
    }
    return null;
  }

  // Brand / storefront name — usually first h1 on the seller page header
  function getBrand() {
    const candidates = [
      "#seller-name",
      ".a-spacing-base h1",
      "h1.a-color-base",
      "h1",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        const txt = clean(el.textContent);
        if (txt && txt.length < 120) return txt;
      }
    }
    return clean((document.title || "").replace(/\s*[-—|·:].*$/, "")).slice(0, 120) || null;
  }

  // ===== Country normalization =====

  const COUNTRY_MAP = {
    "de": "DE", "deutschland": "DE", "germany": "DE", "alemania": "DE", "allemagne": "DE", "niemcy": "DE",
    "pl": "PL", "polska": "PL", "polen": "PL", "poland": "PL", "pologne": "PL",
    "fr": "FR", "frankreich": "FR", "france": "FR", "francia": "FR", "francja": "FR",
    "it": "IT", "italien": "IT", "italy": "IT", "italia": "IT", "włochy": "IT",
    "es": "ES", "spanien": "ES", "spain": "ES", "españa": "ES", "espagne": "ES", "hiszpania": "ES",
    "nl": "NL", "niederlande": "NL", "netherlands": "NL", "holandia": "NL", "pays-bas": "NL",
    "be": "BE", "belgien": "BE", "belgium": "BE", "belgia": "BE", "belgique": "BE",
    "se": "SE", "schweden": "SE", "sweden": "SE", "szwecja": "SE", "suède": "SE",
    "cz": "CZ", "tschechien": "CZ", "czechia": "CZ", "czechy": "CZ",
    "sk": "SK", "slowakei": "SK", "slovakia": "SK",
    "at": "AT", "österreich": "AT", "austria": "AT", "autriche": "AT",
    "ch": "CH", "schweiz": "CH", "switzerland": "CH", "suisse": "CH",
    "uk": "UK", "gb": "GB", "großbritannien": "UK", "vereinigtes königreich": "UK",
    "united kingdom": "UK", "england": "UK", "britain": "UK",
    "us": "US", "usa": "US", "vereinigte staaten": "US", "united states": "US",
    "cn": "CN", "china": "CN", "p.r.c.": "CN", "volksrepublik china": "CN",
    "hk": "HK", "hong kong": "HK",
    "tw": "TW", "taiwan": "TW",
    "tr": "TR", "türkei": "TR", "turkey": "TR",
    "ie": "IE", "irland": "IE", "ireland": "IE",
    "dk": "DK", "dänemark": "DK", "denmark": "DK",
    "fi": "FI", "finnland": "FI", "finland": "FI",
    "no": "NO", "norwegen": "NO", "norway": "NO",
    "pt": "PT", "portugal": "PT",
    "hu": "HU", "ungarn": "HU", "hungary": "HU", "węgry": "HU",
    "ro": "RO", "rumänien": "RO", "romania": "RO", "rumunia": "RO",
    "lt": "LT", "litauen": "LT", "lithuania": "LT", "litwa": "LT",
    "lv": "LV", "lettland": "LV", "latvia": "LV", "łotwa": "LV",
    "ee": "EE", "estland": "EE", "estonia": "EE", "estonia": "EE",
  };
  function normalizeCountry(s) {
    if (!s) return "";
    const k = clean(s).toLowerCase().replace(/[.,]/g, "");
    return COUNTRY_MAP[k] || (k.length === 2 ? k.toUpperCase() : "");
  }

  // ===== Block locators on the page =====

  // Find the section that has both impressum sub-blocks. Different page layouts.
  function findSellerInfoNode() {
    const anchors = [
      "#page-section-detail-seller-info",
      "#seller-info-card",
      "#aag",
      "#help_seller_profile_about_seller_more_information",
      "div[data-feature-name='detailSellerInfo']",
      "div[data-feature-name='aboutSeller']",
      "div[data-feature-name='sellerInfoBlock']",
    ];
    for (const sel of anchors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Fallback by heading text
    const headings = [...document.querySelectorAll("h1,h2,h3,h4")]
      .filter(h => /info zum verk|detailed seller|détails du vendeur|información detallada|szczegółowe inf|impressum/i.test(h.textContent || ""));
    return headings.length ? headings[0].parentElement : document.body;
  }

  // Locate sub-block by its heading text within a containing node. Returns the
  // raw multi-line string between this heading and the next heading (or block end).
  function extractBlockByHeading(rootText, headings) {
    const text = tidyMultiline(rootText);
    for (const h of headings) {
      const re = new RegExp(`(^|\\n)\\s*${h}\\s*:?\\s*\\n`, "i");
      const m = re.exec(text);
      if (m) {
        const start = m.index + m[0].length;
        const remainder = text.slice(start);
        // Stop at the next heading (heuristic: line with no `:` and 2-50 chars of word chars)
        const stopRe = /\n\s*(Impressum|Gesetzliche Anbieterkennung|Anbieterkennzeichnung|Business-Verkäufer|Impressum\s*&\s*Info zum Verkäufer|Datenschutz|Versand|Bewertungen|Rezensionen|Reviews|Alternative Streitbeilegung|Plattform der EU)\b/i;
        const stop = stopRe.exec(remainder);
        return (stop ? remainder.slice(0, stop.index) : remainder).trim();
      }
    }
    return null;
  }

  // ===== Regex extractors (run on any text — block or page-wide as fallback) =====

  const RE_VAT = /\b(?:USt[-\s]*Id[-\s]*Nr\.?|UStID|VAT(?:\s*(?:Number|Nr\.?|ID|No))?|Numero\s+(?:di\s+)?(?:partita\s+)?IVA|Numéro\s+de\s+TVA|Número\s+de\s+IVA|NIP|BTW(?:-nr)?|Umsatzsteuer[-\s]*Identifikationsnummer(?:\s+gemäß[^:]+)?)[:\s.]*([A-Z]{2}\s*[0-9A-Z]{6,14})\b/i;
  const RE_WEEE = /WEEE[-\s]*Reg\.?[-\s]*Nr\.?[:\s.]*([A-Z]{2}\s*\d{6,12})/i;
  const RE_HRB = /Handels(?:register[-\s]?Nr(?:ummer)?|reg\.?Nr\.?)\.?[:\s]*([A-Z]{2,4}\s*\d+(?:\s*[A-Z]+)?)/i;
  const RE_EPR_LUCID = /\b(?:LUCID|Verpackungs?reg(?:ister)?[-\s]?Nr\.?)\.?[:\s]*(DE\d{10,15})\b/i;
  const RE_EPR_OTHER = /\b(?:EPR[-\s]*Nr\.?|EAR[-\s]*Nr\.?|EcoTLC|Ecologic)[:\s.]*([A-Z]{0,4}\s*\d{6,15})/i;
  const RE_EMAIL = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;
  const RE_PHONE_LABEL = /(?:Telefonnummer|Telefon|Phone(?:\s+Number)?|Tel\.?|Téléphone|Numero\s+di\s+telefono|Número\s+de\s+teléfono|Numer\s+telefonu|Telefoonnummer)[:\s.]*([+0-9 ()\-./]{7,30})/i;
  const RE_FAX = /(?:Telefax|Fax)[:\s.]*([+0-9 ()\-./]{7,30})/i;
  // "diese vertr. d. d. Geschäftsführer Ahad Sader Fosalaie"
  // or "Geschäftsführer: Max Mustermann"
  const RE_GF = /(?:vertr(?:\.?\s*d\.?\s*d\.?|eten\s+durch(?:\s+d(?:en|ie))?)?\s*)?Gesch[äa]ftsf[üu]hrer(?:in)?[:\s]+([A-Za-zÀ-ÿĀ-žß\-.' ]{3,80}?)(?=\n|<|$)/i;

  function ridSpace(s) { return s ? s.replace(/\s+/g, "") : s; }

  function extractIds(text) {
    const out = {};
    let m;
    m = RE_VAT.exec(text); if (m) out.vat_number = ridSpace(m[1]);
    m = RE_WEEE.exec(text); if (m) out.weee_number = ridSpace(m[1]);
    m = RE_HRB.exec(text); if (m) out.trade_register_number = clean(m[1]);
    m = RE_EPR_LUCID.exec(text); if (m) out.epr_id = m[1];
    if (!out.epr_id) { m = RE_EPR_OTHER.exec(text); if (m) out.epr_id = clean(m[1]); }
    return out;
  }

  function extractContact(text) {
    const out = {};
    const phones = [];
    const ph = RE_PHONE_LABEL.exec(text); if (ph) phones.push(clean(ph[1]));
    const fx = RE_FAX.exec(text); if (fx) phones.push(clean(fx[1]));
    if (phones[0]) out.phone = phones[0];
    if (phones[1]) out.phone_alt = phones[1];
    const emails = (text.match(RE_EMAIL) || []).map(e => e.toLowerCase());
    const seen = new Set();
    const uniq = emails.filter(e => !seen.has(e) && seen.add(e));
    if (uniq[0]) out.email = uniq[0];
    if (uniq[1]) out.email_alt = uniq[1];
    const gf = RE_GF.exec(text); if (gf) out.representative_name = clean(gf[1]);
    return out;
  }

  // ===== Address parsing =====

  // Address coming from Business-Verkäufer block: usually 4-5 separate lines.
  // Format observed (DE Amazon): street / city / region / postal / country
  // Variants: 4 lines (no region), 3 lines, 2 lines, 1 line.
  function parseAddressLines(lines) {
    lines = lines.map(clean).filter(Boolean);
    const out = {};
    if (!lines.length) return out;

    if (lines.length === 5) {
      out.street = lines[0];
      out.city = lines[1];
      out.region = lines[2];
      out.postal_code = lines[3];
      out.country = normalizeCountry(lines[4]);
    } else if (lines.length === 4) {
      out.street = lines[0];
      out.city = lines[1];
      out.postal_code = lines[2];
      out.country = normalizeCountry(lines[3]);
    } else if (lines.length === 3) {
      // Gesetzliche-style: street / "postal city" / country-full
      out.street = lines[0];
      const m = lines[1].match(/^([0-9A-Z][0-9A-Z\- ]{2,12})\s+(.+)$/);
      if (m) { out.postal_code = clean(m[1]); out.city = clean(m[2]); } else { out.city = lines[1]; }
      out.country = normalizeCountry(lines[2]);
    } else if (lines.length === 2) {
      out.street = lines[0];
      const m = lines[1].match(/^([0-9A-Z][0-9A-Z\- ]{2,12})\s+(.+)$/);
      if (m) { out.postal_code = clean(m[1]); out.city = clean(m[2]); } else { out.city = lines[1]; }
    } else if (lines.length === 1) {
      out.street = lines[0];
    }
    return out;
  }

  // From a structured block (Business-Verkäufer), pull the sub-section after a label
  // such as "Geschäftsadresse" / "Kundendienstadresse" — read lines until blank line
  // or the next labeled section starts.
  function extractAddressAfterLabel(blockText, labelRegexes) {
    const text = tidyMultiline(blockText);
    for (const re of labelRegexes) {
      const m = re.exec(text);
      if (!m) continue;
      const start = m.index + m[0].length;
      const tail = text.slice(start);
      // Stop on blank line or next address-style header
      const stopRe = /\n\s*\n|\n\s*(Gesch[äa]ftsadresse|Kundendienst[-\s]?adresse|Customer\s+service\s+address|Business\s+address|Impressum|Datenschutz|Versand|Telefonnummer|E-?Mail|UStID|USt-?IdNr|WEEE|Handelsregister|Geschäftsart|Geschäftsname|Brand)[:\s]/i;
      const stop = stopRe.exec(tail);
      const chunk = stop ? tail.slice(0, stop.index) : tail;
      const lines = chunk.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      return parseAddressLines(lines);
    }
    return {};
  }

  // ===== Block parsers =====

  // "Business-Verkäufer" / "Impressum & Info zum Verkäufer" — structured key:value
  function parseBusinessVerkauferBlock(text) {
    const out = {};
    if (!text) return out;
    const map = [
      ["business_name", /(?:Gesch[äa]ftsname|Business\s+name|Nom\s+commercial|Nazwa\s+firmy)[:\s]*([^\n]+)/i],
      ["business_type", /(?:Gesch[äa]ftsart|Business\s+type|Tipo\s+di\s+attività|Rodzaj\s+działalności)[:\s]*([^\n]+)/i],
      ["brand", /(?:Marke|Brand|Marque)[:\s]*([^\n]+)/i],
    ];
    for (const [key, re] of map) {
      const m = re.exec(text);
      if (m) out[key] = clean(m[1]);
    }
    Object.assign(out, extractIds(text), extractContact(text));
    // Address sections
    const business = extractAddressAfterLabel(text, [
      /\n\s*Gesch[äa]ftsadresse\s*:?\s*\n/i,
      /\n\s*Business\s+address\s*:?\s*\n/i,
    ]);
    const cs = extractAddressAfterLabel(text, [
      /\n\s*Kundendienst[-\s]?adresse\s*:?\s*\n/i,
      /\n\s*Customer\s+service\s+address\s*:?\s*\n/i,
    ]);
    Object.assign(out, business);
    if (cs.street) {
      out.cs_street = cs.street;
      out.cs_postal_code = cs.postal_code || "";
      out.cs_city = cs.city || "";
      out.cs_region = cs.region || "";
      out.cs_country = cs.country || "";
    }
    return out;
  }

  // "Gesetzliche Anbieterkennung" / "Impressum" — free-text legal notice
  function parseLegalBlock(text) {
    const out = {};
    if (!text) return out;
    Object.assign(out, extractIds(text), extractContact(text));
    // First non-empty line is usually the company name (if not already set)
    const lines = tidyMultiline(text).split(/\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length && !/^(diese|vertr|gesch[äa]ftsf|tel|fax|e-?mail|ust|umsatz|weee|handelsreg|eingetragen|alternative|plattform)/i.test(lines[0])) {
      out.business_name = lines[0];
    }
    // Address heuristic: take consecutive 2-4 lines after representative or company line,
    // until first labeled line (Tel/Fax/Email/USt/WEEE...)
    const stopLabel = /^(tel\.|telefon|telefax|fax|e-?mail|ust|usti|umsatz|weee|handelsreg|eingetragen|alternative|plattform|diese\s+vertr|vertr\.|gesch[äa]ftsf)/i;
    let addrStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) continue;
      if (stopLabel.test(lines[i])) continue;
      // Use first non-labeled, non-rep line as address start
      if (!/^(diese|vertr)/i.test(lines[i])) { addrStart = i; break; }
    }
    if (addrStart > 0) {
      const addrLines = [];
      for (let i = addrStart; i < lines.length && addrLines.length < 5; i++) {
        if (stopLabel.test(lines[i])) break;
        addrLines.push(lines[i]);
      }
      Object.assign(out, parseAddressLines(addrLines));
    }
    return out;
  }

  // Customer-vs-Business address comparison — flags potential agency / warehouse
  function cmpCsBusiness(parsed) {
    if (!parsed.cs_street || !parsed.street) return null;
    const norm = s => clean(s || "").toLowerCase().replace(/str(\.|asse|aße)/, "str");
    const sameStreet = norm(parsed.cs_street) === norm(parsed.street);
    const samePostal = clean(parsed.cs_postal_code || "") === clean(parsed.postal_code || "");
    const sameCity = norm(parsed.cs_city) === norm(parsed.city);
    return !(sameStreet && samePostal && sameCity);
  }

  // ===== Main capture flow =====

  async function capture() {
    try {
      show("info", await t("toast_capturing"));

      const sellerId = getSellerIdFromUrl();
      if (!sellerId) throw new Error("seller_id missing from URL");

      const node = findSellerInfoNode();
      const rawText = tidyMultiline(node.innerText || "");
      const pageText = tidyMultiline(document.body.innerText || "");

      const legalBlock = extractBlockByHeading(rawText, [
        "Gesetzliche Anbieterkennung", "Impressum", "Anbieterkennzeichnung"
      ]) || extractBlockByHeading(pageText, [
        "Gesetzliche Anbieterkennung", "Impressum", "Anbieterkennzeichnung"
      ]);

      const bvBlock = extractBlockByHeading(rawText, [
        "Business-Verkäufer", "Impressum\\s*&\\s*Info zum Verkäufer", "Info zum Verkäufer"
      ]) || extractBlockByHeading(pageText, [
        "Business-Verkäufer", "Impressum\\s*&\\s*Info zum Verkäufer", "Info zum Verkäufer"
      ]);

      const fromLegal = parseLegalBlock(legalBlock || "");
      const fromBV = parseBusinessVerkauferBlock(bvBlock || "");

      // Merge: Business-Verkäufer wins for structured fields (street/postal/city/region),
      // Legal block wins for unique-to-legal fields (representative_name, WEEE, fax).
      const parsed = {};
      const keys = new Set([...Object.keys(fromLegal), ...Object.keys(fromBV)]);
      for (const k of keys) {
        const prefBV = ["street", "city", "region", "postal_code", "country", "business_name", "business_type", "phone", "email"];
        const prefLegal = ["representative_name", "weee_number", "phone_alt", "email_alt", "epr_id"];
        if (prefBV.includes(k)) parsed[k] = fromBV[k] || fromLegal[k] || "";
        else if (prefLegal.includes(k)) parsed[k] = fromLegal[k] || fromBV[k] || "";
        else parsed[k] = fromBV[k] || fromLegal[k] || "";
      }

      // Cross-check: regulated IDs (VAT/WEEE/HRB) — if not found in blocks, scan page-wide
      const pageIds = extractIds(pageText);
      for (const k of ["vat_number", "weee_number", "trade_register_number", "epr_id"]) {
        if (!parsed[k] && pageIds[k]) parsed[k] = pageIds[k];
      }

      parsed.brand = getBrand();
      parsed.asin = getAsin() || "";

      // Flag if customer service address materially differs from business address
      const csDiffers = cmpCsBusiness(parsed);
      if (csDiffers != null) parsed.cs_differs = csDiffers;

      // GPSR raw text — separate forensic capture
      const gpsrLabels = ["sicherheitsinformationen", "safety information", "informations de sécurité",
                          "informazioni di sicurezza", "información de seguridad",
                          "informacje dotyczące bezpieczeństwa", "verantwortliche person", "responsible person"];
      let gpsrRaw = null;
      const lowerPage = pageText.toLowerCase();
      for (const lbl of gpsrLabels) {
        const idx = lowerPage.indexOf(lbl);
        if (idx >= 0) { gpsrRaw = pageText.slice(idx, idx + 1200); break; }
      }

      const payload = {
        seller_id: sellerId,
        marketplace: detectMarketplace(),
        url: location.href,
        captured_at: new Date().toISOString(),
        parsed,
        raw_text: rawText.slice(0, 8000),
        legal_block_raw: legalBlock || "",
        bv_block_raw: bvBlock || "",
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
