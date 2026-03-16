/**
 * ============================================================================
 * WAAS CONTENT PIPELINE v4 — INTEGRATION MODULE
 * ============================================================================
 * 
 * WAŻNE: Ten moduł WPINA SIĘ w istniejący WAAS system.
 * NIE nadpisuje Menu.gs, Core.gs, ContentGenerator.gs ani niczego innego.
 * 
 * DO ZROBIENIA PO WKLEJENIU:
 * 1. Wklej ten plik jako "ContentPipeline.gs" w Apps Script
 * 2. W Menu.gs → dodaj wpisy do istniejącego submenu Content (patrz instrukcja na dole)
 * 3. Uruchom: cpSetupPipelineColumns() — doda kolumny do istniejącej karty Content Queue
 * 
 * ARCHITEKTURA — 3 OSOBNE FLOW PROMPTÓW:
 * 
 *   FLOW 1: TEXT  → artykuł, SEO, FAQ, CTAs (BEZ mediów!)
 *   FLOW 2: IMAGE → featured image + ilustracje (osobny prompt, osobny parse)
 *   FLOW 3: VIDEO → scenariusz, voiceover, thumbnail (osobny prompt, osobny parse)
 * 
 * SYSTEM NAZEWNICTWA (łączy media z treścią):
 *   Content:     CP-{siteCode}-{nr}           np. CP-MT-001
 *   Featured:    CP-{siteCode}-{nr}-FI        np. CP-MT-001-FI
 *   Ilustracja:  CP-{siteCode}-{nr}-IL{nn}    np. CP-MT-001-IL01
 *   Infografika: CP-{siteCode}-{nr}-IG        np. CP-MT-001-IG
 *   Video:       CP-{siteCode}-{nr}-VD{nn}    np. CP-MT-001-VD01
 *   Thumbnail:   CP-{siteCode}-{nr}-VD{nn}-TH np. CP-MT-001-VD01-TH
 * 
 * @version 4.0
 * @date 2026-03-04
 */

// ============================================================================
// KONFIGURACJA
// ============================================================================

const CP_CONFIG = {
  // Kody stron (dopasowane do istniejącej karty Sites)
  SITE_CODES: {
    'meisseltechnik.lk24.shop': 'MT',
    'erdloch-bohren.lk24.shop': 'EB',
    'bohradaptertechnik.lk24.shop': 'BA',
    'betonsaegetechnik.lk24.shop': 'BS',
    'betonbohrtechnik.lk24.shop': 'BB',
    'lk24.shop': 'LK',
  },
  
  // Nazwy kart
  CONTENT_QUEUE_SHEET: 'Content Pipeline',
  MEDIA_QUEUE_SHEET: 'Media Queue_CP',     // NOWA karta — nie koliduje z istniejącą
  VIDEO_QUEUE_SHEET: 'Video Queue_CP',     // NOWA karta
  CP_DROPDOWNS_SHEET: 'Dropdowns_CP',      // NOWA karta
  
  // Kolumny startowe w Content Queue (będą DODANE po istniejących)
  // Sprawdzimy dynamicznie jaka jest ostatnia kolumna
  
  // Kolory
  COLORS: {
    PIPELINE_HEADER: '#1B5E20',  // Ciemny zielony — wyróżnia się od istniejących
    PIPELINE_BG: '#E8F5E9',
    TEXT_FLOW: '#E3F2FD',        // Niebieski
    IMAGE_FLOW: '#FFF3E0',       // Pomarańczowy
    VIDEO_FLOW: '#F3E5F5',       // Fioletowy
    NAMING: '#FFFDE7',           // Żółty
  },
};

// ============================================================================
// SYSTEM NAZEWNICTWA — SERCE LINKOWANIA MEDIÓW Z TREŚCIĄ
// ============================================================================

/**
 * Generuje Content Pipeline ID
 * Format: CP-{SiteCode}-{NNN}
 */
function cpGenerateContentId(siteUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return 'CP-XX-001';
  
  // Znajdź kod strony
  const siteCode = CP_CONFIG.SITE_CODES[siteUrl] || 'XX';
  
  // Znajdź kolumnę ID_CP
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const cpIdCol = headers.indexOf('ID_CP');
  
  if (cpIdCol === -1) return `CP-${siteCode}-001`;
  
  // Policz istniejące ID tego site'u
  const data = sheet.getRange(2, cpIdCol + 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  const prefix = `CP-${siteCode}-`;
  let maxNum = 0;
  
  data.forEach(row => {
    const val = row[0].toString();
    if (val.startsWith(prefix)) {
      const num = parseInt(val.replace(prefix, ''));
      if (num > maxNum) maxNum = num;
    }
  });
  
  return `CP-${siteCode}-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Generuje Media ID na podstawie Content ID
 */
function cpGenerateMediaId(contentId, mediaType, index) {
  const suffixes = {
    'FEATURED_IMAGE': 'FI',
    'ILLUSTRATION': `IL${String(index || 1).padStart(2, '0')}`,
    'INFOGRAPHIC': 'IG',
    'VIDEO': `VD${String(index || 1).padStart(2, '0')}`,
    'THUMBNAIL': `VD${String(index || 1).padStart(2, '0')}-TH`,
    'PINTEREST': 'PIN',
  };
  return `${contentId}-${suffixes[mediaType] || 'XX'}`;
}

/**
 * Generuje filename na podstawie Media ID + keyword
 */
function cpGenerateFilename(mediaId, keyword, extension) {
  const slug = keyword
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${mediaId.toLowerCase()}-${slug}.${extension || 'jpg'}`;
}


// ============================================================================
// SETUP — dodaje kolumny Pipeline do istniejącej Content Queue
// ============================================================================

function cpSetupPipelineColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // 1. Dodaj kolumny do Content Queue
  cpAddContentQueueColumns(ss);
  
  // 2. Utwórz nowe karty
  cpSetupMediaQueue(ss);
  cpSetupVideoQueue(ss);
  cpSetupDropdowns(ss);
  
  ui.alert(
    '✅ Content Pipeline Setup Complete!\n\n' +
    '📝 Content Queue — dodano kolumny Pipeline (na końcu)\n' +
    '🖼️ CP Media Queue — nowa karta dla obrazów\n' +
    '🎬 CP Video Queue — nowa karta dla wideo\n' +
    '📊 CP Dropdowns — dane referencyjne Pipeline\n\n' +
    'Nowe opcje w menu WAAS → Content.'
  );
}

