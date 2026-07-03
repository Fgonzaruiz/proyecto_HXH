-- MIGRACIÓN 007: SISTEMA DE CARTAS, INVENTARIO Y REGISTROS DE ACTIVIDAD
-- Crea game_items, game_inventory, game_item_requests, game_npcs, game_notifications, game_xp_log y game_combat_log.

CREATE TABLE IF NOT EXISTS game_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  item_type    VARCHAR(30) DEFAULT 'equipo', -- 'tecnica' | 'equipo' | 'nen_ability' | 'npc_menor'
  card_type    VARCHAR(30) DEFAULT 'equipo', -- Alias por consistencia de Cards System
  rarity       VARCHAR(10) DEFAULT 'common',
  effects_json JSON NULL,
  cost_jenny   BIGINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_inventory (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  character_id  INT NOT NULL,
  item_id       INT NOT NULL,
  quantity      TINYINT DEFAULT 1,
  equipped      TINYINT(1) DEFAULT 0,
  slot          VARCHAR(30) NULL, -- 'arma_principal' | 'arma_secundaria' | 'armadura' | 'accesorio1' | 'accesorio2' | 'habilidad_combat'
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES game_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_item_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  character_id  INT NOT NULL,
  item_id       INT NULL,
  request_type  VARCHAR(20) DEFAULT 'purchase', -- 'purchase' | 'gift' | 'event'
  status        VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  power_id      INT NULL,
  notes         TEXT,
  reviewed_by   INT NULL,
  reject_note   TEXT,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES game_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_npcs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  region_id   INT NULL,
  npc_type    VARCHAR(30) DEFAULT 'generic',
  description TEXT,
  stats_json  JSON NULL,
  nen_type    VARCHAR(50) NULL,
  is_canon    TINYINT(1) DEFAULT 0,
  
  FOREIGN KEY (region_id) REFERENCES game_regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  character_id  INT NOT NULL,
  notif_type    VARCHAR(50) NOT NULL, -- 'hatsu_approved' | 'positioning_change' | 'mission_assigned' etc.
  title         VARCHAR(200) NOT NULL,
  message       TEXT NOT NULL,
  is_read       TINYINT(1) DEFAULT 0,
  related_id    INT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_xp_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  character_id  INT NOT NULL,
  xp_gained     INT NOT NULL,
  source_type   VARCHAR(30) NOT NULL, -- 'mission' | 'post' | 'oracle' | 'staff'
  source_id     INT NULL,
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_combat_log (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  thread_id           INT NOT NULL,
  attacker_char_id    INT NOT NULL,
  defender_char_id    INT NULL,
  npc_id              INT NULL,
  nen_state_attacker  VARCHAR(10) NULL,
  nen_state_defender  VARCHAR(10) NULL,
  roll_result         JSON NULL,
  damage_dealt        INT DEFAULT 0,
  damage_received     INT DEFAULT 0,
  xp_gained           INT DEFAULT 0,
  outcome             VARCHAR(20) NULL, -- 'victory' | 'defeat' | 'draw'
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (attacker_char_id) REFERENCES game_personajes(id) ON DELETE CASCADE,
  FOREIGN KEY (defender_char_id) REFERENCES game_personajes(id) ON DELETE SET NULL,
  FOREIGN KEY (npc_id) REFERENCES game_npcs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
