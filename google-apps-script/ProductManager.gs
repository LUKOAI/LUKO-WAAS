/**
 * WAAS Product Manager Module
 * Zarządzanie produktami afiliacyjnymi z Amazon
 */

// =============================================================================
// OPERACJE NA PRODUKTACH
// =============================================================================

function getProductById(productId) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productId) {
      return {
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        category: data[i][3],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6],
        rating: data[i][7],
        reviewsCount: data[i][8],
        status: data[i][9],
        lastUpdated: data[i][10],
        addedDate: data[i][11],
        notes: data[i][12],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function getProductByAsin(asin) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === asin) {
      return {
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        rowIndex: i + 1
      };
    }
  }

  return null;
}

function addProduct(productData) {
  // Sprawdź czy produkt już istnieje
  const existing = getProductByAsin(productData.asin);
  if (existing) {
    logWarning('ProductManager', `Product already exists: ${productData.asin}`);
    return existing.id;
  }

  const sheet = getProductsSheet();
  const id = getNextId('Products');

  sheet.appendRow([
    id,
    productData.asin,
    productData.name,
    productData.category || '',
    productData.price || '',
    productData.imageUrl || '',
    productData.affiliateLink || '',
    productData.rating || '',
    productData.reviewsCount || '',
    'Active',
    new Date(),
    new Date(),
    productData.notes || ''
  ]);

  logSuccess('ProductManager', `Product added: ${productData.name} (${productData.asin})`);
  return id;
}

function updateProduct(productId, updates) {
  const product = getProductById(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const sheet = getProductsSheet();
  const row = product.rowIndex;

  // Aktualizuj tylko zmienione pola
  if (updates.price !== undefined) {
    sheet.getRange(row, 5).setValue(updates.price);
  }
  if (updates.rating !== undefined) {
    sheet.getRange(row, 8).setValue(updates.rating);
  }
  if (updates.reviewsCount !== undefined) {
    sheet.getRange(row, 9).setValue(updates.reviewsCount);
  }
  if (updates.status !== undefined) {
    sheet.getRange(row, 10).setValue(updates.status);
  }

  // Zawsze aktualizuj lastUpdated
  sheet.getRange(row, 11).setValue(new Date());

  logInfo('ProductManager', `Product updated: ${product.asin}`, '', '', updates);
}

// =============================================================================
// IMPORT Z AMAZON
// =============================================================================

function importProductsFromAmazon(data) {
  try {
    logInfo('ProductManager', `Importing products: ${data.keywords}`);

    const products = searchAmazonProducts(data.keywords, data.category, data.count);

    if (!products || products.length === 0) {
      throw new Error('No products found');
    }

    let imported = 0;
    products.forEach(product => {
      try {
        addProduct(product);
        imported++;
      } catch (error) {
        logWarning('ProductManager', `Failed to add product ${product.asin}: ${error.message}`);
      }
    });

    logSuccess('ProductManager', `Imported ${imported} products`);

    SpreadsheetApp.getUi().alert(
      'Import Complete',
      `Successfully imported ${imported} products from Amazon`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return imported;
  } catch (error) {
    handleError(error, 'ProductManager.importProductsFromAmazon');
    return 0;
  }
}

// =============================================================================
// AKTUALIZACJA DANYCH PRODUKTÓW
// =============================================================================

function updateProductData() {
  try {
    const sheet = getProductsSheet();
    const data = sheet.getDataRange().getValues();

    let updated = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      const productId = data[i][0];
      const asin = data[i][1];

      try {
        // Pobierz aktualne dane z Amazon
        const productData = getAmazonProductData(asin);

        if (productData) {
          updateProduct(productId, {
            price: productData.price,
            rating: productData.rating,
            reviewsCount: productData.reviewsCount,
            status: productData.available ? 'Active' : 'Out of Stock'
          });
          updated++;
        }
      } catch (error) {
        logError('ProductManager', `Error updating product ${asin}: ${error.message}`);
        errors++;
      }

      // Rate limiting
      Utilities.sleep(1000);
    }

    logSuccess('ProductManager', `Updated ${updated} products (${errors} errors)`);

    SpreadsheetApp.getUi().alert(
      'Update Complete',
      `Updated ${updated} products\nErrors: ${errors}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return updated;
  } catch (error) {
    handleError(error, 'ProductManager.updateProductData');
    return 0;
  }
}

function syncAllProducts() {
  // Alias for updateProductData
  return updateProductData();
}

// =============================================================================
// HELPERS
// =============================================================================

function getActiveProducts(limit = 50) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const products = [];
  for (let i = 1; i < data.length && products.length < limit; i++) {
    if (data[i][9] === 'Active') {
      products.push({
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        category: data[i][3],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6],
        rating: data[i][7]
      });
    }
  }

  return products;
}

function getProductsByCategory(category) {
  const sheet = getProductsSheet();
  const data = sheet.getDataRange().getValues();

  const products = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === category && data[i][9] === 'Active') {
      products.push({
        id: data[i][0],
        asin: data[i][1],
        name: data[i][2],
        price: data[i][4],
        imageUrl: data[i][5],
        affiliateLink: data[i][6]
      });
    }
  }

  return products;
}

function getProductsByIds(productIds) {
  const products = [];

  productIds.forEach(id => {
    const product = getProductById(id);
    if (product) {
      products.push(product);
    }
  });

  return products;
}
