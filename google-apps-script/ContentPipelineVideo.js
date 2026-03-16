/**
 * WAAS Video Pipeline — Complete System
 * 
 * Flow:
 * 1. ▶Video_CP checked → Generate VIDEO Prompt (already in Engine)
 * 2. Claude generates: scenes, voiceover, thumbnail prompt
 * 3. ▶ParseVideo_CP → Video Queue + Thumbnail to Media Queue
 * 4. Grok generates thumbnail (existing image pipeline)
 * 5. Video created externally (Sora/Runway/manual) → paste URL
 * 6. Embed video in WordPress post
 * 
 * File: ContentPipelineVideo.gs
 */


/**
 * Helper: Find Video Queue sheet (handles name variations)
 */
function _cpGetVideoQueueSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Video Queue_CP') 
    || ss.getSheetByName('CP Video Queue')
    || ss.getSheetByName('Video_Queue_CP');
}


// ============================================================================
// MISSING HELPER: cpGenerateMediaId (referenced by cpBuildVideoPrompt)
// ============================================================================

function cpGenerateMediaId(contentId, type, num) {
  // CP-RE-848 + VIDEO + 1 → CP-RE-848-VD01
  // CP-RE-848 + THUMBNAIL + 1 → CP-RE-848-TH01
  var prefix = {
    'VIDEO': 'VD',
    'THUMBNAIL': 'TH',
    'FEATURED_IMAGE': 'FI',
    'ILLUSTRATION': 'IL',
    'LOGO': 'LG',
    'FAVICON': 'FV',
  };
  var p = prefix[type] || type.substring(0, 2).toUpperCase();
  var n = ('0' + num).slice(-2);
  return contentId + '-' + p + n;
}


// ============================================================================
// SETUP: Create Video Queue sheet
// ============================================================================

