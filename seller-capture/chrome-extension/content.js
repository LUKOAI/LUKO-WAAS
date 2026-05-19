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
// Amazon's SPA navigation occasionally causes Chrome to re-inject content
// scripts into the same document. Without this guard each re-injection
// registers its own onMessage listener, so one Alt+S triggers 5-6 captures
// in parallel — visible as a swarm of toasts plus duplicate rows in BQ.
if (window.__lukoCaptureLoaded) {
  // Already initialized on this page; let the original instance handle events.
} else {
  window.__lukoCaptureLoaded = true;
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

  // Seller's storefront display name — h1#seller-name on Amazon. This is the name
  // shown to buyers (e.g. "AnkerDirect DE", "apodiscounter", "Utopia Brands") and is
  // distinct from `brand` (the actual product brand, which appears on product detail
  // pages as "Marke" — NOT available on the seller profile page).
  function getSellerDisplayName() {
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

  // ===== DOM-based address extraction (most reliable for Amazon's structured HTML) =====
  //
  // Amazon renders Business-Verkäufer addresses as:
  //   <div class="a-row"><span class="a-text-bold">Geschäftsadresse:</span></div>
  //   <div class="a-row indent-left"><span>STREET</span></div>
  //   <div class="a-row indent-left"><span>CITY</span></div>
  //   ... etc
  // We find the label span by text match, then walk DOM siblings collecting
  // address lines. This is more robust than parsing innerText regex (which can
  // miss when Amazon renders without expected whitespace).
  function findAddressBlockInDOM(labelTexts) {
    const labelRe = new RegExp("^\\s*(" + labelTexts.join("|") + ")\\s*:?\\s*$", "i");
    const allBoldSpans = document.querySelectorAll(
      "span.a-text-bold, span[class*='bold'], b, strong"
    );
    for (const span of allBoldSpans) {
      const txt = (span.textContent || "").replace(/\s+/g, " ").trim();
      if (!labelRe.test(txt)) continue;
      // Find ancestor row div
      const labelRow = span.closest("div.a-row") || span.parentElement;
      if (!labelRow) continue;
      // Collect following sibling divs that contain address lines.
      // Stop conditions (any one of):
      //   - bold label in next sibling (= next section starts)
      //   - text > 200 chars (= narrative paragraph, e.g. Amazon disclaimer)
      //   - text starts with known disclaimer / legal phrases
      //   - 6 lines collected (max sensible address depth)
      const DISCLAIMER_RE = /^(Dieser\s+Verk[äa]ufer|This\s+seller|Ce\s+vendeur|Este\s+vendedor|Questo\s+venditore|Bei\s+Fragen|Falls\s+nicht|Amazon\s+ist)/i;
      const lines = [];
      let next = labelRow.nextElementSibling;
      while (next && lines.length < 6) {
        const hasNextLabel = next.querySelector && next.querySelector(
          "span.a-text-bold, span[class*='bold'], b, strong"
        );
        if (hasNextLabel) break;
        const text = (next.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) { next = next.nextElementSibling; continue; }
        if (text.length > 200) break;
        if (DISCLAIMER_RE.test(text)) break;
        lines.push(text);
        next = next.nextElementSibling;
      }
      if (lines.length) return parseAddressLines(lines);
    }
    return {};
  }


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
  // HRB / KvK / Companies House / etc. — label-based: capture whatever follows the
  // "Handelsregisternummer:" label until line break. Tolerant of any value format:
  //   - "HRB 15487 FF" (German with prefix)
  //   - "8766135" (UK Companies House, pure digits)
  //   - "KvK 75699451" (Dutch)
  //   - "452484875" (US-like, pure digits)
  //
  // CRITICAL FIX: Previous pattern `register[-\s]?Nr(?:ummer)?` tried to match
  //   register + (optional space) + Nr + (optional "ummer") = "registerNr" or
  //   "registerNrummer", which fails on full word "registernummer" because after
  //   "register" comes "n" then "u" (not "Nr"). Now matches "nummer" as full alt.
  const RE_HRB = /Handelsregister(?:nummer|[-\s]?Nr\.?)\.?[:\s]+([^\n<]{1,80}?)(?:\s*(?:\n|$|<))/i;
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

  // ===== Address parsing — content-based (NOT position-based) =====
  //
  // Different countries / sellers use wildly different address formats:
  //   DE 5-line:  Südstr 6 / Werneuchen / Brandenburg / 16356 / DE
  //   DE 4-line:  Ernst-Reuter-Str. 24 / Bergisch Gladbach / 51427 / DE
  //   DE 3-line:  Erich-Schlesinger-Str. 62 / 18059 Rostock / Deutschland
  //   PL 4-line:  Krzysztof Bochen / 1 Maja 18 / 63-507 Kobyla Góra / PL
  //   UK 6-line:  39 / Clarendon Road / WATFORD / Hertfordshire / WD17 1JA / GB
  //   NL 5-line:  Express 2 / Duiven / Liemers / 6921RB / NL
  //   US 5-line:  1151 BEAVER ST / BRISTOL / PA / 19007-3233 / US
  //
  // Position-based parsing fails on the variety. Content-based detection wins:
  //   country = matches country dictionary
  //   postal  = matches country-specific postal pattern
  //   street  = contains a digit (house number)
  //   city    = remaining no-digit line
  //   if first "street" line is JUST a number (e.g. UK "39"), combine with next
  function parseAddressLines(lines) {
    lines = lines.map(clean).filter(Boolean);
    // Dedupe (Amazon DOM sometimes renders address text in nested spans → walker
    // grabs duplicates). Preserve original order.
    const seen = new Set();
    lines = lines.filter(ln => { if (seen.has(ln)) return false; seen.add(ln); return true; });
    const out = {};
    if (!lines.length) return out;
    const used = new Set();

    // 1. Country — scan from end (country is conventionally last)
    let countryIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const c = normalizeCountry(lines[i]);
      if (c) { out.country = c; countryIdx = i; used.add(i); break; }
    }

    // 2. Postal code (possibly with city on same line)
    //    Country-specific patterns — strict enough to NOT match bare house numbers
    //    like "39" (UK street number on its own line).
    //      UK alphanumeric: "WD17 1JA"
    //      PL: "63-507" (2 digits + dash + 3 digits)
    //      DE/AT/CH/FR/IT/ES/etc.: 5 digits "12345"
    //      US: 5 digits, optionally +4 "12345-6789"
    //      CN: 6 digits "518000"
    //      NL: 4 digits + 2 letters "6921RB" or "6921 RB"
    const POSTAL_WITH_CITY = [
      /^([A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2})\s+(.+)$/i,    // UK: "WD17 1JA City"
      /^(\d{2}-\d{3})\s+(.+)$/,                            // PL: "63-507 City"
      /^(\d{5}(?:-\d{4})?)\s+(.+)$/,                       // DE/US: "12345 City" / "12345-6789 City"
      /^(\d{6})\s+(.+)$/,                                  // CN: "518000 City"
      /^(\d{4}\s*[A-Z]{2})\s+(.+)$/i,                      // NL: "1234AB City"
    ];
    const POSTAL_ALONE = [
      /^([A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2})$/i,            // UK
      /^(\d{2}-\d{3})$/,                                   // PL
      /^(\d{5}(?:-\d{4})?)$/,                              // DE/US
      /^(\d{6})$/,                                         // CN
      /^(\d{4}\s*[A-Z]{2})$/i,                             // NL
    ];
    let postalIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      let matched = false;
      for (const re of POSTAL_WITH_CITY) {
        const m = lines[i].match(re);
        if (m) {
          out.postal_code = m[1].trim();
          out.city = m[2].trim();
          postalIdx = i;
          used.add(i);
          matched = true;
          break;
        }
      }
      if (matched) break;
      for (const re of POSTAL_ALONE) {
        const m = lines[i].match(re);
        if (m) {
          out.postal_code = m[1].trim();
          postalIdx = i;
          used.add(i);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // 3. Street: line with a digit (house number)
    let streetIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      if (/\d/.test(lines[i])) {
        out.street = lines[i];
        streetIdx = i;
        used.add(i);
        break;
      }
    }
    // 3a. UK-style "39" / "Clarendon Road" — street is pure number, combine with next line
    if (out.street && /^\d+[a-z]?$/i.test(out.street) && streetIdx + 1 < lines.length) {
      const ni = streetIdx + 1;
      if (!used.has(ni) && lines[ni] && !/^\d/.test(lines[ni])) {
        out.street = (out.street + " " + lines[ni]).trim();
        used.add(ni);
      }
    }

    // 4. City — first remaining no-digit line (skipped if postal+city set city already)
    if (!out.city) {
      for (let i = 0; i < lines.length; i++) {
        if (used.has(i)) continue;
        if (!/\d/.test(lines[i])) {
          out.city = lines[i];
          used.add(i);
          break;
        }
      }
    }

    // 5. address_line_2 — lines BEFORE street (typically owner name for sole-proprietor
    //    sellers like PL "Krzysztof Bochen", or extra business descriptor above address).
    if (streetIdx > 0) {
      const beforeStreet = [];
      for (let i = 0; i < streetIdx; i++) {
        if (used.has(i)) continue;
        beforeStreet.push(lines[i]);
        used.add(i);
      }
      if (beforeStreet.length) out.address_line_2 = beforeStreet.join(" | ");
    }

    // 6. Region — first no-digit unused line BETWEEN street and (postal or country).
    //    For EU 5-line "street/city/region/postal/country" gets us Brandenburg / Hertfordshire.
    const endIdx = Math.min(
      countryIdx >= 0 ? countryIdx : lines.length,
      postalIdx >= 0 ? postalIdx : lines.length
    );
    for (let i = (streetIdx >= 0 ? streetIdx + 1 : 0); i < endIdx; i++) {
      if (used.has(i)) continue;
      if (!/\d/.test(lines[i])) {
        out.region = lines[i];
        used.add(i);
        break;
      }
    }

    // 7. Any remaining unused → append to address_line_2 (catchall for extras)
    const remain = [];
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      remain.push(lines[i]);
    }
    if (remain.length) {
      out.address_line_2 = out.address_line_2
        ? out.address_line_2 + " | " + remain.join(" | ")
        : remain.join(" | ");
    }

    return out;
  }

  // From a structured block (Business-Verkäufer), pull the sub-section after a label
  // such as "Geschäftsadresse" / "Kundendienstadresse" — read lines until blank line
  // or the next labeled section starts.
  //
  // Tolerates 3 layouts:
  //   "Geschäftsadresse:\n<line1>\n<line2>..."         — clean newline after colon
  //   "Geschäftsadresse: <line1>\n<line2>..."          — content on same line
  //   "<prev>\nGeschäftsadresse:<line1 immediately>"   — no whitespace after colon
  function extractAddressAfterLabel(blockText, labels) {
    const text = tidyMultiline(blockText || "");
    for (const labelRe of labels) {
      // labelRe is a string identifying the label (e.g. "Geschäftsadresse" or "Geschaeftsadresse")
      // We build a tolerant regex around it.
      const re = new RegExp("(^|\\n)\\s*" + labelRe + "\\s*:?\\s*", "i");
      const m = re.exec(text);
      if (!m) continue;
      const start = m.index + m[0].length;
      const tail = text.slice(start);
      // Stop at: blank line, OR next labeled section header
      const stopRe = /\n\s*\n|\n\s*(?:Gesch[äa]ftsadresse|Kundendienst[-\s]?adresse|Customer\s+service\s+address|Business\s+address|Impressum|Datenschutz(?:erkl[äa]rung)?|Versandinformationen|Telefonnummer|Telefon|Telefax|Fax|E-?Mail|UStID|USt-?IdNr|WEEE|Handelsregister|Gesch[äa]ftsart|Gesch[äa]ftsname|Brand|Marke|Alternative\s+Streitbeilegung|Plattform\s+der\s+EU)\s*[:.]/i;
      const stop = stopRe.exec(tail);
      const chunk = stop ? tail.slice(0, stop.index) : tail;
      const DISCLAIMER_RE = /^(Dieser\s+Verk[äa]ufer|This\s+seller|Ce\s+vendeur|Este\s+vendedor|Questo\s+venditore|Bei\s+Fragen|Falls\s+nicht|Amazon\s+ist)/i;
      const cleanedLines = [];
      for (const ln of chunk.split(/\n/).map(s => s.trim())) {
        if (!ln) continue;
        if (ln.length > 200) break;
        if (DISCLAIMER_RE.test(ln)) break;
        cleanedLines.push(ln);
        if (cleanedLines.length >= 6) break;
      }
      if (cleanedLines.length === 0) continue;
      const parsed = parseAddressLines(cleanedLines);
      // Sanity check: address must have at least one of postal_code OR country to count
      if (parsed.postal_code || parsed.country) return parsed;
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
    // Address sections — labels passed as plain strings (function builds tolerant regex)
    const business = extractAddressAfterLabel(text, [
      "Gesch[äa]ftsadresse", "Business\\s+address",
    ]);
    const cs = extractAddressAfterLabel(text, [
      "Kundendienst[-\\s]?adresse", "Customer\\s+service\\s+address",
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

  // "Gesetzliche Anbieterkennung" / "Impressum" — free-text legal notice.
  // CRITICAL: validate the block actually looks like an impressum (has Geschäftsführer
  // / USt-IdNr / Telefon: / E-Mail: / WEEE labels) before parsing address from it.
  // Without this validation, Amazon's site nav footer text (Geld verdienen mit Amazon,
  // Verkaufen bei Amazon Handmade, etc.) gets mistaken for an address — a real bug we
  // hit on first US/CN seller captures.
  function parseLegalBlock(text) {
    const out = {};
    if (!text) return out;

    const looksLikeImpressum = /\b(Gesch[äa]ftsf[üu]hrer|USt[-\s]*Id[-\s]*Nr|UStID|Telefon\s*[:.]|Telefax\s*[:.]|E[-\s]*Mail\s*[:.]|WEEE[-\s]*Reg|Handelsregister(?:nummer)?\s*[:.]?|vertr\.?\s*d\.?\s*d\.?)/i.test(text);

    // Always safe: regex extraction of IDs and contact (only matches if labels present).
    Object.assign(out, extractIds(text), extractContact(text));

    if (!looksLikeImpressum) return out;

    // First non-empty line is usually the company name (if not already set)
    const lines = tidyMultiline(text).split(/\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length && !/^(diese|vertr|gesch[äa]ftsf|tel|fax|e-?mail|ust|umsatz|weee|handelsreg|eingetragen|alternative|plattform)/i.test(lines[0])) {
      out.business_name = lines[0];
    }
    // Address heuristic: take 2-4 consecutive non-labeled lines after representative
    // line (or after company name), until first labeled line.
    const stopLabel = /^(tel\.|telefon|telefax|fax|e-?mail|ust|usti|umsatz|weee|handelsreg|eingetragen|alternative|plattform|diese\s+vertr|vertr\.|gesch[äa]ftsf)/i;
    let addrStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) continue;
      if (stopLabel.test(lines[i])) continue;
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

      // PRIMARY address extraction: DOM-based (most reliable for Amazon HTML).
      // Amazon renders address as a sequence of <div class="indent-left"> divs after
      // a label span — easier to walk DOM than parse innerText regex.
      const domBusiness = findAddressBlockInDOM(["Geschäftsadresse", "Geschaeftsadresse", "Business address"]);
      if (domBusiness.street) {
        Object.assign(fromBV, domBusiness);
      }
      const domCS = findAddressBlockInDOM(["Kundendienstadresse", "Kundendienst-Adresse", "Customer service address"]);
      if (domCS.street) {
        fromBV.cs_street = domCS.street;
        fromBV.cs_postal_code = domCS.postal_code || "";
        fromBV.cs_city = domCS.city || "";
        fromBV.cs_region = domCS.region || "";
        fromBV.cs_country = domCS.country || "";
      }

      // Address fallback (regex-on-text): if DOM-based + BV block parsing both missed
      // (e.g. block extraction got truncated by an aggressive stop pattern), re-scan
      // the FULL seller-info section. These labels are unique enough to search globally.
      if (!fromBV.street) {
        const addr = extractAddressAfterLabel(rawText, [
          "Gesch[äa]ftsadresse", "Business\\s+address",
        ]);
        if (addr.street) Object.assign(fromBV, addr);
      }
      if (!fromBV.cs_street) {
        const cs = extractAddressAfterLabel(rawText, [
          "Kundendienst[-\\s]?adresse", "Customer\\s+service\\s+address",
        ]);
        if (cs.street) {
          fromBV.cs_street = cs.street;
          fromBV.cs_postal_code = cs.postal_code || "";
          fromBV.cs_city = cs.city || "";
          fromBV.cs_region = cs.region || "";
          fromBV.cs_country = cs.country || "";
        }
      }
      // If still no address but we have BV signals, do a last-ditch search on pageText
      if (!fromBV.street) {
        const addr = extractAddressAfterLabel(pageText, [
          "Gesch[äa]ftsadresse", "Business\\s+address",
        ]);
        if (addr.street) Object.assign(fromBV, addr);
      }
      // If we have CS but no Geschäftsadresse, copy CS as fallback (better than empty;
      // they're identical for ~80% of sellers anyway).
      if (!fromBV.street && fromBV.cs_street) {
        fromBV.street = fromBV.cs_street;
        fromBV.postal_code = fromBV.cs_postal_code;
        fromBV.city = fromBV.cs_city;
        fromBV.region = fromBV.cs_region;
        fromBV.country = fromBV.cs_country;
      }

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

      parsed.seller_name = getSellerDisplayName();
      // `brand` (actual product brand from Amazon "Marke" field) requires a product
      // page capture — leave empty here. Will be populated by a separate feature later.
      parsed.brand = "";
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
      // Two layers of dedupe response:
      //   1) Background-side per-seller debounce → resp.deduped (no server hit).
      //   2) Server-side per-(seller, cluster_anchor) dedupe → resp.result.deduped.
      if (resp.deduped) {
        show("info", "Already captured a moment ago — skipped.", 3500);
        return;
      }
      const r = resp.result || {};
      if (r.deduped && r.reason === 'already_captured_in_cluster') {
        const anchor = r.cluster_anchor || 'this cluster';
        show("info",
          `Already captured for "${anchor}" (on ${(r.previous_captured_at || '').slice(0, 10)}) — skipped.`,
          6000);
        return;
      }
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
    if (!msg) return;
    if (msg.type === "TRIGGER_CAPTURE") capture();
    if (msg.type === "TOAST") {
      show(msg.level || 'info', msg.text || '', msg.duration || 4500);
    }
  });
  window.__lukoCapture = capture;
})();
}  // end of __lukoCaptureLoaded guard
