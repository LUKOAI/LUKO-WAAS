/**
 * SP-API Data Collection for WAAS System
 * Fetches product data via Amazon SP-API and writes to Products sheet
 *
 * KEY FEATURES:
 * - Maps SP-API data to EXISTING Products sheet columns (like PA-API)
 * - Writes to ALL matching columns (same as PA-API behavior)
 * - AUTO-CREATES missing columns for SP-API-specific data
 *
 * Target sheet: Products
 *
 * SP-API endpoints used:
 * - /catalog/2022-04-01/items/{asin} - Product details
 * - /catalog/2022-04-01/items - Search by keyword
 * - /products/pricing/v0/items/{asin}/offers - Pricing & seller info
 *
 * @version 2.0
 * @author NetAnaliza / LUKO
 */

// ==================== COLUMN MAPPING: SP-API -> Products sheet ====================

/**
 * Maps SP-API data fields to WAAS Products sheet column names.
 * ALL matching columns get filled (same behavior as PA-API).
 * If none of the candidate columns exist, spEnsureProductColumns() creates the first one.
 */
function spGetColumnMapping() {
  return {
    // Core fields
    'asin':             ['ASIN'],
    'title':            ['Product Name', 'Title'],
    'titleShort':       ['TitleShort'],
    'titleLabel':       ['TitleLabel'],
    'brand':            ['Brand', 'BrandName'],
    'price':            ['Price'],
    'listPrice':        ['ListPrice'],
    'priceFormatted':   ['PriceFormatted'],
    'priceText':        ['PriceText'],
    'priceCurrency':    ['PriceCurrency'],
    'category':         ['Category', 'CategoryName', 'MainCategoryName'],
    'link':             ['Affiliate Link', 'Link', 'Url', 'ProductUrl'],
    'mainImageURL':     ['Image URL', 'Image0Source', 'FeaturedImageSource', 'featured_image_source'],
    'status':           ['Status'],
    'lastUpdated':      ['Last Updated'],
    'source':           ['Source'],
    'addedDate':        ['Added Date'],
    'marketplace':      ['Marketplace'],

    // Sales Ranks
    'salesRank1':       ['BestSellerRank', 'BestSellerRank1'],
    'salesRank1Cat':    ['BSRProductCategory', 'BSRProductCategoryName'],

    // Browse Nodes
    'browseNodeName':   ['BrowseNodeDisplayName'],
    'browseNodeId':     ['browse_node_id'],

    // Bullet Points / Features
    'bulletPoints':     ['BulletPoints'],
    'features':         ['Features'],
    'featuresLabel':    ['FeaturesLabel'],

    // Description
    'description':      ['Description'],

    // Identifiers
    'ean':              ['EAN'],
    'upc':              ['UPC'],
    'gtin':             ['GTIN'],
    'mpn':              ['MPN'],
    'partNumber':       ['PartNumber'],
    'colorName':        ['ColorName'],
    'sizeName':         ['SizeName'],
    'sizeLabel':        ['SizeLabel'],
    'manufacturer':     ['Manufacturer'],
    'manufacturerLabel':['ManufacturerLabel'],
    'model':            ['Model'],
    'modelLabel':       ['ModelLabel'],
    'material':         ['Material'],
    'unitCount':        ['UnitCount'],

    // Images
    'image1':           ['Image1Source'],
    'image2':           ['Image2Source'],
    'image3':           ['Image3Source'],
    'image4':           ['Image4Source'],
    'image5':           ['Image5Source'],
    'image6':           ['Image6Source'],
    'image7':           ['Image7Source'],
    'image8':           ['Image8Source'],
    'image9':           ['Image9Source'],
    'imagesSources':    ['images_sources'],

    // Relationships
    'parentAsin':       ['ParentAsin'],
    'isVariant':        ['IsVariant'],
    'hasParent':        ['HasParent'],
    'variationCount':   ['VariationCount'],
    'variationTheme':   ['VariationTheme'],

    // Boolean flags
    'hasImages':        ['HasImages'],
    'hasPrimaryImage':  ['HasPrimaryImage'],
    'hasDimensions':    ['HasDimensions'],
    'hasVariantImages': ['HasVariantImages'],

    // Prime / Availability
    'isPrime':          ['IsPrime'],
    'availability':     ['Availability'],
    'availabilityMsg':  ['AvailabilityMessage'],

    // Savings
    'savingsAmount':    ['SavingsAmount'],
    'savingsPercent':   ['SavingsPercent'],

    // Dimensions
    'itemWeight':       ['ItemWeight'],
    'itemWeightUnit':   ['ItemWeightUnit'],
    'itemHeight':       ['ItemHeight'],
    'itemHeightUnit':   ['ItemHeightUnit'],
    'itemWidth':        ['ItemWidth'],
    'itemWidthUnit':    ['ItemWidthUnit'],
    'itemLength':       ['ItemLength'],
    'itemLengthUnit':   ['ItemLengthUnit'],

    // Product attributes
    'productType':      ['ProductType'],
    'titleLength':      ['TitleLength'],
    'titleWords':       ['TitleWords']
  };
}

/**
 * List of SP-API fields that carry actual product data (not metadata/flags).
 * Used by spEnsureProductColumns() to decide which columns to auto-create.
 * Excludes boolean flags, status fields, and metadata that are always set.
 */
