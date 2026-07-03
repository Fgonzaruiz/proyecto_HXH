<?php
declare(strict_types=1);

/**
 * FUNCIONES AUXILIARES CORE - HUNTER X HUNTER RPG
 */

/**
 * Obtiene el personaje activo asociado a un ID de usuario de MyBB.
 * Relación estricta 1:1 en Hunter x Hunter.
 * 
 * @param int $uid ID del usuario en MyBB.
 * @return array|null Datos del personaje o null si no existe.
 */
function game_get_character_by_uid(int $uid): ?array {
    global $db;
    if ($uid <= 0) {
        return null;
    }
    
    $escaped_uid = (int)$uid;
    $query = $db->simple_select('game_personajes', '*', "mybb_uid = {$escaped_uid}", ['limit' => 1]);
    $char = $db->fetch_array($query);
    
    return $char ?: null;
}
