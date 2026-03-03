/**
 * ============================================================================
 * WAAS WOOCOMMERCE EXPORT MODULE
 * ============================================================================
 *
 * Nowe funkcjonalności dla zakładki Products:
 * - Kolumna Domain (do której strony eksportować)
 * - Kolumna Select (checkbox do zaznaczania)
 * - Kolumna Source (PA API / WordPress - skąd pochodzi produkt)
 * - Menu: zaznacz wszystkie, odznacz wszystkie, eksportuj wybrane, eksportuj wszystkie
 *
 * INSTRUKCJA INSTALACJI:
 * 1. Skopiuj cały ten plik do Google Apps Script
 * 2. Uruchom funkcję setupWooCommerceExportColumns() żeby dodać nowe kolumny
 * 3. Menu zostanie dodane automatycznie do WAAS
 *
 * UWAGA: Ten plik ROZSZERZA istniejące funkcjonalności, nie nadpisuje ich.
 * ============================================================================
 */

// =============================================================================
// NOWE KOLUMNY - DEFINICJE
// =============================================================================

/**
 * Dodatkowe kolumny dla Products sheet
 * Te kolumny będą dodane na końcu istniejących kolumn (po BB - Marketplace)
 */
function getWooCommerceExportHeaders() {
  return [
    'Select',           // BC - Checkbox do zaznaczania (TRUE/FALSE)
    'Target Domain',    // BD - Domena docelowa dla eksportu
    'Source',           // BE - Skąd pochodzi produkt: "PA API" lub "WordPress"
    'Export Status',    // BF - Status eksportu: Pending/Exported/Failed
    'WC Product ID',    // BG - ID produktu w WooCommerce (po eksporcie)
    'Last Export Date', // BH - Data ostatniego eksportu
    'Auto Update',      // BI - Checkbox: TRUE = aktualizuj ceny, FALSE = nie aktualizuj
    'Last Price Update' // BJ - Data ostatniej aktualizacji ceny (DD.MM.YYYY HH:MM)
  ];
}

// =============================================================================
// SETUP - DODAJ NOWE KOLUMNY
// =============================================================================

/**
 * Setup bez UI - do uruchomienia z edytora skryptów
 * Ta wersja NIE używa SpreadsheetApp.getUi() więc działa z edytora
 */
function setupWooCommerceExportColumnsSimple() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  if (!sheet) {
    Logger.log('ERROR: Products sheet not found!');
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newHeaders = getWooCommerceExportHeaders();

  const hasSelect = currentHeaders.includes('Select');

  if (hasSelect) {
    Logger.log('INFO: WooCommerce export columns already exist!');
    return;
  }

  const startCol = sheet.getLastColumn() + 1;
  newHeaders.forEach((header, idx) => {
    sheet.getRange(1, startCol + idx).setValue(header);
  });

  const lastRow = Math.max(sheet.getLastRow(), 2);
  if (lastRow > 1) {
    // Kolumna Select (BC) - BEZ checkbox validation!
    // Pusty = niezaznaczone, TRUE/checked = zaznaczone, "DONE" = wyeksportowane
    // Nie ustawiamy validation - pozwalamy użytkownikowi ręcznie wpisać wartość lub zaznaczyć checkbox
    const selectRange = sheet.getRange(2, startCol, lastRow - 1, 1);
    selectRange.clearContent(); // Wyczyść zawartość (będzie puste, nie FALSE)
    // NIE dodajemy checkbox validation - to powodowało wyświetlanie FALSE
  }

  // Kolumna Source (BE) - dropdown
  const sourceCol = startCol + 2;
  if (lastRow > 1) {
    const sourceRange = sheet.getRange(2, sourceCol, lastRow - 1, 1);
    const paApiValues = Array(lastRow - 1).fill(['PA API']);
    sourceRange.setValues(paApiValues);

    const sourceValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(['PA API', 'WordPress', 'Manual'], true)
      .build();
    sheet.getRange(2, sourceCol, lastRow - 1, 1).setDataValidation(sourceValidation);
  }

  // Kolumna Auto Update (BI) - checkbox, domyślnie TRUE
  const autoUpdateCol = startCol + 6;
  if (lastRow > 1) {
    const autoUpdateRange = sheet.getRange(2, autoUpdateCol, lastRow - 1, 1);
    const trueValues = Array(lastRow - 1).fill([true]);
    autoUpdateRange.setValues(trueValues);

    const autoUpdateRule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    autoUpdateRange.setDataValidation(autoUpdateRule);
  }

  updateDomainDropdown_();

  const headerRange = sheet.getRange(1, startCol, 1, newHeaders.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');

  Logger.log('SUCCESS: WooCommerce export columns have been added!');
  Logger.log('New columns: Select, Target Domain, Source, Export Status, WC Product ID, Last Export Date, Auto Update, Last Price Update');

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'WooCommerce export columns added! Check the Logs sheet.',
    'Setup Complete',
    5
  );
}

