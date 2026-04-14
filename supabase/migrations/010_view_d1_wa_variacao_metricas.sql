-- Métricas por variação de copy D1_WA (abertura_variacao 1–3).
--
-- "pct_resposta": % de envios bem-sucedidos em que o lead teve pelo menos uma
-- mensagem inbound no MESMO DIA (calendário America/Sao_Paulo) após o horário do
-- envio D1_WA. Mede retorno do lead, não confirmação de entrega do WhatsApp.
--
-- Não é taxa de entrega/leitura do WhatsApp (isso exigiria status na UAZAPI gravado
-- em outbound_cadencia_eventos.metadata, ex.: webhook de ack).

CREATE OR REPLACE VIEW public.v_d1_wa_variacao_metricas AS
WITH vars AS (
  SELECT unnest(ARRAY[1::smallint, 2::smallint, 3::smallint]) AS abertura_variacao
),
base AS (
  SELECT
    e.id,
    e.session_id,
    e.abertura_variacao,
    e.created_at
  FROM outbound_cadencia_eventos e
  WHERE e.touchpoint_id = 'D1_WA'
    AND e.direcao = 'outbound'
    AND e.abertura_variacao IN (1, 2, 3)
    AND COALESCE(e.resultado, '') <> 'falha_envio'
),
agg AS (
  SELECT
    b.abertura_variacao,
    COUNT(*)::bigint AS enviados,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM outbound_cadencia_eventos i
        WHERE i.session_id = b.session_id
          AND i.direcao = 'inbound'
          AND i.created_at >= b.created_at
          AND (i.created_at AT TIME ZONE 'America/Sao_Paulo')::date =
              (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      )
    )::bigint AS com_resposta
  FROM base b
  GROUP BY b.abertura_variacao
)
SELECT
  v.abertura_variacao,
  COALESCE(a.enviados, 0)::bigint AS enviados,
  COALESCE(a.com_resposta, 0)::bigint AS com_resposta,
  CASE
    WHEN COALESCE(a.enviados, 0) > 0 THEN ROUND(100.0 * a.com_resposta / a.enviados, 2)
    ELSE 0::numeric
  END AS pct_resposta
FROM vars v
LEFT JOIN agg a ON a.abertura_variacao = v.abertura_variacao
ORDER BY v.abertura_variacao;

COMMENT ON VIEW public.v_d1_wa_variacao_metricas IS
  'D1_WA por abertura_variacao: enviados (sem falha_envio), com_resposta (inbound no mesmo dia após o envio), pct_resposta.';

GRANT SELECT ON public.v_d1_wa_variacao_metricas TO authenticated;
GRANT SELECT ON public.v_d1_wa_variacao_metricas TO service_role;

-- Mesma lógica com janela de tempo nos eventos D1_WA (created_at do outbound).
-- Ex.: SELECT * FROM d1_wa_variacao_metricas(now() - interval '30 days', now());

CREATE OR REPLACE FUNCTION public.d1_wa_variacao_metricas(
  p_from timestamptz DEFAULT '-infinity'::timestamptz,
  p_to timestamptz DEFAULT 'infinity'::timestamptz
)
RETURNS TABLE (
  abertura_variacao smallint,
  enviados bigint,
  com_resposta bigint,
  pct_resposta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vars AS (
    SELECT unnest(ARRAY[1::smallint, 2::smallint, 3::smallint]) AS abertura_variacao
  ),
  base AS (
    SELECT
      e.id,
      e.session_id,
      e.abertura_variacao,
      e.created_at
    FROM outbound_cadencia_eventos e
    WHERE e.touchpoint_id = 'D1_WA'
      AND e.direcao = 'outbound'
      AND e.abertura_variacao IN (1, 2, 3)
      AND COALESCE(e.resultado, '') <> 'falha_envio'
      AND e.created_at >= p_from
      AND e.created_at < p_to
  ),
  agg AS (
    SELECT
      b.abertura_variacao,
      COUNT(*)::bigint AS enviados,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM outbound_cadencia_eventos i
          WHERE i.session_id = b.session_id
            AND i.direcao = 'inbound'
            AND i.created_at >= b.created_at
            AND (i.created_at AT TIME ZONE 'America/Sao_Paulo')::date =
                (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        )
      )::bigint AS com_resposta
    FROM base b
    GROUP BY b.abertura_variacao
  )
  SELECT
    v.abertura_variacao,
    COALESCE(a.enviados, 0)::bigint AS enviados,
    COALESCE(a.com_resposta, 0)::bigint AS com_resposta,
    CASE
      WHEN COALESCE(a.enviados, 0) > 0 THEN ROUND(100.0 * a.com_resposta / a.enviados, 2)
      ELSE 0::numeric
    END AS pct_resposta
  FROM vars v
  LEFT JOIN agg a ON a.abertura_variacao = v.abertura_variacao
  ORDER BY v.abertura_variacao;
$$;

COMMENT ON FUNCTION public.d1_wa_variacao_metricas(timestamptz, timestamptz) IS
  'Métricas D1_WA por abertura_variacao em janela [p_from, p_to) sobre created_at do envio.';

GRANT EXECUTE ON FUNCTION public.d1_wa_variacao_metricas(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.d1_wa_variacao_metricas(timestamptz, timestamptz) TO service_role;
