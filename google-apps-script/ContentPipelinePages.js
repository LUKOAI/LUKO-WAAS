/**
 * WAAS Content Pipeline — Pages & Logo Generation
 * 
 * Handles: HOMEPAGE, ABOUT_PAGE, BRAND_PROFILE, CROSS_LINK_PAGE, CATEGORY_PAGE
 * Plus: Logo + Favicon generation workflow
 * 
 * File: ContentPipelinePages.gs
 */


// ============================================================================
// LOGO + FAVICON GENERATION
// ============================================================================

/**
 * Generates logo + favicon prompts and adds to Media Queue.
 * Reads site data from Sites sheet.
 * Menu: WAAS → 🖼️ Images → 🎨 Generate Logo
 */
function cpGenerateLogo() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('🎨 Logo Generator',
    'Podaj domenę (np. reservekanister.lk24.shop):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ Site not found: ' + domain); return; }
  
  // Read extra data from Sites sheet
  var sitesSheet = ss.getSheetByName('Sites');
  var sitesData = sitesSheet.getDataRange().getValues();
  var sHeaders = sitesData[0];
  var sCol = {};
  sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var siteRow = null;
  for (var r = 1; r < sitesData.length; r++) {
    if ((sitesData[r][sCol['Domain'] || 2] || '').toString().trim() === domain) {
      siteRow = sitesData[r]; break;
    }
  }
  
  var siteName = site.name || domain.split('.')[0];
  var niche = (siteRow && sCol['Niche_Description'] !== undefined) 
    ? (siteRow[sCol['Niche_Description']] || '').toString() : '';
  var primaryColor = (siteRow && sCol['Primary_Color'] !== undefined)
    ? (siteRow[sCol['Primary_Color']] || '#EF6C00').toString() : '#EF6C00';
  
  // Build logo prompt
  var logoPrompt = 'Create a clean, modern, professional logo for "' + siteName + '". ' +
    'This is a German product review and buying guide website' +
    (niche ? ' specializing in ' + niche : '') + '. ' +
    'Design requirements: ' +
    '- Text-based logo with the name "' + siteName + '" prominently displayed. ' +
    '- Clean sans-serif or modern serif font. ' +
    '- Primary color: ' + primaryColor + ' (use as accent, not full background). ' +
    '- Simple icon/symbol related to the niche (optional, left or above text). ' +
    '- Transparent background (PNG). ' +
    '- Horizontal layout, suitable for website header (aspect ratio ~3:1). ' +
    '- Professional, trustworthy, German market aesthetic. ' +
    '- NO gradients, NO complex illustrations, NO stock photo elements. ' +
    '- White/dark text readable on both light and dark backgrounds.';
  
  var faviconPrompt = 'Create a simple, bold favicon/icon for "' + siteName + '". ' +
    'Design: ' +
    '- Use the first letter "' + siteName.charAt(0).toUpperCase() + '" or a simple symbol from the niche' +
    (niche ? ' (' + niche + ')' : '') + '. ' +
    '- Primary color: ' + primaryColor + '. ' +
    '- Square format, works at 32x32px and 512x512px. ' +
    '- Bold, high contrast, recognizable at small sizes. ' +
    '- Solid background or transparent. ' +
    '- NO text beyond single letter, NO fine details.';
  
  // Add to Media Queue
  var mqSheet = ss.getSheetByName('Media Queue_CP');
  if (!mqSheet) { ui.alert('❌ Media Queue_CP not found'); return; }
  
  var mqHeaders = mqSheet.getRange(1, 1, 1, mqSheet.getLastColumn()).getValues()[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  var siteSlug = domain.split('.')[0];
  var logoId = 'LOGO-' + siteSlug.toUpperCase();
  var faviconId = 'FAV-' + siteSlug.toUpperCase();
  
  // Check if already exists
  var mqData = mqSheet.getDataRange().getValues();
  for (var r = 1; r < mqData.length; r++) {
    var mid = (mqData[r][mqCol['Media_ID']] || '').toString();
    if (mid === logoId || mid === faviconId) {
      ui.alert('⚠️ Logo/Favicon prompts already exist for ' + domain + '.\nCheck Media Queue.');
      return;
    }
  }
  
  // Add LOGO row
  var nextRow = mqSheet.getLastRow() + 1;
  var logoRow = new Array(mqHeaders.length).fill('');
  logoRow[mqCol['Media_ID']] = logoId;
  logoRow[mqCol['Content_ID']] = 'SITE-' + siteSlug.toUpperCase();
  logoRow[mqCol['Media_Type']] = 'LOGO';
  logoRow[mqCol['Alt_Text']] = siteName + ' Logo';
  logoRow[mqCol['Image_Title']] = 'Logo ' + siteName;
  logoRow[mqCol['AI_Image_Prompt']] = logoPrompt;
  logoRow[mqCol['Filename']] = 'logo-' + siteSlug + '.png';
  logoRow[mqCol['Dimensions']] = '1200x400';
  logoRow[mqCol['Status']] = '⏳ Pending';
  if (mqCol['AI_Target'] !== undefined) logoRow[mqCol['AI_Target']] = 'Grok';
  
  mqSheet.getRange(nextRow, 1, 1, logoRow.length).setValues([logoRow]);
  
  // Add FAVICON row
  nextRow = mqSheet.getLastRow() + 1;
  var favRow = new Array(mqHeaders.length).fill('');
  favRow[mqCol['Media_ID']] = faviconId;
  favRow[mqCol['Content_ID']] = 'SITE-' + siteSlug.toUpperCase();
  favRow[mqCol['Media_Type']] = 'FAVICON';
  favRow[mqCol['Alt_Text']] = siteName + ' Favicon';
  favRow[mqCol['Image_Title']] = 'Favicon ' + siteName;
  favRow[mqCol['AI_Image_Prompt']] = faviconPrompt;
  favRow[mqCol['Filename']] = 'favicon-' + siteSlug + '.png';
  favRow[mqCol['Dimensions']] = '512x512';
  favRow[mqCol['Status']] = '⏳ Pending';
  if (mqCol['AI_Target'] !== undefined) favRow[mqCol['AI_Target']] = 'Grok';
  
  mqSheet.getRange(nextRow, 1, 1, favRow.length).setValues([favRow]);
  
  ui.alert('🎨 Logo + Favicon prompts added to Media Queue!\n\n' +
    '📋 Logo: ' + logoId + '\n📋 Favicon: ' + faviconId + '\n\n' +
    'Następne kroki:\n' +
    '1. WAAS → Images → 🎨 Generate Images (API) — generuje obrazy\n' +
    '2. WAAS → Images → 📤 Upload to WordPress — uploaduje\n' +
    '3. Wpisz WP Media ID w Sites sheet → Logo_Media_ID / Favicon_Media_ID\n' +
    '4. WAAS → Content Pipeline → 🎨 Set Branding — ustawia w Divi');
}


