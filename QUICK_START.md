# ⚡ WAAS 2.0 - Quick Start (3 Minutes)

## 🎯 Automatic Installation - NO Manual Copying!

### Prerequisites

- Node.js installed (`node --version`)
- Google Account
- 3 minutes of your time

---

## 📝 Step-by-Step

### 1️⃣ Get Script ID (30 seconds)

1. Open [Google Sheets](https://sheets.google.com) → **New Sheet**
2. **Extensions** → **Apps Script**
3. **Project Settings** (⚙️) → Copy **Script ID**

### 2️⃣ Install & Run (1 minute)

```bash
cd LUKO-WAAS
npm install
./scripts/install.sh <YOUR_SCRIPT_ID>
```

**First time:** Browser opens → Sign in → Allow → Done!

### 3️⃣ Setup (1.5 minutes)

1. **In Apps Script:** Select `installWAAS` → Click **Run** ▶️ → Grant permissions
2. **In Google Sheet:** Should see tabs: Sites, Products, Tasks, etc.
3. **Menu should show:** ⚡ WAAS

---

## ✅ Done!

Files are uploaded automatically. No manual copying!

---

## 🔧 What's Next?

### Configure API Keys

**Apps Script** → **Project Settings** → **Script Properties**:

```
PA_API_ACCESS_KEY = your_amazon_access_key
PA_API_SECRET_KEY = your_amazon_secret_key
DIVI_DOWNLOAD_URL = https://your-storage.com/Divi.zip
```

**⚠️ DIVI_DOWNLOAD_URL**: You need to host the Divi ZIP file yourself (AWS S3, Dropbox, etc.)
See detailed instructions: [docs/AUTOMATION.md#divi-theme-configuration](docs/AUTOMATION.md#divi-theme-configuration)

### Add Your Site

**Google Sheet** → **Sites** tab → Add row 2:

| ID | Name | Domain | WordPress URL | Admin User | Admin Pass | API Key | Divi API Key | Amazon Tag |
|----|------|--------|---------------|------------|------------|---------|--------------|------------|
| 1  | My Site | example.com | https://example.com | admin | pass123 | waas-api-example-2025 | [40-char-key] | yoursite-21 |

Get Divi API Key: https://www.elegantthemes.com/members-area/api/

### Install WordPress Plugin

1. Upload `dist/waas-product-manager.zip` to WordPress
2. Activate plugin
3. Configure: **WAAS Products** → **Settings**

---

## 🧪 Test

**Google Sheet** → **⚡ WAAS** → **🧪 Test Connection**

Should show: ✅ Connected!

---

## 📚 Full Documentation

- **Automatic Installation:** `AUTOMATIC_INSTALLATION.md`
- **Complete Deployment:** `DEPLOYMENT_GUIDE.md`
- **Troubleshooting:** `AUTOMATIC_INSTALLATION.md#troubleshooting`

---

## 🆘 Problems?

```bash
# Not logged in?
npx clasp login

# Script ID wrong?
# Get new Script ID from Project Settings

# Files not showing?
# Refresh Apps Script page (Ctrl+R)
```

**GitHub Issues:** https://github.com/LUKOAI/LUKO-WAAS/issues

---

**That's it! 🎉**
