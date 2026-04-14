-- Verificação rápida: migration 015 (lease de disparo outbound)
-- Executar no SQL Editor do mesmo projeto Supabase que o n8n usa.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'outbound_cadencia_sessions'
  AND column_name IN (
    'outbound_dispatch_lease_until',
    'outbound_dispatch_lease_execution_id'
  )
ORDER BY column_name;

SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('try_claim_outbound_session', 'release_outbound_dispatch_lease')
ORDER BY p.proname;