/**
 * Auto-deploy logo + favicon after upload.
 * Finds LOGO/FAVICON entries in Media Queue with status "📤 Uploaded",
 * reads WP_Media_ID, updates Sites sheet, calls set-branding endpoint.
 * Menu: WAAS → 🖼️ Images → 🚀 Deploy Branding
 */
function cpDeployBranding() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var mqSheet = ss.getSheetByName('Media Queue_CP');
  if (!mqSheet) { ui.alert('❌ Media Queue_CP not found'); return; }
  
  var mqData = mqSheet.getDataRange().getValues();
  var mqHeaders = mqData[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  var sitesSheet = ss.getSheetByName('Sites');
  var sitesData = sitesSheet.getDataRange().getValues();
  var sHeaders = sitesData[0];
  var sCol = {};
  sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var deployed = 0;
  var errors = [];
  var processed = {}; // track domains already processed
  
  for (var r = 1; r < mqData.length; r++) {
    var row = mqData[r];
    var mediaType = (row[mqCol['Media_Type']] || '').toString();
    var status = (row[mqCol['Status']] || '').toString();
    var wpMediaId = parseInt(row[mqCol['WP_Media_ID']] || 0);
    
    if ((mediaType !== 'LOGO' && mediaType !== 'FAVICON') || !wpMediaId) continue;
    if (status === '🎨 Branding Set') continue; // Already deployed
    if (status !== '📤 Uploaded' && status !== '✅ Ready') continue;
    
    // Extract domain from Content_ID: SITE-RESERVEKANISTER → reservekanister
    var contentId = (row[mqCol['Content_ID']] || '').toString();
    var siteSlug = contentId.replace('SITE-', '').toLowerCase();
    
    // Find domain in Sites sheet
    var siteRowIdx = -1;
    var domain = '';
    for (var s = 1; s < sitesData.length; s++) {
      var d = (sitesData[s][sCol['Domain'] || 2] || '').toString().trim();
      if (d.indexOf(siteSlug) >= 0) {
        siteRowIdx = s;
        domain = d;
        break;
      }
    }
    
    if (siteRowIdx < 0) { errors.push(siteSlug + ': domain not found in Sites'); continue; }
    
    // Update Sites sheet with Media IDs
    var sheetRow = siteRowIdx + 1;
    if (mediaType === 'LOGO' && sCol['Logo_Media_ID'] !== undefined) {
      sitesSheet.getRange(sheetRow, sCol['Logo_Media_ID'] + 1).setValue(wpMediaId);
      var wpUrl = (row[mqCol['WP_Media_URL']] || '').toString();
      if (wpUrl && sCol['Logo_WP_URL'] !== undefined) {
        sitesSheet.getRange(sheetRow, sCol['Logo_WP_URL'] + 1).setValue(wpUrl);
      }
    }
    if (mediaType === 'FAVICON' && sCol['Favicon_Media_ID'] !== undefined) {
      sitesSheet.getRange(sheetRow, sCol['Favicon_Media_ID'] + 1).setValue(wpMediaId);
    }
    
    // Call set-branding if not already done for this domain
    if (!processed[domain]) {
      var site = cpGetSiteData(domain);
      if (site) {
        var wpBaseUrl = site.wpUrl || ('https://' + domain);
        try {
          var auth = cpGetWPAuthForMedia(site, wpBaseUrl);
          if (auth.cookies && auth.nonce) {
            var logoId = 0;
            var favId = 0;
            
            // Find all LOGO/FAVICON media IDs for this domain
            for (var rr = 1; rr < mqData.length; rr++) {
              var cid = (mqData[rr][mqCol['Content_ID']] || '').toString();
              if (cid !== contentId) continue;
              var mt = (mqData[rr][mqCol['Media_Type']] || '').toString();
              var mid = parseInt(mqData[rr][mqCol['WP_Media_ID']] || 0);
              if (mt === 'LOGO' && mid) logoId = mid;
              if (mt === 'FAVICON' && mid) favId = mid;
            }
            
            var primaryColor = (sitesData[siteRowIdx][sCol['Primary_Color'] !== undefined ? sCol['Primary_Color'] : -1] || '').toString();
            
            var payload = { logo_alt: site.name || domain };
            if (logoId) payload.logo_media_id = logoId;
            if (favId) payload.favicon_media_id = favId;
            if (primaryColor) payload.primary_color = primaryColor;
            
            var response = UrlFetchApp.fetch(wpBaseUrl + '/wp-json/waas-pipeline/v1/set-branding', {
              method: 'POST',
              headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce, 'Content-Type': 'application/json' },
              payload: JSON.stringify(payload),
              muteHttpExceptions: true,
            });
            
            if (response.getResponseCode() === 200) {
              deployed++;
              processed[domain] = true;
            } else {
              errors.push(domain + ': HTTP ' + response.getResponseCode());
            }
          }
        } catch(e) {
          errors.push(domain + ': ' + e.message);
        }
      }
    }
    
    // Mark as deployed in Media Queue
    mqSheet.getRange(r + 1, mqCol['Status'] + 1).setValue('🎨 Branding Set');
  }
  
  var msg = '🎨 Branding Deploy\n\n✅ Deployed: ' + deployed + ' sites';
  if (errors.length > 0) msg += '\n\n❌ Errors:\n' + errors.join('\n');
  ui.alert(msg);
}


