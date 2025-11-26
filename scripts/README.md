# 🛠️ WAAS 2.0 - Skrypty Instalacyjne

Automatyczne skrypty do instalacji i konfiguracji WordPress Affiliate Automation System.

---

## 📦 Dostępne Skrypty

### 🚀 `quickstart.sh` - **GŁÓWNY SKRYPT (ZACZNIJ TUTAJ!)**

Interaktywne menu z wszystkimi opcjami instalacji i konfiguracji.

**Uruchomienie:**
```bash
./scripts/quickstart.sh
```

**Funkcje:**
- ✅ Pełna instalacja (przygotuj wszystkie pakiety)
- ✅ Weryfikacja projektu
- ✅ Tworzenie poszczególnych pakietów
- ✅ Wyświetlanie instrukcji
- ✅ Test API WordPress
- ✅ Pomoc z konfiguracją kluczy API
- ✅ Statystyki projektu

---

### 🔧 `install.sh` - Pełna Instalacja

Automatycznie przygotowuje wszystkie pakiety do instalacji.

**Uruchomienie:**
```bash
./scripts/install.sh
```

**Co robi:**
1. Sprawdza wymagania systemowe
2. Pakuje WordPress plugin do ZIP
3. Łączy wszystkie moduły Google Apps Script w jeden plik
4. Generuje pełną dokumentację instalacji
5. Tworzy folder `dist/` z gotowymi pakietami

**Efekt:**
```
dist/
├── waas-product-manager.zip        ← Upload do WordPress
├── WAAS_Complete_Installer.gs      ← Wklej do Google Apps Script
└── INSTALL_INSTRUCTIONS.txt        ← Szczegółowa instrukcja
```

---

### ✅ `verify-installation.sh` - Weryfikacja

Sprawdza czy wszystkie komponenty projektu są na miejscu.

**Uruchomienie:**
```bash
./scripts/verify-installation.sh
```

**Co sprawdza:**
- ✅ Struktura katalogów
- ✅ Pliki WordPress plugin
- ✅ Pliki Google Apps Script
- ✅ Dokumentacja
- ✅ Pakiety instalacyjne (dist/)
- ✅ Konfiguracja (.env)

**Gdy użyć:**
- Przed rozpoczęciem instalacji
- Po sklonowaniu repo
- Gdy coś nie działa

---

### 🚀 `setup-phase-a.gs` - **AUTOMATYCZNA KONFIGURACJA PHASE A**

Automatycznie tworzy arkusz **WC_Pages** i konfiguruje wszystkie domyślne strony WordPress.

**Uruchomienie:**
1. Otwórz Google Sheet (AmazonAffiliateProductsDashboard)
2. Extensions > Apps Script
3. Skopiuj i wklej cały kod z `scripts/setup-phase-a.gs`
4. Uruchom funkcję: `setupPhaseA`
5. Gotowe! 🎉

**Co robi:**
- ✅ Tworzy arkusz "WC_Pages"
- ✅ Dodaje 4 domyślne strony: Home, Shop, About, Patronage
- ✅ Konfiguruje nagłówki i formatowanie
- ✅ Dodaje menu "🚀 WAAS Phase A" do Google Sheets
- ✅ Umożliwia eksport do CSV

**Funkcje dostępne:**
```javascript
setupPhaseA()           // Główna funkcja - utwórz wszystko
exportPagesAsCSV()      // Eksportuj arkusz jako CSV
clearPagesSheet()       // Wyczyść arkusz
```

**Menu w Google Sheets:**
Po instalacji zobaczysz menu "🚀 WAAS Phase A" z opcjami:
- Setup Phase A (utwórz arkusz WC_Pages)
- Eksportuj jako CSV
- Wyczyść arkusz WC_Pages
- Dokumentacja

**⚠️ Uwaga:** To Google Apps Script (.gs) - uruchamiaj w Google Sheets!

**Dokumentacja:** `docs/PHASE_A_PAGE_AUTOMATION.md`

---

### 📜 `migrate-to-per-site-divi-keys.gs` - Migracja

Skrypt migracyjny dla użytkowników starszej wersji WAAS.

**Dla kogo:**
- Użytkownicy upgradu WAAS 1.0 → 2.0
- Migracja z globalnych kluczy Divi do per-site

**⚠️ Uwaga:** To nie jest skrypt bash! To Google Apps Script (.gs)

---

## 🚀 Quick Start - 3 Krok do Sukcesu

### Metoda 1: Dla Początkujących (PROSTE!)

```bash
# Krok 1: Uruchom menu
./scripts/quickstart.sh

# Krok 2: Wybierz opcję 1 (Pełna instalacja)
# Krok 3: Postępuj zgodnie z instrukcjami w dist/INSTALL_INSTRUCTIONS.txt
```

### Metoda 2: Dla Zaawansowanych (SZYBKIE!)

```bash
# Krok 1: Weryfikuj projekt
./scripts/verify-installation.sh

# Krok 2: Przygotuj pakiety
./scripts/install.sh

# Krok 3: Instaluj ręcznie
# - Upload dist/waas-product-manager.zip do WordPress
# - Wklej dist/WAAS_Complete_Installer.gs do Google Apps Script
```

### Metoda 3: Setup Phase A - Automatyczne Tworzenie Stron (NOWE! 🎉)

**W Google Sheets:**
```
1. Otwórz swój Google Sheet
2. Extensions > Apps Script
3. Skopiuj kod z scripts/setup-phase-a.gs
4. Uruchom funkcję: setupPhaseA
5. Arkusz WC_Pages zostanie utworzony automatycznie!
```

**Następnie:**
- Edytuj treści stron w kolumnie "content"
- Dodaj własne strony (skopiuj wiersz i zmień dane)
- W WC_Structure_Config ustaw execute=TRUE
- Plugin automatycznie utworzy strony w WordPress

