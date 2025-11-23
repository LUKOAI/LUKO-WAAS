# ⚡ WAAS 2.0 - INSTALLATION CHECKLIST
## Szybka instalacja w 10 minut

**Wydrukuj i odhaczaj podczas instalacji**

---

## 📦 PRZYGOTOWANIE (2 min)

### Co potrzebujesz:
- [ ] WordPress 5.8+ zainstalowany na hostingu
- [ ] Konto Amazon Associates + PA-API credentials
- [ ] Konto Google (dla Google Sheets)

### Przygotuj pliki:
- [ ] `waas-product-manager.zip` (gotowy)
- [ ] `waas-patronage-manager.zip` (gotowy)
- [ ] `divi-child-waas.zip` (opcjonalnie - jeśli Divi)
- [ ] `google-apps-script/WAAS_Complete_Installer.gs` (otwórz w edytorze)

---

## 🔌 WORDPRESS PLUGINS (2 min)

### Upload i aktywacja:
- [ ] WordPress Admin → Wtyczki → Dodaj nową → Prześlij wtyczkę
- [ ] Upload `waas-product-manager.zip` → Zainstaluj → **Aktywuj**
- [ ] Upload `waas-patronage-manager.zip` → Zainstaluj → **Aktywuj**
- [ ] (Opcjonalnie) Upload `divi-child-waas.zip` jako motyw → **Aktywuj**

### Sprawdź:
- [ ] Menu WordPress: **WAAS Products** ✅
- [ ] Menu WordPress: **WAAS Patronage** ✅

---

## 🔑 AMAZON PA-API (2 min)

### Pobierz credentials:
- [ ] Wejdź: https://affiliate-program.amazon.com/assoc_credentials/home
- [ ] Skopiuj **Access Key** (20 znaków): `____________________`
- [ ] Skopiuj **Secret Key** (40 znaków): `________________________________________`
- [ ] Skopiuj **Associate Tag**: `_______________`

### Skonfiguruj w WordPress:
- [ ] WordPress → **WAAS Products** → **Settings** → **Amazon API**
- [ ] Wklej: Access Key, Secret Key, Associate Tag
- [ ] Wybierz: Amazon Region (us-east-1 dla USA)
- [ ] Kliknij: **Save Settings**
- [ ] Kliknij: **Test API Connection** → Powinno być ✅ Success!

---

## 📊 GOOGLE SHEETS (3 min)

### Instalacja Apps Script:
- [ ] Wejdź: https://script.google.com
- [ ] Kliknij: **Nowy projekt**
- [ ] Skopiuj CAŁOŚĆ z `WAAS_Complete_Installer.gs`
- [ ] Wklej do Apps Script
- [ ] Zapisz (Ctrl+S)
- [ ] Wybierz funkcję: `installWAAS`
- [ ] Kliknij: ▶️ **Uruchom**
- [ ] Autoryzuj (popup Google) → **Zezwól**
- [ ] Poczekaj 30-60 sekund

### Skonfiguruj GLOBALNE API Keys:
⚠️ **WAŻNE:** Tylko parametry globalne! Per-site credentials (Divi Key, Amazon Tag) są w Sites!

- [ ] Apps Script → ⚙️ **Project Settings** → **Script Properties**
- [ ] Dodaj property: `PA_API_ACCESS_KEY` = `[Twój Access Key]` (global)
- [ ] Dodaj property: `PA_API_SECRET_KEY` = `[Twój Secret Key]` (global)
- [ ] Dodaj property: `DIVI_API_USERNAME` = `netanaliza` (global username)
- [ ] Kliknij: **Save script properties**

⚠️ **NIE dodawaj:**
- ❌ `DIVI_API_KEY` - jest per-site w zakładce Sites!
- ❌ `PA_API_PARTNER_TAG` - jest per-site jako Amazon Associate Tag!

### Skonfiguruj zakładkę Sites (KRYTYCZNE!):
⚠️ **WAAS 2.0:** Każda strona ma własne Divi API Key i Amazon Tag!

- [ ] Otwórz utworzony arkusz: `AmazonAffiliateProductsDashboard`
- [ ] Przejdź do karty: **Sites**
- [ ] Dodaj swoją pierwszą stronę (Row 2):
  - [ ] A2: `1` (ID)
  - [ ] B2: `[Nazwa strony]` (np. "Moja strona affiliate")
  - [ ] C2: `[Domena]` (np. "magnetbohrmaschine.lk24.shop")
  - [ ] D2: `[WordPress URL]` (np. "https://magnetbohrmaschine.lk24.shop")
  - [ ] E2: `[Admin Username]` (np. "netanaliza")
  - [ ] F2: `[Admin Password]` (Twoje hasło WordPress)
  - [ ] G2: `waas-api-[twoja-domena]-2025` (WP API Key - wymyśl własny)
  - [ ] **H2: [DIVI API KEY - UNIKALNY!]** ← KRYTYCZNE! (40 hex chars)
  - [ ] I2: `[Amazon Associate Tag]` (np. "yoursite-21")
  - [ ] J2: `pending` (Status)
  - [ ] K2: `FALSE` (Divi Installed)
  - [ ] L2: `FALSE` (Plugin Installed)
  - [ ] M2: _(puste)_ (Last Check)

