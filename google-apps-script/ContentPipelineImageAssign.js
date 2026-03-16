/**
 * WAAS Content Pipeline — Image Assignment Module
 * ContentPipelineImageAssign.gs
 * 
 * Assigns uploaded images TO posts:
 * 1. Featured Image → WP REST API featured_media
 * 2. Illustrations → wp:image blocks inserted in post content
 * 
 * [v1.1] FIX: Doubles backslashes before REST API POST to protect
 *        Divi 5 encoding (\u003c etc.) from wp_unslash() destruction.
 * 
 * Dependencies:
 *   - ContentPipelineImages.gs  → cpGetWPAuthForMedia()
 *   - ContentPipeline.gs       → CP_CONFIG, cpGetSiteData()
 * 
 * @version 1.1
 * @date 2026-03-06
 */

// ============================================================================
// MASTER FUNCTION: Assign All Images to Posts
// ============================================================================

function cpAssignImagesToPosts() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  
  if (!mqSheet || !cpSheet) {
    ui.alert('❌ Brakujące arkusze:\n' +
      (!mqSheet ? '- ' + CP_CONFIG.MEDIA_QUEUE_SHEET + '\n' : '') +
      (!cpSheet ? '- ' + CP_CONFIG.CONTENT_QUEUE_SHEET : ''));
    return;
  }
  
  var fiResult = _cpAssignFeaturedImages(ss, mqSheet, cpSheet);
  var ilResult = _cpInsertIllustrations(ss, mqSheet, cpSheet);
  
  var msg = '🖼️ Image Assignment Complete\n\n';
  msg += '✅ Featured Images assigned: ' + fiResult.success + '\n';
  msg += '✅ Illustrations inserted: ' + ilResult.success + '\n';
  
  if (fiResult.skipped > 0 || ilResult.skipped > 0) {
    msg += '\n⏭️ Skipped (already done): ' + (fiResult.skipped + ilResult.skipped) + '\n';
  }
  
  var allErrors = fiResult.errors.concat(ilResult.errors);
  if (allErrors.length > 0) {
    msg += '\n❌ Errors (' + allErrors.length + '):\n' + allErrors.join('\n');
  }
  
  ui.alert(msg);
}


// ============================================================================
// STEP 1: Assign Featured Images via REST API
// ============================================================================