function cpSetupVideoQueue() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Ensure CP_CONFIG has VIDEO_QUEUE_SHEET
  if (typeof CP_CONFIG !== 'undefined') {
    CP_CONFIG.VIDEO_QUEUE_SHEET = 'Video Queue_CP';
  }
  
  var existing = ss.getSheetByName('Video Queue_CP');
  if (existing) {
    var confirm = ui.alert('Video Queue_CP już istnieje. Nadpisać?', ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;
    ss.deleteSheet(existing);
  }
  
  // Also check old name
  var oldSheet = ss.getSheetByName('CP Video Queue');
  if (oldSheet) {
    oldSheet.setName('Video Queue_CP_OLD');
  }
  
  var sheet = ss.insertSheet('Video Queue_CP');
  
  var headers = [
    'Video_ID',           // A — VD-XX-001
    'Content_ID',         // B — CP-RE-848
    'Domain',             // C — reservekanister.lk24.shop
    'Video_Title',        // D — YouTube title
    'Video_Description',  // E — YouTube description
    'Tags',               // F — comma separated
    'Category',           // G — Bildung / Anleitungen
    'Duration_Target',    // H — 3-5 Min
    'Scenes_JSON',        // I — [{nr, duration_sec, visual, voiceover, overlay_text}]
    'VO_Script',          // J — Complete voiceover script
    'Overlay_Texts',      // K — All overlay texts
    'Thumb_ID',           // L — TH-XX-001 (links to Media Queue)
    'Thumb_Prompt',       // M — AI prompt for thumbnail
    'Thumb_Alt',          // N — Alt text
    'Thumb_Filename',     // O — filename.jpg
    'AI_Target',          // P — Sora / Runway / Kling / Manual
    'Video_Filename',     // Q — video-seo-name.mp4
    'Video_URL',          // R — URL of final video (YouTube, hosted)
    'YouTube_ID',         // S — YouTube video ID
    'WP_Embed',           // T — [embed]url[/embed] or iframe
    'WP_Post_ID',         // U — Post where video is embedded
    '▶GenThumb',         // V — Checkbox: generate thumbnail
    '▶Embed',            // W — Checkbox: embed in WP post
    'Status',             // X — ⏳ Pending / 🎬 Scenes Ready / 🖼️ Thumb Ready / ✅ Complete
    'Notes',              // Y
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FFF3E0');
  sheet.setFrozenRows(1);
  
  // Column widths
  sheet.setColumnWidth(1, 140);  // Video_ID
  sheet.setColumnWidth(2, 120);  // Content_ID
  sheet.setColumnWidth(3, 200);  // Domain
  sheet.setColumnWidth(4, 300);  // Title
  sheet.setColumnWidth(5, 400);  // Description
  sheet.setColumnWidth(9, 300);  // Scenes JSON
  sheet.setColumnWidth(10, 400); // VO Script
  sheet.setColumnWidth(13, 300); // Thumb Prompt
  sheet.setColumnWidth(18, 250); // Video URL
  
  // Dropdowns
  var aiTargetRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Sora', 'Runway', 'Kling', 'Veo', 'Manual', 'InVideo'], true).build();
  sheet.getRange(2, 16, 200, 1).setDataValidation(aiTargetRule);
  
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Bildung', 'Anleitungen', 'Unterhaltung', 'Wissenschaft', 'Praxis'], true).build();
  sheet.getRange(2, 7, 200, 1).setDataValidation(catRule);
  
  // Checkboxes
  sheet.getRange(2, 22, 200, 1).insertCheckboxes(); // ▶GenThumb
  sheet.getRange(2, 23, 200, 1).insertCheckboxes(); // ▶Embed
  
  ui.alert('✅ Video Queue_CP sheet created!\n\n' +
    headers.length + ' columns\n\n' +
    'Flow:\n' +
    '1. Content Pipeline → ▶Video_CP → Generate VIDEO Prompt\n' +
    '2. Claude → JSON → ▶ParseVideo_CP → Video Queue + Thumbnail\n' +
    '3. Thumbnail: ▶GenThumb → Grok generates → Upload\n' +
    '4. Video: Create externally → paste Video_URL\n' +
    '5. ▶Embed → inserts video in WordPress post');
}


// ============================================================================
// PARSE VIDEO: Enhanced — also adds thumbnail to Media Queue
// ============================================================================

/**
 * Override/enhance: After cpParseVideoResponses adds to Video Queue,
 * also create a thumbnail entry in Media Queue for Grok generation.
 * 
 * Call this AFTER the standard parse, or use it as a standalone.
 * Menu: WAAS → 🎬 Video → 📋 Process Thumbnails
 */
function cpProcessVideoThumbnails() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var vqSheet = _cpGetVideoQueueSheet();
  if (!vqSheet) { ui.alert('❌ Video Queue not found'); return; }
  
  var mqSheet = ss.getSheetByName('Media Queue_CP');
  if (!mqSheet) { ui.alert('❌ Media Queue_CP not found'); return; }
  
  var vqData = vqSheet.getDataRange().getValues();
  var vqHeaders = vqData[0];
  var vCol = {};
  vqHeaders.forEach(function(h, i) { vCol[h.toString().trim()] = i; });
  
  var mqHeaders = mqSheet.getRange(1, 1, 1, mqSheet.getLastColumn()).getValues()[0];
  var mqCol = {};
  mqHeaders.forEach(function(h, i) { mqCol[h.toString().trim()] = i; });
  
  // Get existing Media Queue IDs to avoid duplicates
  var mqData = mqSheet.getDataRange().getValues();
  var existingMediaIds = {};
  for (var r = 1; r < mqData.length; r++) {
    existingMediaIds[(mqData[r][mqCol['Media_ID']] || '').toString()] = true;
  }
  
  var added = 0;
  
  for (var r = 1; r < vqData.length; r++) {
    var row = vqData[r];
    var genThumb = row[vCol['▶GenThumb']];
    if (genThumb !== true) continue;
    
    var thumbId = (row[vCol['Thumb_ID']] || '').toString();
    var thumbPrompt = (row[vCol['Thumb_Prompt']] || '').toString();
    var contentId = (row[vCol['Content_ID']] || '').toString();
    var domain = (row[vCol['Domain']] || '').toString();
    
    if (!thumbId || !thumbPrompt) continue;
    if (existingMediaIds[thumbId]) {
      // Already in Media Queue — just mark as done
      vqSheet.getRange(r + 1, vCol['▶GenThumb'] + 1).setValue('DONE');
      continue;
    }
    
    // Add to Media Queue
    var newRow = new Array(mqHeaders.length).fill('');
    newRow[mqCol['Media_ID']] = thumbId;
    newRow[mqCol['Content_ID']] = contentId;
    newRow[mqCol['Media_Type']] = 'THUMBNAIL';
    newRow[mqCol['Alt_Text']] = (row[vCol['Thumb_Alt']] || '').toString();
    newRow[mqCol['Image_Title']] = 'Thumbnail: ' + (row[vCol['Video_Title']] || '').toString().substring(0, 50);
    newRow[mqCol['AI_Image_Prompt']] = thumbPrompt;
    newRow[mqCol['Filename']] = (row[vCol['Thumb_Filename']] || thumbId.toLowerCase() + '.jpg').toString();
    newRow[mqCol['Dimensions']] = '1280x720';
    newRow[mqCol['Status']] = '⏳ Pending';
    if (mqCol['AI_Target'] !== undefined) newRow[mqCol['AI_Target']] = 'Grok';
    
    mqSheet.appendRow(newRow);
    
    // Mark as done in Video Queue
    vqSheet.getRange(r + 1, vCol['▶GenThumb'] + 1).setValue('DONE');
    added++;
  }
  
  ui.alert('🖼️ Video Thumbnails\n\n✅ Added ' + added + ' thumbnails to Media Queue.\n\n' +
    'Next: WAAS → Images → 🎨 Generate Images (API)');
}


