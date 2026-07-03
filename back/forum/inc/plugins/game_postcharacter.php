<?php
if (!defined('IN_MYBB')) die('Direct access denined.');

// Cargar helpers de oráculos si no se han cargado ya (definidos en game/inc/oracle_helpers.php)
if (!function_exists('game_get_post_category')) {
    $oracle_helpers = dirname(__DIR__, 2) . '/game/inc/oracle_helpers.php';
    if (file_exists($oracle_helpers)) {
        require_once $oracle_helpers;
    }
}
$navigation_process = dirname(__DIR__, 2) . '/game/inc/navigation_process.php';
if (is_file($navigation_process)) {
    require_once $navigation_process;
}
$post_rpg_debug = dirname(__DIR__, 2) . '/game/inc/post_rpg_debug.php';
if (is_file($post_rpg_debug)) {
    require_once $post_rpg_debug;
}

function game_postcharacter_info() {
    return [
        'name'          => 'Game Post Character Linker + Notifications',
        'description'   => 'Vincula posts con personajes, gestiona fecha onrol y envía notificaciones.',
        'website'       => '',
        'author'        => 'Game Module',
        'authorsite'    => '',
        'version'       => '1.1',
        'guid'          => '',
        'compatibility' => '18*',
    ];
}

$plugins->add_hook('datahandler_post_insert_post_end', 'game_postcharacter_save_post');
$plugins->add_hook('datahandler_post_insert_thread_end', 'game_postcharacter_save_thread');
$plugins->add_hook('class_moderation_delete_post_start', 'game_postcharacter_delete_post');
$plugins->add_hook('class_moderation_delete_thread_start', 'game_postcharacter_delete_thread');
$plugins->add_hook('global_start', 'game_postcharacter_global_date');
$plugins->add_hook('global_start', 'game_postcharacter_set_template_vars');
$plugins->add_hook('editpost_start', 'game_postcharacter_block_edit');
$plugins->add_hook('xmlhttp_edit_post_start', 'game_postcharacter_block_ajax_edit');
$plugins->add_hook('parse_message', 'game_postcharacter_parse_spoiler_bbcode');

function game_postcharacter_is_consumible_card(array $card): bool
{
    if (($card['card_type'] ?? '') !== 'equipo') {
        return false;
    }
    $ef = json_decode($card['effects_json'] ?? '{}', true);
    if (strtolower((string)($ef['equipo_type'] ?? '')) === 'util') {
        return true;
    }
    $tags = json_decode($card['tags_json'] ?? '[]', true);
    if (!is_array($tags)) {
        return false;
    }
    foreach ($tags as $t) {
        $u = strtoupper((string)$t);
        if (in_array($u, ['CONSUMIBLE', 'MUNICION', 'AMMO'], true)) {
            return true;
        }
    }
    return false;
}

function game_postcharacter_decrement_consumible(int $cid, int $card_id): void
{
    global $db;
    $prefix = TABLE_PREFIX;
    if (!$db->field_exists('cantidad', 'game_character_cards')) {
        return;
    }
    $db->write_query(
        "UPDATE {$prefix}game_character_cards SET cantidad = GREATEST(0, cantidad - 1)
         WHERE character_id = {$cid} AND card_id = {$card_id}",
        1
    );
    $db->write_query(
        "DELETE FROM {$prefix}game_character_cards
         WHERE character_id = {$cid} AND card_id = {$card_id} AND cantidad <= 0",
        1
    );
}

/**
 * Comprueba columnas de modificadores por post (sin ALTER en runtime).
 * Ejecutar migrate_post_modifiers.php antes de usar PV/PE en posts.
 */
function game_postcharacter_post_modifiers_ready(): bool
{
    global $db;
    static $ready = null;
    if ($ready !== null) {
        return $ready;
    }
    if (!$db->table_exists('game_post_characters')) {
        $ready = false;
        return false;
    }
    $ready = $db->field_exists('pv_change', 'game_post_characters')
        && $db->field_exists('pe_change', 'game_post_characters')
        && $db->field_exists('modifiers_json', 'game_post_characters');
    return $ready;
}

function game_postcharacter_ensure_inventory_helpers(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $helpers = MYBB_ROOT . 'game/inc/inventory_helpers.php';
    if (is_file($helpers)) {
        require_once $helpers;
    }
    $loaded = true;
}

function game_postcharacter_equipped_snapshot_ready(): bool
{
    global $db;
    static $ready = null;
    if ($ready !== null) {
        return $ready;
    }
    $ready = $db->table_exists('game_post_characters')
        && $db->field_exists('equipped_snapshot_json', 'game_post_characters');
    return $ready;
}

/**
 * @return list<int>
 */
function game_postcharacter_save_equipped_snapshot(int $pid, int $cid): array
{
    game_postcharacter_ensure_inventory_helpers();
    global $db;
    $ids = function_exists('game_get_equipped_card_ids')
        ? game_get_equipped_card_ids($cid)
        : [];
    if (!game_postcharacter_equipped_snapshot_ready()) {
        return $ids;
    }
    $prefix = TABLE_PREFIX;
    $json = json_encode(array_values($ids), JSON_UNESCAPED_UNICODE);
    $esc = $db->escape_string($json);
    $db->write_query(
        "UPDATE {$prefix}game_post_characters
         SET equipped_snapshot_json = '{$esc}'
         WHERE post_id = {$pid} AND character_id = {$cid}"
    );
    return $ids;
}

/**
 * @return list<int>
 */
function game_postcharacter_get_post_equipped_ids(int $pid, int $cid): array
{
    game_postcharacter_ensure_inventory_helpers();
    global $db;
    $prefix = TABLE_PREFIX;
    if (game_postcharacter_equipped_snapshot_ready()) {
        $q = $db->query(
            "SELECT equipped_snapshot_json FROM {$prefix}game_post_characters
             WHERE post_id = {$pid} AND character_id = {$cid} LIMIT 1"
        );
        $row = $db->fetch_array($q);
        if ($row && ($row['equipped_snapshot_json'] ?? '') !== '') {
            $decoded = json_decode($row['equipped_snapshot_json'], true);
            if (is_array($decoded)) {
                return array_values(array_unique(array_map('intval', $decoded)));
            }
        }
    }
    return function_exists('game_get_equipped_card_ids') ? game_get_equipped_card_ids($cid) : [];
}

function game_postcharacter_card_allowed_in_post(string $cardType, int $cardId, array $equippedIds, bool $isConsumible = false): bool
{
    game_postcharacter_ensure_inventory_helpers();
    if (!function_exists('game_card_requires_equipped_slot') || !game_card_requires_equipped_slot($cardType, $isConsumible)) {
        return true;
    }
    $allowed = in_array($cardId, $equippedIds, true);
    if (!$allowed && function_exists('game_log_equipped_debug')) {
        game_log_equipped_debug('card_rejected', [
            'card_id' => $cardId,
            'card_type' => $cardType,
            'equipped_ids' => $equippedIds,
            'is_consumible' => $isConsumible,
        ]);
    }
    return $allowed;
}

