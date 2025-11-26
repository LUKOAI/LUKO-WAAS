#!/usr/bin/env node

/**
 * LUKO WAAS - Automatic Google Apps Script Installation
 *
 * This script automatically uploads all .gs files to your Google Apps Script project
 * NO MANUAL COPYING REQUIRED!
 *
 * Prerequisites:
 * 1. Run: npm install
 * 2. Run: npx clasp login
 * 3. Create new Google Sheets
 * 4. Get Script ID from: Extensions → Apps Script → Project Settings → Script ID
 *
 * Usage:
 *   node scripts/install-to-google.js <SCRIPT_ID>
 *
 * Or use npm script:
 *   npm run install-to-google <SCRIPT_ID>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n➤ ${description}...`, 'blue');
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(`✓ ${description} - SUCCESS`, 'green');
    return output;
  } catch (error) {
    log(`✗ ${description} - FAILED`, 'red');
    log(error.message, 'red');
    throw error;
  }
}

function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║     LUKO WAAS - Automatic Google Apps Script Installer    ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝\n', 'bright');

  // Check if Script ID is provided
  const scriptId = process.argv[2];

  if (!scriptId) {
    log('ERROR: Script ID not provided!', 'red');
    log('\nUsage:', 'yellow');
    log('  node scripts/install-to-google.js <SCRIPT_ID>', 'yellow');
    log('\nHow to get Script ID:', 'yellow');
    log('  1. Open your Google Sheet', 'yellow');
    log('  2. Go to: Extensions → Apps Script', 'yellow');
    log('  3. Click: Project Settings (⚙️)', 'yellow');
    log('  4. Copy: Script ID\n', 'yellow');
    process.exit(1);
  }

  log(`Script ID: ${scriptId}`, 'blue');

  // Create .clasp.json
  log('\n1. Creating .clasp.json configuration...', 'bright');
  const claspConfig = {
    scriptId: scriptId,
    rootDir: './google-apps-script'
  };

  fs.writeFileSync('.clasp.json', JSON.stringify(claspConfig, null, 2));
  log('✓ .clasp.json created', 'green');

  // Check if clasp is installed
  log('\n2. Checking clasp installation...', 'bright');
  try {
    execSync('npx clasp --version', { stdio: 'pipe' });
    log('✓ clasp is installed', 'green');
  } catch (error) {
    log('✗ clasp not found. Installing...', 'yellow');
    execCommand('npm install', 'Installing dependencies');
  }

  // Check if user is logged in
  log('\n3. Checking authentication...', 'bright');
  try {
    execSync('npx clasp login --status', { stdio: 'pipe' });
    log('✓ Already logged in to Google', 'green');
  } catch (error) {
    log('⚠ Not logged in. Opening browser for authentication...', 'yellow');
    log('\nPlease follow these steps:', 'yellow');
    log('  1. Browser will open with Google login', 'yellow');
    log('  2. Choose your Google account', 'yellow');
    log('  3. Click "Allow" to grant permissions', 'yellow');
    log('  4. Wait for "Logged in! You may close this page." message\n', 'yellow');

    execCommand('npx clasp login', 'Authenticating with Google');
  }

  // List all .gs files that will be uploaded
  log('\n4. Scanning files to upload...', 'bright');
  const gasDir = path.join(__dirname, '..', 'google-apps-script');
  const files = fs.readdirSync(gasDir).filter(f =>
    f.endsWith('.gs') || f === 'appsscript.json'
  );

  log(`Found ${files.length} files:`, 'blue');
  files.forEach(file => log(`  - ${file}`, 'blue'));

  // Push files to Google Apps Script
  log('\n5. Uploading files to Google Apps Script...', 'bright');
  log('This may take a few seconds...', 'yellow');

  try {
    execCommand('npx clasp push --force', 'Uploading all files');

    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║                  ✓ INSTALLATION SUCCESSFUL!               ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝\n', 'green');

    log('All files have been uploaded to Google Apps Script!', 'green');
    log('\nNext steps:', 'bright');
    log('  1. Open your Google Sheet', 'yellow');
    log('  2. Refresh the page (F5)', 'yellow');
    log('  3. Go to: Extensions → Apps Script', 'yellow');
    log('  4. Verify all files are there', 'yellow');
    log('  5. Run the function: installWAAS()', 'yellow');
    log('     - Click "Run" button (▶️)', 'yellow');
    log('     - Grant permissions when asked', 'yellow');
    log('  6. Return to Google Sheet - tabs should be created!', 'yellow');
    log('\nConfiguration:', 'bright');
    log('  Set Script Properties in Apps Script:', 'yellow');
    log('  - Project Settings → Script Properties → Add:', 'yellow');
    log('    • PA_API_ACCESS_KEY = your_amazon_api_key', 'yellow');
    log('    • PA_API_SECRET_KEY = your_amazon_secret', 'yellow');
    log('    • PA_API_PARTNER_TAG = your_associate_tag\n', 'yellow');

    // Open Apps Script in browser
    log('Opening Apps Script in browser...', 'blue');
    try {
      execSync(`npx clasp open`, { stdio: 'inherit' });
    } catch (error) {
      log('Note: Could not auto-open browser. Please open manually.', 'yellow');
    }

  } catch (error) {
    log('\n✗ Upload failed!', 'red');
    log('Error details:', 'red');
    log(error.message, 'red');
    log('\nTroubleshooting:', 'yellow');
    log('  1. Verify Script ID is correct', 'yellow');
    log('  2. Make sure you own this Google Sheet', 'yellow');
    log('  3. Try: npx clasp login --creds creds.json', 'yellow');
    log('  4. Check: https://script.google.com/home\n', 'yellow');
    process.exit(1);
  }
}

// Run the installer
main();