function spGetDataFields() {
  return [
    'asin', 'title', 'titleShort', 'titleLabel', 'brand', 'price', 'listPrice',
    'priceFormatted', 'priceText', 'priceCurrency', 'category', 'link',
    'mainImageURL', 'marketplace', 'source', 'status', 'lastUpdated', 'addedDate',
    'salesRank1', 'salesRank1Cat',
    'browseNodeName', 'browseNodeId',
    'bulletPoints', 'features', 'featuresLabel', 'description',
    'ean', 'upc', 'gtin', 'mpn', 'partNumber',
    'colorName', 'sizeName', 'sizeLabel',
    'manufacturer', 'manufacturerLabel',
    'model', 'modelLabel', 'material', 'unitCount',
    'image1', 'image2', 'image3', 'image4', 'image5',
    'image6', 'image7', 'image8', 'image9', 'imagesSources',
    'parentAsin', 'isVariant', 'hasParent',
    'variationCount', 'variationTheme',
    'hasImages', 'hasPrimaryImage', 'hasDimensions', 'hasVariantImages',
    'isPrime', 'availability', 'availabilityMsg',
    'savingsAmount', 'savingsPercent',
    'itemWeight', 'itemWeightUnit',
    'itemHeight', 'itemHeightUnit',
    'itemWidth', 'itemWidthUnit',
    'itemLength', 'itemLengthUnit',
    'productType', 'titleLength', 'titleWords'
  ];
}

// ==================== AUTO-CREATE MISSING COLUMNS ====================

/**
 * Ensures all SP-API data fields have at least one target column in Products sheet.
 * If a field has NO matching column in the sheet, the first candidate column name
 * from the mapping is appended to the sheet header row.
 *
 * @param {Sheet} sheet - Products sheet
 * @returns {Object} Updated headerInfo { headers, headerIndex }
 */
function spEnsureProductColumns(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const headerIndex = {};

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c].toString().trim();
    if (h) headerIndex[h] = c;
  }

  const mapping = spGetColumnMapping();
  const dataFields = spGetDataFields();
  const newColumns = [];

  for (const field of dataFields) {
    const candidates = mapping[field];
    if (!candidates || candidates.length === 0) continue;

    // Check if at least one candidate column exists
    const found = candidates.some(colName => headerIndex[colName] !== undefined);

    if (!found) {
      // Use the first candidate name as the new column
      const newColName = candidates[0];
      // Avoid duplicates in newColumns list
      if (!newColumns.includes(newColName)) {
        newColumns.push(newColName);
      }
    }
  }

  if (newColumns.length > 0) {
    const startCol = lastCol + 1;
    const range = sheet.getRange(1, startCol, 1, newColumns.length);
    range.setValues([newColumns]);

    Logger.log(`[SP-API] Auto-created ${newColumns.length} new columns: ${newColumns.join(', ')}`);

    // Rebuild headerIndex with new columns
    for (let i = 0; i < newColumns.length; i++) {
      headerIndex[newColumns[i]] = lastCol + i;
      headers.push(newColumns[i]);
    }
  }

  return { headers, headerIndex };
}

// ==================== MENU FUNCTIONS ====================

/**
 * Menu: SP-API Import by ASIN (main product only)
 */