function _cpAssignFeaturedImages(ss, mqSheet, cpSheet) {
  var result = { success: 0, skipped: 0, errors: [] };
  
  var mqData = mqSheet.getDataRange().getValues();
  var mqCol = _cpBuildColumnMap(mqData[0]);
  
  var cpData = cpSheet.getDataRange().getValues();
  var cpCol = _cpBuildColumnMap(cpData[0]);
  
  var authCache = {};
  
  for (var r = 1; r < mqData.length; r++) {
    var row = mqData[r];
    var mediaType = _cpStr(row, mqCol, 'Media_Type');
    var wpMediaId = row[mqCol['WP_Media_ID']];
    var contentId = _cpStr(row, mqCol, 'Content_ID');
    var status = _cpStr(row, mqCol, 'Status');
    var mediaId = _cpStr(row, mqCol, 'Media_ID');
    var sheetRow = r + 1;
    
    if (mediaType !== 'FEATURED_IMAGE') continue;
    if (!wpMediaId) continue;
    if (status === '🖼️ Featured Set') { result.skipped++; continue; }
    if (status !== '📤 Uploaded') continue;
    
    Logger.log('FI: ' + mediaId + ' → WP_Media_ID=' + wpMediaId + ', Content=' + contentId);
    
    var postInfo = _cpFindPostInfo(cpData, cpCol, contentId);
    if (!postInfo) {
      result.errors.push(mediaId + ': Content_ID "' + contentId + '" nie znaleziony w Content Queue');
      continue;
    }
    if (!postInfo.postId) {
      result.errors.push(mediaId + ': Post_ID_CP pusty dla ' + contentId + ' — post jeszcze nie opublikowany?');
      continue;
    }
    
    var site = cpGetSiteData(postInfo.domain);
    if (!site) {
      result.errors.push(mediaId + ': Site nie znaleziony: ' + postInfo.domain);
      continue;
    }
    
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    if (!authCache[postInfo.domain]) {
      authCache[postInfo.domain] = cpGetWPAuthForMedia(site, wpUrl);
    }
    var auth = authCache[postInfo.domain];
    
    if (!auth.cookies || !auth.nonce) {
      result.errors.push(mediaId + ': Auth fehlgeschlagen für ' + postInfo.domain);
      continue;
    }
    
    // Featured Image: only sets featured_media (integer), no content change
    // This is SAFE — wp_unslash doesn't affect integer values
    try {
      var resp = UrlFetchApp.fetch(wpUrl + '/wp-json/wp/v2/posts/' + postInfo.postId, {
        method: 'POST',
        headers: {
          'Cookie': auth.cookies,
          'X-WP-Nonce': auth.nonce,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({ featured_media: parseInt(wpMediaId) }),
        muteHttpExceptions: true
      });
      
      var code = resp.getResponseCode();
      
      if (code === 200) {
        var body = JSON.parse(resp.getContentText());
        if (parseInt(body.featured_media) === parseInt(wpMediaId)) {
          mqSheet.getRange(sheetRow, mqCol['Status'] + 1).setValue('🖼️ Featured Set');
          result.success++;
          Logger.log('FI: ✅ Post ' + postInfo.postId + ' → featured_media=' + wpMediaId);
        } else {
          result.errors.push(mediaId + ': API returned featured_media=' + body.featured_media + ' (expected ' + wpMediaId + ')');
        }
      } else {
        result.errors.push(mediaId + ': HTTP ' + code + ' — ' + resp.getContentText().substring(0, 150));
      }
    } catch(e) {
      result.errors.push(mediaId + ': ' + e.message);
    }
    
    Utilities.sleep(1000);
  }
  
  Logger.log('FI: Done. success=' + result.success + ', errors=' + result.errors.length);
  return result;
}


// ============================================================================
// STEP 2: Insert Illustrations into Post Content
// ============================================================================

function _cpInsertIllustrations(ss, mqSheet, cpSheet) {
  var result = { success: 0, skipped: 0, errors: [] };
  
  var mqData = mqSheet.getDataRange().getValues();
  var mqCol = _cpBuildColumnMap(mqData[0]);
  
  var cpData = cpSheet.getDataRange().getValues();
  var cpCol = _cpBuildColumnMap(cpData[0]);
  
  // Group illustrations by Content_ID
  var byPost = {};
  
  for (var r = 1; r < mqData.length; r++) {
    var row = mqData[r];
    var mediaType = _cpStr(row, mqCol, 'Media_Type');
    var status = _cpStr(row, mqCol, 'Status');
    var wpMediaUrl = _cpStr(row, mqCol, 'WP_Media_URL');
    var contentId = _cpStr(row, mqCol, 'Content_ID');
    
    if (mediaType !== 'ILLUSTRATION') continue;
    if (status === '📎 In Content') { result.skipped++; continue; }
    if (status !== '📤 Uploaded') continue;
    if (!wpMediaUrl || !contentId) continue;
    
    if (!byPost[contentId]) byPost[contentId] = [];
    
    byPost[contentId].push({
      sheetRow: r + 1,
      mediaId: _cpStr(row, mqCol, 'Media_ID'),
      wpMediaId: row[mqCol['WP_Media_ID']],
      wpMediaUrl: wpMediaUrl,
      altText: _cpStr(row, mqCol, 'Alt_Text'),
      caption: _cpStr(row, mqCol, 'Caption'),
      placement: _cpStr(row, mqCol, 'Placement') || 'article'
    });
  }
  
  var postCount = Object.keys(byPost).length;
  Logger.log('IL: Found illustrations for ' + postCount + ' post(s)');
  if (postCount === 0) return result;
  
  var authCache = {};
  
  for (var contentId in byPost) {
    var illustrations = byPost[contentId];
    
    var postInfo = _cpFindPostInfo(cpData, cpCol, contentId);
    if (!postInfo || !postInfo.postId) {
      illustrations.forEach(function(il) {
        result.errors.push(il.mediaId + ': Post nie znaleziony dla ' + contentId);
      });
      continue;
    }
    
    var site = cpGetSiteData(postInfo.domain);
    if (!site) {
      illustrations.forEach(function(il) {
        result.errors.push(il.mediaId + ': Site nie znaleziony: ' + postInfo.domain);
      });
      continue;
    }
    
    var wpUrl = site.wpUrl || ('https://' + site.domain);
    
    if (!authCache[postInfo.domain]) {
      authCache[postInfo.domain] = cpGetWPAuthForMedia(site, wpUrl);
    }
    var auth = authCache[postInfo.domain];
    if (!auth.cookies || !auth.nonce) {
      illustrations.forEach(function(il) {
        result.errors.push(il.mediaId + ': Auth fehlgeschlagen für ' + postInfo.domain);
      });
      continue;
    }
    
    // === GET current post content (raw) ===
    try {
      var getResp = UrlFetchApp.fetch(
        wpUrl + '/wp-json/wp/v2/posts/' + postInfo.postId + '?context=edit', {
          method: 'GET',
          headers: {
            'Cookie': auth.cookies,
            'X-WP-Nonce': auth.nonce
          },
          muteHttpExceptions: true
        }
      );
      
      if (getResp.getResponseCode() !== 200) {
        illustrations.forEach(function(il) {
          result.errors.push(il.mediaId + ': GET post HTTP ' + getResp.getResponseCode());
        });
        continue;
      }
      
      var postBody = JSON.parse(getResp.getContentText());
      var currentContent = '';
      
      if (postBody.content && postBody.content.raw) {
        currentContent = postBody.content.raw;
      } else if (postBody.content && postBody.content.rendered) {
        currentContent = postBody.content.rendered;
      }
      
      Logger.log('IL: Post ' + postInfo.postId + ' content: ' + currentContent.length + ' chars');
      
      // --- Idempotency check ---
      var toInsert = [];
      for (var i = 0; i < illustrations.length; i++) {
        var il = illustrations[i];
        if (currentContent.indexOf(il.wpMediaUrl) >= 0) {
          Logger.log('IL: ' + il.mediaId + ' already in content → skip');
          mqSheet.getRange(il.sheetRow, mqCol['Status'] + 1).setValue('📎 In Content');
          result.skipped++;
        } else {
          toInsert.push(il);
        }
      }
      
      if (toInsert.length === 0) {
        Logger.log('IL: All illustrations already present in post ' + postInfo.postId);
        continue;
      }
      
      // --- Insert image blocks ---
      var newContent = _cpInsertImageBlocks(currentContent, toInsert);
      
      // ================================================================
      // CRITICAL FIX: Protect Divi 5 encoding from wp_unslash()
      // ================================================================
      // WordPress REST API internally calls wp_update_post() → wp_unslash()
      // which strips single backslashes. Divi 5 content uses \u003c etc.
      // wp_unslash: \u003c → u003c (BROKEN!)
      // Fix: Double all backslashes BEFORE sending.
      // wp_unslash: \\u003c → \u003c (CORRECT!)
      // ================================================================
      var protectedContent = _cpProtectBackslashes(newContent);
      
      Logger.log('IL: Content protected. Original: ' + newContent.length + ' chars → Protected: ' + protectedContent.length + ' chars');
      
      // --- POST updated content ---
      var putResp = UrlFetchApp.fetch(
        wpUrl + '/wp-json/wp/v2/posts/' + postInfo.postId, {
          method: 'POST',
          headers: {
            'Cookie': auth.cookies,
            'X-WP-Nonce': auth.nonce,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ content: protectedContent }),
          muteHttpExceptions: true
        }
      );
      
      var putCode = putResp.getResponseCode();
      Logger.log('IL: POST update post ' + postInfo.postId + ' → HTTP ' + putCode);
      
      if (putCode === 200) {
        // Verify that encoding survived
        var verifyResp = UrlFetchApp.fetch(
          wpUrl + '/wp-json/wp/v2/posts/' + postInfo.postId + '?context=edit&_fields=content', {
            method: 'GET',
            headers: {
              'Cookie': auth.cookies,
              'X-WP-Nonce': auth.nonce
            },
            muteHttpExceptions: true
          }
        );
        
        var verifyOk = true;
        if (verifyResp.getResponseCode() === 200) {
          var verifyBody = JSON.parse(verifyResp.getContentText());
          var savedContent = (verifyBody.content && verifyBody.content.raw) || '';
          
          // Check for broken encoding
          if (savedContent.indexOf('u003c') >= 0 && savedContent.indexOf('\\u003c') < 0) {
            // Encoding is broken! u003c without preceding backslash
            Logger.log('IL: ⚠️ WARNING: Encoding may be broken after save! Found bare u003c');
            verifyOk = false;
          }
        }
        
        toInsert.forEach(function(il) {
          mqSheet.getRange(il.sheetRow, mqCol['Status'] + 1).setValue(verifyOk ? '📎 In Content' : '⚠️ Encoding?');
          result.success++;
        });
        
        if (verifyOk) {
          Logger.log('IL: ✅ ' + toInsert.length + ' illustrations → post ' + postInfo.postId + ' (encoding OK)');
        } else {
          Logger.log('IL: ⚠️ ' + toInsert.length + ' illustrations inserted but ENCODING MAY BE BROKEN');
        }
        
      } else {
        var errBody = putResp.getContentText().substring(0, 200);
        Logger.log('IL: ❌ POST failed: ' + errBody);
        toInsert.forEach(function(il) {
          result.errors.push(il.mediaId + ': POST update HTTP ' + putCode);
        });
      }
      
    } catch(e) {
      Logger.log('IL: Exception: ' + e.message);
      illustrations.forEach(function(il) {
        result.errors.push(il.mediaId + ': ' + e.message);
      });
    }
    
    Utilities.sleep(2000);
  }
  
  Logger.log('IL: Done. success=' + result.success + ', skipped=' + result.skipped + ', errors=' + result.errors.length);
  return result;
}