**Dokumentacja:** `docs/PHASE_A_PAGE_AUTOMATION.md`

---

## 📋 Wymagania Systemowe

Skrypty wymagają:
- ✅ Bash shell (Linux, macOS, WSL)
- ✅ `curl` - HTTP requests
- ✅ `zip` - Pakowanie plików
- ✅ `git` - Operacje na repo
- ✅ `python3` (opcjonalnie) - Formatowanie JSON

**Instalacja na Ubuntu/Debian:**
```bash
sudo apt-get install curl zip git python3
```

**Instalacja na macOS:**
```bash
brew install curl zip git python3
```

---

## 🔧 Rozwiązywanie Problemów

### ❌ "Permission denied" podczas uruchamiania skryptu

**Problem:** Skrypt nie ma uprawnień wykonywania.

**Rozwiązanie:**
```bash
chmod +x scripts/*.sh
./scripts/quickstart.sh
```

---

### ❌ "command not found: zip"

**Problem:** Brak narzędzia `zip`.

**Rozwiązanie:**
```bash
# Ubuntu/Debian
sudo apt-get install zip

# macOS
brew install zip
```

---

### ❌ Skrypt nie znajduje plików projektu

**Problem:** Uruchomiono skrypt z niewłaściwego katalogu.

**Rozwiązanie:**
```bash
# Przejdź do głównego katalogu projektu
cd /path/to/LUKO-WAAS

# Uruchom skrypt
./scripts/quickstart.sh
```

---

### ❌ "dist/ folder is empty"

**Problem:** Nie uruchomiono jeszcze instalatora.

**Rozwiązanie:**
```bash
./scripts/install.sh
```

---

## 📚 Szczegółowa Dokumentacja

Po uruchomieniu `install.sh`, pełna instrukcja instalacji znajduje się w:

```
dist/INSTALL_INSTRUCTIONS.txt
```

Ten plik zawiera:
- ✅ Krok po kroku instrukcje
- ✅ Screenshots gdzie co wkleić
- ✅ Konfigurację wszystkich API keys
- ✅ Rozwiązywanie problemów
- ✅ Testy połączenia

---

## 🎯 Przykładowe Workflow

### Nowa Instalacja

```bash
# 1. Sklonuj repo
git clone https://github.com/LUKOAI/LUKO-WAAS.git
cd LUKO-WAAS

# 2. Weryfikuj
./scripts/verify-installation.sh

# 3. Przygotuj pakiety
./scripts/install.sh

# 4. Otwórz instrukcje
cat dist/INSTALL_INSTRUCTIONS.txt

# 5. Zainstaluj zgodnie z instrukcjami
```

### Aktualizacja Istniejącej Instalacji

```bash
# 1. Pull najnowsze zmiany
git pull origin main

# 2. Przebuduj pakiety
./scripts/install.sh

# 3. Re-upload pluginu do WordPress
# 4. Zaktualizuj Google Apps Script
```

### Dodanie Nowej Strony

```bash
# 1. Uruchom menu
./scripts/quickstart.sh

# 2. Wybierz opcję 8 (Pomoc z API keys)
# 3. Postępuj zgodnie z instrukcjami dla per-site credentials
```

---

## 🔑 Konfiguracja API Keys - Szybkie Przypomnienie

### GLOBALNE (Script Properties w Google Apps Script):
```
PA_API_ACCESS_KEY      = [Amazon Access Key]
PA_API_SECRET_KEY      = [Amazon Secret Key]
DIVI_API_USERNAME      = netanaliza
```

### PER-SITE (Zakładka Sites w Google Sheets):
```
Kolumna G: WP_API_KEY          = waas-api-[domena]-2025
Kolumna H: DIVI_API_KEY        = [40-char hex, unikalny!]
Kolumna I: Amazon Associate Tag = yoursite-21
```

**⚠️ KAŻDA STRONA POTRZEBUJE WŁASNYCH KLUCZY!**

---

## 🆘 Wsparcie

### Problemy ze skryptami?

1. **Weryfikuj:**
   ```bash
   ./scripts/verify-installation.sh
   ```

2. **Sprawdź logi:**
   Skrypty wyświetlają szczegółowe logi błędów

3. **GitHub Issues:**
   https://github.com/LUKOAI/LUKO-WAAS/issues

4. **Email:**
   support@luko.ai

---

## 📝 Notatki dla Developerów

### Struktura skryptów:

```
scripts/
├── quickstart.sh              # Menu główne
├── install.sh                 # Pełna instalacja
├── verify-installation.sh     # Weryfikacja
├── setup-phase-a.gs           # 🎉 NOWE! Automatyczna konfiguracja Phase A (GAS)
├── migrate-to-per-site-divi-keys.gs  # Migracja (GAS)
├── automate-plugin-installation.js   # Automatyczna instalacja pluginów
├── install-plugin-*.js/.sh    # Różne metody instalacji pluginów
└── README.md                  # Ta dokumentacja
```

### Dodawanie nowych skryptów:

1. Utwórz plik: `scripts/moj-skrypt.sh`
2. Dodaj shebang: `#!/bin/bash`
3. Nadaj uprawnienia: `chmod +x scripts/moj-skrypt.sh`
4. Dodaj do menu w `quickstart.sh`
5. Zaktualizuj ten README

---

## 📜 Licencja

GPL v2 lub nowsza (zgodnie z licencją projektu)

---

## 🙏 Credits

Skrypty stworzone dla projektu **WAAS 2.0** by LUKO AI Team

---

**Powodzenia z instalacją! 🚀**

*Jeśli masz pytania, uruchom `./scripts/quickstart.sh` i wybierz opcję 8 (Pomoc z API keys)*