function spMenuImportByASIN() {
  const ui = SpreadsheetApp.getUi();

  if (!spHasCredentials()) {
    ui.alert('SP-API nie skonfigurowane',
      'Brak danych SP-API.\n\nUruchom: WAAS > Products > SP-API Import > Setup Credentials',
      ui.ButtonSet.OK);
    return;
  }

  const response = ui.prompt(
    'SP-API: Import po ASIN',
    'Wpisz ASIN(y) do zaimportowania:\n\n' +
    'Jeden: B08N5WRWNW\n' +
    'Wiele: B08N5WRWNW, B07XJ8C8F5\n\n' +
    'Oddziel przecinkami.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const input = response.getResponseText().trim();
  if (!input) return;

  const asins = input.split(',').map(a => a.trim().toUpperCase()).filter(a => /^[A-Z0-9]{10}$/.test(a));

  if (asins.length === 0) {
    ui.alert('Blad', 'Nie znaleziono prawidlowych ASIN-ow.\nASIN = 10 znakow alfanumerycznych (np. B08N5WRWNW)', ui.ButtonSet.OK);
    return;
  }

  const marketplace = spShowMarketplaceSelector();
  if (!marketplace) return;

  const confirmMsg = `Zaimportowac ${asins.length} produkt(ow) z Amazon ${marketplace} przez SP-API?\n\n` +
    `ASIN: ${asins.slice(0, 5).join(', ')}${asins.length > 5 ? '...' : ''}\n` +
    `Dane zapisane w: Products tab`;

  if (ui.alert('Potwierdzenie', confirmMsg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Importuje ${asins.length} produktow z SP-API...`, 'SP-API', 30);
    const results = spFetchAndWriteProducts(asins, marketplace, { fetchVariants: false });

    let resultMsg = `Zaimportowano: ${results.success}\n` +
      `Bledy: ${results.failed}\n` +
      `Pominiete (duplikaty): ${results.skipped}`;

    if (results.errors.length > 0) {
      resultMsg += '\n\nBledy:\n' + results.errors.slice(0, 5).join('\n');
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(resultMsg, 'SP-API - zakonczone', 15);

  } catch (error) {
    ui.alert('SP-API Blad', `Wystapil blad:\n\n${error.message}`, ui.ButtonSet.OK);
    Logger.log(`[SP-API] Error in spMenuImportByASIN: ${error.message}`);
  }
}

/**
 * Menu: SP-API Import ASIN + Variants (child ASINs from same Parent)
 */
function spMenuImportWithVariants() {
  const ui = SpreadsheetApp.getUi();

  if (!spHasCredentials()) {
    ui.alert('SP-API nie skonfigurowane',
      'Brak danych SP-API.\n\nUruchom: WAAS > Products > SP-API Import > Setup Credentials',
      ui.ButtonSet.OK);
    return;
  }

  const response = ui.prompt(
    'SP-API: Import ASIN + warianty',
    'Wpisz ASIN(y) do zaimportowania:\n\n' +
    'Jeden: B08N5WRWNW\n' +
    'Wiele: B08N5WRWNW, B07XJ8C8F5\n\n' +
    'Dla kazdego ASIN zostan\u0105 pobrane rowniez\n' +
    'inne ASIN-y tego samego Parent ASIN (warianty).\n\n' +
    'Oddziel przecinkami.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const input = response.getResponseText().trim();
  if (!input) return;

  const asins = input.split(',').map(a => a.trim().toUpperCase()).filter(a => /^[A-Z0-9]{10}$/.test(a));

  if (asins.length === 0) {
    ui.alert('Blad', 'Nie znaleziono prawidlowych ASIN-ow.', ui.ButtonSet.OK);
    return;
  }

  const marketplace = spShowMarketplaceSelector();
  if (!marketplace) return;

  const confirmMsg = `Zaimportowac ${asins.length} produkt(ow) + warianty z Amazon ${marketplace}?\n\n` +
    `ASIN: ${asins.slice(0, 5).join(', ')}${asins.length > 5 ? '...' : ''}\n\n` +
    `Glowny ASIN -> IsVariant = FALSE\n` +
    `Warianty (ASIN Child) -> IsVariant = TRUE\n` +
    `Dane zapisane w: Products tab`;

  if (ui.alert('Potwierdzenie', confirmMsg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Importuje ${asins.length} produktow + warianty z SP-API...`, 'SP-API', 30);
    const results = spFetchAndWriteProducts(asins, marketplace, { fetchVariants: true });

    let resultMsg = `Glowne: ${results.success}\n` +
      `Warianty: ${results.variants}\n` +
      `Bledy: ${results.failed}\n` +
      `Pominiete (duplikaty): ${results.skipped}`;

    if (results.newColumns > 0) {
      resultMsg += `\nNowe kolumny: ${results.newColumns}`;
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(resultMsg, 'SP-API - zakonczone', 15);

  } catch (error) {
    ui.alert('SP-API Blad', `Wystapil blad:\n\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Menu: SP-API Search by keyword
 */
function spMenuSearchByKeyword() {
  const ui = SpreadsheetApp.getUi();

  if (!spHasCredentials()) {
    ui.alert('SP-API nie skonfigurowane',
      'Brak danych SP-API.\n\nUruchom: WAAS > Products > SP-API Import > Setup Credentials',
      ui.ButtonSet.OK);
    return;
  }

  const response = ui.prompt(
    'SP-API: Szukaj produktow',
    'Wpisz fraze do wyszukania (np. "laptop", "butelka termiczna"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const searchTerm = response.getResponseText().trim();
  if (!searchTerm) return;

  const marketplace = spShowMarketplaceSelector();
  if (!marketplace) return;

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Szukam "${searchTerm}" w Amazon ${marketplace}...`, 'SP-API', 30);

    const accessToken = spGetAccessToken();
    const mpConfig = SP_MARKETPLACE_CONFIG[marketplace];

    const searchResults = spSearchProducts(searchTerm, mpConfig, accessToken, 5);

    if (searchResults.length === 0) {
      ui.alert('Brak wynikow', `Nie znaleziono produktow dla "${searchTerm}" w ${marketplace}.`, ui.ButtonSet.OK);
      return;
    }

    const preview = searchResults.slice(0, 10).map(r => `${r.asin} - ${(r.title || '').substring(0, 60)}`).join('\n');
    const countResponse = ui.prompt(
      `Znaleziono: ${searchResults.length} produktow`,
      `Przyklad:\n${preview}\n\n` +
      `Ile produktow zaimportowac do Products tab?\n` +
      `Wpisz liczbe (np. 10, 50) lub "all" dla wszystkich.\n` +
      `Wpisz "0" aby anulowac.`,
      ui.ButtonSet.OK_CANCEL
    );

    if (countResponse.getSelectedButton() !== ui.Button.OK) return;

    let countInput = countResponse.getResponseText().trim().toLowerCase();
    if (countInput === '0') return;

    let importCount = searchResults.length;
    if (countInput && countInput !== 'all' && countInput !== '') {
      const parsed = parseInt(countInput, 10);
      if (!isNaN(parsed) && parsed > 0) {
        importCount = Math.min(parsed, searchResults.length);
      }
    }

    const asinsToImport = searchResults.slice(0, importCount).map(r => r.asin);

    SpreadsheetApp.getActiveSpreadsheet().toast(`Importuje ${asinsToImport.length} produktow...`, 'SP-API', 30);
    const results = spFetchAndWriteProducts(asinsToImport, marketplace, { fetchVariants: false });

    let resultMsg = `Zaimportowano: ${results.success}\nBledy: ${results.failed}\nPominiete: ${results.skipped}`;
    SpreadsheetApp.getActiveSpreadsheet().toast(resultMsg, 'SP-API - zakonczone', 15);

  } catch (error) {
    ui.alert('SP-API Blad', `Wystapil blad:\n\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Menu: SP-API Import from selected cells
 */
function spMenuImportFromSelection() {
  const ui = SpreadsheetApp.getUi();

  if (!spHasCredentials()) {
    ui.alert('SP-API nie skonfigurowane',
      'Brak danych SP-API.\n\nUruchom: WAAS > Products > SP-API Import > Setup Credentials',
      ui.ButtonSet.OK);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const selection = ss.getActiveSheet().getActiveRange();
  if (!selection) {
    ui.alert('Zaznacz komorki', 'Zaznacz komorki z ASIN-ami i sprobuj ponownie.', ui.ButtonSet.OK);
    return;
  }

  const values = selection.getValues();
  const asins = [];
  for (const row of values) {
    for (const cell of row) {
      const val = cell.toString().trim().toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(val)) asins.push(val);
    }
  }

  if (asins.length === 0) {
    ui.alert('Brak ASIN', 'Zaznaczone komorki nie zawieraja prawidlowych ASIN-ow.', ui.ButtonSet.OK);
    return;
  }

  const marketplace = spShowMarketplaceSelector();
  if (!marketplace) return;

  if (ui.alert('Potwierdzenie',
    `Zaimportowac ${asins.length} ASIN(ow) z Amazon ${marketplace}?\n${asins.slice(0, 10).join(', ')}`,
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Importuje ${asins.length} produktow...`, 'SP-API', 30);
    const results = spFetchAndWriteProducts(asins, marketplace, { fetchVariants: false });
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Gotowe! Dodano: ${results.success}, Bledy: ${results.failed}, Pominiete: ${results.skipped}`,
      'SP-API', 10
    );
  } catch (error) {
    ui.alert('SP-API Blad', error.message, ui.ButtonSet.OK);
  }
}

// ==================== CORE DATA COLLECTION ====================

/**
 * Fetch product data for multiple ASINs and write to Products tab
 * @param {string[]} asins - Array of ASINs to fetch
 * @param {string} marketplace - Marketplace code (DE, FR, etc.)
 * @param {Object} options - { fetchVariants: boolean }
 * @returns {Object} { success, failed, skipped, variants, newColumns, errors }
 */
function spFetchAndWriteProducts(asins, marketplace, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mpConfig = SP_MARKETPLACE_CONFIG[marketplace];

  if (!mpConfig) throw new Error(`Unknown marketplace: ${marketplace}`);

  const productsSheet = ss.getSheetByName('Products');
  if (!productsSheet) throw new Error('Products tab not found!');

  // Auto-create missing columns BEFORE building header map
  const colsBefore = productsSheet.getLastColumn();
  const headerInfo = spEnsureProductColumns(productsSheet);
  const colsAfter = productsSheet.getLastColumn();
  const newColumnsCreated = colsAfter - colsBefore;

  if (newColumnsCreated > 0) {
    Logger.log(`[SP-API] Created ${newColumnsCreated} new columns in Products sheet`);
  }

  // Get existing ASIN+Marketplace combinations
  const existing = spGetExistingKeys(productsSheet, headerInfo);

  // Get next ID
  let nextId = spGetNextId(productsSheet, headerInfo);

  const accessToken = spGetAccessToken();
  const results = { success: 0, failed: 0, skipped: 0, variants: 0, newColumns: newColumnsCreated, errors: [] };
  const startTime = Date.now();
  const maxTime = 4.5 * 60 * 1000;

  for (let i = 0; i < asins.length; i++) {
    const asin = asins[i];

    if (Date.now() - startTime > maxTime) {
      Logger.log(`[SP-API] Timeout after ${i} products.`);
      SpreadsheetApp.getActiveSpreadsheet().toast(`Timeout! Zaimportowano ${results.success}.`, 'SP-API', 10);
      break;
    }

    // Duplicate check: ASIN + Marketplace
    const key = `${asin}|${marketplace}`;
    if (existing.has(key)) {
      results.skipped++;
      continue;
    }

    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Pobieram ${asin} (${i + 1}/${asins.length})...`, 'SP-API', 30);

      // Fetch product data
      const productData = spFetchProductData(asin, mpConfig, accessToken);
      Utilities.sleep(300);

      // Fetch pricing
      try {
        const pricing = spFetchPricing(asin, mpConfig, accessToken);
        productData.price = pricing.listPrice || productData.catalogListPrice || '';
        productData.currentPrice = pricing.currentPrice || '';
        productData.currency = pricing.currency || productData.catalogCurrency || '';
        productData.isPrime = pricing.isPrime || '';
      } catch (e) {
        Logger.log(`[SP-API] Pricing failed for ${asin}: ${e.message}`);
        productData.price = productData.catalogListPrice || '';
        productData.currency = productData.catalogCurrency || '';
      }
      Utilities.sleep(200);

      // Write main product
      productData.isVariant = false;
      spWriteProductRow(productsSheet, headerInfo, productData, marketplace, nextId++);
      existing.add(key);
      results.success++;

      // Fetch variants (child ASINs) if requested
      if (options.fetchVariants && productData.childAsins) {
        const childList = productData.childAsins.split(',').map(a => a.trim()).filter(a => a && a !== asin);
        const maxVariants = Math.min(childList.length, 20);

        for (let j = 0; j < maxVariants; j++) {
          const childAsin = childList[j];
          const childKey = `${childAsin}|${marketplace}`;
          if (existing.has(childKey)) continue;

          if (Date.now() - startTime > maxTime) break;

          try {
            SpreadsheetApp.getActiveSpreadsheet().toast(
              `Wariant ${childAsin} (${j + 1}/${maxVariants})...`, 'SP-API', 30);

            const childData = spFetchProductData(childAsin, mpConfig, accessToken);
            Utilities.sleep(300);

            try {
              const childPricing = spFetchPricing(childAsin, mpConfig, accessToken);
              childData.price = childPricing.listPrice || childData.catalogListPrice || '';
              childData.currentPrice = childPricing.currentPrice || '';
              childData.currency = childPricing.currency || childData.catalogCurrency || '';
              childData.isPrime = childPricing.isPrime || '';
            } catch (e) {
              childData.price = childData.catalogListPrice || '';
            }
            Utilities.sleep(200);

            childData.isVariant = true;
            spWriteProductRow(productsSheet, headerInfo, childData, marketplace, nextId++);
            existing.add(childKey);
            results.variants++;

          } catch (e) {
            Logger.log(`[SP-API] Variant ${childAsin} failed: ${e.message}`);
          }

          Utilities.sleep(500);
        }
      }

      // If no children but has parent, try sibling variants
      if (options.fetchVariants && !productData.childAsins && productData.parentAsin) {
        const parentAsin = productData.parentAsin;

        try {
          const parentData = spFetchProductData(parentAsin, mpConfig, accessToken);
          Utilities.sleep(300);

          if (parentData.childAsins) {
            const siblings = parentData.childAsins.split(',').map(a => a.trim()).filter(a => a && a !== asin);
            const maxSiblings = Math.min(siblings.length, 20);

            for (let j = 0; j < maxSiblings; j++) {
              const sibAsin = siblings[j];
              const sibKey = `${sibAsin}|${marketplace}`;
              if (existing.has(sibKey)) continue;

              if (Date.now() - startTime > maxTime) break;

              try {
                SpreadsheetApp.getActiveSpreadsheet().toast(
                  `Wariant ${sibAsin} (${j + 1}/${maxSiblings})...`, 'SP-API', 30);

                const sibData = spFetchProductData(sibAsin, mpConfig, accessToken);
                Utilities.sleep(300);

                try {
                  const sibPricing = spFetchPricing(sibAsin, mpConfig, accessToken);
                  sibData.price = sibPricing.listPrice || sibData.catalogListPrice || '';
                  sibData.currentPrice = sibPricing.currentPrice || '';
                  sibData.currency = sibPricing.currency || sibData.catalogCurrency || '';
                  sibData.isPrime = sibPricing.isPrime || '';
                } catch (e) {
                  sibData.price = sibData.catalogListPrice || '';
                }
                Utilities.sleep(200);

                sibData.isVariant = true;
                spWriteProductRow(productsSheet, headerInfo, sibData, marketplace, nextId++);
                existing.add(sibKey);
                results.variants++;

              } catch (e) {
                Logger.log(`[SP-API] Variant sibling ${sibAsin} failed: ${e.message}`);
              }

              Utilities.sleep(500);
            }
          }
        } catch (e) {
          Logger.log(`[SP-API] Parent ${parentAsin} failed: ${e.message}`);
        }
      }

    } catch (error) {
      Logger.log(`[SP-API] Failed ${asin}: ${error.message}`);
      results.failed++;
      results.errors.push(`${asin}: ${error.message}`);
    }

    Utilities.sleep(500);
  }

  return results;
}

