# WAAS - WordPress Affiliate Automation System
## Google Apps Script Installation Guide

### 📋 Spis treści
1. [Wymagania](#wymagania)
2. [Instalacja krok po kroku](#instalacja-krok-po-kroku)
3. [Konfiguracja API Keys](#konfiguracja-api-keys)
4. [Pierwsze uruchomienie](#pierwsze-uruchomienie)
5. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## 🔧 Wymagania

Przed instalacją upewnij się, że posiadasz:

- Konto Google (Gmail)
- Klucze API:
  - **Divi API** (Elegant Themes):
    - Username: `netanaliza`
    - API Key: `2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4`
  - **Amazon Product Advertising API**:
    - Access Key ID
    - Secret Access Key
    - Associate Tag (Partner ID)
  - **Hostinger API Key** (opcjonalnie - do przyszłego użycia)

---

## 📥 Instalacja krok po kroku

### Krok 1: Otwórz Google Apps Script

1. Wejdź na: https://script.google.com
2. Zaloguj się na swoje konto Google
3. Kliknij: **"Nowy projekt"**

### Krok 2: Wklej skrypt instalacyjny

1. Usuń zawartość domyślnego pliku `Code.gs`
2. Otwórz plik `setup.gs` z tego repozytorium
3. Skopiuj **CAŁĄ** zawartość pliku
4. Wklej do edytora Google Apps Script
5. Kliknij: **Zapisz** (ikona dyskietki lub Ctrl+S)
6. Nazwij projekt: `WAAS Installation`

### Krok 3: Uruchom instalację

1. W menu funkcji wybierz: `installWAAS`
2. Kliknij: **Uruchom** (▶️)
3. **WAŻNE**: Zostaniesz poproszony o autoryzację:
   - Kliknij: **Przejrzyj uprawnienia**
   - Wybierz swoje konto Google
   - Kliknij: **Zaawansowane**
   - Kliknij: **Przejdź do WAAS Installation (niebezpieczne)**
   - Kliknij: **Zezwól**

### Krok 4: Poczekaj na zakończenie

Instalacja zajmie 30-60 sekund. Zobaczysz:
- Log w konsoli (dolny panel)
- Po zakończeniu: okno dialogowe z URL do arkusza

---

## 🔑 Konfiguracja API Keys

### Metoda 1: Przez interfejs Google Apps Script (ZALECANE)

1. W projekcie Google Apps Script kliknij: **⚙️ Project Settings** (lewy panel)
2. Przewiń do sekcji: **Script Properties**
3. Kliknij: **Add script property**
4. Dodaj następujące właściwości:

| Property Name | Value |
|--------------|-------|
| `DIVI_API_USERNAME` | `netanaliza` |
| `DIVI_API_KEY` | `2abad7fcbcffa7ab2cab87d44d31f5b16b8654e4` |
| `PA_API_ACCESS_KEY` | *Twój Amazon Access Key* |
| `PA_API_SECRET_KEY` | *Twój Amazon Secret Key* |
| `PA_API_PARTNER_TAG` | *Twój Amazon Associate Tag* |
| `HOSTINGER_API_KEY` | *Opcjonalnie - dla przyszłego użytku* |

5. Po dodaniu każdej właściwości kliknij: **Save script properties**

### Metoda 2: Przez menu w arkuszu

1. Otwórz utworzony arkusz Google Sheets
2. Kliknij: **⚡ WAAS → 🔧 Settings → 🔑 Configure API Keys**
3. Postępuj zgodnie z instrukcjami w oknie dialogowym

---

## 🚀 Pierwsze uruchomienie

### 1. Otwórz arkusz

Po instalacji otrzymałeś URL do arkusza. Otwórz go.

### 2. Sprawdź strukturę

Arkusz zawiera następujące karty:
- **Sites** - zarządzanie stronami WordPress
- **Products** - produkty afiliacyjne z Amazon
- **Tasks** - kolejka zadań
- **Content Queue** - zaplanowana treść
- **Logs** - logi systemowe
- **Settings** - ustawienia systemu

### 3. Przetestuj połączenia

1. Kliknij: **⚡ WAAS → 🔧 Settings → 🧪 Test Connections**
2. Sprawdź czy wszystkie API są skonfigurowane

### 4. Dodaj pierwszą stronę

1. Kliknij: **⚡ WAAS → 🌐 Sites → ➕ Add New Site**
2. Wypełnij formularz:
   - **Site Name**: Nazwa Twojej strony
   - **Domain**: example.com
   - **WordPress URL**: https://example.com
   - **Admin Username**: admin
   - **Admin Password**: hasło do WordPress
3. Kliknij: **Add Site**

### 5. Importuj produkty

1. Kliknij: **⚡ WAAS → 📦 Products → 📥 Import from Amazon**
2. Wpisz słowa kluczowe (np. "laptop")
3. Wybierz kategorię
4. Ustaw liczbę produktów (1-50)
5. Kliknij: **Import Products**

---

## 🎯 Podstawowe operacje

### Zarządzanie stronami

```
⚡ WAAS → 🌐 Sites
```

- **Add New Site** - dodaj nową stronę WordPress
- **Check Site Status** - sprawdź status strony
- **Install Divi on Site** - zainstaluj motyw Divi
- **Install Plugin on Site** - zainstaluj WAAS Product Manager
- **Refresh All Sites** - sprawdź wszystkie strony

### Zarządzanie produktami

```
⚡ WAAS → 📦 Products
```

- **Import from Amazon** - importuj produkty z Amazon
- **Update Product Data** - zaktualizuj ceny i dostępność
- **Sync All Products** - synchronizuj wszystkie produkty
- **Product Statistics** - statystyki produktów

### Generowanie treści

```
⚡ WAAS → 📝 Content
```

- **Generate Content** - wygeneruj treść afiliacyjną
- **Publish Scheduled Content** - opublikuj zaplanowaną treść
- **View Content Queue** - zobacz kolejkę treści

### Zarządzanie zadaniami

```
⚡ WAAS → ⚙️ Tasks
```

- **View Active Tasks** - zobacz aktywne zadania
- **Run Task Queue** - uruchom kolejkę zadań
- **Clear Completed Tasks** - usuń zakończone zadania
- **Retry Failed Tasks** - ponów nieudane zadania

---

## 📝 Struktura plików

Po pełnej instalacji projekt zawiera:

```
WAAS Project/
├── setup.gs              # Skrypt instalacyjny (używany tylko raz)
├── Core.gs               # Główne funkcje systemu
├── Menu.gs               # Menu i interfejs użytkownika
├── SiteManager.gs        # Zarządzanie stronami WordPress
├── ProductManager.gs     # Zarządzanie produktami
├── TaskManager.gs        # System kolejki zadań
├── ContentGenerator.gs   # Generowanie treści
├── DiviAPI.gs           # Integracja z Divi API
├── WordPressAPI.gs      # Integracja z WordPress REST API
└── AmazonPA.gs          # Integracja z Amazon PA API
```

---

## 🔍 Rozwiązywanie problemów

### Problem: "Nie mogę autoryzować skryptu"

**Rozwiązanie:**
1. Kliknij "Zaawansowane"
2. Kliknij "Przejdź do WAAS (niebezpieczne)"
3. To Twój własny skrypt - jest bezpieczny

### Problem: "API keys not configured"

**Rozwiązanie:**
1. Sprawdź czy dodałeś wszystkie Script Properties
2. Upewnij się, że nazwy właściwości są dokładnie takie same
3. Odśwież arkusz (F5)

### Problem: "WordPress not accessible"

**Rozwiązanie:**
1. Sprawdź czy URL WordPress jest poprawny
2. Upewnij się, że WordPress REST API jest włączone
3. Sprawdź czy nazwa użytkownika i hasło są poprawne

### Problem: "Amazon API error"

**Rozwiązanie:**
1. Sprawdź czy Twoje klucze Amazon PA API są ważne
2. Upewnij się, że jesteś zarejestrowany w Amazon Associates
3. Sprawdź czy przekroczyłeś limity API (1 request/sekundę)

### Problem: "Skrypt działa wolno"

**Rozwiązanie:**
- Google Apps Script ma limity wykonania (6 min/wykonanie)
- Zmniejsz liczbę równoczesnych operacji
- Użyj Task Queue do rozłożenia pracy w czasie

---

## 📚 Dodatkowe zasoby

### Dokumentacja

- **WAAS GitHub**: https://github.com/LUKOAI/LUKO-WAAS
- **Product Manager Plugin**: https://github.com/LUKOAI/-LukoAmazonAffiliateManager
- **Divi Documentation**: https://www.elegantthemes.com/documentation/divi/
- **Divi API**: https://www.elegantthemes.com/developers/
- **Amazon PA API**: https://webservices.amazon.com/paapi5/documentation/
- **WordPress REST API**: https://developer.wordpress.org/rest-api/

### Linki użyteczne

- **Elegant Themes**: https://www.elegantthemes.com/
- **Divi Layouts**: https://www.elegantthemes.com/layouts/category/online-store
- **Divi 5 Beta**: https://www.elegantthemes.com/divi-5/

---

## ⚡ Szybki start (TL;DR)

1. Otwórz: https://script.google.com
2. Nowy projekt
3. Wklej zawartość `setup.gs`
4. Uruchom: `installWAAS()`
5. Autoryzuj aplikację
6. Dodaj API keys w Project Settings → Script Properties
7. Otwórz utworzony arkusz
8. Gotowe! 🎉

---

## 📞 Wsparcie

Jeśli napotkasz problemy:
1. Sprawdź logi: **⚡ WAAS → 🔧 Settings → 📊 View Logs**
2. Sprawdź dokumentację powyżej
3. Otwórz issue na GitHubie

---

## 📄 Licencja

© 2024 LUKOAI
https://github.com/LUKOAI

---

**Wersja:** 1.0.0
**Ostatnia aktualizacja:** 2024-11-20