// ============================================================================
// PAGE CONTENT STRUCTURES — extend cpGetContentStructure
// ============================================================================

/**
 * Returns content structure instructions for page types.
 * Call this from cpGetContentStructure if type starts with page-specific prefix.
 */
function cpGetPageStructure(type) {
  var structures = {
    'HOMEPAGE': 
      'SEITENTYP: Homepage (Divi Page, NOT blog post)\n' +
      'Aufbau:\n' +
      '1. HERO: Headline (H1) mit Site-Name + Nische. Untertitel (1 Satz). CTA-Button "Ratgeber ansehen"\n' +
      '2. ANLEITUNGEN/RATGEBER: 3-4 Karten mit Titel + Kurzbeschreibung + "Mehr erfahren" Link\n' +
      '3. FEATURED PRODUCTS: 4 Top-Produkte aus dem Shop (nur Titel+Preis+Link)\n' +
      '4. BLOG PREVIEW: "Neu im Blog" mit 2-3 Teaser\n' +
      '5. VALUE PROPOSITIONS: 3-4 Icons mit Kurztext (Praxiserprobt, Kaufberatung, Qualität, etc.)\n' +
      '6. CATEGORY LINKS: Buttons zu Hauptkategorien\n' +
      'KEIN Fazit-Box. KEINE Produktshortcodes. NUR Texte und Platzhalter-Links.\n' +
      'Wortanzahl: 300-500 (kurz und knackig, kein Fließtext-Aufsatz).\n' +
      'JSON sections: [{type:"hero",heading:"...",content_html:"..."},{type:"text",heading:"Anleitungen",...},...]\n' +
      'KEINE FAQ. KEINE Produkt-Shortcodes.',

    'CATEGORY_PAGE':
      'SEITENTYP: Kategorie-Landingpage\n' +
      'Aufbau:\n' +
      '1. HEADER: Kategorie-Name als H1 + 2-3 Sätze Einführung\n' +
      '2. BESCHREIBUNG: 150-300 Wörter Fließtext über diese Kategorie\n' +
      '3. WAS SIE FINDEN: Kurze Auflistung der Themen/Artikel in dieser Kategorie\n' +
      '4. CTA: "Alle [Kategorie] ansehen" Button\n' +
      'KEIN Fazit. KEINE Produkt-Shortcodes. KEIN FAQ.\n' +
      'Wortanzahl: 200-400.\n' +
      'Ton: einladend, informativ, SEO-optimiert.',

    'BRAND_PROFILE':
      'SEITENTYP: Markenprofil / Patron-Seite\n' +
      'Aufbau:\n' +
      '1. HERO: "Unser Partner: [Markenname]" — Logo-Platzhalter + Slogan\n' +
      '2. ÜBER DIE MARKE: 200-300 Wörter Geschichte, Philosophie, Sortiment\n' +
      '3. STATISTIKEN: Bewertungen, Produkte, Verkäufe (nur wenn in Notes angegeben!)\n' +
      '4. WARUM WIR EMPFEHLEN: 3-4 Gründe als Karten (Preis-Leistung, Qualität, Sortiment, Bewertungen)\n' +
      '5. TOP PRODUKTE: 3-4 Bestseller mit Shortcodes\n' +
      '6. PARTNERSCHAFT: "Unsere Partnerschaft" Erklärung + type:"fazit"\n' +
      'Wortanzahl: 500-800.',

    'ABOUT_PAGE':
      'SEITENTYP: Über diese Seite (mit 2 Varianten!)\n' +
      'Generiere EINE Version basierend auf dem Has_Patron Flag:\n\n' +
      'VARIANTE A (OHNE Patron — unabhängig):\n' +
      '1. H1: "Über [Site-Name]"\n' +
      '2. MISSION: "Wir sind ein unabhängiges Vergleichs- und Ratgeberportal für [Nische]"\n' +
      '3. WIE WIR ARBEITEN: Recherche, Tests, Erfahrung — transparent\n' +
      '4. TRANSPARENZ: Amazon Affiliate erklärt (kurz, ehrlich)\n' +
      '5. CTA: "Möchten Sie Ihr Produkt hier präsentieren? Kontaktieren Sie uns: support@netanaliza.com"\n\n' +
      'VARIANTE B (MIT Patron):\n' +
      '1. H1: "Über [Site-Name]"\n' +
      '2. PARTNER: "[Marke] ist offizieller Partner dieser Website"\n' +
      '3. WARUM: Qualität, Preis-Leistung, Erfahrung\n' +
      '4. UNABHÄNGIGKEIT: "Trotz Partnerschaft bleiben alle Bewertungen unabhängig"\n' +
      '5. CTA: "Sie möchten ebenfalls Partner werden? Kontakt: support@netanaliza.com"\n\n' +
      'In Notes steht: HAS_PATRON=true/false und PATRON_BRAND=Name\n' +
      'Wortanzahl: 300-500. Kein Fazit-Box. Keine Produkt-Shortcodes.',

    'CROSS_LINK_PAGE':
      'SEITENTYP: Werkzeug-Welt / Schwesterseiten-Übersicht\n' +
      'Aufbau:\n' +
      '1. H1: "Werkzeug-Welt" oder "[Nische]-Welt"\n' +
      '2. EINFÜHRUNG: 2-3 Sätze über das Netzwerk verwandter Seiten\n' +
      '3. KARTEN: Für jede Schwesterseite eine Karte:\n' +
      '   - Icon/Emoji + Name + 1 Satz Beschreibung + Link\n' +
      '   - Links aus Notes: "SISTER_SITES: domain1|Name1|Desc1, domain2|Name2|Desc2"\n' +
      '4. MARKENPROFIL: Link zum Markenprofil wenn vorhanden\n' +
      'KEIN Fazit. KEINE Produkt-Shortcodes. KEIN FAQ.\n' +
      'Wortanzahl: 200-400.',

    'CONTACT_PAGE':
      'SEITENTYP: Kontakt-Seite\n' +
      'Aufbau:\n' +
      '1. H1: "Kontakt"\n' +
      '2. TEXT: "Haben Sie Fragen, Anregungen oder Feedback? Kontaktieren Sie uns:"\n' +
      '3. EMAIL: support@netanaliza.com\n' +
      '4. PARTNERSCHAFTS-ANFRAGEN: "Möchten Sie Ihre Marke auf [Site-Name] präsentieren?"\n' +
      'Wortanzahl: 100-200. Minimalistisch.',
  };

  return structures[type] || null;
}


