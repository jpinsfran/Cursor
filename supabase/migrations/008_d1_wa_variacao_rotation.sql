-- Rotação de variações D1_WA (1–3) para A/B de abertura no SDR Outbound.
-- Aplicação: n8n chama POST /rest/v1/rpc/next_d1_wa_variacao com body {}

CREATE SEQUENCE IF NOT EXISTS outbound_d1_wa_var_seq;

CREATE OR REPLACE FUNCTION public.next_d1_wa_variacao()
RETURNS smallint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (1 + (nextval('outbound_d1_wa_var_seq') - 1) % 3)::smallint;
$$;

COMMENT ON FUNCTION public.next_d1_wa_variacao() IS
  'Próxima variação de copy D1_WA (1, 2 ou 3) em ordem global.';

GRANT EXECUTE ON FUNCTION public.next_d1_wa_variacao() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_d1_wa_variacao() TO authenticated;

-- Alinha a sequência ao histórico já enviado (próximo envio continua a rotação).
SELECT setval(
  'outbound_d1_wa_var_seq',
  COALESCE(
    (SELECT COUNT(*)::bigint
     FROM outbound_cadencia_eventos
     WHERE touchpoint_id = 'D1_WA'
       AND direcao = 'outbound'),
    0
  ) + 1,
  true
);

ALTER TABLE outbound_cadencia_eventos
  ADD COLUMN IF NOT EXISTS abertura_variacao SMALLINT
  CHECK (abertura_variacao IS NULL OR abertura_variacao BETWEEN 1 AND 3);

COMMENT ON COLUMN outbound_cadencia_eventos.abertura_variacao IS
  'Variação de copy D1_WA (1–3). NULL se não for abertura WhatsApp.';

CREATE INDEX IF NOT EXISTS idx_oce_d1_var_out
  ON outbound_cadencia_eventos (touchpoint_id, abertura_variacao, created_at DESC)
  WHERE touchpoint_id = 'D1_WA' AND direcao = 'outbound';
