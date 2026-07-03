-- MIGRACIÓN 001: CREAR TABLA PERSONAJES
-- Crea la ficha principal con estadísticas de base y metadatos de aprobación.

CREATE TABLE IF NOT EXISTS game_personajes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  mybb_uid        INT NOT NULL UNIQUE,
  name            VARCHAR(200) NOT NULL,
  age             TINYINT UNSIGNED DEFAULT 16,
  height_cm       SMALLINT UNSIGNED DEFAULT 170,
  weight_kg       TINYINT UNSIGNED DEFAULT 60,
  
  -- Estadísticas Base
  stat_strength   SMALLINT DEFAULT 10,   -- Fuerza (FUE)
  stat_resistance SMALLINT DEFAULT 10,   -- Resistencia (RES)
  stat_agility    SMALLINT DEFAULT 10,   -- Agilidad (AGI)
  stat_dexterity  SMALLINT DEFAULT 10,   -- Destreza (DES)
  stat_intelligence SMALLINT DEFAULT 10, -- Inteligencia (INT)
  stat_instinct   SMALLINT DEFAULT 10,   -- Instinto (INST)
  stat_spirit     SMALLINT DEFAULT 10,   -- Espíritu (ESP)
  stat_points_available SMALLINT DEFAULT 0,
  
  -- Progreso y nivel
  level           SMALLINT DEFAULT 1,
  experience      INT DEFAULT 0,
  exp_weekly      INT DEFAULT 0,
  jenny           BIGINT DEFAULT 0,
  `rank`           VARCHAR(5) DEFAULT 'D',
  
  -- Estado y aprobación
  is_active       TINYINT(1) DEFAULT 1,
  approved        TINYINT(1) DEFAULT 0,
  approved_by     INT NULL,
  approved_at     DATETIME NULL,
  
  -- Contadores de actividad
  post_count      INT DEFAULT 0,
  thread_count    INT DEFAULT 0,
  mission_count   INT DEFAULT 0,
  
  -- Timestamps
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_mybb (mybb_uid),
  INDEX idx_rank (`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
