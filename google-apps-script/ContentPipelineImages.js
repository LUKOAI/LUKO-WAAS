/**
 * WAAS Content Pipeline — Image Generation Module
 * ContentPipelineImages.gs
 * 
 * FLOW:
 * 1. Artykuł gotowy → "Generate Image Prompts" → Claude tworzy prompty
 * 2. Prompty w Media Queue_CP → "Generate Images" → Grok/DALL-E API
 * 3. Obrazy → "Upload to WP" → WordPress Media Library
 * 4. [NEW] → Auto-assign → Featured Image + Illustrations do postów
 * 
 * @version 1.1 — 2026-03-06: Added auto-assign trigger after upload
 */

// ============================================================================
// CONFIG
// ============================================================================

var IMG_CONFIG = {
  // Style
  FEATURED_STYLE: 'Photorealistic, editorial photography, natural lighting, professional composition, clean background, high detail, 4K quality',
  ILLUSTRATION_STYLE: 'Lifestyle photography, authentic scene, natural light, warm tones, practical situation, eye-level perspective',
  
  // Dimensions
  FEATURED_SIZE: '1792x1024',   // 16:9 landscape for blog header
  ILLUSTRATION_SIZE: '1024x1024', // Square for in-content
  
  // Defaults
  DEFAULT_PROVIDER: 'Grok',      // Grok or DALL-E
  IMAGES_PER_ARTICLE: 3,         // 1 featured + 2 illustrations
};

// ============================================================================
// STEP 1: Generate Image Prompts from Article
// ============================================================================

/**
 * Generuje prompty do obrazów na podstawie gotowego artykułu.
 * Czyta Sections_JSON_CP i tworzy wpisy w Media Queue_CP.
 */
function cpGenerateImagePromptsAI() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!sheet) { ui.alert('Sheet not found'); return; }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  // Find ▶Image_CP column (robust: handles unicode ▶)
  var imgCol;
  for (var h in col) {
    if (h.indexOf('Image') >= 0 && h.indexOf('_CP') >= 0 
        && h.indexOf('Prompt') < 0 && h.indexOf('Response') < 0 && h.indexOf('Parse') < 0
        && (h.indexOf('▶') >= 0 || h.indexOf('\u25b6') >= 0 || h.substring(0,1).charCodeAt(0) > 9000)) {
      imgCol = col[h];
      Logger.log('IMAGE: Found checkbox column: "' + h + '" at index ' + imgCol);
      break;
    }
  }
  
  // Fallback: try exact name
  if (imgCol === undefined && col['▶Image_CP'] !== undefined) imgCol = col['▶Image_CP'];
  
  // Fallback 2: search by column header text containing just "Image_CP" with special first char
  if (imgCol === undefined) {
    for (var h in col) {
      if (h.endsWith('Image_CP') && h.length < 15) {
        imgCol = col[h];
        Logger.log('IMAGE: Fallback found: "' + h + '" at index ' + imgCol);
        break;
      }
    }
  }
  
  if (imgCol === undefined) {
    var allHeaders = Object.keys(col).join(', ');
    ui.alert('Kolumna ▶Image_CP nie znaleziona.\n\nHeaders: ' + allHeaders.substring(0, 500));
    return;
  }
  
  Logger.log('IMAGE: imgCol=' + imgCol + ', total rows=' + (data.length - 1));
  
  var generated = 0;
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (row[imgCol] !== true) continue;
    
    var sheetRow = r + 1;
    Logger.log('IMAGE: Processing row ' + sheetRow);
    
    var cpId = (row[col['ID_CP']] || '').toString();
    var domain = (row[col['Target_Domain_CP']] || '').toString();
    var title = (row[col['Final_Title_CP']] || row[col['Working_Title_CP']] || '').toString();
    var keyword = (row[col['Primary_Keyword_CP']] || '').toString();
    var sectionsJson = (row[col['Sections_JSON_CP']] || '').toString();
    var excerpt = (row[col['Excerpt_CP']] || '').toString();
    
    Logger.log('IMAGE: cpId=' + cpId + ', title=' + title.substring(0,50) + ', sections=' + (sectionsJson ? 'YES(' + sectionsJson.length + ')' : 'EMPTY'));
    
    if (!title || !sectionsJson) {
      Logger.log('IMAGE: Row ' + sheetRow + ': SKIPPED - no article data');
      continue;
    }
    
    try {
      var articleSummary = cpSummarizeArticle(title, keyword, excerpt, sectionsJson);
      var prompts = cpCreateImagePrompts(cpId, domain, articleSummary);
      
      if (prompts && prompts.images && prompts.images.length > 0) {
        cpWriteToMediaQueue(ss, prompts.images, cpId, domain);
        generated += prompts.images.length;
      }
      
      sheet.getRange(sheetRow, imgCol + 1).setValue('DONE');
      
    } catch(e) {
      Logger.log('Image prompt error row ' + sheetRow + ': ' + e.message);
      sheet.getRange(sheetRow, imgCol + 1).setValue('ERROR');
    }
  }
  
  ui.alert(generated > 0
    ? 'Wygenerowano ' + generated + ' image prompt(ów) w Media Queue_CP.\n\nNastępny krok: Zaznacz wiersz w Media Queue → Generate Images.'
    : 'Brak wierszy z zaznaczonym ▶Image_CP lub brak danych artykułu.');
}

