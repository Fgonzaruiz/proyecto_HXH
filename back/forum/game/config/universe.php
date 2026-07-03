<?php
declare(strict_types=1);

/**
 * CONFIGURACIÓN DEL UNIVERSO HUNTER X HUNTER RPG
 * 
 * Regla B-ORO-06: Cero valores HxH hardcodeados en lógica PHP. Todo se centraliza aquí.
 */

// --- MONEDA DEL JUEGO ---
define('CURRENCY_NAME', 'Jenny');
define('CURRENCY_SYMBOL', '₾');

// --- TIPOS DE NEN NATIVOS ---
define('NEN_TYPES', [
    'enhancement'    => [
        'label'       => 'Potenciación',
        'color'       => '#15803d',
        'roll_weight' => 30
    ],
    'transmutation'  => [
        'label'       => 'Transmutación',
        'color'       => '#b45309',
        'roll_weight' => 20
    ],
    'emission'       => [
        'label'       => 'Emisión',
        'color'       => '#1d4ed8',
        'roll_weight' => 15
    ],
    'conjuration'    => [
        'label'       => 'Materialización',
        'color'       => '#6d28d9',
        'roll_weight' => 15
    ],
    'manipulation'   => [
        'label'       => 'Manipulación',
        'color'       => '#b91c1c',
        'roll_weight' => 12
    ],
    'specialization' => [
        'label'       => 'Especialización',
        'color'       => '#831843',
        'roll_weight' => 8
    ],
]);

// --- ACTORES SOCIALES Y DE REPUTACIÓN ---
define('POSITIONING_ACTORS', [
    'hunter_guild'     => [
        'label' => 'Asociación de Cazadores',
        'color' => '#15803d'
    ],
    'underworld'       => [
        'label' => 'Submundo Criminal',
        'color' => '#dc2626'
    ],
    'assassins'        => [
        'label' => 'Gremio de Asesinos',
        'color' => '#1e40af'
    ],
    'civilians'        => [
        'label' => 'Civiles',
        'color' => '#64748b'
    ],
    'kakin_royals'     => [
        'label' => 'Familia Real Kakin',
        'color' => '#92400e'
    ],
    'chimera_remnants' => [
        'label' => 'Hormigas Quimera',
        'color' => '#065f46'
    ],
]);
