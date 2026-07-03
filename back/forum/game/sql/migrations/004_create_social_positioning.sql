-- MIGRACIÓN 004: CREAR TABLAS DE POSICIONAMIENTO SOCIAL
-- Crea game_positioning y game_positioning_log.

CREATE TABLE IF NOT EXISTS game_positioning (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  character_id    INT NOT NULL,
  actor           VARCHAR(50) NOT NULL, -- Ej: 'hunter_guild', 'underworld', etc.
  score           SMALLINT DEFAULT 0,  -- -100 a +100
  label           VARCHAR(100) NULL,   -- auto-calculado
  last_updated    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_char_actor (character_id, actor),
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_positioning_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  character_id  INT NOT NULL,
  actor         VARCHAR(50) NOT NULL,
  delta         SMALLINT NOT NULL,
  score_before  SMALLINT NOT NULL,
  score_after   SMALLINT NOT NULL,
  reason        TEXT NULL,
  applied_by    INT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
