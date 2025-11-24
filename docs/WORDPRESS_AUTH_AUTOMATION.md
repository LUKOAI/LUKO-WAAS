# 🔐 WordPress Authentication - Pełna Automatyzacja

## Problem: Application Passwords w WordPress

WordPress >= 5.6 wymaga **Application Passwords** dla REST API, co wcześniej wymagało ręcznej konfiguracji przez użytkownika.

## ✅ Rozwiązanie: 100% Automatyczne

System WAAS teraz **automatycznie** konfiguruje autentykację WordPress - **ZERO ręcznej pracy!**

---

## 🚀 Jak to działa?

### Automatyczny proces (uruchamia się podczas instalacji):

```
1. System wykrywa wersję WordPress
2. WordPress >= 5.6:
   ├─→ Loguje się przez wp-login.php (cookie auth)
   ├─→ Tworzy Application Password przez REST API
   ├─→ Zapisuje credentials w Google Sheets
   └─→ Gotowe! ✅

3. Jeśli kroki 2 nie zadziałają:
   ├─→ Próbuje zainstalować Basic Auth plugin
   └─→ Fallback na legacy auth

4. Wszystkie dalsze operacje używają automatycznie utworzonych credentials
```

### Kluczowe funkcje:

| Funkcja | Opis |
|---------|------|
| `setupWordPressAuth(site)` | Główna funkcja - automatycznie konfiguruje auth |
| `createApplicationPassword(site)` | Tworzy App Password bez ręcznej interwencji |
| `getAuthHeader(site)` | Zwraca poprawny auth header dla każdej strony |
| `wordpressLogin(site)` | Loguje się przez wp-login.php i pobiera cookies |

---

## 📊 Nowe Kolumny w Sites Sheet

System automatycznie dodaje dwie nowe kolumny:

| Kolumna | Opis |
|---------|------|
| **Column 16: Application Password** | Automatycznie utworzone hasło aplikacji |
| **Column 17: Auth Type** | Typ autentykacji: `application_password`, `basic_auth_plugin`, `basic_auth_legacy` |

---

## 🎯 Gdzie to działa?

### 1. Podczas Full Stack Installation

```javascript
// W Automation.gs - installFullStack()
// STEP 1: Automatycznie konfiguruje auth
const authResult = setupWordPressAuth(site);
// Dalsze kroki używają już skonfigurowanego auth
```

### 2. Wszystkie WordPress API Calls

```javascript
// Poprzednio (manualne):
const authHeader = 'Basic ' + Utilities.base64Encode(site.adminUser + ':' + site.adminPass);

// Teraz (automatyczne):
const authHeader = getAuthHeader(site);  // ✅ Automatycznie używa App Password!
```

### 3. Migracja Istniejących Stron

Dla stron utworzonych przed upgrade'm:

```
Menu: ⚡ WAAS → 🔧 Settings → 🔐 Migrate Auth for All Sites
```

To automatycznie skonfiguruje auth dla wszystkich stron które go nie mają.

---

## 🔧 Dostępne Operacje

### Z Menu Google Sheets:

| Opcja Menu | Funkcja |
|-----------|----------|
| **🔐 Migrate Auth for All Sites** | Konfiguruje auth dla wszystkich stron automatycznie |
| **🔐 Setup Auth for Site** | Konfiguruje auth dla konkretnej strony |
| **📊 View Auth Status** | Pokazuje status auth dla wszystkich stron |

### Programmatically:

```javascript
// Setup auth dla strony
const site = getSiteById(1);
const result = setupWordPressAuth(site);

if (result.success) {
  console.log(`Auth configured: ${result.authType}`);
  console.log(`Password: ${result.password}`);
}

// Test auth
const testResult = testWordPressAuth(site);
if (testResult.success) {
  console.log(`Auth working for user: ${testResult.user}`);
}

// Migrate all sites
migrateAllSitesToAutoAuth();
```

---

## 🎨 Typ Autentykacji

System próbuje w kolejności:

### 1. **application_password** (najlepsze)
- WordPress >= 5.6
- Tworzy Application Password automatycznie
- Najbezpieczniejsze i recommended
- ✅ **To jest preferowana metoda**

### 2. **basic_auth_plugin** (fallback)
- Instaluje Basic Auth plugin z GitHub
- Pozwala używać standardowego hasła
- Działa na wszystkich wersjach WP
- ⚠️ Wymaga instalacji pluginu

### 3. **basic_auth_legacy** (last resort)
- WordPress < 5.6
- Używa standardowego Basic Auth
- Działa bez dodatkowej konfiguracji
- ⚠️ Może nie działać na nowszych WP

---

## 📝 Przykład: Automatyczna Instalacja

```javascript
// Użytkownik klika: "Install Full Stack"

// 1. System sprawdza WordPress
const wpVersion = getWordPressVersion(site);  // "6.4.2"

// 2. Wykrywa że >= 5.6, więc tworzy App Password
const authResult = setupWordPressAuth(site);
// authResult = {
//   success: true,
//   authType: 'application_password',
//   password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
//   message: 'Application Password created automatically'
// }

// 3. Zapisuje do Google Sheets (column 16, 17)
// Site teraz ma:
// - appPassword: 'xxxx xxxx xxxx xxxx xxxx xxxx'
// - authType: 'application_password'

// 4. Wszystkie dalsze operacje używają tego hasła
const posts = createWordPressPost(site, postData);
// Automatycznie używa App Password ✅
```

---

## 🔐 Bezpieczeństwo