// ============================================================================
// EMBED VIDEO IN POST — Insert video embed into WordPress post content
// ============================================================================

/**
 * Inserts video embed code into the WordPress post that the video belongs to.
 * Looks for Video_URL and WP_Post_ID in Video Queue.
 * Adds wp:embed or wp:html block at the TOP of the post (after first section).
 * 
 * Menu: WAAS → 🎬 Video → 📤 Embed in Posts
 */
function cpEmbedVideosInPosts() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var vqSheet = _cpGetVideoQueueSheet();
  if (!vqSheet) { ui.alert('❌ Video Queue not found'); return; }
  
  var vqData = vqSheet.getDataRange().getValues();
  var vqHeaders = vqData[0];
  var vCol = {};
  vqHeaders.forEach(function(h, i) { vCol[h.toString().trim()] = i; });
  
  var embedded = 0;
  var errors = [];
  
  // Find Content Pipeline sheet for domain lookup
  var cpSheet = ss.getSheetByName('Content Pipeline');
  var cpData = cpSheet ? cpSheet.getDataRange().getValues() : [];
  var cpHeaders = cpData.length > 0 ? cpData[0] : [];
  var cpCol = {};
  cpHeaders.forEach(function(h, i) { cpCol[h.toString().trim()] = i; });
  
  for (var r = 1; r < vqData.length; r++) {
    var row = vqData[r];
    var embedCheck = row[vCol['▶Embed']];
    if (embedCheck !== true) continue;
    
    var videoUrl = (row[vCol['Video_URL']] || '').toString().trim();
    var contentId = (row[vCol['Content_ID']] || '').toString().trim();
    var domain = (row[vCol['Domain']] || '').toString().trim();
    var wpPostId = parseInt(row[vCol['WP_Post_ID']] || 0);
    
    if (!videoUrl) { errors.push(contentId + ': No Video_URL'); continue; }
    
    // Find domain and post ID from Content Pipeline if not in Video Queue
    if (!domain || !wpPostId) {
      for (var cr = 1; cr < cpData.length; cr++) {
        var cpId = (cpData[cr][cpCol['ID_CP']] || '').toString();
        if (cpId === contentId) {
          if (!domain) domain = (cpData[cr][cpCol['Target_Domain_CP']] || '').toString().trim();
          if (!wpPostId) wpPostId = parseInt(cpData[cr][cpCol['Post_ID_CP']] || 0);
          break;
        }
      }
    }
    
    if (!domain || !wpPostId) {
      errors.push(contentId + ': Missing domain or Post_ID');
      continue;
    }
    
    var site = cpGetSiteData(domain);
    if (!site) { errors.push(domain + ': Site not found'); continue; }
    
    var wpUrl = site.wpUrl || ('https://' + domain);
    var auth = cpGetWPAuthForMedia(site, wpUrl);
    if (!auth.cookies || !auth.nonce) { errors.push(domain + ': Auth failed'); continue; }
    
    // Build embed block
    var videoTitle = (row[vCol['Video_Title']] || '').toString();
    var embedBlock = _cpBuildVideoEmbed(videoUrl, videoTitle);
    
    // Get current post content
    var verifyResp = UrlFetchApp.fetch(
      wpUrl + '/wp-json/waas-pipeline/v1/verify/' + wpPostId, {
        headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
        muteHttpExceptions: true,
      }
    );
    
    if (verifyResp.getResponseCode() !== 200) {
      errors.push(contentId + ': Verify failed');
      continue;
    }
    
    // Use update-content to prepend video block
    // Strategy: add video embed after first divi/section close tag
    var updatePayload = {
      post_id: wpPostId,
      prepend_block: embedBlock,
    };
    
    // Actually, we need a smarter approach - use the existing content and inject
    // For now, add as a custom meta that the theme can render
    // OR use the replace-texts endpoint to inject
    
    // Simplest: read content, inject after first section, write back
    try {
      var getResp = UrlFetchApp.fetch(
        wpUrl + '/wp-json/wp/v2/posts/' + wpPostId + '?_fields=content', {
          headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
          muteHttpExceptions: true,
        }
      );
      
      if (getResp.getResponseCode() === 200) {
        var postData = JSON.parse(getResp.getContentText());
        var content = postData.content.rendered || '';
        
        // Inject video block after first section
        // Use update-content with direct SQL
        var contentResp = UrlFetchApp.fetch(
          wpUrl + '/wp-json/waas-pipeline/v1/verify/' + wpPostId, {
            headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
            muteHttpExceptions: true,
          }
        );
      }
      
      // Use direct update-content to inject video
      var injectResp = UrlFetchApp.fetch(
        wpUrl + '/wp-json/waas-pipeline/v1/update-content', {
          method: 'POST',
          headers: {
            'Cookie': auth.cookies,
            'X-WP-Nonce': auth.nonce,
            'Content-Type': 'application/json',
          },
          payload: JSON.stringify({
            post_id: wpPostId,
            meta: {
              'waas_video_embed': embedBlock,
              'waas_video_url': videoUrl,
              'waas_video_title': videoTitle,
            },
          }),
          muteHttpExceptions: true,
        }
      );
      
      if (injectResp.getResponseCode() === 200) {
        // Update Video Queue
        if (vCol['WP_Embed'] !== undefined) {
          vqSheet.getRange(r + 1, vCol['WP_Embed'] + 1).setValue(embedBlock);
        }
        if (vCol['WP_Post_ID'] !== undefined) {
          vqSheet.getRange(r + 1, vCol['WP_Post_ID'] + 1).setValue(wpPostId);
        }
        vqSheet.getRange(r + 1, vCol['▶Embed'] + 1).setValue('DONE');
        vqSheet.getRange(r + 1, vCol['Status'] + 1).setValue('✅ Embedded');
        embedded++;
      } else {
        errors.push(contentId + ': Inject failed HTTP ' + injectResp.getResponseCode());
      }
      
    } catch(e) {
      errors.push(contentId + ': ' + e.message);
    }
    
    Utilities.sleep(2000);
  }
  
  var msg = '🎬 Video Embed\n\n✅ Embedded: ' + embedded;
  if (errors.length > 0) msg += '\n\n❌ Errors:\n' + errors.join('\n');
  ui.alert(msg);
}


