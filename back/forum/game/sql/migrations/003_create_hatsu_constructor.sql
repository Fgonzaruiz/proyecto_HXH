-- MIGRACIÓN 003: CREAR TABLAS DEL HATSU CONSTRUCTOR (MVP)
-- Crea game_hatsu y game_hatsu_conditions.

CREATE TABLE IF NOT EXISTS game_hatsu (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  character_id        INT NOT NULL,
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  nen_type_primary    VARCHAR(50) NOT NULL,
  nen_type_secondary  VARCHAR(50) DEFAULT NULL,
  type_mix_pct        TINYINT DEFAULT 100, -- % tipo primario
  conditions_count    TINYINT DEFAULT 0,
  vow_text            TEXT NULL,
  vow_active          TINYINT(1) DEFAULT 0,
  vow_broken          TINYINT(1) DEFAULT 0,
  vow_broken_at       DATETIME NULL,
  power_score         INT DEFAULT 0,
  power_score_raw     JSON NULL,     -- desglose matemático del cálculo
  approved            TINYINT(1) DEFAULT 0,
  approved_by         INT NULL,
  approved_at         DATETIME NULL,
  reject_note         TEXT NULL,
  is_active           TINYINT(1) DEFAULT 1,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_hatsu_conditions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  hatsu_id        INT NOT NULL,
  condition_text  TEXT NOT NULL,
  condition_order TINYINT DEFAULT 0,
  
  FOREIGN KEY (hatsu_id) REFERENCES game_hatsu(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
