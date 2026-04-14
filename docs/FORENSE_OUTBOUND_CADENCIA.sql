-- Forense: cadência SDR Outbound — duplicatas, intervalos e resposta do lead
-- Executar no SQL Editor do Supabase (ou psql). Ajustar :session_id ou :phone_e164.

-- 1) Sessão + estado de lease (após migration 015)
-- SELECT id, status, phone_e164, ultima_inbound_at, ultima_outbound_at,
--        proximo_envio_at, cadencia_pausada,
--        reforco_1h_enviado_at, followup_d1_9h_enviado_at,
--        touchpoints_executados,
--        ultimo_evento_aguardando_resposta_at, ultimo_evento_aguardando_resposta_tipo,
--        outbound_dispatch_lease_until, outbound_dispatch_lease_execution_id,
--        flag_resposta_bot, updated_at
-- FROM outbound_cadencia_sessions
-- WHERE id = :session_id::uuid;

-- 2) Linha do tempo de eventos (últimos 50)
-- SELECT created_at, direcao, touchpoint_id, resultado, message_kind,
--        n8n_execution_id, workflow_name,
--        LEFT(COALESCE(mensagem_texto, ''), 80) AS texto_preview
-- FROM outbound_cadencia_eventos
-- WHERE session_id = :session_id::uuid
-- ORDER BY created_at DESC
-- LIMIT 50;

-- 3) Detectar rajadas: mais de N outbound em 2h (mesma sessão)
-- SELECT session_id, COUNT(*) AS outbound_2h
-- FROM outbound_cadencia_eventos
-- WHERE direcao = 'outbound'
--   AND created_at > now() - interval '2 hours'
-- GROUP BY session_id
-- HAVING COUNT(*) > 3
-- ORDER BY outbound_2h DESC;

-- 4) Possível “inbound ignorado”: inbound mais recente que último outbound, mas status ainda novo/em_cadencia
-- SELECT id, phone_e164, status, ultima_inbound_at, ultima_outbound_at
-- FROM outbound_cadencia_sessions
-- WHERE status IN ('novo', 'em_cadencia')
--   AND cadencia_pausada IS NOT TRUE
--   AND ultima_inbound_at IS NOT NULL
--   AND (ultima_outbound_at IS NULL OR ultima_inbound_at > ultima_outbound_at)
--   AND COALESCE(flag_resposta_bot, false) IS NOT TRUE
-- ORDER BY ultima_inbound_at DESC
-- LIMIT 50;

-- 5) Resolver por telefone (E164)
-- SELECT s.id, s.status, s.ultima_inbound_at, s.ultima_outbound_at
-- FROM outbound_cadencia_sessions s
-- WHERE s.phone_e164 = :phone_e164 OR s.phone = :phone_raw
-- ORDER BY s.updated_at DESC
-- LIMIT 5;
