<?php
/**
 * Debug Script - Test WooCommerce Sync
 *
 * Umieść ten plik w głównym katalogu WordPress i uruchom przez przeglądarkę:
 * http://twoja-domena.com/test-woocommerce-sync.php
 *
 * USUŃ TEN PLIK PO TEŚCIE!
 */

// Load WordPress
require_once('wp-load.php');

echo '<h1>WAAS WooCommerce Sync - Test Diagnostyczny</h1>';
echo '<pre>';

// 1. Sprawdź czy WooCommerce jest aktywny
echo "\n=== 1. WOOCOMMERCE STATUS ===\n";
if (class_exists('WooCommerce')) {
    echo "✓ WooCommerce jest AKTYWNY\n";
    echo "  Wersja: " . WC()->version . "\n";
} else {
    echo "✗ WooCommerce NIE JEST AKTYWNY!\n";
    echo "  ROZWIĄZANIE: Aktywuj WooCommerce w WordPress Admin → Plugins\n";
}

// 2. Sprawdź czy WAAS Plugin jest aktywny
echo "\n=== 2. WAAS PLUGIN STATUS ===\n";
if (class_exists('WAAS_Product_Manager')) {
    echo "✓ WAAS Product Manager jest aktywny\n";
    if (defined('WAAS_PM_VERSION')) {
        echo "  Wersja: " . WAAS_PM_VERSION . "\n";
    }
} else {
    echo "✗ WAAS Product Manager NIE JEST AKTYWNY!\n";
}

// 3. Sprawdź czy klasa WooCommerce Sync istnieje
echo "\n=== 3. WOOCOMMERCE SYNC CLASS ===\n";
if (class_exists('WAAS_WooCommerce_Sync')) {
    echo "✓ Klasa WAAS_WooCommerce_Sync istnieje\n";

    // Sprawdź czy jest zainicjalizowana
    try {
        $sync_instance = WAAS_WooCommerce_Sync::get_instance();
        echo "✓ Singleton zainicjalizowany poprawnie\n";
    } catch (Exception $e) {
        echo "✗ Błąd inicjalizacji: " . $e->getMessage() . "\n";
    }
} else {
    echo "✗ Klasa WAAS_WooCommerce_Sync NIE ISTNIEJE!\n";
    echo "  ROZWIĄZANIE: Zaktualizuj plugin do wersji 1.0.1\n";
}

// 4. Sprawdź zarejestrowane hooki
echo "\n=== 4. ZAREJESTROWANE HOOKI ===\n";
global $wp_filter;

$hooks_to_check = array('waas_product_imported', 'waas_product_updated');
foreach ($hooks_to_check as $hook_name) {
    if (isset($wp_filter[$hook_name])) {
        echo "✓ Hook '{$hook_name}' jest zarejestrowany\n";

        // Pokaż callbacki
        foreach ($wp_filter[$hook_name]->callbacks as $priority => $callbacks) {
            foreach ($callbacks as $callback) {
                if (is_array($callback['function'])) {
                    $class = is_object($callback['function'][0]) ? get_class($callback['function'][0]) : $callback['function'][0];
                    echo "  - Priority {$priority}: {$class}::{$callback['function'][1]}\n";
                } else {
                    echo "  - Priority {$priority}: {$callback['function']}\n";
                }
            }
        }
    } else {
        echo "✗ Hook '{$hook_name}' NIE JEST ZAREJESTROWANY!\n";
    }
}

// 5. Sprawdź produkty WAAS
echo "\n=== 5. PRODUKTY WAAS ===\n";
$waas_products = get_posts(array(
    'post_type' => 'waas_product',
    'posts_per_page' => 5,
    'post_status' => 'publish'
));

if (!empty($waas_products)) {
    echo "✓ Znaleziono " . count($waas_products) . " produktów WAAS (pokazuję max 5):\n";
    foreach ($waas_products as $product) {
        $asin = get_post_meta($product->ID, '_waas_asin', true);
        echo "  - #{$product->ID}: {$product->post_title} (ASIN: {$asin})\n";
    }
} else {
    echo "✗ Brak produktów WAAS w bazie danych\n";
}

