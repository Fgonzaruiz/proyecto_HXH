-- MIGRACIÓN 006: REGIONES, MISIONES Y ORÁCULOS DE EVENTOS
-- Crea game_regions, game_missions, game_mission_participants, game_oracles y game_oracle_entries.

CREATE TABLE IF NOT EXISTS game_regions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  tier              TINYINT DEFAULT 1,  -- 1 a 7 (7 = Continente Oscuro)
  locked            TINYINT(1) DEFAULT 0,
  lock_message      VARCHAR(500) NULL,
  requires_license  TINYINT(1) DEFAULT 0,
  min_nen_level     TINYINT DEFAULT 0,
  min_rank          VARCHAR(5) DEFAULT 'D'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_missions (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(300) NOT NULL,
  description         TEXT,
  mission_type        VARCHAR(30) DEFAULT 'hunt', -- 'hunt' | 'gather' | 'escort' | 'explore'
  region_id           INT NULL,
  min_rank            VARCHAR(5) DEFAULT 'D',
  requires_license    TINYINT(1) DEFAULT 0,
  reward_jenny        BIGINT DEFAULT 0,
  reward_exp          INT DEFAULT 0,
  max_participants    TINYINT DEFAULT 1,
  status              VARCHAR(20) DEFAULT 'open', -- 'open' | 'active' | 'completed' | 'failed'
  expires_at          DATETIME NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (region_id) REFERENCES game_regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_mission_participants (
  mission_id    INT NOT NULL,
  character_id  INT NOT NULL,
  accepted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at  DATETIME NULL,
  outcome       VARCHAR(20) NULL, -- 'success' | 'fail'
  
  UNIQUE KEY uq_mp (mission_id, character_id),
  FOREIGN KEY (mission_id) REFERENCES game_missions(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_oracles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  oracle_type VARCHAR(50) DEFAULT 'event',
  region_slug VARCHAR(100) NULL,
  tags_json   JSON NULL,
  is_active   TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_oracle_entries (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  oracle_id INT NOT NULL,
  range_min TINYINT NOT NULL, -- Rango dado en d100
  range_max TINYINT NOT NULL,
  result_text TEXT NOT NULL,
  result_effects JSON NULL,  -- Efectos mecánicos (ej: stat_strength + 1)
  weight TINYINT DEFAULT 1,
  
  FOREIGN KEY (oracle_id) REFERENCES game_oracles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
