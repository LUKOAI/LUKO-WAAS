# 🚀 WAAS - Instrukcja Instalacji (NOWA WERSJA)

## ✅ CO ZMIENILIŚMY?

**Stara wersja (setup.gs):**
- ❌ Tworzyła NOWY arkusz Google Sheets
- ❌ Nie instalowała plików skryptowych (były puste funkcje)
- ❌ Efekt: Tylko struktura arkusza, brak funkcjonalności

**Nowa wersja (WAAS_Complete_Installer.gs):**
- ✅ Instaluje w **BIEŻĄCYM** arkuszu (tym który masz otwarty)
- ✅ Wszystkie moduły WAAS **wbudowane** w jeden plik (3651 linii kodu!)
- ✅ Działa **natychmiast** po uruchomieniu - pełna funkcjonalność

---

## 📋 KROK PO KROKU - INSTALACJA

### 1. Przygotowanie

Otwórz **pusty** Google Sheets LUB ten arkusz, w którym chcesz zainstalować WAAS.

🔗 **Link:** https://docs.google.com/spreadsheets/

### 2. Otwórz Apps Script

W Google Sheets:
- Kliknij: **Extensions** → **Apps Script**
- Otwiera się edytor kodu

### 3. Usuń domyślny kod

W edytorze zobaczysz domyślny kod:
```javascript
function myFunction() {

}
```

**Usuń wszystko** (Ctrl+A → Delete)

### 4. Wklej kod WAAS

Otwórz plik: `WAAS_Complete_Installer.gs`

📁 **Lokalizacja:** `google-apps-script/WAAS_Complete_Installer.gs`

**Skopiuj CAŁĄ zawartość** (3651 linii) i wklej do edytora Apps Script

### 5. Zapisz projekt

- Kliknij: **Ctrl+S** (lub ikonka dyskietki)
- Nazwij projekt: `WAAS System`

### 6. Uruchom instalację

W edytorze Apps Script:
1. Wybierz funkcję: `installWAAS` (z menu dropdown na górze)
2. Kliknij: ▶️ **Run**

### 7. Autoryzacja Google

Przy pierwszym uruchomieniu Google poprosi o autoryzację:

1. Kliknij: **Review permissions**
2. Wybierz swoje konto Google
3. Kliknij: **Advanced** → **Go to WAAS System (unsafe)**
4. Kliknij: **Allow**

⚠️ **Uwaga:** Google pokazuje to jako "unsafe" bo to nieopublikowana aplikacja, ale to Twój własny kod - jest bezpieczny!

### 8. Instalacja zakończona!

W logach (Execution log) zobaczysz:
```
🚀 Starting WAAS installation...
📊 Creating Google Sheets structure...
⚙️ Setting up menus and triggers...
🔧 Initializing settings...
✅ Installation completed successfully!
```

Pojawi się również dialog z informacjami o następnych krokach.

### 9. Konfiguracja API Keys

**To NAJWAŻNIEJSZY krok - bez tego WAAS nie będzie działał!**

W edytorze Apps Script:
1. Kliknij: **⚙️ Project Settings** (ikona zębatki po lewej)
2. Przewiń do sekcji: **Script Properties**
3. Kliknij: **Add script property**

Dodaj następujące właściwości:

