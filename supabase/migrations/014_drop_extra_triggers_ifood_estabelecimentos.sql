-- 014 - Remove triggers ad-hoc em ifood_estabelecimentos que não fazem parte do schema versionado.
--
-- Sintoma: ao fazer upsert em ifood_estabelecimentos, o Postgres retorna 23514 em leads_perfil
-- com "Failing row" contendo phone NULL e sem Instagram/perfil_do_lead/punch_line.
-- Isso ocorre quando existe trigger (ex.: espelhamento automático ifood → leads_perfil) criado
-- no SQL Editor; leads_perfil deve ser preenchido só após qualificação + scrape de perfil (app).
--
-- Mantém apenas: ifood_estabelecimentos_updated_at (BEFORE UPDATE, updated_at) de 001_schema_leads.sql.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'ifood_estabelecimentos'
      AND NOT t.tgisinternal
      AND t.tgname IS DISTINCT FROM 'ifood_estabelecimentos_updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.ifood_estabelecimentos', r.tgname);
    RAISE NOTICE 'Dropped trigger % on ifood_estabelecimentos', r.tgname;
  END LOOP;
END $$;