function cpAddContentQueueColumns(ss) {
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Brak karty Content Queue!');
    return;
  }
  
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Sprawdź czy kolumny Pipeline już istnieją
  if (headers.includes('ID_CP')) {
    SpreadsheetApp.getUi().alert('ℹ️ Kolumny Pipeline już istnieją. Pomijam.');
    return;
  }
  
  // Nowe kolumny Pipeline — dodajemy PO istniejących
  const newColumns = [
    // IDENTYFIKACJA PIPELINE
    { name: 'ID_CP', width: 110, bg: CP_CONFIG.COLORS.NAMING, note: 'Content Pipeline ID (auto)' },
    { name: 'Target_Domain_CP', width: 220, bg: CP_CONFIG.COLORS.NAMING, note: 'Domena docelowa — auto z Sites, można zmienić' },
    
    // KONFIGURACJA ARTYKUŁU
    { name: 'Content_Type_CP', width: 130, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'content_types' },
    { name: 'Headline_Type_CP', width: 130, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'headline_types' },
    { name: 'Headline_Strategy_CP', width: 120, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'headline_strategies' },
    { name: 'Text_Length_CP', width: 110, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'text_lengths' },
    { name: 'Products_Count_CP', width: 110, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'products_count' },
    { name: 'Include_FAQ_CP', width: 90, bg: CP_CONFIG.COLORS.PIPELINE_BG, checkbox: true },
    { name: 'FAQ_Count_CP', width: 80, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'faq_counts' },
    { name: 'Include_Culture_CP', width: 100, bg: CP_CONFIG.COLORS.PIPELINE_BG, checkbox: true },
    
    // DANE WEJŚCIOWE
    { name: 'Working_Title_CP', width: 280, bg: '#FFFFFF' },
    { name: 'Primary_Keyword_CP', width: 200, bg: '#FFFFFF' },
    { name: 'Secondary_Keywords_CP', width: 200, bg: '#FFFFFF' },
    { name: 'Problem_Need_CP', width: 250, bg: '#FFFFFF' },
    { name: 'Target_Audience_CP', width: 180, bg: '#FFFFFF' },
    { name: 'Product_ASINs_CP', width: 200, bg: '#FFFFFF' },
    { name: 'Notes_CP', width: 250, bg: '#FFFFFF' },
    
    // FLOW 1: TEXT PROMPT
    { name: '▶Text_CP', width: 70, bg: CP_CONFIG.COLORS.TEXT_FLOW, checkbox: true, note: 'Zaznacz → Generate Text Prompt' },
    { name: 'Text_Prompt_CP', width: 400, bg: CP_CONFIG.COLORS.TEXT_FLOW, note: 'Wygenerowany prompt (kopiuj do AI)' },
    { name: 'Text_Response_CP', width: 400, bg: CP_CONFIG.COLORS.TEXT_FLOW, note: 'Wklej JSON response z AI' },
    { name: '▶ParseText_CP', width: 80, bg: CP_CONFIG.COLORS.TEXT_FLOW, checkbox: true, note: 'Zaznacz → Parse Text JSON' },
    
    // SPARSOWANY ARTYKUŁ
    { name: 'Final_Title_CP', width: 280, bg: '#FFFFFF' },
    { name: 'Final_Slug_CP', width: 200, bg: '#FFFFFF' },
    { name: 'Excerpt_CP', width: 300, bg: '#FFFFFF' },
    { name: 'Sections_JSON_CP', width: 400, bg: '#FFFFFF', note: 'Sekcje artykułu jako JSON' },
    { name: 'Word_Count_CP', width: 80, bg: '#FFFFFF' },
    { name: 'Meta_Description_CP', width: 300, bg: '#FFFFFF' },
    { name: 'SEO_Title_CP', width: 280, bg: '#FFFFFF' },
    { name: 'Focus_Keyword_CP', width: 180, bg: '#FFFFFF' },
    { name: 'Tags_CP', width: 200, bg: '#FFFFFF' },
    { name: 'FAQ_JSON_CP', width: 400, bg: '#FFFFFF' },
    { name: 'CTAs_JSON_CP', width: 400, bg: '#FFFFFF' },
    
    // FLOW 2: IMAGE PROMPT (osobny!)
    { name: '▶Image_CP', width: 70, bg: CP_CONFIG.COLORS.IMAGE_FLOW, checkbox: true, note: 'Zaznacz → Generate Image Prompt' },
    { name: 'Image_Prompt_CP', width: 400, bg: CP_CONFIG.COLORS.IMAGE_FLOW, note: 'Wygenerowany prompt do zdjęć' },
    { name: 'Image_Response_CP', width: 400, bg: CP_CONFIG.COLORS.IMAGE_FLOW, note: 'Wklej JSON response (opisy, alt, captions)' },
    { name: '▶ParseImage_CP', width: 80, bg: CP_CONFIG.COLORS.IMAGE_FLOW, checkbox: true, note: 'Zaznacz → Parse do CP Media Queue' },
    
    // FLOW 3: VIDEO PROMPT (osobny!)
    { name: '▶Video_CP', width: 70, bg: CP_CONFIG.COLORS.VIDEO_FLOW, checkbox: true, note: 'Zaznacz → Generate Video Prompt' },
    { name: 'Video_Prompt_CP', width: 400, bg: CP_CONFIG.COLORS.VIDEO_FLOW, note: 'Wygenerowany prompt do wideo' },
    { name: 'Video_Response_CP', width: 400, bg: CP_CONFIG.COLORS.VIDEO_FLOW, note: 'Wklej JSON response (scenariusz, VO, texty)' },
    { name: '▶ParseVideo_CP', width: 80, bg: CP_CONFIG.COLORS.VIDEO_FLOW, checkbox: true, note: 'Zaznacz → Parse do CP Video Queue' },
    
    // QUALITY & STATUS
    { name: 'Quality_Score_CP', width: 90, bg: CP_CONFIG.COLORS.PIPELINE_BG },
    { name: 'Quality_Details_CP', width: 250, bg: CP_CONFIG.COLORS.PIPELINE_BG },
    { name: 'Status_CP', width: 120, bg: CP_CONFIG.COLORS.PIPELINE_BG, dropdown: 'cp_statuses' },
    
    // EXPORT (jak w Products: Select → Target Domain → Export)
    { name: 'Select_CP', width: 60, bg: '#C8E6C9', checkbox: true, note: 'Zaznacz do eksportu' },
    { name: '▶Export_CP', width: 70, bg: CP_CONFIG.COLORS.PIPELINE_HEADER, checkbox: true, note: 'Zaznacz → Export do WP' },
    { name: 'Post_ID_CP', width: 80, bg: '#FFFFFF' },
    { name: 'Post_URL_CP', width: 250, bg: '#FFFFFF' },
    { name: 'Export_Date_CP', width: 110, bg: '#FFFFFF' },
  ];
  
  // Dodaj nagłówki
  const startCol = lastCol + 1;
  
  // Etykieta sekcji
  sheet.getRange(1, startCol).setValue('📝 CONTENT PIPELINE v4')
    .setFontWeight('bold')
    .setBackground(CP_CONFIG.COLORS.PIPELINE_HEADER)
    .setFontColor('#FFFFFF');
  
  // Nagłówki kolumn — możemy je dać w wierszu 1 (jak istniejące)
  newColumns.forEach((col, idx) => {
    const colNum = startCol + idx;
    const cell = sheet.getRange(1, colNum);
    cell.setValue(col.name);
    cell.setFontWeight('bold');
    cell.setBackground(col.bg || '#FFFFFF');
    cell.setFontSize(9);
    sheet.setColumnWidth(colNum, col.width);
    
    if (col.note) {
      cell.setNote(col.note);
    }
  });
  
  // Dropdowny i checkboxy
  const maxRows = 200;
  const dropdownDefs = cpGetDropdownDefs();
  
  newColumns.forEach((col, idx) => {
    const colNum = startCol + idx;
    
    if (col.dropdown && dropdownDefs[col.dropdown]) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(dropdownDefs[col.dropdown], true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(2, colNum, maxRows, 1).setDataValidation(rule);
    }
    
    if (col.checkbox) {
      sheet.getRange(2, colNum, maxRows, 1).insertCheckboxes();
    }
  });
}

function cpGetDropdownDefs() {
  return {
    'content_types': ['TUTORIAL', 'RATGEBER', 'HOW_TO', 'PROBLEM_SOLVER', 'FAQ', 'VERGLEICH', 'REVIEW', 'LISTICLE', 'SEASONAL', 'CASE_STUDY', 'CATEGORY_PAGE', 'CATEGORY_DESCRIPTION', 'BRAND_DESCRIPTION', 'GLOSSAR', 'NEWS'],
    'headline_types': ['AUTO', 'HOW_TO', 'STEP_BY_STEP', 'GUIDE', 'QUESTION', 'DIRECT', 'COMPARISON', 'NUMBERED_LIST', 'BEST_OF_YEAR', 'SUPERLATIVE_LIST', 'PROBLEM', 'EVEN_IF', 'BEFORE_AFTER', 'RESCUE', 'IF_THEN', 'BENEFIT_PROMISE', 'OVERCOME', 'SEASONAL', 'FAST_RESULT', 'DEADLINE', 'SOCIAL_PROOF', 'CURIOSITY', 'CARLTON', 'MYTH_BUSTER', 'CONTRARIAN'],
    'headline_strategies': ['AUTO', 'GAIN', 'THREAT', 'SOCIAL_PROOF', 'CARLTON', 'CURIOSITY'],
    'text_lengths': ['AUTO', 'MICRO', 'SHORT', 'MEDIUM', 'STANDARD', 'LONG', 'DEEP_DIVE'],
    'products_count': ['AUTO', 'NONE', 'SINGLE', 'FEW', 'SEVERAL', 'MANY'],
    'faq_counts': ['3', '5', '7', '10'],
    'cp_statuses': ['⏳ Draft', '📝 Text Ready', '🖼️ Images Ready', '🎬 Video Ready', '✅ Complete', '📤 Published', '⚠️ Needs Edit', '❌ Rejected'],
  };
}

/**
 * Pobiera listę domen z karty Sites (tak jak Products → Target Domain)
 */
function cpGetDomainsFromSites() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');
  if (!sitesSheet) return ['meisseltechnik.lk24.shop'];
  
  const data = sitesSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Szukaj kolumny z domeną
  let domainCol = -1;
  const possibleNames = ['Domain', 'domain', 'URL', 'url', 'Site URL', 'Site_URL', 'Name', 'name'];
  for (const name of possibleNames) {
    const idx = headers.indexOf(name);
    if (idx !== -1) { domainCol = idx; break; }
  }
  
  if (domainCol === -1) {
    // Spróbuj kolumnę B lub C (typowe pozycje domeny)
    domainCol = 1; // Kolumna B
  }
  
  const domains = [];
  for (let r = 1; r < data.length; r++) {
    const val = data[r][domainCol];
    if (val && val.toString().includes('.')) {
      domains.push(val.toString().trim());
    }
  }
  
  return domains.length > 0 ? domains : ['meisseltechnik.lk24.shop'];
}

/**
 * Info o Target Domain (nie ma dropdowna — pole tekstowe)
 */
function cpRefreshTargetDomains() {
  const domains = cpGetDomainsFromSites();
  SpreadsheetApp.getUi().alert(
    'ℹ️ Target_Domain_CP to zwykłe pole tekstowe.\n\n' +
    'Auto-wypełnia się przy Generate TEXT Prompt.\n' +
    'Możesz wpisać/wkleić dowolną domenę.\n' +
    'Ten sam artykuł możesz wyeksportować na inną stronę zmieniając domenę.\n\n' +
    `Domeny z karty Sites (${domains.length}):\n${domains.join('\n')}`
  );
}


// ============================================================================
// CP MEDIA QUEUE — osobna karta dla obrazów
// ============================================================================

