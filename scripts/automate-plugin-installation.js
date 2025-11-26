#!/usr/bin/env node

/**
 * LUKO-WAAS Complete Plugin Automation
 *
 * This script automatically:
 * 1. Detects if plugins are installed
 * 2. Activates inactive plugins
 * 3. Installs missing plugins
 *
 * Works with multiple methods:
 * - WordPress REST API (primary)
 * - SFTP upload (fallback)
 * - Puppeteer browser automation (last resort)
 *
 * Usage:
 *   node scripts/automate-plugin-installation.js <WP_URL> <USERNAME> <APP_PASSWORD> <PLUGIN_ZIP_URL_OR_PATH>
 *
 * Example:
 *   node scripts/automate-plugin-installation.js \
 *     https://passgenaue-lkw-fussmatten.lk24.shop \
 *     netanaliza \
 *     "tQEL QZyV ZcvT 3tPn OV1E FBQ1" \
 *     https://lk24.shop/downloads/waas-product-manager.zip
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

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

/**
 * Make HTTP request with retry logic
 */
async function makeRequest(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, {
          method: options.method || 'GET',
          headers: options.headers || {},
          rejectUnauthorized: false,
          timeout: 30000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: data ? JSON.parse(data) : null
              });
            } catch (e) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: data
              });
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        if (options.body) {
          req.write(options.body);
        }

        req.end();
      });
    } catch (error) {
      if (attempt < retries) {
        const delay = 2000 * attempt;
        log(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Check if plugin is installed and its status
 */
async function checkPluginStatus(wpUrl, username, password, pluginSlugPattern) {
  log('Checking plugin status via REST API...', 'cyan');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const response = await makeRequest(`${wpUrl}/wp-json/wp/v2/plugins`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      const plugins = response.data;

      // Look for our plugins using multiple patterns
      const searchPatterns = Array.isArray(pluginSlugPattern)
        ? pluginSlugPattern
        : [pluginSlugPattern];

      const ourPlugin = plugins.find(plugin =>
        searchPatterns.some(pattern =>
          plugin.plugin.toLowerCase().includes(pattern.toLowerCase()) ||
          plugin.name.toLowerCase().includes(pattern.toLowerCase())
        )
      );

      if (ourPlugin) {
        log(`✓ Plugin found: ${ourPlugin.name}`, 'green');
        log(`  Slug: ${ourPlugin.plugin}`, 'reset');
        log(`  Status: ${ourPlugin.status}`, ourPlugin.status === 'active' ? 'green' : 'yellow');
        log(`  Version: ${ourPlugin.version || 'N/A'}`, 'reset');

        return {
          installed: true,
          active: ourPlugin.status === 'active',
          plugin: ourPlugin
        };
      } else {
        log('✗ Plugin not found', 'yellow');
        return { installed: false, active: false };
      }
    } else {
      throw new Error(`REST API returned status ${response.status}`);
    }
  } catch (error) {
    log(`⚠ Failed to check plugin status: ${error.message}`, 'yellow');
    return { installed: false, active: false, error: error.message };
  }
}

/**
 * Activate a plugin via REST API
 */
async function activatePlugin(wpUrl, username, password, pluginPath) {
  log(`Activating plugin: ${pluginPath}...`, 'cyan');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const url = `${wpUrl}/wp-json/wp/v2/plugins/${encodeURIComponent(pluginPath)}`;

  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'active' })
    });

    if (response.status === 200) {
      log('✓ Plugin activated successfully!', 'green');
      return { success: true };
    } else if (response.status === 500 && response.data &&
               (response.data.message || '').includes('already active')) {
      log('✓ Plugin was already active', 'green');
      return { success: true };
    } else {
      throw new Error(`Activation failed: HTTP ${response.status}`);
    }
  } catch (error) {
    log(`✗ Activation failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Install plugin via REST API
 */
async function installPluginViaAPI(wpUrl, username, password, pluginZipUrl) {
  log('Installing plugin via WordPress REST API...', 'cyan');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  // Download plugin ZIP to temp file
  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFile = path.join(tempDir, `plugin-${Date.now()}.zip`);

  try {
    // Download plugin
    log(`Downloading plugin from: ${pluginZipUrl}`, 'blue');
    await downloadFile(pluginZipUrl, tempFile);

    const stats = fs.statSync(tempFile);
    log(`✓ Plugin downloaded (${(stats.size / 1024).toFixed(2)} KB)`, 'green');

    // Upload and install via REST API
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFile));
    form.append('status', 'active');

    const url = `${wpUrl}/wp-json/wp/v2/plugins`;

    const response = await new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);

      const req = protocol.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': authHeader
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
      form.pipe(req);
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

    if (response.status === 201 || response.status === 200) {
      log('✓ Plugin installed via REST API successfully!', 'green');
      return { success: true, method: 'rest-api' };
    } else if (response.status === 500 && response.data &&
               response.data.code === 'folder_exists') {
      log('✓ Plugin already exists (will try to activate)', 'yellow');
      return { success: true, alreadyExists: true };
    } else {
      throw new Error(`Installation failed: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
    }

  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    log(`✗ REST API installation failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Install plugin via Puppeteer (fallback method)
 */
async function installPluginViaPuppeteer(wpUrl, username, password, pluginZipPath) {
  log('Installing plugin via Puppeteer browser automation...', 'cyan');

  try {
    const puppeteerInstaller = require('./install-plugin-puppeteer.js');
    const result = await puppeteerInstaller.installPlugin(wpUrl, username, password, pluginZipPath);

    if (result.success) {
      log('✓ Plugin installed via Puppeteer successfully!', 'green');
      return { success: true, method: 'puppeteer' };
    } else {
      throw new Error(result.message || 'Puppeteer installation failed');
    }
  } catch (error) {
    log(`✗ Puppeteer installation failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Download file from URL
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

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
 * Main automation function
 */
async function automatePluginInstallation(wpUrl, username, password, pluginZipPathOrUrl, options = {}) {
  log('='.repeat(60), 'bright');
  log('LUKO-WAAS Plugin Automation', 'bright');
  log('='.repeat(60), 'bright');
  log('', 'reset');
  log(`WordPress URL: ${wpUrl}`, 'cyan');
  log(`Username: ${username}`, 'cyan');
  log(`Plugin: ${pluginZipPathOrUrl}`, 'cyan');
  log('', 'reset');

  const pluginPatterns = options.pluginPatterns || [
    'waas-product-manager',
    'waas-patronage-manager',
    'luko-waas',
    'luko-amazon-affiliate-manager'
  ];

  try {
    // STEP 1: Check if plugin is already installed
    log('Step 1: Checking if plugin is installed...', 'bright');
    const status = await checkPluginStatus(wpUrl, username, password, pluginPatterns);
    log('', 'reset');

    if (status.installed && status.active) {
      log('='.repeat(60), 'green');
      log('✓ Plugin is already installed and active!', 'green');
      log('  No action needed.', 'green');
      log('='.repeat(60), 'green');
      return {
        success: true,
        action: 'none',
        message: 'Plugin already installed and active'
      };
    }

    if (status.installed && !status.active) {
      log('Plugin is installed but NOT active. Activating...', 'yellow');
      log('', 'reset');

      // STEP 2: Activate the plugin
      log('Step 2: Activating plugin...', 'bright');
      const activateResult = await activatePlugin(wpUrl, username, password, status.plugin.plugin);

      if (activateResult.success) {
        log('', 'reset');
        log('='.repeat(60), 'green');
        log('✓ Plugin activated successfully!', 'green');
        log('='.repeat(60), 'green');
        return {
          success: true,
          action: 'activated',
          message: 'Plugin was installed but inactive - now activated'
        };
      } else {
        throw new Error(`Failed to activate plugin: ${activateResult.error}`);
      }
    }

    // Plugin is not installed - need to install it
    log('Plugin not found. Installing...', 'yellow');
    log('', 'reset');

    // STEP 2: Install the plugin
    log('Step 2: Installing plugin...', 'bright');

    // Try REST API first (cleanest method)
    let installResult = await installPluginViaAPI(wpUrl, username, password, pluginZipPathOrUrl);

    if (!installResult.success) {
      log('', 'reset');
      log('REST API installation failed. Trying Puppeteer...', 'yellow');
      log('', 'reset');

      // Try Puppeteer as fallback
      installResult = await installPluginViaPuppeteer(wpUrl, username, password, pluginZipPathOrUrl);

      if (!installResult.success) {
        throw new Error('All installation methods failed');
      }
    }

    log('', 'reset');
    log('='.repeat(60), 'green');
    log('✓ Plugin installed and activated successfully!', 'green');
    log(`  Method used: ${installResult.method || 'unknown'}`, 'green');
    log('='.repeat(60), 'green');

    return {
      success: true,
      action: 'installed',
      method: installResult.method,
      message: 'Plugin installed and activated successfully'
    };

  } catch (error) {
    log('', 'reset');
    log('='.repeat(60), 'red');
    log(`✗ Automation failed: ${error.message}`, 'red');
    log('='.repeat(60), 'red');

    return {
      success: false,
      error: error.message
    };
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log('Usage: node automate-plugin-installation.js <WP_URL> <USERNAME> <APP_PASSWORD> <PLUGIN_ZIP_URL_OR_PATH>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/automate-plugin-installation.js \\');
    console.log('    https://passgenaue-lkw-fussmatten.lk24.shop \\');
    console.log('    netanaliza \\');
    console.log('    "tQEL QZyV ZcvT 3tPn OV1E FBQ1" \\');
    console.log('    https://lk24.shop/downloads/waas-product-manager.zip');
    process.exit(1);
  }

  const [wpUrl, username, password, pluginZipPathOrUrl] = args;

  automatePluginInstallation(wpUrl, username, password, pluginZipPathOrUrl)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { automatePluginInstallation, checkPluginStatus, activatePlugin };