// ==================== PRODUCT DATA FETCHING ====================

/**
 * Fetch product details from SP-API Catalog Items API
 */
function spFetchProductData(asin, mpConfig, accessToken) {
  const path = `/catalog/2022-04-01/items/${asin}`;
  const params = {
    marketplaceIds: mpConfig.marketplaceId,
    includedData: 'attributes,images,productTypes,salesRanks,summaries,dimensions,identifiers,relationships,classifications'
  };

  const response = spCallAPI('GET', path, params, accessToken);

  const attributes = response.attributes || {};
  const summaries = response.summaries || [];
  const images = response.images || [];
  const dimensions = response.dimensions || [];
  const identifiers = response.identifiers || [];
  const salesRanks = response.salesRanks || [];
  const relationships = response.relationships || [];
  const classifications = response.classifications || [];

  const summary = summaries[0] || {};

  const getAttr = (name) => attributes[name]?.[0]?.value || '';

  // Identifiers
  const ids = {};
  for (const idGroup of identifiers) {
    if (idGroup.marketplaceId === mpConfig.marketplaceId) {
      for (const id of (idGroup.identifiers || [])) {
        if (id.identifierType === 'EAN') ids.ean = id.identifier;
        if (id.identifierType === 'UPC') ids.upc = id.identifier;
        if (id.identifierType === 'GTIN') ids.gtin = id.identifier;
      }
      break;
    }
  }

  // Images
  const imageGroup = images[0]?.images || [];
  const mainImageObj = imageGroup.find(i => i.variant === 'MAIN') || imageGroup[0] || {};
  const mainImage = mainImageObj.link || '';
  const additionalImages = imageGroup.filter(i => i.variant !== 'MAIN');
  const allImageUrls = imageGroup.map(i => i.link).filter(Boolean);
  const variantImages = imageGroup.filter(i => i.variant && i.variant !== 'MAIN');

  // Price from catalog attributes
  let catalogListPrice = '';
  let catalogCurrency = '';
  if (attributes.list_price && attributes.list_price[0]) {
    const priceData = attributes.list_price[0];
    if (priceData.value_with_tax !== undefined) {
      const rawValue = priceData.value_with_tax;
      catalogListPrice = (Number.isInteger(rawValue) && rawValue > 100)
        ? (rawValue / 100).toFixed(2)
        : parseFloat(rawValue).toFixed(2);
    } else if (priceData.value) {
      catalogListPrice = priceData.value;
    }
    catalogCurrency = priceData.currency || 'EUR';
  }

  // Dimensions
  const dimData = {};
  for (const dim of dimensions) {
    if (dim.marketplaceId === mpConfig.marketplaceId) {
      const itemDims = dim.item || {};
      dimData.itemWeight = itemDims.weight?.value || '';
      dimData.itemWeightUnit = itemDims.weight?.unit || '';
      dimData.itemHeight = itemDims.height?.value || '';
      dimData.itemHeightUnit = itemDims.height?.unit || '';
      dimData.itemWidth = itemDims.width?.value || '';
      dimData.itemWidthUnit = itemDims.width?.unit || '';
      dimData.itemLength = itemDims.length?.value || '';
      dimData.itemLengthUnit = itemDims.length?.unit || '';
      dimData.hasDimensions = !!(itemDims.weight || itemDims.height || itemDims.width || itemDims.length);
      break;
    }
  }

  // Sales Ranks
  const ranks = {};
  for (const rankGroup of salesRanks) {
    if (rankGroup.marketplaceId === mpConfig.marketplaceId) {
      const classRanks = rankGroup.classificationRanks || [];
      if (classRanks[0]) { ranks.rank1 = classRanks[0].rank; ranks.rank1Cat = classRanks[0].title; }
      const displayRanks = rankGroup.displayGroupRanks || [];
      if (displayRanks[0]) { ranks.displayRank = displayRanks[0].rank; ranks.displayName = displayRanks[0].title; }
      break;
    }
  }

  // Classifications (Browse Nodes)
  const cats = {};
  for (const classGroup of classifications) {
    if (classGroup.marketplaceId === mpConfig.marketplaceId) {
      const nodes = classGroup.classifications || [];
      if (nodes[0]) { cats.nodeId = nodes[0].classificationId; cats.nodeName = nodes[0].displayName; }
      cats.path = nodes.map(n => n.displayName).join(' > ');
      break;
    }
  }

  // Relationships
  const rels = {};
  let childAsinsList = [];
  for (const relGroup of relationships) {
    if (relGroup.marketplaceId === mpConfig.marketplaceId) {
      const relList = relGroup.relationships || [];
      const parentRel = relList.find(r => r.type === 'VARIATION' && r.parentAsins);
      if (parentRel && parentRel.parentAsins?.length > 0) {
        rels.parentAsin = parentRel.parentAsins[0];
      }
      const childRels = relList.filter(r => r.type === 'VARIATION' && r.childAsins);
      if (childRels.length > 0) {
        childAsinsList = childRels.flatMap(r => r.childAsins || []);
        rels.childCount = childAsinsList.length;
      }
      const variationRel = relList.find(r => r.variationTheme);
      if (variationRel) {
        rels.variationTheme = variationRel.variationTheme?.attributes?.join(', ') || '';
      }
      break;
    }
  }

  // Bullet points
  const bullets = [];
  for (let b = 0; b < 5; b++) {
    bullets.push(attributes.bullet_point?.[b]?.value || '');
  }
  const bulletsText = bullets.filter(b => b).join('\n');
  const featuresText = bullets.filter(b => b).join(' | ');

  const brandName = summary.brand || getAttr('brand') || '';
  const titleText = summary.itemName || getAttr('item_name') || '';
  const manufacturerName = getAttr('manufacturer') || '';
  const colorValue = getAttr('color') || getAttr('color_name') || '';
  const sizeValue = getAttr('size') || getAttr('size_name') || '';
  const modelValue = getAttr('model_number') || getAttr('model') || '';
  const partNum = getAttr('part_number') || getAttr('manufacturer_part_number') || '';

  return {
    asin: asin,
    title: titleText,
    titleShort: titleText.length > 80 ? titleText.substring(0, 80) + '...' : titleText,
    titleLabel: titleText,
    titleLength: titleText.length,
    titleWords: titleText ? titleText.split(/\s+/).length : 0,
    brand: brandName,
    manufacturer: manufacturerName,
    manufacturerLabel: manufacturerName,
    model: modelValue,
    modelLabel: modelValue,
    productType: response.productTypes?.[0]?.productType || '',

    ean: ids.ean || '',
    upc: ids.upc || '',
    gtin: ids.gtin || '',
    mpn: partNum || modelValue,
    partNumber: partNum,
    colorName: colorValue,
    sizeName: sizeValue,
    sizeLabel: sizeValue,
    material: getAttr('material') || getAttr('material_type') || '',
    unitCount: getAttr('unit_count') || '',

    bulletPoints: bulletsText,
    features: featuresText,
    featuresLabel: featuresText,
    description: getAttr('product_description') || getAttr('item_description') || '',

    mainImageURL: mainImage,
    image1: additionalImages[0]?.link || '',
    image2: additionalImages[1]?.link || '',
    image3: additionalImages[2]?.link || '',
    image4: additionalImages[3]?.link || '',
    image5: additionalImages[4]?.link || '',
    image6: additionalImages[5]?.link || '',
    image7: additionalImages[6]?.link || '',
    image8: additionalImages[7]?.link || '',
    image9: additionalImages[8]?.link || '',
    imagesSources: allImageUrls.join(', '),
    hasImages: imageGroup.length > 0,
    hasPrimaryImage: !!mainImage,
    hasVariantImages: variantImages.length > 0,

    catalogListPrice: catalogListPrice,
    catalogCurrency: catalogCurrency,

    hasDimensions: dimData.hasDimensions || false,
    itemWeight: dimData.itemWeight || '',
    itemWeightUnit: dimData.itemWeightUnit || '',
    itemHeight: dimData.itemHeight || '',
    itemHeightUnit: dimData.itemHeightUnit || '',
    itemWidth: dimData.itemWidth || '',
    itemWidthUnit: dimData.itemWidthUnit || '',
    itemLength: dimData.itemLength || '',
    itemLengthUnit: dimData.itemLengthUnit || '',

    salesRank1: ranks.rank1 || '',
    salesRank1Cat: ranks.rank1Cat || ranks.displayName || '',

    browseNodeId: cats.nodeId || '',
    browseNodeName: cats.nodeName || '',
    categoryPath: cats.path || '',

    parentAsin: rels.parentAsin || '',
    childAsins: childAsinsList.join(', '),
    variationCount: rels.childCount || '',
    variationTheme: rels.variationTheme || ''
  };
}

