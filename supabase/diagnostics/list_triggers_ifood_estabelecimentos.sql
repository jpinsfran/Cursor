-- Diagnóstico: triggers em ifood_estabelecimentos + checagens rápidas.
-- "No rows" na consulta antiga pode ser: projeto/schema errado, tabela com outro nome,
-- ou só triggers marcados como internos (ver consulta B).

-- A) Confirma que a tabela existe neste banco (deve retornar uma linha com o oid).
SELECT
  c.oid,
  n.nspname AS schema,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'ifood_estabelecimentos'
  AND c.relkind = 'r';

-- B) Todos os triggers nesta tabela (inclui tgisinternal; FK internos podem aparecer).
SELECT
  t.tgname AS trigger_name,
  t.tgisinternal AS is_internal,
  pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'ifood_estabelecimentos'
ORDER BY t.tgisinternal, t.tgname;

-- C) Triggers em leads_perfil (por se o 23514 vier de regra em cadeia).
SELECT
  t.tgname AS trigger_name,
  t.tgisinternal AS is_internal,
  pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'leads_perfil'
ORDER BY t.tgisinternal, t.tgname;