function cpSetupMediaQueue(ss) {
  let sheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (sheet) return; // Już istnieje
  
  sheet = ss.insertSheet(CP_CONFIG.MEDIA_QUEUE_SHEET);
  
  const headers = [
    // IDENTYFIKACJA
    'Media_ID',          // CP-MT-001-FI
    'Content_ID',        // CP-MT-001 (łącze do Content Queue)
    'Media_Type',        // FEATURED_IMAGE, ILLUSTRATION, INFOGRAPHIC, PINTEREST
    
    // TEKSTY DO OBRAZU (z parsowanego JSON)
    'Alt_Text',          // SEO alt text
    'Image_Title',       // Tytuł obrazu
    'Caption',           // Podpis
    'Overlay_Text',      // Tekst na obrazie
    'Branding',          // Np. "Logo dolny prawy róg"
    
    // GENEROWANIE OBRAZU
    'AI_Image_Prompt',   // Prompt do generowania obrazu (DALL-E, Midjourney, Flux)
    'Style_Notes',       // Notatki stylistyczne
    'Dimensions',        // 1200x630, 800x450, etc.
    'AI_Target',         // GPT_Image, DALL-E, Midjourney, Flux, Manual
    
    // PLIK
    'Filename',          // cp-mt-001-fi-fliesen-entfernen.jpg (auto-generated)
    'File_URL',          // URL po uploadzie (ręcznie lub auto)
    'WP_Media_ID',       // WordPress Media Library ID
    'WP_Media_URL',      // WordPress URL
    
    // STATUS
    'Status',            // ⏳ Pending, 🎨 Generating, ✅ Ready, 📤 Uploaded
    'Placement',         // Gdzie w artykule (Po sekcji X)
    'Notes',             // Notatki operatora
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground(CP_CONFIG.COLORS.IMAGE_FLOW)
    .setFontColor('#000000');
  
  // Dropdowny
  const mediaTypes = ['FEATURED_IMAGE', 'ILLUSTRATION', 'INFOGRAPHIC', 'PINTEREST', 'SOCIAL'];
  const dims = ['1200x630', '800x450', '400x300', '1000x1500', '800x2000'];
  const aiTargets = ['GPT_Image', 'DALL-E', 'Midjourney', 'Flux', 'Manual'];
  const statuses = ['⏳ Pending', '🎨 Generating', '✅ Ready', '📤 Uploaded', '❌ Problem'];
  
  [
    { col: 3, values: mediaTypes },
    { col: 11, values: dims },
    { col: 12, values: aiTargets },
    { col: 17, values: statuses },
  ].forEach(r => {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(r.values, true).build();
    sheet.getRange(2, r.col, 200, 1).setDataValidation(rule);
  });
  
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setTabColor('#FF9800');
  
  // Szerokości
  const widths = [140, 120, 140, 250, 200, 250, 200, 200, 400, 200, 100, 120, 250, 250, 90, 250, 100, 150, 250];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}


// ============================================================================
// CP VIDEO QUEUE — osobna karta dla wideo
// ============================================================================

function cpSetupVideoQueue(ss) {
  let sheet = ss.getSheetByName(CP_CONFIG.VIDEO_QUEUE_SHEET);
  if (sheet) return;
  
  sheet = ss.insertSheet(CP_CONFIG.VIDEO_QUEUE_SHEET);
  
  const headers = [
    // IDENTYFIKACJA
    'Video_ID',          // CP-MT-001-VD01
    'Content_ID',        // CP-MT-001
    
    // METADANE (z parsowanego JSON)
    'Video_Title',
    'Video_Description',
    'Video_Tags',
    'Video_Category',
    'Duration_Target',
    
    // SCENARIUSZ (z parsowanego JSON)
    'Scenes_JSON',       // Tablica scen: [{nr, duration, visual, voiceover, overlay}]
    'VO_Script',         // Kompletny tekst voiceover (połączony ze scen)
    'Overlay_Texts',     // Teksty do nałożenia na wideo
    
    // THUMBNAIL
    'Thumb_ID',          // CP-MT-001-VD01-TH
    'Thumb_Prompt',      // Prompt do generowania miniaturki
    'Thumb_Alt',
    'Thumb_Filename',
    
    // PRODUKCJA
    'AI_Target',         // Sora, Runway, Kling, Manual
    'Video_Filename',
    'Video_URL',
    'YouTube_ID',
    'WP_Embed_Code',
    
    // STATUS
    'Status',            // ⏳ Pending, 🎬 In Production, ✅ Ready, 📤 Uploaded
    'Notes',
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground(CP_CONFIG.COLORS.VIDEO_FLOW)
    .setFontColor('#000000');
  
  const statuses = ['⏳ Pending', '🎬 In Production', '✅ Ready', '📤 Uploaded', '❌ Problem'];
  const aiTargets = ['Sora', 'Runway', 'Kling', 'Manual'];
  const categories = ['Bildung', 'Anleitungen', 'Unterhaltung', 'Produkte'];
  
  [
    { col: 6, values: categories },
    { col: 15, values: aiTargets },
    { col: 20, values: statuses },
  ].forEach(r => {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(r.values, true).build();
    sheet.getRange(2, r.col, 100, 1).setDataValidation(rule);
  });
  
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setTabColor('#9C27B0');
}


// ============================================================================
// CP DROPDOWNS — dane referencyjne
// ============================================================================

function cpSetupDropdowns(ss) {
  let sheet = ss.getSheetByName(CP_CONFIG.CP_DROPDOWNS_SHEET);
  if (sheet) return;
  
  sheet = ss.insertSheet(CP_CONFIG.CP_DROPDOWNS_SHEET);
  
  // Headline Types reference
  const htHeaders = ['Code', 'Name_DE', 'Strategy', 'Pattern'];
  const htData = [
    ['AUTO', 'Automatisch', 'auto', 'System wählt'],
    ['HOW_TO', 'Wie/So + Verb', 'GAIN', 'Wie Sie X — Y'],
    ['STEP_BY_STEP', 'Schritt für Schritt', 'GAIN', 'X: Anleitung Schritt für Schritt'],
    ['GUIDE', 'Ratgeber', 'GAIN', 'A oder B? Der große Ratgeber'],
    ['QUESTION', 'W-Frage', 'GAIN', 'Welcher X für welche Y?'],
    ['DIRECT', 'Klares Statement', 'GAIN', 'X — Technik, Werkzeug, Sicherheit'],
    ['COMPARISON', 'Vergleich A vs B', 'GAIN', 'A oder B? Direkter Vergleich'],
    ['NUMBERED_LIST', 'Zahlen-Liste', 'GAIN', '5 beste/wichtigste X'],
    ['BEST_OF_YEAR', 'Beste in [Jahr]', 'GAIN+TIME', 'Die besten X in 2026'],
    ['SUPERLATIVE_LIST', 'Superlativ-Liste', 'GAIN+CURIOSITY', 'Die 6 stärksten X'],
    ['PROBLEM', 'Problem-Warnung', 'THREAT', 'X hält nicht? Das können Sie tun'],
    ['EVEN_IF', 'Selbst wenn...', 'CARLTON', 'X — selbst wenn Y'],
    ['BEFORE_AFTER', 'Vorher/Nachher', 'GAIN+PROOF', 'Von X zu Y: So geht\'s'],
    ['RESCUE', 'Rettung bei Problemen', 'THREAT+GAIN', 'Hilft wenn alles schiefgeht'],
    ['IF_THEN', 'Wenn...dann...', 'GAIN', 'Wenn Sie X, dann Y'],
    ['BENEFIT_PROMISE', 'Nutzen + Versprechen', 'GAIN', 'X in Y Zeit — so geht\'s'],
    ['OVERCOME', 'Trotz Hindernis', 'GAIN', 'X erreicht, obwohl Y'],
    ['SEASONAL', 'Saisonbezogen', 'GAIN+TIME', 'Frühjahrsprojekte 2026'],
    ['FAST_RESULT', 'Schnelles Ergebnis', 'GAIN+TIME', 'X in 30 Minuten'],
    ['DEADLINE', 'Jetzt handeln', 'THREAT+TIME', 'Bevor Sie X: Lesen Sie das'],
    ['SOCIAL_PROOF', 'Sozialer Beweis', 'PROOF', 'Warum Profis diesen X nutzen'],
    ['CURIOSITY', 'Neugier', 'CURIOSITY', 'Was die meisten nicht wissen'],
    ['CARLTON', 'John Carlton Formel', 'GAIN+EVEN_IF', 'Wir zeigen [Gruppe] wie...'],
    ['MYTH_BUSTER', 'Mythos aufdecken', 'THREAT+CURIOSITY', 'Die größte Lüge über X'],
    ['CONTRARIAN', 'Gegen den Strom', 'CURIOSITY+THREAT', 'Warum Sie NICHT X sollten'],
  ];
  
  sheet.getRange(1, 1, 1, htHeaders.length).setValues([htHeaders]).setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
  sheet.getRange(2, 1, htData.length, htData[0].length).setValues(htData);
  
  // Naming system reference
  sheet.getRange(1, 7).setValue('NAMING SYSTEM').setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
  const namingData = [
    ['Suffix', 'Type', 'Example'],
    ['(brak)', 'Content', 'CP-MT-001'],
    ['-FI', 'Featured Image', 'CP-MT-001-FI'],
    ['-IL01', 'Illustration 1', 'CP-MT-001-IL01'],
    ['-IL02', 'Illustration 2', 'CP-MT-001-IL02'],
    ['-IG', 'Infographic', 'CP-MT-001-IG'],
    ['-VD01', 'Video 1', 'CP-MT-001-VD01'],
    ['-VD01-TH', 'Video 1 Thumbnail', 'CP-MT-001-VD01-TH'],
    ['-PIN', 'Pinterest Pin', 'CP-MT-001-PIN'],
  ];
  sheet.getRange(1, 7, namingData.length, 3).setValues(namingData);
  sheet.getRange(1, 7, 1, 3).setFontWeight('bold').setBackground('#FFFDE7');
  
  sheet.setTabColor('#9E9E9E');
  sheet.autoResizeColumns(1, 10);
}


/**
 * Dodaje brakującą kolumnę Target_Domain_CP (dla już zainstalowanych systemów)
 */
function cpAddTargetDomainColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (headers.includes('Target_Domain_CP')) {
    SpreadsheetApp.getUi().alert('ℹ️ Target_Domain_CP już istnieje.');
    return;
  }
  
  const cpIdIdx = headers.indexOf('ID_CP');
  if (cpIdIdx === -1) {
    SpreadsheetApp.getUi().alert('❌ Nie znaleziono ID_CP.');
    return;
  }
  
  // Wstaw kolumnę ZARAZ PO ID_CP
  const insertCol = cpIdIdx + 2;
  sheet.insertColumnAfter(cpIdIdx + 1);
  
  sheet.getRange(1, insertCol).setValue('Target_Domain_CP')
    .setFontWeight('bold')
    .setBackground(CP_CONFIG.COLORS.NAMING)
    .setNote('Domena docelowa — auto z Sites, można zmienić/wkleić inną');
  sheet.setColumnWidth(insertCol, 220);
  
  SpreadsheetApp.getUi().alert('✅ Kolumna Target_Domain_CP dodana.\nAuto-wypełnia się przy Generate TEXT Prompt.\nMożna ręcznie wpisać/wkleić inną domenę.');
}


// ============================================================================
// FLOW 1: GENERATE TEXT PROMPT (BEZ mediów!)
// ============================================================================

function cpGenerateTextPrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0]; // Wiersz 1 = nagłówki
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  // Sprawdź czy kolumny Pipeline istnieją
  if (!('▶Text_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.\nUruchom najpierw: Setup Pipeline Columns');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Text_CP']] !== true) continue;
    if (!row[col['Working_Title_CP']] && !row[col['Primary_Keyword_CP']]) continue;
    
    const sheetRow = r + 1;
    
    // Auto-generate ID_CP jeśli nie ma
    if (!row[col['ID_CP']]) {
      const siteUrl = findSiteUrl(row, col);
      const cpId = cpGenerateContentId(siteUrl);
      sheet.getRange(sheetRow, col['ID_CP'] + 1).setValue(cpId);
      row[col['ID_CP']] = cpId;
    }
    
    // Auto-fill Target_Domain_CP jeśli puste (domyślne z kontekstu, edytowalne)
    if (!row[col['Target_Domain_CP']] && col['Target_Domain_CP'] !== undefined) {
      const siteUrl = findSiteUrl(row, col);
      sheet.getRange(sheetRow, col['Target_Domain_CP'] + 1).setValue(siteUrl);
    }
    
    // Zbuduj TEXT-ONLY prompt
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildTextPrompt(config);
    
    // Force text format (prevent = being interpreted as formula)
    const promptCell = sheet.getRange(sheetRow, col['Text_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Text_CP'] + 1).setValue(false);
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0 
      ? `✅ Wygenerowano ${generated} TEXT prompt(ów).\n\nSkopiuj prompt z kolumny Text_Prompt_CP → wklej do AI → wklej JSON do Text_Response_CP → zaznacz ▶ParseText_CP.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Text_CP.'
  );
}

function findSiteUrl(row, col) {
  // Priorytet 1: Target_Domain_CP (nowy dropdown)
  if (col['Target_Domain_CP'] !== undefined && row[col['Target_Domain_CP']]) {
    return row[col['Target_Domain_CP']].toString();
  }
  // Priorytet 2: istniejące kolumny WAAS
  const possibleCols = ['Domain', 'Site_URL', 'domain', 'site_url', 'URL'];
  for (const name of possibleCols) {
    if (col[name] !== undefined && row[col[name]]) {
      return row[col[name]].toString();
    }
  }
  return 'meisseltechnik.lk24.shop';
}


// ============================================================================
// FLOW 2: GENERATE IMAGE PROMPT (osobny od tekstu!)
// ============================================================================

function cpGenerateImagePrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  if (!('▶Image_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Image_CP']] !== true) continue;
    if (!row[col['ID_CP']]) continue;
    
    const sheetRow = r + 1;
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildImagePrompt(config);
    
    const promptCell = sheet.getRange(sheetRow, col['Image_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Image_CP'] + 1).setValue(false);
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0
      ? `🖼️ Wygenerowano ${generated} IMAGE prompt(ów).\n\nSkopiuj prompt → AI → JSON do Image_Response_CP → zaznacz ▶ParseImage_CP.\n\nObraz generujesz osobno (DALL-E, Midjourney, etc.) na podstawie promptu z CP Media Queue.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Image_CP.'
  );
}


