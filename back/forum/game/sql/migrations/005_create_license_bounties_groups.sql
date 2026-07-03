-- MIGRACIÓN 005: LICENCIA DE CAZADOR, BOUNTIES Y GRUPOS NATIVOS
-- Crea game_hunter_license, game_bounties, game_groups y game_group_members.

CREATE TABLE IF NOT EXISTS game_hunter_license (
  character_id   INT PRIMARY KEY,
  license_number VARCHAR(20) UNIQUE NOT NULL,
  hunter_type    VARCHAR(30) DEFAULT 'rookie', -- Ej: 'rookie', 'single', 'double', 'triple'
  specialty      VARCHAR(100) NULL,
  revoked        TINYINT(1) DEFAULT 0,
  revoked_reason TEXT NULL,
  issued_at      DATETIME NULL,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_bounties (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  target_char_id  INT NOT NULL,
  posted_by       INT NULL,        -- NULL = Asociación de Cazadores
  amount_jenny    BIGINT DEFAULT 0,
  reason          TEXT NOT NULL,
  is_visible      TINYINT(1) DEFAULT 1, -- 0 = clasificado/secreto
  capture_only    TINYINT(1) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'active', -- 'active' | 'claimed' | 'expired' | 'revoked'
  claimed_by      INT NULL,
  expires_at      DATETIME NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (target_char_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_groups (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  group_type    VARCHAR(30) DEFAULT 'independent', -- 'canon' | 'independent' | 'mafia'
  description   TEXT,
  max_members   TINYINT DEFAULT 13,
  is_canon      TINYINT(1) DEFAULT 0,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_group_members (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  group_id      INT NOT NULL,
  character_id  INT NOT NULL,
  rank_in_group VARCHAR(100) NULL,
  member_number TINYINT NULL, -- Ej: Número en el Gen'ei Ryodan (1-13)
  joined_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_group_member (group_id, character_id),
  FOREIGN KEY (group_id) REFERENCES game_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
