<?php
declare(strict_types=1);

// Errores: solo verbose si GAME_DEBUG está definido
if (defined('GAME_DEBUG') && GAME_DEBUG) {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
}

/**
 * Entrypoint y bootstrap para el módulo RPG game en MyBB.
 */

define('IN_MYBB', 1);

// Cargar MyBB Core (2 niveles arriba de public/)
$bootstrap_path = dirname(__DIR__, 2) . '/global.php';
if (!file_exists($bootstrap_path)) {
    http_response_code(500);
    echo '<h1>Error: No se encuentra global.php de MyBB</h1>';
    echo '<p>Buscado en: ' . htmlspecialchars($bootstrap_path) . '</p>';
    exit;
}

require_once $bootstrap_path;

// Verificar conexión a base de datos
if (!isset($db) || $db === null) {
    http_response_code(500);
    echo '<h1>Error: Conexión a la base de datos de MyBB no disponible</h1>';
    exit;
}

// Cargar constantes de configuración del Universo y Gates
require_once dirname(__DIR__) . '/config/universe.php';
require_once dirname(__DIR__) . '/config/gates.php';

// Autoloader PSR-4 para namespace Game\ mapeado a game/src/
spl_autoload_register(static function (string $class): void {
    $prefix = 'Game\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
    $fullPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $relativePath;

    if (is_file($fullPath)) {
        require_once $fullPath;
    }
});

// Cargar Helpers
$helpers = [
    dirname(__DIR__) . '/inc/helpers.php',
    dirname(__DIR__) . '/inc/nen_helpers.php',
    dirname(__DIR__) . '/inc/positioning_helpers.php',
    dirname(__DIR__) . '/inc/bounty_helpers.php',
    dirname(__DIR__) . '/inc/mission_helpers.php'
];
foreach ($helpers as $helper) {
    if (file_exists($helper)) {
        require_once $helper;
    }
}
