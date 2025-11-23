# 🚀 LUKO-WAAS 2.0 - DEPLOYMENT GUIDE

**Kompletny przewodnik wdrożenia systemu WordPress Affiliate Automation System**

---

## 📋 SPIS TREŚCI

1. [Quick Start (5 minut)](#quick-start)
2. [Pełna instalacja krok po kroku](#instalacja-pełna)
3. [Konfiguracja Google Sheets](#google-sheets)
4. [Konfiguracja WordPress](#wordpress-config)
5. [Testowanie systemu](#testowanie)
6. [Deployment produkcyjny](#produkcja)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 QUICK START (5 minut) {#quick-start}

### Co będzie zrobione:
- ✅ WordPress z 3 pluginami zainstalowany
- ✅ Google Sheets skonfigurowany
- ✅ Amazon PA-API połączone
- ✅ Pierwszy produkt zaimportowany

### Wymagania:
- [ ] WordPress 5.8+ na hostingu
- [ ] Konto Amazon Associates + PA-API credentials
- [ ] Konto Google (dla Google Sheets)
- [ ] 5 minut czasu

---

### KROK 1: WordPress Plugins (2 minuty)

#### 1.1. Upload pluginów

```bash
# Metoda A: FTP
1. Połącz się z serwerem (FileZilla, Total Commander)
2. Przejdź do /wp-content/plugins/
3. Upload następujących folderów:
   - wordpress-plugin/waas-product-manager.zip
   - wordpress-plugin/waas-patronage-manager.zip
   - wordpress-plugin/divi-child-waas.zip (tylko jeśli używasz Divi)
```

```bash
# Metoda B: WordPress Admin (szybsza)
1. WordPress Admin → Wtyczki → Dodaj nową
2. Kliknij "Prześlij wtyczkę"
3. Wybierz waas-product-manager.zip → Zainstaluj → Aktywuj
4. Powtórz dla waas-patronage-manager.zip
5. (Opcjonalnie) Divi child theme: Appearance → Themes → Add New → Upload
```

#### 1.2. Aktywuj pluginy

```
WordPress Admin → Wtyczki → Zainstalowane
✅ WAAS Product Manager - Aktywuj
✅ WAAS Patronage Manager - Aktywuj
```

**Gotowe!** Pluginy zainstalowane.

---

### KROK 2: Amazon PA-API Configuration (1 minuta)

1. **Pobierz credentials z Amazon:**
   - Wejdź na: https://affiliate-program.amazon.com/assoc_credentials/home
   - Skopiuj:
     - Access Key (20 znaków)
     - Secret Key (40 znaków)
     - Associate Tag (np. `yoursite-20`)

2. **Wklej do WordPress:**
   ```
   WordPress Admin → WAAS Products → Settings → Amazon API tab

   Access Key:      [WKLEJ]
   Secret Key:      [WKLEJ]
   Associate Tag:   [WKLEJ]
   Amazon Region:   us-east-1 (lub wybierz swój)

   → Save Settings
   → Test API Connection (powinno pokazać ✅ Connection successful)
   ```

**Gotowe!** Amazon połączony.

---

### KROK 3: Google Sheets Setup (2 minuty)

1. **Otwórz Google Apps Script:**
   - Wejdź na: https://script.google.com
   - Kliknij: **Nowy projekt**

2. **Skopiuj installer:**
   - Otwórz plik: `google-apps-script/WAAS_Complete_Installer.gs`
   - Skopiuj **całą zawartość** (Ctrl+A, Ctrl+C)
   - Wklej do Apps Script (Ctrl+V)
   - Zapisz (Ctrl+S)

3. **Uruchom installer:**
   - Wybierz funkcję: `installWAAS` (dropdown u góry)
   - Kliknij: ▶️ **Uruchom**
   - Autoryzuj dostęp (Google popup - kliknij "Zezwól")
   - Poczekaj 30-60 sekund

4. **Skonfiguruj API keys:**
   ```
   Apps Script → ⚙️ Project Settings → Script Properties

   Dodaj właściwości:
   PA_API_ACCESS_KEY     = [Twój Amazon Access Key]
   PA_API_SECRET_KEY     = [Twój Amazon Secret Key]
   PA_API_PARTNER_TAG    = [Twój Associate Tag]
   DIVI_API_USERNAME     = netanaliza
   DIVI_API_KEY          = 2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4

   → Save
   ```

5. **Otwórz utworzony arkusz:**
   - Wróć do Google Sheets (nowa zakładka powinna się otworzyć)
   - Nazwa arkusza: `AmazonAffiliateProductsDashboard`
   - Sprawdź czy są karty: Sites, Products, Tasks, Logs, Settings

**Gotowe!** Google Sheets działa.

---

### KROK 4: Connect Google Sheets → WordPress (30 sekund)

1. **W Google Sheets → karta Settings:**
   ```
   Row 2 (pierwsza konfiguracja):

   A2: WordPress URL           = https://twoja-domena.pl
   B2: API Endpoint           = https://twoja-domena.pl/wp-json/waas/v1
   C2: API Key                = moj-tajny-klucz-123 (wymyśl własny)
   D2: Default Category       = electronics
   E2: Auto Sync Enabled      = TRUE
   F2: Sync Interval Hours    = 24
   ```

2. **W WordPress → WAAS Settings:**
   ```
   WordPress Admin → WAAS Products → Settings → Google Sheets tab

   Google Sheets API Key: moj-tajny-klucz-123 (TEN SAM co w Sheets!)

   → Save Settings
   ```

**Gotowe!** Google Sheets połączony z WordPress.

---

### KROK 5: Test - Import pierwszego produktu (30 sekund)

1. **W Google Sheets → karta Products:**
   ```
   Row 2 (pierwszy produkt):
   A2: B08N5WRWNW (przykładowy ASIN - Apple AirPods)
   E2: electronics (kategoria)
   ```

2. **Import do WordPress:**
   ```
   Google Sheets → Menu: ⚡ WAAS → 📥 Import produktów do WordPress
   Poczekaj 10-20 sekund
   ```

3. **Sprawdź w WordPress:**
   ```
   WordPress Admin → WAAS Products → All Products

   Powinien być: "Apple AirPods Pro (2nd Generation)" ✅
   ```

**Gotowe!** System działa! 🎉

---

## 🏗️ INSTALACJA PEŁNA KROK PO KROKU {#instalacja-pełna}

Szczegółowy przewodnik dla produkcyjnego wdrożenia.

---

### FAZA 1: Przygotowanie środowiska

#### 1.1. Wymagania serwera

**Minimalne:**
- WordPress 5.8+
- PHP 7.4+ (zalecane: 8.0+)
- MySQL 5.7+ lub MariaDB 10.3+
- Memory limit: 256 MB (zalecane: 512 MB)
- Max execution time: 60s (zalecane: 120s)
- HTTPS (wymagane dla PA-API)
- cURL extension
- JSON extension

**Sprawdź wymagania:**
```php
WordPress Admin → Tools → Site Health → Info
Sprawdź: Server, Database, WordPress, Active Plugins
```

#### 1.2. Hosting (zalecane)

**Hostinger Business Cloud:**
- ✅ 100 subdomains (dla multi-site WAAS)
- ✅ PHP 8.0+
- ✅ Auto HTTPS (Let's Encrypt)
- ✅ Daily backups
- ✅ €8-12/month

**Inne opcje:**
- SiteGround (GrowBig lub wyżej)
- WP Engine (Startup lub wyżej)
- Cloudways (DO 2GB lub wyżej)

#### 1.3. WordPress instalacja

```bash
# Jeśli jeszcze nie masz WordPress:
1. W panelu hostingu → "Install WordPress"
2. Wybierz domenę: example.com (lub subdomena: shop.lk24.shop)
3. Kliknij Install
4. Zaloguj się do WordPress Admin
```

---

### FAZA 2: Instalacja pluginów WAAS

#### 2.1. WAAS Product Manager

**Plik:** `wordpress-plugin/waas-product-manager.zip`

**Co robi:**
- Custom Post Type `waas_product`
- Amazon PA-API 5.0 integration
- Cache manager (24h zgodnie z Amazon TOS)
- REST API endpoints
- Shortcodes: `[waas_product]`, `[waas_grid]`, `[waas_category]`
- Admin dashboard
- WooCommerce sync (opcjonalnie)

**Instalacja:**
```
WordPress Admin → Wtyczki → Dodaj nową → Prześlij wtyczkę
→ Wybierz waas-product-manager.zip
→ Zainstaluj teraz
→ Aktywuj wtyczkę
```

**Po aktywacji sprawdź:**
```
WordPress Admin → WAAS Products (nowa pozycja w menu)
→ Powinieneś zobaczyć: Dashboard, All Products, Import, Settings
```

#### 2.2. WAAS Patronage Manager

**Plik:** `wordpress-plugin/waas-patronage-manager.zip`

**Co robi:**
- System patronatu (B2B SaaS model)
- Logo/branding toggle
- Product filtering (tylko produkty patrona)
- Client dashboard
- Subscription management
- Patron analytics

**Instalacja:**
```
WordPress Admin → Wtyczki → Dodaj nową → Prześlij wtyczkę
→ Wybierz waas-patronage-manager.zip
→ Zainstaluj teraz
→ Aktywuj wtyczkę
```

**Po aktywacji sprawdź:**
```
WordPress Admin → WAAS Patronage (nowa pozycja w menu)
→ Powinieneś zobaczyć: Dashboard, Patrons, Settings, Logs
```

#### 2.3. Divi Child Theme (opcjonalnie)

**Plik:** `wordpress-plugin/divi-child-waas.zip`

**Wymagania:**
- Divi theme zainstalowany i aktywny

**Co robi:**
- Custom single product template
- Patronage integration z Divi
- Conditional branding (logo, footer)
- Product query filtering dla Divi modules

**Instalacja:**
```
WordPress Admin → Wygląd → Motywy → Dodaj nowy → Prześlij motyw
→ Wybierz divi-child-waas.zip
→ Zainstaluj teraz
→ Aktywuj (tylko jeśli masz Divi parent theme!)
```

#### 2.4. WooCommerce (opcjonalnie)

**Jeśli chcesz sklep WooCommerce z produktami Amazon:**

```
WordPress Admin → Wtyczki → Dodaj nową
→ Szukaj: "WooCommerce"
→ Zainstaluj → Aktywuj
→ Przejdź Setup Wizard (możesz pominąć większość kroków)
```

**WAAS automatycznie:**
- Synchronizuje produkty do WooCommerce
- Tworzy External/Affiliate products
- Aktualizuje ceny codziennie

---

### FAZA 3: Konfiguracja Amazon PA-API

#### 3.1. Uzyskaj credentials

1. **Zarejestruj się w Amazon Associates:**
   - US: https://affiliate-program.amazon.com
   - UK: https://affiliate-program.amazon.co.uk
   - DE: https://partnernet.amazon.de
   - (inne regiony: analogicznie)

2. **Aktywuj PA-API 5.0:**
   - Przejdź do: https://affiliate-program.amazon.com/assoc_credentials/home
   - Kliknij: "Add a New PA API Account" (jeśli nie masz)
   - Skopiuj credentials:
     - **Access Key** (20 znaków, np. `AKIAIOSFODNN7EXAMPLE`)
     - **Secret Key** (40 znaków, np. `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
   - Skopiuj **Associate Tag** (np. `yoursite-20`)

#### 3.2. Konfiguracja w WordPress

```
WordPress Admin → WAAS Products → Settings → Amazon API

Access Key:      AKIAIOSFODNN7EXAMPLE
Secret Key:      wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Associate Tag:   yoursite-20
Amazon Region:   us-east-1

Wybierz region:
- us-east-1 (USA)
- eu-west-1 (UK, Europe)
- eu-central-1 (Germany)
- ap-northeast-1 (Japan)
- (inne dostępne w dropdown)

→ Save Settings
```

#### 3.3. Test połączenia

```
Na dole strony Settings → kliknij: "Test API Connection"

Powinno pokazać:
✅ Connection successful!
✅ Sample product retrieved: [przykładowy produkt]

Jeśli błąd:
❌ "Invalid credentials" → Sprawdź Access/Secret Key
❌ "Invalid region" → Zmień region
❌ "Request throttled" → Poczekaj 1 minutę, spróbuj ponownie
```

---

### FAZA 4: Konfiguracja Google Sheets {#google-sheets}

#### 4.1. Instalacja Google Apps Script

1. **Otwórz Apps Script:**
   - https://script.google.com
   - Kliknij: **Nowy projekt**
   - Zmień nazwę na: "WAAS Automation"

2. **Skopiuj kod:**
   ```
   Metoda A: Single-file installer (zalecane)
   - Otwórz: google-apps-script/WAAS_Complete_Installer.gs
   - Skopiuj CAŁOŚĆ
   - Wklej do Apps Script

   Metoda B: Modułowa instalacja
   - Dla każdego pliku .gs w google-apps-script/:
     - Kliknij "+" → "Script file"
     - Wklej kod
     - Zapisz
   ```

3. **Uruchom installer:**
   ```
   Wybierz funkcję: installWAAS
   Kliknij: ▶️ Uruchom

   Pierwszy raz:
   → Popup: "Autoryzacja wymagana"
   → Kliknij: "Przejrzyj uprawnienia"
   → Wybierz swoje konto Google
   → Kliknij: "Zaawansowane" → "Przejdź do WAAS Automation (niebezpieczne)"
   → Kliknij: "Zezwól"

   Poczekaj 30-60 sekund

   Sprawdź log:
   ✅ Creating spreadsheet...
   ✅ Creating sheets...
   ✅ Setting up menu...
   ✅ Installation complete!
   ```

4. **Otwórz utworzony arkusz:**
   - Google Sheets (nowa zakładka)
   - Nazwa: `AmazonAffiliateProductsDashboard`
   - Karty: Sites, Products, Tasks, Content Queue, Logs, Settings, Analytics

#### 4.2. Konfiguracja Script Properties

⚠️ **WAŻNE:** Script Properties zawierają TYLKO parametry globalne!
Per-site credentials (Divi API Key, Amazon Associate Tag) są w zakładce Sites!

```
Apps Script → ⚙️ Project Settings (ikona koła zębatego) → Script Properties

Dodaj właściwości (kliknij "Add script property"):

Właściwość                 Wartość                                 Opis
──────────────────────────────────────────────────────────────────────────────
PA_API_ACCESS_KEY          [Twój Amazon Access Key]               Global (wspólny dla wszystkich stron)
PA_API_SECRET_KEY          [Twój Amazon Secret Key]               Global (wspólny dla wszystkich stron)
DIVI_API_USERNAME          netanaliza                             Global (username Elegant Themes)

→ Save script properties
```

**NIE dodawaj tych parametrów do Script Properties:**
- ❌ `DIVI_API_KEY` - jest **per-site** w zakładce Sites (kolumna H)!
- ❌ `PA_API_PARTNER_TAG` - jest **per-site** jako Amazon Associate Tag (kolumna I)!

#### 4.3. Konfiguracja zakładki Sites (KRYTYCZNE!)

⚠️ **NOWA ARCHITEKTURA WAAS 2.0:** Każda strona ma własne credentials!

```
Google Sheets → karta "Sites"

Struktura kolumn:
A: ID                        (auto-generated)
B: Site Name                 (np. "Magnetbohrmaschine")
C: Domain                    (np. "magnetbohrmaschine.lk24.shop")
D: WordPress URL             (np. "https://magnetbohrmaschine.lk24.shop")
E: Admin Username            (np. "netanaliza")
F: Admin Password            (WordPress admin password)
G: WP API Key                (auto-generated podczas dodawania strony)
H: Divi API Key              (⚠️ UNIKALNY dla KAŻDEJ strony - 40 hex chars!)
I: Amazon Associate Tag      (np. "magnetbohr-21")
J: Status                    (pending/deploying/active/maintenance/error)
K: Divi Installed            (TRUE/FALSE)
L: Plugin Installed          (TRUE/FALSE)
M: Last Check                (timestamp ostatniego sprawdzenia)
```

**Przykładowy wiersz (Row 2 - pierwsza strona):**

```
A2: 1
B2: Magnetbohrmaschine
C2: magnetbohrmaschine.lk24.shop
D2: https://magnetbohrmaschine.lk24.shop
E2: netanaliza
F2: [your WordPress admin password]
G2: waas-api-magnetbohr-2025
H2: c12d038b32b1f2356c705ede89bf188b0abf6a51    ← UNIKALNY DIVI KEY!
I2: magnetbohr-21
J2: active
K2: TRUE
L2: TRUE
M2: 2025-11-23 14:30:00
```

**Jak uzyskać Divi API Key (kolumna H):**

1. Wejdź na: https://www.elegantthemes.com/members-area/api/
2. Kliknij: "Add New API Key"
3. Wpisz nazwę: [nazwa twojej strony, np. "magnetbohrmaschine"]
4. Kliknij: "Generate API Key"
5. **SKOPIUJ 40-znakowy klucz** (np. `c12d038b32b1f2356c705ede89bf188b0abf6a51`)
6. **WKLEJ do Google Sheets** → Sites → kolumna H dla tej strony

⚠️ **WAŻNE:** Każda subdomena MUSI mieć własny, unikalny Divi API Key!

**Dowód:** Screenshot z Elegant Themes API (rzeczywiste dane użytkownika):
```
Site URL                              | API Key
--------------------------------------|----------------------------------------
https://gadsjo.de                     | f6f26eb86b780f2caf47dbc74f11c6854f7e70af
https://rhetovox.de                   | b693821aa7d8e62c62e27a32b77fa55fff61ba10
https://forplus24.de                  | 3e9df5c1f143861dd8098436731bc2e35e32702c
magnetbohrmaschine.lk24.shop          | c12d038b32b1f2356c705ede89bf188b0abf6a51
```

Jak widać, **każda strona ma INNY klucz API!**

#### 4.4. Konfiguracja arkusza Settings

```
Google Sheets → karta "Settings"

Row 2 (pierwsza konfiguracja WordPress):
A2: WordPress URL          = https://twoja-domena.pl
B2: API Endpoint          = https://twoja-domena.pl/wp-json/waas/v1
C2: API Key               = waas-api-key-2025-secure-123
D2: Default Category      = electronics
E2: Auto Sync Enabled     = TRUE
F2: Sync Interval Hours   = 24

UWAGA: API Key musi być identyczny w Google Sheets i WordPress Settings!
```

---

### FAZA 5: Połączenie WordPress ↔ Google Sheets

#### 5.1. Konfiguracja WordPress API Key

```
WordPress Admin → WAAS Products → Settings → Google Sheets tab

Google Sheets API Key: waas-api-key-2025-secure-123
(TEN SAM co w Google Sheets → Settings → C2!)

→ Save Settings
```

#### 5.2. (Opcjonalne) Web App Deployment

**Jeśli chcesz aby WordPress mógł wysyłać dane DO Sheets:**

```
Apps Script → Deploy → New deployment

Typ: Web app
Execute as: Me
Who has access: Anyone

→ Deploy
→ Skopiuj URL (np. https://script.google.com/macros/s/AKfycby.../exec)

WordPress Admin → WAAS Settings → Google Sheets tab
Google Sheets Webhook URL: [WKLEJ URL]

→ Save Settings
```

#### 5.3. Test połączenia

```
Google Sheets → Menu: ⚡ WAAS → 🧪 Test połączenia z WordPress

Powinno pokazać:
✅ Połączono z WordPress!
✅ Strona: https://twoja-domena.pl
✅ Wersja: WordPress 6.x
✅ WAAS Plugin aktywny

Jeśli błąd:
❌ "Failed to connect" → Sprawdź URL w Settings
❌ "Unauthorized" → Sprawdź czy API Keys są identyczne
❌ "CORS error" → Sprawdź czy strona jest na HTTPS
```

---

### FAZA 6: Testowanie systemu {#testowanie}

#### 6.1. Import produktu z Google Sheets

```
1. Google Sheets → karta "Products"
2. Dodaj ASINy:
   A2: B08N5WRWNW    (Apple AirPods)
   A3: B07XJ8C8F5    (Echo Dot)
   A4: B09G9FPHY6    (Kindle)

3. Kolumna E (Category):
   E2: electronics
   E3: electronics
   E4: electronics

4. Menu: ⚡ WAAS → 📥 Import produktów do WordPress

5. Poczekaj 20-30 sekund

6. Sprawdź:
   - Kolumna B (Status): "imported" ✅
   - Kolumna C (Last Sync): [data]
   - Kolumna L (WP Post ID): [ID]
```

#### 6.2. Sprawdź w WordPress

```
WordPress Admin → WAAS Products → All Products

Powinny być 3 produkty:
✅ Apple AirPods Pro (2nd Generation)
✅ Echo Dot (4th Gen)
✅ Kindle Paperwhite

Kliknij na produkt → Sprawdź:
- Tytuł: [z Amazon]
- Content: (może być pusty - OK)
- Featured Image: [obrazek z Amazon]
- Meta fields (scroll down):
  - ASIN: B08N5WRWNW ✅
  - Price: $249.00 ✅
  - Brand: Apple ✅
  - Features: [lista] ✅
```

#### 6.3. Test shortcode

```
1. Utwórz nową stronę:
   Pages → Add New → "Test WAAS"

2. Dodaj shortcode:
   [waas_product asin="B08N5WRWNW"]

3. Publish

4. Wyświetl stronę (View Page)

Powinno pokazać:
✅ Obrazek produktu
✅ Tytuł: Apple AirPods Pro
✅ Cena: $249.00
✅ Features (lista)
✅ Przycisk "View on Amazon" (orange)
✅ Amazon disclosure na górze
```

#### 6.4. Test WooCommerce sync (jeśli WC zainstalowany)

```
WooCommerce → Products

Powinny być te same 3 produkty:
✅ Apple AirPods Pro (External product)
✅ Echo Dot (External product)
✅ Kindle Paperwhite (External product)

Kliknij na produkt → Sprawdź:
- Product type: External/Affiliate product
- Product URL: [link do Amazon z Twoim associate tag]
- Button text: "View on Amazon"
- Price: $249.00 (display only)
```

#### 6.5. Test auto-update (cron)

```
WordPress → Tools → Cron Events (zainstaluj "WP Crontrol" jeśli nie masz)

Znajdź:
waas_pm_daily_update → Schedule: Daily at 2:00 AM

Kliknij "Run Now" (test manual)

Poczekaj 30-60 sekund

Sprawdź logi:
WordPress Admin → WAAS Products → Cache → Scroll do API Logs

Powinny być wpisy:
✅ [timestamp] GetItems - Success - B08N5WRWNW
✅ [timestamp] GetItems - Success - B07XJ8C8F5
✅ [timestamp] GetItems - Success - B09G9FPHY6
```

---

### FAZA 7: Deployment produkcyjny {#produkcja}

#### 7.1. Optymalizacja Performance

**Cache produktów:**
```
WAAS już ma built-in cache (24h)
Nie potrzebujesz dodatkowych pluginów cache dla produktów
```

**Page cache (opcjonalnie):**
```
Zainstaluj: WP Rocket lub W3 Total Cache
Konfiguracja:
- Enable page cache
- EXCLUDE: /waas_product/ (single products - ze względu na ceny)
- Cache strony z shortcodes: OK
```

**CDN (zalecane dla dużego ruchu):**
```
Cloudflare (Free Plan):
1. Zarejestruj domenę w Cloudflare
2. Zmień nameservery u registrara
3. Enable "Auto Minify" (CSS, JS)
4. Enable "Brotli" compression
5. Page Rules:
   - *.jpg, *.png → Cache Everything (1 month)
   - /wp-admin/* → Cache Level: Bypass
```

#### 7.2. Security Hardening

**1. Ukryj admin login:**
```
Zainstaluj: WPS Hide Login
Zmień /wp-admin na /secret-admin-2025
```

**2. Limit login attempts:**
```
Zainstaluj: Limit Login Attempts Reloaded
Konfiguracja: Max 5 prób, 20 min lockout
```

**3. Firewall:**
```
Zainstaluj: Wordfence Security
Enable:
- Firewall (Extended Protection)
- Malware Scanner (weekly)
- Two-Factor Authentication (dla admina)
```

**4. SSL/HTTPS:**
```
Sprawdź: https://twoja-domena.pl (powinno być zielone)

Jeśli nie:
1. Hosting panel → SSL → Install Free SSL (Let's Encrypt)
2. WordPress Admin → Settings → General
   - WordPress Address (URL): https://...
   - Site Address (URL): https://...
   - Save
```

**5. Backup:**
```
Zainstaluj: UpdraftPlus
Konfiguracja:
- Daily database backup → Google Drive
- Weekly files backup → Google Drive
- Retain: 7 daily, 4 weekly
```

#### 7.3. Monitoring & Alerts

**1. Uptime monitoring:**
```
UptimeRobot (free):
- Monitor: https://twoja-domena.pl
- Check interval: 5 minutes
- Alert: Email gdy strona down > 5 min
```

**2. Error logging:**
```
WordPress wp-config.php:
define('WP_DEBUG', false);  // Wyłącz debug na produkcji
define('WP_DEBUG_LOG', true); // Ale loguj błędy do /wp-content/debug.log

Regularnie sprawdzaj:
tail -f /wp-content/debug.log
```

**3. Analytics:**
```
Google Analytics 4:
1. Utwórz property GA4
2. Zainstaluj: Site Kit by Google
3. Połącz z GA4
4. Tracking:
   - Pageviews (automatyczne)
   - Clicks na przyciski Amazon (custom event)
```

#### 7.4. Compliance

**Amazon Associates TOS:**
```
✅ Cache max 24h (WAAS robi to automatycznie)
✅ Disclosure na każdej stronie z produktami (WAAS dodaje automatycznie)
✅ Price + timestamp (WAAS wyświetla)
✅ Link nofollow sponsored (WAAS ustawia)
✅ Nie hostujemy zdjęć produktów (linkujemy do Amazon)
```

**GDPR (jeśli EU traffic):**
```
1. Zainstaluj: Complianz GDPR
2. Cookie consent banner:
   - Analytics cookies: Opt-in
   - Functional cookies: Exempt
3. Privacy Policy:
   - Generuj przez Complianz wizard
   - Dodaj sekcję: "Amazon Associates disclosure"
4. Cookie Policy:
   - Lista wszystkich cookies
```

---

## 🧪 TESTOWANIE {#testowanie}

### Test Checklist

#### ✅ Podstawowe funkcje:

- [ ] Import produktu z Google Sheets → WordPress
- [ ] Import produktu z WordPress Admin (ASIN input)
- [ ] Shortcode `[waas_product]` wyświetla produkt
- [ ] Shortcode `[waas_grid]` wyświetla grid produktów
- [ ] Shortcode `[waas_category]` wyświetla produkty z kategorii
- [ ] Cron daily update działa (ceny się aktualizują)
- [ ] Cache produktów działa (nie pobiera z API częściej niż 24h)
- [ ] Amazon disclosure wyświetla się na wszystkich stronach z produktami

#### ✅ WooCommerce (jeśli zainstalowany):

- [ ] Produkty WAAS synchronizują się do WC automatycznie
- [ ] Produkty WC typu External/Affiliate
- [ ] Product URL prowadzi do Amazon z associate tag
- [ ] Featured images pobierają się
- [ ] Kategorie synchronizują się
- [ ] Update cen w WAAS → update w WC

#### ✅ Patronage (jeśli używasz B2B model):

- [ ] Patron aktywny → pokazuje tylko jego produkty
- [ ] Patron nieaktywny → pokazuje wszystkie produkty
- [ ] Logo patrona wyświetla się (gdy aktywny)
- [ ] Footer branding patrona (gdy aktywny)
- [ ] Client dashboard dostępny dla patrona

#### ✅ Google Sheets:

- [ ] Menu "⚡ WAAS" wyświetla się
- [ ] Import produktów z Sheets do WordPress działa
- [ ] Pobieranie danych z WordPress do Sheets działa
- [ ] Synchronizacja wszystkich produktów działa
- [ ] Logi zapisują się w karcie "Logs"

#### ✅ Performance:

- [ ] Strona ładuje się < 3 sekundy
- [ ] Shortcodes renderują się < 1 sekunda
- [ ] Import 10 produktów < 30 sekund
- [ ] Daily cron update nie blokuje strony

---

## 🐛 TROUBLESHOOTING {#troubleshooting}

### Problem 1: "Amazon API credentials are not configured"

**Objawy:**
- Nie można zaimportować produktów
- Error w WordPress

**Rozwiązanie:**
```
1. WordPress Admin → WAAS Products → Settings → Amazon API
2. Sprawdź czy wszystkie pola są wypełnione:
   - Access Key (20 znaków)
   - Secret Key (40 znaków)
   - Associate Tag
3. Kliknij "Test API Connection"
4. Jeśli błąd → sprawdź credentials w Amazon Associates
```

---

### Problem 2: "Unauthorized" w Google Sheets

**Objawy:**
- Google Sheets → Import fails
- Error: "Unauthorized" lub "403 Forbidden"

**Rozwiązanie:**
```
1. Sprawdź API Keys:
   Google Sheets → Settings → C2 (API Key)
   WordPress → WAAS Settings → Google Sheets API Key

2. Muszą być IDENTYCZNE!

3. Jeśli różne:
   - Zmień w WordPress na ten z Sheets
   - LUB zmień w Sheets na ten z WordPress
   - Save

4. Retry import
```

---

### Problem 3: Produkty nie importują się

**Objawy:**
- Klikasz "Import" ale nic się nie dzieje
- Lub error "Product import failed"

**Rozwiązanie:**
```
1. Sprawdź ASIN:
   - Musi mieć 10 znaków
   - Tylko alfanumeryczne (np. B08N5WRWNW)
   - Bez spacji, myślników

2. Sprawdź czy ASIN istnieje:
   - Otwórz: https://www.amazon.com/dp/B08N5WRWNW
   - Powinien wyświetlić produkt

3. Sprawdź region:
   - Amazon US (B08...) → Region: us-east-1
   - Amazon UK (B08...) → Region: eu-west-1
   - Amazon DE (B08...) → Region: eu-central-1

4. Sprawdź logi:
   WordPress Admin → WAAS Products → Cache
   Scroll to API Logs table
   Szukaj błędów
```

---

### Problem 4: Obrazki nie pobierają się

**Objawy:**
- Produkty importują się, ale bez featured image
- Placeholder image zamiast produktu

**Rozwiązanie:**
```
1. Sprawdź uprawnienia:
   WordPress wp-content/uploads/ folder musi być writable
   Permissions: 755 (folders), 644 (files)

2. Sprawdź URL obrazka:
   WordPress → Edit Product → Meta fields → Image URL
   Skopiuj URL
   Otwórz w przeglądarce
   Powinien wyświetlić obrazek

3. Test download:
   SSH do serwera:
   cd /tmp
   wget [image_url]

   Jeśli fail:
   - Może być blokada przez firewall
   - Dodaj user-agent do request

4. Manual fix:
   WordPress → Edit Product
   Upload featured image ręcznie
```

---

### Problem 5: Ceny nie aktualizują się

**Objawy:**
- Ceny produktów są stare (> 24h)
- Cron daily update nie działa

**Rozwiązanie:**
```
1. Sprawdź czy cron działa:
   Zainstaluj plugin: WP Crontrol
   WordPress Admin → Tools → Cron Events
   Znajdź: waas_pm_daily_update

2. Jeśli brak:
   Cron nie został utworzony podczas aktywacji
   Deactivate → Activate WAAS Product Manager plugin

3. Test manual run:
   WP Crontrol → Find "waas_pm_daily_update"
   Kliknij "Run Now"
   Poczekaj 1-2 minuty
   Sprawdź produkty (ceny powinny się zaktualizować)

4. Jeśli nadal nie działa:
   Sprawdź czy hosting wspiera WP-Cron
   Niektóre hostingi wyłączają WP-Cron
   Skonfiguruj system cron:
   crontab -e
   0 2 * * * wget -q -O - https://twoja-domena.pl/wp-cron.php?doing_wp_cron
```

---

### Problem 6: Google Sheets menu nie wyświetla się

**Objawy:**
- Brak menu "⚡ WAAS" w Google Sheets

**Rozwiązanie:**
```
1. Odśwież stronę (Ctrl+R)

2. Jeśli nadal brak:
   Apps Script → Uruchom: installWAAS() ponownie

3. Sprawdź triggers:
   Apps Script → Triggers (ikona zegara)
   Powinien być: onOpen → Head → From spreadsheet → On open

4. Jeśli brak triggera:
   Dodaj ręcznie:
   Apps Script → Triggers → Add Trigger
   Function: onOpen
   Event type: From spreadsheet
   Event: On open
   Save

5. Zamknij i otwórz arkusz ponownie
```

---

## 📚 DODATKOWE ZASOBY

### Dokumentacja:
- `README.md` - Główna dokumentacja projektu
- `FAZA_1_CORE_PATRONAGE_COMPLETED.md` - System patronatu
- `FAZA_2_WOOCOMMERCE_INTEGRATION_COMPLETE.md` - Integracja WooCommerce
- `FAZA_3_SALES_AUTOMATION_COMPLETE.md` - Automatyzacja sprzedaży
- `FAZA_4_MONITORING_COMPLETE.md` - Monitoring i zarządzanie kryzysowe
- `RAPORT_STANU_PROJEKTU.md` - Pełny raport stanu projektu

### Google Apps Script:
- `google-apps-script/README.md` - Dokumentacja Apps Script
- `google-apps-script/INSTALLATION_QUICKSTART.md` - Szybki start

### Support:
- GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
- Email: support@luko.ai

---

## ✅ POST-DEPLOYMENT CHECKLIST

Po wdrożeniu sprawdź:

- [ ] Wszystkie pluginy zainstalowane i aktywne
- [ ] Amazon PA-API connection test: ✅ Success
- [ ] Google Sheets connected: ✅ Success
- [ ] Zaimportowano przynajmniej 1 produkt testowy
- [ ] Shortcodes działają na stronie frontendowej
- [ ] Cron job `waas_pm_daily_update` jest zaplanowany
- [ ] Cache produktów działa (sprawdź wp_waas_product_cache table)
- [ ] Amazon disclosure wyświetla się
- [ ] Links afiliacyjne mają correct associate tag
- [ ] HTTPS działa (zielona kłódka)
- [ ] Backup skonfigurowany (daily)
- [ ] Uptime monitoring aktywny
- [ ] Google Analytics tracking działa

**Jeśli wszystko ✅ - gratulacje! System WAAS działa! 🎉**

---

**Dokument stworzony:** 2025-11-22
**Wersja:** 1.0.0
**Dla:** LUKO-WAAS 2.0 - WordPress Affiliate Automation System
