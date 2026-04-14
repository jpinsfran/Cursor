-- ============================================================================
-- Verificação one-shot: migrações 012 + 013 aplicadas (rodar no SQL Editor)
-- Baseline para testes outbound — ver plano "pronto para testes outbound"
-- ============================================================================

-- Colunas 013 em outbound_cadencia_sessions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'outbound_cadencia_sessions'
  AND column_name IN ('primeira_mensagem_enviada_at', 'primeira_resposta_lead_at')
ORDER BY column_name;

-- Contrato 012 em outbound_cadencia_eventos
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'outbound_cadencia_eventos'
  AND column_name IN ('message_kind', 'response_actor', 'contact_outcome')
ORDER BY column_name;

-- Views 013
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'v_outbound_melhor_horario_sp',
    'v_outbound_tempo_resposta_operacional_sp'
  )
ORDER BY table_name;

-- View 005/006 (sessão enriquecida) — deve retornar sem erro
SELECT 1 FROM v_sessao_completa LIMIT 1;
