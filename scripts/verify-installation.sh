#!/bin/bash

################################################################################
# WAAS 2.0 - Skrypt weryfikacji instalacji
# Sprawdza czy wszystkie komponenty są poprawnie skonfigurowane
################################################################################

set -e

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_file() {
    if [ -f "$1" ]; then
        print_success "Plik istnieje: $1"
        return 0
    else
        print_error "Brak pliku: $1"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        print_success "Katalog istnieje: $1"
        return 0
    else
        print_error "Brak katalogu: $1"
        return 1
    fi
}

clear
echo -e "${BLUE}"
cat << "EOF"
╦ ╦╔═╗╔═╗╔═╗  ╦  ╦╔═╗╦═╗╦╔═╗╦╔═╗╦═╗
║║║╠═╣╠═╣╚═╗  ╚╗╔╝║╣ ╠╦╝║╠╣ ║║╣ ╠╦╝
╚╩╝╩ ╩╩ ╩╚═╝   ╚╝ ╚═╝╩╚═╩╚  ╩╚═╝╩╚═

Installation Verification Tool
EOF
echo -e "${NC}"

ALL_OK=true

print_header "Weryfikacja struktury projektu"

# Sprawdź główne katalogi
check_dir "wordpress-plugin/waas-product-manager" || ALL_OK=false
check_dir "google-apps-script" || ALL_OK=false
check_dir "scripts" || ALL_OK=false

print_header "Weryfikacja plików WordPress Plugin"

check_file "wordpress-plugin/waas-product-manager/waas-product-manager.php" || ALL_OK=false
check_file "wordpress-plugin/waas-product-manager/includes/class-amazon-api.php" || ALL_OK=false
check_file "wordpress-plugin/waas-product-manager/includes/class-product-post-type.php" || ALL_OK=false
check_file "wordpress-plugin/waas-product-manager/includes/class-rest-api.php" || ALL_OK=false

print_header "Weryfikacja plików Google Apps Script"

check_file "google-apps-script/setup.gs" || ALL_OK=false
check_file "google-apps-script/Core.gs" || ALL_OK=false
check_file "google-apps-script/Menu.gs" || ALL_OK=false
check_file "google-apps-script/WordPressAPI.gs" || ALL_OK=false
check_file "google-apps-script/AmazonPA.gs" || ALL_OK=false
check_file "google-apps-script/ProductManager.gs" || ALL_OK=false
check_file "google-apps-script/SiteManager.gs" || ALL_OK=false

print_header "Weryfikacja dokumentacji"

check_file "README.md" || ALL_OK=false
check_file "DEPLOYMENT_GUIDE.md" || ALL_OK=false
check_file "INSTALLATION_CHECKLIST.md" || ALL_OK=false

print_header "Weryfikacja pakietów instalacyjnych"

if [ -d "dist" ]; then
    print_success "Katalog dist/ istnieje"

    if [ -f "dist/waas-product-manager.zip" ]; then
        SIZE=$(du -h dist/waas-product-manager.zip | cut -f1)
        print_success "waas-product-manager.zip ($SIZE)"
    else
        print_warning "Brak dist/waas-product-manager.zip - uruchom ./scripts/install.sh"
        ALL_OK=false
    fi

    if [ -f "dist/WAAS_Complete_Installer.gs" ]; then
        SIZE=$(du -h dist/WAAS_Complete_Installer.gs | cut -f1)
        print_success "WAAS_Complete_Installer.gs ($SIZE)"
    else
        print_warning "Brak dist/WAAS_Complete_Installer.gs - uruchom ./scripts/install.sh"
        ALL_OK=false
    fi
else
    print_warning "Katalog dist/ nie istnieje - uruchom ./scripts/install.sh"
    ALL_OK=false
fi

print_header "Weryfikacja konfiguracji"

if [ -f ".env" ]; then
    print_success "Plik .env istnieje"

    # Sprawdź czy .env zawiera przykładowe wartości
    if grep -q "your-access-key-here" .env 2>/dev/null; then
        print_warning ".env zawiera przykładowe wartości - zaktualizuj swoje klucze!"
    fi
else
    print_warning "Brak pliku .env - skopiuj z .env.example"
fi

print_header "Podsumowanie"

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}"
    cat << "EOF"
    ╔═══════════════════════════════════════════╗
    ║  ✓ WSZYSTKO OK!                           ║
    ║  Projekt jest gotowy do instalacji        ║
    ╚═══════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    print_info "Następne kroki:"
    echo ""
    echo "  1. Jeśli nie ma katalogu dist/, uruchom:"
    echo "     ${BLUE}./scripts/install.sh${NC}"
    echo ""
    echo "  2. Postępuj zgodnie z instrukcjami w:"
    echo "     ${BLUE}dist/INSTALL_INSTRUCTIONS.txt${NC}"
    echo ""
else
    echo -e "${RED}"
    cat << "EOF"
    ╔═══════════════════════════════════════════╗
    ║  ✗ ZNALEZIONO PROBLEMY                    ║
    ║  Sprawdź powyższe błędy                   ║
    ╚═══════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    print_warning "Napraw powyższe problemy przed instalacją"
    echo ""
    exit 1
fi
