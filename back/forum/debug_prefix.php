<?php
define('IN_MYBB', 1);
require_once __DIR__ . '/global.php';
global $db;
$q = $db->query("SELECT tid, subject, prefix FROM " . TABLE_PREFIX . "threads ORDER BY tid DESC LIMIT 5");
$res = [];
while ($row = $db->fetch_array($q)) {
    // try to get prefix info
    if ($row['prefix']) {
        $pq = $db->query("SELECT prefix as prefix_name FROM " . TABLE_PREFIX . "threadprefixes WHERE pid = " . (int)$row['prefix']);
        $p = $db->fetch_array($pq);
        $row['prefix_name'] = $p['prefix_name'] ?? 'UNKNOWN';
    }
    $res[] = $row;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($res);
