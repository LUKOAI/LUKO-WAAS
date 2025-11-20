/**
 * WAAS Amazon Product Advertising API Module
 * Integracja z Amazon PA API 5.0
 */

// =============================================================================
// AMAZON PA API CONFIGURATION
// =============================================================================

const AMAZON_PA_CONFIG = {
  region: 'us-east-1',
  service: 'ProductAdvertisingAPI',
  endpoint: 'webservices.amazon.com',
  marketplace: 'www.amazon.com',
  partnerType: 'Associates'
};

// =============================================================================
// SEARCH PRODUCTS
// =============================================================================

function searchAmazonProducts(keywords, category = '', itemCount = 10) {
  try {
    const credentials = getAmazonPACredentials();

    logInfo('AmazonPA', `Searching products: ${keywords}`);

    // Przygotuj request
    const requestPayload = {
      Keywords: keywords,
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ],
      ItemCount: Math.min(itemCount, 10),
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    if (category) {
      requestPayload.SearchIndex = category;
    }

    // Wykonaj request
    const response = makeAmazonPARequest('/paapi5/searchitems', requestPayload, credentials);

    if (response && response.SearchResult && response.SearchResult.Items) {
      const products = response.SearchResult.Items.map(item => parseAmazonProduct(item, credentials.partnerTag));
      logSuccess('AmazonPA', `Found ${products.length} products`);
      return products;
    }

    logWarning('AmazonPA', 'No products found');
    return [];
  } catch (error) {
    logError('AmazonPA', `Error searching products: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// GET PRODUCT DATA
// =============================================================================

function getAmazonProductData(asin) {
  try {
    const credentials = getAmazonPACredentials();

    logInfo('AmazonPA', `Getting product data: ${asin}`);

    const requestPayload = {
      ItemIds: [asin],
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Message',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getitems', requestPayload, credentials);

    if (response && response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
      const product = parseAmazonProduct(response.ItemsResult.Items[0], credentials.partnerTag);
      logSuccess('AmazonPA', `Product data retrieved: ${asin}`);
      return product;
    }

    logWarning('AmazonPA', `Product not found: ${asin}`);
    return null;
  } catch (error) {
    logError('AmazonPA', `Error getting product data: ${error.message}`);
    return null;
  }
}

// =============================================================================
// AMAZON PA API REQUEST
// =============================================================================

function makeAmazonPARequest(path, payload, credentials) {
  try {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const url = `https://${AMAZON_PA_CONFIG.endpoint}${path}`;

    // Przygotuj nagłówki
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Date': timestamp,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      'Host': AMAZON_PA_CONFIG.endpoint
    };

    // Utwórz podpis AWS4
    const signature = createAWS4Signature(
      credentials.accessKey,
      credentials.secretKey,
      AMAZON_PA_CONFIG.region,
      AMAZON_PA_CONFIG.service,
      path,
      payload,
      timestamp
    );

    headers['Authorization'] = signature;

    // Wykonaj request
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode === 200) {
      return JSON.parse(responseText);
    } else {
      logError('AmazonPA', `API Error ${statusCode}: ${responseText}`);
      return null;
    }
  } catch (error) {
    logError('AmazonPA', `Request error: ${error.message}`);
    return null;
  }
}

// =============================================================================
// AWS4 SIGNATURE
// =============================================================================