// ============================================================================
// FLOW 3: GENERATE VIDEO PROMPT (osobny!)
// ============================================================================

function cpGenerateVideoPrompts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  if (!('▶Video_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  let generated = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Video_CP']] !== true) continue;
    if (!row[col['ID_CP']]) continue;
    
    const sheetRow = r + 1;
    const config = cpExtractConfig(row, col);
    const prompt = cpBuildVideoPrompt(config);
    
    const promptCell = sheet.getRange(sheetRow, col['Video_Prompt_CP'] + 1);
    promptCell.setNumberFormat('@');
    promptCell.setValue(prompt);
    sheet.getRange(sheetRow, col['▶Video_CP'] + 1).setValue(false);
    
    generated++;
  }
  
  SpreadsheetApp.getUi().alert(
    generated > 0
      ? `🎬 Wygenerowano ${generated} VIDEO prompt(ów).\n\nSkopiuj prompt → AI → JSON do Video_Response_CP → zaznacz ▶ParseVideo_CP.`
      : '⚠️ Brak wierszy z zaznaczonym ▶Video_CP.'
  );
}


// ============================================================================
// EXTRACT CONFIG z wiersza Content Queue
// ============================================================================

function cpExtractConfig(row, col) {
  const get = (name) => {
    if (col[name] !== undefined) return row[col[name]] || '';
    return '';
  };
  
  return {
    cp_id: get('ID_CP'),
    site_url: findSiteUrl(row, col),
    content_type: get('Content_Type_CP') || 'TUTORIAL',
    headline_type: get('Headline_Type_CP') || 'AUTO',
    headline_strategy: get('Headline_Strategy_CP') || 'AUTO',
    text_length: get('Text_Length_CP') || 'AUTO',
    products_count: get('Products_Count_CP') || 'AUTO',
    include_faq: get('Include_FAQ_CP') === true,
    faq_count: parseInt(get('FAQ_Count_CP')) || 5,
    include_culture: get('Include_Culture_CP') === true,
    working_title: get('Working_Title_CP'),
    primary_keyword: get('Primary_Keyword_CP'),
    secondary_keywords: get('Secondary_Keywords_CP'),
    problem_need: get('Problem_Need_CP'),
    target_audience: get('Target_Audience_CP'),
    product_asins: get('Product_ASINs_CP'),
    notes: get('Notes_CP'),
    // Istniejące kolumny z WAAS
    existing_title: get('Title') || get('title') || '',
    existing_content: get('Content') || get('content') || '',
  };
}


// ============================================================================
// BUILD TEXT PROMPT — TYLKO tekst, SEO, FAQ, CTA (BEZ mediów!)
// ============================================================================

function cpBuildTextPrompt(c) {
  // Resolve AUTO values
  const resolved = cpResolveAuto(c);
  
  return `CONTENT PIPELINE — TEXT ONLY
Content-ID: ${resolved.cp_id}
WAŻNE: Generuj TYLKO tekst artykułu, SEO, FAQ i CTA.
NIE generuj promptów do zdjęć, wideo ani mediów — to osobny krok.

=== SYSTEM ===
Site: ${resolved.site_url}
Sprache: DE (formell, "Sie")
Marke: Siehe Produktdaten (ASINs)
Shortcode: [waas_product asin='ASIN' layout='horizontal']
KEINE Preise nennen → "Aktuellen Preis auf Amazon prüfen"

Affiliate-Hinweis (am Anfang):
"Als Amazon-Partner verdiene ich an qualifizierten Verkäufen."

=== HEADLINE ===
Typ: ${resolved.headline_type}
${cpGetHeadlinePattern(resolved.headline_type)}
Strategie: ${resolved.headline_strategy}
Arbeitstitel: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
${resolved.secondary_keywords ? 'Sekundär: "' + resolved.secondary_keywords + '"' : ''}

=== CONTENT ===
Content_Type: ${resolved.content_type}
Wortanzahl: ${resolved.word_min}–${resolved.word_max}
${resolved.problem_need ? 'Problem: ' + resolved.problem_need : ''}
${resolved.target_audience ? 'Zielgruppe: ' + resolved.target_audience : ''}
${resolved.notes ? 'Hinweise: ' + resolved.notes : ''}

${cpGetContentStructure(resolved.content_type)}

=== PRODUKTE ===
ASINs: ${resolved.product_asins || 'keine'}
Anzahl: ~${resolved.products_resolved}
Format: [waas_product asin='ASIN' layout='horizontal']
Position im content_html: <!-- PRODUCT: ASIN -->

${resolved.include_faq ? `=== FAQ ===
Erstelle ${resolved.faq_count} FAQ-Paare:
- problem_questions (2-3): Fragen zum Problem
- product_questions (1-2): Fragen zum Werkzeug
- general_questions (1-2): Allgemeine Fragen
Antworten: 40-80 Wörter, präzise.` : ''}

${resolved.include_culture ? cpGetCultureNote() : ''}

=== JSON FORMAT (NUR TEXT!) ===
Antworte NUR mit JSON. Kein Text davor oder danach.

{
  "content_id": "${resolved.cp_id}",
  "article": {
    "title": "SEO H1 Titel",
    "slug": "url-slug",
    "short_headline": "Max 40 Zeichen",
    "excerpt": "Max 160 Zeichen",
    "disclosure": "Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.",
    "sections": [
      {"heading": "H2", "content_html": "<p>...</p>", "type": "text"}
    ],
    "products_shortcodes": ["[waas_product asin=\\"ASIN\\" layout=\\"horizontal\\"]"],
    "word_count": ${resolved.word_min}
  },
  "seo": {
    "meta_description": "Max 160 Zeichen",
    "seo_title": "Max 60 Zeichen | SiteName",
    "focus_keyword": "${resolved.primary_keyword}",
    "secondary_keywords": [],
    "tags": [],
    "schema_type": "HowTo"
  },
  "ctas": {
    "product_view": "Produkt auf Amazon ansehen →",
    "product_buy": "Jetzt auf Amazon bestellen →",
    "related_guide": "Passender Ratgeber: [Titel]",
    "related_article": "Weiterlesen: [Titel]",
    "category": "Alle [Kategorie] Anleitungen →"
  }${resolved.include_faq ? `,
  "faq": {
    "problem_questions": [{"q": "?", "a": "..."}],
    "product_questions": [{"q": "?", "a": "..."}],
    "general_questions": [{"q": "?", "a": "..."}]
  }` : ''}
}`;
}


// ============================================================================
// BUILD IMAGE PROMPT — TYLKO media, ALT texty, opisy
// ============================================================================