/**
 * Dodaj nowe kolumny do Products sheet (wersja z UI alerts)
 * Uruchom tę funkcję raz, żeby skonfigurować arkusz
 */
function setupWooCommerceExportColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Products sheet not found!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // Pobierz aktualny nagłówek
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newHeaders = getWooCommerceExportHeaders();

  // Sprawdź czy kolumny już istnieją
  const hasSelect = currentHeaders.includes('Select');
  const hasTargetDomain = currentHeaders.includes('Target Domain');
  const hasSource = currentHeaders.includes('Source');

  if (hasSelect && hasTargetDomain && hasSource) {
    SpreadsheetApp.getUi().alert('Info', 'WooCommerce export columns already exist!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // Dodaj nowe nagłówki
  const startCol = sheet.getLastColumn() + 1;
  newHeaders.forEach((header, idx) => {
    sheet.getRange(1, startCol + idx).setValue(header);
  });

  // Formatuj kolumny
  const lastRow = Math.max(sheet.getLastRow(), 2);
  if (lastRow > 1) {
    // Kolumna Select (BC) - BEZ checkbox validation!
    // Pusty = niezaznaczone, TRUE/checked = zaznaczone, "DONE" = wyeksportowane
    // Nie ustawiamy validation - pozwalamy użytkownikowi ręcznie wpisać wartość lub zaznaczyć checkbox
    const selectRange = sheet.getRange(2, startCol, lastRow - 1, 1);
    selectRange.clearContent(); // Wyczyść zawartość (będzie puste, nie FALSE)
    // NIE dodajemy checkbox validation - to powodowało wyświetlanie FALSE
  }

  // Kolumna Source (BE) - dropdown + domyślna wartość "PA API"
  const sourceCol = startCol + 2;
  if (lastRow > 1) {
    const sourceRange = sheet.getRange(2, sourceCol, lastRow - 1, 1);
    const paApiValues = Array(lastRow - 1).fill(['PA API']);
    sourceRange.setValues(paApiValues);

    const sourceValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(['PA API', 'WordPress', 'Manual'], true)
      .build();
    sheet.getRange(2, sourceCol, lastRow - 1, 1).setDataValidation(sourceValidation);
  }

  // Kolumna Auto Update (BI) - checkbox, domyślnie TRUE
  const autoUpdateCol = startCol + 6;
  if (lastRow > 1) {
    const autoUpdateRange = sheet.getRange(2, autoUpdateCol, lastRow - 1, 1);
    const trueValues = Array(lastRow - 1).fill([true]);
    autoUpdateRange.setValues(trueValues);

    const autoUpdateRule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    autoUpdateRange.setDataValidation(autoUpdateRule);
  }

  // Ustaw dropdown dla Target Domain na podstawie Sites
  updateDomainDropdown_();

  // Pokoloruj nagłówki
  const headerRange = sheet.getRange(1, startCol, 1, newHeaders.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');

  SpreadsheetApp.getUi().alert(
    'Success',
    'WooCommerce export columns have been added!\n\n' +
    'New columns:\n' +
    '- Select (checkbox)\n' +
    '- Target Domain\n' +
    '- Source (PA API/WordPress)\n' +
    '- Export Status\n' +
    '- WC Product ID\n' +
    '- Last Export Date\n' +
    '- Auto Update (checkbox - domyślnie TRUE)\n' +
    '- Last Price Update',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  logSuccess('WooCommerce', 'Export columns added to Products sheet');
}

/**
 * Aktualizuj dropdown dla Target Domain na podstawie listy Sites
 * @private
 */
function updateDomainDropdown_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const productsSheet = ss.getSheetByName('Products');
  const sitesSheet = ss.getSheetByName('Sites');

  if (!sitesSheet) return;

  // Pobierz listę domen z Sites
  const sitesData = sitesSheet.getDataRange().getValues();
  const domains = [];

  for (let i = 1; i < sitesData.length; i++) {
    const domain = sitesData[i][2]; // Kolumna Domain w Sites
    if (domain) {
      domains.push(domain);
    }
  }

  if (domains.length === 0) return;

  // Znajdź kolumnę Target Domain
  const headers = productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).getValues()[0];
  const domainColIdx = headers.indexOf('Target Domain');

  if (domainColIdx === -1) return;

  // Zastosuj dropdown
  const lastRow = Math.max(productsSheet.getLastRow(), 2);
  if (lastRow > 1) {
    const domainValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(domains, true)
      .build();
    productsSheet.getRange(2, domainColIdx + 1, lastRow - 1, 1).setDataValidation(domainValidation);
  }
}

// =============================================================================
// MENU - ROZSZERZENIE
// =============================================================================

/**
 * Rozszerzenie menu WAAS o funkcje eksportu
 * UWAGA: Dodaj to do funkcji onOpen() w Menu.gs
 */
function createWooCommerceExportMenu() {
  const ui = SpreadsheetApp.getUi();

  // Dodaj submenu do istniejącego menu WAAS
  // Ten kod należy dodać do onOpen() w Menu.gs:
  /*
    .addSubMenu(ui.createMenu('🛒 WooCommerce Export')
      .addItem('✅ Select All Products', 'selectAllProducts')
      .addItem('❌ Deselect All Products', 'deselectAllProducts')
      .addSeparator()
      .addItem('📤 Export Selected to WooCommerce', 'exportSelectedToWooCommerce')
      .addItem('📤 Export All to WooCommerce', 'exportAllToWooCommerce')
      .addSeparator()
      .addItem('🔄 Sync Products from WordPress', 'syncProductsFromWordPress')
      .addItem('⚙️ Setup Export Columns', 'setupWooCommerceExportColumns'))
  */
}

// =============================================================================
// FUNKCJE ZAZNACZANIA
// =============================================================================

/**
 * Zaznacz wszystkie produkty (Select = TRUE)
 */
function selectAllProducts() {
  setAllProductsSelection_(true);
  SpreadsheetApp.getUi().alert('Done', 'All products have been selected!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Odznacz wszystkie produkty (Select = FALSE)
 */
function deselectAllProducts() {
  setAllProductsSelection_(false);
  SpreadsheetApp.getUi().alert('Done', 'All products have been deselected!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Ustaw zaznaczenie dla wszystkich produktów
 * @private
 */
function setAllProductsSelection_(selected) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const selectColIdx = headers.indexOf('Select');

  if (selectColIdx === -1) {
    SpreadsheetApp.getUi().alert('Error', 'Select column not found! Run Setup Export Columns first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = Array(lastRow - 1).fill([selected]);
  sheet.getRange(2, selectColIdx + 1, lastRow - 1, 1).setValues(values);
}

/**
 * Zaznacz produkty po domenie
 * @param {string} domain - Domena do zaznaczenia
 */
function selectProductsByDomain(domain) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const selectColIdx = headers.indexOf('Select');
  const domainColIdx = headers.indexOf('Target Domain');

  if (selectColIdx === -1 || domainColIdx === -1) {
    throw new Error('Required columns not found!');
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][domainColIdx] === domain) {
      sheet.getRange(i + 1, selectColIdx + 1).setValue(true);
    }
  }
}

/**
 * Pobierz listę zaznaczonych produktów
 * @returns {Array} Lista obiektów produktów
 */
function getSelectedProducts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const selectColIdx = headers.indexOf('Select');

  if (selectColIdx === -1) {
    throw new Error('Select column not found!');
  }

  const data = sheet.getDataRange().getValues();
  const selectedProducts = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][selectColIdx] === true) {
      // Buduj obiekt produktu
      const product = {
        rowIndex: i + 1
      };

      headers.forEach((header, idx) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        product[key] = data[i][idx];
      });

      // Aliasy dla wygody
      product.id = data[i][0];
      product.asin = data[i][1];
      product.name = data[i][2];
      product.price = data[i][4];
      product.imageUrl = data[i][5];
      product.affiliateLink = data[i][6];

      selectedProducts.push(product);
    }
  }

  return selectedProducts;
}

