#!/bin/bash

##############################################################################
# LUKO WAAS - Quick Installation Script
#
# This script automates the entire installation process to Google Apps Script
# NO MANUAL COPYING REQUIRED!
#
# Usage:
#   ./scripts/install.sh <SCRIPT_ID>
#
# Example:
#   ./scripts/install.sh 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0
##############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     LUKO WAAS - Quick Installation to Google Apps Script  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Script ID provided
if [ -z "$1" ]; then
    echo -e "${RED}ERROR: Script ID not provided!${NC}\n"
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  ./scripts/install.sh <SCRIPT_ID>"
    echo ""
    echo -e "${YELLOW}How to get Script ID:${NC}"
    echo "  1. Open your Google Sheet"
    echo "  2. Go to: Extensions → Apps Script"
    echo "  3. Click: Project Settings (⚙️)"
    echo "  4. Copy: Script ID"
    echo ""
    exit 1
fi

SCRIPT_ID=$1

echo -e "${BLUE}➤ Script ID: ${SCRIPT_ID}${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed!${NC}"
    echo -e "${YELLOW}Please install Node.js from: https://nodejs.org/${NC}\n"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed!${NC}"
    echo -e "${YELLOW}Please install npm${NC}\n"
    exit 1
fi

echo -e "${GREEN}✓ npm found: $(npm --version)${NC}\n"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}➤ Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}\n"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}\n"
fi

# Run the Node.js installer
echo -e "${BLUE}➤ Running automated installer...${NC}\n"
node scripts/install-to-google.js "$SCRIPT_ID"

echo -e "\n${GREEN}${BOLD}Installation complete!${NC}"
echo -e "${YELLOW}Next: Open Google Sheet → Refresh → Run installWAAS()${NC}\n"