function cpBuildImagePrompt(c) {
  const resolved = cpResolveAuto(c);
  
  // Ile ilustracji potrzebujemy
  const illustCount = 2; // default
  
  // Generuj Media IDs
  const fiId = cpGenerateMediaId(resolved.cp_id, 'FEATURED_IMAGE');
  const ilIds = [];
  for (let i = 1; i <= illustCount; i++) {
    ilIds.push(cpGenerateMediaId(resolved.cp_id, 'ILLUSTRATION', i));
  }
  
  return `CONTENT PIPELINE — IMAGE PACKAGE
Content-ID: ${resolved.cp_id}
WAŻNE: Generuj TYLKO opisy zdjęć, ALT texty, captions i prompty do generowania obrazów.
NIE generuj tekstu artykułu — ten jest już gotowy.

=== KONTEKST ===
Artykuł: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
Site: ${resolved.site_url}
Marke: Siehe Produktdaten
Bildstil: Professionelle Werkstatt-Fotografie, warmes Licht, sauberer Arbeitsplatz

=== SYSTEM NAZEWNICTWA ===
Featured Image ID: ${fiId}
${ilIds.map((id, i) => `Illustration ${i + 1} ID: ${id}`).join('\n')}
Filename-Format: {media_id_lowercase}-{keyword-slug}.jpg

=== JSON FORMAT ===
Antworte NUR mit JSON:

{
  "content_id": "${resolved.cp_id}",
  "featured_image": {
    "media_id": "${fiId}",
    "ai_prompt": "Detaillierte Beschreibung für AI-Bildgenerierung: [fotorealistisch, Setting, Perspektive, Beleuchtung, Komposition. Produkte sichtbar.]",
    "alt_text": "Keyword-optimierter Alt-Text",
    "title": "Bild-Titel",
    "caption": "Bildunterschrift",
    "overlay_text": "Kurzer Text fürs Bild",
    "branding": "Site-Logo falls vorhanden, Produkt-Branding",
    "dimensions": "1200x630",
    "style_notes": "Fotorealistisch, Werkstatt, warmes Licht",
    "filename": "${fiId.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg"
  },
  "illustrations": [
    ${ilIds.map((id, i) => `{
      "media_id": "${id}",
      "ai_prompt": "Beschreibung Illustration ${i + 1}...",
      "alt_text": "Alt-Text",
      "caption": "Bildunterschrift",
      "placement": "Nach Sektion ${i + 2}",
      "dimensions": "800x450",
      "filename": "${id.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg"
    }`).join(',\n    ')}
  ]
}`;
}


// ============================================================================
// BUILD VIDEO PROMPT — TYLKO wideo scenariusz
// ============================================================================

function cpBuildVideoPrompt(c) {
  const resolved = cpResolveAuto(c);
  const vdId = cpGenerateMediaId(resolved.cp_id, 'VIDEO', 1);
  const thId = cpGenerateMediaId(resolved.cp_id, 'THUMBNAIL', 1);
  
  return `CONTENT PIPELINE — VIDEO PACKAGE
Content-ID: ${resolved.cp_id}
Video-ID: ${vdId}
WAŻNE: Generuj TYLKO scenariusz wideo, voiceover texty i thumbnail opis.

=== KONTEKST ===
Artykuł: "${resolved.working_title}"
Keyword: "${resolved.primary_keyword}"
Site: ${resolved.site_url}
Marke: Siehe Produktdaten
Ziellänge: 3-5 Minuten
Stil: Professionell, Praxis-orientiert, Werkstatt-Setting

=== JSON FORMAT ===
{
  "content_id": "${resolved.cp_id}",
  "video_id": "${vdId}",
  "video": {
    "title": "YouTube-optimierter Titel (max 60 Zeichen)",
    "description": "YouTube-Beschreibung (150-200 Wörter, mit Keywords)",
    "tags": ["tag1", "tag2"],
    "category": "Bildung",
    "duration_target": "3-5 Min",
    "scenes": [
      {
        "nr": 1,
        "duration_sec": 15,
        "visual": "Beschreibung was zu sehen ist",
        "voiceover": "Sprechtext für diese Szene",
        "overlay_text": "Text der auf dem Bildschirm erscheint"
      }
    ],
    "vo_script_complete": "Kompletter Voiceover-Text (alle Szenen zusammen)",
    "overlay_texts_complete": "Alle Overlay-Texte (zusammen, nummeriert)"
  },
  "thumbnail": {
    "media_id": "${thId}",
    "ai_prompt": "Beschreibung für Thumbnail-Generierung...",
    "overlay_text": "Text auf Thumbnail",
    "alt_text": "Alt-Text",
    "filename": "${thId.toLowerCase()}-${cpSlugify(resolved.primary_keyword)}.jpg",
    "dimensions": "1280x720"
  }
}`;
}


// ============================================================================
// PARSE FUNCTIONS
// ============================================================================

function cpParseTextResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶ParseText_CP']] !== true) continue;
    
    const jsonStr = row[col['Text_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      const json = JSON.parse(cpCleanJson(jsonStr));
      const sheetRow = r + 1;
      const set = (name, val) => {
        if (col[name] !== undefined && val) sheet.getRange(sheetRow, col[name] + 1).setValue(val);
      };
      
      // Article
      if (json.article) {
        set('Final_Title_CP', json.article.title);
        set('Final_Slug_CP', json.article.slug);
        set('Excerpt_CP', json.article.excerpt);
        set('Sections_JSON_CP', JSON.stringify(json.article.sections));
        set('Word_Count_CP', json.article.word_count);
      }
      
      // SEO
      if (json.seo) {
        set('Meta_Description_CP', json.seo.meta_description);
        set('SEO_Title_CP', json.seo.seo_title);
        set('Focus_Keyword_CP', json.seo.focus_keyword);
        set('Tags_CP', Array.isArray(json.seo.tags) ? json.seo.tags.join(', ') : json.seo.tags);
      }
      
      // FAQ
      if (json.faq) set('FAQ_JSON_CP', JSON.stringify(json.faq));
      
      // CTAs
      if (json.ctas) set('CTAs_JSON_CP', JSON.stringify(json.ctas));
      
      // Status
      set('Status_CP', '📝 Text Ready');
      
      // Quality
      const score = cpCalculateScore(json, row, col);
      set('Quality_Score_CP', score.total);
      set('Quality_Details_CP', score.details);
      
      sheet.getRange(sheetRow, col['▶ParseText_CP'] + 1).setValue(false);
      parsed++;
      
    } catch (e) {
      Logger.log(`Parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`📝 Sparsowano ${parsed} TEXT response(ów).`);
}

function cpParseImageResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const mq = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mq) { SpreadsheetApp.getUi().alert('❌ Brak karty CP Media Queue'); return; }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶ParseImage_CP']] !== true) continue;
    
    const jsonStr = row[col['Image_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      const json = JSON.parse(cpCleanJson(jsonStr));
      const contentId = row[col['ID_CP']];
      
      // Featured Image → Media Queue
      if (json.featured_image) {
        cpAddToMediaQueue(mq, json.featured_image, contentId, 'FEATURED_IMAGE');
      }
      
      // Illustrations → Media Queue
      if (json.illustrations && Array.isArray(json.illustrations)) {
        json.illustrations.forEach(ill => {
          cpAddToMediaQueue(mq, ill, contentId, 'ILLUSTRATION');
        });
      }
      
      // Infographic
      if (json.infographic) {
        cpAddToMediaQueue(mq, json.infographic, contentId, 'INFOGRAPHIC');
      }
      
      // Update status
      const sheetRow = r + 1;
      const currentStatus = row[col['Status_CP']];
      if (currentStatus === '📝 Text Ready') {
        sheet.getRange(sheetRow, col['Status_CP'] + 1).setValue('🖼️ Images Ready');
      }
      
      sheet.getRange(sheetRow, col['▶ParseImage_CP'] + 1).setValue(false);
      parsed++;
      
    } catch (e) {
      Logger.log(`Image parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`🖼️ Sparsowano ${parsed} IMAGE response(ów).\nSprawdź kartę CP Media Queue.`);
}

function cpParseVideoResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const vq = ss.getSheetByName(CP_CONFIG.VIDEO_QUEUE_SHEET);
  if (!vq) { SpreadsheetApp.getUi().alert('❌ Brak karty CP Video Queue'); return; }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  let parsed = 0;
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶ParseVideo_CP']] !== true) continue;
    
    const jsonStr = row[col['Video_Response_CP']];
    if (!jsonStr) continue;
    
    try {
      const json = JSON.parse(cpCleanJson(jsonStr));
      const contentId = row[col['ID_CP']];
      
      // Video → Video Queue
      if (json.video) {
        cpAddToVideoQueue(vq, json, contentId);
      }
      
      // Thumbnail → Media Queue
      if (json.thumbnail) {
        const mq = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
        if (mq) cpAddToMediaQueue(mq, json.thumbnail, contentId, 'THUMBNAIL');
      }
      
      // Update status
      const sheetRow = r + 1;
      sheet.getRange(sheetRow, col['Status_CP'] + 1).setValue('🎬 Video Ready');
      sheet.getRange(sheetRow, col['▶ParseVideo_CP'] + 1).setValue(false);
      parsed++;
      
    } catch (e) {
      Logger.log(`Video parse error row ${r + 1}: ${e.message}`);
    }
  }
  
  SpreadsheetApp.getUi().alert(`🎬 Sparsowano ${parsed} VIDEO response(ów).\nSprawdź kartę CP Video Queue.`);
}


// ============================================================================
// HELPERS — Media/Video Queue inserts
// ============================================================================

function cpAddToMediaQueue(mq, data, contentId, mediaType) {
  const newRow = Math.max(mq.getLastRow(), 1) + 1;
  const vals = [
    data.media_id || '',           // Media_ID
    contentId,                      // Content_ID
    mediaType,                      // Media_Type
    data.alt_text || '',            // Alt_Text
    data.title || '',               // Image_Title
    data.caption || '',             // Caption
    data.overlay_text || '',        // Overlay_Text
    data.branding || '',            // Branding
    data.ai_prompt || '',           // AI_Image_Prompt
    data.style_notes || '',         // Style_Notes
    data.dimensions || '1200x630',  // Dimensions
    '',                             // AI_Target
    data.filename || '',            // Filename
    '',                             // File_URL
    '',                             // WP_Media_ID
    '',                             // WP_Media_URL
    '⏳ Pending',                   // Status
    data.placement || '',           // Placement
    '',                             // Notes
  ];
  mq.getRange(newRow, 1, 1, vals.length).setValues([vals]);
}

function cpAddToVideoQueue(vq, json, contentId) {
  const v = json.video;
  const newRow = Math.max(vq.getLastRow(), 1) + 1;
  const vals = [
    json.video_id || '',                    // Video_ID
    contentId,                               // Content_ID
    v.title || '',                           // Video_Title
    v.description || '',                     // Video_Description
    Array.isArray(v.tags) ? v.tags.join(', ') : (v.tags || ''), // Tags
    v.category || '',                        // Category
    v.duration_target || '',                 // Duration
    JSON.stringify(v.scenes || []),           // Scenes_JSON
    v.vo_script_complete || '',              // VO_Script
    v.overlay_texts_complete || '',          // Overlay_Texts
    json.thumbnail?.media_id || '',          // Thumb_ID
    json.thumbnail?.ai_prompt || '',         // Thumb_Prompt
    json.thumbnail?.alt_text || '',          // Thumb_Alt
    json.thumbnail?.filename || '',          // Thumb_Filename
    '',                                      // AI_Target
    '',                                      // Video_Filename
    '',                                      // Video_URL
    '',                                      // YouTube_ID
    '',                                      // WP_Embed
    '⏳ Pending',                            // Status
    '',                                      // Notes
  ];
  vq.getRange(newRow, 1, 1, vals.length).setValues([vals]);
}