// =============================================================================
// EKSPORT DO WOOCOMMERCE
// =============================================================================

/**
 * Eksportuj zaznaczone produkty do WooCommerce
 */
function exportSelectedToWooCommerce() {
  const ui = SpreadsheetApp.getUi();

  try {
    const selectedProducts = getSelectedProducts();

    if (selectedProducts.length === 0) {
      ui.alert('No Selection', 'Please select at least one product to export.\nUse the checkbox in the "Select" column.', ui.ButtonSet.OK);
      return;
    }

    // Grupuj produkty po domenie docelowej
    const productsByDomain = {};
    selectedProducts.forEach(product => {
      const domain = product.target_domain || '';
      if (!domain) {
        logWarning('WooCommerce', `Product ${product.asin} has no target domain set, skipping`);
        return;
      }

      if (!productsByDomain[domain]) {
        productsByDomain[domain] = [];
      }
      productsByDomain[domain].push(product);
    });

    // Sprawdź czy są produkty z przypisanymi domenami
    const domains = Object.keys(productsByDomain);
    if (domains.length === 0) {
      ui.alert('No Target Domain', 'Selected products have no Target Domain set.\nPlease set the Target Domain column for products you want to export.', ui.ButtonSet.OK);
      return;
    }

    // Potwierdzenie
    const totalProducts = selectedProducts.length;
    const result = ui.alert(
      'Export Confirmation',
      `Export ${totalProducts} products to WooCommerce?\n\nDomains:\n${domains.map(d => `- ${d}: ${productsByDomain[d].length} products`).join('\n')}`,
      ui.ButtonSet.YES_NO
    );

    if (result !== ui.Button.YES) {
      return;
    }

    // Eksportuj do każdej domeny
    let exported = 0;
    let failed = 0;

    for (const domain of domains) {
      const products = productsByDomain[domain];
      logInfo('WooCommerce', `Exporting ${products.length} products to ${domain}`);

      try {
        const exportResult = exportProductsToSite_(domain, products);
        exported += exportResult.exported;
        failed += exportResult.failed;
      } catch (error) {
        logError('WooCommerce', `Export to ${domain} failed: ${error.message}`);
        failed += products.length;
      }
    }

    // Podsumowanie
    ui.alert(
      'Export Complete',
      `Exported: ${exported} products\nFailed: ${failed} products\n\nCheck the Export Status column for details.`,
      ui.ButtonSet.OK
    );

    logSuccess('WooCommerce', `Export completed: ${exported} exported, ${failed} failed`);

  } catch (error) {
    ui.alert('Error', `Export failed: ${error.message}`, ui.ButtonSet.OK);
    logError('WooCommerce', `Export error: ${error.message}`);
  }
}

