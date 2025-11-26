# LUKO-WAAS Complete Plugin Automation Guide

## ✨ What This System Does

This automation system **completely handles** WordPress plugin installation and activation:

1. ✅ **Detects** if plugins are already installed
2. ✅ **Activates** plugins if they're installed but inactive
3. ✅ **Installs** plugins if they're missing
4. ✅ **Works automatically** - no manual intervention needed!

---

## 🚀 Quick Start

### Prerequisites

1. WordPress already installed on your subdomain
2. Application Password for WordPress user (or admin username/password)
3. Plugin ZIP files hosted somewhere accessible (HTTPS URL recommended)

### Install Dependencies

```bash
cd LUKO-WAAS
npm install
```

This installs:
- `playwright` (for browser automation fallback)
- `ssh2-sftp-client` (for SFTP upload method)
- `adm-zip` (for ZIP file handling)
- `form-data` (for multipart uploads)

---

## 📋 Method 1: Command Line (Node.js)

### Basic Automation Script

This is the **recommended method** - it tries multiple installation methods automatically:

```bash
node scripts/automate-plugin-installation.js \
  "https://yoursite.lk24.shop" \
  "netanaliza" \
  "tQEL QZyV ZcvT 3tPn OV1E FBQ1" \
  "https://lk24.shop/downloads/waas-product-manager.zip"
```

**What it does:**
1. Checks if plugin is installed ✓
2. Activates if inactive ✓
3. Installs if missing (tries REST API first, then Puppeteer) ✓

### SFTP Method (For Hostinger)

If you have SFTP/SSH access to your server:

```bash
node scripts/install-plugin-sftp.js \
  "https://yoursite.lk24.shop" \
  "ftp://72.61.152.116" \
  "u514364212" \
  "YourSFTPPassword" \
  "/public_html/yoursite" \
  "https://lk24.shop/downloads/waas-product-manager.zip" \
  "netanaliza" \
  "tQEL QZyV ZcvT 3tPn OV1E FBQ1"
```

**When to use SFTP:**
- REST API is blocked by security plugins
- Server has strict file upload restrictions
- You need direct file system access

### Test Plugin Detection Only

To just check if plugins are installed without making changes:

```bash
node scripts/test-plugin-detection.js \
  "https://yoursite.lk24.shop" \
  "netanaliza" \
  "tQEL QZyV ZcvT 3tPn OV1E FBQ1"
```

---

## 📋 Method 2: Google Apps Script

### Setup in Google Sheets

1. Open your WAAS Google Sheet
2. Go to **Extensions** → **Apps Script**
3. The `automatePluginInstallation()` function is already available in `WordPressAPI.gs`

### Usage Example

```javascript
function installWAASPluginOnSite() {
  const siteId = 1; // Your site ID from Sites sheet
  const site = getSiteById(siteId);

  const pluginPatterns = [
    'waas-product-manager',
    'waas-patronage-manager',
    'luko-waas'
  ];

  const pluginUrl = 'https://lk24.shop/downloads/waas-product-manager.zip';

  const result = automatePluginInstallation(site, pluginPatterns, pluginUrl);

  if (result.success) {
    Logger.log(`Success! Action: ${result.action}`);
  } else {
    Logger.log(`Failed: ${result.error}`);
  }
}
```

### Configure Script Properties

In **Apps Script** → **Project Settings** → **Script Properties**, add:

```
PRODUCT_MANAGER_DOWNLOAD_URL = https://lk24.shop/downloads/waas-product-manager.zip
PATRONAGE_MANAGER_DOWNLOAD_URL = https://lk24.shop/downloads/waas-patronage-manager.zip
```

Then the automation will use these URLs automatically.

---

## 🏗️ How Each Method Works

### 1. REST API Method (Primary)

**Advantages:**
- ✅ Fastest and cleanest
- ✅ No browser automation needed
- ✅ Works directly with WordPress

