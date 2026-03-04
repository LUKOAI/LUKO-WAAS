/**
 * SP-API Menu Integration for WAAS System
 *
 * HOW TO USE:
 * ============
 * Add SP-API import items to the existing Products submenu in Menu.gs onOpen().
 *
 * WAAS Menu.gs has this structure:
 *
 *   function onOpen() {
 *     const ui = SpreadsheetApp.getUi();
 *     ui.createMenu('\u26A1 WAAS')
 *       .addSubMenu(ui.createMenu('\uD83D\uDCE6 Products')
 *         .addItem('\uD83D\uDCE5 Import by ASIN', 'showImportByAsinDialog')
 *         .addItem('\uD83D\uDD0D Import by Search', 'showImportProductsDialog')
 *         .addItem('\uD83D\uDD04 Update Product Data', 'showUpdateProductsDialog')
 *         .addItem('\uD83D\uDD04 Sync All Products', 'syncAllProducts')
 *         .addSeparator()
 *         .addItem('\uD83D\uDCCA Product Statistics', 'showProductStats')
 *         .addItem('\uD83C\uDFD7\uFE0F Setup Products Sheet', 'setupProductsSheet')
 *         .addSeparator()
 *         .addSubMenu(ui.createMenu('\uD83D\uDCE1 SP-API Import')
 *           .addItem('\uD83D\uDCE5 Import by ASIN', 'spMenuImportByASIN')
 *           .addItem('\uD83D\uDCE5 Import ASIN + Warianty', 'spMenuImportWithVariants')
 *           .addItem('\uD83D\uDD0D Search by Keyword', 'spMenuSearchByKeyword')
 *           .addItem('\uD83D\uDCCB Import from Selection', 'spMenuImportFromSelection')
 *           .addSeparator()
 *           .addItem('\uD83D\uDD10 Setup Credentials', 'spSetupCredentials')
 *           .addItem('\uD83D\uDD0C Test Connection', 'spTestConnection')))
 *       // ... other submenus (WordPress, Automation, etc.)
 *       .addToUi();
 *   }
 *
 *
 * @version 2.0
 * @author NetAnaliza / LUKO
 *
 * SP-API FUNCTIONS (defined in SPApiDataCollection-WAAS.gs):
 * - spMenuImportByASIN()        - Import single/multiple ASINs
 * - spMenuImportWithVariants()  - Import ASINs + their child variants
 * - spMenuSearchByKeyword()     - Search Amazon and import results
 * - spMenuImportFromSelection() - Import ASINs from selected cells
 *
 * AUTH FUNCTIONS (defined in SPApiAuth-WAAS.gs):
 * - spSetupCredentials()        - Setup SP-API credentials in Script Properties
 * - spTestConnection()          - Test SP-API connectivity
 *
 * TARGET: Products sheet
 * SOURCE: Source column = "SP-API"
 * DEDUP:  ASIN + Marketplace pair
 * VARIANTS: IsVariant = TRUE/FALSE, HasParent = TRUE/FALSE, ParentAsin
 * AUTO-COLUMNS: Missing columns are created automatically by spEnsureProductColumns()
 * CREDENTIALS: Stored in Script Properties (SP_LWA_CLIENT_ID, SP_LWA_CLIENT_SECRET,
 *              SP_REFRESH_TOKEN, SP_SELLER_ID) - alongside PA_ACCESS_KEY, DIVI_API_KEY, etc.
 */