/**
 * Eksportuj wszystkie produkty do WooCommerce
 */
function exportAllToWooCommerce() {
  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    'Export All Products',
    'Are you sure you want to export ALL products to WooCommerce?\n\nThis will export all products that have a Target Domain set.',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  // Zaznacz wszystkie i eksportuj
  selectAllProducts();
  exportSelectedToWooCommerce();
}

/**
 * Eksportuj produkty do konkretnej strony
 * @private
 * @param {string} domain - Domena strony
 * @param {Array} products - Lista produktów do eksportu
 * @returns {Object} { exported: number, failed: number }
 */
function exportProductsToSite_(domain, products) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Znajdź kolumny do aktualizacji
  const selectColIdx = headers.indexOf('Select');
  const exportStatusColIdx = headers.indexOf('Export Status');
  const wcProductIdColIdx = headers.indexOf('WC Product ID');
  const lastExportDateColIdx = headers.indexOf('Last Export Date');

  // Pobierz dane strony
  const siteData = getSiteByDomain_(domain);
  if (!siteData) {
    throw new Error(`Site not found: ${domain}`);
  }

  let exported = 0;
  let failed = 0;

  for (const product of products) {
    try {
      // Eksportuj produkt do WordPress/WooCommerce
      const result = createWooCommerceProduct_(siteData, product);

      if (result) {
        // result może być obiektem { post_id, wc_product_id } lub tylko post_id
        const wpPostId = result.post_id || result;
        const wcProductId = result.wc_product_id || null;

        // WAŻNE: Ustaw Select = "DONE" i Export Status = "Success"
        if (selectColIdx >= 0) {
          sheet.getRange(product.rowIndex, selectColIdx + 1).setValue('DONE');
        }

        if (exportStatusColIdx >= 0) {
          sheet.getRange(product.rowIndex, exportStatusColIdx + 1).setValue('Success');
        }

        // Zapisz WC Product ID (jeśli dostępne)
        if (wcProductIdColIdx >= 0 && wcProductId) {
          sheet.getRange(product.rowIndex, wcProductIdColIdx + 1).setValue(wcProductId);
        }

        // Zapisz datę eksportu (format niemiecki z czasem: DD.MM.YYYY HH:MM)
        if (lastExportDateColIdx >= 0) {
          const now = new Date();
          const germanDate = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
          sheet.getRange(product.rowIndex, lastExportDateColIdx + 1).setValue(germanDate);
        }

        exported++;
        logSuccess('WooCommerce', `Product exported: ${product.asin} -> ${domain} (WP: ${wpPostId}, WC: ${wcProductId || 'N/A'})`);
      }
    } catch (error) {
      // Oznacz jako failed
      if (exportStatusColIdx >= 0) {
        sheet.getRange(product.rowIndex, exportStatusColIdx + 1).setValue('Failed: ' + error.message);
      }

      failed++;
      logError('WooCommerce', `Failed to export ${product.asin}: ${error.message}`);
    }

    // Rate limiting
    Utilities.sleep(500);
  }

  return { exported, failed };
}

