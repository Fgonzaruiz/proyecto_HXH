-- SEED DE REGIONES DE HUNTER X HUNTER (IDEMPOTENTE)
-- Inserta las 7 regiones principales según la Biblia del Sistema.

INSERT INTO game_regions (id, slug, name, description, tier, locked, lock_message, requires_license, min_nen_level, min_rank)
VALUES 
  (1, 'whale_island', 'Isla Ballena', 'Lugar de origen de Gon. Zona pacífica y natural.', 1, 0, NULL, 0, 0, 'D'),
  (2, 'padokea', 'República de Padokia', 'Hogar del Monte Zoldyck y la arena del Coliseo del Cielo.', 2, 0, NULL, 0, 0, 'D'),
  (3, 'yorknew', 'Ciudad de Yorknew', 'Gran metrópolis famosa por sus subastas mundiales y crimen organizado.', 3, 0, NULL, 0, 0, 'C'),
  (4, 'ngl', 'Neo Green Life (NGL)', 'Comunidad ecológica cerrada que rechaza la tecnología moderna. Peligrosa.', 4, 0, NULL, 0, 1, 'B'),
  (5, 'greed_island', 'Greed Island', 'El legendario juego real Nen en una isla secreta.', 5, 0, NULL, 0, 3, 'B'),
  (6, 'kakin', 'Imperio de Kakin', 'Nación militarista que impulsa la expedición al Continente Oscuro.', 6, 0, NULL, 0, 4, 'A'),
  (7, 'dark_continent', 'Continente Oscuro', 'Región inexplorada prohibida, hogar de calamidades.', 7, 1, 'Acceso prohibido por tratado internacional - Requiere permiso especial', 1, 6, 'S')
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  description=VALUES(description),
  tier=VALUES(tier),
  locked=VALUES(locked),
  lock_message=VALUES(lock_message),
  requires_license=VALUES(requires_license),
  min_nen_level=VALUES(min_nen_level),
  min_rank=VALUES(min_rank);