**Jak uzyskać Divi API Key (kolumna H2):**
- [ ] Wejdź: https://www.elegantthemes.com/members-area/api/
- [ ] Kliknij: **Add New API Key**
- [ ] Wpisz nazwę: `[nazwa twojej strony]`
- [ ] Kliknij: **Generate API Key**
- [ ] Skopiuj 40-znakowy klucz hex (np. `c12d038b32b1f2356c705ede89bf188b0abf6a51`)
- [ ] Wklej do kolumny H2

⚠️ **KAŻDA strona MUSI mieć własny, unikalny Divi API Key!**

### Skonfiguruj arkusz Settings (opcjonalnie):
- [ ] Przejdź do karty: **Settings**
- [ ] Sprawdź globalne parametry (są już skonfigurowane automatycznie)

---

## 🔗 POŁĄCZENIE SHEETS ↔ WORDPRESS (1 min)

### Skonfiguruj WordPress:
- [ ] WordPress → **WAAS Products** → **Settings** → **Google Sheets** tab
- [ ] Google Sheets API Key: `moj-tajny-klucz-2025` (TEN SAM co w Sheets C2!)
- [ ] Kliknij: **Save Settings**

### Test połączenia:
- [ ] Google Sheets → Menu: **⚡ WAAS** → **🧪 Test połączenia**
- [ ] Powinno pokazać: ✅ Połączono z WordPress!

---

## ✅ TEST - IMPORT PRODUKTU (2 min)

### Import z Google Sheets:
- [ ] Google Sheets → karta: **Products**
- [ ] A2: `B08N5WRWNW` (ASIN - Apple AirPods)
- [ ] E2: `electronics` (kategoria)
- [ ] Menu: **⚡ WAAS** → **📥 Import produktów do WordPress**
- [ ] Poczekaj 10-20 sekund

### Sprawdź w WordPress:
- [ ] WordPress → **WAAS Products** → **All Products**
- [ ] Powinien być produkt: "Apple AirPods Pro..." ✅

### Test shortcode:
- [ ] WordPress → Pages → Add New → "Test WAAS"
- [ ] Dodaj: `[waas_product asin="B08N5WRWNW"]`
- [ ] **Publish** → **View Page**
- [ ] Powinno wyświetlić: obrazek, tytuł, cenę, przycisk Amazon ✅

---

## 🎉 GOTOWE!

### Wszystko działa jeśli:
- [x] WordPress pluginy zainstalowane i aktywne
- [x] Amazon PA-API test: ✅ Connection successful
- [x] Google Sheets test: ✅ Połączono z WordPress
- [x] Produkt zaimportował się poprawnie
- [x] Shortcode wyświetla produkt na stronie

---

## 📝 NOTATKI I DANE

**WordPress URL:**
```
_______________________________________________
```

**Google Sheets API Key (ZAPISZ BEZPIECZNIE!):**
```
_______________________________________________
```

**Amazon Associate Tag:**
```
_______________________________________________
```

**Google Sheets URL:**
```
_______________________________________________
```

**WooCommerce zainstalowany?** ☐ TAK ☐ NIE

**Divi theme zainstalowany?** ☐ TAK ☐ NIE

---

## 🔥 NAJCZĘSTSZE PROBLEMY

### ❌ "Unauthorized" w Google Sheets
**Fix:** Sprawdź czy API Key w Sheets (C2) = API Key w WordPress Settings

### ❌ "Invalid credentials" Amazon API
**Fix:** Sprawdź Access Key i Secret Key w WordPress Settings

### ❌ Produkt nie importuje się
**Fix:** Sprawdź ASIN (10 znaków), region (us-east-1 dla USA)

### ❌ Menu "WAAS" nie wyświetla się w Sheets
**Fix:** Zamknij i otwórz arkusz ponownie, odśwież (Ctrl+R)

---

## 📞 POMOC

**Pełna dokumentacja:** `DEPLOYMENT_GUIDE.md`

**Support:**
- GitHub: https://github.com/LUKOAI/LUKO-WAAS/issues
- Email: support@luko.ai

---

**Data instalacji:** ___________________

**Zainstalował:** ___________________

**Status:** ☐ **GOTOWE! System działa!** 🎉

---

**WAAS 2.0 - WordPress Affiliate Automation System**
**© 2025 LUKO AI Team**
