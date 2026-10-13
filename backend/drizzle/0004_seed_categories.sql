-- Built-in categories (ADR-0016 / A-3.1): readable keys as ids, Spanish names,
-- no household (shared by everyone). Keys mirror CATEGORY_IDS in @icount/contracts.
INSERT INTO "categories" ("id", "household_id", "name", "icon", "kind", "is_default", "created_at") VALUES
  ('food',      NULL, 'Comida',     'cart',      'expense', true, '2026-01-01T00:00:00Z'),
  ('bills',     NULL, 'Facturas',   'bolt',      'expense', true, '2026-01-01T00:00:01Z'),
  ('housing',   NULL, 'Vivienda',   'home',      'expense', true, '2026-01-01T00:00:02Z'),
  ('transport', NULL, 'Transporte', 'car',       'expense', true, '2026-01-01T00:00:03Z'),
  ('loans',     NULL, 'Préstamos',  'bank',      'expense', true, '2026-01-01T00:00:04Z'),
  ('insurance', NULL, 'Seguros',    'shield',    'expense', true, '2026-01-01T00:00:05Z'),
  ('leisure',   NULL, 'Ocio',       'ticket',    'expense', true, '2026-01-01T00:00:06Z'),
  ('salary',    NULL, 'Nómina',     'briefcase', 'income',  true, '2026-01-01T00:00:07Z'),
  ('other',     NULL, 'Otros',      'dots',      'both',    true, '2026-01-01T00:00:08Z')
ON CONFLICT ("id") DO NOTHING;
