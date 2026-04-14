-- Denormaliza a variação de copy D1_WA (1–3) na sessão para o agente conversacional e integrações.
-- Fonte de evento continua em outbound_cadencia_eventos.abertura_variacao; este campo é preenchido no primeiro D1 enviado.

ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS d1_abertura_variacao SMALLINT
  CHECK (d1_abertura_variacao IS NULL OR d1_abertura_variacao BETWEEN 1 AND 3);

COMMENT ON COLUMN outbound_cadencia_sessions.d1_abertura_variacao IS
  'Variação de copy D1_WA (1–3) efetivamente enviada ao lead; imutável após primeiro D1.';

-- Backfill a partir do primeiro evento outbound D1 com abertura_variacao
UPDATE outbound_cadencia_sessions s
SET d1_abertura_variacao = sub.abertura_variacao
FROM (
  SELECT DISTINCT ON (session_id)
    session_id,
    abertura_variacao
  FROM outbound_cadencia_eventos
  WHERE touchpoint_id = 'D1_WA'
    AND direcao = 'outbound'
    AND abertura_variacao IS NOT NULL
  ORDER BY session_id, created_at ASC
) sub
WHERE s.id = sub.session_id
  AND s.d1_abertura_variacao IS NULL;
