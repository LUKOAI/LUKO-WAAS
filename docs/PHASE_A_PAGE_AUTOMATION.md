# Phase A - Automatyczne Tworzenie i Ustawianie Stron

## 🎯 Cel

Automatyczne tworzenie podstawowych stron WordPress dla każdego nowego serwisu afiliacyjnego:
- **Home** - strona główna
- **Shop** - strona sklepu (WooCommerce)
- **About** - strona "O nas"
- **Patronage** - strona Patronage (jeśli wymagana)

---

## 📋 Struktura Arkusza Google Sheets: `WC_Pages`

### Kolumny:

| Kolumna | Nazwa | Typ | Opis |
|---------|-------|-----|------|
| A | `config_id` | Text | ID konfiguracji (np. "site-1", "default") |
| B | `page_id` | Text | Unikalny ID strony (np. "home", "shop", "about") |
| C | `title` | Text | Tytuł strony (np. "Home", "Shop", "About Us") |
| D | `slug` | Text | Slug URL (np. "home", "shop", "about") |
| E | `parent_page_id` | Text | ID strony nadrzędnej (jeśli jest) |
| F | `content` | Text | Treść strony (HTML lub shortcode) |
| G | `is_front_page` | Boolean | Czy to strona główna? (TRUE/FALSE) |
| H | `is_posts_page` | Boolean | Czy to strona bloga? (TRUE/FALSE) |
| I | `order` | Number | Kolejność w menu (1, 2, 3...) |

---

## 🔧 Jak to działa

### 1. Google Sheets → Dane stron

Użytkownik definiuje strony w arkuszu `WC_Pages`:

```
config_id | page_id | title      | slug      | parent_page_id | content          | is_front_page | is_posts_page | order
----------|---------|------------|-----------|----------------|------------------|---------------|---------------|------
default   | home    | Home       | home      |                | [divi_builder]... | TRUE          | FALSE         | 1
default   | shop    | Shop       | shop      |                | [woocommerce]     | FALSE         | FALSE         | 2
default   | about   | About Us   | about     |                | <p>About us...</p>| FALSE         | FALSE         | 3
default   | patronage| Patronage | patronage |                | [patronage_info]  | FALSE         | FALSE         | 4
```

### 2. WooStructureAutomation.gs → Generuje kod PHP

Funkcja `getPages(configId)` pobiera strony z arkusza i przekazuje do generatora pluginu.

### 3. PHP Plugin → Tworzy strony w WordPress

Wygenerowany plugin:
1. Sprawdza czy strona już istnieje (`get_page_by_path()`)
2. Jeśli nie, tworzy nową stronę (`wp_insert_post()`)
3. Ustawia stronę główną (`update_option('page_on_front')`)
4. Ustawia stronę bloga (jeśli wymagana)

---

## 📝 Domyślne Szablony Stron

### 1. **Home Page** (Strona Główna)

```html
<!-- Divi Builder shortcode -->
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_text]
<h1>Welcome to {{SITE_NAME}}</h1>
<p>Your trusted source for {{NICHE}} products and reviews.</p>
[/et_pb_text]
[/et_pb_column][/et_pb_row][/et_pb_section]

<!-- Featured Products -->
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[waas_featured_products limit="6"]
[/et_pb_column][/et_pb_row][/et_pb_section]
```

**Funkcje:**
- Dynamiczne welcome message z nazwą strony
- Sekcja wyróżnionych produktów (shortcode pluginu WAAS)
- Responsywny layout (Divi)

---

### 2. **Shop Page** (Sklep)

```html
<!-- WooCommerce Shop Page -->
[woocommerce_shop]

<!-- Or custom with Divi -->
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_text]
<h1>Our Products</h1>
<p>Browse our curated selection of {{NICHE}} products.</p>
[/et_pb_text]
[/et_pb_column][/et_pb_row][/et_pb_section]

[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_shop type="product_category" include_categories="all"]
[/et_pb_column][/et_pb_row][/et_pb_section]
```

**Funkcje:**
- Standardowy shortcode WooCommerce
- Filtrowanie według kategorii
- Grid layout produktów

---

### 3. **About Page** (O Nas)

```html
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_text]
<h1>About {{SITE_NAME}}</h1>
<p>We are passionate about {{NICHE}}. Our mission is to help you find the best products through honest reviews and detailed comparisons.</p>

<h2>What We Do</h2>
<ul>
  <li>✓ In-depth product reviews</li>
  <li>✓ Expert recommendations</li>
  <li>✓ Price comparisons</li>
  <li>✓ Buying guides</li>
</ul>

<h2>Why Trust Us?</h2>
<p>All our reviews are based on thorough research and real-world testing. We're committed to providing unbiased information to help you make informed decisions.</p>

<h2>Disclosure</h2>
<p>{{SITE_NAME}} is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.</p>
[/et_pb_text]
[/et_pb_column][/et_pb_row][/et_pb_section]
```

**Funkcje:**
- Misja i wartości
- Amazon Associates disclosure (wymagane prawnie!)
- SEO-friendly struktura

---

### 4. **Patronage Page** (Wsparcie)