// ============================================================================
// Summarize article for image context
// ============================================================================

function cpSummarizeArticle(title, keyword, excerpt, sectionsJson) {
  var sections = [];
  try {
    sections = JSON.parse(sectionsJson);
  } catch(e) {
    sections = [];
  }
  
  var headings = sections.map(function(s) { return s.heading || ''; }).join(', ');
  
  var firstContent = '';
  if (sections.length > 0 && sections[0].content_html) {
    firstContent = sections[0].content_html
      .replace(/<[^>]+>/g, '')
      .substring(0, 300);
  }
  
  return {
    title: title,
    keyword: keyword,
    excerpt: excerpt,
    headings: headings,
    firstParagraph: firstContent,
    sectionCount: sections.length
  };
}

// ============================================================================
// Create image prompts using Claude
// ============================================================================

function cpCreateImagePrompts(cpId, domain, articleSummary) {
  var systemPrompt = [
    'Du bist ein professioneller Art Director für Affiliate-Websites.',
    'Du erstellst präzise Bild-Prompts für AI-Bildgeneratoren (Grok Imagine, DALL-E).',
    '',
    'REGELN:',
    '- Featured Image: Fotorealistisch, editorial, professionell, eyecatching',
    '- Illustrationen: Lifestyle, authentische Szene, natürliches Licht, warm',
    '- KEINE Texte im Bild (kein Titel, keine Wasserzeichen)',
    '- KEINE Markenlogos oder erkennbare Markennamen',
    '- KEINE Gesichter direkt frontal (Datenschutz)',
    '- Perspektive: Leicht von oben oder Augenhöhe',
    '- Fokus auf das THEMA des Artikels, nicht auf abstrakte Konzepte',
    '- Prompt auf ENGLISCH (bessere Ergebnisse bei Bildgeneratoren)',
    '- Jeder Prompt: 1-3 Sätze, konkret, visuell beschreibend',
    '',
    'OUTPUT: NUR JSON, kein Text davor oder danach.'
  ].join('\n');
  
  var userPrompt = 'Erstelle Bild-Prompts für diesen Artikel:\n\n' +
    'Titel: ' + articleSummary.title + '\n' +
    'Keyword: ' + articleSummary.keyword + '\n' +
    'Beschreibung: ' + articleSummary.excerpt + '\n' +
    'Sektionen: ' + articleSummary.headings + '\n' +
    'Erster Absatz: ' + articleSummary.firstParagraph + '\n\n' +
    'Generiere 3 Bilder:\n' +
    '1. Featured Image (Hauptbild, 16:9, fotorealistisch)\n' +
    '2. Illustration 1 (im Artikel, 1:1, lifestyle)\n' +
    '3. Illustration 2 (im Artikel, 1:1, lifestyle)\n\n' +
    'JSON Schema:\n' +
    '{\n' +
    '  "images": [\n' +
    '    {\n' +
    '      "type": "FEATURED_IMAGE",\n' +
    '      "prompt_en": "Detailed English prompt for image generation...",\n' +
    '      "alt_text_de": "SEO Alt-Text auf Deutsch",\n' +
    '      "title_de": "Bildtitel auf Deutsch",\n' +
    '      "caption_de": "Kurze Bildunterschrift auf Deutsch",\n' +
    '      "placement": "header"\n' +
    '    }\n' +
    '  ]\n' +
    '}';
  
  var result = cpCallAI(systemPrompt, userPrompt, 'Claude', 0.7, 2000);
  
  if (!result.success) {
    Logger.log('Image prompt AI failed: ' + result.error);
    return cpFallbackImagePrompts(cpId, articleSummary);
  }
  
  var jsonText = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  var firstBrace = jsonText.indexOf('{');
  var lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }
  
  try {
    return JSON.parse(jsonText);
  } catch(e) {
    Logger.log('Image prompt JSON parse error: ' + e.message);
    return cpFallbackImagePrompts(cpId, articleSummary);
  }
}

