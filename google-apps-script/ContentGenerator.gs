/**
 * WAAS Content Generator Module
 * Generowanie treści afiliacyjnych
 */

const ContentType = {
  REVIEW: 'review',
  COMPARISON: 'comparison',
  GUIDE: 'guide',
  LISTICLE: 'listicle'
};

// =============================================================================
// GENEROWANIE TREŚCI
// =============================================================================

function generateContent(data) {
  try {
    logInfo('ContentGenerator', `Generating ${data.contentType} content`, data.siteId);

    // Parse product IDs
    const productIds = data.productIds.split(',').map(id => parseInt(id.trim()));

    // Pobierz produkty
    const products = getProductsByIds(productIds);
    if (products.length === 0) {
      throw new Error('No products found for content generation');
    }

    // Wygeneruj treść
    let content;
    switch (data.contentType) {
      case ContentType.REVIEW:
        content = generateProductReview(products[0], data.title);
        break;
      case ContentType.COMPARISON:
        content = generateProductComparison(products, data.title);
        break;
      case ContentType.GUIDE:
        content = generateBuyingGuide(products, data.title);
        break;
      case ContentType.LISTICLE:
        content = generateTopListArticle(products, data.title);
        break;
      default:
        throw new Error(`Unknown content type: ${data.contentType}`);
    }

    // Dodaj do kolejki treści
    const contentId = addToContentQueue(data.siteId, content, productIds.join(','));

    logSuccess('ContentGenerator', `Content generated (ID: ${contentId})`, data.siteId);

    SpreadsheetApp.getUi().alert(
      'Content Generated',
      `Content has been added to the queue (ID: ${contentId})`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return contentId;
  } catch (error) {
    handleError(error, 'ContentGenerator.generateContent', data.siteId);
    return null;
  }
}

function generateContentForSite(siteId, data) {
  data.siteId = siteId;
  return generateContent(data);
}

// =============================================================================
// SZABLONY TREŚCI
// =============================================================================

function generateProductReview(product, customTitle = '') {
  const title = customTitle || `${product.name} Review - Is It Worth Buying?`;

  const content = `
<h2>Introduction</h2>
<p>In this comprehensive review, we'll take an in-depth look at the ${product.name}. We'll cover its features, pros and cons, and help you decide if this is the right product for your needs.</p>

<div class="product-box">
  <img src="${product.imageUrl}" alt="${product.name}" />
  <h3>${product.name}</h3>
  <p class="price">${product.price}</p>
  <p class="rating">Rating: ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check Current Price on Amazon</a>
</div>

<h2>Key Features</h2>
<p>The ${product.name} comes with several impressive features that make it stand out in its category:</p>
<ul>
  <li>High-quality construction and materials</li>
  <li>User-friendly design</li>
  <li>Excellent performance</li>
  <li>Great value for money</li>
</ul>

<h2>Pros and Cons</h2>
<h3>Pros:</h3>
<ul>
  <li>Excellent build quality</li>
  <li>Good performance</li>
  <li>Competitive pricing</li>
  <li>Positive customer reviews</li>
</ul>

<h3>Cons:</h3>
<ul>
  <li>May not be suitable for all users</li>
  <li>Some features could be improved</li>
</ul>

<h2>Who Is This Product For?</h2>
<p>The ${product.name} is perfect for anyone looking for a reliable and high-quality product in the ${product.category} category. Whether you're a beginner or an experienced user, this product offers great value.</p>

<h2>Final Verdict</h2>
<p>Overall, the ${product.name} is an excellent choice. With its combination of quality, performance, and price, it's definitely worth considering. The ${product.rating}/5 rating from ${product.reviewsCount} customers speaks for itself.</p>

<a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Buy Now on Amazon</a>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.REVIEW
  };
}

function generateProductComparison(products, customTitle = '') {
  const productNames = products.slice(0, 2).map(p => p.name.substring(0, 30)).join(' vs ');
  const title = customTitle || `${productNames} - Which One Should You Buy?`;

  let comparisonTable = '<table class="comparison-table"><thead><tr><th>Feature</th>';
  products.forEach(product => {
    comparisonTable += `<th>${product.name}</th>`;
  });
  comparisonTable += '</tr></thead><tbody>';

  // Add comparison rows
  comparisonTable += '<tr><td>Price</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.price}</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Rating</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.rating}/5</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Reviews</td>';
  products.forEach(product => {
    comparisonTable += `<td>${product.reviewsCount}</td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '<tr><td>Link</td>';
  products.forEach(product => {
    comparisonTable += `<td><a href="${product.affiliateLink}" target="_blank" rel="nofollow">View on Amazon</a></td>`;
  });
  comparisonTable += '</tr>';

  comparisonTable += '</tbody></table>';

  const content = `
<h2>Introduction</h2>
<p>Trying to choose between ${productNames}? In this detailed comparison, we'll help you make an informed decision by comparing features, prices, and customer reviews.</p>

${comparisonTable}

<h2>Detailed Comparison</h2>
${products.map((product, index) => `
  <h3>${index + 1}. ${product.name}</h3>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 300px;" />
  <p>Price: ${product.price}</p>
  <p>Rating: ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check on Amazon</a>
`).join('\n')}

<h2>Which One Should You Choose?</h2>
<p>Both products have their strengths. Your choice depends on your specific needs, budget, and preferences. Consider the comparison table above and read customer reviews to make the best decision.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.COMPARISON
  };
}

function generateBuyingGuide(products, customTitle = '') {
  const category = products[0].category || 'Product';
  const title = customTitle || `The Ultimate ${category} Buying Guide - Top Picks for 2024`;

  const content = `
<h2>Introduction</h2>
<p>Looking for the best ${category.toLowerCase()} products? This comprehensive buying guide will help you choose the perfect option for your needs. We've researched and compared top products to bring you this curated list.</p>

<h2>What to Look for When Buying ${category} Products</h2>
<ul>
  <li>Quality and durability</li>
  <li>Features and functionality</li>
  <li>Price and value for money</li>
  <li>Customer reviews and ratings</li>
  <li>Brand reputation</li>
</ul>

<h2>Our Top Recommendations</h2>
${products.map((product, index) => `
  <h3>${index + 1}. ${product.name}</h3>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 400px;" />
  <p><strong>Price:</strong> ${product.price}</p>
  <p><strong>Rating:</strong> ${product.rating}/5 (${product.reviewsCount} reviews)</p>
  <p>This is an excellent choice for anyone looking for quality and reliability in the ${category.toLowerCase()} category.</p>
  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">Check Price on Amazon</a>
`).join('\n')}

<h2>Conclusion</h2>
<p>We hope this buying guide has helped you find the perfect ${category.toLowerCase()} product. All of our recommendations are highly rated by customers and offer great value for money.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.GUIDE
  };
}