// ============================================================================
// QUALITY SCORE
// ============================================================================

function cpCalculateScore(json, row, col) {
  const checks = [];
  let total = 0;
  
  const keyword = (row[col['Primary_Keyword_CP']] || '').toLowerCase();
  const title = (json.article?.title || '').toLowerCase();
  
  // 1. Keyword in title (15)
  if (keyword && title.includes(keyword)) { checks.push('✅ KW in Title(15)'); total += 15; }
  else { checks.push('❌ KW missing(0/15)'); }
  
  // 2. Meta desc (10)
  const meta = json.seo?.meta_description || '';
  if (meta.length >= 120 && meta.length <= 165) { checks.push('✅ Meta(10)'); total += 10; }
  else if (meta.length > 0) { checks.push('⚠️ Meta len(5/10)'); total += 5; }
  else { checks.push('❌ No meta(0/10)'); }
  
  // 3. Sections (15)
  const sections = json.article?.sections || [];
  if (sections.length >= 3) { checks.push(`✅ ${sections.length} sects(15)`); total += 15; }
  else { checks.push('❌ Few sects(0/15)'); }
  
  // 4. Word count (10)
  if ((json.article?.word_count || 0) >= 800) { checks.push('✅ Words(10)'); total += 10; }
  else { checks.push('❌ Short(0/10)'); }
  
  // 5. Disclosure (10)
  if (json.article?.disclosure) { checks.push('✅ Disclosure(10)'); total += 10; }
  else { checks.push('❌ No disclosure(0/10)'); }
  
  // 6. Products (10)
  if ((json.article?.products_shortcodes || []).length > 0) { checks.push('✅ Products(10)'); total += 10; }
  else { checks.push('⚠️ No products(5/10)'); total += 5; }
  
  // 7. FAQ (10)
  if (json.faq) { checks.push('✅ FAQ(10)'); total += 10; }
  else if (row[col['Include_FAQ_CP']] !== true) { checks.push('— FAQ skip(10)'); total += 10; }
  else { checks.push('❌ No FAQ(0/10)'); }
  
  // 8. CTAs (10)
  const ctaCount = Object.values(json.ctas || {}).filter(v => v && v.length > 0).length;
  if (ctaCount >= 3) { checks.push(`✅ ${ctaCount} CTAs(10)`); total += 10; }
  else { checks.push('⚠️ Few CTAs(5/10)'); total += 5; }
  
  // 9. Slug (10)
  const slug = json.article?.slug || '';
  if (slug && /^[a-z0-9-]+$/.test(slug)) { checks.push('✅ Slug(10)'); total += 10; }
  else { checks.push('❌ Bad slug(0/10)'); }
  
  return { total, details: checks.join(' | ') };
}


// ============================================================================
// RESOLVE AUTO + HELPERS
// ============================================================================

function cpResolveAuto(c) {
  const r = {...c};
  
  // Content Type → Text Length
  if (r.text_length === 'AUTO' || !r.text_length) {
    const map = { 'TUTORIAL': 'STANDARD', 'RATGEBER': 'STANDARD', 'HOW_TO': 'MEDIUM', 'PROBLEM_SOLVER': 'STANDARD', 'FAQ': 'SHORT', 'VERGLEICH': 'MEDIUM', 'REVIEW': 'MEDIUM', 'LISTICLE': 'STANDARD', 'GLOSSAR': 'MICRO' };
    r.text_length = map[r.content_type] || 'STANDARD';
  }
  const ranges = { 'MICRO': [300,500], 'SHORT': [500,800], 'MEDIUM': [800,1200], 'STANDARD': [1200,1800], 'LONG': [1800,2500], 'DEEP_DIVE': [2500,4000] };
  r.word_min = (ranges[r.text_length] || [1200,1800])[0];
  r.word_max = (ranges[r.text_length] || [1200,1800])[1];
  
  // Products
  if (r.products_count === 'AUTO' || !r.products_count) {
    const map = { 'TUTORIAL': 'FEW', 'RATGEBER': 'SEVERAL', 'REVIEW': 'SINGLE', 'LISTICLE': 'SEVERAL', 'GLOSSAR': 'NONE' };
    r.products_count = map[r.content_type] || 'FEW';
  }
  const prodMap = { 'NONE': 0, 'SINGLE': 1, 'FEW': 3, 'SEVERAL': 5, 'MANY': 8 };
  r.products_resolved = prodMap[r.products_count] || 3;
  
  // Headline
  if (r.headline_type === 'AUTO' || !r.headline_type) {
    const map = { 'TUTORIAL': 'STEP_BY_STEP', 'RATGEBER': 'GUIDE', 'HOW_TO': 'HOW_TO', 'PROBLEM_SOLVER': 'PROBLEM', 'VERGLEICH': 'COMPARISON', 'REVIEW': 'DIRECT', 'LISTICLE': 'NUMBERED_LIST' };
    r.headline_type = map[r.content_type] || 'HOW_TO';
  }
  if (r.headline_strategy === 'AUTO' || !r.headline_strategy) {
    const map = { 'PROBLEM': 'THREAT', 'SOCIAL_PROOF': 'SOCIAL_PROOF', 'CURIOSITY': 'CURIOSITY', 'CARLTON': 'CARLTON', 'MYTH_BUSTER': 'THREAT', 'CONTRARIAN': 'CURIOSITY' };
    r.headline_strategy = map[r.headline_type] || 'GAIN';
  }
  
  return r;
}

function cpGetHeadlinePattern(type) {
  const patterns = {
    'HOW_TO': 'Pattern: "Wie Sie [Ergebnis] — [Zusatznutzen]"',
    'STEP_BY_STEP': 'Pattern: "[Aufgabe]: Schritt für Schritt zum [Ergebnis]"',
    'GUIDE': 'Pattern: "[A] oder [B]? Der große Ratgeber"',
    'QUESTION': 'Pattern: "Welcher [X] für welche [Y]?"',
    'DIRECT': 'Pattern: "[Thema] — [Aspekt 1], [Aspekt 2], [Aspekt 3]"',
    'COMPARISON': 'Pattern: "[A] oder [B]? Direkter Vergleich"',
    'NUMBERED_LIST': 'Pattern: "Die [Zahl] besten [X] für [Y]"',
    'BEST_OF_YEAR': 'Pattern: "Die besten [X] in 2026"',
    'SUPERLATIVE_LIST': 'Pattern: "Die [Zahl] stärksten [X]"',
    'PROBLEM': 'Pattern: "[Problem]? Das können Sie tun"',
    'EVEN_IF': 'Pattern: "[Ergebnis] — selbst wenn [Worst Case]"',
    'BEFORE_AFTER': 'Pattern: "Von [Vorher] zu [Nachher]: So geht\'s"',
    'RESCUE': 'Pattern: "Das hilft wenn [alles schiefgeht]"',
    'IF_THEN': 'Pattern: "Wenn Sie [X], dann brauchen Sie [Y]"',
    'CARLTON': 'Pattern: "Wir zeigen [Gruppe] wie [Ergebnis] — selbst wenn [Worst Case]"',
    'CURIOSITY': 'Pattern: "Was die meisten über [X] nicht wissen"',
    'SOCIAL_PROOF': 'Pattern: "Warum Profis auf [X] schwören"',
    'MYTH_BUSTER': 'Pattern: "Die größte Lüge über [X]"',
    'CONTRARIAN': 'Pattern: "Warum Sie NICHT [X] sollten"',
  };
  return patterns[type] || '';
}

function cpGetContentStructure(type) {
  const structures = {
    'TUTORIAL': `Aufbau: 1.Einleitung 2.Werkzeug&Material(Tabelle) 3.Vorbereitung 4.Schritt-für-Schritt(4-8 Schritte) 5.Häufige Fehler 6.Profi-Tipps 7.Fazit`,
    'RATGEBER': `Aufbau: 1.Einleitung 2.Überblick Kategorien 3.Kaufkriterien 4.Produktvergleich(Tabelle) 5.Empfehlung nach Anwendungsfall 6.Fazit`,
    'HOW_TO': `Aufbau: 1.Kurze Einleitung 2.Was Sie brauchen 3.Anleitung(3-6 Schritte) 4.Zusammenfassung`,
    'PROBLEM_SOLVER': `Aufbau: 1.Problem-Beschreibung 2.Ursache(Diagnose) 3.Lösung(Schritte) 4.Vorbeugung 5.Werkzeug-Empfehlung`,
    'REVIEW': `Aufbau: 1.Erster Eindruck 2.Technische Daten(Tabelle) 3.Praxistest 4.Vorteile 5.Nachteile(ehrlich!) 6.Fazit&Bewertung`,
    'LISTICLE': `Aufbau: 1.Einleitung 2.Listenpunkte(je 100-200 Wörter) 3.Optional:Vergleichstabelle 4.Fazit(Top-Pick)`,
    'VERGLEICH': `Aufbau: 1.Einleitung 2.Kurzvergleich(Tabelle) 3.Produkt A 4.Produkt B 5.Direkter Vergleich 6.Klarer Gewinner`,
  };
  return structures[type] || structures['TUTORIAL'];
}

function cpGetCultureNote() {
  return `=== KULTUR (Deutschland) ===
Gründlich, sicherheitsbewusst. Schutzbrille+Gehörschutz+Staubmaske erwähnen.
Qualitätsorientiert, Preis-Leistung argumentieren. "Sie" durchgängig.`;
}

function cpCleanJson(str) {
  return str.toString().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '').replace(/^\uFEFF/, '').trim();
}

function cpSlugify(str) {
  return (str || 'untitled')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}


// ============================================================================
// MENU INTEGRATION — DODAJ TE WPISY DO ISTNIEJĄCEGO Menu.gs
// ============================================================================