// 6. Sprawdź produkty WooCommerce
echo "\n=== 6. PRODUKTY WOOCOMMERCE ===\n";
if (class_exists('WooCommerce')) {
    $wc_products = get_posts(array(
        'post_type' => 'product',
        'posts_per_page' => 5,
        'post_status' => 'publish'
    ));

    if (!empty($wc_products)) {
        echo "✓ Znaleziono " . count($wc_products) . " produktów WooCommerce (pokazuję max 5):\n";
        foreach ($wc_products as $product) {
            $product_obj = wc_get_product($product->ID);
            $type = $product_obj ? $product_obj->get_type() : 'unknown';
            $asin = get_post_meta($product->ID, '_waas_asin', true);
            echo "  - #{$product->ID}: {$product->post_title} (Type: {$type}, ASIN: {$asin})\n";
        }
    } else {
        echo "✗ Brak produktów WooCommerce w bazie danych\n";
    }
} else {
    echo "- Pomijam (WooCommerce nieaktywny)\n";
}

// 7. Test tworzenia produktu WooCommerce
echo "\n=== 7. TEST UTWORZENIA PRODUKTU ===\n";
if (class_exists('WooCommerce') && class_exists('WAAS_WooCommerce_Sync')) {
    echo "Tworzę testowy produkt WooCommerce...\n";

    try {
        // Utwórz testowy produkt External/Affiliate
        $product = new WC_Product_External();
        $product->set_name('TEST PRODUCT - USUŃ MNIE');
        $product->set_status('draft'); // Draft żeby nie był widoczny
        $product->set_product_url('https://www.amazon.de/dp/B09QMB59TM');
        $product->set_button_text('View on Amazon');
        $product->set_price('99.99');

        $product_id = $product->save();

        if ($product_id) {
            echo "✓ SUKCES! Utworzono testowy produkt WooCommerce #{$product_id}\n";
            echo "  Możesz go zobaczyć w: WordPress Admin → Products\n";
            echo "  (Status: Draft, więc nie będzie widoczny w sklepie)\n";
            echo "  USUŃ TEN PRODUKT RĘCZNIE!\n";
        } else {
            echo "✗ Nie udało się utworzyć produktu\n";
        }
    } catch (Exception $e) {
        echo "✗ BŁĄD podczas tworzenia produktu:\n";
        echo "  " . $e->getMessage() . "\n";
        echo "  " . $e->getTraceAsString() . "\n";
    }
} else {
    echo "- Pomijam (WooCommerce lub WAAS Sync nieaktywny)\n";
}

// 8. Podsumowanie
echo "\n=== 8. PODSUMOWANIE I REKOMENDACJE ===\n";

$issues = array();

if (!class_exists('WooCommerce')) {
    $issues[] = "WooCommerce nie jest aktywny - AKTYWUJ GO!";
}

if (!class_exists('WAAS_WooCommerce_Sync')) {
    $issues[] = "Brak klasy WAAS_WooCommerce_Sync - zaktualizuj plugin do v1.0.1";
}

if (!isset($wp_filter['waas_product_imported'])) {
    $issues[] = "Hook 'waas_product_imported' nie jest zarejestrowany";
}

if (empty($waas_products)) {
    $issues[] = "Brak produktów WAAS - wyeksportuj produkty z Google Sheets";
}

if (!empty($issues)) {
    echo "✗ ZNALEZIONO PROBLEMY:\n";
    foreach ($issues as $issue) {
        echo "  - {$issue}\n";
    }
} else {
    echo "✓ Wszystko wygląda dobrze!\n";
    echo "\nJeśli produkty nadal nie synchronizują się:\n";
    echo "1. Sprawdź WordPress error log: wp-content/debug.log\n";
    echo "2. Włącz WordPress debug mode w wp-config.php:\n";
    echo "   define('WP_DEBUG', true);\n";
    echo "   define('WP_DEBUG_LOG', true);\n";
    echo "3. Wyeksportuj produkty ponownie z Google Sheets\n";
    echo "4. Sprawdź logi w: wp-content/debug.log\n";
}

echo "\n=== KONIEC TESTU ===\n";
echo "\nUWAGA: USUŃ TEN PLIK (test-woocommerce-sync.php) PO ZAKOŃCZENIU TESTU!\n";

echo '</pre>';
