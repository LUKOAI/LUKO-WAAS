# 🚀 WAAS - WordPress Affiliate Automation System
## Complete Amazon Affiliate Site Framework with Google Sheets Integration

[![WordPress](https://img.shields.io/badge/WordPress-5.8%2B-blue.svg)](https://wordpress.org/)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-purple.svg)](https://php.net/)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-green.svg)](https://developers.google.com/apps-script)
[![License](https://img.shields.io/badge/License-GPL%20v2-red.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

---

## 📋 Spis Treści

- [O Projekcie](#-o-projekcie)
- [Funkcje](#-funkcje)
- [Konkretne Nazwy](#-konkretne-nazwy---wszystko-czego-potrzebujesz)
- [Wymagania](#-wymagania)
- [Instalacja](#-instalacja)
- [Konfiguracja](#-konfiguracja)
- [Użycie](#-użycie)
- [Shortcodes](#-shortcodes)
- [Google Sheets Integration](#-google-sheets-integration)
- [FAQ](#-faq)
- [Wsparcie](#-wsparcie)

---

## 🎯 O Projekcie

**WAAS** to kompleksowy system automatyzacji dla stron afiliacyjnych Amazon. Łączy w sobie:
- ✅ **WordPress Plugin** - pełne zarządzanie produktami Amazon
- ✅ **Amazon PA-API 5.0** - automatyczne pobieranie danych produktów
- ✅ **Google Sheets** - zarządzanie produktami przez arkusze kalkulacyjne
- ✅ **Shortcodes** - łatwe wyświetlanie produktów w postach
- ✅ **Auto-sync** - automatyczna aktualizacja cen zgodnie z Amazon TOS (24h)

### 🎨 Dlaczego WAAS?

- **🔄 Automatyzacja** - Produkty synchronizują się automatycznie co 24h
- **📊 Google Sheets** - Zarządzaj produktami w znajomym interfejsie
- **⚡ Szybkie** - Cache produktów dla maksymalnej wydajności
- **✅ Amazon TOS Compliant** - W pełni zgodny z wymaganiami Amazon Associates
- **🎨 Gotowe Szablony** - Piękne, responsywne wyświetlanie produktów
- **🔐 Bezpieczne** - Bezpieczne przechowywanie credentials, API zabezpieczone

---

## ✨ Funkcje

### WordPress Plugin
- ✅ Custom Post Type dla produktów Amazon (`waas_product`)
- ✅ Amazon PA-API 5.0 integration z pełnym AWS Signature v4
- ✅ Automatyczny cache produktów (24h zgodnie z Amazon TOS)
- ✅ REST API endpoints dla integracji
- ✅ Admin Dashboard z statystykami
- ✅ Bulk import produktów
- ✅ Automatyczna daily synchronizacja (cron job)
- ✅ Shortcodes do wyświetlania produktów
- ✅ Responsywne szablony CSS
- ✅ Meta boxes z pełną konfiguracją produktów

### Google Apps Script - NOWA WERSJA! 🎉
- ✅ **Automatyczna instalacja jednym skryptem** - setup.gs
- ✅ **Zarządzanie wieloma stronami WordPress**
- ✅ **Automatyczna instalacja Divi theme**
- ✅ **Instalacja WAAS Product Manager plugin**
- ✅ **Import i synchronizacja produktów Amazon**
- ✅ **Automatyczne generowanie treści afiliacyjnych**
- ✅ **System kolejki zadań (Task Queue)**
- ✅ **Pełne logowanie operacji**
- ✅ **Intuicyjne menu i dialogi**

### Amazon PA-API Features
- ✅ GetItems - pobieranie pojedynczego produktu
- ✅ GetItems (batch) - pobieranie wielu produktów (max 10)
- ✅ SearchItems - wyszukiwanie produktów
- ✅ Pełne dane: cena, oszczędności, Prime, dostępność, zdjęcia, features
- ✅ Cache zgodny z Amazon TOS (max 24h)

---

## 📝 KONKRETNE NAZWY - Wszystko czego potrzebujesz!

### 🗂️ Google Sheets

**Nazwa głównego arkusza:**
```
AmazonAffiliateProductsDashboard
```

**Nazwy kart (arkuszy):**
1. `ProductsToImport` - Lista produktów do importu
2. `ProductsDatabase` - Baza danych produktów
3. `Settings` - Konfiguracja
4. `Logs` - Logi operacji
5. `Analytics` - Statystyki

**Kolumny w ProductsToImport:**
```
A: ASIN
B: Status
C: Last Sync
D: Import Date
E: Category
F: Notes
```

**Kolumny w ProductsDatabase:**
```
A: ASIN
B: Product Name
C: Brand
D: Price
E: Savings %
F: Prime Eligible
G: Availability
H: Affiliate Link
I: Image URL
J: Category
K: Last Updated
L: WP Post ID
M: Features
```

---

### 🔧 WordPress

**Nazwy pluginu:**
- **Folder:** `waas-product-manager`
- **Plik główny:** `waas-product-manager.php`
- **Nazwa w menu:** `WAAS Products`

**Custom Post Type:**
- **Nazwa:** `waas_product`
- **Slug:** `products`
- **Taxonomy:** `product_category`

**REST API Endpoints:**
```
Base URL: https://twoja-domena.pl/wp-json/waas/v1

GET  /products/list              - Lista wszystkich produktów
POST /products/import            - Import produktów
POST /products/update            - Aktualizacja produktów
POST /products/sync/{asin}       - Synchronizacja pojedynczego produktu
POST /content/generate           - Generowanie contentu (przyszłość)
GET  /cache/stats                - Statystyki cache
```

**Database Tables:**
```
wp_waas_product_cache    - Cache produktów (24h)
wp_waas_api_logs         - Logi API calls
```

---

### 📁 Struktura Projektu

```
LUKO-WAAS/
├── .env.example                           # Przykładowa konfiguracja
├── README.md                              # Ta dokumentacja
│
├── google-apps-script/                    # Google Apps Script
│   ├── Code.gs                           # Główny kod
│   ├── appsscript.json                   # Konfiguracja projektu
│   └── README_GoogleAppsScript.md        # Instrukcja Google Sheets
│
└── wordpress-plugin/                      # WordPress Plugin
    └── waas-product-manager/
        ├── waas-product-manager.php       # Główny plik pluginu
        │
        ├── includes/                      # Core functionality
        │   ├── class-product-post-type.php    # Custom Post Type
        │   ├── class-amazon-api.php           # Amazon PA-API integration
        │   ├── class-cache-manager.php        # Cache management (24h)
        │   ├── class-shortcodes.php           # Shortcodes
        │   ├── class-rest-api.php             # REST API endpoints
        │   └── class-product-importer.php     # Import/sync products
        │
        ├── admin/                         # Admin functionality
        │   ├── class-admin-dashboard.php      # Dashboard
        │   └── class-admin-settings.php       # Settings page
        │
        └── assets/                        # CSS & JS
            ├── css/
            │   ├── frontend.css               # Stylowanie produktów
            │   └── admin.css                  # Admin styles
            └── js/
                ├── frontend.js                # Frontend JavaScript
                └── admin.js                   # Admin JavaScript
```

---

## 🔧 Wymagania

### WordPress
- WordPress 5.8 lub nowszy
- PHP 7.4 lub nowszy
- MySQL 5.7 lub nowszy
- cURL extension (dla Amazon PA-API)
- JSON extension

### Amazon
- Konto Amazon Associates
- Amazon PA-API 5.0 credentials:
  - Access Key (20 znaków)
  - Secret Key (40 znaków)
  - Associate Tag (np. `yoursite-20`)

### Google
- Konto Google
- Google Sheets
- Google Apps Script

### Hosting (opcjonalnie)
- Hostinger, SiteGround, lub dowolny hosting WordPress
- HTTPS (wymagane dla PA-API)
- Cron jobs (dla auto-sync)

---

## 📥 Instalacja

### Krok 1: Zainstaluj WordPress Plugin

#### Metoda A: Upload przez WordPress Admin
1. Pobierz folder `wordpress-plugin/waas-product-manager`
2. Spakuj do ZIP: `waas-product-manager.zip`
3. W WordPress Admin → **Wtyczki** → **Dodaj nową** → **Prześlij wtyczkę**
4. Wybierz plik ZIP i kliknij **Zainstaluj**
5. Kliknij **Aktywuj wtyczkę**

#### Metoda B: Upload przez FTP
1. Skopiuj folder `wordpress-plugin/waas-product-manager`
2. Upload na serwer do `/wp-content/plugins/`
3. W WordPress Admin → **Wtyczki** → Znajdź "LUKO-WAAS Product Manager"
4. Kliknij **Aktywuj**

### Krok 2: Skonfiguruj Google Apps Script (Automatyczna Instalacja) ⚡

#### **NOWA METODA - Instalacja w 5 minut!**

1. Wejdź na: https://script.google.com
2. Kliknij: **Nowy projekt**
3. Skopiuj zawartość pliku `google-apps-script/setup.gs`
4. Wklej do edytora i zapisz (Ctrl+S)
5. Wybierz funkcję: `installWAAS`
6. Kliknij: **Uruchom** ▶️
7. Autoryzuj dostęp (zgody Google)
8. Poczekaj 30-60 sekund - gotowe! 🎉

**Skrypt automatycznie:**
- Utworzy arkusz Google Sheets ze wszystkimi kartami
- Skonfiguruje kolumny i strukturę
- Zainstaluje wszystkie moduły systemu
- Utworzy menu WAAS

**Szczegółowa instrukcja:** Zobacz `google-apps-script/README.md`

**Szybki start:** Zobacz `google-apps-script/INSTALLATION_QUICKSTART.md`

#### **STARA METODA** (dla zaawansowanych)
Jeśli chcesz ręcznie skonfigurować system, zobacz dokumentację w `google-apps-script/README_GoogleAppsScript.md`

### Krok 3: Skonfiguruj API Keys

Po instalacji dodaj klucze API w Google Apps Script:

1. Kliknij: **⚙️ Project Settings** (lewy panel)
2. Przewiń do: **Script Properties**
3. Dodaj właściwości:
   - `DIVI_API_USERNAME` = `netanaliza`
   - `DIVI_API_KEY` = `2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4`
   - `PA_API_ACCESS_KEY` = [Twój klucz Amazon]
   - `PA_API_SECRET_KEY` = [Twój sekret Amazon]
   - `PA_API_PARTNER_TAG` = [Twój tag partnera]
4. Zapisz

### Krok 4: Gotowe!

Otwórz utworzony arkusz i korzystaj z menu **⚡ WAAS**

---

## ⚙️ Konfiguracja

### 🔑 Amazon PA-API Credentials

1. Zarejestruj się w [Amazon Associates](https://affiliate-program.amazon.com/)
2. Przejdź do [PA-API Credentials](https://affiliate-program.amazon.com/assoc_credentials/home)
3. Skopiuj:
   - **Access Key** (20 znaków, np. `AKIAIOSFODNN7EXAMPLE`)
   - **Secret Key** (40 znaków, np. `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
   - **Associate Tag** (np. `yoursite-20`)

### 🔧 WordPress Plugin Settings

1. W WordPress Admin przejdź do **WAAS Products** → **Settings**

#### Amazon PA-API Settings:
```
Access Key:      AKIAIOSFODNN7EXAMPLE
Secret Key:      wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Associate Tag:   yoursite-20
Amazon Region:   us-east-1  (lub wybierz swój region)
```

#### Google Sheets Settings:
```
Google Sheets API Key:     moj-super-tajny-klucz-2025
Google Sheets Webhook URL: https://script.google.com/macros/s/.../exec
```

#### General Settings:
```
Amazon Disclosure: "As an Amazon Associate I earn from qualifying purchases."
Daily Auto-Sync:   ✅ Enabled
```

2. Kliknij **Save Settings**
3. Kliknij **Test API Connection** aby sprawdzić połączenie

### 📊 Google Sheets Settings

1. Otwórz arkusz **`AmazonAffiliateProductsDashboard`**
2. Przejdź do karty **Settings**
3. Wypełnij:

```
WordPress URL:             https://twoja-domena.pl
WordPress API Endpoint:    https://twoja-domena.pl/wp-json/waas/v1
API Key:                   moj-super-tajny-klucz-2025
Default Category:          outdoor-gear
Auto Sync Enabled:         TRUE
Sync Interval Hours:       24
```

**⚠️ WAŻNE:** `API Key` musi być identyczny w WordPress i Google Sheets!

---

## 🚀 Użycie

### 📥 Importowanie Produktów

#### Metoda 1: Przez Google Sheets
1. Otwórz arkusz **`AmazonAffiliateProductsDashboard`**
2. Przejdź do karty **ProductsToImport**
3. Dodaj ASINy w kolumnie A:
   ```
   B08N5WRWNW
   B07XJ8C8F5
   B09G9FPHY6
   ```
4. W kolumnie E wpisz kategorię: `electronics`
5. Menu: **WAAS Amazon Products** → **📥 Import produktów do WordPress**
6. Poczekaj na zakończenie
7. Produkty pojawią się w WordPress i karcie **ProductsDatabase**

#### Metoda 2: Przez WordPress Admin
1. **WAAS Products** → **Import Products**
2. Wpisz ASINy (jeden na linię):
   ```
   B08N5WRWNW
   B07XJ8C8F5
   B09G9FPHY6
   ```
3. Wybierz kategorię (opcjonalnie)
4. Kliknij **Import Products**

### 🔄 Synchronizacja Produktów

#### Automatyczna (Cron):
- Plugin automatycznie synchronizuje wszystkie produkty **codziennie o 2:00**
- Zgodne z Amazon TOS (max 24h cache)

#### Ręczna:
- **Google Sheets:** Menu → **🔄 Synchronizuj wszystkie produkty**
- **WordPress:** Dashboard → **Update All Products**

### 📊 Pobieranie Danych z WordPress do Sheets

1. W Google Sheets: Menu → **📊 Pobierz dane z WordPress**
2. Wszystkie produkty z WordPress pojawią się w karcie **ProductsDatabase**

---

## 🎨 Shortcodes

### Pojedynczy Produkt

```php
// Podstawowy
[waas_product asin="B08N5WRWNW"]

// Horizontal layout z ceną i features
[waas_product asin="B08N5WRWNW" layout="horizontal" show_price="yes" show_features="yes"]

// Card layout
[waas_product asin="B07XJ8C8F5" layout="card" button_text="Kup teraz na Amazon"]

// Minimal layout
[waas_product asin="B09G9FPHY6" layout="minimal" show_features="no"]
```

**Parametry:**
- `asin` (wymagany) - Amazon ASIN
- `layout` - `horizontal`, `vertical`, `card`, `minimal` (default: horizontal)
- `show_price` - `yes`/`no` (default: yes)
- `show_features` - `yes`/`no` (default: yes)
- `show_button` - `yes`/`no` (default: yes)
- `button_text` - Tekst przycisku (default: "View on Amazon")
- `image_size` - `small`, `medium`, `large` (default: medium)

---

### Siatka Produktów

```php
// 3 kolumny
[waas_grid asins="B08N5WRWNW,B07XJ8C8F5,B09G9FPHY6" columns="3"]

// 4 kolumny bez cen
[waas_grid asins="B08N5WRWNW,B07XJ8C8F5,B09G9FPHY6,B0B7CPSN1C" columns="4" show_price="no"]

// Własny tekst przycisku
[waas_grid asins="B08N5WRWNW,B07XJ8C8F5" columns="2" button_text="Zobacz szczegóły"]
```

**Parametry:**
- `asins` (wymagany) - ASINy oddzielone przecinkami
- `columns` - 1-6 (default: 3)
- `show_price` - `yes`/`no` (default: yes)
- `show_button` - `yes`/`no` (default: yes)
- `button_text` - Tekst przycisku

---

### Produkty z Kategorii

```php
// 12 produktów z kategorii outdoor-gear
[waas_category category="outdoor-gear" items="12" columns="3"]

// 6 najnowszych produktów electronics
[waas_category category="electronics" items="6" columns="2" orderby="date"]

// Sortowanie po tytule
[waas_category category="home-garden" items="9" columns="3" orderby="title" order="ASC"]
```

**Parametry:**
- `category` (wymagany) - Slug kategorii
- `items` - Liczba produktów (default: 12)
- `columns` - 1-6 (default: 3)
- `orderby` - `date`, `title`, `modified` (default: date)
- `order` - `ASC`, `DESC` (default: DESC)

---

## 🔗 Google Sheets Integration

### Web App Deployment (Opcjonalne)

Jeśli chcesz aby WordPress mógł wysyłać dane DO Google Sheets:

1. W Apps Script: **Wdróż** → **Nowe wdrożenie**
2. Typ: **Aplikacja internetowa**
3. Wykonuj jako: **Mnie**
4. Dostęp: **Każdy**
5. Kliknij **Wdróż**
6. Skopiuj URL (np. `https://script.google.com/macros/s/AKfycby.../exec`)
7. W WordPress Settings: **Google Sheets Webhook URL** → Wklej URL

### Funkcje Menu w Google Sheets

Menu **🚀 WAAS Amazon Products:**
- **📥 Import produktów do WordPress** - Importuje produkty z karty ProductsToImport
- **🔄 Synchronizuj wszystkie produkty** - Aktualizuje wszystkie produkty z WordPress
- **📊 Pobierz dane z WordPress** - Pobiera wszystkie produkty do ProductsDatabase
- **⚙️ Konfiguracja początkowa** - Tworzy wszystkie arkusze i nagłówki
- **🧪 Test połączenia z WordPress** - Testuje połączenie z WordPress API
- **📖 Pomoc i dokumentacja** - Pokazuje pomoc

---

## 📱 Przykładowe ASINy do Testów

| ASIN | Produkt | Kategoria |
|------|---------|-----------|
| B08N5WRWNW | Apple AirPods Pro (2nd Gen) | electronics |
| B07XJ8C8F5 | Echo Dot (4th Gen) | electronics |
| B09G9FPHY6 | Kindle Paperwhite | electronics |
| B0B7CPSN1C | Fire TV Stick 4K Max | electronics |
| B09B8WNXR8 | Bose QuietComfort 45 | electronics |

---

## ❓ FAQ

### ❓ Czy to jest zgodne z Amazon Associates TOS?
**Tak!** Plugin:
- Cachuje ceny max 24h (zgodnie z wymaganiami)
- Nie pobiera/nie hostuje zdjęć produktów (linkuje do Amazon)
- Wyświetla wymagane disclosure
- Aktualizuje ceny codziennie
- Używa oficjalnego PA-API 5.0

### ❓ Ile produktów mogę zaimportować?
- **Amazon PA-API limit:** 1 request/second, 8640 requests/day
- **Plugin:** Batch import po max 10 produktów (zgodnie z PA-API)
- **Google Sheets:** Brak limitu w arkuszu, ale execution time max 6 min

### ❓ Czy mogę używać bez Google Sheets?
**Tak!** Plugin działa samodzielnie. Google Sheets to opcjonalna funkcjonalność do zarządzania produktami.

### ❓ Jak często synchronizują się ceny?
- **Automatycznie:** Co 24h o godz. 2:00 (cron job)
- **Ręcznie:** Kliknij "Sync Now" w dowolnym momencie

### ❓ Co jeśli produkt nie jest już dostępny?
Plugin automatycznie aktualizuje status dostępności. Możesz ukryć niedostępne produkty przez filtrowanie w WordPress.

### ❓ Czy działa z Divi?
**Tak!** Shortcodes działają we wszystkich builderach: Divi, Elementor, Gutenberg, Classic Editor.

### ❓ Jakie są koszty?
- **Plugin:** Darmowy (GPL v2)
- **Amazon PA-API:** Darmowy (wymagane konto Associates)
- **Google Sheets:** Darmowy
- **Hosting:** Koszt Twojego hostingu WordPress

---

## 🛠️ Rozwiązywanie Problemów

### ❌ Błąd: "Amazon API credentials are not configured"
**Rozwiązanie:**
1. Przejdź do **WAAS Products** → **Settings**
2. Wypełnij Access Key, Secret Key, Associate Tag
3. Kliknij **Save Settings**
4. Użyj **Test API Connection**

### ❌ Błąd: "Unauthorized" lub 403 w Google Sheets
**Rozwiązanie:**
1. Sprawdź czy API Key jest identyczny w WordPress i Google Sheets
2. W WordPress: **WAAS Products** → **Settings** → **Google Sheets API Key**
3. W Google Sheets: Karta **Settings** → pole **API Key**
4. Muszą być identyczne!

### ❌ Produkty nie importują się
**Rozwiązanie:**
1. Sprawdź logi: **WAAS Products** → **Cache** → API Logs (tabela `wp_waas_api_logs`)
2. Sprawdź Google Sheets: Karta **Logs**
3. Upewnij się że ASIN jest poprawny (10 znaków)
4. Sprawdź czy PA-API credentials są poprawne

### ❌ "Exception: Service invoked too many times" w Google Sheets
**Rozwiązanie:**
- Google Apps Script ma limit: 6 min execution time
- Importuj produkty partiami (max 20-30 na raz)
- Nie importuj 100+ produktów jednocześnie

### ❌ Ceny nie aktualizują się
**Rozwiązanie:**
1. Sprawdź czy cron jobs działają: zainstaluj plugin "WP Crontrol"
2. Sprawdź czy `waas_pm_daily_update` jest zaplanowany
3. Uruchom ręcznie: **WAAS Products** → **Dashboard** → **Update All Products**

---

## 📚 Dokumentacja Dodatkowa

- **Google Apps Script:** Zobacz `google-apps-script/README_GoogleAppsScript.md`
- **.env Configuration:** Zobacz `.env.example`
- **REST API:** Dokumentacja endpoints dostępna w kodzie `class-rest-api.php`

---

## 🤝 Wsparcie

### 🐛 Zgłaszanie Błędów
Jeśli znajdziesz błąd, zgłoś go na [GitHub Issues](https://github.com/LUKOAI/LUKO-WAAS/issues)

### 💡 Pomysły na Funkcje
Masz pomysł? Dodaj [Feature Request](https://github.com/LUKOAI/LUKO-WAAS/issues/new)

### 📧 Kontakt
- GitHub: [@LUKOAI](https://github.com/LUKOAI)
- Email: support@luko.ai

---

## 📜 Licencja

**GPL v2 lub nowsza**

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

---

## 🙏 Podziękowania

- Amazon Product Advertising API Team
- WordPress Community
- Google Apps Script Community
- Wszyscy kontrybutorzy i testerzy

---

## 🚀 Roadmap

- [ ] Claude AI integration dla automatycznego generowania contentu
- [ ] Bulk product editing w admin
- [ ] Advanced analytics dashboard
- [ ] Email notifications dla out-of-stock
- [ ] Multi-marketplace support (UK, DE, JP, etc.)
- [ ] Product comparison tables
- [ ] Automated blog post generation
- [ ] Integration z innymi affiliate networks

---

## ⭐ Star History

Jeśli ten projekt Ci pomógł, zostaw gwiazdkę! ⭐

---

**Made with ❤️ by LUKO AI Team**

**Powodzenia z Twoją stroną afiliacyjną! 🚀📈💰**