// ============================================================================
// Fallback prompts (if Claude unavailable)
// ============================================================================

function cpFallbackImagePrompts(cpId, summary) {
  return {
    images: [
      {
        type: 'FEATURED_IMAGE',
        prompt_en: 'Professional editorial photograph of ' + summary.keyword + ', clean workspace, natural lighting, high detail, 4K, photorealistic',
        alt_text_de: summary.keyword + ' - Ratgeber und Anleitung',
        title_de: summary.title,
        caption_de: summary.excerpt.substring(0, 100),
        placement: 'header'
      },
      {
        type: 'ILLUSTRATION',
        prompt_en: 'Lifestyle photo showing practical use of ' + summary.keyword + ' in everyday setting, warm natural light, authentic scene, medium shot',
        alt_text_de: summary.keyword + ' im praktischen Einsatz',
        title_de: summary.keyword + ' Praxisbild',
        caption_de: 'Praktischer Einsatz von ' + summary.keyword,
        placement: 'section_2'
      },
      {
        type: 'ILLUSTRATION',
        prompt_en: 'Close-up detail shot of ' + summary.keyword + ' showing quality and materials, shallow depth of field, studio-like natural light, clean background',
        alt_text_de: summary.keyword + ' Detailansicht',
        title_de: summary.keyword + ' Detail',
        caption_de: 'Detailansicht: Qualität und Verarbeitung',
        placement: 'section_4'
      }
    ]
  };
}

// ============================================================================
// Write prompts to Media Queue
// ============================================================================

function cpWriteToMediaQueue(ss, images, cpId, domain) {
  var sheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!sheet) {
    Logger.log('Media Queue_CP not found, creating...');
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i + 1; }); // 1-based
  
  var slug = (domain || '').replace('.lk24.shop', '');
  var siteCode = slug.substring(0, 2).toUpperCase();
  
  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var mediaType = img.type || (i === 0 ? 'FEATURED_IMAGE' : 'ILLUSTRATION');
    var mediaId = cpId + (mediaType === 'FEATURED_IMAGE' ? '-FI' : '-IL' + String(i).padStart(2, '0'));
    
    var keyword = (img.alt_text_de || '').toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var filename = mediaId.toLowerCase() + '-' + keyword.substring(0, 40) + '.jpg';
    
    var newRow = sheet.getLastRow() + 1;
    
    var set = function(colName, val) {
      if (col[colName] && val) sheet.getRange(newRow, col[colName]).setValue(val);
    };
    
    set('Media_ID', mediaId);
    set('Content_ID', cpId);
    set('Media_Type', mediaType);
    set('Alt_Text', img.alt_text_de || '');
    set('Image_Title', img.title_de || '');
    set('Caption', img.caption_de || '');
    set('AI_Image_Prompt', img.prompt_en || '');
    set('Style_Notes', mediaType === 'FEATURED_IMAGE' ? IMG_CONFIG.FEATURED_STYLE : IMG_CONFIG.ILLUSTRATION_STYLE);
    set('Dimensions', mediaType === 'FEATURED_IMAGE' ? IMG_CONFIG.FEATURED_SIZE : IMG_CONFIG.ILLUSTRATION_SIZE);
    set('AI_Target', IMG_CONFIG.DEFAULT_PROVIDER);
    set('Filename', filename);
    set('Placement', img.placement || '');
    set('Status', '⏳ Pending');
  }
}

