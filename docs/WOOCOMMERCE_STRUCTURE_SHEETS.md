# 📊 GOOGLE SHEETS STRUCTURE - WOOCOMMERCE AUTOMATION

**Automatyczne tworzenie struktury WooCommerce przez Google Sheets**

**Wersja:** 1.0.0
**Data:** 2025-11-26

---

## 📋 PRZEGLĄD

System automatycznego tworzenia kompletnej struktury WooCommerce (kategorie, atrybuty, tagi, strony, menu) na stronach WordPress przez Google Sheets.

**Zasada działania:**
1. Definiujesz strukturę w Google Sheets (kategorie, atrybuty, strony, menu)
2. Zaznaczasz checkbox "Execute" w arkuszu `WC_Structure_Config`
3. System automatycznie:
   - Generuje plugin PHP z hardcoded danymi
   - Wgrywa plugin na WordPress przez SFTP/REST API
   - Aktywuje plugin (który tworzy całą strukturę)
   - Weryfikuje wykonanie
   - Usuwa plugin

**JEDNA WARTOŚĆ = JEDNA KOMÓRKA**

---

## 📌 ARKUSZ 1: WC_Structure_Config

**Główna konfiguracja - który setup uruchomić**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | Unikalny ID konfiguracji | `CFG-001` |
| **B** | site_domain | String | Domena strony (bez https://) | `passgenaue-lkw-fussmatten.lk24.shop` |
| **C** | language | String | Język strony | `de` |
| **D** | structure_name | String | Nazwa struktury | `KRAM TRUCK` |
| **E** | execute | Boolean | Checkbox - uruchamia setup | `TRUE`, `FALSE` |
| **F** | status | String | Status wykonania | `pending`, `running`, `completed`, `error` |
| **G** | last_run | DateTime | Data ostatniego wykonania | `2025-11-26 14:30:00` |
| **H** | error_message | String | Komunikat błędu (jeśli error) | - |

### Przykładowy wiersz:

```
A2: CFG-001
B2: passgenaue-lkw-fussmatten.lk24.shop
C2: de
D2: KRAM TRUCK
E2: FALSE
F2: pending
G2:
H2:
```

### Data Validation:

- **Kolumna E (execute):** Checkbox
- **Kolumna F (status):** Lista rozwijana: `pending`, `running`, `completed`, `error`

---

## 📦 ARKUSZ 2: WC_Product_Categories

**Hierarchiczne kategorie produktów WooCommerce**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | cat_id | String | Unikalny ID kategorii | `CAT-001` |
| **C** | name | String | Nazwa kategorii | `Nach Fahrzeug` |
| **D** | slug | String | Slug URL | `nach-fahrzeug` |
| **E** | parent_cat_id | String | ID kategorii nadrzędnej (puste = root) | `CAT-001` |
| **F** | description | String | Opis kategorii | `Finden Sie Zubehör nach Fahrzeug` |
| **G** | order | Integer | Kolejność wyświetlania | `1` |

### Hierarchia:

**parent_cat_id** wskazuje na **cat_id** rodzica. Puste = kategoria główna (root).

### Przykład:

```
Row 2: CFG-001, CAT-001, Nach Fahrzeug, nach-fahrzeug, , Finden Sie Zubehör nach Fahrzeug, 1
Row 3: CFG-001, CAT-002, Mercedes-Benz, mercedes-benz, CAT-001, Zubehör für Mercedes, 1
Row 4: CFG-001, CAT-003, Actros MP4, actros-mp4, CAT-002, Für Actros MP4 2011-2019, 1
Row 5: CFG-001, CAT-004, Nach Produkt, nach-produkt, , Produkte nach Kategorie, 2
Row 6: CFG-001, CAT-005, LKW Fußmatten, lkw-fussmatten, CAT-004, Premium Fußmatten, 1
```

**Struktura:**
```
Nach Fahrzeug (CAT-001)
├── Mercedes-Benz (CAT-002)
│   └── Actros MP4 (CAT-003)
Nach Produkt (CAT-004)
└── LKW Fußmatten (CAT-005)
```

---

## 🏷️ ARKUSZ 3: WC_Product_Attributes

**Atrybuty do filtrowania produktów**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | attr_id | String | Unikalny ID atrybutu | `ATTR-001` |
| **C** | name | String | Nazwa atrybutu | `Fahrzeugmarke` |
| **D** | slug | String | Slug | `fahrzeugmarke` |
| **E** | type | String | Typ atrybutu | `select` |

### Przykład:

```
Row 2: CFG-001, ATTR-001, Fahrzeugmarke, fahrzeugmarke, select
Row 3: CFG-001, ATTR-002, Material, material, select
```

---

## 📋 ARKUSZ 4: WC_Attribute_Values

**Wartości atrybutów (terms)**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | attr_id | String | FK → WC_Product_Attributes.attr_id | `ATTR-001` |
| **C** | value | String | Wartość atrybutu | `Mercedes-Benz` |
| **D** | order | Integer | Kolejność | `1` |

### Przykład:

```
Row 2: CFG-001, ATTR-001, Mercedes-Benz, 1
Row 3: CFG-001, ATTR-001, Scania, 2
Row 4: CFG-001, ATTR-001, Volvo, 3
Row 5: CFG-001, ATTR-002, Kunstleder, 1
Row 6: CFG-001, ATTR-002, Gummi, 2
```

---

## 🏷️ ARKUSZ 5: WC_Product_Tags

**Tagi dla produktów WooCommerce**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | name | String | Nazwa tagu | `Bestseller` |
| **C** | slug | String | Slug | `bestseller` |

### Przykład:

```
Row 2: CFG-001, Bestseller, bestseller
Row 3: CFG-001, Neu, neu
Row 4: CFG-001, Made in Poland, made-in-poland
```

---

## 📂 ARKUSZ 6: WC_Post_Categories

**Kategorie dla bloga (WordPress posts)**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | cat_id | String | Unikalny ID kategorii | `PCAT-001` |
| **C** | name | String | Nazwa kategorii | `Ratgeber` |
| **D** | slug | String | Slug | `ratgeber` |
| **E** | parent_cat_id | String | ID kategorii nadrzędnej | - |
| **F** | description | String | Opis | `Kaufberatung` |

### Przykład:

```
Row 2: CFG-001, PCAT-001, Ratgeber, ratgeber, , Kaufberatung
Row 3: CFG-001, PCAT-002, Anleitungen, anleitungen, , Montageanleitungen
```

---

## 🏷️ ARKUSZ 7: WC_Post_Tags

**Tagi dla postów (bloga)**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | name | String | Nazwa tagu | `Mercedes Actros` |
| **C** | slug | String | Slug | `mercedes-actros` |

### Przykład:

```
Row 2: CFG-001, Mercedes Actros, mercedes-actros
Row 3: CFG-001, Fußmatten, fussmatten
```

---

## 📄 ARKUSZ 8: WC_Pages

**Strony WordPress**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | page_id | String | Unikalny ID strony | `PG-001` |
| **C** | title | String | Tytuł strony | `Startseite` |
| **D** | slug | String | Slug URL | `startseite` |
| **E** | parent_page_id | String | ID strony nadrzędnej | - |
| **F** | content | String | Treść strony (HTML) | `<h1>Willkommen</h1>` |
| **G** | is_front_page | Boolean | Czy strona główna | `TRUE` |
| **H** | is_posts_page | Boolean | Czy strona bloga | `FALSE` |
| **I** | order | Integer | Kolejność | `1` |

### Przykład:

```
Row 2: CFG-001, PG-001, Startseite, startseite, , , TRUE, FALSE, 1
Row 3: CFG-001, PG-002, Shop, shop, , [products], FALSE, FALSE, 2
Row 4: CFG-001, PG-003, Blog, blog, , , FALSE, TRUE, 3
Row 5: CFG-001, PG-004, Impressum, impressum, , <h2>Impressum</h2>, FALSE, FALSE, 10
```

---

## 🍔 ARKUSZ 9: WC_Menus

**Definicje menu WordPress**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | menu_id | String | Unikalny ID menu | `MNU-001` |
| **C** | name | String | Nazwa menu | `Main Menu` |
| **D** | location | String | Lokalizacja Divi | `primary_menu` |

### Lokalizacje Divi:

- `primary_menu` - Główne menu
- `secondary_menu` - Menu drugorzędne
- `footer_menu` - Menu w stopce

### Przykład:

```
Row 2: CFG-001, MNU-001, Main Menu, primary_menu
Row 3: CFG-001, MNU-002, Footer Menu, footer_menu
```

---

## 📋 ARKUSZ 10: WC_Menu_Items

**Elementy menu**

### Kolumny:

| Kolumna | Nazwa | Typ | Opis | Przykład |
|---------|-------|-----|------|----------|
| **A** | config_id | String | FK → WC_Structure_Config.config_id | `CFG-001` |
| **B** | menu_id | String | FK → WC_Menus.menu_id | `MNU-001` |
| **C** | item_id | String | Unikalny ID elementu | `MI-001` |
| **D** | title | String | Tytuł wyświetlany | `Home` |
| **E** | type | String | Typ elementu | `page`, `product_cat`, `post_cat`, `custom` |
| **F** | target_id | String | ID obiektu docelowego | `PG-001`, `CAT-005` |
| **G** | custom_url | String | Custom URL (tylko dla type=custom) | `/shop/` |
| **H** | parent_item_id | String | ID elementu nadrzędnego (dla dropdown) | `MI-002` |
| **I** | order | Integer | Kolejność | `1` |

### Typy elementów:

- **page**: Link do strony WordPress (target_id = page_id)
- **product_cat**: Link do kategorii produktów (target_id = cat_id)
- **post_cat**: Link do kategorii postów (target_id = cat_id)
- **custom**: Custom URL (wypełnij custom_url)

### Przykład:

```
Row 2: CFG-001, MNU-001, MI-001, Home, page, PG-001, , , 1
Row 3: CFG-001, MNU-001, MI-002, Produkte, custom, , /shop/, , 2
Row 4: CFG-001, MNU-001, MI-003, LKW Fußmatten, product_cat, CAT-005, , MI-002, 1
Row 5: CFG-001, MNU-001, MI-004, Mercedes-Benz, product_cat, CAT-002, , MI-002, 2
Row 6: CFG-001, MNU-001, MI-005, Blog, page, PG-003, , , 3
```

**Struktura menu:**
```
Main Menu:
├── Home (page)
├── Produkte (custom)
│   ├── LKW Fußmatten (product_cat)
│   └── Mercedes-Benz (product_cat)
└── Blog (page)
```

---

## 🔗 RELACJE MIĘDZY ARKUSZAMI

```
WC_Structure_Config (config_id)
  ├─ 1:N → WC_Product_Categories (config_id)
  ├─ 1:N → WC_Product_Attributes (config_id)
  ├─ 1:N → WC_Attribute_Values (config_id)
  ├─ 1:N → WC_Product_Tags (config_id)
  ├─ 1:N → WC_Post_Categories (config_id)
  ├─ 1:N → WC_Post_Tags (config_id)
  ├─ 1:N → WC_Pages (config_id)
  ├─ 1:N → WC_Menus (config_id)
  └─ 1:N → WC_Menu_Items (config_id)

WC_Product_Attributes (attr_id)
  └─ 1:N → WC_Attribute_Values (attr_id)

WC_Menus (menu_id)
  └─ 1:N → WC_Menu_Items (menu_id)

WC_Product_Categories (cat_id)
  └─ 1:N → WC_Product_Categories (parent_cat_id) - Self-referential

WC_Pages (page_id)
  └─ 1:N → WC_Pages (parent_page_id) - Self-referential

WC_Menu_Items (item_id)
  └─ 1:N → WC_Menu_Items (parent_item_id) - Self-referential
```

---

## ⚙️ JAK TO DZIAŁA?

### Krok 1: Przygotowanie danych

1. Wypełnij wszystkie arkusze dla swojego config_id
2. Sprawdź hierarchie (parent_cat_id, parent_page_id, parent_item_id)
3. Sprawdź slug'i (unikalne, bez polskich znaków)

### Krok 2: Uruchomienie

1. Otwórz arkusz `WC_Structure_Config`
2. Zaznacz checkbox `execute = TRUE` dla swojego config_id
3. System automatycznie:
   - Zmieni status na `running`
   - Wygeneruje plugin PHP
   - Wgra plugin na WordPress
   - Aktywuje plugin
   - Sprawdzi wykonanie
   - Usuwa plugin
   - Zmieni status na `completed`

### Krok 3: Weryfikacja

1. Status zmieni się na `completed` (lub `error` jeśli błąd)
2. Jeśli error - sprawdź `error_message`
3. Sprawdź strukturę na stronie WordPress

---

## 🔒 BEZPIECZEŃSTWO

- Plugin jest generowany dynamicznie i zawiera tylko dane z arkuszy
- Plugin jest automatycznie usuwany po wykonaniu
- Wszystkie dane są sanityzowane przed wstawieniem do PHP
- Plugin działa tylko przy aktywacji (nie jest stale aktywny)

---

## 📊 PRZYKŁADOWA STRUKTURA

### WC_Structure_Config:

```
CFG-001, passgenaue-lkw-fussmatten.lk24.shop, de, KRAM TRUCK, FALSE, pending, ,
```

### WC_Product_Categories:

```
CFG-001, CAT-001, Nach Fahrzeug, nach-fahrzeug, , Finden Sie Zubehör, 1
CFG-001, CAT-002, Mercedes-Benz, mercedes-benz, CAT-001, Zubehör für Mercedes, 1
```

### WC_Pages:

```
CFG-001, PG-001, Startseite, startseite, , , TRUE, FALSE, 1
CFG-001, PG-002, Shop, shop, , [products], FALSE, FALSE, 2
```

### WC_Menus:

```
CFG-001, MNU-001, Main Menu, primary_menu
```

### WC_Menu_Items:

```
CFG-001, MNU-001, MI-001, Home, page, PG-001, , , 1
CFG-001, MNU-001, MI-002, Shop, page, PG-002, , , 2
```

---

## ❓ FAQ

**Q: Czy mogę mieć wiele config_id?**
A: Tak! Każdy config_id to osobna konfiguracja dla osobnej strony.

**Q: Co jeśli popełnię błąd?**
A: Możesz uruchomić setup ponownie - system aktualizuje istniejące elementy.

**Q: Czy mogę dodać nowe kategorie później?**
A: Tak! Dodaj nowe wiersze, zaznacz execute i system doda nowe elementy.

**Q: Gdzie jest tracking_id dla Amazon?**
A: Tracking ID jest w arkuszu `Sites` (kolumna I - Amazon Associate Tag). System używa tego samego tagu dla wszystkich produktów na danej stronie.

---

**© 2025 LUKO AI Team**
**WAAS 2.0 - WordPress Affiliate Automation System**
