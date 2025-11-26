#!/usr/bin/env node

/**
 * LUKO-WAAS SFTP Plugin Installer
 *
 * Installs WordPress plugins via SFTP upload + REST API activation
 * Perfect for Hostinger hosting where you have SFTP access
 *
 * Usage:
 *   node scripts/install-plugin-sftp.js \
 *     <WP_URL> <SFTP_HOST> <SFTP_USER> <SFTP_PASS> <WP_PATH> <PLUGIN_ZIP> <WP_USERNAME> <WP_APP_PASSWORD>
 *
 * Example:
 *   node scripts/install-plugin-sftp.js \
 *     https://passgenaue-lkw-fussmatten.lk24.shop \
 *     ftp://72.61.152.116 \
 *     u514364212 \
 *     "YourSFTPPassword" \
 *     /public_html/passgenaue-lkw-fussmatten \
 *     https://lk24.shop/downloads/waas-product-manager.zip \
 *     netanaliza \
 *     "tQEL QZyV ZcvT 3tPn OV1E FBQ1"
 */

const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');

// Colors
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

/**
 * Download file from URL
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    log(`Downloading from: ${url}`, 'blue');

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
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
        const stats = fs.statSync(outputPath);
        log(`✓ Downloaded (${(stats.size / 1024).toFixed(2)} KB)`, 'green');
        resolve(outputPath);
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Extract plugin slug from ZIP file
 */
function getPluginSlugFromZip(zipPath) {
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    // Look for the main plugin file (*.php in root of plugin folder)
    for (const entry of zipEntries) {
      const parts = entry.entryName.split('/');
      if (parts.length === 2 && parts[1].endsWith('.php')) {
        // Found plugin file, extract plugin slug
        const pluginSlug = parts[0];
        log(`Detected plugin slug: ${pluginSlug}`, 'cyan');
        return pluginSlug;
      }
    }

    throw new Error('Could not detect plugin slug from ZIP file');
  } catch (error) {
    log(`⚠ Could not extract plugin slug: ${error.message}`, 'yellow');
    return null;
  }
}

/**
 * Upload plugin via SFTP and activate via REST API
 */