// ============================================================================
// PATCH: Extend cpGetContentStructure to include page types
// ============================================================================

/**
 * IMPORTANT: After adding this file, edit cpGetContentStructure() in 
 * ContentPipelineEngine.gs to add this BEFORE the return:
 * 
 *   // Check page types
 *   var pageStruct = cpGetPageStructure(type);
 *   if (pageStruct) return pageStruct;
 * 
 * So it becomes:
 * 
 *   function cpGetContentStructure(type) {
 *     // Check page types first
 *     var pageStruct = cpGetPageStructure(type);
 *     if (pageStruct) return pageStruct;
 *     
 *     const structures = { ... existing ... };
 *     return structures[type] || structures['TUTORIAL'];
 *   }
 */


// ============================================================================
// PATCH: Extend cpBuildTextPrompt for page types
// ============================================================================

/**
 * Builds a text prompt specifically for page content types.
 * Falls back to standard cpBuildTextPrompt for blog types.
 * 
 * IMPORTANT: In ContentPipelineEngine.gs, at the TOP of cpBuildTextPrompt(), add:
 * 
 *   // Page types use dedicated prompt builder
 *   var pageTypes = ['HOMEPAGE','CATEGORY_PAGE','BRAND_PROFILE','ABOUT_PAGE','CROSS_LINK_PAGE','CONTACT_PAGE'];
 *   if (pageTypes.indexOf(resolved.content_type) >= 0) {
 *     return cpBuildPagePrompt(resolved);
 *   }
 */
