# Migration Guide: Per-Site Divi API Keys

## Overview

This migration adds support for **per-site Divi API credentials** in the WAAS system. Previously, all sites shared global Divi API credentials stored in Script Properties. Now, each site can have its own Divi API username and key.

## Why This Migration?

### Problem
- **FAZA 2 Architecture**: The system was designed to support 100+ sites, each potentially using different Divi accounts
- **Shared Credentials**: All sites used the same global Divi API credentials
- **Scalability**: Managing 100+ sites with one Divi account is not practical
- **Security**: Per-site credentials provide better isolation and security

### Solution
- Add two new columns to the Sites sheet: `Divi API Username` and `Divi API Key`
- Each site can now have its own Divi credentials
- Fallback to global credentials if per-site credentials are not set

## What Changed?

### 1. Sites Sheet Structure

**Before:**
```
| ID | Site Name | Domain | WordPress URL | Admin Username | Admin Password | Status | Divi Installed | Plugin Installed | Last Check | Created Date | Notes |
```

**After:**
```
| ID | Site Name | Domain | WordPress URL | Admin Username | Admin Password | Divi API Username | Divi API Key | Status | Divi Installed | Plugin Installed | Last Check | Created Date | Notes |
```

### 2. Code Changes

#### Core.gs
- Added `getDiviCredentialsForSite(site)` function
- Marked `getDiviCredentials()` as deprecated
- Automatic fallback to global credentials

#### SiteManager.gs
- Updated `getSiteById()` to return `diviApiUsername` and `diviApiKey`
- Updated `updateSiteStatus()` to handle per-site Divi credentials
- Updated `downloadDiviPackage()` to accept site parameter
- Updated column indices to account for new columns

#### setup.gs
- Updated `createSitesSheet()` to include new columns
- Added menu items for migration tools

#### Migration.gs (NEW)
- `migrateToPerSiteDiviKeys()` - Main migration function
- `verifyMigration()` - Verify migration was successful
- `populateDiviCredentialsFromGlobal()` - Copy global credentials to all sites (optional)

## How to Migrate

### Method 1: Using the WAAS Menu (Recommended)

1. **Open your WAAS Google Sheet**

2. **Reload the sheet** (refresh the page) to load the new menu items

3. **Navigate to the menu:**
   ```
   ⚡ WAAS > 🔧 Settings > 🔄 Migrate to Per-Site Divi Keys
   ```

4. **Run the migration:**
   - Click "Migrate to Per-Site Divi Keys"
   - Authorize the script if prompted
   - Wait for the migration to complete
   - You'll see a success message

5. **Verify the migration:**
   ```
   ⚡ WAAS > 🔧 Settings > ✅ Verify Migration
   ```

6. **Fill in Divi credentials:**
   - Go to the Sites sheet
   - For each site, fill in columns:
     - Column 7: Divi API Username
     - Column 8: Divi API Key

### Method 2: Using Apps Script Editor

1. **Open Apps Script:**
   - Extensions > Apps Script

2. **Find Migration.gs:**
   - Look for the Migration.gs file in the left sidebar

3. **Run the migration:**
   ```javascript
   // Select this function from the dropdown
   migrateToPerSiteDiviKeys()

   // Click the Run button (▶️)
   ```

4. **Check the execution log:**
   - View > Execution log
   - Look for success messages

5. **Verify:**
   ```javascript
   // Select this function from the dropdown
   verifyMigration()

   // Click the Run button (▶️)
   ```

### Method 3: Copy Global Credentials to All Sites (Optional)

If you want to copy your global Divi credentials to all sites automatically:

1. **Make sure global credentials are set:**
   - Extensions > Apps Script
   - Project Settings (⚙️)
   - Script Properties:
     - `DIVI_API_USERNAME`
     - `DIVI_API_KEY`

2. **Run the populate function:**
   ```javascript
   // In Apps Script editor
   populateDiviCredentialsFromGlobal()
   ```

3. **Result:**
   - All sites without credentials will get the global credentials copied
   - Sites that already have credentials will not be modified

## Migration Checklist

- [ ] Back up your Google Sheet (File > Make a copy)
- [ ] Run the migration: `migrateToPerSiteDiviKeys()`
- [ ] Verify the migration: `verifyMigration()`
- [ ] Check the Sites sheet - columns 7 and 8 should be "Divi API Username" and "Divi API Key"
- [ ] Fill in Divi credentials for each site (or use `populateDiviCredentialsFromGlobal()`)
- [ ] Test Divi installation on one site
- [ ] Monitor logs for any issues

## Troubleshooting

### Issue: "Sites sheet not found"
**Solution:** Run `installWAAS()` first to create the sheet structure

### Issue: "Divi API columns already exist"
**Solution:**
- Click "Yes" when prompted to re-run the migration
- Or run `verifyMigration()` to check if everything is correct

### Issue: "No Divi credentials available for site"
**Solution:**
- Fill in the Divi API Username and Divi API Key for the site in the Sites sheet
- Or set global credentials in Script Properties as a fallback

### Issue: Column indices are wrong after migration
**Solution:**
- Run `verifyMigration()` to check column positions
- If incorrect, contact support or manually adjust column positions

## Rollback

If you need to rollback the migration:

1. **Restore from backup:**
   - Use your backup copy (File > Make a copy)

2. **Or manually remove columns:**
   - Right-click on column G (Divi API Username)
   - Delete column
   - Right-click on column G (Divi API Key)
   - Delete column

3. **Update the code:**
   - Revert changes to Core.gs, SiteManager.gs, and setup.gs
   - Use git to checkout previous commit

## Testing

After migration, test the following:

1. **Divi Installation:**
   ```
   ⚡ WAAS > 🌐 Sites > Install Divi on Site
   ```
   - Select a site with per-site credentials
   - Check logs to verify it's using the correct credentials

2. **Site Status Check:**
   ```
   ⚡ WAAS > 🌐 Sites > Check Site Status
   ```
   - Verify status check works correctly

3. **Log Messages:**
   - Check the Logs sheet
   - Look for: "Using per-site Divi credentials for: [Site Name]"
   - Or: "No per-site Divi credentials for [Site Name], using global credentials"

## Support

If you encounter issues:

1. **Check the Logs sheet** for error messages
2. **Run `verifyMigration()`** to check column positions
3. **Check the execution log** (View > Execution log in Apps Script)
4. **Open a GitHub issue**: https://github.com/LUKOAI/LUKO-WAAS/issues

## Related Files

- `google-apps-script/Migration.gs` - Migration script
- `google-apps-script/Core.gs` - Core functions including `getDiviCredentialsForSite()`
- `google-apps-script/SiteManager.gs` - Site management functions
- `google-apps-script/setup.gs` - Installation and setup script
- `docs/MIGRATION-GUIDE.md` - This file

## Version History

- **v1.0.0** (2024-11-24) - Initial migration to per-site Divi API keys