/**
 * Fetch pricing and seller info
 */
function spFetchPricing(asin, mpConfig, accessToken) {
  const path = `/products/pricing/v0/items/${asin}/offers`;
  const params = { MarketplaceId: mpConfig.marketplaceId, ItemCondition: 'New' };

  const response = spCallAPI('GET', path, params, accessToken);
  const payload = response.payload || response;
  const summary = payload.Summary || payload.summary || {};
  const offers = payload.Offers || payload.offers || [];

  let listPrice = '', currentPrice = '', currency = mpConfig.currency || 'EUR';
  let isPrime = false;

  const lowestPrices = summary.LowestPrices || [];
  if (lowestPrices.length > 0) {
    const fbaPrice = lowestPrices.find(p => p.fulfillmentChannel === 'Amazon');
    const bestPrice = fbaPrice || lowestPrices[0];
    currentPrice = bestPrice.LandedPrice?.Amount || bestPrice.ListingPrice?.Amount || '';
    currency = bestPrice.LandedPrice?.CurrencyCode || bestPrice.ListingPrice?.CurrencyCode || currency;
    listPrice = bestPrice.ListingPrice?.Amount || '';
    if (fbaPrice) isPrime = true;
  }

  if (!currentPrice && summary.BuyBoxPrices && summary.BuyBoxPrices.length > 0) {
    const buyBox = summary.BuyBoxPrices[0];
    currentPrice = buyBox.LandedPrice?.Amount || buyBox.ListingPrice?.Amount || '';
    currency = buyBox.LandedPrice?.CurrencyCode || currency;
  }

  if (offers.length > 0) {
    const offer = offers[0];
    const isFBA = offer.IsFulfilledByAmazon || offer.isFulfilledByAmazon || false;
    if (isFBA) isPrime = true;
  }

  return { listPrice, currentPrice, currency, isPrime };
}