function generateTopListArticle(products, customTitle = '') {
  const category = products[0].category || 'Product';
  const title = customTitle || `Top ${products.length} Best ${category} Products in 2024`;

  const content = `
<h2>Introduction</h2>
<p>We've compiled a list of the top ${products.length} ${category.toLowerCase()} products available right now. Each product on this list has been carefully selected based on customer reviews, features, and overall value.</p>

${products.map((product, index) => `
  <h2>${index + 1}. ${product.name}</h2>
  <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 500px;" />

  <p><strong>Price:</strong> ${product.price}</p>
  <p><strong>Customer Rating:</strong> ${product.rating}/5 stars (${product.reviewsCount} reviews)</p>

  <h3>Why We Love It:</h3>
  <ul>
    <li>Exceptional quality and performance</li>
    <li>Highly rated by customers</li>
    <li>Great value for money</li>
    <li>Reliable and durable</li>
  </ul>

  <a href="${product.affiliateLink}" class="button" target="_blank" rel="nofollow">View on Amazon</a>
`).join('\n')}

<h2>How We Chose These Products</h2>
<p>Our selection process involved analyzing thousands of customer reviews, comparing features and prices, and testing products when possible. We only recommend products that meet our high standards for quality and value.</p>

<h2>Final Thoughts</h2>
<p>All of the products on this list are excellent choices in the ${category.toLowerCase()} category. Consider your specific needs and budget when making your decision.</p>

<p><small>Note: This post contains affiliate links. If you make a purchase through these links, we may earn a commission at no additional cost to you.</small></p>
`;

  return {
    title: title,
    content: content,
    contentType: ContentType.LISTICLE
  };
}

// =============================================================================
// ZARZĄDZANIE KOLEJKĄ TREŚCI
// =============================================================================

function addToContentQueue(siteId, content, productIds) {
  const sheet = getContentQueueSheet();
  const id = getNextId('Content Queue');

  const autoPublish = getSetting('auto_publish', 'false') === 'true';
  const status = autoPublish ? 'Scheduled' : 'Draft';

  sheet.appendRow([
    id,
    siteId,
    content.contentType,
    content.title,
    status,
    productIds,
    '',
    autoPublish ? new Date() : '',
    '',
    '',
    '',
    new Date(),
    content.content // Pełna treść w notatkach
  ]);

  logInfo('ContentGenerator', `Content added to queue (ID: ${id})`, siteId);
  return id;
}

function publishScheduledContent() {
  try {
    const sheet = getContentQueueSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    let published = 0;
    let failed = 0;

    for (let i = 1; i < data.length; i++) {
      const status = data[i][4];
      const scheduledDate = new Date(data[i][7]);
      const contentId = data[i][0];
      const siteId = data[i][1];

      if (status === 'Scheduled' && scheduledDate <= now) {
        try {
          const content = {
            title: data[i][3],
            content: data[i][12]
          };

          const postId = publishContentToWordPress(siteId, content);

          if (postId) {
            // Aktualizuj status
            sheet.getRange(i + 1, 5).setValue('Published');
            sheet.getRange(i + 1, 9).setValue(new Date());
            sheet.getRange(i + 1, 10).setValue(postId);
            published++;

            logSuccess('ContentGenerator', `Content published (ID: ${contentId})`, siteId);
          }
        } catch (error) {
          logError('ContentGenerator', `Failed to publish content ${contentId}: ${error.message}`, siteId, '', error);
          sheet.getRange(i + 1, 5).setValue('Failed');
          failed++;
        }
      }
    }

    logInfo('ContentGenerator', `Published ${published} content items (${failed} failed)`);

    if (published > 0 || failed > 0) {
      SpreadsheetApp.getUi().alert(
        'Content Publishing Complete',
        `Published: ${published}\nFailed: ${failed}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert(
        'No Content to Publish',
        'No scheduled content is ready for publishing',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    return published;
  } catch (error) {
    handleError(error, 'ContentGenerator.publishScheduledContent');
    return 0;
  }
}

function publishContentToWordPress(siteId, content) {
  const site = getSiteById(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  // Użyj WordPress API do opublikowania
  const postData = {
    title: content.title,
    content: content.content,
    status: getSetting('default_post_status', 'draft')
  };

  const postId = createWordPressPost(site, postData);
  return postId;
}
