-- Verificação: migrations 015 (lease) e 016 (quebra de silêncio)
-- Executar no SQL Editor do projeto Supabase ligado ao n8n.

-- 015 — colunas de lease
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'outbound_cadencia_sessions'
  AND column_name IN (
    'outbound_dispatch_lease_until',
    'outbound_dispatch_lease_execution_id'
  )
ORDER BY column_name;

-- 015 — funções RPC
SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('try_claim_outbound_session', 'release_outbound_dispatch_lease')
ORDER BY p.proname;

-- 016 — quebra de silêncio
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'outbound_cadencia_sessions'
  AND column_name = 'quebra_silencio_tentativas';

SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.outbound_cadencia_sessions'::regclass
  AND tgname = 'trg_outbound_reset_quebra_silencio_on_inbound';
