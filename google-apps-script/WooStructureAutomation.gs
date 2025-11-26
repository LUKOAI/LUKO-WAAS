/**
 * WAAS - WooCommerce Structure Automation
 *
 * Automatyczne tworzenie struktury WooCommerce (kategorie, atrybuty, tagi, strony, menu)
 * przez Google Sheets i generowanie dynamicznych pluginów PHP.
 *
 * @version 1.0.0
 */

// =============================================================================
// GŁÓWNA FUNKCJA - TRIGGER NA EXECUTE CHECKBOX
// =============================================================================

/**
 * Trigger wywoływany przez onEdit - sprawdza execute checkbox w WC_Structure_Config
 */
function onStructureExecuteChange(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;

    // Sprawdź czy to arkusz WC_Structure_Config i kolumna E (execute)
    if (sheet.getName() !== 'WC_Structure_Config') return;
    if (range.getColumn() !== 5) return; // Kolumna E = 5

    const row = range.getRow();
    if (row === 1) return; // Skip header

    const execute = range.getValue();

    // Jeśli execute = TRUE, uruchom proces
    if (execute === true) {
      const configId = sheet.getRange(row, 1).getValue(); // Kolumna A = config_id

      logInfo('WC_STRUCTURE', `Execute triggered for config ${configId}`);

      // Ustaw status na "running"
      sheet.getRange(row, 6).setValue('running'); // Kolumna F = status
      sheet.getRange(row, 7).setValue(new Date()); // Kolumna G = last_run
      sheet.getRange(row, 8).setValue(''); // Kolumna H = error_message

      // Uruchom proces w tle
      try {
        const result = executeStructureSetup(configId);

        if (result.success) {
          sheet.getRange(row, 5).setValue(false); // Uncheck execute
          sheet.getRange(row, 6).setValue('completed');
          logSuccess('WC_STRUCTURE', `Structure setup completed for ${configId}`);
        } else {
          sheet.getRange(row, 6).setValue('error');
          sheet.getRange(row, 8).setValue(result.error || 'Unknown error');
          logError('WC_STRUCTURE', `Structure setup failed for ${configId}: ${result.error}`);
        }
      } catch (error) {
        sheet.getRange(row, 6).setValue('error');
        sheet.getRange(row, 8).setValue(error.message);
        logError('WC_STRUCTURE', `Structure setup error for ${configId}: ${error.message}`);
      }
    }
  } catch (error) {
    logError('WC_STRUCTURE', `onStructureExecuteChange error: ${error.message}`);
  }
}

// =============================================================================
// GŁÓWNA FUNKCJA EXECUTION
// =============================================================================

/**
 * Wykonaj setup struktury WooCommerce dla danego config_id
 *
 * @param {string} configId - Config ID z arkusza WC_Structure_Config
 * @returns {Object} Result object with success status
 */
