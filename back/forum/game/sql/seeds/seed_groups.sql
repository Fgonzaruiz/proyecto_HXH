-- SEED DE GRUPOS CANÓNICOS (IDEMPOTENTE)
-- Inserta la Brigada Fantasma, Familia Zoldyck y la Mafia.

INSERT INTO game_groups (id, name, slug, group_type, description, max_members, is_canon, is_active)
VALUES
  (1, 'Gen\'ei Ryodan (Brigada Fantasma)', 'phantom_troupe', 'canon', 'Grupo infame de ladrones y mercenarios, compuesto por 13 miembros con números de tatuaje de araña.', 13, 1, 1),
  (2, 'Familia Zoldyck', 'zoldyck', 'canon', 'La familia de asesinos más famosa del mundo, que opera desde su propiedad en la montaña Kukuroo.', 10, 1, 1),
  (3, 'Comunidad de la Mafia', 'mafia', 'canon', 'Sindicato criminal global que rige los negocios clandestinos en las sombras del mundo.', 50, 1, 1)
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  group_type=VALUES(group_type),
  description=VALUES(description),
  max_members=VALUES(max_members),
  is_canon=VALUES(is_canon),
  is_active=VALUES(is_active);