// ============================================================================
// STEP 2: Generate Images via API
// ============================================================================

/**
 * Generuje obrazy przez Grok Imagine lub DALL-E API.
 * Czyta prompty z Media Queue_CP, wywołuje API, zapisuje URL.
 */
function cpGenerateImages() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!sheet) { ui.alert('Media Queue_CP nie znaleziona.'); return; }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  
  var generated = 0;
  var errors = [];
  
  Logger.log('GEN_IMG: Total rows in Media Queue: ' + (data.length - 1));
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = (row[col['Status']] || '').toString();
    var prompt = (row[col['AI_Image_Prompt']] || '').toString();
    var target = (row[col['AI_Target']] || IMG_CONFIG.DEFAULT_PROVIDER).toString();
    
    if (status !== '⏳ Pending' || !prompt) continue;
    
    var sheetRow = r + 1;
    var mediaId = (row[col['Media_ID']] || '').toString();
    var dimensions = (row[col['Dimensions']] || '1024x1024').toString();
    
    try {
      sheet.getRange(sheetRow, col['Status'] + 1).setValue('🎨 Generating...');
      SpreadsheetApp.flush();
      
      var result;
      if (target === 'DALL-E' || target === 'OpenAI') {
        result = cpCallDALLE(prompt, dimensions);
      } else {
        result = cpCallGrokImagine(prompt, dimensions);
      }
      
      if (result.success) {
        sheet.getRange(sheetRow, col['File_URL'] + 1).setValue(result.url);
        sheet.getRange(sheetRow, col['Status'] + 1).setValue('✅ Ready');
        generated++;
        Logger.log('Generated image: ' + mediaId + ' → ' + result.url);
      } else {
        sheet.getRange(sheetRow, col['Status'] + 1).setValue('❌ Error');
        errors.push(mediaId + ': ' + result.error);
      }
      
      Utilities.sleep(3000);
      
    } catch(e) {
      sheet.getRange(sheetRow, col['Status'] + 1).setValue('❌ Error');
      errors.push(mediaId + ': ' + e.message);
    }
  }
  
  var msg = 'Wygenerowano ' + generated + ' obraz(ów).';
  if (errors.length > 0) {
    msg += '\n\nBłędy:\n' + errors.join('\n');
  }
  if (generated > 0) {
    msg += '\n\nNastępny krok: Upload to WordPress (przycisk w Media Queue).';
  }
  ui.alert(msg);
}

// ============================================================================
// Grok Imagine API
// ============================================================================

function cpCallGrokImagine(prompt, dimensions) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GROK_API_KEY');
  if (!apiKey) return { success: false, error: 'Brak GROK_API_KEY' };
  
  var payload = {
    model: 'grok-imagine-image',
    prompt: prompt,
    n: 1
  };
  
  var options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch('https://api.x.ai/v1/images/generations', options);
    var code = response.getResponseCode();
    var body;
    
    try {
      body = JSON.parse(response.getContentText());
    } catch(e) {
      return { success: false, error: 'HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
    }
    
    if (code === 200 && body.data && body.data[0]) {
      var url = body.data[0].url || body.data[0].b64_json;
      return { success: true, url: url };
    } else {
      var errMsg = body.error ? body.error.message : ('HTTP ' + code);
      return { success: false, error: errMsg };
    }
  } catch(e) {
    return { success: false, error: 'Grok Imagine: ' + e.message };
  }
}

