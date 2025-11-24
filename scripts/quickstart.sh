#!/bin/bash

################################################################################
# WAAS 2.0 - Quick Start Menu
# Interaktywne menu instalacyjne
################################################################################

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
    ╔══════════════════════════════════════════════════════════════════╗
    ║                                                                  ║
    ║  ██╗    ██╗ █████╗  █████╗ ███████╗    ██████╗  ██████╗        ║
    ║  ██║    ██║██╔══██╗██╔══██╗██╔════╝    ╚════██╗██╔═████╗       ║
    ║  ██║ █╗ ██║███████║███████║███████╗     █████╔╝██║██╔██║       ║
    ║  ██║███╗██║██╔══██║██╔══██║╚════██║    ██╔═══╝ ████╔╝██║       ║
    ║  ╚███╔███╔╝██║  ██║██║  ██║███████║    ███████╗╚██████╔╝       ║
    ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝    ╚══════╝ ╚═════╝        ║
    ║                                                                  ║
    ║           WordPress Affiliate Automation System                 ║
    ║                    Quick Start Menu                             ║
    ║                                                                  ║
    ╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

show_menu() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  Wybierz opcję:                                               ${BLUE}║${NC}"
    echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}1${NC}) 🚀 Pełna instalacja (przygotuj wszystkie pakiety)      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}2${NC}) ✓  Weryfikacja projektu                                 ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}3${NC}) 📦 Tylko WordPress plugin (ZIP)                         ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}4${NC}) 📄 Tylko Google Apps Script                             ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}5${NC}) 📚 Pokaż instrukcje instalacji                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}6${NC}) 📖 Otwórz dokumentację                                  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}7${NC}) 🧪 Test połączenia z WordPress API                      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}8${NC}) 🔑 Pomoc z konfiguracją API keys                        ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}9${NC}) 📊 Statystyki projektu                                  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${RED}0${NC}) ❌ Wyjście                                               ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

