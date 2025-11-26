# 🚀 INSTALLATION GUIDE - WOOCOMMERCE STRUCTURE AUTOMATION

**Automatyczne tworzenie struktury WooCommerce przez Google Sheets**

**Wersja:** 1.0.0
**Data:** 2025-11-26

---

## 📋 WYMAGANIA

- WordPress 5.8+
- WooCommerce 5.0+
- PHP 7.4+
- Plugin **WAAS Product Manager** zainstalowany i aktywny
- Google Sheets z odpowiednią strukturą arkuszy
- Google Apps Script skonfigurowany

---

## 🔧 KROK 1: INSTALACJA PLUGINU WAAS PRODUCT MANAGER

### Opcja A: Przez WordPress Admin Panel

1. Pobierz najnowszą wersję pluginu `waas-product-manager` z repozytorium
2. W WordPressie: **Wtyczki → Dodaj nową → Wgraj wtyczkę**
3. Wybierz plik ZIP i kliknij **Instaluj**
4. Po instalacji kliknij **Aktywuj**

### Opcja B: Przez SFTP/SSH

```bash
# Wgraj katalog pluginu do WordPress
scp -r wordpress-plugin/waas-product-manager user@your-server:/path/to/wordpress/wp-content/plugins/

# Lub przez SSH
ssh user@your-server
cd /path/to/wordpress/wp-content/plugins/
# Wklej katalog waas-product-manager
```

Następnie w WordPressie aktywuj plugin.

---

## ⚙️ KROK 2: KONFIGURACJA PLUGINU

### Ustawienia Amazon API

1. W WordPress admin panel: **Amazon Products → Settings**
2. Wypełnij sekcję **Amazon Product Advertising API Settings**:
   - **Access Key**: Twój Amazon PA-API Access Key (20 znaków)
   - **Secret Key**: Twój Amazon PA-API Secret Key (40 znaków)
   - **Associate Tag (Partner Tag)**: Domyślny tag (np. `yoursite-20`)
   - **Amazon Region**: Wybierz region (np. `eu-central-1` dla Niemiec)

3. Kliknij **Save Settings**

### Test API Connection

1. W sekcji **Test API Connection** wpisz testowy ASIN (np. `B08N5WRWNW`)
2. Kliknij **Test API Connection**
3. Sprawdź czy zwraca sukces

---

## 📊 KROK 3: PRZYGOTOWANIE GOOGLE SHEETS

### Stwórz nowe arkusze

W swoim Google Spreadsheet dodaj następujące zakładki:

1. **WC_Structure_Config** - Główna konfiguracja
2. **WC_Product_Categories** - Kategorie produktów
3. **WC_Product_Attributes** - Atrybuty produktów
4. **WC_Attribute_Values** - Wartości atrybutów
5. **WC_Product_Tags** - Tagi produktów
6. **WC_Post_Categories** - Kategorie postów
7. **WC_Post_Tags** - Tagi postów
8. **WC_Pages** - Strony WordPress
9. **WC_Menus** - Menu
10. **WC_Menu_Items** - Elementy menu

### Struktura arkuszy

Szczegółowa struktura każdego arkusza znajduje się w: `/docs/WOOCOMMERCE_STRUCTURE_SHEETS.md`

---

## 📝 KROK 4: PRZYGOTOWANIE APPS SCRIPT

### Dodaj kod do Apps Script

1. W Google Sheets: **Extensions → Apps Script**
2. Dodaj nowy plik: `WooStructureAutomation.gs`
3. Wklej kod z: `/google-apps-script/WooStructureAutomation.gs`
4. Zapisz projekt

### Skonfiguruj trigger onEdit

```javascript
function createStructureTrigger() {
  // Usuń stare triggery
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onStructureExecuteChange') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Stwórz nowy trigger
  ScriptApp.newTrigger('onStructureExecuteChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}
```

Uruchom funkcję `createStructureTrigger()` raz, żeby stworzyć trigger.

---

## 🎯 KROK 5: WYPEŁNIENIE DANYCH

### Przykładowa konfiguracja dla strony niemieckiej

#### WC_Structure_Config (wiersz 2):

```
A: CFG-001
B: passgenaue-lkw-fussmatten.lk24.shop
C: de
D: KRAM TRUCK
E: FALSE
F: pending
G: (puste)
H: (puste)
```

#### WC_Product_Categories:

```
Row 2: CFG-001, CAT-001, Nach Fahrzeug, nach-fahrzeug, , Finden Sie Zubehör nach Fahrzeug, 1
Row 3: CFG-001, CAT-002, Mercedes-Benz, mercedes-benz, CAT-001, Zubehör für Mercedes, 1
Row 4: CFG-001, CAT-003, Actros MP4, actros-mp4, CAT-002, Für Actros MP4 2011-2019, 1
```

#### WC_Product_Attributes:

```
Row 2: CFG-001, ATTR-001, Fahrzeugmarke, fahrzeugmarke, select
Row 3: CFG-001, ATTR-002, Material, material, select
```

#### WC_Attribute_Values:

```
Row 2: CFG-001, ATTR-001, Mercedes-Benz, 1
Row 3: CFG-001, ATTR-001, Scania, 2
Row 4: CFG-001, ATTR-001, Volvo, 3
Row 5: CFG-001, ATTR-002, Kunstleder, 1
Row 6: CFG-001, ATTR-002, Gummi, 2
```

#### WC_Pages:

