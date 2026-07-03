<?php
declare(strict_types=1);

/**
 * INSTALADOR DE BASE DE DATOS RPG - HUNTER X HUNTER
 * 
 * Recrea el esquema de base de datos RPG ejecutando las 7 migraciones y semillas.
 */

// Cargar bootstrap local del módulo
require_once dirname(__DIR__) . '/public/bootstrap.php';

// Seguridad: Solo Super Administradores de MyBB pueden ejecutar el instalador en web
if (PHP_SAPI !== 'cli') {
    global $mybb;
    // Cargar funciones de admin si no están disponibles
    if (!function_class_exists('MyLanguage')) {
        require_once MYBB_ROOT . 'inc/functions.php';
    }
    
    // Si no está autenticado o no es Super Admin
    if ((int)($mybb->user['uid'] ?? 0) === 0 || !is_super_admin((int)$mybb->user['uid'])) {
        http_response_code(403);
        die("<h1>Acceso Denegado</h1><p>Solo los Super Administradores de MyBB pueden ejecutar este instalador.</p>");
    }
}

global $db;

echo "<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Instalador RPG HxH - Base de Datos</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #09090f; color: #ededf5; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #a78bfa; border-bottom: 2px solid #252535; padding-bottom: 12px; }
        .log-box { background: #111119; padding: 20px; border-radius: 8px; border: 1px solid #252535; font-family: monospace; font-size: 0.9em; line-height: 1.6; margin-bottom: 20px; }
        .ok { color: #2a9d8f; margin: 4px 0; }
        .error { color: #e63946; font-weight: bold; margin: 6px 0; background: rgba(230,57,70,0.1); padding: 8px; border-left: 3px solid #e63946; }
        .btn { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; transition: 0.2s; }
        .btn:hover { background: #a78bfa; }
    </style>
</head>
<body>
    <h1>Instalador de Base de Datos — Hunter x Hunter RPG</h1>
    <p>Ejecutando la creación del esquema y la inserción de semillas...</p>
    <div class='log-box'>";

// Listar migraciones en orden secuencial
$migrations = [
    '001_create_characters.sql',
    '002_create_nen_system.sql',
    '003_create_hatsu_constructor.sql',
    '004_create_social_positioning.sql',
    '005_create_license_bounties_groups.sql',
    '006_create_regions_missions_oracles.sql',
    '007_create_items_inventory_logs.sql'
];

$seeds = [
    'seed_regions.sql',
    'seed_groups.sql'
];

// Función para parsear y ejecutar archivos SQL
function execute_sql_file(string $filepath): void {
    global $db;
    if (!file_exists($filepath)) {
        echo "<div class='error'>[ERROR] Archivo no encontrado: " . htmlspecialchars($filepath) . "</div>";
        return;
    }
    
    $content = file_get_contents($filepath);
    // Eliminar comentarios de una línea (-- ...)
    $content = preg_replace('/^\s*--.*$/m', '', $content);
    // Dividir consultas por punto y coma (;)
    $queries = preg_split('/;\s*$/m', $content);
    
    $count = 0;
    foreach ($queries as $query) {
        $query = trim($query);
        if ($query === '') {
            continue;
        }
        
        try {
            if ($db->write_query($query)) {
                $count++;
            } else {
                echo "<div class='error'>[ERROR] Error en consulta: <br><code>" . htmlspecialchars($query) . "</code><br><strong>Mensaje:</strong> " . htmlspecialchars($db->error()) . "</div>";
            }
        } catch (Throwable $e) {
            echo "<div class='error'>[EXCEPCIÓN] " . htmlspecialchars($e->getMessage()) . "<br><strong>Consulta:</strong> <pre>" . htmlspecialchars($query) . "</pre></div>";
        }
    }
    
    echo "<div class='ok'>[OK] Ejecutado exitosamente: " . htmlspecialchars(basename($filepath)) . " ($count consultas).</div>";
}

// 1. Ejecutar Migraciones
echo "<h3>1. Creación de Tablas (Migraciones)</h3>";
$migrationsDir = dirname(__DIR__) . '/sql/migrations/';
foreach ($migrations as $migration) {
    execute_sql_file($migrationsDir . $migration);
}

// 2. Ejecutar Semillas
echo "<h3>2. Carga de Datos Iniciales (Seeds)</h3>";
$seedsDir = dirname(__DIR__) . '/sql/seeds/';
foreach ($seeds as $seed) {
    execute_sql_file($seedsDir . $seed);
}

echo "</div>
    <div>
        <p>Instalación completada. Por favor, elimina este archivo por motivos de seguridad.</p>
        <a href='../../index.php' class='btn'>Ir al Inicio del Foro</a>
    </div>
</body>
</html>";
