# Divi Child Theme - WAAS

Divi child theme with integrated WAAS Patronage Manager support and conditional branding.

## Features

- ✅ Automatic patronage detection
- ✅ Conditional header/footer branding
- ✅ Dynamic logo replacement
- ✅ Product filtering integration
- ✅ Custom single product template
- ✅ Helper functions for theme development

## Installation

1. Upload this folder to `/wp-content/themes/`
2. Make sure parent Divi theme is installed
3. Activate "Divi Child - WAAS" theme in WordPress admin
4. Install and activate WAAS Patronage Manager plugin

## Usage

### Helper Functions

```php
// Check if patronage is active
if (is_waas_patronage_active()) {
    // Do something
}

// Get patron data
$patron_data = get_waas_patron_data();
echo $patron_data['brand_name'];

// Check if feature is enabled
if (is_waas_patron_feature_enabled('logo')) {
    // Display patron logo
}
```

### Templates

- `single-waas_product.php` - Custom template for Amazon products with patronage support

## Customization

Add custom CSS to `style.css` under "Custom Styles" section.

## Requirements

- WordPress 5.8+
- PHP 7.4+
- Divi theme (parent)
- WAAS Patronage Manager plugin

## License

GPL v2 or later
