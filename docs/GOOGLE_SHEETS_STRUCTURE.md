# 📊 GOOGLE SHEETS STRUCTURE - WAAS 2.0

**Kompletna dokumentacja struktury arkuszy Google Sheets**

**Wersja:** 2.0.0
**Data:** 2025-11-23
**Status:** AKTUALNA (per-site Divi API Keys)

---

## 📋 SPIS TREŚCI

1. [Przegląd architektury](#architektura)
2. [Zakładka: Sites](#sites)
3. [Zakładka: Products](#products)
4. [Zakładka: Tasks](#tasks)
5. [Zakładka: Content Queue](#content-queue)
6. [Zakładka: Logs](#logs)
7. [Zakładka: Settings](#settings)
8. [Script Properties](#script-properties)
9. [Relacje między zakładkami](#relacje)

---

## 🏗️ ARCHITEKTURA MULTI-SITE {#architektura}

### Kluczowe zasady WAAS 2.0:

✅ **PER-SITE (unikalne dla każdej strony):**
- Divi API Key (kolumna H w Sites)
- Amazon Associate Tag (kolumna I w Sites)
- WP API Key (kolumna G w Sites)
- WordPress credentials (kolumny E, F w Sites)

✅ **GLOBAL (wspólne dla wszystkich stron):**
- Divi API Username (Script Properties)
- Amazon PA-API Access Key (Script Properties)
- Amazon PA-API Secret Key (Script Properties)
- Hostinger SSH credentials (Script Properties)

### Architektura bazy danych:

```
Sites (główna tabela)
  ├─ Primary Key: ID (kolumna A)
  └─ Zawiera: per-site credentials (Divi Key, Amazon Tag)

Products (tabela produktów Amazon)
  ├─ Primary Key: ASIN (kolumna A)
  └─ Niezależna od Sites (produkty mogą być współdzielone)

Tasks (tabela zadań)
  ├─ Primary Key: Task ID (kolumna A)
  ├─ Foreign Key: Site ID (kolumna B) → Sites.ID
  └─ Zadania są powiązane z konkretnymi stronami

Content Queue (kolejka treści)
  ├─ Primary Key: Content ID (kolumna A)
  ├─ Foreign Key: Site ID (kolumna B) → Sites.ID
  └─ Treści są powiązane z konkretnymi stronami

Logs (dziennik zdarzeń)
  ├─ Primary Key: Timestamp (kolumna A)
  ├─ Optional FK: Site ID (kolumna E) → Sites.ID
  └─ Logi mogą być globalne (Site ID puste) lub per-site

Settings (globalne parametry)
  ├─ Primary Key: Setting Key (kolumna A)
  └─ TYLKO parametry systemowe, NIE per-site!
```

---

## 📌 ZAKŁADKA: SITES {#sites}

### Opis:
**Główna tabela systemu WAAS.** Każdy wiersz reprezentuje jedną subdomenę WordPress (np. `magnetbohrmaschine.lk24.shop`).

### Kolumny:

| Kolumna | Nazwa | Typ | Wymagane | Opis | Przykład |
|---------|-------|-----|----------|------|----------|
| **A** | ID | Integer | ✅ | Unikalny identyfikator strony (auto-increment) | `1` |
| **B** | Site Name | String | ✅ | Przyjazna nazwa strony | `Magnetbohrmaschine` |
| **C** | Domain | String | ✅ | Subdomena (bez https://) | `magnetbohrmaschine.lk24.shop` |
| **D** | WordPress URL | URL | ✅ | Pełny URL WordPress | `https://magnetbohrmaschine.lk24.shop` |
| **E** | Admin Username | String | ✅ | WordPress admin username | `netanaliza` |
| **F** | Admin Password | String | ✅ | WordPress admin password | `[secure password]` |
| **G** | WP API Key | String | ✅ | Unikalny klucz REST API dla tej strony | `waas-api-magnetbohr-2025` |
| **H** | Divi API Key | String (40 hex) | ✅ | **UNIKALNY Divi API Key** z Elegant Themes | `c12d038b32b1f2356c705ede89bf188b0abf6a51` |
| **I** | Amazon Associate Tag | String | ⚠️ | Amazon Associate Tag dla tej strony | `magnetbohr-21` |
| **J** | Status | Enum | ✅ | Status strony | `pending`, `deploying`, `active`, `maintenance`, `error` |
| **K** | Divi Installed | Boolean | ✅ | Czy Divi jest zainstalowany | `TRUE`, `FALSE` |
| **L** | Plugin Installed | Boolean | ✅ | Czy plugin WAAS jest zainstalowany | `TRUE`, `FALSE` |
| **M** | Last Check | DateTime | ❌ | Timestamp ostatniego health check | `2025-11-23 14:30:00` |

### Walidacja:

- **Kolumna H (Divi API Key):**
  - Format: dokładnie 40 znaków HEX (0-9, a-f)
  - Regex: `/^[a-f0-9]{40}$/i`
  - Przykład poprawny: `c12d038b32b1f2356c705ede89bf188b0abf6a51`
  - Przykład błędny: `abc123` (za krótki)

- **Kolumna J (Status):**
  - Dozwolone wartości: `pending`, `deploying`, `active`, `maintenance`, `error`
  - Data Validation: Lista rozwijana

- **Kolumna K, L (Boolean):**
  - Dozwolone wartości: `TRUE`, `FALSE`
  - Data Validation: Lista rozwijana

### Przykładowy wiersz:

```
Row 2 (pierwsza strona):
A2: 1
B2: Magnetbohrmaschine
C2: magnetbohrmaschine.lk24.shop
D2: https://magnetbohrmaschine.lk24.shop
E2: netanaliza
F2: MySecurePassword123!
G2: waas-api-magnetbohr-1732368600000
H2: c12d038b32b1f2356c705ede89bf188b0abf6a51    ← UNIKALNY!
I2: magnetbohr-21
J2: active
K2: TRUE
L2: TRUE
M2: 2025-11-23 14:30:00
```

### Jak dodać nową stronę:

**Metoda A: Ręcznie**
1. Dodaj nowy wiersz
2. Wypełnij kolumny A-M
3. Wygeneruj Divi API Key z: https://www.elegantthemes.com/members-area/api/

**Metoda B: Funkcja Google Apps Script**
```javascript
addNewSite({
  siteName: 'Moja nowa strona',
  domain: 'keyword.lk24.shop',
  wpAdminUsername: 'netanaliza',
  wpAdminPassword: 'SecurePass123!',
  diviApiKey: 'abc123def456...', // 40 hex chars
  amazonAssociateTag: 'keyword-21'
});
```

---

## 🛍️ ZAKŁADKA: PRODUCTS {#products}

### Opis:
Tabela produktów Amazon. **Niezależna od Sites** - produkty mogą być współdzielone między stronami.

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | ID | Integer | Auto-increment ID | `1` |
| **B** | ASIN | String (10) | Amazon ASIN (unikalny) | `B08N5WRWNW` |
| **C** | Product Name | String | Nazwa produktu | `Apple AirPods Pro` |
| **D** | Category | String | Kategoria | `electronics` |
| **E** | Price | Decimal | Cena w USD/EUR | `249.99` |
| **F** | Image URL | URL | URL zdjęcia produktu | `https://m.media-amazon.com/...` |
| **G** | Affiliate Link | URL | Link afiliacyjny Amazon | `https://amazon.com/dp/B08N5WRWNW?tag=yoursite-20` |
| **H** | Rating | Decimal | Ocena (0-5) | `4.7` |
| **I** | Reviews Count | Integer | Liczba recenzji | `12345` |
| **J** | Status | String | Status sync | `active`, `outdated`, `unavailable` |
| **K** | Last Updated | DateTime | Data ostatniej aktualizacji | `2025-11-23 10:00:00` |
| **L** | Added Date | DateTime | Data dodania | `2025-11-20 08:00:00` |
| **M** | Notes | String | Notatki | - |

### Uwagi:
- Produkty są niezależne od stron
- Jeden produkt może być używany na wielu stronach
- Link afiliacyjny (kolumna G) powinien zawierać per-site Associate Tag

---

## ⚙️ ZAKŁADKA: TASKS {#tasks}

### Opis:
Tabela zadań (deployment, sync, health check). **Powiązana z Sites** przez Site ID.

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | ID | Integer | Task ID | `1` |
| **B** | Site ID | Integer | **Foreign Key** → Sites.ID | `1` |
| **C** | Task Type | String | Typ zadania | `deploy_site`, `sync_products`, `health_check` |
| **D** | Status | String | Status | `pending`, `running`, `completed`, `failed` |
| **E** | Created | DateTime | Data utworzenia | `2025-11-23 10:00:00` |
| **F** | Started | DateTime | Data rozpoczęcia | `2025-11-23 10:01:00` |
| **G** | Completed | DateTime | Data zakończenia | `2025-11-23 10:05:00` |
| **H** | Error Message | String | Komunikat błędu (jeśli failed) | `Connection timeout` |
| **I** | Retry Count | Integer | Liczba prób ponownych | `0` |

### Relacja:
- **Kolumna B (Site ID)** łączy zadanie z konkretną stroną z zakładki Sites
- Jeden Site może mieć wiele Tasks
- Zapytanie: "Pokaż wszystkie zadania dla Site ID=1"

---

## 📝 ZAKŁADKA: CONTENT QUEUE {#content-queue}

### Opis:
Kolejka treści do publikacji. **Powiązana z Sites** (Site ID) i **Products** (ASIN).

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | Content ID | Integer | Unikalny ID treści | `1` |
| **B** | Site ID | Integer | **Foreign Key** → Sites.ID | `1` |
| **C** | ASIN | String | **Foreign Key** → Products.ASIN | `B08N5WRWNW` |
| **D** | Content Type | String | Typ treści | `product_review`, `comparison`, `list` |
| **E** | Title | String | Tytuł treści | `Apple AirPods Pro - Recenzja` |
| **F** | Status | String | Status | `draft`, `scheduled`, `published` |
| **G** | Generated Date | DateTime | Data wygenerowania | `2025-11-23 10:00:00` |
| **H** | Published Date | DateTime | Data publikacji | `2025-11-23 14:00:00` |
| **I** | WP Post ID | Integer | ID posta w WordPress | `123` |

### Relacje:
- **Kolumna B (Site ID)** → Sites.ID
- **Kolumna C (ASIN)** → Products.ASIN
- Zapytanie: "Pokaż content dla Site ID=1"

---

## 📜 ZAKŁADKA: LOGS {#logs}

### Opis:
Dziennik zdarzeń systemowych. Może być **globalny** (Site ID puste) lub **per-site**.

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | Timestamp | DateTime | Data i czas zdarzenia | `2025-11-23 14:30:00` |
| **B** | Level | String | Poziom logowania | `INFO`, `WARNING`, `ERROR` |
| **C** | Category | String | Kategoria | `DEPLOYMENT`, `API`, `SITE_MANAGEMENT` |
| **D** | Message | String | Wiadomość | `Divi installed successfully` |
| **E** | Site ID | Integer | **Opcjonalne** FK → Sites.ID (puste dla global logs) | `1` lub puste |
| **F** | Task ID | Integer | Opcjonalne ID zadania | `5` |
| **G** | User | String | Opcjonalne - kto wykonał akcję | `netanaliza` |
| **H** | Details | JSON | Dodatkowe szczegóły (JSON string) | `{"divi_version": "5.0.0"}` |

### Przykłady:

**Log per-site:**
```
A: 2025-11-23 14:30:00
B: INFO
C: DEPLOYMENT
D: Divi installed successfully
E: 1                          ← Site ID wypełniony
F:
G:
H: {"divi_version": "5.0.0", "site_name": "Magnetbohrmaschine"}
```

**Log globalny:**
```
A: 2025-11-23 14:32:00
B: INFO
C: SYSTEM
D: Health check completed for all sites
E:                             ← Site ID puste (global log)
F:
G:
H: {"total_sites": 5, "healthy": 4, "errors": 1}
```

---

## ⚙️ ZAKŁADKA: SETTINGS {#settings}

### Opis:
**TYLKO globalne parametry systemowe!** Per-site ustawienia są w zakładce Sites!

### Kolumny:

| Kolumna | Nazwa | Typ | Opis |
|---------|-------|-----|------|
| **A** | Setting Key | String | Klucz ustawienia |
| **B** | Setting Value | String | Wartość |
| **C** | Description | String | Opis |

### Dozwolone ustawienia (TYLKO globalne!):

| Setting Key | Przykładowa wartość | Opis |
|-------------|---------------------|------|
| `divi_api_username` | `netanaliza` | Elegant Themes username (wspólny dla wszystkich stron) |
| `hostinger_ssh_host` | `ssh.lk24.shop` | Hostinger SSH host |
| `hostinger_ssh_port` | `65002` | Hostinger SSH port |
| `hostinger_ssh_username` | `u123456789` | Hostinger SSH username |
| `system_notification_email` | `netanalizaltd@gmail.com` | Email dla powiadomień systemowych |
| `max_concurrent_deployments` | `3` | Max równoległych deploymentów |
| `health_check_interval_hours` | `24` | Interwał health check (godziny) |
| `deployment_script_version` | `1.0.0` | Wersja skryptu deployment |

### ❌ NIE dodawaj tych ustawień (są per-site w Sites!):

- ❌ `auto_publish` - per-site, NIE global
- ❌ `content_generation_enabled` - per-site, NIE global
- ❌ `max_posts_per_day` - per-site, NIE global
- ❌ `default_post_status` - per-site, NIE global
- ❌ `divi_default_template` - per-site, NIE global

---

## 🔐 SCRIPT PROPERTIES {#script-properties}

### Lokalizacja:
`Apps Script → Project Settings (⚙️) → Script Properties`

### Parametry GLOBALNE (dodaj tutaj):

| Property Name | Przykładowa wartość | Opis |
|---------------|---------------------|------|
| `DIVI_API_USERNAME` | `netanaliza` | Elegant Themes username (wspólny dla wszystkich) |
| `PA_API_ACCESS_KEY` | `AKIAIOSFODNN7EXAMPLE` | Amazon PA-API Access Key (20 chars) |
| `PA_API_SECRET_KEY` | `wJalrXUtnFEMI/K7MDENG...` | Amazon PA-API Secret Key (40 chars) |
| `HOSTINGER_API_KEY` | `[api key]` | Hostinger API Key (opcjonalnie) |

### ❌ NIE dodawaj tych parametrów (są per-site w Sites!):

- ❌ `DIVI_API_KEY` - jest **per-site** w zakładce Sites (kolumna H)!
- ❌ `PA_API_PARTNER_TAG` - jest **per-site** jako Amazon Associate Tag (kolumna I)!

---

## 🔗 RELACJE MIĘDZY ZAKŁADKAMI {#relacje}

### Diagram relacji:

```
Sites (ID)
  ├─ 1:N → Tasks (Site ID)
  ├─ 1:N → Content Queue (Site ID)
  └─ 1:N → Logs (Site ID - opcjonalne)

Products (ASIN)
  └─ 1:N → Content Queue (ASIN)

Tasks (Task ID)
  └─ 1:N → Logs (Task ID - opcjonalne)
```

### SQL-like zapytania (dla zrozumienia):

```sql
-- Pokaż wszystkie strony
SELECT * FROM Sites;

-- Pokaż wszystkie zadania dla Site ID = 1
SELECT * FROM Tasks WHERE SiteID = 1;

-- Pokaż content queue dla Site ID = 1
SELECT * FROM ContentQueue WHERE SiteID = 1;

-- Pokaż logi dla Site ID = 1
SELECT * FROM Logs WHERE SiteID = 1;

-- Pokaż logi globalne (systemowe)
SELECT * FROM Logs WHERE SiteID IS NULL OR SiteID = '';

-- Pokaż produkt z content queue
SELECT
  CQ.ContentID,
  CQ.Title,
  P.ProductName,
  P.Price,
  S.SiteName
FROM ContentQueue CQ
JOIN Products P ON CQ.ASIN = P.ASIN
JOIN Sites S ON CQ.SiteID = S.ID
WHERE S.ID = 1;
```

---

## 📊 PRZYKŁADOWA STRUKTURA PEŁNEGO SYSTEMU

### Sites (3 strony):

| ID | Site Name | Domain | Divi API Key | Amazon Tag | Status |
|----|-----------|--------|--------------|------------|--------|
| 1 | Magnetbohrmaschine | magnetbohrmaschine.lk24.shop | `c12d038b...` | `magnetbohr-21` | active |
| 2 | Keyword Site 2 | keyword2.lk24.shop | `3e9df5c1...` | `keyword2-21` | active |
| 3 | Keyword Site 3 | keyword3.lk24.shop | `b693821a...` | `keyword3-21` | pending |

### Products (2 produkty):

| ID | ASIN | Product Name | Category |
|----|------|--------------|----------|
| 1 | B08N5WRWNW | Apple AirPods Pro | electronics |
| 2 | B07XJ8C8F5 | Echo Dot | electronics |

### Tasks (4 zadania):

| ID | Site ID | Task Type | Status |
|----|---------|-----------|--------|
| 1 | 1 | deploy_site | completed |
| 2 | 1 | sync_products | completed |
| 3 | 2 | deploy_site | running |
| 4 | 3 | deploy_site | pending |

### Content Queue (2 treści):

| ID | Site ID | ASIN | Title | Status |
|----|---------|------|-------|--------|
| 1 | 1 | B08N5WRWNW | AirPods Pro Review | published |
| 2 | 1 | B07XJ8C8F5 | Echo Dot Review | draft |

### Logs (3 wpisy):

| Timestamp | Level | Site ID | Message |
|-----------|-------|---------|---------|
| 2025-11-23 14:30 | INFO | 1 | Divi installed |
| 2025-11-23 14:31 | INFO | 2 | Deployment started |
| 2025-11-23 14:32 | INFO | (puste) | Health check completed |

---

## 📚 DODATKOWE ZASOBY

- **Deployment Guide:** `/DEPLOYMENT_GUIDE.md`
- **Installation Checklist:** `/INSTALLATION_CHECKLIST.md`
- **How to Add New Site:** `/docs/HOW_TO_ADD_NEW_SITE.md`
- **Migration Script:** `/scripts/migrate-to-per-site-divi-keys.gs`

---

## ⚠️ NAJCZĘSTSZE BŁĘDY

### 1. Globalny Divi API Key zamiast per-site
❌ **BŁĄD:** Dodanie `DIVI_API_KEY` do Script Properties
✅ **POPRAWNIE:** Każda strona ma własny Divi API Key w kolumnie H arkusza Sites

### 2. Brak Amazon Associate Tag per-site
❌ **BŁĄD:** Używanie globalnego `PA_API_PARTNER_TAG` dla wszystkich stron
✅ **POPRAWNIE:** Każda strona ma własny Amazon Associate Tag w kolumnie I arkusza Sites

### 3. Per-site ustawienia w Settings
❌ **BŁĄD:** Dodanie `auto_publish`, `max_posts_per_day` do Settings
✅ **POPRAWNIE:** Settings zawiera TYLKO globalne parametry systemowe

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - WordPress Affiliate Automation System**
