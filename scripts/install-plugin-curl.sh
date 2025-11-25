#!/bin/bash

# LUKO WAAS - Plugin Installation via cURL
# This script installs WordPress plugins using pure HTTP requests
# Bypasses bot detection by using regular HTTP client

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ "$#" -lt 4 ]; then
    echo "Usage: $0 <WP_URL> <USERNAME> <PASSWORD> <PLUGIN_ZIP_URL>"
    echo ""
    echo "Example:"
    echo "  $0 https://example.com admin 'MyPassword123' https://example.com/plugin.zip"
    exit 1
fi

WP_URL="$1"
USERNAME="$2"
PASSWORD="$3"
PLUGIN_ZIP_URL="$4"

COOKIE_JAR=$(mktemp)
TEMP_DIR=$(mktemp -d)
PLUGIN_ZIP="$TEMP_DIR/plugin.zip"

cleanup() {
    rm -f "$COOKIE_JAR" 2>/dev/null || true
    rm -rf "$TEMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}LUKO WAAS - Plugin Installation via cURL${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "WordPress URL: ${YELLOW}$WP_URL${NC}"
echo -e "Username: ${YELLOW}$USERNAME${NC}"
echo -e "Plugin ZIP: ${YELLOW}$PLUGIN_ZIP_URL${NC}"
echo ""

# Step 1: Get login page to get cookies and nonce
echo -e "${BLUE}Step 1: Getting login page...${NC}"
LOGIN_PAGE=$(curl -sS -k -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
    -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
    "${WP_URL}/wp-login.php" 2>&1)

if echo "$LOGIN_PAGE" | grep -q "403 Forbidden\|Access denied\|Zugriff verweigert"; then
    echo -e "${RED}Error: Access to login page blocked (403 Forbidden)${NC}"
    echo -e "${YELLOW}The server firewall is blocking automated requests.${NC}"
    echo -e "${YELLOW}You may need to whitelist this IP or disable bot protection.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Login page retrieved${NC}"

# Step 2: Login to WordPress
echo -e "${BLUE}Step 2: Logging in to WordPress...${NC}"

LOGIN_RESULT=$(curl -sS -k -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
    -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Referer: ${WP_URL}/wp-login.php" \
    -L \
    --data-urlencode "log=$USERNAME" \
    --data-urlencode "pwd=$PASSWORD" \
    --data-urlencode "wp-submit=Log In" \
    --data-urlencode "redirect_to=${WP_URL}/wp-admin/" \
    --data-urlencode "testcookie=1" \
    "${WP_URL}/wp-login.php" 2>&1)

# Check if login was successful by looking for admin elements
if echo "$LOGIN_RESULT" | grep -q "dashboard\|wp-admin\|Dashboard\|adminmenu"; then
    echo -e "${GREEN}✓ Login successful${NC}"
elif echo "$LOGIN_RESULT" | grep -q "login_error\|incorrect\|Invalid\|ERROR"; then
    echo -e "${RED}✗ Login failed - invalid credentials${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠ Login status unclear, continuing...${NC}"
fi

# Step 3: Download plugin ZIP
echo -e "${BLUE}Step 3: Downloading plugin ZIP...${NC}"
curl -sS -k -L -o "$PLUGIN_ZIP" "$PLUGIN_ZIP_URL"

if [ ! -f "$PLUGIN_ZIP" ] || [ ! -s "$PLUGIN_ZIP" ]; then
    echo -e "${RED}✗ Failed to download plugin ZIP${NC}"
    exit 1
fi

PLUGIN_SIZE=$(stat -c%s "$PLUGIN_ZIP" 2>/dev/null || stat -f%z "$PLUGIN_ZIP" 2>/dev/null)
echo -e "${GREEN}✓ Plugin downloaded (${PLUGIN_SIZE} bytes)${NC}"

# Step 4: Get plugin upload page to get nonce
echo -e "${BLUE}Step 4: Getting plugin upload page...${NC}"

UPLOAD_PAGE=$(curl -sS -k -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
    -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
    -H "Referer: ${WP_URL}/wp-admin/" \
    "${WP_URL}/wp-admin/plugin-install.php?tab=upload" 2>&1)

# Extract nonce
NONCE=$(echo "$UPLOAD_PAGE" | grep -oP '_wpnonce["\x27]\s*value=["\x27]\K[a-zA-Z0-9]+' | head -1)

if [ -z "$NONCE" ]; then
    # Try alternative pattern
    NONCE=$(echo "$UPLOAD_PAGE" | grep -oP 'name="_wpnonce"\s+value="[^"]+' | head -1 | grep -oP 'value="\K[^"]+')
fi

if [ -z "$NONCE" ]; then
    # Try yet another pattern
    NONCE=$(echo "$UPLOAD_PAGE" | grep -oP '_wpnonce=\K[a-zA-Z0-9]+' | head -1)
fi

if [ -z "$NONCE" ]; then
    echo -e "${RED}✗ Could not find security nonce - login may have failed${NC}"
    echo -e "${YELLOW}Debug: Saving page content to /tmp/upload_page_debug.html${NC}"
    echo "$UPLOAD_PAGE" > /tmp/upload_page_debug.html
    exit 1
fi

echo -e "${GREEN}✓ Got nonce: ${NONCE}${NC}"

# Step 5: Upload and install plugin
echo -e "${BLUE}Step 5: Uploading and installing plugin...${NC}"

INSTALL_RESULT=$(curl -sS -k -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
    -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
    -H "Referer: ${WP_URL}/wp-admin/plugin-install.php?tab=upload" \
    -F "pluginzip=@${PLUGIN_ZIP};type=application/zip" \
    -F "_wpnonce=${NONCE}" \
    -F "_wp_http_referer=/wp-admin/plugin-install.php?tab=upload" \
    -F "install-plugin-submit=Install Now" \
    "${WP_URL}/wp-admin/update.php?action=upload-plugin" 2>&1)

# Check installation result
if echo "$INSTALL_RESULT" | grep -qi "successfully installed\|Plugin installed successfully"; then
    echo -e "${GREEN}✓ Plugin installed successfully!${NC}"

    # Try to extract activation link
    ACTIVATE_URL=$(echo "$INSTALL_RESULT" | grep -oP 'href="[^"]*action=activate[^"]*"' | head -1 | sed 's/href="//;s/"$//' | sed 's/&amp;/\&/g')

    if [ -n "$ACTIVATE_URL" ]; then
        echo -e "${BLUE}Step 6: Activating plugin...${NC}"

        # Make relative URL absolute
        if [[ "$ACTIVATE_URL" != http* ]]; then
            ACTIVATE_URL="${WP_URL}${ACTIVATE_URL}"
        fi

        ACTIVATE_RESULT=$(curl -sS -k -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
            -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
            -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
            -H "Accept-Language: de-DE,de;q=0.9,en;q=0.8" \
            -L \
            "$ACTIVATE_URL" 2>&1)

        if echo "$ACTIVATE_RESULT" | grep -qi "Plugin activated\|activated successfully"; then
            echo -e "${GREEN}✓ Plugin activated successfully!${NC}"
        else
            echo -e "${YELLOW}⚠ Activation status unclear${NC}"
        fi
    fi

elif echo "$INSTALL_RESULT" | grep -qi "already exists\|already installed"; then
    echo -e "${YELLOW}⚠ Plugin already installed${NC}"

elif echo "$INSTALL_RESULT" | grep -qi "error\|failed"; then
    echo -e "${RED}✗ Installation failed${NC}"
    echo -e "${YELLOW}Debug: Saving result to /tmp/install_result_debug.html${NC}"
    echo "$INSTALL_RESULT" > /tmp/install_result_debug.html
    exit 1
else
    echo -e "${YELLOW}⚠ Installation result unclear${NC}"
    echo -e "${YELLOW}Debug: Saving result to /tmp/install_result_debug.html${NC}"
    echo "$INSTALL_RESULT" > /tmp/install_result_debug.html
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}============================================================${NC}"
