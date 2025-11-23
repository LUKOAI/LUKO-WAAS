# 🆕 JAK DODAĆ NOWĄ STRONĘ DO WAAS 2.0

**Prosta instrukcja krok po kroku - 5 minut**

---

## 📋 CO POTRZEBUJESZ:

Przed dodaniem nowej strony upewnij się, że masz:

- [ ] **Subdomenę WordPress** (np. `keyword.lk24.shop`)
- [ ] **WordPress admin credentials** (username + password)
- [ ] **Konto Elegant Themes** (aby wygenerować Divi API Key)
- [ ] **Amazon Associate Tag** dla tej strony (opcjonalnie)

---

## 🚀 KROK 1: WYGENERUJ DIVI API KEY

⚠️ **KRYTYCZNE:** Każda strona MUSI mieć własny, unikalny Divi API Key!

### 1.1. Wejdź na Elegant Themes API:
```
https://www.elegantthemes.com/members-area/api/
```

### 1.2. Zaloguj się:
- Username: `netanaliza` (lub twoje konto Elegant Themes)
- Password: [twoje hasło]

### 1.3. Kliknij: "Add New API Key"

![Screenshot: Add New API Key button](https://i.imgur.com/example.png)

### 1.4. Wpisz nazwę strony:
```
Site Name: [Nazwa twojej strony - np. "Keyword Site 1"]
```

⚠️ **WAŻNE:** Użyj unikalnej nazwy dla każdej strony!

### 1.5. Kliknij: "Generate API Key"

### 1.6. **SKOPIUJ 40-znakowy klucz:**

Przykład poprawnego klucza:
```
c12d038b32b1f2356c705ede89bf188b0abf6a51
```

✅ Klucz ma dokładnie **40 znaków** (cyfry 0-9, litery a-f)

❌ NIE kopiuj username ani hasła - TYLKO API Key!

### 1.7. Zapisz klucz tymczasowo:
```
Twój Divi API Key: _____________________________________________
```

---

## 📊 KROK 2: DODAJ STRONĘ DO GOOGLE SHEETS

### 2.1. Otwórz Google Sheets:
```
Otwórz arkusz: AmazonAffiliateProductsDashboard
```

### 2.2. Przejdź do zakładki **Sites**:
```
Kliknij zakładkę na dole: Sites
```

### 2.3. Znajdź pierwszą pustą linię:
```
Jeśli masz już 2 strony (Row 2, Row 3), dodaj nową w Row 4
```

### 2.4. Wypełnij kolumny:

#### Kolumna A (ID):
```
Wpisz numer następny po ostatniej stronie
Jeśli ostatnia strona ma ID=2, wpisz: 3
```

#### Kolumna B (Site Name):
```
Wpisz przyjazną nazwę strony, np.: Keyword Site 3
```

#### Kolumna C (Domain):
```
Wpisz subdomenę BEZ https://, np.: keyword3.lk24.shop
```

#### Kolumna D (WordPress URL):
```
Wpisz pełny URL Z https://, np.: https://keyword3.lk24.shop
```

#### Kolumna E (Admin Username):
```
Wpisz WordPress admin username, np.: netanaliza
```

#### Kolumna F (Admin Password):
```
Wpisz WordPress admin password (przechowuj bezpiecznie!)
```

#### Kolumna G (WP API Key):
```
Wygeneruj unikalny klucz, np.: waas-api-keyword3-2025
(Może być dowolny tekst, ale UNIKALNY dla tej strony)
```

#### ⚠️ Kolumna H (Divi API Key) - NAJWAŻNIEJSZA!:
```
WKLEJ 40-znakowy klucz z KROKU 1!

Przykład poprawny:
c12d038b32b1f2356c705ede89bf188b0abf6a51

Przykład błędny:
abc123  ← Za krótki!
```

✅ Sprawdź czy klucz ma dokładnie 40 znaków!

#### Kolumna I (Amazon Associate Tag):
```
Wpisz Amazon Associate Tag dla TEJ strony, np.: keyword3-21

Jeśli nie masz osobnego tagu, zostaw puste
(będzie używany globalny tag z Script Properties)
```

#### Kolumna J (Status):
```
Wybierz z listy: pending

(Status zmieni się na "active" po deployment)
```

#### Kolumna K (Divi Installed):
```
Wybierz z listy: FALSE

(Zmieni się na TRUE po instalacji Divi)
```

#### Kolumna L (Plugin Installed):
```
Wybierz z listy: FALSE

(Zmieni się na TRUE po instalacji pluginów)
```

#### Kolumna M (Last Check):
```
Zostaw pustą

(Zostanie wypełniona automatycznie po health check)
```

### 2.5. Przykładowy pełny wiersz:

```
Row 4 (trzecia strona):
─────────────────────────────────────────────────────────────────────────
A4: 3
B4: Keyword Site 3
C4: keyword3.lk24.shop
D4: https://keyword3.lk24.shop
E4: netanaliza
F4: MySecurePassword123!
G4: waas-api-keyword3-1732368600000
H4: 3e9df5c1f143861dd8098436731bc2e35e32702c  ← 40 znaków!
I4: keyword3-21
J4: pending
K4: FALSE
L4: FALSE
M4: (puste)
─────────────────────────────────────────────────────────────────────────
```

### 2.6. Zapisz (Ctrl+S):
```
Arkusz zapisuje się automatycznie, ale upewnij się że nie ma błędów
```

---

## ✅ KROK 3: WERYFIKACJA

### 3.1. Sprawdź kolumnę H (Divi API Key):

- [ ] Klucz ma **dokładnie 40 znaków**
- [ ] Klucz zawiera **TYLKO cyfry 0-9 i litery a-f** (lowercase lub uppercase)
- [ ] Klucz jest **INNY** niż w innych wierszach (unique!)

### 3.2. Sprawdź kolumnę C (Domain):

- [ ] Domain **NIE zawiera** `https://` (tylko subdomena!)
- [ ] Domain jest poprawny (np. `keyword3.lk24.shop`)

### 3.3. Sprawdź kolumnę D (WordPress URL):

- [ ] URL **zawiera** `https://` (pełny URL!)
- [ ] URL jest poprawny (np. `https://keyword3.lk24.shop`)

---

## 🚀 KROK 4: DEPLOYMENT (OPCJONALNIE)

Jeśli chcesz natychmiast wdrożyć nową stronę:

### Metoda A: Ręcznie (Hostinger + WP-CLI)
```bash
# SSH do Hostingera
ssh u123456789@ssh.lk24.shop -p 65002

# Utwórz subdomenę w Hostinger Panel
# Zainstaluj WordPress przez Softaculous
# Zainstaluj Divi używając API Key z kolumny H
# Zainstaluj pluginy WAAS
```

### Metoda B: Google Apps Script (automatycznie)
```
Google Sheets → Menu: ⚡ WAAS → 🚀 Deploy Site

Wybierz Site ID: 3
Kliknij: Deploy

Poczekaj 5-10 minut (logi w zakładce Logs)
```

### Metoda C: Python deployment script
```bash
cd /path/to/LUKO-WAAS
python scripts/deploy-site.py --site-id 3
```

---

## 📝 CHECKLIST KOŃCOWA

### Po dodaniu strony sprawdź:

- [ ] Wiersz w zakładce Sites jest wypełniony (wszystkie kolumny A-L)
- [ ] Divi API Key ma **40 znaków hex**
- [ ] Divi API Key jest **UNIKALNY** (różny od innych stron)
- [ ] Domain i WordPress URL są poprawne
- [ ] WP API Key jest unikalny
- [ ] Status = `pending`

### Po deployment (jeśli wykonano):

- [ ] Status zmienił się na `active`
- [ ] Divi Installed = `TRUE`
- [ ] Plugin Installed = `TRUE`
- [ ] Last Check zawiera timestamp
- [ ] W zakładce Logs są wpisy o deployment

---

## ❓ NAJCZĘSTSZE PYTANIA

### Q: Czy mogę użyć tego samego Divi API Key dla wszystkich stron?
**A: NIE!** Każda strona MUSI mieć własny, unikalny Divi API Key wygenerowany w Elegant Themes API.

Dowód: Screenshot z Elegant Themes pokazujący różne klucze:
```
Site URL                    | API Key
----------------------------|----------------------------------------
https://gadsjo.de           | f6f26eb86b780f2caf47dbc74f11c6854f7e70af
https://rhetovox.de         | b693821aa7d8e62c62e27a32b77fa55fff61ba10
keyword3.lk24.shop          | 3e9df5c1f143861dd8098436731bc2e35e32702c
```

### Q: Co jeśli zapomniałem Divi API Key?
**A:** Wejdź na https://www.elegantthemes.com/members-area/api/ i skopiuj istniejący klucz dla tej strony, LUB wygeneruj nowy.

### Q: Czy mogę zmienić Divi API Key później?
**A:** TAK, po prostu edytuj kolumnę H w Google Sheets. Ale musisz również zaktualizować WordPress (reinstall Divi).

### Q: Co jeśli nie mam osobnego Amazon Associate Tag?
**A:** Zostaw kolumnę I (Amazon Associate Tag) pustą. System użyje globalnego tagu z Script Properties.

### Q: Ile stron mogę dodać?
**A:** Nie ma limitu! Możesz mieć 10, 50, 100+ stron. Każda z własnym Divi API Key.

### Q: Czy muszę instalować Divi ręcznie?
**A:** NIE, jeśli używasz deployment script (Python lub Google Apps Script). Script zainstaluje Divi automatycznie używając klucza z kolumny H.

---

## 📚 DODATKOWE ZASOBY

- **Google Sheets Structure:** `/docs/GOOGLE_SHEETS_STRUCTURE.md`
- **Deployment Guide:** `/DEPLOYMENT_GUIDE.md`
- **Installation Checklist:** `/INSTALLATION_CHECKLIST.md`
- **Migration Script:** `/scripts/migrate-to-per-site-divi-keys.gs`

---

## 🔥 TROUBLESHOOTING

### ❌ "Invalid Divi API Key format"
**Problem:** Klucz w kolumnie H nie ma 40 znaków lub zawiera nieprawidłowe znaki

**Fix:**
1. Sprawdź długość klucza (musi być dokładnie 40 znaków)
2. Sprawdź czy zawiera TYLKO: 0-9, a-f (hex)
3. Wygeneruj nowy klucz w Elegant Themes API

### ❌ Deployment fails - "Divi download error"
**Problem:** Błędny Divi API Key lub brak dostępu do Elegant Themes

**Fix:**
1. Sprawdź czy Divi API Key w kolumnie H jest poprawny
2. Sprawdź czy konto Elegant Themes jest aktywne
3. Sprawdź czy `DIVI_API_USERNAME` w Script Properties jest poprawny

### ❌ "Site already exists"
**Problem:** Domena w kolumnie C już istnieje w innym wierszu

**Fix:**
1. Sprawdź czy nie masz duplikatu domeny
2. Użyj unikalnej subdomeny (np. `keyword4.lk24.shop` zamiast `keyword3.lk24.shop`)

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - WordPress Affiliate Automation System**

**Potrzebujesz pomocy?**
- GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
- Email: support@luko.ai