```html
[et_pb_section][et_pb_row][et_pb_column type="4_4"]
[et_pb_text]
<h1>Support {{SITE_NAME}}</h1>
<p>Love our content? Support us through Patronage and get exclusive benefits!</p>

<h2>Patronage Benefits</h2>
[patronage_benefits_list]

<h2>Become a Patron</h2>
<p>Choose your support level:</p>
[patronage_pricing_table]

<h2>Already a Patron?</h2>
<p>Thank you for your support! Access your exclusive benefits here:</p>
[patronage_login_form]
[/et_pb_text]
[/et_pb_column][/et_pb_row][/et_pb_section]
```

**Funkcje:**
- Dynamiczna lista benefitów (z pluginu WAAS Patronage Manager)
- Pricing table (integracja z Kartra)
- Login form dla patronów

---

## 🚀 Instrukcja Użycia

### Krok 1: Utwórz arkusz `WC_Pages` w Google Sheets

1. Otwórz swój Google Sheet (AmazonAffiliateProductsDashboard)
2. Kliknij "+" (nowy arkusz) u dołu
3. Nazwij go: `WC_Pages`
4. Dodaj nagłówki (kolumny A-I)

### Krok 2: Dodaj domyślne strony

Skopiuj dane z **Appendix A** (poniżej) do arkusza `WC_Pages`.

### Krok 3: Utwórz konfigurację w `WC_Structure_Config`

```
config_id     | site_domain              | language | structure_name | execute | status
--------------|--------------------------|----------|----------------|---------|--------
site-1-pages  | yoursite.lk24.shop       | en       | Default Pages  | FALSE   | pending
```

### Krok 4: Zaznacz checkbox `execute` = TRUE

System automatycznie:
1. Wygeneruje plugin PHP z danymi stron
2. Wgra plugin na WordPress
3. Aktywuje plugin (strony zostaną utworzone)
4. Usunie plugin (self-destruct)

### Krok 5: Sprawdź WordPress

Zaloguj się do WordPress admin → Pages

Powinieneś zobaczyć:
- ✓ Home (ustawiona jako Front Page)
- ✓ Shop
- ✓ About Us
- ✓ Patronage (jeśli włączona)

---

## 🔧 Customizacja

### Zmiana treści strony

Edytuj kolumnę `content` w arkuszu `WC_Pages`:

```
config_id | page_id | title | slug | content
----------|---------|-------|------|--------
site-1    | home    | Home  | home | [et_pb_section]...[TWOJA TREŚĆ]...[/et_pb_section]
```

### Zmiana kolejności w menu

Edytuj kolumnę `order`:

```
page_id   | order
----------|------
home      | 1
shop      | 2
about     | 3
patronage | 4
```

### Dodanie nowej strony

Dodaj nowy wiersz:

```
config_id | page_id  | title        | slug        | content              | order
----------|----------|--------------|-------------|----------------------|------
site-1    | contact  | Contact Us   | contact     | [contact_form_7]     | 5
```

---

## 📊 Integracja z Phase B i C

### Phase B: Content Generation
- Strony będą używane jako template dla AI-generated content
- System będzie wstawiał produkty automatycznie

### Phase C: Patronage Features
- Strona Patronage będzie aktywowana dynamicznie
- Integracja z Kartra (payment funnel)
- Exclusive content dla patronów

---

## 🧪 Testing Checklist

- [ ] Arkusz `WC_Pages` utworzony
- [ ] Domyślne strony dodane (Home, Shop, About, Patronage)
- [ ] Konfiguracja w `WC_Structure_Config`
- [ ] Execute = TRUE
- [ ] Plugin wygenerowany
- [ ] Plugin wgrany na WordPress
- [ ] Strony utworzone w WordPress
- [ ] Front Page ustawiona (Settings → Reading)
- [ ] Menu zawiera strony
- [ ] Patronage page działa (jeśli włączona)

---

## Appendix A: Domyślne Dane dla `WC_Pages`

```csv
config_id,page_id,title,slug,parent_page_id,content,is_front_page,is_posts_page,order
default,home,Home,home,,"[et_pb_section][et_pb_row][et_pb_column type=""4_4""][et_pb_text]<h1>Welcome to Our Store</h1><p>Your trusted source for quality products.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]",TRUE,FALSE,1
default,shop,Shop,shop,,[woocommerce_shop],FALSE,FALSE,2
default,about,About Us,about,,"[et_pb_section][et_pb_row][et_pb_column type=""4_4""][et_pb_text]<h1>About Us</h1><p>We help you find the best products.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]",FALSE,FALSE,3
default,patronage,Patronage,patronage,,"[et_pb_section][et_pb_row][et_pb_column type=""4_4""][et_pb_text]<h1>Support Us</h1><p>Become a patron and get exclusive benefits.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]",FALSE,FALSE,4
```

---

## 📞 Troubleshooting

### Błąd: "Sheet WC_Pages not found"
**Fix:** Utwórz arkusz `WC_Pages` w Google Sheets.

### Błąd: "Plugin upload failed"
**Fix:** Sprawdź czy REST API jest dostępne w WordPress.

### Strony nie są tworzone
**Fix:**
1. Sprawdź logi w Google Apps Script (View → Logs)
2. Sprawdź czy WooCommerce jest zainstalowane
3. Sprawdź transient `waas_setup_result` w WordPress

### Front Page nie jest ustawiona
**Fix:**
1. Sprawdź kolumnę `is_front_page` = TRUE dla Home
2. W WordPress: Settings → Reading → "A static page" → Front page: Home

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - Phase A Complete** ✅
