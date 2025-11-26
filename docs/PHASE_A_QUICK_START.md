# ⚡ Phase A - Quick Start (5 minut)

## 🎯 Co to robi?

Automatycznie tworzy podstawowe strony WordPress:
- **Home** (strona główna)
- **Shop** (sklep WooCommerce)
- **About** (o nas)
- **Blog** (strona blogowa)

---

## 🚀 Krok 1: Przygotuj Google Sheets

### 1.1. Utwórz nowy arkusz `WC_Pages`

1. Otwórz swój **AmazonAffiliateProductsDashboard** w Google Sheets
2. Kliknij **"+" (plus)** u dołu ekranu (nowy arkusz)
3. Nazwij go: **`WC_Pages`**

### 1.2. Dodaj nagłówki (pierwszy wiersz)

W wierszu 1 wpisz nagłówki:

```
A1: config_id
B1: page_id
C1: title
D1: slug
E1: parent_page_id
F1: content
G1: is_front_page
H1: is_posts_page
I1: order
```

### 1.3. Import domyślnych stron

**Opcja A: Ręcznie (kopiuj-wklej)**

Skopiuj i wklej do wierszy 2-5:

| config_id | page_id | title | slug | parent_page_id | content | is_front_page | is_posts_page | order |
|-----------|---------|-------|------|----------------|---------|---------------|---------------|-------|
| default | home | Home | | | `<h1>Welcome</h1><p>Your store</p>` | TRUE | FALSE | 1 |
| default | shop | Shop | shop | | `[woocommerce_shop]` | FALSE | FALSE | 2 |
| default | about | About Us | about | | `<h1>About Us</h1>` | FALSE | FALSE | 3 |
| default | blog | Blog | blog | | | FALSE | TRUE | 4 |

**Opcja B: Import CSV**

1. Pobierz plik: `/docs/templates/default_pages.csv`
2. W Google Sheets: **File → Import → Upload → default_pages.csv**
3. Wybierz: **"Replace current sheet"** lub **"Append to current sheet"**

---

## 🚀 Krok 2: Przygotuj konfigurację

### 2.1. Utwórz arkusz `WC_Structure_Config` (jeśli nie istnieje)

1. Kliknij **"+"** u dołu
2. Nazwij go: **`WC_Structure_Config`**

### 2.2. Dodaj nagłówki

```
A1: config_id
B1: site_domain
C1: language
D1: structure_name
E1: execute
F1: status
G1: last_run
H1: error_message
```

### 2.3. Dodaj konfigurację dla swojej strony

W wierszu 2 wpisz:

```
A2: default                      (config_id - musi pasować do WC_Pages!)
B2: yoursite.lk24.shop           (domena twojej strony)
C2: en                           (język: en, de, pl)
D2: Default Pages                (opis)
E2: FALSE                        (execute - zaznacz później)
F2: pending                      (status)
G2:                              (puste - last_run)
H2:                              (puste - error_message)
```

⚠️ **WAŻNE:** `config_id` w `WC_Structure_Config` MUSI być taki sam jak w `WC_Pages`!

---

## 🚀 Krok 3: Uruchom automatyzację

### 3.1. Sprawdź czy strona WordPress jest gotowa

- [ ] WordPress zainstalowany
- [ ] WooCommerce zainstalowany i aktywny
- [ ] Divi theme zainstalowany (opcjonalnie)
- [ ] WAAS pluginy zainstalowane (opcjonalnie)

### 3.2. Zaznacz checkbox `execute = TRUE`

W arkuszu **`WC_Structure_Config`**, wiersz 2, kolumna E:

1. Kliknij na komórkę **E2**
2. Wpisz: **TRUE**
3. Naciśnij **Enter**

### 3.3. Poczekaj na wykonanie (1-2 minuty)

System automatycznie:

1. ✅ Pobierze dane stron z `WC_Pages`
2. ✅ Wygeneruje plugin PHP
3. ✅ Wgra plugin na WordPress
4. ✅ Aktywuje plugin (strony zostaną utworzone!)
5. ✅ Usunie plugin (self-destruct)

### 3.4. Sprawdź status

Po ~2 minutach:

- Kolumna **F (status)** powinna zmienić się na: **`completed`**
- Kolumna **G (last_run)** powinna zawierać timestamp
- Kolumna **E (execute)** powinna automatycznie zmienić się na: **FALSE**

Jeśli **status = error**:
- Sprawdź kolumnę **H (error_message)** - tam będzie opis błędu
- Sprawdź logi w Google Apps Script: **Extensions → Apps Script → Executions**

