# 🚀 WAAS 2.0 - Automatic Installation

**NO MORE MANUAL COPYING!**

This guide shows you how to **automatically upload** all Google Apps Script files using one command.

---

## ✨ What's New?

Instead of manually copying each `.gs` file to Google Apps Script, you can now:

1. Run ONE command
2. Files upload automatically
3. Start using immediately

**Before:** Copy 12 files manually (10+ minutes)
**Now:** Run 1 command (30 seconds)

---

## 📋 Prerequisites

### 1. Node.js & npm

Check if installed:
```bash
node --version  # Should show v14 or higher
npm --version   # Should show v6 or higher
```

If not installed:
- **Windows/Mac:** Download from [nodejs.org](https://nodejs.org/)
- **Ubuntu/Debian:** `sudo apt-get install nodejs npm`
- **Mac (Homebrew):** `brew install node`

### 2. Google Account

- You need a Google account with access to Google Sheets and Apps Script

---

## 🎯 Quick Start (3 Steps)

### Step 1: Get Your Script ID

1. Open [Google Sheets](https://sheets.google.com)
2. Create a new Google Sheet
3. Go to: **Extensions** → **Apps Script**
4. Click: **Project Settings** (⚙️ icon in left sidebar)
5. **Copy** the **Script ID** (looks like: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0`)

![Script ID Location](https://developers.google.com/apps-script/images/script-id.png)

### Step 2: Install Dependencies

In the LUKO-WAAS project directory:

```bash
npm install
```

This installs `clasp` (Google's official CLI for Apps Script).

### Step 3: Run Auto-Installer

```bash
./scripts/install.sh <YOUR_SCRIPT_ID>
```

Or using Node.js directly:

```bash
node scripts/install-to-google.js <YOUR_SCRIPT_ID>
```

**Example:**
```bash
./scripts/install.sh 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0
```

### First Time Only: Google Authentication

When you run the installer for the first time:

1. Browser will open automatically
2. **Sign in** with your Google account
3. Click **Allow** to grant permissions
4. Wait for "Logged in! You may close this page." message
5. Return to terminal - installation continues automatically

---

## 📦 What Gets Uploaded?

The installer automatically uploads **ALL** these files:

```
google-apps-script/
├── setup.gs              ✓ Setup & installation
├── Core.gs               ✓ Core utilities
├── Menu.gs               ✓ Google Sheets menu
├── SiteManager.gs        ✓ Multi-site management
├── ProductManager.gs     ✓ Product operations
├── TaskManager.gs        ✓ Task queue
├── ContentGenerator.gs   ✓ Content generation
├── DiviAPI.gs            ✓ Divi theme API
├── WordPressAPI.gs       ✓ WordPress REST API
├── AmazonPA.gs           ✓ Amazon Product Advertising API
├── Migration.gs          ✓ Migration tools
└── appsscript.json       ✓ Project manifest
```

---

## ✅ After Installation

### 1. Verify Upload

1. Open your Google Sheet
2. Go to: **Extensions** → **Apps Script**
3. You should see all `.gs` files in the left sidebar

### 2. Run Setup

1. In Apps Script editor, select function: `installWAAS`
2. Click: **Run** (▶️)
3. Grant permissions when asked
4. Wait 30-60 seconds

### 3. Verify Sheet Created

Your Google Sheet should now have these tabs:
- Sites
- Products
- Tasks
- Content Queue
- Logs
- Settings

Menu should show: **⚡ WAAS**

---

## 🔧 Troubleshooting

### "Script ID not found" Error

**Problem:** Script ID is incorrect or doesn't exist

**Solution:**
1. Go to Apps Script Project Settings
2. Copy Script ID again (make sure no extra spaces)
3. Run installer again

### "Not logged in" Error

**Problem:** Haven't authenticated with Google

**Solution:**
```bash
npx clasp login
```
Then run installer again.

### "Permission denied" Error

**Problem:** You don't own this Apps Script project

**Solution:**
1. Create a NEW Google Sheet
2. Get the NEW Script ID from that sheet
3. Run installer with the new Script ID

### "clasp not found" Error

**Problem:** Dependencies not installed

**Solution:**
```bash
npm install
```

### Files Not Showing in Apps Script

**Problem:** Upload succeeded but files not visible

**Solution:**
1. Close Apps Script tab
2. Reopen: Extensions → Apps Script
3. Refresh page (Ctrl+R or Cmd+R)

---

## 📚 Manual Installation (Alternative)

If automatic installation doesn't work, you can still use manual installation:

1. Run the old installer to create bundle:
   ```bash
   ./scripts/build-dist.sh  # If exists
   ```

2. Open `dist/WAAS_Complete_Installer.gs`

3. Copy entire file contents

4. Paste into Google Apps Script

See `DEPLOYMENT_GUIDE.md` for detailed manual steps.

---

## 🔐 Configuration After Upload

After files are uploaded, you still need to configure:

### 1. Script Properties (Global Settings)

In Apps Script: **Project Settings** → **Script Properties** → **Add script property**

**Required API Credentials:**
```
PA_API_ACCESS_KEY     = your_amazon_access_key
PA_API_SECRET_KEY     = your_amazon_secret_key
DIVI_API_USERNAME     = netanaliza
```

**Required Download URLs (for automatic installation):**
```
DIVI_DOWNLOAD_URL                  = https://your-server.com/Divi.zip
PRODUCT_MANAGER_DOWNLOAD_URL       = https://your-server.com/waas-product-manager.zip
PATRONAGE_MANAGER_DOWNLOAD_URL     = https://your-server.com/waas-patronage-manager.zip
DIVI_CHILD_DOWNLOAD_URL            = https://your-server.com/divi-child-waas.zip
```

**Where to host ZIP files:**
- AWS S3 + CloudFront (recommended for production)
- Google Cloud Storage
- Dropbox (use URL with `?dl=1` at the end)
- Your own HTTPS server

**Files to upload:**
- `Divi.zip` - download from elegantthemes.com
- `waas-product-manager.zip` - from `dist/` folder
- `waas-patronage-manager.zip` - from `dist/` folder
- `divi-child-waas.zip` - from `dist/` folder

### 2. Sites Tab (Per-Site Settings)

In your Google Sheet, **Sites** tab, add your first site:

| ID | Name | Domain | WordPress URL | Admin User | Admin Pass | API Key | Divi API Key | Amazon Tag |
|----|------|--------|---------------|------------|------------|---------|--------------|------------|
| 1  | My Site | example.com | https://example.com | admin | password123 | waas-api-example-2025 | c12d038b... | yoursite-21 |

**Important:** Each site needs its own unique Divi API Key from [Elegant Themes](https://www.elegantthemes.com/members-area/api/).

---

## 🚀 Next Steps

After successful installation:

1. ✅ Verify all files uploaded
2. ✅ Run `installWAAS()` function
3. ✅ Configure Script Properties
4. ✅ Add your site in Sites tab
5. ✅ Test: **⚡ WAAS** → **🧪 Test Connection**

Then:
- Install WordPress plugin (`waas-product-manager.zip`)
- Connect WordPress to Google Sheets
- Import your first product

See `DEPLOYMENT_GUIDE.md` for full setup instructions.

---

## 💡 Tips

### Update Files After Changes

If you edit `.gs` files locally and want to re-upload:

```bash
npx clasp push --force
```

### Pull Changes from Google Apps Script

Download current version from cloud:

```bash
npx clasp pull
```

### Watch for Changes (Auto-sync)

Auto-upload when you save files locally:

```bash
npx clasp push --watch
```

---

## 📖 Learn More

- **clasp Documentation:** https://github.com/google/clasp
- **Apps Script Guide:** https://developers.google.com/apps-script
- **WAAS Full Guide:** `DEPLOYMENT_GUIDE.md`

---

## ❓ Need Help?

**GitHub Issues:** https://github.com/LUKOAI/LUKO-WAAS/issues
**Email:** support@luko.ai

---

**Made with ❤️ by LUKO AI Team**
