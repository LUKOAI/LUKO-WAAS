#!/bin/bash

################################################################################
# WAAS 2.0 - Automatyczny skrypt instalacyjny
# Automatyzuje instalację WordPress Affiliate Automation System
################################################################################

set -e  # Exit on error

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcje pomocnicze
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

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 nie jest zainstalowany!"
        return 1
    else
        print_success "$1 jest zainstalowany"
        return 0
    fi
}

# Banner
clear
echo -e "${BLUE}"
cat << "EOF"
╦ ╦╔═╗╔═╗╔═╗  ╔═╗ ╔═╗
║║║╠═╣╠═╣╚═╗  ║═╝ ║ ║
╚╩╝╩ ╩╩ ╩╚═╝  ╚   ╚═╝

WordPress Affiliate Automation System
Automatyczny Instalator v2.0
EOF
echo -e "${NC}"

print_header "KROK 1: Sprawdzanie wymagań"

# Sprawdź wymagane narzędzia
ALL_OK=true

print_info "Sprawdzam wymagane narzędzia..."
check_command "curl" || ALL_OK=false
check_command "zip" || ALL_OK=false
check_command "git" || ALL_OK=false

if [ "$ALL_OK" = false ]; then
    print_error "Nie wszystkie wymagane narzędzia są zainstalowane!"
    echo -e "\nZainstaluj brakujące narzędzia:"
    echo "  Ubuntu/Debian: sudo apt-get install curl zip git"
    echo "  MacOS: brew install curl zip git"
    exit 1
fi

print_success "Wszystkie wymagane narzędzia są zainstalowane!"

# Sprawdź czy jesteśmy w głównym katalogu projektu
if [ ! -f "README.md" ] || [ ! -d "wordpress-plugin" ]; then
    print_error "Uruchom skrypt z głównego katalogu projektu LUKO-WAAS!"
    exit 1
fi

print_success "Katalog projektu OK"

print_header "KROK 2: Tworzenie pakietów WordPress"

# Utwórz folder dist jeśli nie istnieje
mkdir -p dist

print_info "Pakuję WordPress plugin: waas-product-manager..."
cd wordpress-plugin
if [ -d "waas-product-manager" ]; then
    zip -r ../dist/waas-product-manager.zip waas-product-manager/ -q
    print_success "waas-product-manager.zip utworzony"
else
    print_error "Folder waas-product-manager nie istnieje!"
    exit 1
fi
cd ..

print_header "KROK 3: Przygotowanie Google Apps Script"

print_info "Tworzę pełny plik instalacyjny Google Apps Script..."

# Utwórz jeden plik zawierający wszystkie moduły
cat > dist/WAAS_Complete_Installer.gs << 'EOFGS'
/**
 * WAAS 2.0 - Complete Installer
 * Automatyczna instalacja całego systemu w Google Sheets
 *
 * INSTRUKCJA:
 * 1. Otwórz: https://script.google.com
 * 2. Nowy projekt
 * 3. Skopiuj całość tego pliku
 * 4. Uruchom funkcję: installWAAS()
 * 5. Autoryzuj dostęp
 * 6. Poczekaj 30-60 sekund
 */

EOFGS

# Dodaj zawartość setup.gs
if [ -f "google-apps-script/setup.gs" ]; then
    cat google-apps-script/setup.gs >> dist/WAAS_Complete_Installer.gs
    print_success "Dodano setup.gs"
fi

# Dodaj pozostałe moduły
for file in google-apps-script/Core.gs google-apps-script/Menu.gs google-apps-script/WordPressAPI.gs google-apps-script/AmazonPA.gs google-apps-script/ProductManager.gs google-apps-script/TaskManager.gs google-apps-script/ContentGenerator.gs google-apps-script/DiviAPI.gs google-apps-script/SiteManager.gs; do
    if [ -f "$file" ]; then
        echo -e "\n\n// ===== $(basename $file) =====\n" >> dist/WAAS_Complete_Installer.gs
        cat "$file" >> dist/WAAS_Complete_Installer.gs
        print_success "Dodano $(basename $file)"
    fi
done

print_header "KROK 4: Generowanie plików konfiguracyjnych"

# Generuj .env z przykładu
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    print_info "Tworzę plik .env z .env.example..."
    cp .env.example .env
    print_warning "WAŻNE: Edytuj plik .env i dodaj swoje klucze API!"
else
    print_info "Plik .env już istnieje, pomijam..."
fi

# Generuj plik z instrukcjami
cat > dist/INSTALL_INSTRUCTIONS.txt << 'EOF'
╔════════════════════════════════════════════════════════════════════════╗
║  WAAS 2.0 - INSTRUKCJA INSTALACJI                                     ║
║  WordPress Affiliate Automation System                                ║
╚════════════════════════════════════════════════════════════════════════╝