run_full_install() {
    echo -e "\n${CYAN}═══ Uruchamiam pełną instalację ═══${NC}\n"
    ./scripts/install.sh
    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

run_verify() {
    echo -e "\n${CYAN}═══ Weryfikacja projektu ═══${NC}\n"
    ./scripts/verify-installation.sh
    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

create_wp_plugin_only() {
    echo -e "\n${CYAN}═══ Tworzenie pakietu WordPress ═══${NC}\n"
    mkdir -p dist
    cd wordpress-plugin
    zip -r ../dist/waas-product-manager.zip waas-product-manager/ -q
    cd ..
    echo -e "${GREEN}✓ Utworzono: dist/waas-product-manager.zip${NC}"
    ls -lh dist/waas-product-manager.zip
    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

create_gas_only() {
    echo -e "\n${CYAN}═══ Tworzenie Google Apps Script ═══${NC}\n"
    mkdir -p dist

    cat > dist/WAAS_Complete_Installer.gs << 'EOFGS'
/**
 * WAAS 2.0 - Complete Installer
 * Automatyczna instalacja całego systemu w Google Sheets
 */
EOFGS

    for file in google-apps-script/setup.gs google-apps-script/Core.gs google-apps-script/Menu.gs google-apps-script/WordPressAPI.gs google-apps-script/AmazonPA.gs google-apps-script/ProductManager.gs google-apps-script/TaskManager.gs google-apps-script/ContentGenerator.gs google-apps-script/DiviAPI.gs google-apps-script/SiteManager.gs; do
        if [ -f "$file" ]; then
            echo -e "\n\n// ===== $(basename $file) =====\n" >> dist/WAAS_Complete_Installer.gs
            cat "$file" >> dist/WAAS_Complete_Installer.gs
            echo -e "${GREEN}✓ Dodano: $(basename $file)${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}✓ Utworzono: dist/WAAS_Complete_Installer.gs${NC}"
    ls -lh dist/WAAS_Complete_Installer.gs
    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

show_instructions() {
    clear
    if [ -f "dist/INSTALL_INSTRUCTIONS.txt" ]; then
        cat dist/INSTALL_INSTRUCTIONS.txt | less
    else
        echo -e "${YELLOW}Plik instrukcji nie istnieje. Uruchom najpierw opcję 1.${NC}"
        sleep 2
    fi
}

show_docs() {
    echo -e "\n${CYAN}═══ Dostępna dokumentacja ═══${NC}\n"
    echo -e "${GREEN}Główne pliki dokumentacji:${NC}"
    echo ""
    echo "  1. README.md                    - Kompletna dokumentacja projektu"
    echo "  2. DEPLOYMENT_GUIDE.md          - Szczegółowy przewodnik wdrożenia"
    echo "  3. INSTALLATION_CHECKLIST.md    - Lista kontrolna instalacji"
    echo "  4. google-apps-script/README.md - Dokumentacja Google Apps Script"
    echo ""
    echo -e "${BLUE}Otwórz plik w edytorze tekstu lub przeglądarce Markdown.${NC}"
    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

test_wp_api() {
    echo -e "\n${CYAN}═══ Test połączenia z WordPress API ═══${NC}\n"

    read -p "Podaj URL WordPress (np. https://example.com): " WP_URL
    read -p "Podaj API Key: " API_KEY

    echo ""
    echo -e "${YELLOW}Testuję połączenie...${NC}"
    echo ""

    RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        "${WP_URL}/wp-json/waas/v1/products/list" \
        -H "X-API-Key: ${API_KEY}")

    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Połączenie udane!${NC}"
        echo "$RESPONSE" | sed '/HTTP_CODE:/d' | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${RED}✗ Błąd połączenia (HTTP $HTTP_CODE)${NC}"
        echo "$RESPONSE" | sed '/HTTP_CODE:/d'
    fi

    echo ""
    read -p "Naciśnij ENTER aby wrócić do menu..."
}

show_api_help() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════╗
║  KONFIGURACJA API KEYS - POMOC                                        ║
╚═══════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"

    echo -e "${GREEN}1. Amazon PA-API Credentials${NC}"
    echo ""
    echo "   Gdzie je uzyskać:"
    echo "   → https://affiliate-program.amazon.com/assoc_credentials/home"
    echo ""
    echo "   Potrzebujesz:"
    echo "   • Access Key (20 znaków, np. AKIAIOSFODNN7EXAMPLE)"
    echo "   • Secret Key (40 znaków)"
    echo "   • Associate Tag (np. yoursite-20)"
    echo ""
    echo "   Gdzie je wpisać:"
    echo "   → WordPress: WAAS Products → Settings → Amazon API"
    echo "   → Google Apps Script: Project Settings → Script Properties"
    echo "     - PA_API_ACCESS_KEY (global)"
    echo "     - PA_API_SECRET_KEY (global)"
    echo "     - PA_API_PARTNER_TAG jest per-site w zakładce Sites!"
    echo ""

    echo -e "${GREEN}2. Divi API Key (per-site!)${NC}"
    echo ""
    echo "   Gdzie je uzyskać:"
    echo "   → https://www.elegantthemes.com/members-area/api/"
    echo ""
    echo "   Każda strona potrzebuje własnego klucza!"
    echo "   • Kliknij: Add New API Key"
    echo "   • Nazwa: [nazwa twojej strony]"
    echo "   • Skopiuj 40-znakowy klucz hex"
    echo ""
    echo "   Gdzie je wpisać:"
    echo "   → Google Sheets: Zakładka Sites → Kolumna H"
    echo "     (DIVI_API_KEY jest UNIKALNY dla każdej strony!)"
    echo ""

    echo -e "${GREEN}3. WordPress API Key${NC}"
    echo ""
    echo "   To jest klucz wymyślony przez Ciebie (np. waas-api-domena-2025)"
    echo ""
    echo "   Gdzie je wpisać:"
    echo "   → WordPress: WAAS Products → Settings → Google Sheets API Key"
    echo "   → Google Sheets: Zakładka Sites → Kolumna G"
    echo ""
    echo "   ⚠️  MUSZĄ BYĆ IDENTYCZNE w obu miejscach!"
    echo ""

    echo -e "${YELLOW}⚠️  WAAS 2.0 Architecture (KRYTYCZNE!):${NC}"
    echo ""
    echo "   GLOBALNE (Script Properties):"
    echo "   ✓ PA_API_ACCESS_KEY"
    echo "   ✓ PA_API_SECRET_KEY"
    echo "   ✓ DIVI_API_USERNAME"
    echo ""
    echo "   PER-SITE (Zakładka Sites):"
    echo "   ✓ Kolumna G: WP_API_KEY (unikalny dla strony)"
    echo "   ✓ Kolumna H: DIVI_API_KEY (unikalny dla strony)"
    echo "   ✓ Kolumna I: Amazon Associate Tag (unikalny dla strony)"
    echo ""

    read -p "Naciśnij ENTER aby wrócić do menu..."
}

show_stats() {
    echo -e "\n${CYAN}═══ Statystyki projektu ═══${NC}\n"

    echo -e "${GREEN}Struktura plików:${NC}"
    echo ""

    if [ -d "wordpress-plugin/waas-product-manager" ]; then
        WP_FILES=$(find wordpress-plugin/waas-product-manager -type f | wc -l)
        WP_PHP=$(find wordpress-plugin/waas-product-manager -name "*.php" | wc -l)
        WP_SIZE=$(du -sh wordpress-plugin/waas-product-manager | cut -f1)
        echo "  WordPress Plugin:"
        echo "    • Pliki: $WP_FILES"
        echo "    • PHP: $WP_PHP"
        echo "    • Rozmiar: $WP_SIZE"
        echo ""
    fi

    if [ -d "google-apps-script" ]; then
        GAS_FILES=$(find google-apps-script -name "*.gs" | wc -l)
        GAS_SIZE=$(du -sh google-apps-script | cut -f1)
        echo "  Google Apps Script:"
        echo "    • Pliki .gs: $GAS_FILES"
        echo "    • Rozmiar: $GAS_SIZE"
        echo ""
    fi

    if [ -d "dist" ]; then
        echo "  Pakiety instalacyjne (dist/):"
        ls -lh dist/ 2>/dev/null | tail -n +2 | awk '{print "    • " $9 " (" $5 ")"}'
        echo ""
    fi

    echo -e "${GREEN}Dokumentacja:${NC}"
    echo ""
    wc -l README.md DEPLOYMENT_GUIDE.md INSTALLATION_CHECKLIST.md 2>/dev/null | \
        awk '{if(NF>1) print "    • " $2 " (" $1 " linii)"}'
    echo ""

    echo -e "${GREEN}Stan repozytorium Git:${NC}"
    echo ""
    git branch --show-current 2>/dev/null && echo "    • Branch: $(git branch --show-current)"
    git log -1 --oneline 2>/dev/null | sed 's/^/    • Last commit: /'
    echo ""

    read -p "Naciśnij ENTER aby wrócić do menu..."
}

# Główna pętla
while true; do
    show_banner
    show_menu
    read -p "Wybierz opcję [0-9]: " choice

    case $choice in
        1) run_full_install ;;
        2) run_verify ;;
        3) create_wp_plugin_only ;;
        4) create_gas_only ;;
        5) show_instructions ;;
        6) show_docs ;;
        7) test_wp_api ;;
        8) show_api_help ;;
        9) show_stats ;;
        0)
            echo -e "\n${GREEN}Dziękuję za użycie WAAS 2.0!${NC}"
            echo -e "${BLUE}Powodzenia z Twoją stroną afiliacyjną! 🚀${NC}\n"
            exit 0
            ;;
        *)
            echo -e "\n${RED}Nieprawidłowa opcja. Spróbuj ponownie.${NC}"
            sleep 2
            ;;
    esac
done