function createAWS4Signature(accessKey, secretKey, region, service, path, payload, timestamp) {
  // Simplified AWS4 signature
  // W pełnej implementacji należy użyć kompletnego algorytmu AWS Signature Version 4

  const dateStamp = timestamp.substring(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=content-type;host;x-amz-date, Signature=dummy_signature`;

  logWarning('AmazonPA', 'Using simplified AWS4 signature - implement full version for production');

  return authHeader;
}

// Note: Pełna implementacja AWS4 Signature wymaga:
// 1. Canonical Request
// 2. String to Sign
// 3. Signing Key
// 4. Signature
// Zobacz: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

// =============================================================================
// PARSE AMAZON PRODUCT
// =============================================================================

function parseAmazonProduct(item, partnerTag) {
  try {
    const asin = item.ASIN;

    // Tytuł
    const title = item.ItemInfo && item.ItemInfo.Title && item.ItemInfo.Title.DisplayValue
      ? item.ItemInfo.Title.DisplayValue
      : 'Unknown Product';

    // Cena
    let price = '';
    if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
      const listing = item.Offers.Listings[0];
      if (listing.Price && listing.Price.DisplayAmount) {
        price = listing.Price.DisplayAmount;
      }
    }

    // Obrazek
    let imageUrl = '';
    if (item.Images && item.Images.Primary && item.Images.Primary.Large) {
      imageUrl = item.Images.Primary.Large.URL;
    }

    // Ocena
    let rating = '';
    let reviewsCount = '';
    if (item.CustomerReviews) {
      if (item.CustomerReviews.StarRating && item.CustomerReviews.StarRating.Value) {
        rating = item.CustomerReviews.StarRating.Value;
      }
      if (item.CustomerReviews.Count) {
        reviewsCount = item.CustomerReviews.Count;
      }
    }

    // Kategoria
    let category = '';
    if (item.ItemInfo && item.ItemInfo.Classifications && item.ItemInfo.Classifications.Binding) {
      category = item.ItemInfo.Classifications.Binding.DisplayValue;
    }

    // Link afiliacyjny
    const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;

    // Dostępność
    let available = true;
    if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
      const availability = item.Offers.Listings[0].Availability;
      if (availability && availability.Message) {
        available = !availability.Message.includes('Currently unavailable');
      }
    }

    return {
      asin: asin,
      name: title,
      category: category,
      price: price,
      imageUrl: imageUrl,
      affiliateLink: affiliateLink,
      rating: rating,
      reviewsCount: reviewsCount,
      available: available,
      notes: ''
    };
  } catch (error) {
    logError('AmazonPA', `Error parsing product: ${error.message}`);
    return null;
  }
}

// =============================================================================
// PRODUCT VARIATIONS
// =============================================================================

function getProductVariations(parentAsin) {
  try {
    const credentials = getAmazonPACredentials();

    const requestPayload = {
      ItemIds: [parentAsin],
      Resources: [
        'VariationSummary.VariationDimension'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getitems', requestPayload, credentials);

    if (response && response.ItemsResult && response.ItemsResult.Items) {
      // Parse variations
      return response.ItemsResult.Items;
    }

    return [];
  } catch (error) {
    logError('AmazonPA', `Error getting variations: ${error.message}`);
    return [];
  }
}

// =============================================================================
// BROWSE NODES (Categories)
// =============================================================================

function getBrowseNodes(browseNodeId) {
  try {
    const credentials = getAmazonPACredentials();

    const requestPayload = {
      BrowseNodeIds: [browseNodeId],
      Resources: [
        'BrowseNodes.Ancestor',
        'BrowseNodes.Children'
      ],
      PartnerTag: credentials.partnerTag,
      PartnerType: AMAZON_PA_CONFIG.partnerType,
      Marketplace: AMAZON_PA_CONFIG.marketplace
    };

    const response = makeAmazonPARequest('/paapi5/getbrowsenodes', requestPayload, credentials);

    if (response && response.BrowseNodesResult) {
      return response.BrowseNodesResult.BrowseNodes;
    }

    return [];
  } catch (error) {
    logError('AmazonPA', `Error getting browse nodes: ${error.message}`);
    return [];
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function buildAmazonAffiliateLink(asin, partnerTag = null) {
  if (!partnerTag) {
    const credentials = getAmazonPACredentials();
    partnerTag = credentials.partnerTag;
  }

  return `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;
}

function extractAsinFromUrl(url) {
  // Wyciągnij ASIN z URL Amazon
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