// ============================================================================
// DALL-E 3 API
// ============================================================================

function cpCallDALLE(prompt, dimensions) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return { success: false, error: 'Brak OPENAI_API_KEY' };
  
  var size = '1024x1024';
  if (dimensions) {
    var parts = dimensions.split('x');
    if (parts.length === 2) {
      var w = parseInt(parts[0]);
      var h = parseInt(parts[1]);
      if (w > h) size = '1792x1024';
      else if (h > w) size = '1024x1792';
    }
  }
  
  var payload = {
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: size,
    quality: 'standard'
  };
  
  var options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch('https://api.openai.com/v1/images/generations', options);
    var code = response.getResponseCode();
    var body;
    
    try {
      body = JSON.parse(response.getContentText());
    } catch(e) {
      return { success: false, error: 'HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
    }
    
    if (code === 200 && body.data && body.data[0]) {
      return { success: true, url: body.data[0].url };
    } else {
      var errMsg = body.error ? body.error.message : ('HTTP ' + code);
      return { success: false, error: errMsg };
    }
  } catch(e) {
    return { success: false, error: 'DALL-E: ' + e.message };
  }
}

// ============================================================================
// STEP 3: Upload Images to WordPress
// ============================================================================

/**
 * Uploaduje wygenerowane obrazy do WordPress Media Library.
 * Czyta URL z Media Queue, pobiera obraz, uploaduje do WP, zapisuje WP_Media_ID.
 * 
 * [v1.1] Po uploadzie oferuje automatyczne przypisanie do postów.
 */
function cpUploadImagesToWP() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  if (!mqSheet) { ui.alert('Media Queue_CP nie znaleziona.'); return; }
  
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  
  var data = mqSheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  
  var uploaded = 0;
  var errors = [];
  
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = (row[col['Status']] || '').toString();
    var fileUrl = (row[col['File_URL']] || '').toString();
    var filename = (row[col['Filename']] || '').toString();
    var altText = (row[col['Alt_Text']] || '').toString();
    var title = (row[col['Image_Title']] || '').toString();
    var caption = (row[col['Caption']] || '').toString();
    var contentId = (row[col['Content_ID']] || '').toString();
    
    if (status !== '✅ Ready' || !fileUrl) continue;
    
    var sheetRow = r + 1;
    
    try {
      var domain = cpFindDomainForContentId(cpSheet, contentId);
      if (!domain) {
        errors.push(filename + ': Domain nicht gefunden für ' + contentId);
        continue;
      }
      
      var site = cpGetSiteData(domain);
      if (!site) {
        errors.push(filename + ': Site nicht gefunden für ' + domain);
        continue;
      }
      
      Logger.log('IMG_UPLOAD: Downloading from: ' + fileUrl.substring(0, 80) + '...');
      var imageResponse = UrlFetchApp.fetch(fileUrl, { muteHttpExceptions: true });
      var imageBlob = imageResponse.getBlob();
      
      var fname = filename || 'image.jpg';
      if (!fname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) fname += '.jpg';
      imageBlob.setName(fname);
      
      if (fname.match(/\.png$/i)) {
        imageBlob.setContentType('image/png');
      } else if (fname.match(/\.webp$/i)) {
        imageBlob.setContentType('image/webp');
      } else {
        imageBlob.setContentType('image/jpeg');
      }
      
      Logger.log('IMG_UPLOAD: Blob name=' + imageBlob.getName() + ', type=' + imageBlob.getContentType() + ', size=' + imageBlob.getBytes().length);
      
      var result = cpUploadMediaToWP(site, imageBlob, {
        alt_text: altText,
        title: title,
        caption: caption
      });
      
      if (result.success) {
        mqSheet.getRange(sheetRow, col['WP_Media_ID'] + 1).setValue(result.mediaId);
        mqSheet.getRange(sheetRow, col['WP_Media_URL'] + 1).setValue(result.mediaUrl);
        mqSheet.getRange(sheetRow, col['Status'] + 1).setValue('📤 Uploaded');
        uploaded++;
      } else {
        errors.push(filename + ': ' + result.error);
      }
      
      Utilities.sleep(2000);
      
    } catch(e) {
      errors.push(filename + ': ' + e.message);
    }
  }
  
  // ======================================================================
  // [v1.1 PATCH] Auto-assign dialog after successful upload
  // ======================================================================
  var msg = 'Uploadowano ' + uploaded + ' obraz(ów) do WordPress.';
  if (errors.length > 0) msg += '\n\nBłędy:\n' + errors.join('\n');
  
  if (uploaded > 0) {
    var autoAssign = ui.alert(
      '📤 Upload Complete',
      msg + '\n\n────────────────────\n\nCzy przypisać obrazy do postów teraz?\n' +
      '• Featured Image → ustawiony na poście\n' +
      '• Illustrations → wstawione w treść artykułu',
      ui.ButtonSet.YES_NO
    );
    if (autoAssign === ui.Button.YES) {
      cpAutoAssignAfterUpload();
      ui.alert('✅ Obrazy przypisane do postów!\n\nSprawdź kolumnę Status w Media Queue:\n' +
        '🖼️ Featured Set = Featured Image ustawiony\n' +
        '📎 In Content = Ilustracja wstawiona w treść');
    }
  } else {
    ui.alert(msg);
  }
}