```
Row 2: CFG-001, PG-001, Startseite, startseite, , , TRUE, FALSE, 1
Row 3: CFG-001, PG-002, Shop, shop, , [products], FALSE, FALSE, 2
Row 4: CFG-001, PG-003, Blog, blog, , , FALSE, TRUE, 3
Row 5: CFG-001, PG-004, Impressum, impressum, , <h2>Impressum nach §5 TMG</h2>, FALSE, FALSE, 10
```

#### WC_Menus:

```
Row 2: CFG-001, MNU-001, Main Menu, primary_menu
Row 3: CFG-001, MNU-002, Footer Menu, footer_menu
```

#### WC_Menu_Items:

```
Row 2: CFG-001, MNU-001, MI-001, Home, page, PG-001, , , 1
Row 3: CFG-001, MNU-001, MI-002, Produkte, custom, , /shop/, , 2
Row 4: CFG-001, MNU-001, MI-003, LKW Fußmatten, product_cat, CAT-005, , MI-002, 1
Row 5: CFG-001, MNU-001, MI-004, Blog, page, PG-003, , , 3
Row 6: CFG-001, MNU-002, MI-010, Impressum, page, PG-004, , , 1
```

---

## 🚀 KROK 6: URUCHOMIENIE SETUPU

### Wykonaj setup

1. Sprawdź czy wszystkie dane są poprawnie wypełnione
2. Otwórz arkusz **WC_Structure_Config**
3. W wierszu z Twoim config_id zaznacz checkbox w kolumnie **E (execute)**
4. System automatycznie:
   - Zmieni status na `running`
   - Wygeneruje plugin PHP
   - Wgra plugin na WordPress
   - Aktywuje plugin
   - Sprawdzi wykonanie
   - Usuwa plugin
   - Zmieni status na `completed`

### Monitorowanie procesu

Obserwuj kolumny w **WC_Structure_Config**:

- **F (status)**: `pending` → `running` → `completed` (lub `error`)
- **G (last_run)**: Data ostatniego wykonania
- **H (error_message)**: Komunikat błędu (jeśli wystąpił)

---

## ✅ KROK 7: WERYFIKACJA

### Sprawdź strukturę w WordPress

1. **Kategorie produktów**: **Produkty → Kategorie**
2. **Atrybuty**: **Produkty → Atrybuty**
3. **Tagi produktów**: **Produkty → Tagi**
4. **Strony**: **Strony → Wszystkie strony**
5. **Menu**: **Wygląd → Menu**
6. **Strona główna**: **Ustawienia → Czytanie** - sprawdź czy ustawiona

### Test frontend

1. Odwiedź stronę główną: `https://passgenaue-lkw-fussmatten.lk24.shop`
2. Sprawdź menu nawigacyjne
3. Sprawdź czy strony działają
4. Sprawdź kategorię Shop

---

## 🔧 TROUBLESHOOTING

### Problem: Status zmienia się na "error"

**Sprawdź:**
1. Kolumnę **H (error_message)** w WC_Structure_Config
2. Logi w Google Apps Script: **Executions**
3. Logi WordPress: **WP_DEBUG** w `wp-config.php`

### Problem: Plugin nie wgrywa się

**Możliwe przyczyny:**
- Niepoprawne dane logowania w arkuszu Sites
- Brak uprawnień do wgrywania pluginów
- Problem z połączeniem WordPress REST API

**Rozwiązanie:**
1. Sprawdź dane w arkuszu **Sites** (kolumny E, F - username, password)
2. Sprawdź czy użytkownik ma uprawnienie `install_plugins`
3. Przetestuj endpoint: `https://your-site.com/wp-json/waas/v1/setup-status`

### Problem: Struktura nie tworzy się

**Możliwe przyczyny:**
- WooCommerce nie jest aktywne
- Błędy w danych (parent_cat_id wskazuje na nieistniejącą kategorię)

**Rozwiązanie:**
1. Sprawdź czy WooCommerce jest aktywne
2. Zweryfikuj hierarchie (parent_cat_id, parent_page_id)
3. Sprawdź slug'i (bez polskich znaków, małe litery, myślniki)

---

## 🔄 AKTUALIZACJA STRUKTURY

### Jak dodać nowe kategorie/strony?

1. Dodaj nowe wiersze w odpowiednich arkuszach
2. Użyj tego samego **config_id**
3. Zaznacz checkbox **execute** ponownie
4. System doda nowe elementy (nie nadpisze istniejących)

---

## 📚 DODATKOWE ZASOBY

- **Struktura arkuszy:** `/docs/WOOCOMMERCE_STRUCTURE_SHEETS.md`
- **Apps Script kod:** `/google-apps-script/WooStructureAutomation.gs`
- **REST API plugin:** `/wordpress-plugin/waas-product-manager/includes/class-structure-api.php`

---

## 🆘 SUPPORT

W razie problemów sprawdź:

1. **Google Apps Script Logs**: Extensions → Apps Script → Executions
2. **WordPress Debug Log**: `wp-content/debug.log` (włącz WP_DEBUG)
3. **Browser Console**: F12 → Console (dla błędów JavaScript)

---

## 🎉 GOTOWE!

Twoja struktura WooCommerce jest skonfigurowana! Możesz teraz:

1. Dodawać produkty Amazon
2. Tworzyć treści
3. Rozwijać strukturę kategorii
4. Tworzyć nowe strony i menu

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - WordPress Affiliate Automation System**