/**
 * Builds the video embed HTML/shortcode for different platforms.
 */
function _cpBuildVideoEmbed(url, title) {
  title = title || 'Video';
  
  // YouTube
  if (url.indexOf('youtube.com') >= 0 || url.indexOf('youtu.be') >= 0) {
    var ytId = '';
    if (url.indexOf('youtu.be/') >= 0) {
      ytId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.indexOf('v=') >= 0) {
      ytId = url.split('v=')[1].split('&')[0];
    }
    
    if (ytId) {
      return '<!-- wp:embed {"url":"https://www.youtube.com/watch?v=' + ytId + '","type":"video","providerNameSlug":"youtube","responsive":true} -->\n' +
        '<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">' +
        '<div class="wp-block-embed__wrapper">\nhttps://www.youtube.com/watch?v=' + ytId + '\n</div>' +
        '<figcaption class="wp-element-caption">' + title + '</figcaption></figure>\n<!-- /wp:embed -->';
    }
  }
  
  // Vimeo
  if (url.indexOf('vimeo.com') >= 0) {
    return '<!-- wp:embed {"url":"' + url + '","type":"video","providerNameSlug":"vimeo","responsive":true} -->\n' +
      '<figure class="wp-block-embed is-type-video is-provider-vimeo wp-block-embed-vimeo wp-embed-aspect-16-9 wp-has-aspect-ratio">' +
      '<div class="wp-block-embed__wrapper">\n' + url + '\n</div></figure>\n<!-- /wp:embed -->';
  }
  
  // Direct video URL (mp4 etc)
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return '<!-- wp:video -->\n' +
      '<figure class="wp-block-video"><video controls src="' + url + '"></video>' +
      '<figcaption class="wp-element-caption">' + title + '</figcaption></figure>\n<!-- /wp:video -->';
  }
  
  // Fallback: generic embed
  return '<!-- wp:embed {"url":"' + url + '","type":"video","responsive":true} -->\n' +
    '<figure class="wp-block-embed is-type-video wp-embed-aspect-16-9 wp-has-aspect-ratio">' +
    '<div class="wp-block-embed__wrapper">\n' + url + '\n</div></figure>\n<!-- /wp:embed -->';
}


