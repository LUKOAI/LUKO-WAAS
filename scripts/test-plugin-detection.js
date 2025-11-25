#!/usr/bin/env node

/**
 * Test script to check if LUKO-WAAS plugin is detected via WordPress REST API
 *
 * Usage: node scripts/test-plugin-detection.js <WP_URL> <USERNAME> <APP_PASSWORD>
 */

const https = require('https');
const http = require('http');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
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
    req.end();
  });
}

async function testPluginDetection(wpUrl, username, password) {
  log('='.repeat(60), 'bright');
  log('LUKO-WAAS Plugin Detection Test', 'bright');
  log('='.repeat(60), 'bright');
  log('');
  log(`WordPress URL: ${wpUrl}`, 'cyan');
  log(`Username: ${username}`, 'cyan');
  log('');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  // Test 1: Check plugins via REST API
  log('Test 1: Fetching installed plugins via REST API...', 'cyan');

  try {
    const response = await makeRequest(`${wpUrl}/wp-json/wp/v2/plugins`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      const plugins = response.data;
      log(`✓ Found ${plugins.length} plugins`, 'green');
      log('');

      // Display all plugins
      log('All installed plugins:', 'cyan');
      plugins.forEach((plugin, index) => {
        const status = plugin.status === 'active' ? '✓ ACTIVE' : '○ inactive';
        console.log(`  ${index + 1}. ${plugin.name}`);
        console.log(`     Slug: ${plugin.plugin}`);
        console.log(`     Status: ${status}`);
        console.log('');
      });

      // Check for our plugin using the same logic as Google Apps Script
      log('Checking for LUKO-WAAS plugin...', 'cyan');

      const ourPlugin = plugins.find(plugin =>
        plugin.plugin.includes('luko-amazon-affiliate-manager') ||
        plugin.plugin.includes('waas-product-manager') ||
        plugin.name.includes('WAAS Product Manager') ||
        plugin.name.includes('LUKO-WAAS')
      );

      if (ourPlugin) {
        log('', 'reset');
        log('='.repeat(60), 'green');
        log('✓ LUKO-WAAS PLUGIN FOUND!', 'green');
        log('='.repeat(60), 'green');
        log('');
        log(`  Name: ${ourPlugin.name}`, 'green');
        log(`  Slug: ${ourPlugin.plugin}`, 'green');
        log(`  Status: ${ourPlugin.status.toUpperCase()}`, ourPlugin.status === 'active' ? 'green' : 'yellow');
        log(`  Version: ${ourPlugin.version || 'N/A'}`, 'green');
        log('');

        if (ourPlugin.status === 'active') {
          log('✓ Plugin is INSTALLED and ACTIVE - automation should detect this!', 'green');
        } else {
          log('⚠ Plugin is installed but NOT active', 'yellow');
        }

        return { found: true, active: ourPlugin.status === 'active', plugin: ourPlugin };
      } else {
        log('', 'reset');
        log('='.repeat(60), 'red');
        log('✗ LUKO-WAAS plugin NOT found', 'red');
        log('='.repeat(60), 'red');
        return { found: false };
      }

    } else if (response.status === 401) {
      log('✗ Authentication failed - check username/password', 'red');
      return { error: 'auth_failed' };
    } else {
      log(`✗ API Error: HTTP ${response.status}`, 'red');
      console.log('Response:', response.data);
      return { error: 'api_error' };
    }

  } catch (error) {
    log(`✗ Request failed: ${error.message}`, 'red');
    return { error: error.message };
  }
}

// Test 2: Check WAAS REST API endpoint
async function testWaasEndpoint(wpUrl, username, password) {
  log('');
  log('Test 2: Checking WAAS REST API endpoint...', 'cyan');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const response = await makeRequest(`${wpUrl}/wp-json/waas/v1/status`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (response.status === 200) {
      log('✓ WAAS REST API is responding!', 'green');
      console.log('  Response:', JSON.stringify(response.data, null, 2));
      return true;
    } else if (response.status === 404) {
      log('⚠ WAAS REST API endpoint not found (plugin may not expose /status)', 'yellow');
      return false;
    } else {
      log(`⚠ WAAS API returned HTTP ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`⚠ Could not reach WAAS API: ${error.message}`, 'yellow');
    return false;
  }
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node scripts/test-plugin-detection.js <WP_URL> <USERNAME> <APP_PASSWORD>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/test-plugin-detection.js \\');
    console.log('    https://passgenaue-lkw-fussmatten.lk24.shop \\');
    console.log('    admin \\');
    console.log('    "xxxx xxxx xxxx xxxx xxxx xxxx"');
    process.exit(1);
  }

  const [wpUrl, username, password] = args;

  (async () => {
    const result = await testPluginDetection(wpUrl, username, password);
    await testWaasEndpoint(wpUrl, username, password);

    log('');
    log('='.repeat(60), 'bright');
    if (result.found && result.active) {
      log('SUMMARY: Plugin is installed and active ✓', 'green');
    } else if (result.found) {
      log('SUMMARY: Plugin is installed but not active', 'yellow');
    } else if (result.error) {
      log(`SUMMARY: Test failed - ${result.error}`, 'red');
    } else {
      log('SUMMARY: Plugin not installed', 'red');
    }
    log('='.repeat(60), 'bright');
  })();
}

module.exports = { testPluginDetection };
