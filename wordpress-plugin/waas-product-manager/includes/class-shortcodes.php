<?php
/**
 * WAAS Shortcodes (Basic)
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Shortcodes {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Basic shortcodes registered here
        // Enhanced shortcodes are in class-shortcodes-enhanced.php
    }
}