function executeStructureSetup(configId) {
  try {
    logInfo('WC_STRUCTURE', `Starting structure setup for config ${configId}`);

    // 1. Pobierz konfigurację
    const config = getStructureConfig(configId);
    if (!config) {
      throw new Error(`Configuration ${configId} not found`);
    }

    // 2. Pobierz dane struktury z arkuszy
    const structureData = {
      productCategories: getProductCategories(configId),
      productAttributes: getProductAttributes(configId),
      attributeValues: getAttributeValues(configId),
      productTags: getProductTags(configId),
      postCategories: getPostCategories(configId),
      postTags: getPostTags(configId),
      pages: getPages(configId),
      menus: getMenus(configId),
      menuItems: getMenuItems(configId)
    };

    logInfo('WC_STRUCTURE', `Loaded structure data: ${structureData.productCategories.length} categories, ${structureData.pages.length} pages`);

    // 3. Wygeneruj kod PHP pluginu
    const pluginCode = generateStructurePluginCode(config, structureData);

    logInfo('WC_STRUCTURE', `Generated plugin code (${pluginCode.length} bytes)`);

    // 4. Wgraj plugin przez SFTP lub WordPress REST API
    const uploadResult = uploadStructurePlugin(config, pluginCode, configId);

    if (!uploadResult.success) {
      throw new Error(`Plugin upload failed: ${uploadResult.error}`);
    }

    logInfo('WC_STRUCTURE', `Plugin uploaded successfully`);

    // 5. Aktywuj plugin przez WordPress REST API
    const activateResult = activateStructurePlugin(config, configId);

    if (!activateResult.success) {
      throw new Error(`Plugin activation failed: ${activateResult.error}`);
    }

    logInfo('WC_STRUCTURE', `Plugin activated successfully`);

    // 6. Sprawdź status wykonania
    Utilities.sleep(5000); // Czekaj 5 sekund na wykonanie

    const statusResult = checkStructureSetupStatus(config);

    if (!statusResult.success) {
      throw new Error(`Structure setup verification failed: ${statusResult.error}`);
    }

    logInfo('WC_STRUCTURE', `Structure setup verified successfully`);

    // 7. Deaktywuj i usuń plugin
    const cleanupResult = cleanupStructurePlugin(config, configId);

    if (!cleanupResult.success) {
      logWarning('WC_STRUCTURE', `Plugin cleanup failed: ${cleanupResult.error}`);
    }

    logSuccess('WC_STRUCTURE', `Structure setup completed successfully for ${configId}`);

    return { success: true };

  } catch (error) {
    logError('WC_STRUCTURE', `executeStructureSetup error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// POBIERANIE DANYCH Z ARKUSZY
// =============================================================================

/**
 * Pobierz konfigurację dla config_id
 */
function getStructureConfig(configId) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('WC_Structure_Config');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === configId) {
        return {
          configId: data[i][0],
          siteDomain: data[i][1],
          language: data[i][2],
          structureName: data[i][3]
        };
      }
    }

    return null;
  } catch (error) {
    logError('WC_STRUCTURE', `getStructureConfig error: ${error.message}`);
    return null;
  }
}

/**
 * Pobierz kategorie produktów dla config_id
 */
function getProductCategories(configId) {
  return getSheetDataForConfig('WC_Product_Categories', configId, row => ({
    catId: row[1],
    name: row[2],
    slug: row[3],
    parentCatId: row[4] || '',
    description: row[5] || '',
    order: row[6] || 0
  }));
}

/**
 * Pobierz atrybuty produktów dla config_id
 */
function getProductAttributes(configId) {
  return getSheetDataForConfig('WC_Product_Attributes', configId, row => ({
    attrId: row[1],
    name: row[2],
    slug: row[3],
    type: row[4] || 'select'
  }));
}

/**
 * Pobierz wartości atrybutów dla config_id
 */
function getAttributeValues(configId) {
  return getSheetDataForConfig('WC_Attribute_Values', configId, row => ({
    attrId: row[1],
    value: row[2],
    order: row[3] || 0
  }));
}

/**
 * Pobierz tagi produktów dla config_id
 */
function getProductTags(configId) {
  return getSheetDataForConfig('WC_Product_Tags', configId, row => ({
    name: row[1],
    slug: row[2]
  }));
}

/**
 * Pobierz kategorie postów dla config_id
 */
function getPostCategories(configId) {
  return getSheetDataForConfig('WC_Post_Categories', configId, row => ({
    catId: row[1],
    name: row[2],
    slug: row[3],
    parentCatId: row[4] || '',
    description: row[5] || ''
  }));
}

/**
 * Pobierz tagi postów dla config_id
 */
function getPostTags(configId) {
  return getSheetDataForConfig('WC_Post_Tags', configId, row => ({
    name: row[1],
    slug: row[2]
  }));
}

/**
 * Pobierz strony dla config_id
 */
function getPages(configId) {
  return getSheetDataForConfig('WC_Pages', configId, row => ({
    pageId: row[1],
    title: row[2],
    slug: row[3],
    parentPageId: row[4] || '',
    content: row[5] || '',
    isFrontPage: row[6] === true,
    isPostsPage: row[7] === true,
    order: row[8] || 0
  }));
}

/**
 * Pobierz menu dla config_id
 */
function getMenus(configId) {
  return getSheetDataForConfig('WC_Menus', configId, row => ({
    menuId: row[1],
    name: row[2],
    location: row[3]
  }));
}

/**
 * Pobierz elementy menu dla config_id
 */
function getMenuItems(configId) {
  return getSheetDataForConfig('WC_Menu_Items', configId, row => ({
    menuId: row[1],
    itemId: row[2],
    title: row[3],
    type: row[4],
    targetId: row[5] || '',
    customUrl: row[6] || '',
    parentItemId: row[7] || '',
    order: row[8] || 0
  }));
}

/**
 * Helper function - pobierz dane z arkusza dla config_id
 */
function getSheetDataForConfig(sheetName, configId, mapper) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      logWarning('WC_STRUCTURE', `Sheet ${sheetName} not found`);
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === configId) {
        results.push(mapper(data[i]));
      }
    }

    return results;
  } catch (error) {
    logError('WC_STRUCTURE', `getSheetDataForConfig(${sheetName}) error: ${error.message}`);
    return [];
  }
}

// =============================================================================
// GENEROWANIE KODU PHP PLUGINU
// =============================================================================

/**
 * Generuj kod PHP pluginu z danymi struktury
 */
function generateStructurePluginCode(config, structureData) {
  const pluginSlug = `waas-structure-${config.configId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  let php = `<?php
/**
 * Plugin Name: WAAS Structure Setup - ${config.configId}
 * Description: Auto-generated structure setup plugin. Self-destructs after execution.
 * Version: 1.0.0
 * Author: LUKO AI - WAAS System
 */

if (!defined('ABSPATH')) exit;

// Wykonaj przy aktywacji
register_activation_hook(__FILE__, 'waas_structure_setup_${config.configId.replace(/[^a-zA-Z0-9]/g, '_')}');

function waas_structure_setup_${config.configId.replace(/[^a-zA-Z0-9]/g, '_')}() {
    // Sprawdź WooCommerce
    if (!class_exists('WooCommerce')) {
        set_transient('waas_setup_error', 'WooCommerce not active', 3600);
        return;
    }

    $results = [];

    // ===== 1. KATEGORIE PRODUKTÓW =====
    $product_categories = ${generatePHPArray(structureData.productCategories, cat => `
        ['name' => '${escapePhp(cat.name)}', 'slug' => '${escapePhp(cat.slug)}', 'parent_slug' => '${escapePhp(cat.parentCatId)}', 'description' => '${escapePhp(cat.description)}']`
    )};

    $cat_ids = [];
    foreach ($product_categories as $cat) {
        $parent_id = 0;
        if (!empty($cat['parent_slug']) && isset($cat_ids[$cat['parent_slug']])) {
            $parent_id = $cat_ids[$cat['parent_slug']];
        }

        $existing = get_term_by('slug', $cat['slug'], 'product_cat');
        if ($existing) {
            $cat_ids[$cat['slug']] = $existing->term_id;
            continue;
        }

        $result = wp_insert_term($cat['name'], 'product_cat', [
            'slug' => $cat['slug'],
            'parent' => $parent_id,
            'description' => $cat['description']
        ]);

        if (!is_wp_error($result)) {
            $cat_ids[$cat['slug']] = $result['term_id'];
            $results['categories'][] = $cat['name'];
        }
    }

    // ===== 2. ATRYBUTY PRODUKTÓW =====
    $attributes = ${generatePHPArrayForAttributes(structureData.productAttributes, structureData.attributeValues)};

    foreach ($attributes as $attr) {
        // Sprawdź czy atrybut istnieje
        $existing_id = wc_attribute_taxonomy_id_by_name($attr['slug']);

        if (!$existing_id) {
            $attr_id = wc_create_attribute([
                'name' => $attr['name'],
                'slug' => $attr['slug'],
                'type' => $attr['type'],
                'has_archives' => true
            ]);

            if (!is_wp_error($attr_id)) {
                register_taxonomy('pa_' . $attr['slug'], 'product');
                $results['attributes'][] = $attr['name'];
            }
        }

        // Dodaj terms
        $taxonomy = 'pa_' . $attr['slug'];
        foreach ($attr['terms'] as $term) {
            if (!term_exists($term, $taxonomy)) {
                wp_insert_term($term, $taxonomy);
            }
        }
    }

    // ===== 3. TAGI PRODUKTÓW =====
    $product_tags = ${generatePHPArray(structureData.productTags, tag => `
        ['name' => '${escapePhp(tag.name)}', 'slug' => '${escapePhp(tag.slug)}']`
    )};

    foreach ($product_tags as $tag) {
        if (!term_exists($tag['slug'], 'product_tag')) {
            wp_insert_term($tag['name'], 'product_tag', ['slug' => $tag['slug']]);
            $results['product_tags'][] = $tag['name'];
        }
    }

    // ===== 4. KATEGORIE POSTÓW =====
    $post_categories = ${generatePHPArray(structureData.postCategories, cat => `
        ['name' => '${escapePhp(cat.name)}', 'slug' => '${escapePhp(cat.slug)}', 'description' => '${escapePhp(cat.description)}']`
    )};

    foreach ($post_categories as $cat) {
        if (!term_exists($cat['slug'], 'category')) {
            wp_insert_term($cat['name'], 'category', [
                'slug' => $cat['slug'],
                'description' => $cat['description']
            ]);
            $results['post_categories'][] = $cat['name'];
        }
    }

    // ===== 5. TAGI POSTÓW =====
    $post_tags = ${generatePHPArray(structureData.postTags, tag => `
        ['name' => '${escapePhp(tag.name)}', 'slug' => '${escapePhp(tag.slug)}']`
    )};

    foreach ($post_tags as $tag) {
        if (!term_exists($tag['slug'], 'post_tag')) {
            wp_insert_term($tag['name'], 'post_tag', ['slug' => $tag['slug']]);
            $results['post_tags'][] = $tag['name'];
        }
    }

    // ===== 6. STRONY =====
    $pages = ${generatePHPArray(structureData.pages, page => `
        ['title' => '${escapePhp(page.title)}', 'slug' => '${escapePhp(page.slug)}', 'content' => '${escapePhp(page.content)}', 'is_front' => ${page.isFrontPage}, 'is_posts' => ${page.isPostsPage}]`
    )};

    $page_ids = [];
    $front_page_id = null;
    $posts_page_id = null;

    foreach ($pages as $page) {
        $existing = get_page_by_path($page['slug']);
        if ($existing) {
            $page_ids[$page['slug']] = $existing->ID;
            if ($page['is_front']) $front_page_id = $existing->ID;
            if ($page['is_posts']) $posts_page_id = $existing->ID;
            continue;
        }

        $page_id = wp_insert_post([
            'post_title' => $page['title'],
            'post_name' => $page['slug'],
            'post_content' => $page['content'],
            'post_status' => 'publish',
            'post_type' => 'page'
        ]);

        if ($page_id && !is_wp_error($page_id)) {
            $page_ids[$page['slug']] = $page_id;
            $results['pages'][] = $page['title'];

            if ($page['is_front']) $front_page_id = $page_id;
            if ($page['is_posts']) $posts_page_id = $page_id;
        }
    }

    // Ustaw stronę główną i bloga
    if ($front_page_id) {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $front_page_id);
        if ($posts_page_id) {
            update_option('page_for_posts', $posts_page_id);
        }
    }

    // ===== 7. MENU =====
    ${generateMenuCode(structureData.menus, structureData.menuItems)}

    // Zapisz wynik
    set_transient('waas_setup_result', $results, 3600);
    set_transient('waas_setup_success', true, 3600);

    // Flush rewrite rules
    flush_rewrite_rules();
}

// Endpoint do sprawdzenia statusu
add_action('rest_api_init', function() {
    register_rest_route('waas/v1', '/setup-status', [
        'methods' => 'GET',
        'callback' => function() {
            return [
                'success' => get_transient('waas_setup_success'),
                'result' => get_transient('waas_setup_result'),
                'error' => get_transient('waas_setup_error')
            ];
        },
        'permission_callback' => '__return_true'
    ]);
});
`;

  return php;
}

/**
 * Generuj PHP array z JavaScript array
 */
function generatePHPArray(items, mapper) {
  if (!items || items.length === 0) return '[]';

  const phpItems = items.map(mapper).join(',');
  return `[${phpItems}]`;
}

/**
 * Generuj PHP array dla atrybutów z terms
 */
function generatePHPArrayForAttributes(attributes, attributeValues) {
  if (!attributes || attributes.length === 0) return '[]';

  const phpAttrs = attributes.map(attr => {
    const terms = attributeValues
      .filter(v => v.attrId === attr.attrId)
      .map(v => `'${escapePhp(v.value)}'`)
      .join(', ');

    return `
        ['name' => '${escapePhp(attr.name)}', 'slug' => '${escapePhp(attr.slug)}', 'type' => '${escapePhp(attr.type)}', 'terms' => [${terms}]]`;
  }).join(',');

  return `[${phpAttrs}]`;
}

/**
 * Generuj kod PHP dla menu
 */
function generateMenuCode(menus, menuItems) {
  let code = '$menus = [];\n    ';

  for (const menu of menus) {
    const items = menuItems.filter(item => item.menuId === menu.menuId);

    code += `
    // Menu: ${menu.name}
    $menu_exists = wp_get_nav_menu_object('${escapePhp(menu.name)}');
    if ($menu_exists) {
        $menu_id = $menu_exists->term_id;
    } else {
        $menu_id = wp_create_nav_menu('${escapePhp(menu.name)}');
    }

    if (!is_wp_error($menu_id)) {
        $item_ids = [];

`;

    for (const item of items) {
      code += `
        // Menu item: ${item.title}
        $parent_id = 0;
        if (!empty('${escapePhp(item.parentItemId)}') && isset($item_ids['${escapePhp(item.parentItemId)}'])) {
            $parent_id = $item_ids['${escapePhp(item.parentItemId)}'];
        }

        $args = [
            'menu-item-title' => '${escapePhp(item.title)}',
            'menu-item-status' => 'publish',
            'menu-item-parent-id' => $parent_id,
            'menu-item-position' => ${item.order}
        ];

`;

      if (item.type === 'page') {
        code += `        $page = get_page_by_path('${escapePhp(item.targetId)}');
        if ($page) {
            $args['menu-item-type'] = 'post_type';
            $args['menu-item-object'] = 'page';
            $args['menu-item-object-id'] = $page->ID;
        }
`;
      } else if (item.type === 'product_cat') {
        code += `        $term = get_term_by('slug', '${escapePhp(item.targetId)}', 'product_cat');
        if ($term) {
            $args['menu-item-type'] = 'taxonomy';
            $args['menu-item-object'] = 'product_cat';
            $args['menu-item-object-id'] = $term->term_id;
        }
`;
      } else if (item.type === 'custom') {
        code += `        $args['menu-item-type'] = 'custom';
        $args['menu-item-url'] = home_url('${escapePhp(item.customUrl)}');
`;
      }

      code += `
        $item_id = wp_update_nav_menu_item($menu_id, 0, $args);
        if (!is_wp_error($item_id)) {
            $item_ids['${escapePhp(item.itemId)}'] = $item_id;
        }

`;
    }

    code += `
        // Przypisz menu do lokalizacji
        $locations = get_theme_mod('nav_menu_locations', []);
        $locations['${escapePhp(menu.location)}'] = $menu_id;
        set_theme_mod('nav_menu_locations', $locations);

        $results['menus'][] = '${escapePhp(menu.name)}';
    }

`;
  }

  return code;
}

/**
 * Escape PHP string
 */
function escapePhp(str) {
  if (!str) return '';
  return str.toString().replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
}

// =============================================================================
// WGRYWANIE I AKTYWACJA PLUGINU
// =============================================================================

/**
 * Wgraj plugin przez WordPress REST API lub SFTP
 */
function uploadStructurePlugin(config, pluginCode, configId) {
  try {
    // Pobierz dane strony
    const site = getSiteByDomain(config.siteDomain);
    if (!site) {
      throw new Error(`Site ${config.siteDomain} not found in Sites sheet`);
    }

    const pluginSlug = `waas-structure-${configId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const pluginFilename = `${pluginSlug}.php`;

    // Stwórz plik pluginu jako Blob
    const pluginBlob = Utilities.newBlob(pluginCode, 'text/plain', pluginFilename);

    // Wgraj przez WordPress REST API (upload endpoint)
    const uploadUrl = `${site.wpUrl}/wp-json/waas/v1/upload-plugin`;

    const formData = {
      plugin_file: pluginBlob,
      plugin_slug: pluginSlug
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
      },
      payload: formData,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(uploadUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      logSuccess('WC_STRUCTURE', `Plugin uploaded successfully to ${config.siteDomain}`);
      return { success: true };
    } else {
      throw new Error(`HTTP ${responseCode}: ${responseText}`);
    }

  } catch (error) {
    logError('WC_STRUCTURE', `uploadStructurePlugin error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Aktywuj plugin przez WordPress REST API
 */
function activateStructurePlugin(config, configId) {
  try {
    const site = getSiteByDomain(config.siteDomain);
    if (!site) {
      throw new Error(`Site ${config.siteDomain} not found`);
    }

    const pluginSlug = `waas-structure-${configId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const pluginPath = `${pluginSlug}/${pluginSlug}.php`;

    const activateUrl = `${site.wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(pluginPath)}`;

    const options = {
      method: 'put',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ status: 'active' }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(activateUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      logSuccess('WC_STRUCTURE', `Plugin activated successfully`);
      return { success: true };
    } else {
      throw new Error(`HTTP ${responseCode}: ${response.getContentText()}`);
    }

  } catch (error) {
    logError('WC_STRUCTURE', `activateStructurePlugin error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sprawdź status wykonania setupu
 */
function checkStructureSetupStatus(config) {
  try {
    const site = getSiteByDomain(config.siteDomain);
    if (!site) {
      throw new Error(`Site ${config.siteDomain} not found`);
    }

    const statusUrl = `${site.wpUrl}/wp-json/waas/v1/setup-status`;

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(statusUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const result = JSON.parse(response.getContentText());

      if (result.success) {
        logSuccess('WC_STRUCTURE', `Structure setup verified: ${JSON.stringify(result.result)}`);
        return { success: true };
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        throw new Error('Setup not completed yet');
      }
    } else {
      throw new Error(`HTTP ${responseCode}: ${response.getContentText()}`);
    }

  } catch (error) {
    logError('WC_STRUCTURE', `checkStructureSetupStatus error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Usuń plugin po wykonaniu
 */
function cleanupStructurePlugin(config, configId) {
  try {
    const site = getSiteByDomain(config.siteDomain);
    if (!site) {
      throw new Error(`Site ${config.siteDomain} not found`);
    }

    const pluginSlug = `waas-structure-${configId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const pluginPath = `${pluginSlug}/${pluginSlug}.php`;

    // Dezaktywuj
    const deactivateUrl = `${site.wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(pluginPath)}`;

    let options = {
      method: 'put',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ status: 'inactive' }),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(deactivateUrl, options);

    // Usuń
    const deleteUrl = `${site.wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(pluginPath)}`;

    options = {
      method: 'delete',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass)
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(deleteUrl, options);

    if (response.getResponseCode() === 200) {
      logSuccess('WC_STRUCTURE', `Plugin cleaned up successfully`);
      return { success: true };
    } else {
      logWarning('WC_STRUCTURE', `Plugin cleanup warning: ${response.getContentText()}`);
      return { success: false, error: response.getContentText() };
    }

  } catch (error) {
    logError('WC_STRUCTURE', `cleanupStructurePlugin error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Pobierz stronę po domenie
 */
function getSiteByDomain(domain) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === domain) { // Kolumna C = Domain
        return {
          id: data[i][0],
          name: data[i][1],
          domain: data[i][2],
          wpUrl: data[i][3],
          adminUser: data[i][4],
          adminPass: data[i][5]
        };
      }
    }

    return null;
  } catch (error) {
    logError('WC_STRUCTURE', `getSiteByDomain error: ${error.message}`);
    return null;
  }
}