/**
 * Pobierz dane strony po domenie
 * @private
 */
function getSiteByDomain_(domain) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sites');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Znajdź kolumnę Amazon Partner Tag
  const partnerTagColIdx = headers.findIndex(h => h === 'Amazon Partner Tag');

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === domain) {
      return {
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        adminUser: data[i][4],
        adminPass: data[i][5],
        appPassword: data[i][14] || null,  // Column 15 - Application Password
        amazonPartnerTag: partnerTagColIdx >= 0 ? data[i][partnerTagColIdx] : null
      };
    }
  }

  return null;
}

/**
 * Utwórz produkt w WooCommerce PRZEZ WordPress plugin
 * Plugin automatycznie synchronizuje do WooCommerce!
 * @private
 * @param {Object} site - Dane strony
 * @param {Object} product - Dane produktu
 * @returns {number|null} WordPress Post ID lub null
 */
function createWooCommerceProduct_(site, product) {
  try {
    // WAŻNE: Pobierz Amazon Partner Tag (tracking ID) z Sites sheet!
    const trackingId = site.amazonPartnerTag || getAmazonPartnerTag_(site.domain);

    // Przygotuj dane produktu dla WordPress plugin WAAS
    // MAPOWANIE WSZYSTKICH DANYCH zgodnie z wymaganiami
    // UWAGA: getSelectedProducts() konwertuje wszystkie nagłówki na małe litery!
    // Np. 'BulletPoints' → 'bulletpoints', 'Image URL' → 'image_url'
    const productData = {
      asin: product.asin,
      title: product.name || product.product_name || product.productname,
      price: extractNumericPrice_(product.price || '0'),
      brand: product.brand || product.brandname,
      image_url: product.image_url || product.imageurl,
      affiliate_link: product.affiliate_link || product.affiliatelink,
      rating: product.rating,
      review_count: product.reviews_count || product.reviewscount,
      category: product.category || product.categoryname,
      category_name: product.category || product.categoryname,
      // BulletPoints → bulletpoints (wszystkie małe litery po konwersji)
      features: product.features || product.bulletpoints || product.bullet_points,
      color_name: product.colorname || product.color_name,
      description: product.description
    };

    // CRITICAL FIX: Dodaj FeaturedImageSource PIERWSZY!
    // getSelectedProducts() konwertuje nagłówki na małe litery, więc szukamy 'featuredimagesource'
    const featuredImage = product.featuredimagesource || product['featuredimagesource'] ||
                          product.featured_image_source || product['featured_image_source'] ||
                          product.FeaturedImageSource || product['FeaturedImageSource'];
    if (featuredImage) {
      productData.FeaturedImageSource = featuredImage;
      logInfo('WooCommerce', `Adding FeaturedImageSource: ${featuredImage}`);
    }

    // CRITICAL FIX: Dodaj wszystkie obrazy Image0Source...Image9Source!
    // WordPress plugin potrzebuje tych danych do galerii
    // Nagłówki są konwertowane na małe litery: 'image0source', 'image1source', etc.
    for (let i = 0; i <= 9; i++) {
      // Szukaj w różnych formatach (wszystkie możliwe konwersje nagłówków)
      const lowerKey = 'image' + i + 'source';
      const underscoreKey = 'image_' + i + '_source';
      const mixedKey = 'Image' + i + 'Source';

      const imageValue = product[lowerKey] || product[underscoreKey] || product[mixedKey];
      if (imageValue && imageValue.trim() !== '') {
        productData['Image' + i + 'Source'] = imageValue;
        logInfo('WooCommerce', `Adding Image${i}Source: ${imageValue}`);
      }
    }

    // CRITICAL FIX: Obsłuż też kolumnę 'images_sources' (lista rozdzielona przecinkami)
    const imagesSources = product.images_sources || product['images_sources'];
    if (imagesSources && typeof imagesSources === 'string') {
      const urls = imagesSources.split(',').map(url => url.trim()).filter(url => url);
      urls.forEach((url, idx) => {
        // Dodaj jako ImageXSource jeśli nie ma jeszcze
        const key = 'Image' + idx + 'Source';
        if (!productData[key]) {
          productData[key] = url;
          logInfo('WooCommerce', `Adding ${key} from images_sources: ${url}`);
        }
      });
    }

    // Auto Update flag (from "Auto Update" column in Google Sheets)
    if (product.auto_update !== undefined) {
      productData.auto_update = product.auto_update === true ? '1' : '0';
      logInfo('WooCommerce', `Auto Update: ${productData.auto_update}`);
    } else if (product['Auto Update'] !== undefined) {
      productData.auto_update = product['Auto Update'] === true ? '1' : '0';
      logInfo('WooCommerce', `Auto Update: ${productData.auto_update}`);
    }

    // Last Price Update (from "Last Price Update" column)
    if (product.last_price_update) {
      productData.last_price_update = product.last_price_update;
      logInfo('WooCommerce', `Last Price Update: ${productData.last_price_update}`);
    } else if (product['Last Price Update']) {
      productData.last_price_update = product['Last Price Update'];
      logInfo('WooCommerce', `Last Price Update: ${productData.last_price_update}`);
    }

    logInfo('WooCommerce', `Sending product to WordPress: ${productData.asin} (${productData.title})`);
    if (trackingId) {
      logInfo('WooCommerce', `Using tracking ID: ${trackingId}`);
    }

    // Użyj makeAuthenticatedRequest() która automatycznie obsługuje autentykację!
    // (Application Password, Cookie auth, etc.)
    const result = makeAuthenticatedRequest(site, 'waas/v1/products/import', {
      method: 'post',
      payload: {
        products: [productData],
        domain: site.domain,
        tracking_id: trackingId  // WAŻNE: Wysyłamy tracking ID!
      }
    });

    logInfo('WooCommerce', `WordPress API response: ${result.statusCode}`);

    if (result.success && result.data && result.data.success) {
      const productResult = result.data.results[0];

      if (productResult && productResult.status === 'success') {
        logSuccess('WooCommerce', `Product exported: ${product.asin} -> WP Post ID: ${productResult.post_id}, WC ID: ${productResult.wc_product_id || 'N/A'}`);

        // Zwróć obiekt z oboma ID
        return {
          post_id: productResult.post_id,
          wc_product_id: productResult.wc_product_id
        };
      } else if (productResult && productResult.status === 'error') {
        throw new Error(productResult.message || 'Product import failed');
      }
    }

    throw new Error(`WordPress API Error ${result.statusCode}: ${JSON.stringify(result.data)}`);

  } catch (error) {
    logError('WooCommerce', `Export error for ${product.asin}: ${error.message}`);
    throw new Error(`Export failed: ${error.message}`);
  }
}