// ============================================================================
// Helper: Find domain for content ID
// ============================================================================

function cpFindDomainForContentId(cpSheet, contentId) {
  if (!cpSheet || !contentId) return null;
  
  var data = cpSheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h.toString().trim()] = i; });
  
  for (var r = 1; r < data.length; r++) {
    var id = (data[r][col['ID_CP']] || '').toString();
    if (id === contentId) {
      return (data[r][col['Target_Domain_CP']] || '').toString();
    }
  }
  return null;
}

// ============================================================================
// Upload single media to WordPress
// ============================================================================

function cpUploadMediaToWP(site, blob, metadata) {
  try {
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    var authData = cpGetWPAuthForMedia(site, wpUrl);
    
    if (!authData.cookies || !authData.nonce) {
      return { success: false, error: 'Auth fehlgeschlagen für ' + site.domain };
    }
    
    Logger.log('IMG_UPLOAD: Uploading ' + blob.getName() + ' to ' + wpUrl);
    
    var endpoint = wpUrl + '/wp-json/wp/v2/media';
    
    var resp = UrlFetchApp.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Cookie': authData.cookies,
        'X-WP-Nonce': authData.nonce,
        'Content-Disposition': 'attachment; filename="' + blob.getName() + '"'
      },
      payload: blob.getBytes(),
      contentType: blob.getContentType() || 'image/jpeg',
      muteHttpExceptions: true
    });
    
    var code = resp.getResponseCode();
    Logger.log('IMG_UPLOAD: Response HTTP ' + code);
    
    if (code === 201) {
      var body = JSON.parse(resp.getContentText());
      var mediaId = body.id;
      var mediaUrl = body.source_url || (body.guid ? body.guid.rendered : '');
      
      if (metadata.alt_text || metadata.caption || metadata.title) {
        var metaUpdate = {};
        if (metadata.alt_text) metaUpdate.alt_text = metadata.alt_text;
        if (metadata.caption) metaUpdate.caption = metadata.caption;
        if (metadata.title) metaUpdate.title = metadata.title;
        
        UrlFetchApp.fetch(endpoint + '/' + mediaId, {
          method: 'POST',
          headers: {
            'Cookie': authData.cookies,
            'X-WP-Nonce': authData.nonce,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify(metaUpdate),
          muteHttpExceptions: true
        });
      }
      
      return { success: true, mediaId: mediaId, mediaUrl: mediaUrl };
    } else {
      var errText = resp.getContentText().substring(0, 300);
      Logger.log('IMG_UPLOAD: Failed: ' + errText);
      return { success: false, error: 'WP upload HTTP ' + code + ': ' + errText };
    }
  } catch(e) {
    return { success: false, error: 'Upload error: ' + e.message };
  }
}

