-- ============================================================================
-- 013 - Horários críticos (1a mensagem / 1a resposta) + métrica por hora SP
-- ============================================================================

ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS primeira_mensagem_enviada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeira_resposta_lead_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ocs_primeira_mensagem_enviada_at
  ON outbound_cadencia_sessions (primeira_mensagem_enviada_at)
  WHERE primeira_mensagem_enviada_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ocs_primeira_resposta_lead_at
  ON outbound_cadencia_sessions (primeira_resposta_lead_at)
  WHERE primeira_resposta_lead_at IS NOT NULL;

-- Backfill inicial seguro para histórico existente
UPDATE outbound_cadencia_sessions s
SET primeira_mensagem_enviada_at = COALESCE(
  s.primeira_mensagem_enviada_at,
  s.primeiro_contato_at,
  msg.first_outbound_at
)
FROM (
  SELECT session_id, MIN(created_at) AS first_outbound_at
  FROM outbound_cadencia_eventos
  WHERE direcao = 'outbound'
    AND (resultado IS NULL OR resultado <> 'falha_envio')
  GROUP BY session_id
) msg
WHERE s.id = msg.session_id
  AND s.primeira_mensagem_enviada_at IS NULL;

UPDATE outbound_cadencia_sessions s
SET primeira_resposta_lead_at = COALESCE(
  s.primeira_resposta_lead_at,
  s.primeira_resposta_positiva_at,
  rsp.first_inbound_at
)
FROM (
  SELECT session_id, MIN(created_at) AS first_inbound_at
  FROM outbound_cadencia_eventos
  WHERE direcao = 'inbound'
  GROUP BY session_id
) rsp
WHERE s.id = rsp.session_id
  AND s.primeira_resposta_lead_at IS NULL;

COMMENT ON COLUMN outbound_cadencia_sessions.primeira_mensagem_enviada_at IS
  'Timestamp do primeiro outbound real (não falha_envio) para análise de horário ótimo de disparo.';

COMMENT ON COLUMN outbound_cadencia_sessions.primeira_resposta_lead_at IS
  'Timestamp da primeira inbound do lead na sessão para análise de tempo de resposta e melhor faixa horária.';

-- ----------------------------------------------------------------------------
-- Métrica por hora (America/Sao_Paulo) para otimização de janela de envio
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_outbound_melhor_horario_sp AS
WITH outbound_base AS (
  SELECT
    e.session_id,
    e.created_at AS outbound_at,
    EXTRACT(HOUR FROM (e.created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hora_sp
  FROM outbound_cadencia_eventos e
  WHERE e.direcao = 'outbound'
    AND (e.resultado IS NULL OR e.resultado <> 'falha_envio')
),
first_inbound AS (
  SELECT
    i.session_id,
    MIN(i.created_at) AS primeira_resposta_at
  FROM outbound_cadencia_eventos i
  WHERE i.direcao = 'inbound'
  GROUP BY i.session_id
),
first_outbound_per_session AS (
  SELECT DISTINCT ON (o.session_id)
    o.session_id,
    o.outbound_at,
    o.hora_sp
  FROM outbound_base o
  ORDER BY o.session_id, o.outbound_at ASC
)
SELECT
  f.hora_sp,
  COUNT(*)::bigint AS enviados,
  COUNT(*) FILTER (
    WHERE r.primeira_resposta_at IS NOT NULL
      AND r.primeira_resposta_at >= f.outbound_at
  )::bigint AS com_resposta,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE r.primeira_resposta_at IS NOT NULL
        AND r.primeira_resposta_at >= f.outbound_at
    ) / NULLIF(COUNT(*), 0),
    2
  ) AS pct_resposta
FROM first_outbound_per_session f
LEFT JOIN first_inbound r
  ON r.session_id = f.session_id
WHERE f.hora_sp BETWEEN 8 AND 17
GROUP BY f.hora_sp
ORDER BY f.hora_sp;

-- ----------------------------------------------------------------------------
-- Tempo de resposta operacional (lead inbound -> proximo outbound da equipe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_outbound_tempo_resposta_operacional_sp AS
WITH inbound_eventos AS (
  SELECT
    i.session_id,
    i.created_at AS inbound_at
  FROM outbound_cadencia_eventos i
  WHERE i.direcao = 'inbound'
),
respostas_equipe AS (
  SELECT
    ie.session_id,
    ie.inbound_at,
    MIN(o.created_at) AS outbound_resposta_at
  FROM inbound_eventos ie
  JOIN outbound_cadencia_eventos o
    ON o.session_id = ie.session_id
   AND o.direcao = 'outbound'
   AND o.created_at > ie.inbound_at
   AND (o.resultado IS NULL OR o.resultado <> 'falha_envio')
  GROUP BY ie.session_id, ie.inbound_at
),
duracoes AS (
  SELECT
    r.session_id,
    r.inbound_at,
    r.outbound_resposta_at,
    EXTRACT(EPOCH FROM (r.outbound_resposta_at - r.inbound_at)) / 60.0 AS minutos_ate_resposta,
    EXTRACT(HOUR FROM (r.inbound_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hora_inbound_sp,
    (r.inbound_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_sp
  FROM respostas_equipe r
)
SELECT
  dia_sp,
  hora_inbound_sp,
  COUNT(*)::bigint AS total_interacoes_com_resposta,
  ROUND(AVG(minutos_ate_resposta)::numeric, 2) AS media_minutos_resposta,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutos_ate_resposta)::numeric, 2) AS mediana_minutos_resposta,
  ROUND(MIN(minutos_ate_resposta)::numeric, 2) AS min_minutos_resposta,
  ROUND(MAX(minutos_ate_resposta)::numeric, 2) AS max_minutos_resposta
FROM duracoes
GROUP BY dia_sp, hora_inbound_sp
ORDER BY dia_sp DESC, hora_inbound_sp;