/**
 * INSTRUKCJA INTEGRACJI Z ISTNIEJĄCYM MENU:
 * 
 * W pliku Menu.gs, w submenu Content, DODAJ te wpisy:
 * 
 * .addSubMenu(ui.createMenu('📝 Content')
 *   // ... istniejące wpisy ...
 *   .addSeparator()
 *   .addItem('📋 Pipeline: Setup Columns', 'cpSetupPipelineColumns')
 *   .addItem('🔄 Pipeline: Refresh Domains', 'cpRefreshTargetDomains')
 *   .addSeparator()
 *   .addItem('📝 Pipeline: Generate TEXT Prompt', 'cpGenerateTextPrompts')
 *   .addItem('📝 Pipeline: Parse TEXT Response', 'cpParseTextResponses')
 *   .addSeparator()
 *   .addItem('🖼️ Pipeline: Generate IMAGE Prompt', 'cpGenerateImagePrompts')
 *   .addItem('🖼️ Pipeline: Parse IMAGE Response', 'cpParseImageResponses')
 *   .addSeparator()
 *   .addItem('🎬 Pipeline: Generate VIDEO Prompt', 'cpGenerateVideoPrompts')
 *   .addItem('🎬 Pipeline: Parse VIDEO Response', 'cpParseVideoResponses')
 *   .addSeparator()
 *   .addItem('👁️ Pipeline: Preview Article', 'cpPreviewArticle')
 *   .addItem('📤 Pipeline: Export to WordPress', 'cpExportToWordPress'))
 * 
 * ALTERNATYWNIE — osobne submenu:
 * 
 * .addSubMenu(ui.createMenu('📋 Content Pipeline')
 *   .addItem('⚙️ Setup Pipeline Columns', 'cpSetupPipelineColumns')
 *   .addItem('🔄 Refresh Target Domains', 'cpRefreshTargetDomains')
 *   .addSeparator()
 *   .addItem('📝 Generate TEXT Prompt', 'cpGenerateTextPrompts')
 *   .addItem('📝 Parse TEXT Response', 'cpParseTextResponses')
 *   .addSeparator()
 *   .addItem('🖼️ Generate IMAGE Prompt', 'cpGenerateImagePrompts')
 *   .addItem('🖼️ Parse IMAGE Response', 'cpParseImageResponses')
 *   .addSeparator()
 *   .addItem('🎬 Generate VIDEO Prompt', 'cpGenerateVideoPrompts')
 *   .addItem('🎬 Parse VIDEO Response', 'cpParseVideoResponses')
 *   .addSeparator()
 *   .addItem('👁️ Preview Article', 'cpPreviewArticle')
 *   .addItem('📤 Export to WordPress', 'cpExportToWordPress'))
 */


// ============================================================================
// PREVIEW + EXPORT (szkielety — rozbudować później)
// ============================================================================

function cpPreviewArticle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  const row = sheet.getActiveCell().getRow();
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  const r = data[row - 1];
  const title = r[col['Final_Title_CP']] || 'Ohne Titel';
  const sectionsStr = r[col['Sections_JSON_CP']];
  const score = r[col['Quality_Score_CP']] || '?';
  
  let body = '';
  if (sectionsStr) {
    try {
      const sections = JSON.parse(sectionsStr);
      sections.forEach(s => {
        body += `<h2>${s.heading}</h2>${s.content_html}`;
      });
    } catch (e) {
      body = '<p>JSON parse error</p>';
    }
  }
  
  const html = HtmlService.createHtmlOutput(`
    <style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#1B5E20;border-bottom:3px solid #EF6C00;padding-bottom:10px}h2{color:#37474F;margin-top:25px}.score{position:fixed;top:10px;right:10px;background:#1B5E20;color:white;padding:8px 15px;border-radius:8px;font-size:14px}</style>
    <div class="score">Score: ${score}/100</div>
    <h1>${title}</h1>
    <p style="font-size:12px;color:#999;">${r[col['ID_CP']] || ''}</p>
    ${body}
  `).setWidth(900).setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(html, `👁️ ${title}`);
}

function cpExportToWordPress() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  if (!('▶Export_CP' in col)) {
    SpreadsheetApp.getUi().alert('❌ Kolumny Pipeline nie znalezione.');
    return;
  }
  
  let exported = 0;
  let errors = [];
  
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['▶Export_CP']] !== true) continue;
    
    const sheetRow = r + 1;
    const domain = row[col['Target_Domain_CP']];
    
    // Sprawdź czy jest domena
    if (!domain) {
      errors.push(`Wiersz ${sheetRow}: Brak Target_Domain_CP — wybierz domenę!`);
      continue;
    }
    
    // Sprawdź czy jest content
    const sectionsJson = row[col['Sections_JSON_CP']];
    const title = row[col['Final_Title_CP']];
    if (!sectionsJson || !title) {
      errors.push(`Wiersz ${sheetRow}: Brak sparsowanego tekstu. Uruchom Parse TEXT najpierw.`);
      continue;
    }
    
    try {
      // Pobierz dane site'a z karty Sites (istniejąca funkcja WAAS)
      const site = cpGetSiteData(domain);
      if (!site) {
        errors.push(`Wiersz ${sheetRow}: Nie znaleziono site "${domain}" w karcie Sites.`);
        continue;
      }
      
      // Zbuduj Divi 5 content
      const sections = JSON.parse(sectionsJson);
      const disclosure = row[col['Excerpt_CP']] ? 'Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.' : '';
      const diviContent = cpBuildDivi5Content(sections, disclosure);
      
      // Dane posta
      const postData = {
        title: title,
        slug: row[col['Final_Slug_CP']] || '',
        content: diviContent,
        status: 'draft',
        excerpt: row[col['Excerpt_CP']] || '',
      };
      
      // Wyślij do WP REST API
      const result = cpPublishToWP(site, postData);
      
      if (result.success) {
        const set = (name, val) => {
          if (col[name] !== undefined && val) sheet.getRange(sheetRow, col[name] + 1).setValue(val);
        };
        set('Post_ID_CP', result.postId);
        set('Post_URL_CP', result.postUrl);
        set('Export_Date_CP', new Date().toISOString().split('T')[0]);
        set('Status_CP', '📤 Published');
        sheet.getRange(sheetRow, col['▶Export_CP'] + 1).setValue(false);
        exported++;
      } else {
        errors.push(`Wiersz ${sheetRow}: ${result.error}`);
      }
      
    } catch (e) {
      errors.push(`Wiersz ${sheetRow}: ${e.message}`);
    }
  }
  
  let msg = exported > 0 
    ? `📤 Wyeksportowano ${exported} artykuł(ów) jako DRAFT.\nSprawdź w WordPress → Posts → Drafts.`
    : '⚠️ Brak wierszy do eksportu.';
  if (errors.length > 0) {
    msg += `\n\n⚠️ Błędy (${errors.length}):\n${errors.join('\n')}`;
  }
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Pobiera dane site'a z karty Sites (domena, auth credentials)
 */
function cpGetSiteData(domain) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sitesSheet = ss.getSheetByName('Sites');
  if (!sitesSheet) return null;
  
  const data = sitesSheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);
  
  // Szukaj wiersza z tą domeną
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    // Sprawdź różne kolumny które mogą zawierać domenę
    const possibleCols = ['Domain', 'domain', 'URL', 'url', 'Site URL', 'Name', 'name'];
    let found = false;
    
    for (const name of possibleCols) {
      if (col[name] !== undefined) {
        const val = row[col[name]].toString().trim();
        if (val === domain || val.includes(domain) || domain.includes(val)) {
          found = true;
          break;
        }
      }
    }
    
    if (!found) continue;
    
    // Znaleziono! Zbierz dane
    const get = (name) => col[name] !== undefined ? row[col[name]] : '';
    
    return {
      domain: domain,
      url: domain.startsWith('http') ? domain : `https://${domain}`,
      wpUser: get('WP_User') || get('wp_user') || get('Username') || get('username') || '',
      wpPass: get('WP_App_Password') || get('wp_app_password') || get('App_Password') || get('app_password') || get('Password') || '',
      // Alternatywne kolumny z WAAS
      authUser: get('Auth_User') || get('auth_user') || '',
      authPass: get('Auth_Pass') || get('auth_pass') || '',
    };
  }
  
  return null;
}

/**
 * Buduje Divi 5 block content z sekcji
 */
function cpBuildDivi5Content(sections, disclosure) {
  const DIVI_V = '5.0.0-public-beta.8.2';
  const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\n/g, '\\n');
  
  const sOpen = `<!-- wp:divi/section {"builderVersion":"${DIVI_V}"} -->`;
  const sClose = `<!-- /wp:divi/section -->`;
  const rOpen = `<!-- wp:divi/row {"builderVersion":"${DIVI_V}"} -->`;
  const rClose = `<!-- /wp:divi/row -->`;
  const cOpen = `<!-- wp:divi/column {"builderVersion":"${DIVI_V}"} -->`;
  const cClose = `<!-- /wp:divi/column -->`;
  const heading = (t) => `<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"${esc(t)}"}}}} /-->`;
  const text = (h) => `<!-- wp:divi/text {"content":{"innerContent":{"desktop":{"value":"${esc(h)}"}}}} /-->`;
  
  const parts = ['<!-- wp:divi/placeholder -->'];
  
  // Disclosure
  if (disclosure) {
    parts.push(sOpen, rOpen, cOpen);
    parts.push(text(`<p style="font-size:12px;color:#999;">${disclosure}</p>`));
    parts.push(cClose, rClose, sClose);
  }
  
  // Sections
  sections.forEach(s => {
    parts.push(sOpen, rOpen, cOpen);
    if (s.heading) parts.push(heading(s.heading));
    if (s.content_html) parts.push(text(s.content_html));
    parts.push(cClose, rClose, sClose);
  });
  
  parts.push('<!-- /wp:divi/placeholder -->');
  return parts.join('\n');
}

/**
 * Publikuje post przez WP REST API
 */