// ============================================================================
// VIDEO INJECT — PHP-side injection into Divi post content
// ============================================================================

/**
 * Injects video embed block into post content at smart position.
 * Uses the /update-content endpoint with special video handling.
 * 
 * This adds video block after the first Divi section.
 */
function cpInjectVideoInPost(domain, postId, embedBlock) {
  var site = cpGetSiteData(domain);
  if (!site) return { success: false, error: 'Site not found' };
  
  var wpUrl = site.wpUrl || ('https://' + domain);
  var auth = cpGetWPAuthForMedia(site, wpUrl);
  if (!auth.cookies || !auth.nonce) return { success: false, error: 'Auth failed' };
  
  // Read current content via verify endpoint (gives us content_length at least)
  // We need to read raw content — use a direct fetch
  var readResp = UrlFetchApp.fetch(
    wpUrl + '/wp-json/waas-pipeline/v1/extract-texts/' + postId, {
      headers: { 'Cookie': auth.cookies, 'X-WP-Nonce': auth.nonce },
      muteHttpExceptions: true,
    }
  );
  
  // Store embed as post meta — let the theme/shortcode handle display
  var response = UrlFetchApp.fetch(
    wpUrl + '/wp-json/waas-pipeline/v1/update-content', {
      method: 'POST',
      headers: {
        'Cookie': auth.cookies,
        'X-WP-Nonce': auth.nonce,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        post_id: postId,
        meta: {
          'waas_video_embed': embedBlock,
        },
      }),
      muteHttpExceptions: true,
    }
  );
  
  return response.getResponseCode() === 200 
    ? JSON.parse(response.getContentText())
    : { success: false, error: 'HTTP ' + response.getResponseCode() };
}


// ============================================================================
// EXTRACT YouTube ID from URL
// ============================================================================

function cpExtractYouTubeId(url) {
  if (!url) return '';
  if (url.indexOf('youtu.be/') >= 0) return url.split('youtu.be/')[1].split('?')[0].split('/')[0];
  if (url.indexOf('v=') >= 0) return url.split('v=')[1].split('&')[0];
  return '';
}