# WAAS Plugin Installation - Standalone Script

## Problem

Automatyczna instalacja pluginu WAAS Product Manager przez Google Apps Script kończy się niepowodzeniem z pustą odpowiedzią HTTP. To jest spowodowane problemem z obsługą multipart/form-data uploads w WordPress przez UrlFetchApp.

## Rozwiązanie

Stworzono standalone skrypt Node.js używający Playwright, który instaluje plugin bezpośrednio przez interfejs WordPress wp-admin.

## Wymagania

- Node.js 14 lub nowszy
- Dostęp administratora do WordPress
- Plik ZIP pluginu dostępny pod URL

## Instalacja

```bash
# W katalogu głównym projektu
npm install
```

## Użycie

### Instalacja WAAS Product Manager

```bash
node scripts/install-plugin-puppeteer.js \
  https://passgenaue-lkw-fussmatten.lk24.shop \
  admin \
  "TwojeHaslo" \
  https://lk24.shop/downloads/waas-product-manager.zip
```

### Parametry

1. **WP_URL** - Pełny URL strony WordPress (np. https://twoja-strona.com)
2. **USERNAME** - Nazwa użytkownika administratora WordPress
3. **PASSWORD** - Hasło użytkownika (w cudzysłowie jeśli zawiera spacje)
4. **PLUGIN_ZIP_URL** - URL do pliku ZIP z pluginem

## Jak działa

Skrypt wykonuje następujące kroki:

1. **Logowanie** - Loguje się do WordPress przez /wp-login.php
2. **Nawigacja** - Przechodzi na stronę plugin-install.php?tab=upload
3. **Download** - Pobiera plik ZIP pluginu z podanego URL
4. **Upload** - Wgrywa plik przez formularz WordPress
5. **Instalacja** - Klika przycisk "Install Now"
6. **Aktywacja** - Automatycznie aktywuje zainstalowany plugin

## Rozwiązywanie problemów

### Błąd: "Login failed"

- Sprawdź czy nazwa użytkownika i hasło są poprawne
- Upewnij się, że konto ma uprawnienia administratora

### Błąd: "Could not find plugin file input"

- Może być problem z motywem WordPress lub pluginami
- Spróbuj wyłączyć inne pluginy tymczasowo

### Błąd: "Download failed: server returned code 403"

- URL do pliku ZIP może być nieprawidłowy lub wymaga autoryzacji
- Sprawdź czy plik jest dostępny publicznie

## Integracja z Google Apps Script

Po naprawieniu instalacji, zaktualizuj także kod w Google Apps Script:

1. Otwórz Google Sheets z LUKO WAAS
2. Przejdź do Extensions → Apps Script
3. Znajdź plik `WordPressAPI.gs`
4. Zaktualizuj funkcję `installPluginOnWordPress` używając poprawionego kodu z tego repozytorium

Zmiany w `WordPressAPI.gs`:
- Dodano ręczną obsługę redirectów (followRedirects: false)
- Dodano logowanie response headers dla debugowania
- Dodano sprawdzanie response length

## Alternatywne rozwiązania

Jeśli skrypt Playwright nie działa w twoim środowisku:

1. **Ręczna instalacja przez wp-admin**
   - Zaloguj się do WordPress
   - Przejdź do Plugins → Add New → Upload Plugin
   - Wybierz plik ZIP i kliknij "Install Now"

2. **FTP Upload**
   - Rozpakuj ZIP lokalnie
   - Upload folder przez FTP do /wp-content/plugins/
   - Aktywuj plugin przez wp-admin

3. **WP-CLI** (jeśli dostępne na serwerze)
   ```bash
   wp plugin install https://lk24.shop/downloads/waas-product-manager.zip --activate
   ```

## Wsparcie

Jeśli nadal masz problemy:
1. Sprawdź logi w konsoli (--headless=false dla trybu widocznego)
2. Sprawdź czy WordPress nie ma włączonej 2FA
3. Sprawdź czy nie ma konfliktu z innymi pluginami bezpieczeństwa