function game_postcharacter_has_post_modifier_input(): bool
{
    if (isset($_POST['rpg_thread_pv']) && (string)$_POST['rpg_thread_pv'] !== '') {
        return true;
    }
    if (isset($_POST['rpg_thread_pe']) && (string)$_POST['rpg_thread_pe'] !== '') {
        return true;
    }
    if (!empty($_POST['rpg_modifiers'])) {
        $raw = json_decode((string)$_POST['rpg_modifiers'], true);
        if (is_array($raw)) {
            foreach ($raw as $val) {
                if ((int)$val !== 0) {
                    return true;
                }
            }
        }
    }
    if (!empty($_POST['rpg_cooldown_mods'])) {
        $raw = json_decode((string)$_POST['rpg_cooldown_mods'], true);
        if (is_array($raw) && count($raw) > 0) {
            return true;
        }
    }
    return false;
}

/**
 * @return array{pv_change: int, pe_change: int, current_pv: int, current_pe: int, stat_mods_json: string}
 */
function game_postcharacter_compute_post_modifiers(int $tid, int $cid): array
{
    global $db;
    $prefix = TABLE_PREFIX;

    $stat_mods_arr = [];
    if (!empty($_POST['rpg_modifiers'])) {
        $raw = json_decode((string)$_POST['rpg_modifiers'], true);
        if (is_array($raw)) {
            $stat_mods_arr = $raw;
        }
    }
    $stat_mods_json = json_encode($stat_mods_arr, JSON_UNESCAPED_UNICODE);

    $prev_pv = 0;
    $prev_pe = 0;
    if ($tid > 0 && $db->table_exists('game_thread_pj_state')) {
        $prev_q = $db->query("SELECT current_pv, current_pe FROM {$prefix}game_thread_pj_state WHERE thread_id = {$tid} AND character_id = {$cid} LIMIT 1");
        if ($prev_row = $db->fetch_array($prev_q)) {
            $prev_pv = (int)$prev_row['current_pv'];
            $prev_pe = (int)$prev_row['current_pe'];
        }
    }
    if ($prev_pv === 0 && $prev_pe === 0) {
        $pj_q = $db->query("SELECT stats_json, race_name FROM {$prefix}game_personajes WHERE id = {$cid} LIMIT 1");
        $pj = $db->fetch_array($pj_q);
        if ($pj) {
            game_postcharacter_ensure_stat_helpers();
            $stats = json_decode($pj['stats_json'] ?? '{}', true);
            if (!is_array($stats)) {
                $stats = [];
            }
            $ctx = game_build_stat_context($stats, (string)($pj['race_name'] ?? ''));
            $vitals = game_compute_pv_pe_from_context($ctx['values'], $ctx['trained']);
            $prev_pv = $vitals['max_pv'];
            $prev_pe = $vitals['max_pe'];
        }
    }

    $current_pv = (isset($_POST['rpg_thread_pv']) && $_POST['rpg_thread_pv'] !== '') ? (int)$_POST['rpg_thread_pv'] : $prev_pv;
    $current_pe = (isset($_POST['rpg_thread_pe']) && $_POST['rpg_thread_pe'] !== '') ? (int)$_POST['rpg_thread_pe'] : $prev_pe;

    $pv_change = 0;
    $pe_change = 0;
    if (isset($_POST['rpg_thread_pv']) && $_POST['rpg_thread_pv'] !== '') {
        $pv_change = $current_pv - $prev_pv;
    }
    if (isset($_POST['rpg_thread_pe']) && $_POST['rpg_thread_pe'] !== '') {
        $pe_change = $current_pe - $prev_pe;
    }

    return [
        'pv_change' => $pv_change,
        'pe_change' => $pe_change,
        'current_pv' => $current_pv,
        'current_pe' => $current_pe,
        'stat_mods_json' => $stat_mods_json,
    ];
}

