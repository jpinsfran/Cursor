-- Auditoria operacional outbound (ultimas 24h)
-- Objetivo: identificar envios fora da janela 08:00-18:00 (America/Sao_Paulo),
-- intervalos curtos entre mensagens (< 1h) e possíveis rajadas por sessao.
--
-- Execucao: rodar no SQL Editor do Supabase do ambiente de producao.
-- Observacao: no Postgres, CTE (WITH) vale apenas para a consulta seguinte.
-- Por isso materializamos em tabela temporaria para reutilizar em multiplos SELECTs.

DROP TABLE IF EXISTS tmp_outbound_audit_24h;

CREATE TEMP TABLE tmp_outbound_audit_24h AS
WITH outbound_24h AS (
  SELECT
    e.id,
    e.session_id,
    e.created_at,
    e.workflow_name,
    e.touchpoint_id,
    e.n8n_execution_id,
    e.mensagem_texto,
    s.phone_e164,
    s.phone,
    s.status,
    s.cadencia_pausada
  FROM outbound_cadencia_eventos e
  LEFT JOIN outbound_cadencia_sessions s ON s.id = e.session_id
  WHERE e.direcao = 'outbound'
    AND e.created_at >= now() - interval '24 hours'
),
ordered AS (
  SELECT
    o.*,
    LAG(o.created_at) OVER (
      PARTITION BY COALESCE(o.session_id::text, COALESCE(o.phone_e164, o.phone, 'sem-chave'))
      ORDER BY o.created_at
    ) AS prev_created_at
  FROM outbound_24h o
), enriched AS (
  SELECT
    o.*,
    (o.created_at AT TIME ZONE 'America/Sao_Paulo') AS created_at_sp,
    EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hour_sp,
    CASE
      WHEN o.prev_created_at IS NULL THEN NULL
      ELSE ROUND(EXTRACT(EPOCH FROM (o.created_at - o.prev_created_at)) / 60.0, 2)
    END AS gap_minutes
  FROM ordered o
)
SELECT *
FROM enriched;

-- 1) Resumo executivo (24h)
SELECT
  'resumo_24h' AS bloco,
  COUNT(*)::bigint AS total_outbound,
  COUNT(*) FILTER (WHERE hour_sp < 8 OR hour_sp >= 18)::bigint AS fora_janela_08_18_sp,
  COUNT(*) FILTER (WHERE gap_minutes IS NOT NULL AND gap_minutes < 60)::bigint AS intervalos_menor_1h,
  COUNT(*) FILTER (WHERE gap_minutes IS NOT NULL AND gap_minutes < 15)::bigint AS intervalos_menor_15min
FROM tmp_outbound_audit_24h;

-- 2) Envios fora da janela operacional (detalhe)
SELECT
  'fora_janela_detalhe' AS bloco,
  created_at,
  created_at_sp,
  workflow_name,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  touchpoint_id,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 140) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE hour_sp < 8 OR hour_sp >= 18
ORDER BY created_at DESC;

-- 3) Intervalos curtos (< 1h) por sessão/telefone (detalhe)
SELECT
  'intervalo_curto_detalhe' AS bloco,
  created_at,
  created_at_sp,
  workflow_name,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  gap_minutes,
  touchpoint_id,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 140) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE gap_minutes IS NOT NULL
  AND gap_minutes < 60
ORDER BY created_at DESC;

-- 4) Top sessões com maior volume outbound em 24h
SELECT
  'top_sessoes_24h' AS bloco,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  COUNT(*)::bigint AS qtd_outbound_24h,
  MIN(created_at) AS primeiro_envio,
  MAX(created_at) AS ultimo_envio
FROM tmp_outbound_audit_24h
GROUP BY session_id, COALESCE(phone_e164, phone)
HAVING COUNT(*) >= 3
ORDER BY qtd_outbound_24h DESC, ultimo_envio DESC;

-- 5) Agrupado por workflow para achar origem de anomalias
SELECT
  'por_workflow_24h' AS bloco,
  COALESCE(workflow_name, 'sem_workflow_name') AS workflow_name,
  COUNT(*)::bigint AS total_outbound,
  COUNT(*) FILTER (WHERE hour_sp < 8 OR hour_sp >= 18)::bigint AS fora_janela,
  COUNT(*) FILTER (WHERE gap_minutes IS NOT NULL AND gap_minutes < 60)::bigint AS gap_menor_1h
FROM tmp_outbound_audit_24h
GROUP BY COALESCE(workflow_name, 'sem_workflow_name')
ORDER BY total_outbound DESC;

-- 6) Drill-down: linhas com gap < 1h (ajuste o filtro de workflow se precisar)
SELECT
  'drill_gap_menor_1h' AS bloco,
  created_at,
  created_at_sp,
  workflow_name,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  gap_minutes,
  prev_created_at,
  touchpoint_id,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 200) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE gap_minutes IS NOT NULL
  AND gap_minutes < 60
ORDER BY workflow_name, created_at DESC;

-- 7) Somente SDR Outbound (rajada / cadencia)
SELECT
  'drill_sdr_outbound' AS bloco,
  created_at,
  created_at_sp,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  gap_minutes,
  touchpoint_id,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 200) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE gap_minutes IS NOT NULL
  AND gap_minutes < 60
  AND workflow_name = 'SDR Outbound'
ORDER BY created_at DESC;

-- 8) Somente AGENTE DE OUTBOUND v2
SELECT
  'drill_agente_v2' AS bloco,
  created_at,
  created_at_sp,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  gap_minutes,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 200) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE gap_minutes IS NOT NULL
  AND gap_minutes < 60
  AND workflow_name = 'AGENTE DE OUTBOUND v2'
ORDER BY created_at DESC;

-- 9) Eventos sem workflow_name (origem a corrigir nos nos de log)
SELECT
  'drill_sem_workflow_name' AS bloco,
  created_at,
  created_at_sp,
  session_id,
  COALESCE(phone_e164, phone) AS telefone,
  gap_minutes,
  touchpoint_id,
  n8n_execution_id,
  LEFT(COALESCE(mensagem_texto, ''), 200) AS texto_preview
FROM tmp_outbound_audit_24h
WHERE gap_minutes IS NOT NULL
  AND gap_minutes < 60
  AND workflow_name IS NULL
ORDER BY created_at DESC;