// This file serves as documentation for menu integration.
// The actual SP-API functions are in:
// - SPApiAuth-WAAS.gs (authentication, token management, marketplace config)
// - SPApiDataCollection-WAAS.gs (data fetching, writes to Products tab)
//
// FILES TO ADD TO WAAS System PROJECT:
// 1. SPApiAuth-WAAS.gs
// 2. SPApiDataCollection-WAAS.gs
// 3. (Optional) This file - MenuIntegration-SPApi-WAAS.gs - just for reference
//
// STEPS:
// 1. Open WAAS System in Apps Script editor
//    https://script.google.com/u/0/home/projects/1NYsatXvFelKcwZhG5D4RUzAvqW5oeKcdXoJL3A6Yd_Ogy4Jf88BRX5J-/edit
// 2. Create new file: SPApiAuth-WAAS -> paste SPApiAuth-WAAS.gs content
// 3. Create new file: SPApiDataCollection-WAAS -> paste SPApiDataCollection-WAAS.gs content
// 4. Edit Menu.gs -> add SP-API submenu to Products (see example above)
// 5. Save all files
// 6. Reload spreadsheet (close and reopen)
// 7. WAAS > Products menu should now have SP-API Import submenu
// 8. First run: WAAS > Products > SP-API Import > Setup Credentials
// 9. Enter: SP_LWA_CLIENT_ID, SP_LWA_CLIENT_SECRET, SP_REFRESH_TOKEN, SP_SELLER_ID
//    (saved to Script Properties alongside existing PA_ACCESS_KEY, DIVI_API_KEY, etc.)
// 10. Test: WAAS > Products > SP-API Import > Test Connection
// 11. Use: WAAS > Products > SP-API Import > Import by ASIN
//
// COLUMN MAPPING (SP-API -> Products sheet):
// | SP-API Field     | Products Column(s)                              |
// |------------------|-------------------------------------------------|
// | ASIN             | ASIN                                            |
// | Title            | Product Name, Title                             |
// | TitleShort       | TitleShort                                      |
// | TitleLabel       | TitleLabel                                      |
// | Brand            | Brand, BrandName                                |
// | Price            | Price, ListPrice                                |
// | Category         | Category, CategoryName, MainCategoryName        |
// | Link             | Affiliate Link, Link, Url, ProductUrl           |
// | Main Image       | Image URL, Image0Source, FeaturedImageSource    |
// | Images 1-9       | Image1Source - Image9Source                     |
// | All Images       | images_sources                                  |
// | BestSellerRank   | BestSellerRank, BestSellerRank1                 |
// | BSR Category     | BSRProductCategory, BSRProductCategoryName      |
// | EAN              | EAN                                             |
// | UPC              | UPC (auto-created if missing)                   |
// | GTIN             | GTIN (auto-created if missing)                  |
// | MPN              | MPN (auto-created if missing)                   |
// | PartNumber       | PartNumber (auto-created if missing)            |
// | Color            | ColorName                                       |
// | Size             | SizeName, SizeLabel                             |
// | Manufacturer     | Manufacturer, ManufacturerLabel                 |
// | Model            | Model, ModelLabel                               |
// | Material         | Material (auto-created if missing)              |
// | UnitCount        | UnitCount (auto-created if missing)             |
// | Browse Node      | BrowseNodeDisplayName, browse_node_id           |
// | BulletPoints     | BulletPoints                                    |
// | Features         | Features, FeaturesLabel                         |
// | Description      | Description (auto-created if missing)           |
// | Parent ASIN      | ParentAsin                                      |
// | Marketplace      | Marketplace                                     |
// | Source           | Source (= "SP-API")                              |
// | Status           | Status (= "Active")                             |
// | IsVariant        | IsVariant (TRUE/FALSE)                          |
// | HasParent        | HasParent (TRUE/FALSE)                          |
// | HasImages        | HasImages (TRUE/FALSE)                          |
// | HasPrimaryImage  | HasPrimaryImage (TRUE/FALSE)                    |
// | HasDimensions    | HasDimensions (TRUE/FALSE)                      |
// | HasVariantImages | HasVariantImages (TRUE/FALSE)                   |
// | Currency         | PriceCurrency                                   |
// | PriceFormatted   | PriceFormatted                                  |
// | PriceText        | PriceText                                       |
// | IsPrime          | IsPrime (TRUE/FALSE)                            |
// | Availability     | Availability                                    |
// | AvailabilityMsg  | AvailabilityMessage                             |
// | SavingsAmount    | SavingsAmount                                   |
// | SavingsPercent   | SavingsPercent                                  |
// | ItemWeight       | ItemWeight (auto-created if missing)            |
// | ItemHeight       | ItemHeight (auto-created if missing)            |
// | ItemWidth        | ItemWidth (auto-created if missing)             |
// | ItemLength       | ItemLength (auto-created if missing)            |
// | ProductType      | ProductType (auto-created if missing)           |
// | TitleLength      | TitleLength (auto-created if missing)           |
// | TitleWords       | TitleWords (auto-created if missing)            |
// | VariationCount   | VariationCount (auto-created if missing)        |
// | VariationTheme   | VariationTheme (auto-created if missing)        |
// | ID               | ID (auto-increment)                             |
// | Added Date       | Added Date                                      |
// | Last Updated     | Last Updated                                    |