function game_postcharacter_save_post_modifiers(int $tid, int $cid, int $pid): void
{
    global $db;
    if ($pid <= 0 || $cid <= 0) {
        return;
    }
    if (!game_postcharacter_has_post_modifier_input()) {
        return;
    }
    if (!game_postcharacter_post_modifiers_ready()) {
        if (function_exists('game_log_post_rpg')) {
            game_log_post_rpg('modifiers_skip_columns', ['post_id' => $pid]);
        }
        return;
    }

    $prefix = TABLE_PREFIX;
    $computed = game_postcharacter_compute_post_modifiers($tid, $cid);
    $mods_esc = $db->escape_string($computed['stat_mods_json']);
    $pv_change = (int)$computed['pv_change'];
    $pe_change = (int)$computed['pe_change'];

    $cd_update_sql = '';
    if (!empty($_POST['rpg_cooldown_mods']) && $db->field_exists('cooldown_mods_json', 'game_post_characters')) {
        $raw = json_decode((string)$_POST['rpg_cooldown_mods'], true);
        if (is_array($raw)) {
            $sanitized = [];
            foreach ($raw as $card_id => $turns) {
                $card_id = (int)$card_id;
                $turns = max(0, (int)$turns);
                if ($card_id > 0) {
                    $sanitized[$card_id] = $turns;
                }
            }
            $cd_mods_esc = $db->escape_string(json_encode($sanitized, JSON_UNESCAPED_UNICODE));
            $cd_update_sql = ", cooldown_mods_json = '{$cd_mods_esc}'";
        }
    }

    $db->write_query("
        UPDATE {$prefix}game_post_characters
        SET pv_change = {$pv_change},
            pe_change = {$pe_change},
            modifiers_json = '{$mods_esc}'
            {$cd_update_sql}
        WHERE post_id = {$pid} AND character_id = {$cid}
    ");

    if (function_exists('game_log_post_rpg')) {
        game_log_post_rpg('modifiers_saved', [
            'post_id' => $pid,
            'character_id' => $cid,
            'pv_change' => $pv_change,
            'pe_change' => $pe_change,
            'stat_mods' => $computed['stat_mods_json'],
        ]);
    }
}

function game_postcharacter_save_thread_state(int $tid, int $cid, int $pid): void
{
    global $db;
    if ($tid <= 0 || $cid <= 0 || $pid <= 0) {
        return;
    }

    game_postcharacter_save_post_modifiers($tid, $cid, $pid);

    if (!game_postcharacter_has_post_modifier_input()) {
        return;
    }
    if (!$db->table_exists('game_thread_pj_state')) {
        return;
    }
    if (!game_postcharacter_post_modifiers_ready()) {
        return;
    }

    $prefix = TABLE_PREFIX;
    $computed = game_postcharacter_compute_post_modifiers($tid, $cid);
    $mods_esc = $db->escape_string($computed['stat_mods_json']);
    $current_pv = (int)$computed['current_pv'];
    $current_pe = (int)$computed['current_pe'];

    $db->write_query("
        INSERT INTO {$prefix}game_thread_pj_state (thread_id, character_id, current_pv, current_pe, stat_mods_json, last_post_id)
        VALUES ({$tid}, {$cid}, {$current_pv}, {$current_pe}, '{$mods_esc}', {$pid})
        ON DUPLICATE KEY UPDATE
            current_pv = {$current_pv},
            current_pe = {$current_pe},
            stat_mods_json = '{$mods_esc}',
            last_post_id = {$pid}
    ");
}

function game_postcharacter_process_card_entry($pid, $cid, $c_entry, $stats, $rpg_modifiers, $hidden_action_index = 0, array $equipped_ids = []) {
    global $db;
    $prefix = TABLE_PREFIX;
    $pid = (int)$pid;
    $cid = (int)$cid;
    
    $c = 0;
    $selected_weapons = [];
    $selected_ammo = [];
    $selected_action = '';
    $roll_modifiers = [];
    
    if (is_numeric($c_entry)) {
        $c = (int)$c_entry;
    } elseif (is_array($c_entry)) {
        $c = (int)($c_entry['card_id'] ?? 0);
        if (isset($c_entry['selected_action'])) {
            $selected_action = trim((string)$c_entry['selected_action']);
        }
        if (isset($c_entry['weapons']) && is_array($c_entry['weapons'])) {
            foreach ($c_entry['weapons'] as $w_id) {
                $selected_weapons[] = (int)$w_id;
            }
        }
        if (isset($c_entry['ammo'])) {
            if (is_array($c_entry['ammo'])) {
                foreach ($c_entry['ammo'] as $a_id) {
                    $selected_ammo[] = (int)$a_id;
                }
            } else {
                $selected_ammo[] = (int)$c_entry['ammo'];
            }
        }
        if (isset($c_entry['roll_modifiers']) && is_array($c_entry['roll_modifiers'])) {
            $roll_modifiers = $c_entry['roll_modifiers'];
        }
    }
    
    if ($c <= 0) {
        return;
    }
    
    $own_q = $db->query("SELECT current_rank FROM {$prefix}game_character_cards WHERE character_id = {$cid} AND card_id = {$c} LIMIT 1");
    $own = $db->fetch_array($own_q);
    if (!$own) {
        return;
    }
    
    $rank = $own['current_rank'];
    
    $card_q = $db->query("SELECT name, card_type, dice, execution_stat, effects_json, tags_json FROM {$prefix}game_cards WHERE id = {$c} LIMIT 1");
    $card = $db->fetch_array($card_q);
    if (!$card) {
        return;
    }

    if (!game_postcharacter_card_allowed_in_post(
        (string)$card['card_type'],
        $c,
        $equipped_ids,
        game_postcharacter_is_consumible_card($card)
    )) {
        return;
    }

    // Registrar uso de Haki
    $card_effects = json_decode($card['effects_json'] ?? '{}', true);
    if (is_array($card_effects)) {
        $haki_type = $card_effects['haki_type'] ?? null;
        if ((($card['card_type'] ?? '') === 'haki' || $haki_type) && in_array($haki_type, ['kenbunshoku', 'busoshoku', 'haoshoku'], true)) {
            $db->write_query("
                INSERT INTO {$prefix}game_haki_progress (character_id, haki_type, usos_total, unlocked_at)
                VALUES ({$cid}, '{$haki_type}', 1, NOW())
                ON DUPLICATE KEY UPDATE usos_total = usos_total + 1
            ");
        }
    }

    // Para armas de equipo: añadir el stat de escalado al dado si no está ya incluido
    if ($card['card_type'] === 'equipo' && !empty($card['dice']) && trim($card['dice']) !== '—') {
        $card_ef = json_decode($card['effects_json'] ?? '{}', true);
        if (($card_ef['equipo_type'] ?? '') === 'arma' && !empty($card['execution_stat'])) {
            $scale_stat = strtolower(trim($card['execution_stat']));
            if ($scale_stat !== '') {
                $c_dice = trim($card['dice']);
                $c_tag = '';
                if (preg_match('/\[(.*?)\]$/', $c_dice, $tag_matches)) {
                    $c_tag = $tag_matches[0];
                    $c_dice = trim(substr($c_dice, 0, -strlen($c_tag)));
                }
                if (stripos($c_dice, $scale_stat) === false) {
                    $c_dice = $c_dice . '+' . $scale_stat;
                }
                $card['dice'] = $c_dice . ($c_tag !== '' ? ' ' . $c_tag : '');
            }
        }
    }

    $roll_result = null;
    if ($card['card_type'] === 'npc_menor') {
        $effects = json_decode($card['effects_json'] ?? '{}', true);
        $npc_mascota_type = $effects['npc_mascota_type'] ?? 'npc';
        $acciones = $effects['acciones'] ?? [];
        if (is_string($acciones)) {
            $acciones = array_filter(array_map('trim', explode("\n", $acciones)));
        }
        if ($npc_mascota_type === 'npc') {
            if (is_array($acciones) && count($acciones) > 0) {
                $picked = $acciones[array_rand($acciones)];
                $roll_result = game_postcharacter_format_npc_action($picked, $stats, $rpg_modifiers);
            } else {
                $roll_result = 'Acción básica de NPC';
            }
        } elseif ($npc_mascota_type === 'mascota') {
            if ($selected_action !== '') {
                $picked = null;
                if (is_array($acciones)) {
                    foreach ($acciones as $act) {
                        $act_name = is_array($act) ? ($act['name'] ?? '') : (string)$act;
                        if (strcasecmp(trim($act_name), $selected_action) === 0) {
                            $picked = $act;
                            break;
                        }
                    }
                }
                $roll_result = $picked !== null
                    ? game_postcharacter_format_npc_action($picked, $stats, $rpg_modifiers)
                    : game_postcharacter_format_npc_action($selected_action, $stats, $rpg_modifiers);
            } else {
                $roll_result = 'Acción básica de Mascota';
            }
        }
    } elseif (!empty($card['dice']) && trim($card['dice']) !== '—') {
        $formula = $card['dice'];
        $formula_override = '';
        $formula_override_active = false;
        if (array_key_exists('formula_override', $roll_modifiers)) {
            $formula_override_active = true;
            $formula_override = trim((string)$roll_modifiers['formula_override']);
            if ($formula_override === '' || $formula_override === '—') {
                $formula = '0';
            } else {
                $formula = $formula_override;
            }
        }
        
        // Reemplazar [ARMA] con las fórmulas de armas seleccionadas
        if (strpos($formula, '[ARMA]') !== false) {
            $weapon_formulas = [];
            foreach ($selected_weapons as $w_id) {
                if ($w_id <= 0) continue;
                $w_card_q = $db->query("SELECT dice, card_type, execution_stat, effects_json, tags_json FROM {$prefix}game_cards WHERE id = {$w_id} LIMIT 1");
                if ($w_card = $db->fetch_array($w_card_q)) {
                    if (!game_postcharacter_card_allowed_in_post(
                        (string)$w_card['card_type'],
                        $w_id,
                        $equipped_ids,
                        game_postcharacter_is_consumible_card($w_card)
                    )) {
                        continue;
                    }
                    $w_own_q = $db->query("SELECT 1 FROM {$prefix}game_character_cards WHERE character_id = {$cid} AND card_id = {$w_id} LIMIT 1");
                    if ($db->num_rows($w_own_q) > 0) {
                        $w_dice = trim($w_card['dice']);
                        if ($w_dice !== '' && $w_dice !== '—') {
                            $w_tag = '';
                            if (preg_match('/\[(.*?)\]$/', $w_dice, $tag_matches)) {
                                $w_tag = $tag_matches[0];
                                $w_dice = trim(substr($w_dice, 0, -strlen($w_tag)));
                            }
                            if ($w_card['card_type'] === 'equipo' && !empty($w_card['execution_stat'])) {
                                $w_card_ef = json_decode($w_card['effects_json'] ?? '{}', true);
                                if (($w_card_ef['equipo_type'] ?? '') === 'arma') {
                                    $scale_stat = strtolower(trim($w_card['execution_stat']));
                                    if ($scale_stat !== '' && stripos($w_dice, $scale_stat) === false) {
                                        $w_dice = $w_dice . '+' . $scale_stat;
                                    }
                                }
                            }
                            $weapon_formulas[] = $w_dice;
                        }
                    }
                }
            }
            
            $w_idx = 0;
            while (strpos($formula, '[ARMA]') !== false) {
                $replacement = isset($weapon_formulas[$w_idx]) ? $weapon_formulas[$w_idx] : '0';
                $pos = strpos($formula, '[ARMA]');
                $formula = substr_replace($formula, $replacement, $pos, strlen('[ARMA]'));
                $w_idx++;
            }
        }
        
        // Reemplazar [MUNICION] con las fórmulas de munición seleccionadas
        if (strpos($formula, '[MUNICION]') !== false) {
            $ammo_formulas = [];
            foreach ($selected_ammo as $a_id) {
                if ($a_id <= 0) continue;
                $a_card_q = $db->query("SELECT dice, card_type, effects_json, tags_json FROM {$prefix}game_cards WHERE id = {$a_id} LIMIT 1");
                if ($a_card = $db->fetch_array($a_card_q)) {
                    if (!game_postcharacter_card_allowed_in_post(
                        (string)$a_card['card_type'],
                        $a_id,
                        $equipped_ids,
                        game_postcharacter_is_consumible_card($a_card)
                    )) {
                        continue;
                    }
                    $a_own_q = $db->query("SELECT 1 FROM {$prefix}game_character_cards WHERE character_id = {$cid} AND card_id = {$a_id} LIMIT 1");
                    if ($db->num_rows($a_own_q) > 0) {
                        $a_dice = trim($a_card['dice']);
                        if ($a_dice !== '' && $a_dice !== '—') {
                            $a_tag = '';
                            if (preg_match('/\[(.*?)\]$/', $a_dice, $tag_matches)) {
                                $a_tag = $tag_matches[0];
                                $a_dice = trim(substr($a_dice, 0, -strlen($a_tag)));
                            }
                            $ammo_formulas[] = $a_dice;
                        }
                    }
                }
            }
            
            $a_idx = 0;
            while (strpos($formula, '[MUNICION]') !== false) {
                $replacement = isset($ammo_formulas[$a_idx]) ? $ammo_formulas[$a_idx] : '0';
                $pos = strpos($formula, '[MUNICION]');
                $formula = substr_replace($formula, $replacement, $pos, strlen('[MUNICION]'));
                $a_idx++;
            }
        }
        
        // Aplicar modificadores de tirada (solo modo aditivo legacy si no hay override)
        if (!empty($roll_modifiers) && !$formula_override_active) {
            $formula_mod = '';
            if (!empty($roll_modifiers['dice_mod'])) {
                $dice_parts = [];
                foreach ((array)$roll_modifiers['dice_mod'] as $d) {
                    $d = trim((string)$d);
                    if ($d !== '' && preg_match('/^\d+d\d+$/', $d)) {
                        $dice_parts[] = $d;
                    }
                }
                if ($dice_parts) {
                    $formula_mod .= '+' . implode('+', $dice_parts);
                }
            }
            if (!empty($roll_modifiers['flat_mod'])) {
                $flat = (int)$roll_modifiers['flat_mod'];
                if ($flat > 0) {
                    $formula_mod .= '+' . $flat;
                } elseif ($flat < 0) {
                    $formula_mod .= (string)$flat;
                }
            }
            if ($formula_mod !== '') {
                $formula .= $formula_mod;
            }
        }
        
        try {
            $evaluated = game_evaluate_dice_roll($formula, $stats, $rpg_modifiers);
            $roll_result = $db->escape_string($evaluated);
        } catch (Throwable $t) {
        }
    }
    
    $insert = [
        'post_id' => $pid,
        'character_id' => $cid,
        'card_id' => $c,
        'played_rank' => $rank,
        'roll_result' => $roll_result ?: '',
        'hidden_action_index' => (int)$hidden_action_index,
    ];
    if ($db->field_exists('roll_modifiers_json', 'game_post_cards')) {
        $insert['roll_modifiers_json'] = json_encode($roll_modifiers, JSON_UNESCAPED_UNICODE);
    }
    
    // Construir la consulta manualmente para pasar hide_errors = 1 a write_query
    $fields = [];
    $values = [];
    foreach ($insert as $key => $val) {
        $fields[] = "`" . $db->escape_string($key) . "`";
        $values[] = "'" . $db->escape_string((string)$val) . "'";
    }
    $fields_str = implode(',', $fields);
    $values_str = implode(',', $values);
    $sql = "INSERT INTO {$prefix}game_post_cards ({$fields_str}) VALUES ({$values_str})";
    
    try {
        $db->write_query($sql, 1);
    } catch (Throwable $t) {
    }

    // Decrementar cantidad para consumibles jugados como carta principal
    if (game_postcharacter_is_consumible_card($card)) {
        game_postcharacter_decrement_consumible($cid, $c);
    }

    // Decrementar munición/consumibles usados como adjunto [MUNICION]
    $ammo_used = array_unique(array_filter(array_map('intval', $selected_ammo)));
    foreach ($ammo_used as $a_id) {
        if ($a_id <= 0 || $a_id === $c) {
            continue;
        }
        $a_q = $db->query("SELECT card_type, effects_json, tags_json FROM {$prefix}game_cards WHERE id = {$a_id} LIMIT 1");
        $a_card = $db->fetch_array($a_q);
        if (!$a_card) {
            continue;
        }
        $a_own = $db->query("SELECT 1 FROM {$prefix}game_character_cards WHERE character_id = {$cid} AND card_id = {$a_id} LIMIT 1");
        if (!$db->num_rows($a_own)) {
            continue;
        }
        if (game_postcharacter_is_consumible_card($a_card)) {
            game_postcharacter_decrement_consumible($cid, $a_id);
        }
    }
}

function game_postcharacter_process_oracles(int $pid, int $cid): void
{
    if (empty($_POST['rpg_oracles'])) {
        return;
    }
    global $db;
    
    require_once __DIR__ . '/../../game/src/Application/UseCases/ProcessPostOracles.php';
    $useCase = new \Game\Application\UseCases\ProcessPostOracles($db, TABLE_PREFIX);
    $useCase->execute($pid, $cid, (string)$_POST['rpg_oracles']);
}

function game_postcharacter_process_cards($pid, $cid) {
    global $db;
    
    require_once __DIR__ . '/../../game/src/Application/UseCases/ProcessPostCards.php';
    $useCase = new \Game\Application\UseCases\ProcessPostCards($db, TABLE_PREFIX);
    $useCase->execute((int)$pid, (int)$cid, $_POST);
}

function game_postcharacter_has_rolls(int $pid): bool {
    global $db;
    $prefix = TABLE_PREFIX;
    $q = $db->query("SELECT id FROM {$prefix}game_post_cards WHERE post_id = {$pid} AND roll_result != '' LIMIT 1");
    if ($db->num_rows($q) > 0) return true;
    if ($db->table_exists('game_post_oracles')) {
        $oq = $db->query("SELECT id FROM {$prefix}game_post_oracles WHERE post_id = {$pid} LIMIT 1");
        if ($db->num_rows($oq) > 0) return true;
    }
    if ($db->table_exists('game_navigation_voyages')) {
        $vq = $db->query("SELECT id FROM {$prefix}game_navigation_voyages WHERE post_id = {$pid} LIMIT 1");
        if ($db->num_rows($vq) > 0) return true;
    }
    return false;
}

function game_postcharacter_block_edit() {
    global $mybb;
    $pid = (int)($mybb->get_input('pid', MyBB::INPUT_INT));
    if ($pid > 0 && game_postcharacter_has_rolls($pid)) {
        error("Este mensaje contiene tiradas de dados u oráculos y no puede ser editado.");
    }
}

function game_postcharacter_block_ajax_edit() {
    global $mybb;
    $pid = (int)($mybb->get_input('pid', MyBB::INPUT_INT));
    if ($pid > 0 && game_postcharacter_has_rolls($pid)) {
        xmlhttp_error("Este mensaje contiene tiradas de dados u oráculos y no puede ser editado.");
    }
}

function game_postcharacter_save_post($dh) {
    if (!isset($dh->pid) || !isset($dh->data['uid'])) return;
    $pid = (int)$dh->pid;
    @file_put_contents(__DIR__ . '/../../post_debug.log', "=== game_postcharacter_save_post PID={$pid} ===\n" . print_r($_POST, true) . "\n", FILE_APPEND);
    global $db;
    $prefix = TABLE_PREFIX;
    $uid = (int)$dh->data['uid'];
    if ($uid <= 0) return;
    $cfg = $db->query("SELECT active_pj_id FROM {$prefix}game_user_config WHERE user_id = {$uid} LIMIT 1");
    $row = $db->fetch_array($cfg);
    if (!$row || !$row['active_pj_id']) return;
    $pid = (int)$dh->pid;
    $cid = (int)$row['active_pj_id'];
    $db->write_query("INSERT IGNORE INTO {$prefix}game_post_characters (post_id, user_id, character_id) VALUES ({$pid}, {$uid}, {$cid})");
    game_postcharacter_save_equipped_snapshot($pid, $cid);
    
    // Increment character post count
    $db->write_query("UPDATE {$prefix}game_personajes SET postnum = postnum + 1 WHERE id = {$cid}");

    // If this is in a mission thread, increment the mission post count
    if (isset($dh->data['tid']) && (int)$dh->data['tid'] > 0) {
        $db->write_query("UPDATE {$prefix}game_missions_active SET post_count = post_count + 1 WHERE tid = " . (int)$dh->data['tid'] . " AND status = 'active'");
    }

    // Notify thread author (if replying to someone else's thread)
    if (isset($dh->data['tid']) && (int)$dh->data['tid'] > 0) {
        $tid = (int)$dh->data['tid'];
        $thread_q = $db->query("SELECT uid, subject FROM {$prefix}threads WHERE tid = {$tid} LIMIT 1");
        $thread = $db->fetch_array($thread_q);
        if ($thread && (int)$thread['uid'] !== $uid) {
            $char_name_q = $db->query("SELECT name FROM {$prefix}game_personajes WHERE id = {$cid} LIMIT 1");
            $char_name_row = $db->fetch_array($char_name_q);
            $char_name = $char_name_row ? $char_name_row['name'] : 'Alguien';
            $subject = $thread['subject'];
            $bb = '';
            global $mybb;
            if (isset($mybb) && isset($mybb->settings['bburl'])) $bb = $mybb->settings['bburl'];
            $link = rtrim($bb, '/') . "/showthread.php?tid={$tid}&pid={$pid}#pid{$pid}";
            game_create_notification(
                (int)$thread['uid'],
                'role_reply',
                "{$char_name} respondió en «{$subject}»",
                '',
                $link
            );
        }
    }
    
    game_postcharacter_process_cards($pid, $cid);
    game_postcharacter_process_oracles($pid, $cid);

    if (function_exists('game_navigation_process_post') && isset($dh->data['tid'])) {
        game_navigation_process_post($pid, (int)$dh->data['tid'], $cid, $_POST);
    }

    if (isset($dh->data['tid']) && (int)$dh->data['tid'] > 0) {
        game_postcharacter_save_thread_state((int)$dh->data['tid'], $cid, $pid);
    }

    if (function_exists('game_log_post_rpg')) {
        game_log_post_rpg('save_post_done', [
            'post_id' => $pid,
            'character_id' => $cid,
            'had_cards' => !empty($_POST['rpg_played_cards']),
            'had_hidden' => !empty($_POST['rpg_hidden_actions']),
            'had_oracles' => !empty($_POST['rpg_oracles']),
            'had_modifiers' => !empty($_POST['rpg_modifiers']),
            'modifiers_ready' => game_postcharacter_post_modifiers_ready(),
            'hidden_col' => $db->field_exists('hidden_actions_json', 'game_post_characters'),
        ]);
    }

    // Award PP based on word count
    game_postcharacter_award_pp($pid, $cid, $dh->data['message'] ?? '', (int)($dh->data['tid'] ?? 0));
}

function game_postcharacter_save_thread($dh) {
    if (!isset($dh->pid) || !isset($dh->data['uid']) || !isset($dh->tid)) return;
    $pid = (int)$dh->pid;
    @file_put_contents(__DIR__ . '/../../post_debug.log', "=== game_postcharacter_save_thread PID={$pid} ===\n" . print_r($_POST, true) . "\n", FILE_APPEND);
    global $db;
    $prefix = TABLE_PREFIX;
    $uid = (int)$dh->data['uid'];
    if ($uid <= 0) return;
    $cfg = $db->query("SELECT active_pj_id FROM {$prefix}game_user_config WHERE user_id = {$uid} LIMIT 1");
    $row = $db->fetch_array($cfg);
    if (!$row || !$row['active_pj_id']) return;
    $pid = (int)$dh->pid;
    $tid = (int)$dh->tid;
    $cid = (int)$row['active_pj_id'];
    $db->write_query("INSERT IGNORE INTO {$prefix}game_post_characters (post_id, thread_id, user_id, character_id) VALUES ({$pid}, {$tid}, {$uid}, {$cid})");
    game_postcharacter_save_equipped_snapshot($pid, $cid);
    
    // Increment character post count and thread count
    $db->write_query("UPDATE {$prefix}game_personajes SET postnum = postnum + 1, threadnum = threadnum + 1 WHERE id = {$cid}");

    // If this is in a mission thread, increment the mission post count
    if ($tid > 0) {
        $db->write_query("UPDATE {$prefix}game_missions_active SET post_count = post_count + 1 WHERE tid = {$tid} AND status = 'active'");
    }

    // Save thread type and in-game date from POST (set when creating a thread)
    if (isset($_POST['game_thread_type'])) {
        $allowed_types = ['Pasado','Presente','Mision','Evento','Trama','Fic','Off_Rol'];
        $type = in_array($_POST['game_thread_type'], $allowed_types) ? $_POST['game_thread_type'] : 'Presente';
        
        if ($type === 'Presente') {
            $epoch = strtotime('2026-05-01');
            $now = time();
            $diff_seconds = max(0, $now - $epoch);
            $diff_days_float = $diff_seconds / 86400;
            $rol_days = floor($diff_days_float * 1.5) + 1;
            
            $days_per_season = 65;
            $days_per_year = $days_per_season * 4;
            
            $year = floor(($rol_days - 1) / $days_per_year) + 1;
            $day_of_year = (($rol_days - 1) % $days_per_year) + 1;
            $season = floor(($day_of_year - 1) / $days_per_season);
            $day = (($day_of_year - 1) % $days_per_season) + 1;
        } else {
            $day = max(1, min(100, (int)($_POST['game_day'] ?? 1)));
            $season = max(0, min(3, (int)($_POST['game_season'] ?? 0)));
            $year = max(1, (int)($_POST['game_year'] ?? 1));
        }
        
        $db->write_query("INSERT INTO {$prefix}game_thread_meta (thread_id, thread_type, day, season, year)
            VALUES ({$tid}, '{$db->escape_string($type)}', {$day}, {$season}, {$year})
            ON DUPLICATE KEY UPDATE thread_type='{$db->escape_string($type)}', day={$day}, season={$season}, year={$year}");
    }
    
    game_postcharacter_process_cards($pid, $cid);
    game_postcharacter_process_oracles($pid, $cid);

    if (function_exists('game_navigation_process_post')) {
        game_navigation_process_post($pid, $tid, $cid, $_POST);
    }

    game_postcharacter_save_thread_state($tid, $cid, $pid);

    if (function_exists('game_log_post_rpg')) {
        game_log_post_rpg('save_thread_done', [
            'post_id' => $pid,
            'thread_id' => $tid,
            'character_id' => $cid,
            'had_cards' => !empty($_POST['rpg_played_cards']),
            'had_hidden' => !empty($_POST['rpg_hidden_actions']),
            'had_oracles' => !empty($_POST['rpg_oracles']),
            'had_modifiers' => !empty($_POST['rpg_modifiers']),
        ]);
    }

    // Award PP based on word count
    game_postcharacter_award_pp($pid, $cid, $dh->data['message'] ?? '', $tid);
}

function game_postcharacter_delete_post($pid) {
    global $db;
    $prefix = TABLE_PREFIX;
    $pid = (int)$pid;
    if ($pid <= 0) return $pid;
    
    $query = $db->query("SELECT character_id FROM {$prefix}game_post_characters WHERE post_id = {$pid} LIMIT 1");
    $row = $db->fetch_array($query);
    if ($row && $row['character_id']) {
        $cid = (int)$row['character_id'];
        $db->write_query("UPDATE {$prefix}game_personajes SET postnum = GREATEST(0, postnum - 1) WHERE id = {$cid}");
    }
    return $pid;
}

function game_postcharacter_delete_thread($tid) {
    global $db;
    $prefix = TABLE_PREFIX;
    $tid = (int)$tid;
    if ($tid <= 0) return $tid;
    
    // Decrement threadnum for the author (the one who created thread_id)
    $q_thread = $db->query("SELECT character_id FROM {$prefix}game_post_characters WHERE thread_id = {$tid} LIMIT 1");
    $author = $db->fetch_array($q_thread);
    if ($author && $author['character_id']) {
        $cid = (int)$author['character_id'];
        $db->write_query("UPDATE {$prefix}game_personajes SET threadnum = GREATEST(0, threadnum - 1) WHERE id = {$cid}");
    }
    
    // Decrement postnum for everyone who posted in this thread
    // Note: MyBB's delete_thread doesn't call delete_post for each post individually for performance,
    // so we need to find all posts in this thread and decrement the respective character's postnum.
    // game_post_characters maps post_id -> character_id.
    // We must join with MyBB's posts table to get the posts in this thread before they are deleted.
    $q_posts = $db->query("
        SELECT gpc.character_id, COUNT(*) as post_count
        FROM {$prefix}posts p
        JOIN {$prefix}game_post_characters gpc ON p.pid = gpc.post_id
        WHERE p.tid = {$tid}
        GROUP BY gpc.character_id
    ");
    
    while ($r = $db->fetch_array($q_posts)) {
        $cid = (int)$r['character_id'];
        $count = (int)$r['post_count'];
        $db->write_query("UPDATE {$prefix}game_personajes SET postnum = GREATEST(0, postnum - {$count}) WHERE id = {$cid}");
    }
    
    return $tid;
}

function game_postcharacter_resolve_active_char_id(): int
{
    global $mybb, $db;
    $uid = (int)($mybb->user['uid'] ?? 0);
    if ($uid <= 0) {
        return 0;
    }
    $prefix = TABLE_PREFIX;
    $cfg_q = $db->query("SELECT active_pj_id FROM {$prefix}game_user_config WHERE user_id = {$uid} LIMIT 1");
    $cfg = $db->fetch_array($cfg_q);
    $active = $cfg ? (int)$cfg['active_pj_id'] : 0;
    if ($active <= 0) {
        return 0;
    }
    $pj_q = $db->query("SELECT id FROM {$prefix}game_personajes WHERE id = {$active} AND user_id = {$uid} LIMIT 1");
    return $db->fetch_array($pj_q) ? $active : 0;
}

function game_postcharacter_set_template_vars(): void
{
    global $game_active_char_id, $game_nav_island_fid, $game_post_forum_fid, $game_thread_type;
    $game_active_char_id = (string)game_postcharacter_resolve_active_char_id();
    $game_nav_island_fid = '0';
    $game_post_forum_fid = '0';
    $game_thread_type = '';

    if (!defined('THIS_SCRIPT')) {
        return;
    }
    $postingScripts = ['newreply.php', 'newthread.php', 'showthread.php'];
    if (!in_array(THIS_SCRIPT, $postingScripts, true)) {
        return;
    }

    global $mybb;
    $fid = 0;
    if (THIS_SCRIPT === 'newreply.php' || THIS_SCRIPT === 'showthread.php') {
        $tid = (int)($mybb->get_input('tid', MyBB::INPUT_INT) ?: ($mybb->input['tid'] ?? 0));
        if ($tid > 0) {
            global $db;
            $prefix = TABLE_PREFIX;
            $tq = $db->query("SELECT fid FROM {$prefix}threads WHERE tid = {$tid} LIMIT 1");
            $tr = $db->fetch_array($tq);
            $fid = $tr ? (int)$tr['fid'] : 0;
            $metaQ = $db->query("SELECT thread_type FROM {$prefix}game_thread_meta WHERE thread_id = {$tid} LIMIT 1");
            if ($metaRow = $db->fetch_array($metaQ)) {
                $game_thread_type = $metaRow['thread_type'];
            }
        }
    } elseif (THIS_SCRIPT === 'newthread.php') {
        $fid = (int)($mybb->get_input('fid', MyBB::INPUT_INT) ?: ($mybb->input['fid'] ?? 0));
    }

    if ($fid > 0) {
        $game_post_forum_fid = (string)$fid;
        if (!function_exists('game_nav_get_island_from_forum')) {
            $navHelpers = dirname(__DIR__, 2) . '/game/inc/navigation_helpers.php';
            if (is_file($navHelpers)) {
                require_once $navHelpers;
            }
        }
        if (function_exists('game_nav_get_island_from_forum')) {
            $island = game_nav_get_island_from_forum($fid);
            if ($island) {
                $game_nav_island_fid = (string)(int)$island['fid'];
            }
        }
    }
}

function game_postcharacter_global_date() {
    global $mybb;
    $mybb->settings['game_rol_header_html'] = '';
    if (!defined('THIS_SCRIPT') || THIS_SCRIPT !== 'index') return;
    $epoch = strtotime('2026-05-01');
    $now = time();
    $diff_days = max(0, floor(($now - $epoch) / 86400));
    $rol_days = ($diff_days * 2) + 1;
    $rol_year = floor(($rol_days - 1) / 400) + 1;
    $day_of_year = (($rol_days - 1) % 400) + 1;
    $season_idx = floor(($day_of_year - 1) / 100);
    $rol_day = (($day_of_year - 1) % 100) + 1;
    $seasons_names = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
    $current_season = $seasons_names[$season_idx] ?? 'Desconocida';
    $date_full = "Día {$rol_day} de {$current_season}, Año {$rol_year}";
    $mybb->settings['game_rol_header_html'] = '
    <div class="game-hero-date">
        <div class="game-hero-date-inner">
            <i class="fas fa-sun" style="color: #f59e0b; font-size: 18px;"></i>
            <span class="game-hero-date-text">' . $date_full . '</span>
            <span class="game-hero-date-label">CRONOLOGÍA MUNDIAL</span>
        </div>
    </div>';
}

/**
 * Crea una notificación en la base de datos.
 * Llamable desde cualquier hook o script admin.
 */
function game_create_notification(int $userId, string $type, string $title, string $body = '', string $link = '', ?int $characterId = null): void {
    global $db;
    $prefix = TABLE_PREFIX;
    $cid = $characterId ? (int)$characterId : 'NULL';
    $db->write_query(
        "INSERT INTO {$prefix}game_notifications (user_id, character_id, type, title, body, link)
         VALUES ({$userId}, {$cid}, '{$db->escape_string($type)}', '{$db->escape_string($title)}', '{$db->escape_string($body)}', '{$db->escape_string($link)}')"
    );
}

function game_evaluate_dice_roll(string $formula, array $stats, array $modifiers = []): string {
    $original_formula = trim($formula);
    if ($original_formula === '' || $original_formula === '—') {
        return '';
    }
    
    // 1. Extract bracketed tags at the end (e.g. [FUEGO], [AGUA], etc.)
    $tag = '';
    if (preg_match('/\[(.*?)\]$/', $original_formula, $tag_matches)) {
        $tag = trim($tag_matches[1]);
        $formula_no_tag = trim(substr($original_formula, 0, -strlen($tag_matches[0])));
    } else {
        $formula_no_tag = $original_formula;
    }
    
    // Clean spaces and make lowercase for parsing
    $clean_formula = str_replace(' ', '', strtolower($formula_no_tag));
    
    // 2. Tokenize the formula by splitting on + or - signs, keeping delimiters
    $tokens = preg_split('/([+-])/', $clean_formula, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
    
    $total = 0;
    $sign = 1;
    $details = [];
    
    foreach ($tokens as $token) {
        if ($token === '+') {
            $sign = 1;
        } elseif ($token === '-') {
            $sign = -1;
        } else {
            // Is it a dice notation? (e.g. "2d8", "1d6")
            if (preg_match('/^(\d+)d(\d+)$/', $token, $dice_matches)) {
                $num = (int)$dice_matches[1];
                $faces = (int)$dice_matches[2];
                if ($num > 100) $num = 100; // safety cap
                if ($faces > 1000) $faces = 1000;
                
                $rolls = [];
                $sum = 0;
                for ($i = 0; $i < $num; $i++) {
                    $r = mt_rand(1, $faces);
                    $rolls[] = $r;
                    $sum += $r;
                }
                
                $total += $sum * $sign;
                $prefix = ($sign < 0) ? '- ' : '';
                if ($sign > 0 && empty($details)) {
                    $prefix = '';
                } elseif ($sign > 0) {
                    $prefix = '+ ';
                }
                $details[] = $prefix . "{$num}d{$faces} (" . implode(' + ', $rolls) . ")";
                
            } elseif (is_numeric($token)) {
                // Is it a constant number?
                $val = (int)$token;
                $total += $val * $sign;
                
                $prefix = ($sign < 0) ? '- ' : '';
                if ($sign > 0 && empty($details)) {
                    $prefix = '';
                } elseif ($sign > 0) {
                    $prefix = '+ ';
                }
                $details[] = $prefix . $val;
                
            } else {
                // Check if it has a multiplier or divisor
                $stat_name = '';
                $multiplier = 1.0;
                $divisor = 1.0;
                $val = 0;
                
                if (preg_match('/^([\d.]+)\*([a-z_]+)$/', $token, $m)) {
                    $multiplier = (float)$m[1];
                    $stat_name = $m[2];
                } elseif (preg_match('/^([a-z_]+)\*([\d.]+)$/', $token, $m)) {
                    $stat_name = $m[1];
                    $multiplier = (float)$m[2];
                } elseif (preg_match('/^([a-z_]+)\/([\d.]+)$/', $token, $m)) {
                    $stat_name = $m[1];
                    $divisor = (float)$m[2];
                } else {
                    $stat_name = $token;
                }
                
                $mapped_name = $stat_name;
                $mod_val = (int)($modifiers[$mapped_name] ?? 0);
                $mod_str = '';
                if ($mod_val !== 0) {
                    $mod_str = ($mod_val > 0 ? ' +' : ' ') . $mod_val;
                }

                if (preg_match('/^([\d.]+)\*([a-z_]+)$/', $token, $m)) {
                    $label = $multiplier . "*" . strtoupper($stat_name) . $mod_str;
                } elseif (preg_match('/^([a-z_]+)\*([\d.]+)$/', $token, $m)) {
                    $label = strtoupper($stat_name) . $mod_str . "*" . $multiplier;
                } elseif (preg_match('/^([a-z_]+)\/([\d.]+)$/', $token, $m)) {
                    $label = strtoupper($stat_name) . $mod_str . "/" . $divisor;
                } else {
                    $label = strtoupper($stat_name) . $mod_str;
                }
                
                $stat_val = (int)($stats[$mapped_name] ?? 0);
                
                if ($divisor != 0) {
                    $val = (int)floor(($stat_val * $multiplier) / $divisor);
                } else {
                    $val = 0;
                }
                
                $total += $val * $sign;
                
                $prefix = ($sign < 0) ? '- ' : '';
                if ($sign > 0 && empty($details)) {
                    $prefix = '';
                } elseif ($sign > 0) {
                    $prefix = '+ ';
                }
                $details[] = $prefix . $val . " (" . $label . ")";
            }
            
            // Reset sign
            $sign = 1;
        }
    }
    
    $detail_str = implode(' ', $details);
    $tag_suffix = ($tag !== '') ? " [" . $tag . "]" : '';

    return $detail_str . " = " . $total . $tag_suffix;
}

/**
 * Formatea y evalúa una acción de NPC/mascota (string legacy u objeto {name,dice,stat}).
 */
function game_postcharacter_format_npc_action($action, array $stats, array $rpg_modifiers = []): string
{
    if (is_array($action)) {
        $name = trim((string)($action['name'] ?? 'Acción'));
        $dice = trim((string)($action['dice'] ?? ''));
        $stat = trim((string)($action['stat'] ?? ''));
        if ($dice !== '') {
            $formula = $dice . ($stat !== '' ? '+' . $stat : '');
            try {
                $evaluated = game_evaluate_dice_roll($formula, $stats, $rpg_modifiers);
                return $name . ': ' . $evaluated;
            } catch (Throwable $t) {
                return $name;
            }
        }
        return $name;
    }
    $text = trim((string)$action);
    if ($text === '') {
        return 'Acción básica';
    }
    if (preg_match('/\d+d\d+/i', $text)) {
        return game_evaluate_dice_in_action($text, $stats, $rpg_modifiers);
    }
    return $text;
}

/**
 * Detecta notación de dados dentro del texto de una acción de NPC/mascota,
 * evalúa la tirada y devuelve el texto con el resultado appended.
 * Formato esperado: "Texto descriptivo: 1d6 + DES" o "1d6+fue"
 */
function game_evaluate_dice_in_action(string $action_text, array $stats, array $rpg_modifiers = []): string {
    if (!preg_match('/\d+d\d+/i', $action_text)) {
        return $action_text;
    }

    // Intentar extraer la fórmula: parte después del último ":" o "–" / "—"
    $formula = '';
    if (preg_match('/[:\-–—]\s*(\d.+)$/u', $action_text, $m)) {
        $formula = trim($m[1]);
    } elseif (preg_match('/(\d+d\d+(?:\s*[+\-]\s*(?:\d+d\d+|\d+|[a-z_]+))*)\s*$/i', $action_text, $m)) {
        $formula = trim($m[1]);
    }

    if ($formula === '') {
        return $action_text;
    }

    // Limpiar puntuación al final
    $formula = rtrim($formula, '.,!;:)');

    try {
        $evaluated = game_evaluate_dice_roll($formula, $stats, $rpg_modifiers);
        return $action_text . "\n→ " . $evaluated;
    } catch (Throwable $t) {
        return $action_text;
    }
}

function game_postcharacter_count_words(string $text): int
{
    $text = strip_tags($text);
    // Strip BBCode tags
    $text = preg_replace('/\[[^\]]*\]/', ' ', $text);
    return (int)preg_match_all('/\p{L}+/u', $text);
}

function game_postcharacter_award_pp(int $pid, int $cid, string $message, int $tid): void
{
    global $db;
    $prefix = TABLE_PREFIX;

    static $awarded_pids = [];
    if (isset($awarded_pids[$pid])) {
        return;
    }
    $awarded_pids[$pid] = true;

    $is_off_rol = false;
    if ($tid > 0) {
        $meta_q = $db->simple_select('game_thread_meta', 'thread_type', "thread_id = {$tid}", ['limit' => 1]);
        if ($meta = $db->fetch_array($meta_q)) {
            if ($meta['thread_type'] === 'Off_Rol') {
                $is_off_rol = true;
            }
        } else {
            if (isset($_POST['game_thread_type']) && $_POST['game_thread_type'] === 'Off_Rol') {
                $is_off_rol = true;
            }
        }
    }

    if ($is_off_rol) {
        return;
    }

    $word_count = game_postcharacter_count_words($message);
    if ($word_count <= 0) {
        return;
    }

    if (!class_exists('\\Game\\Shared\\StatScale')) {
        require_once MYBB_ROOT . 'game/bootstrap.php';
    }
    $pp_earned = intdiv($word_count, \Game\Shared\StatScale::WORDS_PER_PP);
    if ($pp_earned <= 0) {
        return;
    }

    $pj_q = $db->simple_select('game_personajes', 'data_json', "id = {$cid}", ['limit' => 1]);
    $pj = $db->fetch_array($pj_q);
    if ($pj) {
        $data = json_decode($pj['data_json'] ?? '{}', true);
        if (!is_array($data)) {
            $data = [];
        }

        $current_pp = (int)($data['pp'] ?? 0);
        $data['pp'] = $current_pp + $pp_earned;

        if (!class_exists('\\Game\\Application\\Services\\CharacterProgression')) {
            require_once MYBB_ROOT . 'game/bootstrap.php';
        }
        \Game\Application\Services\CharacterProgression::normalize($data);

        $data_json_esc = $db->escape_string(json_encode($data, JSON_UNESCAPED_UNICODE));
        $db->write_query("UPDATE {$prefix}game_personajes SET data_json = '{$data_json_esc}' WHERE id = {$cid}");
    }
}

function game_postcharacter_ensure_stat_helpers(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    require_once MYBB_ROOT . 'game/inc/stat_helpers.php';
    $loaded = true;
}

function game_postcharacter_parse_spoiler_bbcode(&$message): void
{
    if (strpos($message, '[spoiler') === false) {
        return;
    }
    $message = preg_replace_callback(
        '#\[spoiler(?:=([^\]]*))?\](.*?)\[/spoiler\]#si',
        static function (array $m): string {
            $title = !empty($m[1]) ? htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8') : '';
            $label = $title !== '' ? 'Spoiler: ' . $title : 'Spoiler';
            $body = $m[2];
            return '<details class="rpg-spoiler"><summary class="rpg-spoiler__title">' . $label . '</summary><div class="rpg-spoiler__body">' . $body . '</div></details>';
        },
        $message
    );
}
