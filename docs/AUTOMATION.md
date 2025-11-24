# WAAS 2.0 - Complete Automation Guide

## 🤖 Overview

WAAS 2.0 includes a comprehensive automation system that allows you to manage multiple WordPress affiliate sites with minimal manual intervention. This guide covers all automation features and how to use them.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Auto Install Checkbox](#auto-install-checkbox)
3. [Deploy Content Checkbox](#deploy-content-checkbox)
4. [Install Full Stack (All-in-One)](#install-full-stack)
5. [Deploy Selected Content (All-in-One)](#deploy-selected-content)
6. [Automated Triggers](#automated-triggers)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### What's New in WAAS 2.0?

**NEW COLUMNS:**
- **Sites Sheet → Column 13**: `Auto Install` checkbox
- **Content Queue Sheet → Column 7**: `Deploy Content` checkbox

**NEW MENU: 🤖 Automation**
- Install Full Stack
- Deploy Selected Content
- Process Auto Install Sites
- Process Content Deployment
- Setup/Remove Automated Triggers
- Manual sync triggers

---

## ✅ Auto Install Checkbox

### Location
**Sites Sheet → Column 13: "Auto Install"**

### What It Does
Automatically installs the complete WordPress stack on your site:
1. ✅ Verifies WordPress accessibility
2. 🎨 Installs Divi theme
3. 🛒 Installs WooCommerce
4. 🔌 Installs WAAS Product Manager plugin

### How to Use

#### Method 1: Checkbox (Automated)
1. Open the **Sites** sheet
2. Find your site row
3. Check the **Auto Install** checkbox (column 13)
4. Wait for the next hourly automation check
5. The checkbox will automatically uncheck when installation is complete

#### Method 2: Menu (Manual)
1. Click **⚡ WAAS** → **🤖 Automation** → **🚀 Install Full Stack**
2. Select your site from the dropdown
3. (Optional) Enter initial Amazon ASINs to import
4. (Optional) Check "Generate initial content"
5. Click **🚀 Install Full Stack**

### What Gets Installed

| Step | Component | Description |
|------|-----------|-------------|
| 1 | WordPress Check | Verifies site is accessible |
| 2 | Divi Theme | Installs and activates Elegant Themes Divi |
| 3 | WooCommerce | Installs and activates WooCommerce plugin |
| 4 | WAAS Plugin | Installs WAAS Product Manager plugin |
| 5 | Products (Optional) | Imports initial Amazon products |
| 6 | Content (Optional) | Generates first product review |

### Site Status Updates

After successful installation, the Sites sheet automatically updates:
- **Status** → "Active"
- **Divi Installed** → "Yes"
- **Plugin Installed** → "Yes"
- **Last Check** → Current timestamp
- **Auto Install** → Unchecked (automatic)

### Prerequisites

Before using Auto Install, ensure your site has:
- ✅ Valid WordPress admin credentials (columns 5-6)
- ✅ **DIVI_DOWNLOAD_URL** configured in Script Properties (see [Divi Configuration](#divi-theme-configuration))
- ✅ Per-site Amazon Partner Tag (column 9) OR global fallback
- ✅ WordPress REST API enabled
- ✅ Admin user with installation permissions

### Divi Theme Configuration

**IMPORTANT**: Elegant Themes does not provide a public API for downloading Divi. To enable automated Divi installation, you need to host the Divi ZIP file yourself.

#### Setup Steps:

1. **Download Divi**
   - Log into your Elegant Themes account at elegantthemes.com
   - Download the latest Divi theme ZIP file

2. **Upload to Your Storage**
   Choose one of these options:
   - **AWS S3**: Upload to a private bucket and create a presigned URL
   - **Google Cloud Storage**: Upload and make the file accessible via a signed URL
   - **Dropbox**: Upload and generate a direct download link
   - **Your own server**: Host on any web server with HTTPS

3. **Configure Script Property**
   - Open your Google Apps Script project
   - Go to **Project Settings** → **Script Properties**
   - Add a new property:
     - **Property**: `DIVI_DOWNLOAD_URL`
     - **Value**: Your Divi ZIP download URL (must be direct download link)
   - Click **Save**

4. **Verify Configuration**
   - Run **⚡ WAAS** → **🔧 Settings** → **🧪 Test Connections**
   - Check that Divi download URL is accessible

**Example URLs:**
```
AWS S3:
https://your-bucket.s3.amazonaws.com/divi.zip?AWSAccessKeyId=...

Google Cloud:
https://storage.googleapis.com/your-bucket/divi.zip?GoogleAccessId=...

Dropbox:
https://www.dropbox.com/s/xxxxx/Divi.zip?dl=1

Your Server:
https://yourserver.com/files/divi.zip
```

**Security Tips:**
- Use presigned/time-limited URLs when possible
- Ensure the URL is only accessible to your automation
- Rotate URLs periodically
- Consider using Cloud Storage with access controls

---

## 📤 Deploy Content Checkbox

### Location
**Content Queue Sheet → Column 7: "Deploy Content"**

### What It Does
Automatically creates and publishes affiliate content:
1. 📦 Imports products from Amazon (by ASIN)
2. ✍️ Generates content using Claude AI
3. 🌐 Publishes to your WordPress site

### How to Use

#### Method 1: Checkbox (Automated)
1. Open the **Content Queue** sheet
2. Create a new row with:
   - **Site ID** (column 2): Your target site
   - **Content Type** (column 3): `product_review`, `comparison`, `buying_guide`, or `top_list`
   - **Title** (column 4): Article title (or leave empty for auto-generation)
   - **Product IDs** (column 6): Comma-separated Amazon ASINs (e.g., `B08N5WRWNW, B07XJ8C8F7`)
   - **Deploy Content** (column 7): ✅ Check this box
3. Wait for the next hourly automation check
4. The checkbox will automatically uncheck when deployment is complete

#### Method 2: Menu (Manual)
1. Click **⚡ WAAS** → **🤖 Automation** → **📤 Deploy Selected Content**
2. Select your site
3. Choose content type
4. Enter Amazon ASINs (comma-separated)
5. (Optional) Enter custom title
6. Choose publish status (publish or draft)
7. Click **📤 Deploy Content**

### Content Types

| Type | Description | Products Required | Example |
|------|-------------|-------------------|---------|
| **product_review** | Detailed single product review | 1 | "Samsung Galaxy S23 Ultra Review" |
| **comparison** | Side-by-side product comparison | 2-5 | "iPhone 15 vs Galaxy S23 Comparison" |
| **buying_guide** | Comprehensive category guide | 3-10 | "Best Smartphones Under $500 (2024)" |
| **top_list** | Ranked product listicle | 5-10 | "Top 10 Wireless Headphones in 2024" |

### Deployment Process

```
Step 1: Import Products
├── Check if products exist in Products sheet
├── If not, fetch from Amazon Product Advertising API
├── Parse product data (title, price, images, ratings)
└── Add to Products sheet (prevents duplicates)

Step 2: Generate Content
├── Retrieve product data from Products sheet
├── Call Claude AI content generation
├── Format content with affiliate links
├── Add to Content Queue with metadata
└── Save content body

Step 3: Publish to WordPress
├── Create WordPress post via REST API
├── Set post status (publish/draft)
├── Set featured image (product image)
├── Add categories and tags
├── Update Content Queue with:
   ├── Status → "Published"
   ├── Post ID
   ├── Post URL
   └── Published Date
```

### Content Queue Status Values

| Status | Meaning |
|--------|---------|
| `Pending` | Ready for deployment (checkbox can be checked) |
| `Draft` | Content generated but not published |
| `Published` | Successfully published to WordPress |
| `Failed` | Deployment failed (check Logs sheet for details) |

---

## 🚀 Install Full Stack

### Overview
One-click installation of the complete WordPress affiliate stack. This is the **recommended method** for setting up new sites.

### Access
**⚡ WAAS** → **🤖 Automation** → **🚀 Install Full Stack**

### Dialog Options

| Field | Required | Description |
|-------|----------|-------------|
| **Select Site** | ✅ Yes | Choose target WordPress site |
| **Initial ASINs** | ⭕ Optional | Comma-separated ASINs to import (e.g., `B08N5WRWNW, B07XJ8C8F7`) |
| **Generate Content** | ⭕ Optional | Create a review for the first product |

### Example Usage

**Scenario 1: Basic Installation (No Products)**
```
Site: MyAffiliateSite.com (ID: 1)
Initial ASINs: [empty]
Generate Content: ☐ Unchecked

Result:
✅ Divi theme installed
✅ WooCommerce installed
✅ WAAS plugin installed
```

**Scenario 2: Full Setup with Initial Products**
```
Site: MyAffiliateSite.com (ID: 1)
Initial ASINs: B08N5WRWNW, B07XJ8C8F7, B09JQL6T5Q
Generate Content: ☑ Checked

Result:
✅ Divi theme installed
✅ WooCommerce installed
✅ WAAS plugin installed
✅ 3 products imported
✅ 1 product review generated (first product)
```

### Execution Time

| Configuration | Estimated Time |
|--------------|----------------|
| Basic (no products) | 30-60 seconds |
| With 5 products | 2-3 minutes |
| With 10 products + content | 5-8 minutes |

**Note**: Times vary based on WordPress server speed and Amazon API response times.

### Error Handling

If any step fails:
- ✅ Successful steps are preserved
- ⚠️ Warnings logged for non-critical errors (e.g., plugin already installed)
- ❌ Critical errors stop the installation
- 📋 All details logged in the **Logs** sheet

Example error scenarios:
- **WordPress not accessible** → Installation stops at Step 1
- **Divi installation fails** → Installation continues (might already be installed)
- **Product import fails** → Installation continues, only affected products skipped

### Logs

All installation activities are logged:
- **Timestamp**: When the step occurred
- **Level**: INFO, WARNING, ERROR, SUCCESS
- **Category**: AUTOMATION
- **Message**: Detailed description
- **Site ID**: Site identifier

Check the **Logs** sheet for detailed progress.

---

## 📤 Deploy Selected Content

### Overview
Automated content creation and publishing pipeline. Handles everything from product import to WordPress publishing.

### Access
**⚡ WAAS** → **🤖 Automation** → **📤 Deploy Selected Content**

### Dialog Options

| Field | Required | Description |
|-------|----------|-------------|
| **Select Site** | ✅ Yes | Target WordPress site |
| **Content Type** | ✅ Yes | Type of content to generate |
| **Amazon ASINs** | ✅ Yes | Comma-separated product ASINs |
| **Content Title** | ⭕ Optional | Custom title (auto-generated if empty) |
| **Auto-publish** | ⭕ Optional | Publish immediately (default: yes) |

### Content Generation Examples

#### Example 1: Product Review
```
Site: TechReviews.com (ID: 2)
Content Type: Product Review
ASINs: B08N5WRWNW
Title: [empty - auto-generated]
Auto-publish: ☑ Checked

Result:
✅ Product imported: "Samsung Galaxy S23 Ultra"
✅ Review generated: "Samsung Galaxy S23 Ultra Review: Is It Worth It?"
✅ Published to WordPress
📝 Post URL: https://techreviews.com/samsung-galaxy-s23-review/
```

#### Example 2: Product Comparison
```
Site: SmartphoneGuide.com (ID: 3)
Content Type: Comparison
ASINs: B08N5WRWNW, B0CHWZTF9Q
Title: "Galaxy S23 vs iPhone 15: Which Should You Buy?"
Auto-publish: ☑ Checked

Result:
✅ 2 products imported
✅ Comparison article generated
✅ Comparison table included
✅ Published to WordPress
```

#### Example 3: Buying Guide
```
Site: BestGadgets.com (ID: 4)
Content Type: Buying Guide
ASINs: B08N5WRWNW, B0CHWZTF9Q, B09JQL6T5Q, B08XXXX123, B08XXXX456
Title: [empty - auto-generated]
Auto-publish: ☐ Unchecked (save as draft)

Result:
✅ 5 products imported
✅ Buying guide generated: "Best Smartphones for Photography in 2024"
✅ Saved as draft in WordPress
📝 Post URL: https://bestgadgets.com/?p=123 (draft preview)
```

### Content Structure

**Product Review Template:**
```
1. Introduction
   - Product overview
   - Key specifications
   - Price and availability

2. Design and Build Quality
   - Materials and construction
   - Aesthetics
   - Ergonomics

3. Features and Performance
   - Core features
   - Performance benchmarks
   - Real-world usage

4. Pros and Cons
   - ✅ Advantages
   - ❌ Disadvantages

5. Verdict
   - Final recommendation
   - Best for (target audience)
   - Alternative options

6. Where to Buy
   - Affiliate link
   - Current price
   - Availability
```

**Comparison Template:**
```
1. Introduction
   - Products being compared
   - Comparison criteria

2. Specifications Comparison Table
   - Side-by-side specs
   - Price comparison

3. Feature-by-Feature Analysis
   - Design
   - Performance
   - Battery life
   - Camera quality
   - etc.

4. Pros and Cons (Each Product)

5. Winner by Category
   - Best for gaming
   - Best value
   - Best camera
   - etc.

6. Final Verdict
   - Overall winner
   - Recommendations by use case
```

### WordPress Post Settings

Automatically configured when publishing:
- **Post Type**: Standard post
- **Status**: Publish or Draft (based on selection)
- **Featured Image**: First product image
- **Categories**: Auto-categorized based on product category
- **Tags**: Product name, brand, category
- **SEO**: Title, meta description (if Yoast SEO installed)

---

## ⏰ Automated Triggers

### Overview
WAAS can run automation tasks automatically on a schedule using Google Apps Script time-based triggers.

### Setup Instructions

1. Click **⚡ WAAS** → **🤖 Automation** → **⏰ Setup Automated Triggers**
2. Authorize the script when prompted
3. Confirm trigger creation
4. Done! Automation now runs in the background

### What Gets Automated

| Trigger | Frequency | Function | Description |
|---------|-----------|----------|-------------|
| **Daily Amazon Sync** | 3:00 AM daily | `dailyAmazonSync()` | Updates product prices, ratings, availability |
| **Hourly Automation Check** | Every hour | `hourlyAutomationCheck()` | Processes Auto Install and Deploy Content checkboxes |

### Hourly Automation Check Details

Every hour, the system:
1. **Scans Sites sheet** for checked "Auto Install" boxes
   - Processes each site with `installFullStack()`
   - Unchecks the box after successful installation
   - Logs results to Logs sheet

2. **Scans Content Queue** for checked "Deploy Content" boxes
   - Processes each content item with `deploySelectedContent()`
   - Unchecks the box after successful deployment
   - Updates Content Queue status
   - Logs results to Logs sheet

### Execution Limits

Google Apps Script has execution limits:
- **Maximum runtime per execution**: 6 minutes
- **Maximum executions per day**: 90 triggers
- **Maximum concurrent executions**: 30

**Safety mechanisms:**
- Processes maximum 10 sites per run
- Waits 5 seconds between installations
- Waits 5 seconds between content deployments
- Retries failed operations up to 3 times

### Removing Triggers

To disable automation:
1. Click **⚡ WAAS** → **🤖 Automation** → **🗑️ Remove Automated Triggers**
2. Confirm removal
3. All automation stops (manual operations still work)

### Manual Trigger Execution

You can manually run automation functions:
- **🔄 Run Daily Amazon Sync**: Updates all products immediately
- **🔄 Run Hourly Check**: Processes checkboxes immediately

These are useful for testing or forcing an update outside the schedule.

---

## 📊 Monitoring Automation

### Logs Sheet

All automation activities are logged to the **Logs** sheet:

| Column | Description |
|--------|-------------|
| **Timestamp** | When the event occurred |
| **Level** | INFO, WARNING, ERROR, SUCCESS |
| **Category** | AUTOMATION, SITE, PRODUCT, CONTENT, etc. |
| **Message** | Detailed description |
| **Site ID** | Related site (if applicable) |
| **Task ID** | Related task (if applicable) |
| **User** | Email of user who triggered the action |
| **Details** | Additional technical details |

### Log Levels

| Level | Icon | Description |
|-------|------|-------------|
| **INFO** | ℹ️ | General information |
| **WARNING** | ⚠️ | Non-critical issues |
| **ERROR** | ❌ | Critical failures |
| **SUCCESS** | ✅ | Successful operations |

### Viewing Logs

**Method 1: Logs Sheet**
1. Open the **Logs** sheet
2. Sort by timestamp (newest first)
3. Filter by Site ID or Category

**Method 2: Menu**
1. Click **⚡ WAAS** → **🔧 Settings** → **📊 View Logs**
2. Navigate to Logs sheet

### Log Retention

- Logs older than 1000 rows are automatically deleted
- To change retention: Modify `MAX_LOG_ROWS` in Core.gs
- To clear logs manually: **⚡ WAAS** → **🔧 Settings** → **🗑️ Clear Old Logs**

---

## 🎯 Best Practices

### 1. Site Configuration

**Before automation:**
✅ Test WordPress admin credentials manually
✅ Verify REST API is enabled (`/wp-json/` endpoint accessible)
✅ Fill per-site Divi credentials (columns 7-8)
✅ Fill per-site Amazon Partner Tag (column 9)
✅ Set site status to "Pending" initially

**After successful installation:**
✅ Verify Divi theme is active
✅ Test WooCommerce installation
✅ Check WAAS plugin activation
✅ Import test product manually

### 2. Product Import Strategy

**For new sites:**
1. Start with 5-10 high-quality products
2. Test content generation with 1-2 products
3. Gradually scale up to 50-100 products
4. Monitor Amazon API quotas

**Product selection:**
✅ Choose products with high ratings (4+ stars)
✅ Verify products have detailed descriptions
✅ Check product images are available
✅ Ensure products have active offers
✅ Use products relevant to your niche

### 3. Content Generation Strategy

**Quality over quantity:**
- Generate 2-3 high-quality articles per day
- Review and edit AI-generated content before publishing
- Add personal insights and experiences
- Include original images and videos

**Content mix:**
- 40% Product Reviews (detailed, single product)
- 30% Buying Guides (comprehensive, multiple products)
- 20% Comparisons (head-to-head, 2-3 products)
- 10% Top Lists (ranked, 5-10 products)

**Publishing schedule:**
- Don't auto-publish all content immediately
- Use "Save as draft" for review
- Schedule posts 2-3 days apart
- Vary publishing times

### 4. Automation Schedule

**Recommended trigger setup:**
- **Daily Sync**: 3 AM (low traffic time)
- **Hourly Check**: Enabled for 24/7 automation

**Manual operations:**
- Use "Install Full Stack" for new sites (test first)
- Use "Deploy Content" for important articles (review before publishing)
- Use checkboxes for bulk operations (multiple sites, multiple articles)

### 5. Error Handling

**If installation fails:**
1. Check Logs sheet for error details
2. Verify site credentials (WordPress admin)
3. Test WordPress REST API manually
4. Check per-site Divi credentials
5. Retry installation manually

**If content deployment fails:**
1. Check Logs sheet for error messages
2. Verify Amazon ASINs are valid
3. Check Amazon PA API quotas
4. Test product import manually
5. Retry deployment manually

### 6. Performance Optimization

**Reduce API calls:**
- Reuse existing products (check Products sheet first)
- Cache Amazon product data (1 hour TTL)
- Batch operations when possible

**Optimize trigger execution:**
- Process 5-10 items per trigger execution
- Use delays between operations (5 seconds)
- Monitor execution time (< 5 minutes per run)

### 7. Security

**Credentials:**
✅ Use per-site credentials (more secure than global)
✅ Use WordPress Application Passwords (not admin password)
✅ Rotate API keys quarterly
✅ Store credentials in Script Properties (encrypted)

**WordPress:**
✅ Enable SSL/HTTPS on all sites
✅ Use strong admin passwords (generated)
✅ Limit REST API access (IP whitelist if possible)
✅ Enable WordPress security plugins

---

## 🔧 Troubleshooting

### Installation Issues

#### Issue: "WordPress site not accessible"
**Symptoms:** Step 1 fails with HTTP error
**Solutions:**
1. Verify WordPress URL is correct (https:// prefix)
2. Check site is online (visit in browser)
3. Verify admin credentials are correct
4. Check if REST API is enabled (`/wp-json/` accessible)
5. Disable security plugins temporarily

#### Issue: "Divi installation failed"
**Symptoms:** Step 2 fails
**Solutions:**
1. Verify Divi API credentials (columns 7-8)
2. Check Elegant Themes account is active
3. Test Divi API manually (use test connections)
4. Verify site has write permissions for wp-content/themes/
5. Try installing Divi manually first

#### Issue: "Plugin installation failed"
**Symptoms:** Step 4 fails
**Solutions:**
1. Check WordPress user has install_plugins capability
2. Verify wp-content/plugins/ is writable
3. Check for conflicting plugins
4. Install plugin manually via WP admin
5. Check WordPress version compatibility

### Content Deployment Issues

#### Issue: "Product import failed"
**Symptoms:** Step 1 fails, no products imported
**Solutions:**
1. Verify Amazon ASINs are valid (10-character alphanumeric)
2. Check Amazon PA API credentials
3. Verify API quota not exceeded (8640 requests/day)
4. Test Amazon API manually (use product import menu)
5. Check product availability (may be out of stock)

#### Issue: "Content generation failed"
**Symptoms:** Step 2 fails
**Solutions:**
1. Check Claude AI API is configured (if using external API)
2. Verify products were imported successfully (check Products sheet)
3. Check content type is valid
4. Review Logs sheet for detailed error
5. Try simpler content type (product_review)

#### Issue: "WordPress publishing failed"
**Symptoms:** Step 3 fails, content not published
**Solutions:**
1. Verify WordPress REST API is accessible
2. Check site admin credentials
3. Verify user has publish_posts capability
4. Check for conflicting plugins (security, caching)
5. Try publishing as draft first (change setting)

### Automation Trigger Issues

#### Issue: "Triggers not running"
**Symptoms:** Checkboxes remain checked, nothing happens
**Solutions:**
1. Verify triggers are installed (**⚡ WAAS** → **🤖 Automation** → check if "Remove" option is available)
2. Check trigger execution logs (Apps Script dashboard)
3. Verify script authorization (may need re-authorization)
4. Check for execution errors (Apps Script dashboard → Executions)
5. Manually run automation check to test

#### Issue: "Trigger execution failed"
**Symptoms:** Execution errors in Apps Script dashboard
**Solutions:**
1. Check execution time (< 6 minutes per run)
2. Verify Google Apps Script quotas not exceeded
3. Review error message in execution logs
4. Check for syntax errors (if modified code)
5. Reduce automation batch size (fewer items per run)

### General Issues

#### Issue: "Slow performance"
**Symptoms:** Operations take too long
**Solutions:**
1. Reduce number of products per operation
2. Use caching for repeated operations
3. Check WordPress server performance
4. Optimize database queries
5. Increase delays between operations

#### Issue: "API quota exceeded"
**Symptoms:** "Rate limit" or "Quota exceeded" errors
**Solutions:**
1. Wait for quota reset (24 hours for Amazon PA API)
2. Reduce automation frequency
3. Cache API responses (increase TTL)
4. Use existing product data when possible
5. Consider upgrading API plan

---

## 📚 Advanced Usage

### Customizing Automation Triggers

Edit `google-apps-script/Automation.gs`:

```javascript
// Change daily sync time (default: 3 AM)
ScriptApp.newTrigger('dailyAmazonSync')
  .timeBased()
  .atHour(5)  // Change to 5 AM
  .everyDays(1)
  .create();

// Change hourly check frequency
ScriptApp.newTrigger('hourlyAutomationCheck')
  .timeBased()
  .everyHours(2)  // Change to every 2 hours
  .create();
```

### Custom Content Templates

Modify content generation templates in `google-apps-script/ContentGenerator.gs`:

```javascript
// Custom product review template
function generateProductReview(productId) {
  const product = getProductById(productId);

  const content = `
# ${product.name} Review

## My Personal Experience
[Add your personal insights here]

## Detailed Analysis
${generateFeatureAnalysis(product)}

## Final Thoughts
${generateVerdict(product)}

## Where to Buy
${product.affiliateLink}
  `;

  return content;
}
```

### Batch Operations

Process multiple sites simultaneously:

```javascript
// Install full stack on multiple sites
function batchInstallFullStack() {
  const siteIds = [1, 2, 3, 4, 5];

  siteIds.forEach(siteId => {
    try {
      installFullStack(siteId);
      Utilities.sleep(10000); // Wait 10s between installations
    } catch (error) {
      logError('BATCH', `Failed to install site ${siteId}: ${error.message}`, siteId);
    }
  });
}
```

---

## 🆘 Support

### Resources

- **Documentation**: `/docs/` directory
- **GitHub Issues**: [LUKOAI/LUKO-WAAS/issues](https://github.com/LUKOAI/LUKO-WAAS/issues)
- **Logs Sheet**: Check for detailed error messages
- **About WAAS**: **⚡ WAAS** → **ℹ️ About WAAS**

### Common Commands

| Menu Path | Function |
|-----------|----------|
| **⚡ WAAS → 🤖 Automation → 🚀 Install Full Stack** | Install complete stack on site |
| **⚡ WAAS → 🤖 Automation → 📤 Deploy Selected Content** | Deploy content to site |
| **⚡ WAAS → 🤖 Automation → ⏰ Setup Automated Triggers** | Enable automation |
| **⚡ WAAS → 🔧 Settings → 📊 View Logs** | View automation logs |
| **⚡ WAAS → 🔧 Settings → 🧪 Test Connections** | Test API credentials |

---

## 📝 Changelog

### Version 2.0 (Current)
- ✅ Auto Install checkbox (Sites sheet, column 13)
- ✅ Deploy Content checkbox (Content Queue sheet, column 7)
- ✅ Install Full Stack function (6-step installation)
- ✅ Deploy Selected Content function (3-step deployment)
- ✅ Automated trigger system (daily & hourly)
- ✅ WooCommerce installation
- ✅ Comprehensive logging
- ✅ Error handling and retry logic
- ✅ Per-site credential support

### Version 1.0
- Basic site management
- Manual Divi installation
- Manual product import
- Manual content generation
- Global credentials only

---

**Built with ❤️ by LUKOAI for affiliate marketers**

**© 2024 LUKOAI** | [GitHub](https://github.com/LUKOAI)
