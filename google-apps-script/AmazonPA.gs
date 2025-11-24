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
    const payloadString = JSON.stringify(payload);

    // Przygotuj nagłówki (NIE dodawaj Host - UrlFetchApp dodaje automatycznie)
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Date': timestamp,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    };

    // Utwórz podpis AWS4
    const authHeader = createAWS4Signature(
      credentials.accessKey,
      credentials.secretKey,
      AMAZON_PA_CONFIG.region,
      AMAZON_PA_CONFIG.service,
      path,
      payloadString,
      timestamp,
      AMAZON_PA_CONFIG.endpoint
    );

    headers['Authorization'] = authHeader;

    // Wykonaj request
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: payloadString,
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

function createAWS4Signature(accessKey, secretKey, region, service, path, payloadString, timestamp, host) {
  // Full AWS Signature Version 4 implementation
  // https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

  const method = 'POST';
  const contentType = 'application/json; charset=utf-8';

  // Extract date from timestamp (YYYYMMDD)
  const dateStamp = timestamp.substring(0, 4) + timestamp.substring(5, 7) + timestamp.substring(8, 10);

  // Step 1: Create canonical request
  const canonicalUri = path;
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-date:${timestamp}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  // Hash the payload
  const payloadHash = sha256Hex(payloadString);

  const canonicalRequest =
    `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  // Step 2: Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = sha256Hex(canonicalRequest);

  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;

  // Step 3: Calculate signing key
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  // Step 4: Calculate signature
  const signature = hmacSha256Hex(kSigning, stringToSign);

  // Step 5: Build authorization header
  const authHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return authHeader;
}

// Helper function: SHA256 hash (returns hex string)
function sha256Hex(message) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
  return hash.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

// Helper function: HMAC-SHA256 (returns byte array)
function hmacSha256(key, message) {
  const keyBytes = typeof key === 'string' ? Utilities.newBlob(key).getBytes() : key;
  return Utilities.computeHmacSha256Signature(message, keyBytes);
}

// Helper function: HMAC-SHA256 (returns hex string)
function hmacSha256Hex(key, message) {
  const hmac = hmacSha256(key, message);
  return hmac.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

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