async function installViaSFTP(wpUrl, sftpConfig, pluginZipPath, wpUsername, wpAppPassword) {
  const sftp = new Client();
  let tempFiles = [];

  try {
    log('Connecting to SFTP server...', 'cyan');
    await sftp.connect(sftpConfig);
    log('✓ Connected to SFTP', 'green');

    // Get plugin slug from ZIP
    const pluginSlug = getPluginSlugFromZip(pluginZipPath);
    if (!pluginSlug) {
      throw new Error('Could not determine plugin slug');
    }

    const pluginsPath = path.join(sftpConfig.wpPath, 'wp-content', 'plugins');
    const pluginTargetPath = path.join(pluginsPath, pluginSlug);

    // Check if plugin directory already exists
    log(`Checking if plugin exists at: ${pluginTargetPath}`, 'cyan');
    const exists = await sftp.exists(pluginTargetPath);

    if (exists) {
      log(`✓ Plugin directory already exists: ${pluginSlug}`, 'yellow');
      log('  Skipping upload, will try to activate...', 'yellow');
    } else {
      log('Uploading plugin via SFTP...', 'cyan');

      // Extract ZIP locally
      const tempExtractDir = path.join(__dirname, '..', 'temp', `extract-${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });
      tempFiles.push(tempExtractDir);

      log(`Extracting ZIP to: ${tempExtractDir}`, 'blue');
      const zip = new AdmZip(pluginZipPath);
      zip.extractAllTo(tempExtractDir, true);

      const extractedPluginPath = path.join(tempExtractDir, pluginSlug);

      if (!fs.existsSync(extractedPluginPath)) {
        throw new Error(`Plugin directory not found after extraction: ${pluginSlug}`);
      }

      // Upload extracted plugin directory via SFTP
      log(`Uploading plugin directory to: ${pluginTargetPath}`, 'blue');
      await sftp.uploadDir(extractedPluginPath, pluginTargetPath);
      log('✓ Plugin uploaded successfully via SFTP', 'green');
    }

    // Disconnect SFTP
    await sftp.end();
    log('✓ SFTP connection closed', 'green');

    // Now activate plugin via WordPress REST API
    log('Activating plugin via WordPress REST API...', 'cyan');

    const authHeader = 'Basic ' + Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');

    // Find the main plugin file (usually pluginslug/pluginslug.php)
    const mainPluginFile = `${pluginSlug}/${pluginSlug}.php`;
    const url = `${wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(mainPluginFile)}`;

    const response = await new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);

      const req = protocol.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data
            });
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify({ status: 'active' }));
      req.end();
    });

    if (response.status === 200) {
      log('✓ Plugin activated successfully!', 'green');
      return { success: true, pluginSlug };
    } else if (response.status === 500 && response.data &&
               (response.data.message || '').includes('already active')) {
      log('✓ Plugin was already active', 'green');
      return { success: true, pluginSlug };
    } else {
      throw new Error(`Activation failed: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
    }

  } catch (error) {
    log(`✗ SFTP installation failed: ${error.message}`, 'red');
    throw error;
  } finally {
    // Clean up temp files
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        fs.rmSync(tempFile, { recursive: true, force: true });
      }
    }

    // Make sure SFTP is closed
    if (sftp) {
      try {
        await sftp.end();
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Main function
 */
async function main(wpUrl, sftpHost, sftpUser, sftpPass, wpPath, pluginZipUrl, wpUsername, wpAppPassword) {
  log('='.repeat(60), 'bright');
  log('LUKO-WAAS SFTP Plugin Installer', 'bright');
  log('='.repeat(60), 'bright');
  log('', 'reset');
  log(`WordPress URL: ${wpUrl}`, 'cyan');
  log(`SFTP Host: ${sftpHost}`, 'cyan');
  log(`SFTP User: ${sftpUser}`, 'cyan');
  log(`WP Path: ${wpPath}`, 'cyan');
  log(`Plugin: ${pluginZipUrl}`, 'cyan');
  log('', 'reset');

  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let pluginZipPath;
  let downloadedFile = false;

  try {
    // Step 1: Get plugin ZIP file
    if (pluginZipUrl.startsWith('http://') || pluginZipUrl.startsWith('https://')) {
      // Download from URL
      pluginZipPath = path.join(tempDir, `plugin-${Date.now()}.zip`);
      await downloadFile(pluginZipUrl, pluginZipPath);
      downloadedFile = true;
    } else {
      // Use local file
      pluginZipPath = pluginZipUrl;
      if (!fs.existsSync(pluginZipPath)) {
        throw new Error(`Local file not found: ${pluginZipPath}`);
      }
      log(`Using local file: ${pluginZipPath}`, 'green');
    }

    // Step 2: Upload via SFTP and activate
    const sftpConfig = {
      host: sftpHost.replace(/^(sftp|ftp):\/\//, ''),
      port: 22,
      username: sftpUser,
      password: sftpPass,
      wpPath: wpPath
    };

    const result = await installViaSFTP(wpUrl, sftpConfig, pluginZipPath, wpUsername, wpAppPassword);

    log('', 'reset');
    log('='.repeat(60), 'green');
    log('✓ Plugin installation completed successfully!', 'green');
    log(`  Plugin: ${result.pluginSlug}`, 'green');
    log('='.repeat(60), 'green');

    return { success: true, pluginSlug: result.pluginSlug };

  } catch (error) {
    log('', 'reset');
    log('='.repeat(60), 'red');
    log(`✗ Installation failed: ${error.message}`, 'red');
    log('='.repeat(60), 'red');
    throw error;
  } finally {
    // Clean up downloaded file
    if (downloadedFile && fs.existsSync(pluginZipPath)) {
      fs.unlinkSync(pluginZipPath);
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 8) {
    console.log('Usage: node install-plugin-sftp.js <WP_URL> <SFTP_HOST> <SFTP_USER> <SFTP_PASS> <WP_PATH> <PLUGIN_ZIP> <WP_USERNAME> <WP_APP_PASSWORD>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/install-plugin-sftp.js \\');
    console.log('    https://passgenaue-lkw-fussmatten.lk24.shop \\');
    console.log('    ftp://72.61.152.116 \\');
    console.log('    u514364212 \\');
    console.log('    "YourSFTPPassword" \\');
    console.log('    /public_html/passgenaue-lkw-fussmatten \\');
    console.log('    https://lk24.shop/downloads/waas-product-manager.zip \\');
    console.log('    netanaliza \\');
    console.log('    "tQEL QZyV ZcvT 3tPn OV1E FBQ1"');
    process.exit(1);
  }

  const [wpUrl, sftpHost, sftpUser, sftpPass, wpPath, pluginZipUrl, wpUsername, wpAppPassword] = args;

  main(wpUrl, sftpHost, sftpUser, sftpPass, wpPath, pluginZipUrl, wpUsername, wpAppPassword)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { installViaSFTP };