// ============================================================================
// CRITICAL: Protect backslashes from wp_unslash()
// ============================================================================

/**
 * WordPress REST API runs content through wp_unslash() which strips backslashes.
 * Divi 5 content relies on \u003c \u003e \u0022 etc.
 * 
 * wp_unslash(\u003c) → u003c  ← BROKEN!
 * wp_unslash(\\u003c) → \u003c ← CORRECT!
 * 
 * This function doubles ALL backslashes in the content string.
 * After wp_unslash strips one layer, the original encoding is preserved.
 */
function _cpProtectBackslashes(content) {
  if (!content) return content;
  
  // Double all backslashes: \ → \\
  // This protects \u003c → \\u003c → after wp_unslash → \u003c
  return content.replace(/\\/g, '\\\\');
}


// ============================================================================
// Build wp:image Block (Standard WordPress Block)
// ============================================================================

function _cpBuildImageBlock(wpMediaId, imageUrl, altText, caption) {
  var id = parseInt(wpMediaId) || 0;
  var alt = (altText || '').replace(/"/g, '&quot;');
  var cap = (caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  var block = '';
  block += '<!-- wp:image {"id":' + id + ',"sizeSlug":"large","linkDestination":"none"} -->\n';
  block += '<figure class="wp-block-image size-large">';
  block += '<img src="' + imageUrl + '" alt="' + alt + '" class="wp-image-' + id + '"/>';
  
  if (cap) {
    block += '<figcaption class="wp-element-caption">' + cap + '</figcaption>';
  }
  
  block += '</figure>\n';
  block += '<!-- /wp:image -->';
  
  return block;
}


// ============================================================================
// Insert Image Blocks at Smart Positions
// ============================================================================

function _cpInsertImageBlocks(content, illustrations) {
  var endTag = '<!-- /wp:divi/section -->';
  var sectionEnds = [];
  var searchFrom = 0;
  
  while (true) {
    var idx = content.indexOf(endTag, searchFrom);
    if (idx < 0) break;
    sectionEnds.push(idx + endTag.length);
    searchFrom = idx + endTag.length;
  }
  
  Logger.log('IL_PLACE: Found ' + sectionEnds.length + ' Divi sections');
  
  if (sectionEnds.length < 2) {
    var genericEnd = /<!-- \/wp:[a-z\-\/]+ -->/g;
    var m;
    sectionEnds = [];
    while ((m = genericEnd.exec(content)) !== null) {
      sectionEnds.push(m.index + m[0].length);
    }
    Logger.log('IL_PLACE: Fallback → ' + sectionEnds.length + ' generic block ends');
  }
  
  if (sectionEnds.length < 2) {
    Logger.log('IL_PLACE: Too few blocks, appending before end');
    return _cpAppendImagesBeforeEnd(content, illustrations);
  }
  
  var totalSections = sectionEnds.length;
  var insertions = [];
  
  for (var i = 0; i < illustrations.length; i++) {
    var il = illustrations[i];
    var targetIndex;
    
    var placement = il.placement.toLowerCase();
    var sectionMatch = placement.match(/section[_\s]*(\d+)/);
    
    if (sectionMatch) {
      targetIndex = parseInt(sectionMatch[1]);
    } else if (placement === 'header' || placement === 'intro') {
      targetIndex = 1;
    } else {
      if (i === 0) {
        targetIndex = Math.max(2, Math.floor(totalSections * 0.33));
      } else {
        targetIndex = Math.max(3, Math.floor(totalSections * 0.66));
      }
    }
    
    targetIndex = Math.max(1, Math.min(targetIndex, totalSections - 1));
    
    var block = _cpBuildImageBlock(il.wpMediaId, il.wpMediaUrl, il.altText, il.caption);
    
    insertions.push({
      position: sectionEnds[targetIndex - 1],
      block: '\n\n' + block + '\n\n',
      mediaId: il.mediaId,
      sectionIdx: targetIndex
    });
    
    Logger.log('IL_PLACE: ' + il.mediaId + ' → after section ' + targetIndex + '/' + totalSections);
  }
  
  insertions.sort(function(a, b) { return b.position - a.position; });
  
  var newContent = content;
  for (var j = 0; j < insertions.length; j++) {
    var ins = insertions[j];
    newContent = newContent.substring(0, ins.position) + ins.block + newContent.substring(ins.position);
  }
  
  return newContent;
}


// ============================================================================
// Fallback: Append Images Before Last Section
// ============================================================================

function _cpAppendImagesBeforeEnd(content, illustrations) {
  var blocks = '';
  for (var i = 0; i < illustrations.length; i++) {
    var il = illustrations[i];
    blocks += '\n\n' + _cpBuildImageBlock(il.wpMediaId, il.wpMediaUrl, il.altText, il.caption) + '\n\n';
  }
  
  var lastSection = content.lastIndexOf('<!-- wp:divi/section');
  if (lastSection > 100) {
    return content.substring(0, lastSection) + blocks + content.substring(lastSection);
  }
  
  return content + blocks;
}


// ============================================================================
// AUTO-TRIGGER: After upload
// ============================================================================

function cpAutoAssignAfterUpload() {
  Logger.log('AUTO_ASSIGN: Triggered');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  
  if (!mqSheet || !cpSheet) {
    Logger.log('AUTO_ASSIGN: Sheets not found, aborting');
    return;
  }
  
  var fiResult = _cpAssignFeaturedImages(ss, mqSheet, cpSheet);
  var ilResult = _cpInsertIllustrations(ss, mqSheet, cpSheet);
  
  Logger.log('AUTO_ASSIGN: Done — FI: ' + fiResult.success + ' ok / ' + fiResult.errors.length + ' err' +
    ', IL: ' + ilResult.success + ' ok / ' + ilResult.errors.length + ' err');
}


// ============================================================================
// MENU ENTRY POINTS
// ============================================================================

function cpMenuAssignFeaturedImages() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!mqSheet || !cpSheet) { ui.alert('❌ Sheets nie znalezione.'); return; }
  
  var r = _cpAssignFeaturedImages(ss, mqSheet, cpSheet);
  
  var msg = '🖼️ Featured Images: ' + r.success + ' assigned';
  if (r.skipped > 0) msg += '\n⏭️ Already done: ' + r.skipped;
  if (r.errors.length > 0) msg += '\n\n❌ Errors:\n' + r.errors.join('\n');
  ui.alert(msg);
}