| Property Name | Value (Przykład) | Gdzie to znaleźć? |
|--------------|------------------|-------------------|
| `DIVI_API_USERNAME` | `netanaliza` | Twój login do Elegant Themes |
| `DIVI_API_KEY` | `2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4` | [Elegant Themes → Account](https://www.elegantthemes.com/members-area/api/) |
| `PA_API_ACCESS_KEY` | `AKIAIOSFODNN7EXAMPLE` | [Amazon PA API Console](https://webservices.amazon.com/paapi5/documentation/) |
| `PA_API_SECRET_KEY` | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | Jw. |
| `PA_API_PARTNER_TAG` | `yourtaghere-20` | Twój Amazon Associate Tag |
| `HOSTINGER_API_KEY` | `opcional` | (Opcjonalnie) Hostinger API |

4. Kliknij: **Save script properties**

### 10. Przeładuj arkusz

Wróć do Google Sheets i naciśnij **F5** (lub odśwież przeglądarkę)

### 11. Gotowe! 🎉

W Google Sheets powinieneś zobaczyć:

**Menu:**
```
⚡ WAAS
 ├─ 🌐 Sites
 ├─ 📦 Products
 ├─ 📝 Content
 ├─ ⚙️ Tasks
 ├─ 🔧 Settings
 └─ 📖 Documentation
```

**Zakładki (arkusze):**
- Sites
- Products
- Tasks
- Content Queue
- Logs
- Settings

---

## 🧪 TEST INSTALACJI

Sprawdź czy wszystko działa:

1. Kliknij: **⚡ WAAS** → **🔧 Settings** → **Test Connections**
2. Powinieneś zobaczyć status API keys:
   ```
   ✅ Divi API: Configured
   ✅ Amazon PA API: Configured
   ⚠️ Hostinger API: Not configured (Optional)
   ```

---

## 🆚 PORÓWNANIE: Stara vs Nowa Instalacja

### Stara metoda (setup.gs)

```javascript
// 1. Tworzy NOWY arkusz
const spreadsheet = SpreadsheetApp.create('WAAS - ...');  ❌

// 2. Funkcje instalacyjne są puste
function installCoreScript() {
  // Ten plik zawiera główne funkcje konfiguracyjne
  // Będzie utworzony jako osobny plik w projekcie  ❌ NIE ROBI NIC!
}
```

**Efekt:** Arkusz z zakładkami, ale ZERO funkcji w skryptach!

### Nowa metoda (WAAS_Complete_Installer.gs)

```javascript
// 1. Używa BIEŻĄCEGO arkusza
const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();  ✅

// 2. Wszystkie funkcje już wbudowane w pliku (3651 linii)
// - Core.gs
// - Menu.gs
// - SiteManager.gs
// - ProductManager.gs
// - TaskManager.gs
// - ContentGenerator.gs
// - DiviAPI.gs
// - WordPressAPI.gs
// - AmazonPA.gs

✅ WSZYSTKO DZIAŁA OD RAZU!
```

---

## ❓ Najczęstsze Problemy

### Problem 1: "getUi() is not defined"

**Przyczyna:** Uruchamiasz skrypt z edytora Apps Script (nie ma tam UI)

**Rozwiązanie:** To normalne! Sprawdź **Execution log** - jeśli instalacja się powiodła, wszystko jest OK.

### Problem 2: Menu WAAS nie pojawia się

**Rozwiązanie:**
1. Przeładuj arkusz (F5)
2. Sprawdź czy funkcja `onOpen()` jest w kodzie
3. Zamknij i otwórz arkusz ponownie

### Problem 3: "API key not configured"

**Rozwiązanie:** Musisz dodać API keys w **Script Properties** (krok 9)

### Problem 4: Puste zakładki

**Rozwiązanie:** To normalne! Zakładki są puste przy pierwszej instalacji. Użyj menu WAAS aby dodać dane.

---

## 📚 Co dalej?

1. **Dodaj pierwszą stronę WordPress:**
   - Menu: **⚡ WAAS** → **🌐 Sites** → **Add New Site**

2. **Zaimportuj produkty z Amazon:**
   - Menu: **⚡ WAAS** → **📦 Products** → **Import from Amazon**

3. **Wygeneruj treść:**
   - Menu: **⚡ WAAS** → **📝 Content** → **Generate Content**

---

## 🛠️ Dla Deweloperów

### Struktura pliku

```
WAAS_Complete_Installer.gs (3651 linii)
├─ Funkcja instalacyjna: installWAAS()
├─ Tworzenie arkuszy: createSheetsStructure()
├─ [LINIA 355+] Wszystkie moduły WAAS:
│  ├─ Core.gs (399 linii)
│  ├─ Menu.gs (630 linii)
│  ├─ SiteManager.gs (383 linii)
│  ├─ ProductManager.gs (273 linii)
│  ├─ TaskManager.gs (326 linii)
│  ├─ ContentGenerator.gs (391 linii)
│  ├─ DiviAPI.gs (193 linii)
│  ├─ WordPressAPI.gs (353 linii)
│  └─ AmazonPA.gs (357 linii)
```

### Jak to działa?

1. `installWAAS()` używa `SpreadsheetApp.getActiveSpreadsheet()` - instaluje w bieżącym arkuszu
2. Wszystkie moduły WAAS są już w pliku - nie trzeba ich pobierać ani instalować
3. Menu `onOpen()` dodaje się automatycznie przy każdym otwarciu arkusza

---

## 📞 Wsparcie

- GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
- Dokumentacja: [README.md](../README.md)

---

**Autor:** LUKOAI
**Wersja:** 1.1.0
**Data:** 2024

✅ **GOTOWE! Miłej pracy z WAAS!** 🚀