**How it works:**
1. Checks `/wp-json/wp/v2/plugins` to list installed plugins
2. If not found, uploads ZIP via REST API
3. Activates plugin via REST API

**Limitations:**
- Requires Application Password or Basic Auth
- May be blocked by security plugins

### 2. Puppeteer Method (Fallback)

**Advantages:**
- ✅ Works even when REST API is blocked
- ✅ Bypasses most anti-automation measures
- ✅ Simulates real browser behavior

**How it works:**
1. Launches headless Chrome browser
2. Logs into WordPress admin
3. Uploads plugin via admin interface
4. Activates via admin interface

**Limitations:**
- Slower than REST API
- Requires more system resources

### 3. SFTP Method (Direct Upload)

**Advantages:**
- ✅ Direct file system access
- ✅ Bypasses all web server restrictions
- ✅ Perfect for Hostinger hosting

**How it works:**
1. Downloads plugin ZIP
2. Extracts ZIP locally
3. Uploads extracted files via SFTP to `wp-content/plugins/`
4. Activates via REST API

**Limitations:**
- Requires SFTP credentials
- Needs correct path to WordPress installation

---

## 🔑 Authentication

### Application Password (Recommended)

1. Log into WordPress admin
2. Go to **Users** → **Profile**
3. Scroll to **Application Passwords**
4. Create new password with name: "WAAS Automation"
5. Copy the generated password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)
6. Use this password in all scripts

### Basic Auth (Alternative)

If Application Passwords don't work:

1. Use regular WordPress admin username and password
2. May require Basic Auth plugin installation

---

## 📦 Hosting Plugin ZIP Files

You need to host your plugin ZIP files somewhere accessible via HTTPS.

### Option 1: Hostinger (Your Current Host)

1. Upload ZIP files to: `/public_html/downloads/`
2. Create `.htaccess` in `/public_html/downloads/`:

```apache
# Allow ZIP file downloads
<FilesMatch "\.zip$">
    Order allow,deny
    Allow from all
</FilesMatch>

# Disable directory listing
Options -Indexes
```

3. Files will be accessible at: `https://lk24.shop/downloads/plugin-name.zip`

**IMPORTANT:** If you get 403 Forbidden errors, check:
- Web server config (openresty, nginx, apache)
- Directory permissions (755)
- File permissions (644)
- `.htaccess` rules

### Option 2: Google Drive (Easiest)

1. Upload ZIP to Google Drive
2. Right-click → Share → "Anyone with the link"
3. Copy file ID from URL: `https://drive.google.com/file/d/FILE_ID/view`
4. Use in scripts as: `gdrive:FILE_ID` or just `FILE_ID`

### Option 3: AWS S3 / CloudFront (Production)

1. Upload to S3 bucket
2. Set public read permissions
3. Use CloudFront for CDN
4. URL: `https://your-distribution.cloudfront.net/plugin.zip`

### Option 4: Dropbox

1. Upload to Dropbox
2. Get sharing link
3. Change `?dl=0` to `?dl=1` at the end
4. URL: `https://www.dropbox.com/s/xxxxx/plugin.zip?dl=1`

---

## 🧪 Testing the Automation

### Step-by-Step Test

1. **First, test detection:**
   ```bash
   node scripts/test-plugin-detection.js \
     "https://passgenaue-lkw-fussmatten.lk24.shop" \
     "netanaliza" \
     "tQEL QZyV ZcvT 3tPn OV1E FBQ1"
   ```

   Expected output:
   ```
   ✓ Found 9 plugins
   ✓ LUKO-WAAS PLUGIN FOUND!
   Status: ACTIVE
   ```

2. **If plugin is NOT installed, test installation:**
   ```bash
   node scripts/automate-plugin-installation.js \
     "https://test-site.lk24.shop" \
     "admin" \
     "YourPassword" \
     "https://lk24.shop/downloads/waas-product-manager.zip"
   ```

   Expected output:
   ```
   Step 1: Checking if plugin is installed...
   ✗ Plugin not found

   Step 2: Installing plugin...
   ✓ Plugin downloaded (41.5 KB)
   ✓ Plugin installed via REST API successfully!
   ✓ Plugin installed and activated successfully!
   ```