/**
 * Pobierz Amazon Partner Tag dla domeny
 * @private
 * @param {string} domain - Domena
 * @returns {string|null} Amazon Partner Tag lub null
 */
function getAmazonPartnerTag_(domain) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sitesSheet = ss.getSheetByName('Sites');
    const data = sitesSheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź kolumnę "Amazon Partner Tag"
    const tagColIdx = headers.findIndex(h => h === 'Amazon Partner Tag');
    if (tagColIdx === -1) {
      logWarning('WooCommerce', 'Amazon Partner Tag column not found in Sites sheet');
      return null;
    }

    // Znajdź domenę
    const domainColIdx = headers.findIndex(h => h === 'Domain');
    if (domainColIdx === -1) return null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][domainColIdx] === domain) {
        const tag = data[i][tagColIdx];
        return tag || null;
      }
    }

    return null;
  } catch (error) {
    logError('WooCommerce', `Error getting Amazon Partner Tag: ${error.message}`);
    return null;
  }
}

/**
 * Wyciągnij cenę numeryczną z formatu tekstowego
 * @private
 */
function extractNumericPrice_(priceString) {
  if (!priceString) return '0';

  // Usuń wszystko oprócz cyfr, kropki i przecinka
  let numeric = priceString.toString()
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.');

  // Parsuj jako float
  const price = parseFloat(numeric);
  return isNaN(price) ? '0' : price.toFixed(2);
}

// =============================================================================
// SYNC Z WORDPRESS (IMPORT)
// =============================================================================

/**
 * Synchronizuj produkty z WordPress do arkusza
 * Produkty importowane z WP będą miały Source = "WordPress"
 */