function cpBuildPagePrompt(c) {
  var siteName = '';
  var site = cpGetSiteData(c.domain || '');
  if (site) siteName = site.name || c.domain;
  
  var pageStructure = cpGetPageStructure(c.content_type);
  
  return 'CONTENT PIPELINE — PAGE CONTENT\n' +
    'Content-ID: ' + (c.cp_id || 'NEW') + '\n' +
    'WICHTIG: Generuj treść STRONY (nie blog post). Output: JSON z sections.\n\n' +
    '=== SYSTEM ===\n' +
    'Site: ' + (c.site_url || '') + '\n' +
    'Site-Name: ' + siteName + '\n' +
    'Sprache: DE (formell, "Sie")\n' +
    'Shortcode: [waas_product asin=\'ASIN\' layout=\'horizontal\'] (tylko jeśli potrzebny w tym typie strony)\n\n' +
    '=== QUALITÄTSREGELN ===\n' +
    'VERBOTEN: Erfundene Statistiken, Superlative ohne Beleg, Generische Phrasen\n' +
    'ERWÜNSCHT: Konkrete Details, E-E-A-T, professioneller Ton\n\n' +
    '=== SEITENTYP ===\n' +
    'Content_Type: ' + c.content_type + '\n' +
    (pageStructure || '') + '\n\n' +
    '=== KONTEXT ===\n' +
    'Arbeitstitel: "' + (c.working_title || '') + '"\n' +
    'Keyword: "' + (c.primary_keyword || '') + '"\n' +
    (c.secondary_keywords ? 'Sekundär: "' + c.secondary_keywords + '"\n' : '') +
    (c.problem_need ? 'Beschreibung: ' + c.problem_need + '\n' : '') +
    (c.target_audience ? 'Zielgruppe: ' + c.target_audience + '\n' : '') +
    (c.notes ? 'Operator-Hinweise (PRIORITÄT!): ' + c.notes + '\n' : '') +
    (c.product_asins ? 'ASINs: ' + c.product_asins + '\n' : '') +
    '\n=== OUTPUT FORMAT (JSON) ===\n' +
    '```json\n' +
    '{\n' +
    '  "article": {\n' +
    '    "final_title": "Seitentitel",\n' +
    '    "slug": "url-freundlich",\n' +
    '    "meta_description": "150-160 Zeichen",\n' +
    '    "seo_title": "SEO Titel | Site-Name",\n' +
    '    "focus_keyword": "hauptkeyword",\n' +
    '    "excerpt": "Kurzbeschreibung",\n' +
    '    "sections": [\n' +
    '      {"type": "hero", "heading": "H1 Titel", "content_html": "<p>Untertitel + CTA</p>"},\n' +
    '      {"type": "text", "heading": "Sektion 2", "content_html": "<p>...</p>"},\n' +
    '      {"type": "text", "heading": "Sektion 3", "content_html": "<p>...</p>"}\n' +
    '    ],\n' +
    '    "tags": "tag1, tag2",\n' +
    '    "word_count": 350\n' +
    '  }\n' +
    '}\n' +
    '```';
}


