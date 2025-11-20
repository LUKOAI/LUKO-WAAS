# WAAS - Google Apps Script
## WordPress Affiliate Automation System - Instrukcja Konfiguracji

---

## 📋 KONKRETNE NAZWY - Dokładnie te nazwy będą używane!

### 🗂️ Nazwa głównego arkusza Google Sheets:
```
AmazonAffiliateProductsDashboard
```

### 📊 Nazwy kart (arkuszy) w pliku Google Sheets:

1. **ProductsToImport** - Lista produktów do zaimportowania do WordPress
2. **ProductsDatabase** - Baza danych wszystkich produktów
3. **Settings** - Konfiguracja i ustawienia
4. **Logs** - Logi wszystkich operacji
5. **Analytics** - Statystyki i analityka

---

## 📑 STRUKTURA KOLUMN

### ✅ Arkusz: **ProductsToImport**

| Kolumna A | Kolumna B | Kolumna C | Kolumna D | Kolumna E | Kolumna F |
|-----------|-----------|-----------|-----------|-----------|-----------|
| ASIN | Status | Last Sync | Import Date | Category | Notes |

**Przykładowe dane:**
```
ASIN           | Status  | Last Sync           | Import Date         | Category     | Notes
B08N5WRWNW     | Pending |                     |                     | electronics  | Apple AirPods Pro
B07XJ8C8F5     | Imported| 2025-01-15 10:30:00 | 2025-01-15 10:30:00| electronics  | Echo Dot 4th Gen
B09G9FPHY6     | Error   |                     |                     | electronics  | Błąd importu
```

**Dostępne statusy:**
- `Pending` - Oczekuje na import
- `Imported` - Zaimportowany pomyślnie
- `Error` - Błąd podczas importu

---

### 📦 Arkusz: **ProductsDatabase**

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ASIN | Product Name | Brand | Price | Savings % | Prime Eligible | Availability | Affiliate Link | Image URL | Category | Last Updated | WP Post ID | Features |

**Przykładowe dane:**
```
ASIN        | Product Name        | Brand | Price   | Savings % | Prime | Availability | Affiliate Link               | Image URL                    | Category    | Last Updated        | WP Post ID | Features
B08N5WRWNW  | AirPods Pro (2nd)  | Apple | $249.00 | 0         | YES   | in_stock     | https://amzn.to/3xyz...     | https://m.media-amazon.com..| electronics | 2025-01-15 10:30:00 | 123       | Active Noise Cancellation; Transparency mode; ...
```

---

### ⚙️ Arkusz: **Settings**

| Kolumna A | Kolumna B | Kolumna C |
|-----------|-----------|-----------|
| Setting Name | Value | Description |

**WAŻNE - Wypełnij te dane swoimi:**

```
Setting Name              | Value                                           | Description
WordPress URL             | https://twoja-domena.pl                         | Główny URL twojej strony WordPress
WordPress API Endpoint    | https://twoja-domena.pl/wp-json/waas/v1        | Endpoint REST API pluginu WAAS
API Key                   | twoj-tajny-klucz-api-123456                     | Klucz API do zabezpieczenia (opcjonalny)
Default Category          | outdoor-gear                                     | Domyślna kategoria dla nowych produktów
Auto Sync Enabled         | TRUE                                            | Czy automatycznie synchronizować produkty
Sync Interval Hours       | 24                                              | Co ile godzin synchronizować produkty
```

---

### 📝 Arkusz: **Logs**

| Kolumna A | Kolumna B | Kolumna C | Kolumna D | Kolumna E |
|-----------|-----------|-----------|-----------|-----------|
| Timestamp | Action | Status | Details | ASIN |

---

### 📈 Arkusz: **Analytics**

| Kolumna A | Kolumna B | Kolumna C |
|-----------|-----------|-----------|
| Metric | Value | Last Updated |

---

## 🚀 INSTRUKCJA KROK PO KROKU

### **Krok 1: Utwórz nowy Google Sheets**

1. Przejdź do https://sheets.google.com
2. Kliknij **"Pusty arkusz"** (Blank)
3. Nazwij plik: **`AmazonAffiliateProductsDashboard`**

---

### **Krok 2: Dodaj Google Apps Script**