/**
 * Search products by keyword with pagination
 */
function spSearchProducts(searchTerm, mpConfig, accessToken, maxPages) {
  const allItems = [];
  let nextToken = null;
  let pageCount = 0;

  do {
    const params = {
      marketplaceIds: mpConfig.marketplaceId,
      keywords: searchTerm,
      pageSize: 20,
      includedData: 'summaries'
    };
    if (nextToken) params.pageToken = nextToken;

    const response = spCallAPI('GET', '/catalog/2022-04-01/items', params, accessToken);
    const items = response.items || [];
    allItems.push(...items);

    nextToken = response.pagination?.nextToken;
    pageCount++;
    if (nextToken) Utilities.sleep(300);

  } while (nextToken && pageCount < maxPages);

  return allItems.map(item => ({
    asin: item.asin,
    title: item.summaries?.[0]?.itemName || ''
  }));
}

// ==================== PRODUCTS SHEET MANAGEMENT ====================

/**
 * Build header map from Products sheet
 */
function spBuildHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return { headers: [], headerIndex: {} };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerIndex = {};

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c].toString().trim();
    if (h) headerIndex[h] = c;
  }

  return { headers, headerIndex };
}

/**
 * Find ALL column indices for a field using the mapping.
 */
function spFindAllColumns(headerIndex, fieldName) {
  const mapping = spGetColumnMapping();
  const candidates = mapping[fieldName] || [];
  const cols = [];

  for (const colName of candidates) {
    if (headerIndex[colName] !== undefined) {
      cols.push(headerIndex[colName]);
    }
  }

  return cols;
}

