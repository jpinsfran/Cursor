-- Limpeza operacional de cadência/conversa/métricas (preserva base de leads).
-- Escopo preservado: ifood_estabelecimentos, leads_qualificados, leads_perfil, cardapio, radars.
-- Execute manualmente no SQL Editor do Supabase quando quiser reiniciar operação com novos leads.

BEGIN;

-- 1) Backup lógico mínimo em tabela temporária (sessões + eventos + follow_up_tracking)
CREATE TEMP TABLE _backup_outbound_sessions AS
SELECT * FROM outbound_cadencia_sessions;

CREATE TEMP TABLE _backup_outbound_eventos AS
SELECT * FROM outbound_cadencia_eventos;

CREATE TEMP TABLE _backup_followup_tracking AS
SELECT * FROM follow_up_tracking;

CREATE TEMP TABLE _backup_outbound_copy_metrics AS
SELECT * FROM outbound_copy_metrics;

-- 2) Limpeza operacional
-- Truncar tudo em um único comando evita erro de FK entre
-- outbound_cadencia_eventos -> outbound_cadencia_sessions.
TRUNCATE TABLE
  outbound_cadencia_eventos,
  outbound_copy_metrics,
  follow_up_tracking,
  outbound_cadencia_sessions
RESTART IDENTITY;

COMMIT;

-- Validação rápida pós-limpeza:
-- SELECT 'outbound_cadencia_sessions' AS tabela, COUNT(*) AS total FROM outbound_cadencia_sessions
-- UNION ALL
-- SELECT 'outbound_cadencia_eventos', COUNT(*) FROM outbound_cadencia_eventos
-- UNION ALL
-- SELECT 'follow_up_tracking', COUNT(*) FROM follow_up_tracking
-- UNION ALL
-- SELECT 'outbound_copy_metrics', COUNT(*) FROM outbound_copy_metrics;