### ✅ Co jest bezpieczne:

1. **Application Passwords** są haszowane w WordPressie
2. Można je **odwołać** w dowolnym momencie (WordPress Admin → Users → Application Passwords)
3. Mają **ograniczone uprawnienia** (tylko REST API, nie panel admin)
4. Każda strona ma **własne hasło** (per-site isolation)

### 🔒 Przechowywanie Credentials:

- Hasła są w Google Sheets (column 16)
- Google Sheets ma własne zabezpieczenia (Google Account auth)
- Tylko osoby z dostępem do Sheets mogą zobaczyć hasła
- **Nigdy nie są logowane** w Logs sheet

---

## 🧪 Testowanie

### Test autentykacji dla strony:

```
Menu: ⚡ WAAS → 🔧 Settings → 🔐 Setup Auth for Site
Wprowadź Site ID: 1
```

Lub programmatically:

```javascript
const site = getSiteById(1);
const testResult = testWordPressAuth(site);

if (testResult.success) {
  console.log(`✅ Auth działa!`);
  console.log(`User: ${testResult.user}`);
} else {
  console.log(`❌ Auth nie działa: ${testResult.error}`);
}
```

---

## 🐛 Troubleshooting

### Problem: "Authentication failed"

**Rozwiązanie 1:** Re-run auth setup
```
Menu: ⚡ WAAS → 🔧 Settings → 🔐 Setup Auth for Site
```

**Rozwiązanie 2:** Sprawdź credentials w WordPressie
- WordPress Admin → Users → Your User → Application Passwords
- Usuń stare "WAAS Automation" passwords
- Re-run setup

**Rozwiązanie 3:** Check WordPress version
```javascript
const site = getSiteById(1);
const version = getWordPressVersion(site);
console.log(`WordPress version: ${version}`);
```

### Problem: "Login cookies not found"

**Przyczyna:** WordPress credentials (username/password) są nieprawidłowe

**Rozwiązanie:**
1. Sprawdź w Sites sheet columns 5-6 (username, password)
2. Spróbuj zalogować się ręcznie do WordPress
3. Jeśli działa ręcznie, ale nie przez API - sprawdź czy WordPress ma security plugins które blokują automated logins

### Problem: "Application Password creation failed"

**Przyczyna:** REST API jest wyłączony lub zablokowany

**Rozwiązanie:**
1. Sprawdź czy `https://yoursite.com/wp-json/` jest dostępny
2. Sprawdź security plugins (może blokują REST API)
3. Dodaj do wp-config.php:
   ```php
   define('WP_DISABLE_FATAL_ERROR_HANDLER', true);
   ```

---

## 📚 Dokumentacja Techniczna

### Pliki:

| Plik | Opis |
|------|------|
| `WordPressAuth.gs` | Główny moduł autentykacji - wszystkie funkcje auth |
| `AuthMigration.gs` | Funkcje migracji dla istniejących stron |
| `WordPressAPI.gs` | Zaktualizowane funkcje używające `getAuthHeader()` |
| `SiteManager.gs` | Zaktualizowane `getSiteById()` z nowymi kolumnami |
| `Automation.gs` | Zaktualizowane `installFullStack()` z auto-auth |

### API Reference:

#### `setupWordPressAuth(site)`
**Parametry:** `site` - Site object from `getSiteById()`
**Zwraca:**
```javascript
{
  success: true/false,
  authType: 'application_password' | 'basic_auth_plugin' | 'basic_auth_legacy',
  password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
  message: 'Human readable message',
  error: 'Error message if failed'
}
```

#### `getAuthHeader(site)`
**Parametry:** `site` - Site object
**Zwraca:** `string` - Authorization header value
**Przykład:** `'Basic YWRtaW46eHh4eA=='`

#### `createApplicationPassword(site)`
**Parametry:** `site` - Site object
**Zwraca:**
```javascript
{
  success: true/false,
  password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
  name: 'WAAS Automation 1234567890',
  uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  error: 'Error message if failed'
}
```

#### `wordpressLogin(site)`
**Parametry:** `site` - Site object
**Zwraca:**
```javascript
{
  success: true/false,
  cookies: 'wordpress_logged_in_xxxxx=...; wp_xxxxx=...',
  error: 'Error message if failed'
}
```

#### `testWordPressAuth(site)`
**Parametry:** `site` - Site object
**Zwraca:**
```javascript
{
  success: true/false,
  user: 'admin',
  message: 'Authentication working correctly',
  error: 'Error message if failed'
}
```

---

## ✨ Podsumowanie

### Przed (Manual):

❌ Użytkownik musiał:
1. Logować się do WordPress Admin
2. Iść do Users → Application Passwords
3. Kliknąć "Add New Application Password"
4. Nazwać "WAAS Automation"
5. Skopiować wygenerowane hasło
6. Wkleić do Google Sheets
7. Powtórzyć dla KAŻDEJ strony!

### Teraz (Automatic):

✅ System robi TO WSZYSTKO automatycznie!
- Jeden klik: "Install Full Stack"
- System sam się loguje, tworzy hasło, zapisuje
- Działa dla wszystkich stron
- Zero ręcznej pracy!

---

## 🎉 Gratulacje!

Masz teraz **w pełni automatyczny** system WordPress authentication!

Żadnych więcej ręcznych kroków! 🚀

---

**Built with ❤️ by LUKOAI**
**© 2024 LUKOAI** | [GitHub](https://github.com/LUKOAI/LUKO-WAAS)