function syncProductsFromWordPress() {
  const ui = SpreadsheetApp.getUi();

  // Pokaż dialog wyboru strony
  const sitesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const sitesData = sitesSheet.getDataRange().getValues();

  if (sitesData.length <= 1) {
    ui.alert('No Sites', 'No sites found. Please add a site first.', ui.ButtonSet.OK);
    return;
  }

  // Buduj listę stron
  let siteOptions = '';
  for (let i = 1; i < sitesData.length; i++) {
    const siteId = sitesData[i][0];
    const siteName = sitesData[i][1];
    const domain = sitesData[i][2];
    siteOptions += `<option value="${siteId}">${siteName} (${domain})</option>`;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer; }
      button:hover { background: #357ae8; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    </style>

    <div class="info">
      <strong>Sync Products from WordPress</strong><br>
      This will import products from WooCommerce to the spreadsheet.<br>
      Imported products will have Source = "WordPress".
    </div>

    <div class="form-group">
      <label>Select Site:</label>
      <select id="siteId">${siteOptions}</select>
    </div>

    <button onclick="syncProducts()">Sync Products</button>

    <script>
      function syncProducts() {
        const siteId = parseInt(document.getElementById('siteId').value);

        google.script.run
          .withSuccessHandler(() => {
            alert('Sync completed!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .importProductsFromWooCommerce(siteId);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(300);

  ui.showModalDialog(html, 'Sync Products from WordPress');
}

/**
 * Importuj produkty z WooCommerce do arkusza
 * @param {number} siteId - ID strony
 */
function importProductsFromWooCommerce(siteId) {
  const site = getSiteById_(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  logInfo('WooCommerce', `Importing products from ${site.domain}`);

  // Pobierz produkty z WordPress (przez plugin WAAS)
  const wcProducts = fetchWooCommerceProducts_(site);

  if (!wcProducts || wcProducts.length === 0) {
    logWarning('WooCommerce', 'No products found in WordPress');
    return 0;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Znajdź indeksy kolumn
  const sourceColIdx = headers.indexOf('Source');
  const domainColIdx = headers.indexOf('Target Domain');
  const wcIdColIdx = headers.indexOf('WC Product ID');

  let imported = 0;

  for (const wcProduct of wcProducts) {
    try {
      // Sprawdź czy produkt już istnieje (po WC Product ID)
      const existingRow = findProductByWcId_(sheet, wcProduct.id);

      if (existingRow) {
        // Aktualizuj istniejący produkt
        updateProductFromWc_(sheet, existingRow, wcProduct, site.domain);
        logInfo('WooCommerce', `Updated product from WP: ${wcProduct.name}`);
      } else {
        // Dodaj nowy produkt
        addProductFromWc_(sheet, wcProduct, site.domain, headers);
        logSuccess('WooCommerce', `Imported product from WP: ${wcProduct.name}`);
        imported++;
      }
    } catch (error) {
      logError('WooCommerce', `Error importing ${wcProduct.name}: ${error.message}`);
    }
  }

  logSuccess('WooCommerce', `Imported ${imported} products from ${site.domain}`);
  return imported;
}

/**
 * Pobierz produkty z WordPress (przez plugin WAAS)
 * @private
 */
function fetchWooCommerceProducts_(site) {
  try {
    logInfo('WooCommerce', `Fetching products from WordPress: ${site.domain}`);

    // Użyj makeAuthenticatedRequest() zamiast bezpośredniego UrlFetchApp!
    const result = makeAuthenticatedRequest(site, 'waas/v1/products/list', {
      method: 'get'
    });

    logInfo('WooCommerce', `WordPress API response: ${result.statusCode}`);

    if (result.success && result.data && result.data.products) {
      logSuccess('WooCommerce', `Fetched ${result.data.products.length} products from WordPress`);
      return result.data.products;
    }

    throw new Error(`WordPress API Error ${result.statusCode}: ${JSON.stringify(result.data)}`);

  } catch (error) {
    logError('WooCommerce', `Fetch products error: ${error.message}`);
    throw error;
  }
}

/**
 * Znajdź produkt po WC Product ID
 * @private
 */
function findProductByWcId_(sheet, wcId) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const wcIdColIdx = headers.indexOf('WC Product ID');

  if (wcIdColIdx === -1) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][wcIdColIdx] == wcId) {
      return i + 1;
    }
  }

  return null;
}

/**
 * Dodaj produkt z WooCommerce
 * @private
 */
function addProductFromWc_(sheet, wcProduct, domain, headers) {
  const id = getNextId('Products');

  // Przygotuj wiersz
  const row = new Array(headers.length).fill('');

  // Mapuj dane WC na kolumny
  row[headers.indexOf('ID')] = id;
  row[headers.indexOf('ASIN')] = extractAsinFromUrl_(wcProduct.external_url) || '';
  row[headers.indexOf('Product Name')] = wcProduct.name;
  row[headers.indexOf('Category')] = wcProduct.categories && wcProduct.categories[0] ? wcProduct.categories[0].name : '';
  row[headers.indexOf('Price')] = wcProduct.regular_price || '';
  row[headers.indexOf('Image URL')] = wcProduct.images && wcProduct.images[0] ? wcProduct.images[0].src : '';
  row[headers.indexOf('Affiliate Link')] = wcProduct.external_url || '';
  row[headers.indexOf('Status')] = wcProduct.status === 'publish' ? 'Active' : 'Inactive';
  row[headers.indexOf('Last Updated')] = new Date();
  row[headers.indexOf('Added Date')] = new Date();

  // Nowe kolumny
  const selectIdx = headers.indexOf('Select');
  const domainIdx = headers.indexOf('Target Domain');
  const sourceIdx = headers.indexOf('Source');
  const wcIdIdx = headers.indexOf('WC Product ID');

  if (selectIdx >= 0) row[selectIdx] = false;
  if (domainIdx >= 0) row[domainIdx] = domain;
  if (sourceIdx >= 0) row[sourceIdx] = 'WordPress';
  if (wcIdIdx >= 0) row[wcIdIdx] = wcProduct.id;

  sheet.appendRow(row);
}

/**
 * Aktualizuj produkt z WC
 * @private
 */
function updateProductFromWc_(sheet, rowIdx, wcProduct, domain) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Aktualizuj wybrane pola
  const updates = {
    'Product Name': wcProduct.name,
    'Price': wcProduct.regular_price,
    'Status': wcProduct.status === 'publish' ? 'Active' : 'Inactive',
    'Last Updated': new Date()
  };

  for (const [header, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(header);
    if (colIdx >= 0 && value !== undefined) {
      sheet.getRange(rowIdx, colIdx + 1).setValue(value);
    }
  }
}

/**
 * Wyciągnij ASIN z URL Amazon
 * @private
 */
function extractAsinFromUrl_(url) {
  if (!url) return null;

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /tag=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && match[1].length === 10) {
      return match[1];
    }
  }

  return null;
}

/**
 * Pobierz stronę po ID
 * @private
 */
function getSiteById_(siteId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sites');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Znajdź kolumnę Amazon Partner Tag
  const partnerTagColIdx = headers.findIndex(h => h === 'Amazon Partner Tag');

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == siteId) {
      return {
        id: data[i][0],
        name: data[i][1],
        domain: data[i][2],
        wpUrl: data[i][3],
        adminUser: data[i][4],
        adminPass: data[i][5],
        appPassword: data[i][14] || null,  // Column 15 - Application Password
        amazonPartnerTag: partnerTagColIdx >= 0 ? data[i][partnerTagColIdx] : null
      };
    }
  }

  return null;
}

