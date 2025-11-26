#!/bin/bash

# Example script - Install WAAS plugins on a WordPress site
# Edit the variables below with your site details

WP_URL="https://passgenaue-lkw-fussmatten.lk24.shop"
WP_USERNAME="netanaliza"
WP_APP_PASSWORD="tQEL QZyV ZcvT 3tPn OV1E FBQ1"

# Plugin URLs (update these to your actual hosting location)
PRODUCT_MANAGER_URL="https://lk24.shop/downloads/waas-product-manager.zip"
PATRONAGE_MANAGER_URL="https://lk24.shop/downloads/waas-patronage-manager.zip"

echo "=========================================="
echo "LUKO-WAAS Plugin Installation Example"
echo "=========================================="
echo ""
echo "Site: $WP_URL"
echo ""

# Install Product Manager
echo "Installing WAAS Product Manager..."
node scripts/automate-plugin-installation.js \
  "$WP_URL" \
  "$WP_USERNAME" \
  "$WP_APP_PASSWORD" \
  "$PRODUCT_MANAGER_URL"

echo ""
echo "Press Enter to continue with Patronage Manager..."
read

# Install Patronage Manager
echo "Installing WAAS Patronage Manager..."
node scripts/automate-plugin-installation.js \
  "$WP_URL" \
  "$WP_USERNAME" \
  "$WP_APP_PASSWORD" \
  "$PATRONAGE_MANAGER_URL"

echo ""
echo "=========================================="
echo "Installation complete!"
echo "=========================================="