📦 ZAWARTOŚĆ PAKIETU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ waas-product-manager.zip    - Plugin WordPress
✓ WAAS_Complete_Installer.gs  - Instalator Google Apps Script
✓ INSTALL_INSTRUCTIONS.txt    - Ten plik


🚀 INSTALACJA KROK PO KROKU (10 minut)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 1: WORDPRESS PLUGIN (2 min)                                   │
└─────────────────────────────────────────────────────────────────────┘

1. Zaloguj się do WordPress Admin
2. Przejdź do: Wtyczki → Dodaj nową → Prześlij wtyczkę
3. Wybierz plik: waas-product-manager.zip
4. Kliknij: Zainstaluj
5. Kliknij: Aktywuj wtyczkę
6. Sprawdź czy w menu pojawił się: "WAAS Products" ✓

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 2: AMAZON PA-API CREDENTIALS (2 min)                          │
└─────────────────────────────────────────────────────────────────────┘

1. Wejdź na: https://affiliate-program.amazon.com/assoc_credentials/home
2. Zaloguj się do Amazon Associates
3. Skopiuj dane:
   • Access Key (20 znaków)
   • Secret Key (40 znaków)
   • Associate Tag (np. yoursite-20)

4. W WordPress:
   • Przejdź do: WAAS Products → Settings → Amazon API
   • Wklej: Access Key, Secret Key, Associate Tag
   • Wybierz region: us-east-1 (dla USA)
   • Kliknij: Save Settings
   • Kliknij: Test API Connection → powinno być ✓

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 3: GOOGLE APPS SCRIPT (3 min)                                 │
└─────────────────────────────────────────────────────────────────────┘

1. Otwórz: https://script.google.com
2. Kliknij: Nowy projekt
3. Otwórz plik: WAAS_Complete_Installer.gs
4. Skopiuj CAŁĄ zawartość pliku (Ctrl+A, Ctrl+C)
5. Wklej do Google Apps Script (Ctrl+V)
6. Zapisz projekt (Ctrl+S), nazwij: "WAAS System"
7. W górnym menu wybierz funkcję: installWAAS
8. Kliknij: ▶ Uruchom
9. Zaakceptuj autoryzację Google (popup)
10. Poczekaj 30-60 sekund

Po zakończeniu:
✓ Utworzy się nowy arkusz: AmazonAffiliateProductsDashboard
✓ Arkusz otworzy się automatycznie
✓ W menu pojawi się: ⚡ WAAS

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 4: KONFIGURACJA SCRIPT PROPERTIES (2 min)                     │
└─────────────────────────────────────────────────────────────────────┘

⚠️ WAŻNE: Tylko parametry GLOBALNE! Per-site są w zakładce Sites!

1. W Google Apps Script:
   • Kliknij: ⚙️ Project Settings (lewy panel)
   • Przewiń do: Script Properties
   • Kliknij: Add script property

2. Dodaj GLOBALNE klucze:

   Property name:       PA_API_ACCESS_KEY
   Value:               [Twój Amazon Access Key]

   Property name:       PA_API_SECRET_KEY
   Value:               [Twój Amazon Secret Key]

   Property name:       DIVI_API_USERNAME
   Value:               netanaliza

3. Kliknij: Save script properties

⚠️ NIE DODAWAJ TYCH (są per-site w zakładce Sites!):
   ✗ DIVI_API_KEY - per-site!
   ✗ PA_API_PARTNER_TAG - per-site jako Amazon Associate Tag!

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 5: KONFIGURACJA ZAKŁADKI SITES (KRYTYCZNE!) (2 min)          │
└─────────────────────────────────────────────────────────────────────┘

⚠️ WAAS 2.0: Każda strona ma własne Divi API Key i Amazon Tag!