// =============================================================================
// DIALOG EKSPORTU Z WYBOREM DOMENY
// =============================================================================

/**
 * Pokaż dialog eksportu z możliwością wyboru domeny
 */
function showExportToWooCommerceDialog() {
  const ui = SpreadsheetApp.getUi();

  // Pobierz zaznaczone produkty
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    ui.alert('No Selection', 'Please select products to export using the checkboxes in the "Select" column.', ui.ButtonSet.OK);
    return;
  }

  // Pobierz listę domen
  const sitesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sites');
  const sitesData = sitesSheet.getDataRange().getValues();

  let domainOptions = '';
  for (let i = 1; i < sitesData.length; i++) {
    const domain = sitesData[i][2];
    if (domain) {
      domainOptions += `<option value="${domain}">${domain}</option>`;
    }
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; }
      button:hover { background: #2d8e47; }
      .info { background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
      .selected-count { font-size: 18px; font-weight: bold; color: #4285f4; }
    </style>

    <div class="info">
      <span class="selected-count">${selectedProducts.length} products selected</span>
    </div>

    <div class="form-group">
      <label>Target Domain:</label>
      <select id="domain">${domainOptions}</select>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="setDomain" checked>
        Set this domain for all selected products
      </label>
    </div>

    <button onclick="exportProducts()">Export to WooCommerce</button>

    <script>
      function exportProducts() {
        const domain = document.getElementById('domain').value;
        const setDomain = document.getElementById('setDomain').checked;

        google.script.run
          .withSuccessHandler(() => {
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .exportSelectedWithDomain(domain, setDomain);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(300);

  ui.showModalDialog(html, 'Export to WooCommerce');
}

/**
 * Eksportuj zaznaczone produkty z ustawieniem domeny
 */
function exportSelectedWithDomain(domain, setDomain) {
  if (setDomain) {
    // Ustaw domenę dla wszystkich zaznaczonych produktów
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Products');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const selectColIdx = headers.indexOf('Select');
    const domainColIdx = headers.indexOf('Target Domain');

    if (selectColIdx >= 0 && domainColIdx >= 0) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][selectColIdx] === true) {
          sheet.getRange(i + 1, domainColIdx + 1).setValue(domain);
        }
      }
    }
  }

  // Teraz eksportuj
  exportSelectedToWooCommerce();
}
