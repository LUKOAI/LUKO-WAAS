#!/usr/bin/env node

/**
 * LUKO WAAS - Plugin Installation via Puppeteer
 *
 * This script uses Puppeteer to install a custom WordPress plugin via wp-admin
 * Solves the problem of empty responses when using multipart/form-data uploads
 *
 * Usage:
 *   node scripts/install-plugin-puppeteer.js <WP_URL> <USERNAME> <PASSWORD> <PLUGIN_ZIP_PATH_OR_URL>
 *
 * Example with local file:
 *   node scripts/install-plugin-puppeteer.js \
 *     https://passgenaue-lkw-fussmatten.lk24.shop \
 *     admin \
 *     "YourPassword123" \
 *     /home/user/LUKO-WAAS/wordpress-plugin/waas-product-manager.zip
 *
 * Example with URL:
 *   node scripts/install-plugin-puppeteer.js \
 *     https://passgenaue-lkw-fussmatten.lk24.shop \
 *     admin \
 *     "YourPassword123" \
 *     https://lk24.shop/downloads/waas-product-manager.zip
 */

const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration for stealth mode
const STEALTH_OPTIONS = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    log(`Downloading: ${url}`, 'blue');

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        log(`Following redirect to: ${response.headers.location}`, 'yellow');
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        log(`Downloaded to: ${outputPath}`, 'green');
        resolve(outputPath);
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function installPlugin(wpUrl, username, password, pluginZipPathOrUrl) {
  log('Launching Chromium browser with stealth mode...', 'blue');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors'
    ]
  });

  // Track if we created a temp file that needs cleanup
  let tempPluginPath = null;

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
      userAgent: STEALTH_OPTIONS.userAgent,
      locale: STEALTH_OPTIONS.locale,
      timezoneId: STEALTH_OPTIONS.timezoneId,
      extraHTTPHeaders: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    const page = await context.newPage();

    // Log console messages from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log(`Browser console error: ${msg.text()}`, 'red');
      }
    });

    // Step 1: Login to WordPress
    log('Step 1: Logging in to WordPress...', 'cyan');
    const loginUrl = `${wpUrl}/wp-login.php`;

    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Fill login form
    await page.type('#user_login', username);
    await page.type('#user_pass', password);

    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#wp-submit')
    ]);

    // Check if login was successful
    const url = page.url();
    if (url.includes('wp-login.php')) {
      throw new Error('Login failed - still on login page');
    }

    log('✓ Login successful', 'green');

    // Step 2: Navigate to plugin upload page
    log('Step 2: Navigating to plugin upload page...', 'cyan');
    const uploadUrl = `${wpUrl}/wp-admin/plugin-install.php?tab=upload`;

    await page.goto(uploadUrl, { waitUntil: 'networkidle' });
    log('✓ Plugin upload page loaded', 'green');

    // Step 3: Get plugin ZIP file (local path or download from URL)
    log('Step 3: Preparing plugin ZIP...', 'cyan');

    let pluginPath;
    const isLocalFile = !pluginZipPathOrUrl.startsWith('http://') && !pluginZipPathOrUrl.startsWith('https://');

    if (isLocalFile) {
      // Use local file directly
      if (!fs.existsSync(pluginZipPathOrUrl)) {
        throw new Error(`Local file not found: ${pluginZipPathOrUrl}`);
      }
      pluginPath = pluginZipPathOrUrl;
      log(`✓ Using local file: ${pluginPath}`, 'green');
    } else {
      // Download from URL
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const pluginFileName = path.basename(new URL(pluginZipPathOrUrl).pathname);
      pluginPath = path.join(tempDir, pluginFileName);
      tempPluginPath = pluginPath; // Mark for cleanup

      await downloadFile(pluginZipPathOrUrl, pluginPath);
      log('✓ Plugin downloaded', 'green');
    }

    // Step 4: Upload plugin file
    log('Step 4: Uploading plugin file...', 'cyan');

    // Find the file input
    const fileInput = await page.$('input[type="file"][name="pluginzip"]');
    if (!fileInput) {
      throw new Error('Could not find plugin file input');
    }

    // Upload file
    await fileInput.setInputFiles(pluginPath);
    log('✓ File selected', 'green');

    // Click "Install Now" button
    log('Step 5: Clicking Install Now button...', 'cyan');
    const installButton = await page.$('#install-plugin-submit');
    if (!installButton) {
      throw new Error('Could not find Install Now button');
    }

    // Wait for navigation after clicking install
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      installButton.click()
    ]);

    log('✓ Plugin installation initiated', 'green');

    // Step 6: Wait for installation to complete and check result
    log('Step 6: Waiting for installation to complete...', 'cyan');

    // Wait a bit for the page to fully load
    await page.waitForTimeout(2000);

    // Check for success or error messages
    const pageContent = await page.content();

    if (pageContent.includes('Plugin installed successfully') ||
        pageContent.includes('successfully installed') ||
        pageContent.includes('Activate Plugin')) {
      log('✓ Plugin installed successfully!', 'green');

      // Step 7: Try to activate plugin
      log('Step 7: Activating plugin...', 'cyan');

      // Look for activate link
      const activateLink = await page.$('a.button.button-primary[href*="action=activate"]');

      if (activateLink) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          activateLink.click()
        ]);

        // Check if activation was successful
        const finalContent = await page.content();
        if (finalContent.includes('Plugin activated') ||
            finalContent.includes('activated successfully')) {
          log('✓ Plugin activated successfully!', 'green');
        } else {
          log('⚠ Plugin installed but activation status unclear', 'yellow');
        }
      } else {
        log('⚠ Activate button not found - plugin may already be active', 'yellow');
      }

      // Clean up temp file only (not local files)
      if (tempPluginPath && fs.existsSync(tempPluginPath)) {
        fs.unlinkSync(tempPluginPath);
      }

      return {
        success: true,
        message: 'Plugin installed and activated successfully'
      };

    } else if (pageContent.includes('already installed') ||
               pageContent.includes('Destination folder already exists')) {
      log('✓ Plugin already installed', 'yellow');

      // Clean up temp file only (not local files)
      if (tempPluginPath && fs.existsSync(tempPluginPath)) {
        fs.unlinkSync(tempPluginPath);
      }

      return {
        success: true,
        message: 'Plugin already installed'
      };

    } else if (pageContent.includes('error') || pageContent.includes('Error')) {
      // Try to extract error message
      const errorMatch = pageContent.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>(.*?)<\/div>/is);
      const errorText = errorMatch ?
        errorMatch[1].replace(/<[^>]+>/g, '').trim() :
        'Unknown error';

      throw new Error(`Installation failed: ${errorText}`);
    } else {
      log('⚠ Installation result unclear. Page content:', 'yellow');
      console.log(pageContent.substring(0, 500));

      // Clean up temp file only (not local files)
      if (tempPluginPath && fs.existsSync(tempPluginPath)) {
        fs.unlinkSync(tempPluginPath);
      }

      return {
        success: false,
        message: 'Installation result unclear'
      };
    }

  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    throw error;
  } finally {
    await browser.close();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log('Usage: node install-plugin-puppeteer.js <WP_URL> <USERNAME> <PASSWORD> <PLUGIN_ZIP_PATH_OR_URL>');
    console.log('');
    console.log('Example with local file:');
    console.log('  node scripts/install-plugin-puppeteer.js \\');
    console.log('    https://passgenaue-lkw-fussmatten.lk24.shop \\');
    console.log('    admin \\');
    console.log('    "YourPassword123" \\');
    console.log('    /tmp/waas-product-manager-local.zip');
    console.log('');
    console.log('Example with URL:');
    console.log('  node scripts/install-plugin-puppeteer.js \\');
    console.log('    https://passgenaue-lkw-fussmatten.lk24.shop \\');
    console.log('    admin \\');
    console.log('    "YourPassword123" \\');
    console.log('    https://lk24.shop/downloads/waas-product-manager.zip');
    process.exit(1);
  }

  const [wpUrl, username, password, pluginZipPathOrUrl] = args;

  log('='.repeat(60), 'bright');
  log('LUKO WAAS - Plugin Installation via Puppeteer', 'bright');
  log('='.repeat(60), 'bright');
  log('', 'reset');
  log(`WordPress URL: ${wpUrl}`, 'cyan');
  log(`Username: ${username}`, 'cyan');
  log(`Plugin ZIP: ${pluginZipPathOrUrl}`, 'cyan');
  log('', 'reset');

  installPlugin(wpUrl, username, password, pluginZipPathOrUrl)
    .then(result => {
      log('', 'reset');
      log('='.repeat(60), 'bright');
      log(`✓ ${result.message}`, 'green');
      log('='.repeat(60), 'bright');
      process.exit(0);
    })
    .catch(error => {
      log('', 'reset');
      log('='.repeat(60), 'bright');
      log(`✗ Installation failed: ${error.message}`, 'red');
      log('='.repeat(60), 'bright');
      process.exit(1);
    });
}

module.exports = { installPlugin };
