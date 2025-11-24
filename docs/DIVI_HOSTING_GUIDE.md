# Divi Theme Hosting Guide

This guide helps you properly host the Divi theme ZIP file for automated installation.

## The Problem: 403 Forbidden Error

If you see this error in your automation logs:

```
[ERROR] DiviAPI: Failed to download Divi: Request failed for https://srv1813-files.hstgr.io returned code 403
```

**This means:** The web server is blocking access to the file, even if file permissions are correct.

### Why File Permissions Aren't Enough

- **File permissions (755)** only control operating system access
- **Web server configuration** controls HTTP access
- Even with readable files (755), the web server can block requests with 403 Forbidden

## Solutions

### ✅ Option 1: Use Dropbox (Easiest)

1. Upload `Divi.zip` to your Dropbox
2. Right-click the file → Share → Create link
3. **Important:** Modify the share link:
   - Change: `https://www.dropbox.com/s/xxxxx/Divi.zip?dl=0`
   - To: `https://www.dropbox.com/s/xxxxx/Divi.zip?dl=1`
   - (Change `?dl=0` to `?dl=1` for direct download)
4. Copy the modified URL
5. In Google Apps Script:
   - Go to **Project Settings** → **Script Properties**
   - Add property: `DIVI_DOWNLOAD_URL`
   - Value: Your Dropbox direct download URL

### ✅ Option 2: Use Google Drive

1. Upload `Divi.zip` to Google Drive
2. Right-click → Share → Anyone with the link can view
3. Get the shareable link (format: `https://drive.google.com/file/d/FILE_ID/view`)
4. Convert to direct download link:
   - Change: `https://drive.google.com/file/d/FILE_ID/view`
   - To: `https://drive.google.com/uc?export=download&id=FILE_ID`
5. In Google Apps Script:
   - Go to **Project Settings** → **Script Properties**
   - Add property: `DIVI_DOWNLOAD_URL`
   - Value: Your Google Drive direct download URL

### ✅ Option 3: Use AWS S3

1. Create an S3 bucket (or use existing)
2. Upload `Divi.zip`
3. Set permissions to **public-read**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::your-bucket-name/Divi.zip"
     }]
   }
   ```
4. Get the public URL: `https://your-bucket-name.s3.amazonaws.com/Divi.zip`
5. In Google Apps Script:
   - Add property: `DIVI_DOWNLOAD_URL`
   - Value: Your S3 URL

### ✅ Option 4: Use Google Cloud Storage

1. Create a bucket in Google Cloud Storage
2. Upload `Divi.zip`
3. Make the object public:
   - Select the file
   - Permissions → Add members
   - New members: `allUsers`
   - Role: `Storage Object Viewer`
4. Get the public URL: `https://storage.googleapis.com/your-bucket-name/Divi.zip`
5. In Google Apps Script:
   - Add property: `DIVI_DOWNLOAD_URL`
   - Value: Your GCS URL

### ⚠️ Option 5: Fix Your Current Web Server (Advanced)

If you must use your current hosting (`srv1813-files.hstgr.io`), you need to configure the web server.

#### For Nginx/OpenResty:

Edit your nginx config:

```nginx
location /path/to/divi/ {
    autoindex on;                    # Enable directory listing (optional)
    add_header Access-Control-Allow-Origin *;
    types {
        application/zip zip;
    }
}
```

#### For Apache (.htaccess):

Create/edit `.htaccess` in the Divi directory:

```apache
<Files "Divi.zip">
    Order allow,deny
    Allow from all
    Require all granted
</Files>

# Enable direct file downloads
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
</IfModule>
```

#### For cPanel/DirectAdmin:

1. Log into your hosting control panel
2. Find **File Manager** or **Web Server Configuration**
3. Navigate to the directory containing Divi.zip
4. Look for **Hotlink Protection** or **Directory Index** settings
5. Ensure the directory allows direct file access

**Then restart your web server**

## Testing Your URL

Before updating `DIVI_DOWNLOAD_URL`, test the URL:

### Test 1: Browser Test
Open the URL in your browser - it should immediately start downloading the ZIP file.

### Test 2: cURL Test
```bash
curl -I "YOUR_DIVI_URL"
```

Should return:
```
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Length: [file size]
```

If you see `403 Forbidden`, the URL is not properly configured.

### Test 3: wget Test
```bash
wget "YOUR_DIVI_URL"
```

Should successfully download the file.

## Common Issues

### Issue: URL works in browser but fails in automation

**Cause:** Some servers check the `User-Agent` header or cookies.

**Solution:** The automation now sends proper browser headers. If still failing, use Dropbox/S3 instead.

### Issue: "This XML file does not appear to have any style information"

**Cause:** You're using an AWS S3 bucket list URL instead of direct file URL.

**Solution:** Ensure you use the direct file URL:
- ❌ Wrong: `https://s3.amazonaws.com/bucket-name/`
- ✅ Correct: `https://bucket-name.s3.amazonaws.com/Divi.zip`

### Issue: Google Drive shows preview page instead of downloading

**Cause:** Using the share link instead of direct download link.

**Solution:** Use the `uc?export=download` format (see Option 2 above).

## Updating DIVI_DOWNLOAD_URL

1. Open your Google Apps Script project
2. Click the **⚙️ Project Settings** icon (left sidebar)
3. Scroll to **Script Properties**
4. Click **Add script property**
5. Property: `DIVI_DOWNLOAD_URL`
6. Value: Your tested direct download URL
7. Click **Save script properties**

## Verifying the Setup

After updating `DIVI_DOWNLOAD_URL`, test the automation:

1. In Google Sheets, select a site
2. Run: **WAAS → Install Full Stack**
3. Check the execution logs for:
   ```
   [SUCCESS] DiviAPI: Using custom Divi download URL from Script Properties
   [INFO] DiviAPI: Download URL: https://your-url.com/Divi.zip
   [INFO] DiviAPI: Download attempt 1/3...
   [INFO] DiviAPI: HTTP Response: 200
   [SUCCESS] DiviAPI: Divi package downloaded successfully (XX.XX MB)
   ```

## Security Considerations

### Public URLs
- The Divi URL will be publicly accessible
- Anyone with the URL can download Divi
- Consider this when choosing hosting

### Private URLs (Recommended for Production)
For enhanced security, use:
- **AWS S3 with signed URLs** (time-limited access)
- **Google Cloud Storage with signed URLs**
- **Private hosting with token authentication**

If using signed URLs, you'll need to update the download function to generate fresh signatures.

## Still Having Issues?

If you continue to see 403 errors after following this guide:

1. **Verify the URL** works in your browser (incognito mode)
2. **Check the logs** in Google Apps Script execution logs
3. **Look for the detailed troubleshooting** output in logs
4. **Try a different hosting option** (Dropbox is the easiest)

## Recommended Setup

For most users, we recommend:

1. **Development/Testing**: Dropbox (easiest setup)
2. **Production**: AWS S3 or Google Cloud Storage (more reliable, better performance)
3. **Avoid**: Regular web hosting unless you fully control web server configuration

---

**Need Help?** Check the automation logs for detailed error messages and troubleshooting steps.