// ============================================================================
// QUICK PAGE GENERATOR — Create multiple pages for a site at once
// ============================================================================

/**
 * Generates Content Pipeline rows for all required site pages.
 * Creates rows for: HOMEPAGE, ABOUT_PAGE, CROSS_LINK_PAGE, CATEGORY_PAGE(s)
 * Menu: WAAS → Content Pipeline → 📄 Generate Site Pages
 */
function cpGenerateSitePages() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var resp = ui.prompt('📄 Generate Site Pages',
    'Podaj domenę (np. reservekanister.lk24.shop):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var domain = resp.getResponseText().trim();
  
  var site = cpGetSiteData(domain);
  if (!site) { ui.alert('❌ Site not found: ' + domain); return; }
  
  // Get site info from Sites sheet
  var sitesSheet = ss.getSheetByName('Sites');
  var sitesData = sitesSheet.getDataRange().getValues();
  var sHeaders = sitesData[0];
  var sCol = {};
  sHeaders.forEach(function(h, i) { sCol[h.toString().trim()] = i; });
  
  var siteRow = null;
  for (var r = 1; r < sitesData.length; r++) {
    if ((sitesData[r][sCol['Domain'] || 2] || '').toString().trim() === domain) {
      siteRow = sitesData[r]; break;
    }
  }
  
  var siteName = site.name || domain.split('.')[0];
  var niche = (siteRow && sCol['Niche_Description'] !== undefined) 
    ? (siteRow[sCol['Niche_Description']] || '').toString() : '';
  var hasPatron = (siteRow && sCol['Has_Patron'] !== undefined) 
    ? siteRow[sCol['Has_Patron']] === true : false;
  var patronBrand = (siteRow && sCol['Patron_Brand'] !== undefined) 
    ? (siteRow[sCol['Patron_Brand']] || '').toString() : '';
  
  // Define pages to create
  var pages = [
    {
      id_suffix: 'HP',
      content_type: 'HOMEPAGE',
      post_type: 'page',
      working_title: siteName + ' — Startseite',
      keyword: niche || siteName.toLowerCase(),
      notes: 'Nische: ' + niche + '. Erstelle eine einladende Startseite.',
      existing_slug: 'homepage',
    },
    {
      id_suffix: 'ABOUT',
      content_type: 'ABOUT_PAGE',
      post_type: 'page',
      working_title: 'Über ' + siteName,
      keyword: siteName.toLowerCase() + ' über uns',
      notes: 'HAS_PATRON=' + hasPatron + (patronBrand ? ' PATRON_BRAND=' + patronBrand : '') +
             '. Nische: ' + niche,
      existing_slug: 'ueber-uns',
    },
    {
      id_suffix: 'WW',
      content_type: 'CROSS_LINK_PAGE',
      post_type: 'page',
      working_title: 'Werkzeug-Welt',
      keyword: 'werkzeug ratgeber',
      notes: 'SISTER_SITES: Siehe bestehende Werkzeug-Welt Links. Nische: ' + niche,
      existing_slug: 'werkzeug-welt',
    },
  ];
  
  // Add BRAND_PROFILE if has patron
  if (hasPatron && patronBrand) {
    pages.push({
      id_suffix: 'BRAND',
      content_type: 'BRAND_PROFILE',
      post_type: 'page',
      working_title: patronBrand + ' Markenprofil',
      keyword: patronBrand.toLowerCase() + ' erfahrung',
      notes: 'Marke: ' + patronBrand + '. Nische: ' + niche,
      existing_slug: 'markenprofil',
    });
  }
  
  // Find existing page IDs on WP
  var wpUrl = site.wpUrl || ('https://' + domain);
  var existingPages = {};
  try {
    var pagesResp = UrlFetchApp.fetch(wpUrl + '/wp-json/wp/v2/pages?per_page=50&_fields=id,slug', {
      muteHttpExceptions: true
    });
    if (pagesResp.getResponseCode() === 200) {
      var wpPages = JSON.parse(pagesResp.getContentText());
      wpPages.forEach(function(p) { existingPages[p.slug] = p.id; });
    }
  } catch(e) {}
  
  // Add rows to Content Pipeline
  var cpSheet = ss.getSheetByName('Content Pipeline');
  if (!cpSheet) { ui.alert('❌ Content Pipeline sheet not found'); return; }
  
  var cpHeaders = cpSheet.getRange(1, 1, 1, cpSheet.getLastColumn()).getValues()[0];
  var col = {};
  cpHeaders.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  var siteSlug = domain.split('.')[0].toUpperCase().substring(0, 2);
  var added = 0;
  
  pages.forEach(function(page) {
    var newRow = new Array(cpHeaders.length).fill('');
    var cpId = 'CP-' + siteSlug + '-' + page.id_suffix;
    
    // Check if this ID already exists
    var cpData = cpSheet.getDataRange().getValues();
    for (var r = 1; r < cpData.length; r++) {
      if ((cpData[r][col['ID_CP']] || '').toString() === cpId) {
        return; // Skip, already exists
      }
    }
    
    if (col['ID_CP'] !== undefined) newRow[col['ID_CP']] = cpId;
    if (col['Target_Domain_CP'] !== undefined) newRow[col['Target_Domain_CP']] = domain;
    if (col['Content_Type_CP'] !== undefined) newRow[col['Content_Type_CP']] = page.content_type;
    if (col['Post_Type_CP'] !== undefined) newRow[col['Post_Type_CP']] = page.post_type;
    if (col['Working_Title_CP'] !== undefined) newRow[col['Working_Title_CP']] = page.working_title;
    if (col['Primary_Keyword_CP'] !== undefined) newRow[col['Primary_Keyword_CP']] = page.keyword;
    if (col['Notes_CP'] !== undefined) newRow[col['Notes_CP']] = page.notes;
    if (col['Mode_CP'] !== undefined) newRow[col['Mode_CP']] = 'A';
    if (col['Status_CP'] !== undefined) newRow[col['Status_CP']] = '📄 Page planned';
    
    // Set existing page ID if found
    var existingId = existingPages[page.existing_slug] || 0;
    if (existingId && col['Existing_Post_ID_CP'] !== undefined) {
      newRow[col['Existing_Post_ID_CP']] = existingId;
    }
    
    var insertRow = cpSheet.getLastRow() + 1;
    cpSheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);
    added++;
  });
  
  ui.alert('📄 Site Pages Generator\n\n' +
    '✅ Dodano ' + added + ' stron do Content Pipeline:\n\n' +
    pages.map(function(p) { 
      var eid = existingPages[p.existing_slug];
      return '• ' + p.content_type + ': ' + p.working_title + (eid ? ' (update #' + eid + ')' : ' (new)');
    }).join('\n') +
    '\n\nNastępny krok: Zaznacz ▶Text_CP → Generate TEXT Prompt');
}