function cpPublishToWP(site, postData) {
  const url = `${site.url}/wp-json/wp/v2/posts`;
  const user = site.wpUser || site.authUser;
  const pass = site.wpPass || site.authPass;
  
  if (!user || !pass) {
    // Spróbuj istniejącą funkcję WAAS (jeśli istnieje)
    if (typeof getSiteById === 'function') {
      // WAAS ma swój system auth — spróbuj go użyć
      return { success: false, error: `Brak WP credentials w karcie Sites dla ${site.domain}. Sprawdź kolumny Auth_User/Auth_Pass lub WP_User/WP_App_Password.` };
    }
    return { success: false, error: `Brak WP credentials dla ${site.domain}. Dodaj kolumny WP_User i WP_App_Password w karcie Sites.` };
  }
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(`${user}:${pass}`),
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        title: postData.title,
        slug: postData.slug,
        content: postData.content,
        status: postData.status || 'draft',
        excerpt: postData.excerpt || '',
      }),
      muteHttpExceptions: true,
    });
    
    const code = response.getResponseCode();
    const body = JSON.parse(response.getContentText());
    
    if (code === 201) {
      return { success: true, postId: body.id, postUrl: body.link };
    } else {
      return { success: false, error: `WP API ${code}: ${body.message || 'Unknown error'}` };
    }
  } catch (e) {
    return { success: false, error: `HTTP Error: ${e.message}` };
  }
}


// ============================================================================
// REORGANIZACJA ARKUSZA — ukryj stare kolumny, koloruj, nazwij
// ============================================================================

/**
 * Reorganizuje arkusz Content Queue:
 * 1. Ukrywa stare kolumny WAAS (A-N) — zachowuje dane, ale nie przeszkadzają
 * 2. Zmienia nazwę karty
 * 3. Koloruje kolumny pipeline
 * 4. Ustawia ograniczoną wysokość wierszy
 * 5. Ustawia wrapowanie tekstu na CLIP (nie rozciąga wierszy)
 */
function cpReorganizeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Brak karty Content Queue');
    return;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 1. UKRYJ stare kolumny WAAS (przed ID_CP)
  const cpIdCol = headers.indexOf('ID_CP');
  if (cpIdCol > 0) {
    // Ukryj kolumny A do kolumny przed ID_CP
    sheet.hideColumns(1, cpIdCol);
  }
  
  // 2. ZMIEŃ NAZWĘ karty
  sheet.setName('✍️ Content Pipeline');
  
  // 3. KOLORUJ kolumny pipeline
  const lastRow = Math.max(sheet.getLastRow(), 20);
  const colorMap = {
    // Identyfikacja — żółty
    'ID_CP': '#FFFDE7',
    'Target_Domain_CP': '#FFFDE7',
    
    // Input — biały (domyślny, nic nie robimy)
    
    // Checkboxy Generate — niebieski
    '▶Text_CP': '#BBDEFB',
    '▶ParseText_CP': '#BBDEFB',
    
    // Prompt/Response — jasny niebieski
    'Text_Prompt_CP': '#E3F2FD',
    'Text_Response_CP': '#E3F2FD',
    
    // Checkboxy Image — pomarańczowy
    '▶Image_CP': '#FFE0B2',
    '▶ParseImage_CP': '#FFE0B2',
    'Image_Prompt_CP': '#FFF3E0',
    'Image_Response_CP': '#FFF3E0',
    
    // Checkboxy Video — fioletowy
    '▶Video_CP': '#E1BEE7',
    '▶ParseVideo_CP': '#E1BEE7',
    'Video_Prompt_CP': '#F3E5F5',
    'Video_Response_CP': '#F3E5F5',
    
    // Wynik — jasny zielony
    'Final_Title_CP': '#E8F5E9',
    'Final_Slug_CP': '#E8F5E9',
    'Excerpt_CP': '#E8F5E9',
    'Word_Count_CP': '#E8F5E9',
    
    // Quality — szary
    'Quality_Score_CP': '#F5F5F5',
    'Quality_Details_CP': '#F5F5F5',
    'Status_CP': '#F5F5F5',
    
    // Export — zielony
    'Select_CP': '#C8E6C9',
    '▶Export_CP': '#A5D6A7',
    'Post_ID_CP': '#E8F5E9',
    'Post_URL_CP': '#E8F5E9',
    'Export_Date_CP': '#E8F5E9',
  };
  
  headers.forEach((h, idx) => {
    if (colorMap[h]) {
      sheet.getRange(1, idx + 1, lastRow, 1).setBackground(colorMap[h]);
    }
  });
  
  // 4. NAGŁÓWKI — ciemne tło, biały tekst
  const pipelineStart = cpIdCol >= 0 ? cpIdCol + 1 : 1;
  const pipelineEnd = sheet.getLastColumn();
  
  sheet.getRange(1, pipelineStart, 1, pipelineEnd - pipelineStart + 1)
    .setFontWeight('bold')
    .setFontSize(9)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  
  // 5. WIERSZE — ograniczona wysokość + CLIP (nie rozciąga)
  // Ustaw wszystkie wiersze danych na 42px (2x normalna wysokość)
  for (let r = 2; r <= Math.min(lastRow, 100); r++) {
    sheet.setRowHeight(r, 42);
  }
  
  // Ustaw CLIP dla wszystkich komórek danych (nie wrap!)
  sheet.getRange(2, pipelineStart, Math.min(lastRow - 1, 200), pipelineEnd - pipelineStart + 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  
  // 6. SZEROKOŚCI — kluczowe kolumny szerokie, reszta wąska
  const widthOverrides = {
    'ID_CP': 100,
    'Target_Domain_CP': 200,
    'Content_Type_CP': 110,
    'Headline_Type_CP': 110,
    'Headline_Strategy_CP': 100,
    'Text_Length_CP': 90,
    'Products_Count_CP': 90,
    'Include_FAQ_CP': 70,
    'FAQ_Count_CP': 60,
    'Include_Culture_CP': 70,
    'Working_Title_CP': 250,
    'Primary_Keyword_CP': 180,
    'Secondary_Keywords_CP': 150,
    'Problem_Need_CP': 180,
    'Target_Audience_CP': 130,
    'Product_ASINs_CP': 150,
    'Notes_CP': 150,
    '▶Text_CP': 55,
    'Text_Prompt_CP': 250,
    'Text_Response_CP': 250,
    '▶ParseText_CP': 55,
    'Final_Title_CP': 220,
    'Final_Slug_CP': 140,
    'Excerpt_CP': 180,
    'Sections_JSON_CP': 150,
    'Word_Count_CP': 60,
    'Meta_Description_CP': 180,
    'SEO_Title_CP': 180,
    'Focus_Keyword_CP': 130,
    'Tags_CP': 130,
    'FAQ_JSON_CP': 100,
    'CTAs_JSON_CP': 100,
    '▶Image_CP': 55,
    'Image_Prompt_CP': 200,
    'Image_Response_CP': 200,
    '▶ParseImage_CP': 55,
    '▶Video_CP': 55,
    'Video_Prompt_CP': 200,
    'Video_Response_CP': 200,
    '▶ParseVideo_CP': 55,
    'Quality_Score_CP': 55,
    'Quality_Details_CP': 180,
    'Status_CP': 100,
    'Select_CP': 50,
    '▶Export_CP': 55,
    'Post_ID_CP': 65,
    'Post_URL_CP': 200,
    'Export_Date_CP': 100,
  };
  
  headers.forEach((h, idx) => {
    if (widthOverrides[h]) {
      sheet.setColumnWidth(idx + 1, widthOverrides[h]);
    }
  });
  
  // 7. ZAMRÓŹ kolumny do Target_Domain_CP
  const tdCol = headers.indexOf('Target_Domain_CP');
  if (tdCol >= 0) {
    sheet.setFrozenColumns(tdCol + 1);
  }
  sheet.setFrozenRows(1);
  
  // 8. Tab color
  sheet.setTabColor('#EF6C00');
  
  SpreadsheetApp.getUi().alert(
    '✅ Arkusz zreorganizowany!\n\n' +
    '• Stare kolumny WAAS (A-N) ukryte (dane zachowane)\n' +
    '• Karta przemianowana na "✍️ Content Pipeline"\n' +
    '• Kolumny pokolorowane wg funkcji\n' +
    '• Wiersze ograniczone do 42px (2x normal)\n' +
    '• Tekst obcięty (CLIP) — nie rozciąga wierszy\n\n' +
    'Żeby odkryć stare kolumny: kliknij prawym na nagłówek → Show columns A-N'
  );
}

/**
 * Przywraca dropdowny na istniejących kolumnach (po rename/reorganizacji)
 * Uruchom jeśli dropdowny zniknęły
 */
function cpRestoreDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet not found'); return; }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i + 1; }); // 1-based
  
  var defs = cpGetDropdownDefs();
  var maxRows = Math.max(sheet.getLastRow(), 50);
  
  // Map: column name → dropdown key
  var mapping = {
    'Content_Type_CP': 'content_types',
    'Headline_Type_CP': 'headline_types',
    'Headline_Strategy_CP': 'headline_strategies',
    'Text_Length_CP': 'text_lengths',
    'Products_Count_CP': 'products_count',
    'FAQ_Count_CP': 'faq_counts',
    'Status_CP': 'cp_statuses',
  };
  
  var restored = 0;
  for (var colName in mapping) {
    if (col[colName]) {
      var defKey = mapping[colName];
      if (defs[defKey]) {
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(defs[defKey], true)
          .setAllowInvalid(true)
          .build();
        sheet.getRange(2, col[colName], maxRows, 1).setDataValidation(rule);
        restored++;
      }
    }
  }
  
  // Checkboxes
  var checkboxCols = ['Include_FAQ_CP', 'Include_Culture_CP', '▶Text_CP', '▶ParseText_CP', 
    '▶Image_CP', '▶ParseImage_CP', '▶Video_CP', '▶ParseVideo_CP', '▶Export_CP', '▶AutoGenerate_CP'];
  
  for (var i = 0; i < checkboxCols.length; i++) {
    if (col[checkboxCols[i]]) {
      sheet.getRange(2, col[checkboxCols[i]], maxRows, 1).insertCheckboxes();
      restored++;
    }
  }
  
  SpreadsheetApp.getUi().alert('Przywrócono ' + restored + ' dropdownów i checkboxów.');
}