1. W Google Sheets kliknij **Rozszerzenia** → **Apps Script**
2. Usuń domyślny kod
3. Skopiuj **CAŁY** kod z pliku `Code.gs`
4. Wklej do edytora Apps Script
5. Kliknij **💾 Zapisz** (Ctrl+S)
6. Nazwij projekt: **WAAS Amazon Products Manager**

---

### **Krok 3: Skonfiguruj plik appsscript.json**

1. W edytorze Apps Script kliknij **⚙️ Ustawienia projektu** (po lewej stronie)
2. Zaznacz **"Pokaż plik „appsscript.json" w edytorze"**
3. Wróć do **Edytora** (<> ikona)
4. Zobaczysz plik `appsscript.json`
5. Skopiuj zawartość z pliku `appsscript.json` w tym repozytorium
6. Wklej i zapisz

---

### **Krok 4: Uruchom konfigurację początkową**

1. Wróć do arkusza Google Sheets
2. Odśwież stronę (F5)
3. W menu zobaczysz **🚀 WAAS Amazon Products**
4. Kliknij **WAAS Amazon Products** → **⚙️ Konfiguracja początkowa**
5. Zaakceptuj uprawnienia (pierwszorazowo Google poprosi o dostęp)
6. Poczekaj na komunikat **✅ Konfiguracja zakończona!**

---

### **Krok 5: Wypełnij ustawienia**

1. Przejdź do karty **Settings**
2. Wypełnij swoje dane:

**Przykładowe dane do wypełnienia:**

| Setting Name | TWOJA WARTOŚĆ | Gdzie znaleźć |
|--------------|---------------|---------------|
| WordPress URL | `https://twojadomena.pl` | Twoja domena WordPress |
| WordPress API Endpoint | `https://twojadomena.pl/wp-json/waas/v1` | Twoja domena + `/wp-json/waas/v1` |
| API Key | `moj-super-tajny-klucz-2025` | Wymyśl własny klucz (min. 20 znaków) |
| Default Category | `outdoor-gear` | Slug kategorii w WordPress |

**⚠️ WAŻNE:** Ten sam **API Key** musisz wpisać w ustawieniach pluginu WordPress!

---

### **Krok 6: Skonfiguruj plugin WordPress**

1. Zaloguj się do WordPress Admin Panel
2. Przejdź do **WAAS Products** → **Settings**
3. Wypełnij **Amazon PA-API credentials**:
   - **Access Key**: `AKIAIOSFODNN7EXAMPLE` (zamień na swój)
   - **Secret Key**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (zamień na swój)
   - **Associate Tag**: `yoursite-20` (zamień na swój tracking ID)
   - **Region**: Wybierz swój region Amazon
4. Wypełnij **Google Sheets settings**:
   - **Google Sheets API Key**: Taki sam jak w arkuszu Settings (np. `moj-super-tajny-klucz-2025`)
5. Kliknij **Save Settings**

---

### **Krok 7: Testuj połączenie**

1. W Google Sheets kliknij **WAAS Amazon Products** → **🧪 Test połączenia z WordPress**
2. Jeśli zobaczysz **✅ Połączenie działa!** - wszystko jest OK!
3. Jeśli błąd - sprawdź:
   - Czy WordPress URL jest poprawny
   - Czy API Key jest taki sam w obu miejscach
   - Czy plugin WAAS jest aktywny w WordPress

---

## 📥 JAK IMPORTOWAĆ PRODUKTY

### **Metoda 1: Przez Google Sheets**

1. Przejdź do karty **ProductsToImport**
2. Dodaj ASINy produktów w kolumnie A:
   ```
   B08N5WRWNW
   B07XJ8C8F5
   B09G9FPHY6
   ```
3. W kolumnie E (Category) wpisz kategorię, np. `electronics`
4. Kliknij **WAAS Amazon Products** → **📥 Import produktów do WordPress**
5. Poczekaj na zakończenie (może potrwać 1-2 min na produkt)
6. Produkty pojawią się w WordPress i w karcie **ProductsDatabase**

### **Metoda 2: Bezpośrednio w WordPress**

1. W WordPress przejdź do **WAAS Products** → **Import Products**
2. Wpisz ASINy (jeden na linię):
   ```
   B08N5WRWNW
   B07XJ8C8F5
   B09G9FPHY6
   ```
3. Wybierz kategorię (opcjonalnie)
4. Kliknij **Import Products**

---

## 🔄 JAK SYNCHRONIZOWAĆ PRODUKTY

