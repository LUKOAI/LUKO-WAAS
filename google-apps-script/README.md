# WAAS - WordPress Affiliate Automation System
## Google Apps Script - Modular Architecture v2.0

### 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Installation](#installation)
3. [Module Structure](#module-structure)
4. [Per-Site Divi API Credentials](#per-site-divi-api-credentials)
5. [API Keys Configuration](#api-keys-configuration)
6. [Usage](#usage)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

WAAS uses a **modular architecture** with separate files for each functionality:

```
google-apps-script/
├── setup.gs               # Installation script (creates sheets, menu)
├── Core.gs                # Core functions, configuration, logging
├── Menu.gs                # UI menu and dialogs
├── SiteManager.gs         # WordPress site management
├── ProductManager.gs      # Amazon product management
├── TaskManager.gs         # Task queue system
├── ContentGenerator.gs    # Content generation
├── DiviAPI.gs             # Divi API integration
├── WordPressAPI.gs        # WordPress REST API
├── AmazonPA.gs            # Amazon Product Advertising API
├── Migration.gs           # Migration tools (per-site credentials)
└── appsscript.json        # Manifest file

TOTAL: 11 files
```

### ✨ Key Features

- **Per-Site Divi API Credentials** - Each site can have its own Divi API keys
- **Multi-Site Management** - Manage multiple WordPress sites
- **Amazon Affiliate Integration** - Import and sync products
- **Automated Content Generation** - Create reviews, comparisons, guides
- **Task Queue System** - Schedule and automate operations
- **Comprehensive Logging** - Track all operations

---

## 📥 Installation

### Step 1: Open Google Apps Script

1. Go to https://script.google.com
2. Click "New project"
3. Name your project: `WAAS`

### Step 2: Copy All Module Files

Copy **ALL 11 files** from this directory to your Google Apps Script project:

1. Click `+` next to `Files`
2. For each `.gs` file:
   - Create a new script file
   - Copy the entire content
   - Save with the same name (without `.gs` extension)

3. For `appsscript.json`:
   - Click on Project Settings (⚙️)
   - Enable "Show `appsscript.json` manifest file"
   - Replace the content with the file from this repo

**Required Files:**
- setup.gs
- Core.gs
- Menu.gs
- SiteManager.gs
- ProductManager.gs
- TaskManager.gs
- ContentGenerator.gs
- DiviAPI.gs
- WordPressAPI.gs
- AmazonPA.gs
- Migration.gs
- appsscript.json

### Step 3: Run Installation

1. Select function: `installWAAS`
2. Click Run (▶️)
3. Authorize the application:
   - Click "Review permissions"
   - Select your Google account
   - Click "Advanced"
   - Click "Go to WAAS (unsafe)"
   - Click "Allow"

4. Wait for installation to complete (30-60 seconds)

### Step 4: Configure API Keys

1. In Google Apps Script, click **Project Settings** (⚙️)
2. Scroll to **Script Properties**
3. Click **Add script property**
4. Add the following properties:

**Required (Amazon):**
| Property Name | Value |
|--------------|-------|
| `PA_API_ACCESS_KEY` | Your Amazon PA API Access Key |
| `PA_API_SECRET_KEY` | Your Amazon PA API Secret Key |
| `PA_API_PARTNER_TAG` | Your Amazon Associate Tag |

**Optional (Global Fallback):**
| Property Name | Value |
|--------------|-------|
| `DIVI_API_USERNAME` | `netanaliza` (fallback for all sites) |
| `DIVI_API_KEY` | Your global Divi API Key (fallback) |
| `HOSTINGER_API_KEY` | Optional - for future use |

5. Click **Save script properties**

### Step 5: Fill Per-Site Divi Credentials

⚠️ **IMPORTANT**: For each site in the **Sites** sheet:

1. Open the created Google Sheet
2. Go to the **Sites** tab
3. Fill columns 7-8 for EACH site:
   - **Column 7**: Divi API Username (e.g., `netanaliza`)
   - **Column 8**: Divi API Key (unique per site)

**Why per-site credentials?**
- Each WordPress site needs its own Divi license
- Prevents license conflicts
- Better security and control

### Step 6: Start Using WAAS

1. Reload the spreadsheet (F5)
2. You should see **⚡ WAAS** menu
3. Start managing your sites!

---

## 📦 Module Structure

### Core Modules

#### `setup.gs` - Installation Script
- Creates Google Sheets structure
- Initializes settings
- Sets up menu

**Key Functions:**
- `installWAAS()` - Main installation function
- `createSitesSheet()` - Creates Sites sheet with per-site Divi columns
- `onOpen()` - Creates menu when sheet opens

#### `Core.gs` - Core Functionality
- Configuration constants
- API key getters with **per-site support**
- Sheet access functions
- Logging system
- Helper functions

**Key Functions:**
- `getDiviCredentialsForSite(site)` - **NEW:** Gets per-site Divi credentials
- `getDiviCredentials()` - Global fallback
- `getAPIKey(keyName)` - Get API keys from Script Properties
- `logInfo/Warning/Error/Success()` - Logging functions

#### `Menu.gs` - User Interface
- Custom menu creation
- Dialogs for user input
- UI helpers

**Key Functions:**
- `onOpen()` - Creates WAAS menu
- `showAddSiteDialog()` - Add new site form
- `showImportProductsDialog()` - Import products form

#### `SiteManager.gs` - Site Management
- WordPress site operations
- Divi installation with **per-site credentials**
- Plugin management
- Site health checks

**Key Functions:**
- `getSiteById(siteId)` - Get site data (includes Divi credentials)
- `installDiviOnSite(siteId)` - Install Divi using per-site keys
- `checkSiteStatus(siteId)` - Check site health

#### `ProductManager.gs` - Product Management
- Amazon product import
- Product data synchronization
- Product database management

**Key Functions:**
- `importProductsFromAmazon(data)` - Import products
- `updateProductData()` - Sync product data
- `getActiveProducts()` - Get active products

#### `TaskManager.gs` - Task Queue
- Task creation and management
- Task queue processing
- Scheduled tasks

**Key Functions:**
- `createTask(type, siteId, ...)` - Create new task
- `runTaskQueue()` - Process pending tasks
- `executeTask(task)` - Execute single task

#### `ContentGenerator.gs` - Content Generation
- Generate product reviews
- Generate comparisons
- Generate buying guides
- Content templates

**Key Functions:**
- `generateContent(data)` - Generate content
- `publishScheduledContent()` - Publish content to WordPress

---

## 🔑 Per-Site Divi API Credentials

### Why Per-Site Credentials?

Each WordPress site should have its own Divi API credentials because:

1. **License Compliance** - Elegant Themes requires separate licenses per site
2. **Security** - Isolate credentials per site
3. **Flexibility** - Different sites can use different Divi accounts
4. **No Conflicts** - Prevents license validation issues

### How It Works

#### Sites Sheet Structure (columns 7-8):

| Column | Name | Purpose |
|--------|------|---------|
| 7 | Divi API Username | Per-site Divi username |
| 8 | Divi API Key | Per-site Divi API key |

#### Fallback System:

1. **Primary**: Use per-site credentials from Sites sheet (columns 7-8)
2. **Fallback**: If empty, use global Script Properties

```javascript
// In Core.gs
function getDiviCredentialsForSite(site) {
  // Try per-site credentials first
  if (site.diviApiUsername && site.diviApiKey) {
    return {
      username: site.diviApiUsername,
      apiKey: site.diviApiKey
    };
  }

  // Fallback to global credentials
  return getDiviCredentials();
}
```

### Migration from Global Credentials

If you have existing sites with global Divi credentials:

1. Open your WAAS sheet
2. Click: **⚡ WAAS → 🔧 Settings → 🔄 Migrate to Per-Site Divi Keys**
3. Follow the prompts
4. Verify: **⚡ WAAS → 🔧 Settings → ✅ Verify Migration**

---

## 🔧 API Keys Configuration

### Script Properties (Global)

Set in: **Project Settings → Script Properties**

| Property | Required | Purpose |
|----------|----------|---------|
| `PA_API_ACCESS_KEY` | ✅ Yes | Amazon PA API Access Key |
| `PA_API_SECRET_KEY` | ✅ Yes | Amazon PA API Secret Key |
| `PA_API_PARTNER_TAG` | ✅ Yes | Amazon Associate Tag |
| `DIVI_API_USERNAME` | ⚠️ Fallback | Global Divi username (fallback) |
| `DIVI_API_KEY` | ⚠️ Fallback | Global Divi API key (fallback) |
| `HOSTINGER_API_KEY` | ❌ Optional | Hostinger API (future use) |

### Per-Site Credentials (Recommended)

Set in: **Sites sheet → Columns 7-8**

For EACH site, fill:
- **Column 7**: Divi API Username (e.g., `netanaliza`)
- **Column 8**: Divi API Key (get from Elegant Themes dashboard)

---

## 🚀 Usage

### Add a New Site

1. **⚡ WAAS → 🌐 Sites → ➕ Add New Site**
2. Fill in:
   - Site Name
   - Domain
   - WordPress URL
   - Admin credentials
3. After creating, **manually fill Divi API credentials in columns 7-8**

### Install Divi on Site

1. **⚡ WAAS → 🌐 Sites → 🎨 Install Divi on Site**
2. Enter Site ID
3. System will use per-site Divi credentials from columns 7-8

### Import Amazon Products

1. **⚡ WAAS → 📦 Products → 📥 Import from Amazon**
2. Enter search keywords
3. Select category
4. Choose number of products
5. Click Import

### Generate Content

1. **⚡ WAAS → 📝 Content → ✍️ Generate Content**
2. Select site
3. Choose content type (review, comparison, guide)
4. Select products
5. Generate

### View Logs

**⚡ WAAS → 🔧 Settings → 📊 View Logs**

---

## 🔍 Troubleshooting

### Installation Issues

**Problem**: "Authorization required"
**Solution**: Click "Advanced" → "Go to WAAS (unsafe)" → Allow

**Problem**: "API keys not configured"
**Solution**: Add Script Properties in Project Settings

### Divi Installation Issues

**Problem**: "No Divi credentials available"
**Solution**: Fill columns 7-8 in Sites sheet for that specific site

**Problem**: "Failed to download Divi package"
**Solution**: Verify Divi API credentials are correct

### Product Import Issues

**Problem**: "Amazon API error"
**Solution**: Check Amazon PA API keys in Script Properties

**Problem**: "No products found"
**Solution**: Try different search keywords or category

### General Tips

1. **Check Logs**: Always check the Logs sheet for detailed error messages
2. **Test Connections**: Use **⚡ WAAS → 🔧 Settings → 🧪 Test Connections**
3. **Verify Migration**: After migrating, run **✅ Verify Migration**

---

## 📚 Additional Resources

### Documentation
- **WAAS GitHub**: https://github.com/LUKOAI/LUKO-WAAS
- **Product Manager Plugin**: https://github.com/LUKOAI/-LukoAmazonAffiliateManager
- **Divi Documentation**: https://www.elegantthemes.com/documentation/divi/
- **Divi API**: https://www.elegantthemes.com/developers/
- **Amazon PA API**: https://webservices.amazon.com/paapi5/documentation/

### Support
- **GitHub Issues**: https://github.com/LUKOAI/LUKO-WAAS/issues
- **Documentation**: See `/docs` folder in repository

---

## 📄 Version Information

**Version**: 2.0.0
**Last Updated**: 2024-11-24
**Architecture**: Modular (11 separate files)
**Key Feature**: Per-Site Divi API Credentials

---

## ✅ Quick Start Checklist

- [ ] Copy all 11 files to Google Apps Script
- [ ] Run `installWAAS()` function
- [ ] Authorize application
- [ ] Add Amazon API keys to Script Properties
- [ ] (Optional) Add global Divi keys to Script Properties as fallback
- [ ] **Fill per-site Divi credentials in Sites sheet (columns 7-8)**
- [ ] Reload spreadsheet
- [ ] Test with one site first
- [ ] Check logs for any errors

---

**© 2024 LUKOAI**
**Built with ❤️ for affiliate marketers**