function cpMenuInsertIllustrations() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mqSheet = ss.getSheetByName(CP_CONFIG.MEDIA_QUEUE_SHEET);
  var cpSheet = ss.getSheetByName(CP_CONFIG.CONTENT_QUEUE_SHEET);
  if (!mqSheet || !cpSheet) { ui.alert('❌ Sheets nie znalezione.'); return; }
  
  var r = _cpInsertIllustrations(ss, mqSheet, cpSheet);
  
  var msg = '📸 Illustrations: ' + r.success + ' inserted';
  if (r.skipped > 0) msg += '\n⏭️ Already done: ' + r.skipped;
  if (r.errors.length > 0) msg += '\n\n❌ Errors:\n' + r.errors.join('\n');
  ui.alert(msg);
}


// ============================================================================
// SHARED HELPERS
// ============================================================================

function _cpBuildColumnMap(headerRow) {
  var map = {};
  headerRow.forEach(function(h, i) {
    map[h.toString().trim()] = i;
  });
  return map;
}

function _cpStr(row, colMap, colName) {
  if (colMap[colName] === undefined) return '';
  return (row[colMap[colName]] || '').toString().trim();
}

function _cpFindPostInfo(cpData, cpCol, contentId) {
  for (var r = 1; r < cpData.length; r++) {
    var id = (cpData[r][cpCol['ID_CP']] || '').toString().trim();
    if (id === contentId) {
      return {
        postId: cpData[r][cpCol['Post_ID_CP']] || null,
        domain: (cpData[r][cpCol['Target_Domain_CP']] || '').toString().trim()
      };
    }
  }
  return null;
}