### **Automatyczna synchronizacja:**
- Plugin WordPress automatycznie synchronizuje produkty co 24h (o 2:00 w nocy)
- Ceny i dostępność są zawsze aktualne zgodnie z Amazon TOS

### **Ręczna synchronizacja:**
- W Google Sheets: **WAAS Amazon Products** → **🔄 Synchronizuj wszystkie produkty**
- W WordPress: **WAAS Products** → **Dashboard** → **Update All Products**

---

## 📱 SHORTCODES DO WYŚWIETLANIA PRODUKTÓW

### **Pojedynczy produkt:**
```
[waas_product asin="B08N5WRWNW" layout="horizontal"]
[waas_product asin="B07XJ8C8F5" layout="card" show_features="yes"]
```

### **Siatka produktów:**
```
[waas_grid asins="B08N5WRWNW,B07XJ8C8F5,B09G9FPHY6" columns="3"]
```

### **Produkty z kategorii:**
```
[waas_category category="outdoor-gear" items="12" columns="3"]
[waas_category category="electronics" items="6" columns="2"]
```

---

## 🔐 DEPLOYMENT WEB APP (Opcjonalne - dla zaawansowanych)

Jeśli chcesz aby WordPress mógł wysyłać dane DO Google Sheets:

1. W Apps Script kliknij **Wdróż** → **Nowe wdrożenie**
2. Typ: **Aplikacja internetowa**
3. Wykonuj jako: **Mnie**
4. Dostęp: **Każdy**
5. Kliknij **Wdróż**
6. Skopiuj **URL wdrożenia** (np. `https://script.google.com/macros/s/AKfyc...`)
7. W WordPress Settings wklej ten URL w **Google Sheets Webhook URL**

---

## 🛠️ ROZWIĄZYWANIE PROBLEMÓW

### **Błąd: "Unauthorized" lub 403**
- Sprawdź czy API Key jest identyczny w Google Sheets i WordPress
- Upewnij się że plugin WAAS jest aktywny

### **Błąd: "Product not found"**
- Sprawdź czy ASIN jest poprawny (10 znaków)
- Sprawdź czy PA-API credentials są poprawne w WordPress

### **Produkty nie importują się**
- Sprawdź kartę **Logs** w Google Sheets - zobacz szczegóły błędu
- Upewnij się że masz aktywne konto Amazon Associates
- Sprawdź czy API rate limit nie został przekroczony (max 1 request/s)

### **"Exception: Service invoked too many times"**
- Google Apps Script ma limity: 6 min execution time
- Importuj produkty partiami (max 20-30 na raz)

---

## 📊 PRZYKŁADOWE DANE TESTOWE

### **Popularne ASINy Amazon do testów:**

| ASIN | Produkt | Kategoria |
|------|---------|-----------|
| B08N5WRWNW | Apple AirPods Pro (2nd Generation) | electronics |
| B07XJ8C8F5 | Echo Dot (4th Gen) | electronics |
| B09G9FPHY6 | Kindle Paperwhite | electronics |
| B0B7CPSN1C | Fire TV Stick 4K Max | electronics |
| B09B8WNXR8 | Bose QuietComfort 45 | electronics |

---

## 🎯 PODSUMOWANIE NAZW - CHECKLISTA

✅ **Google Sheets:**
- Nazwa pliku: `AmazonAffiliateProductsDashboard`
- Karta 1: `ProductsToImport`
- Karta 2: `ProductsDatabase`
- Karta 3: `Settings`
- Karta 4: `Logs`
- Karta 5: `Analytics`

✅ **WordPress:**
- Plugin: `LUKO-WAAS Product Manager`
- Menu: `WAAS Products`
- Custom Post Type: `waas_product`
- REST API: `/wp-json/waas/v1`

✅ **Amazon:**
- Access Key: `TWÓJ_ACCESS_KEY_20_ZNAKÓW`
- Secret Key: `TWÓJ_SECRET_KEY_40_ZNAKÓW`
- Associate Tag: `yoursite-20` (zamień na swój)

---

## 📧 WSPARCIE

Pytania? Problemy? Sprawdź:
- 📖 README.md w głównym katalogu projektu
- 🔍 Logi w karcie **Logs** w Google Sheets
- ⚠️ Logi w WordPress: **WAAS Products** → **Cache** → API Logs

---

**Powodzenia z automatyzacją! 🚀**
