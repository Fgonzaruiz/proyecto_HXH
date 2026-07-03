-- MIGRACIÓN 002: CREAR TABLAS DEL SISTEMA DE NEN NATIVO
-- Crea game_nen_progress y game_nen_state.

CREATE TABLE IF NOT EXISTS game_nen_progress (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  character_id      INT NOT NULL,
  nen_type          VARCHAR(50) NOT NULL, -- Ej: 'enhancement', 'specialization', etc.
  discovery_method  VARCHAR(20) DEFAULT 'random', -- 'random' | 'focused'
  ten_level         TINYINT DEFAULT 0,  -- 0 a 10
  zetsu_level       TINYINT DEFAULT 0,  -- 0 a 10
  ren_level         TINYINT DEFAULT 0,  -- 0 a 10
  hatsu_level       TINYINT DEFAULT 0,  -- 0 a 10
  total_exp         INT DEFAULT 0,
  unlocked_at       DATETIME NULL,
  
  UNIQUE KEY uq_char_nen (character_id),
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_nen_state (
  character_id    INT PRIMARY KEY,
  active_state    VARCHAR(10) DEFAULT 'none', -- 'none' | 'ten' | 'zetsu' | 'ren'
  state_since     DATETIME NULL,
  
  FOREIGN KEY (character_id) REFERENCES game_personajes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