3. **If plugin is installed but INACTIVE, test activation:**
   ```bash
   node scripts/automate-plugin-installation.js \
     "https://test-site.lk24.shop" \
     "admin" \
     "YourPassword" \
     "https://lk24.shop/downloads/waas-product-manager.zip"
   ```

   Expected output:
   ```
   Step 1: Checking if plugin is installed...
   ✓ Plugin found: LUKO-WAAS Product Manager
   Status: inactive

   Step 2: Activating plugin...
   ✓ Plugin activated successfully!
   ```

4. **If plugin is already active:**
   ```bash
   node scripts/automate-plugin-installation.js \
     "https://test-site.lk24.shop" \
     "admin" \
     "YourPassword" \
     "https://lk24.shop/downloads/waas-product-manager.zip"
   ```

   Expected output:
   ```
   ✓ Plugin is already installed and active!
   No action needed.
   ```

---

## 🔧 Troubleshooting

### Error: "Authentication failed"

**Solution:**
- Verify Application Password is correct (spaces don't matter)
- Try creating a new Application Password
- Check WordPress username is correct

### Error: "Plugin download failed: HTTP 403"

**Solution:**
- Check web server configuration (not file permissions!)
- Try hosting on Google Drive instead
- Verify URL is accessible in browser

### Error: "REST API not accessible"

**Solution:**
- Check if security plugin is blocking REST API
- Try Puppeteer method instead
- Verify WordPress permalinks are enabled

### Error: "SFTP connection refused"

**Solution:**
- Verify SSH/SFTP is enabled in Hostinger
- Check SFTP port (usually 21 or 22)
- Verify username and password
- Try from terminal: `sftp user@host`

### Plugin installs but doesn't activate

**Solution:**
- Check WordPress error logs
- Plugin may have dependency issues
- Try manual activation in wp-admin
- Check plugin compatibility with WordPress version

---

## 📊 Integration with Full Stack Installation

The plugin automation integrates with the complete stack installation in `Automation.gs`:

```javascript
// Install full stack on a WordPress site
function installFullStack(siteId) {
  const site = getSiteById(siteId);

  // 1. Install Divi theme
  installDiviOnSite(siteId);

  // 2. Install WooCommerce
  installWooCommerceOnSite(siteId);

  // 3. Install WAAS Product Manager (uses automation!)
  const productPlugin = automatePluginInstallation(site,
    ['waas-product-manager', 'luko-waas'],
    getScriptProperty('PRODUCT_MANAGER_DOWNLOAD_URL')
  );

  // 4. Install WAAS Patronage Manager (uses automation!)
  const patronagePlugin = automatePluginInstallation(site,
    ['waas-patronage-manager'],
    getScriptProperty('PATRONAGE_MANAGER_DOWNLOAD_URL')
  );

  // All done!
  logSuccess('Full stack installed!');
}
```

---

## 🎯 Next Steps

Now that plugin automation works:

1. ✅ **Plugin detection** works via REST API
2. ✅ **Plugin activation** works for inactive plugins
3. ✅ **Plugin installation** works via multiple methods

### What to automate next:

- [ ] Theme installation (Divi + Child Theme)
- [ ] WooCommerce setup and configuration
- [ ] Initial product import from Amazon
- [ ] Content generation and publishing

All of these can use the same pattern:
1. Check if already done
2. Do it if not done
3. Skip if already done

---

## 📞 Support

If you encounter issues:

1. Check the logs in Google Apps Script (**View** → **Logs**)
2. Run test scripts to isolate the problem
3. Check WordPress error logs in: `/wp-content/debug.log`
4. Review troubleshooting section above

---

**Made with ❤️ by LUKO AI Team**