/**
 * Get existing ASIN+Marketplace keys from Products tab
 */
function spGetExistingKeys(sheet, headerInfo) {
  const keys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys;

  const hi = headerInfo.headerIndex;
  const asinCol = hi['ASIN'] !== undefined ? hi['ASIN'] : -1;
  const mpCol = hi['Marketplace'] !== undefined ? hi['Marketplace'] : -1;

  if (asinCol === -1) return keys;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (const row of data) {
    const asin = (row[asinCol] || '').toString().trim();
    if (!asin) continue;
    const mp = mpCol >= 0 ? (row[mpCol] || '').toString().trim().toUpperCase() : '';
    keys.add(`${asin}|${mp}`);
  }

  return keys;
}

/**
 * Get next auto-increment ID for Products sheet
 */
function spGetNextId(sheet, headerInfo) {
  const hi = headerInfo.headerIndex;
  const idCol = hi['ID'] !== undefined ? hi['ID'] : -1;

  if (idCol === -1) return 1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  let maxId = 0;

  for (const row of idValues) {
    const val = parseInt(row[0], 10);
    if (!isNaN(val) && val > maxId) maxId = val;
  }

  return maxId + 1;
}

/**
 * Write a single product row to Products sheet, mapping to ALL matching columns.
 */
function spWriteProductRow(sheet, headerInfo, data, marketplace, id) {
  const hi = headerInfo.headerIndex;
  const numCols = headerInfo.headers.length;
  const row = new Array(numCols).fill('');

  const mpConfig = SP_MARKETPLACE_CONFIG[marketplace] || {};
  const amazonLink = `https://${mpConfig.domain || 'www.amazon.de'}/dp/${data.asin}`;
  const now = Utilities.formatDate(new Date(), 'Europe/Berlin', 'M/d/yyyy H:mm');

  // Helper: set value in ALL matching columns
  const set = (fieldName, value) => {
    const cols = spFindAllColumns(hi, fieldName);
    for (const col of cols) {
      if (col >= 0 && col < numCols) {
        row[col] = value !== undefined && value !== null ? value : '';
      }
    }
  };

  // ID column
  if (hi['ID'] !== undefined) {
    row[hi['ID']] = id;
  }

  // Core fields
  set('asin', data.asin);
  set('title', data.title);
  set('titleShort', data.titleShort);
  set('titleLabel', data.titleLabel);
  set('brand', data.brand);
  set('manufacturer', data.manufacturer);
  set('manufacturerLabel', data.manufacturerLabel);
  set('model', data.model);
  set('modelLabel', data.modelLabel);
  set('marketplace', marketplace);
  set('source', 'SP-API');
  set('status', 'Active');
  set('lastUpdated', now);
  set('addedDate', now);

  // Price
  const priceValue = data.price || data.catalogListPrice || '';
  const currencyValue = data.currency || data.catalogCurrency || mpConfig.currency || 'EUR';
  set('price', priceValue);
  set('listPrice', priceValue);
  set('priceCurrency', currencyValue);
  if (priceValue && currencyValue) {
    const currencySymbol = currencyValue === 'EUR' ? '\u20AC' : currencyValue === 'GBP' ? '\u00A3' : currencyValue;
    set('priceFormatted', `${priceValue} ${currencySymbol}`);
    set('priceText', `${priceValue} ${currencySymbol}`);
  }

  // Savings
  set('savingsAmount', data.savingsAmount || '');
  set('savingsPercent', data.savingsPercent || '');

  // Category
  set('category', data.salesRank1Cat || data.categoryPath || '');
  set('salesRank1', data.salesRank1);
  set('salesRank1Cat', data.salesRank1Cat);

  // Browse Node
  set('browseNodeName', data.browseNodeName);
  set('browseNodeId', data.browseNodeId);

  // Links
  set('link', amazonLink);

  // Images
  set('mainImageURL', data.mainImageURL);
  set('image1', data.image1);
  set('image2', data.image2);
  set('image3', data.image3);
  set('image4', data.image4);
  set('image5', data.image5);
  set('image6', data.image6);
  set('image7', data.image7);
  set('image8', data.image8);
  set('image9', data.image9);
  set('imagesSources', data.imagesSources);
  set('hasImages', data.hasImages);
  set('hasPrimaryImage', data.hasPrimaryImage);
  set('hasVariantImages', data.hasVariantImages);

  // Content
  set('bulletPoints', data.bulletPoints);
  set('features', data.features);
  set('featuresLabel', data.featuresLabel);
  set('description', data.description);

  // Identifiers
  set('ean', data.ean);
  set('upc', data.upc);
  set('gtin', data.gtin);
  set('mpn', data.mpn);
  set('partNumber', data.partNumber);
  set('colorName', data.colorName);
  set('sizeName', data.sizeName);
  set('sizeLabel', data.sizeLabel);
  set('material', data.material);
  set('unitCount', data.unitCount);

  // Dimensions
  set('hasDimensions', data.hasDimensions);
  set('itemWeight', data.itemWeight);
  set('itemWeightUnit', data.itemWeightUnit);
  set('itemHeight', data.itemHeight);
  set('itemHeightUnit', data.itemHeightUnit);
  set('itemWidth', data.itemWidth);
  set('itemWidthUnit', data.itemWidthUnit);
  set('itemLength', data.itemLength);
  set('itemLengthUnit', data.itemLengthUnit);

  // Relationships / Variant flags
  const parentAsin = data.parentAsin || '';
  set('parentAsin', parentAsin);
  set('isVariant', data.isVariant ? 'TRUE' : 'FALSE');
  set('hasParent', parentAsin ? 'TRUE' : 'FALSE');
  set('variationCount', data.variationCount);
  set('variationTheme', data.variationTheme);

  // Product attributes
  set('productType', data.productType);
  set('titleLength', data.titleLength);
  set('titleWords', data.titleWords);

  // Prime / Availability
  set('isPrime', data.isPrime ? 'TRUE' : 'FALSE');
  set('availability', data.availability || '');
  set('availabilityMsg', data.availabilityMsg || '');

  sheet.appendRow(row);
}