// ============================================================================
// [DEPRECATED] Old Set Featured Image — replaced by ContentPipelineImageAssign.gs
// Zostawione dla kompatybilności wstecznej. Nowa wersja: cpAssignImagesToPosts()
// ============================================================================

function cpSetFeaturedImages() {
  // Redirect to new implementation
  cpMenuAssignFeaturedImages();
}

// ============================================================================
// TEST: Generate single test image
// ============================================================================

function cpTestImageGeneration() {
  var ui = SpreadsheetApp.getUi();
  var provider = IMG_CONFIG.DEFAULT_PROVIDER;
  
  var result;
  if (provider === 'DALL-E') {
    result = cpCallDALLE('A professional photograph of a red fuel canister on a clean white background, studio lighting, product photography', '1024x1024');
  } else {
    result = cpCallGrokImagine('A professional photograph of a red fuel canister on a clean white background, studio lighting, product photography', '1024x1024');
  }
  
  if (result.success) {
    ui.alert('Test OK!\n\nProvider: ' + provider + '\nURL: ' + result.url);
  } else {
    ui.alert('Test FAILED!\n\nProvider: ' + provider + '\nError: ' + result.error);
  }
}

// ============================================================================
// Helper: Get WordPress auth cookies + nonce for media upload
// ============================================================================

function cpGetWPAuthForMedia(site, wpUrl) {
  try {
    var loginUrl = wpUrl + '/wp-login.php';
    var user = site.adminUser;
    var pass = site.adminPass || site.appPassword;
    
    if (!user || !pass) return { cookies: null, nonce: null };
    
    // Step 1: Login to get cookies
    var loginPayload = 'log=' + encodeURIComponent(user) + 
                       '&pwd=' + encodeURIComponent(pass) + 
                       '&wp-submit=Log+In&redirect_to=' + encodeURIComponent(wpUrl + '/wp-admin/') +
                       '&testcookie=1';
    
    var loginResp = UrlFetchApp.fetch(loginUrl, {
      method: 'POST',
      payload: loginPayload,
      contentType: 'application/x-www-form-urlencoded',
      followRedirects: false,
      muteHttpExceptions: true
    });
    
    var allHeaders = loginResp.getAllHeaders();
    var setCookies = allHeaders['Set-Cookie'] || [];
    if (!Array.isArray(setCookies)) setCookies = [setCookies];
    
    var cookieStr = setCookies.map(function(c) {
      return c.split(';')[0];
    }).join('; ');
    
    if (!cookieStr) {
      Logger.log('IMG_AUTH: No cookies received from login');
      return { cookies: null, nonce: null };
    }
    
    // Step 2: Get nonce from REST API
    var nonceResp = UrlFetchApp.fetch(wpUrl + '/wp-admin/admin-ajax.php?action=rest-nonce', {
      method: 'GET',
      headers: { 'Cookie': cookieStr },
      muteHttpExceptions: true
    });
    
    var nonce = nonceResp.getContentText().trim();
    
    // If nonce is 0 or HTML, try alternative method
    if (!nonce || nonce === '0' || nonce.indexOf('<') >= 0) {
      var postNewResp = UrlFetchApp.fetch(wpUrl + '/wp-admin/post-new.php', {
        method: 'GET',
        headers: { 'Cookie': cookieStr },
        muteHttpExceptions: true
      });
      var postNewHtml = postNewResp.getContentText();
      var nonceMatch = postNewHtml.match(/wpApiSettings[^}]*"nonce":"([^"]+)"/);
      if (nonceMatch) nonce = nonceMatch[1];
    }
    
    Logger.log('IMG_AUTH: Got cookies (' + cookieStr.length + ' chars) + nonce: ' + (nonce ? nonce.substring(0,6) + '...' : 'NONE'));
    
    return { cookies: cookieStr, nonce: nonce };
    
  } catch(e) {
    Logger.log('IMG_AUTH: Error: ' + e.message);
    return { cookies: null, nonce: null };
  }
}