---

## ✅ Krok 4: Weryfikacja

### 4.1. Zaloguj się do WordPress Admin

```
https://yoursite.lk24.shop/wp-admin
```

### 4.2. Przejdź do: **Pages → All Pages**

Powinieneś zobaczyć:

- ✓ **Home** - status: Published
- ✓ **Shop** - status: Published
- ✓ **About Us** - status: Published
- ✓ **Blog** - status: Published

### 4.3. Sprawdź ustawienia Front Page

**Settings → Reading**

```
Your homepage displays: A static page
Homepage: Home
Posts page: Blog
```

### 4.4. Odwiedź stronę

```
https://yoursite.lk24.shop
```

Powinieneś zobaczyć stronę **Home** jako stronę główną!

---

## 🎨 Customizacja

### Zmień treść strony Home

1. W arkuszu **`WC_Pages`**, znajdź wiersz z `page_id = home`
2. Edytuj kolumnę **F (content)**:

```
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_text]
<h1>Welcome to My Awesome Store!</h1>
<p>Check out our amazing products below.</p>
[/et_pb_text]
[/et_pb_column][/et_pb_row][/et_pb_section]
```

3. Uruchom ponownie: **execute = TRUE** w `WC_Structure_Config`

System zaktualizuje treść strony!

### Dodaj nową stronę (np. Contact)

W arkuszu **`WC_Pages`**, dodaj nowy wiersz:

```
config_id: default
page_id: contact
title: Contact Us
slug: contact
parent_page_id:
content: <h1>Contact Us</h1><p>Email: hello@example.com</p>
is_front_page: FALSE
is_posts_page: FALSE
order: 5
```

Uruchom ponownie: **execute = TRUE**

---

## 🧪 Troubleshooting

### ❌ Błąd: "Sheet WC_Pages not found"

**Rozwiązanie:**
- Sprawdź czy arkusz nazywa się **dokładnie** `WC_Pages` (wielkość liter ma znaczenie!)
- Sprawdź czy arkusz jest w tym samym Google Sheet co `WC_Structure_Config`

### ❌ Błąd: "Site not found in Sites sheet"

**Rozwiązanie:**
- Sprawdź czy `site_domain` w `WC_Structure_Config` pasuje do domeny w arkuszu **Sites** (kolumna C)
- Domena musi być BEZ `https://` (np. `yoursite.lk24.shop`)

### ❌ Błąd: "Plugin upload failed"

**Rozwiązanie:**
- Sprawdź czy REST API jest włączone w WordPress
- Sprawdź WordPress credentials w arkuszu **Sites**
- Sprawdź czy Application Password jest poprawny

### ❌ Strony nie są tworzone

**Rozwiązanie:**
1. Zaloguj się do WordPress Admin
2. Przejdź do: **Plugins → Installed Plugins**
3. Sprawdź czy plugin **"WAAS Structure Setup - default"** został aktywowany
4. Jeśli tak, sprawdź WordPress debug log: `/wp-content/debug.log`

### ❌ Front Page nie jest ustawiona

**Rozwiązanie:**
1. Przejdź do: **Settings → Reading**
2. Wybierz: **"A static page"**
3. Homepage: **Home**
4. Posts page: **Blog**
5. Kliknij **Save Changes**

---

## 📚 Następne kroki

Po skonfigurowaniu Phase A:

### Phase B: Content Generation (później)
- Automatyczne generowanie treści dla stron
- AI-powered product descriptions
- Blog posts automation

### Phase C: Patronage Integration (później)
- Kartra integration (payment funnel)
- Exclusive content dla patronów
- Dynamic benefits management

---

## 🆘 Potrzebujesz pomocy?

### Sprawdź dokumentację:
- 📄 [PHASE_A_PAGE_AUTOMATION.md](./PHASE_A_PAGE_AUTOMATION.md) - pełna dokumentacja
- 📄 [WOOCOMMERCE_STRUCTURE_SHEETS.md](./WOOCOMMERCE_STRUCTURE_SHEETS.md) - struktura arkuszy

### Sprawdź logi:
1. Google Sheets → **Extensions → Apps Script**
2. Kliknij: **Executions** (po lewej)
3. Zobacz ostatnie wykonania i błędy

### GitHub Issues:
- https://github.com/LUKOAI/LUKO-WAAS/issues

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - Phase A** ⚡

**Gotowe w 5 minut!** ✅