1. Otwórz arkusz: AmazonAffiliateProductsDashboard
2. Przejdź do karty: Sites
3. W rzędzie 2 dodaj swoją pierwszą stronę:

   A2: 1                                    (ID)
   B2: [Nazwa strony]                       (np. "Moja strona")
   C2: [Domena]                             (np. "example.com")
   D2: [WordPress URL]                      (https://example.com)
   E2: [Admin Username]                     (np. "admin")
   F2: [Admin Password]                     (hasło WordPress)
   G2: waas-api-[domena]-2025              (WP API Key - wymyśl własny!)
   H2: [DIVI API KEY - 40 znaków HEX]      ← KRYTYCZNE!
   I2: [Amazon Associate Tag]               (np. "yoursite-21")
   J2: pending                              (Status)
   K2: FALSE                                (Divi Installed)
   L2: FALSE                                (Plugin Installed)
   M2: [puste]                              (Last Check)

4. Jak uzyskać Divi API Key (kolumna H2):
   • Wejdź: https://www.elegantthemes.com/members-area/api/
   • Kliknij: Add New API Key
   • Wpisz nazwę: [nazwa twojej strony]
   • Kliknij: Generate API Key
   • Skopiuj 40-znakowy klucz (np. c12d038b32b1f2356c705ede89bf188b0abf6a51)
   • Wklej do kolumny H2

⚠️ KAŻDA strona MUSI mieć własny, unikalny Divi API Key!

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 6: POŁĄCZENIE SHEETS ↔ WORDPRESS (1 min)                     │
└─────────────────────────────────────────────────────────────────────┘

1. W WordPress:
   • WAAS Products → Settings → Google Sheets
   • Google Sheets API Key: [Wpisz: waas-api-[domena]-2025]
     ⚠️ MUSI BYĆ TEN SAM co w kolumnie G2 w Sites!
   • Save Settings

2. Test połączenia:
   • W Google Sheets: Menu ⚡ WAAS → 🧪 Test połączenia
   • Powinno pokazać: ✅ Połączono z WordPress!

┌─────────────────────────────────────────────────────────────────────┐
│ CZĘŚĆ 7: TEST - IMPORT PRODUKTU (2 min)                            │
└─────────────────────────────────────────────────────────────────────┘

1. W Google Sheets:
   • Przejdź do karty: Products
   • A2: B08N5WRWNW                         (testowy ASIN)
   • E2: electronics                        (kategoria)
   • Menu: ⚡ WAAS → 📥 Import produktów do WordPress
   • Poczekaj 10-20 sekund

2. Sprawdź w WordPress:
   • WAAS Products → All Products
   • Powinien być: "Apple AirPods Pro..." ✓

3. Test shortcode:
   • Pages → Add New
   • Dodaj: [waas_product asin="B08N5WRWNW"]
   • Publish → View Page
   • Powinno wyświetlić produkt z ceną i przyciskiem ✓


🎉 GOTOWE! SYSTEM DZIAŁA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jeśli wszystkie testy przeszły pomyślnie, możesz zacząć używać systemu!


📚 DALSZE KROKI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Dodaj więcej ASINów w karcie Products
✓ Importuj produkty przez menu WAAS
✓ Używaj shortcodów w postach/stronach:
  • [waas_product asin="B08N5WRWNW"]
  • [waas_grid asins="B08N5WRWNW,B07XJ8C8F5" columns="2"]
  • [waas_category category="electronics" items="12"]

✓ Skonfiguruj automatyczną synchronizację (cron już działa!)
✓ Monitoruj logi w karcie Logs
✓ Sprawdzaj Analytics


❓ PROBLEMY?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Unauthorized" w Google Sheets:
→ Sprawdź czy API Key w Sites (G2) = API Key w WordPress Settings

"Invalid credentials" Amazon:
→ Sprawdź Access Key i Secret Key w WordPress Settings

Produkt nie importuje się:
→ Sprawdź ASIN (10 znaków), region (us-east-1)

Menu WAAS nie wyświetla się:
→ Zamknij i otwórz arkusz ponownie (Ctrl+R)


📖 DOKUMENTACJA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pełna dokumentacja: README.md
Deployment guide: DEPLOYMENT_GUIDE.md
Installation checklist: INSTALLATION_CHECKLIST.md

GitHub: https://github.com/LUKOAI/LUKO-WAAS
Support: support@luko.ai


╔════════════════════════════════════════════════════════════════════════╗
║  WAAS 2.0 - WordPress Affiliate Automation System                     ║
║  © 2025 LUKO AI Team                                                   ║
║  Powodzenia z Twoją stroną afiliacyjną! 🚀                            ║
╚════════════════════════════════════════════════════════════════════════╝
EOF

print_success "Instrukcje wygenerowane"

print_header "KROK 5: Podsumowanie"

print_success "✓ Wszystkie pliki przygotowane!"
echo ""
print_info "Utworzone pliki w folderze 'dist/':"
echo ""
ls -lh dist/ | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
echo ""

print_header "CO DALEJ?"

echo -e "${GREEN}Pakiety są gotowe do instalacji!${NC}\n"
echo -e "1. Folder: ${BLUE}dist/${NC} zawiera wszystkie potrzebne pliki"
echo -e "2. Otwórz: ${BLUE}dist/INSTALL_INSTRUCTIONS.txt${NC} i postępuj zgodnie z instrukcjami"
echo -e "3. Upload: ${BLUE}dist/waas-product-manager.zip${NC} do WordPress"
echo -e "4. Otwórz: ${BLUE}dist/WAAS_Complete_Installer.gs${NC} w Google Apps Script"
echo ""

print_warning "⚠  WAŻNE: Pamiętaj o skonfigurowaniu Amazon PA-API credentials!"
print_warning "⚠  WAŻNE: Każda strona potrzebuje własnego Divi API Key w zakładce Sites!"
echo ""

print_success "🎉 Instalator zakończony pomyślnie!"
echo ""
