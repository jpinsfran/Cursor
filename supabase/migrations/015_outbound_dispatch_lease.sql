-- ============================================================================
-- 015 — Lease de disparo outbound (single-flight entre execuções n8n paralelas)
-- ============================================================================

ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS outbound_dispatch_lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outbound_dispatch_lease_execution_id TEXT;

COMMENT ON COLUMN outbound_cadencia_sessions.outbound_dispatch_lease_until IS
  'Até quando esta sessão está reservada para um envio pelo orquestrador SDR Outbound (evita duplicata).';
COMMENT ON COLUMN outbound_cadencia_sessions.outbound_dispatch_lease_execution_id IS
  'Identificador da execução n8n que detém o lease (liberar com release_outbound_dispatch_lease).';

CREATE OR REPLACE FUNCTION try_claim_outbound_session(
  p_session_id uuid,
  p_execution_id text,
  p_ttl_seconds int DEFAULT 180
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  ttl int;
BEGIN
  ttl := COALESCE(p_ttl_seconds, 180);
  IF ttl < 30 THEN ttl := 30; END IF;
  IF ttl > 900 THEN ttl := 900; END IF;

  UPDATE outbound_cadencia_sessions s
  SET
    outbound_dispatch_lease_until = now() + make_interval(secs => ttl),
    outbound_dispatch_lease_execution_id = COALESCE(NULLIF(TRIM(p_execution_id), ''), 'unknown'),
    updated_at = now()
  WHERE s.id = p_session_id
    AND (s.outbound_dispatch_lease_until IS NULL OR s.outbound_dispatch_lease_until < now());

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

COMMENT ON FUNCTION try_claim_outbound_session(uuid, text, int) IS
  'Reserva a sessão para um disparo; retorna true se esta execução obteve o lease.';

CREATE OR REPLACE FUNCTION release_outbound_dispatch_lease(
  p_session_id uuid,
  p_execution_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  e text;
BEGIN
  e := NULLIF(TRIM(COALESCE(p_execution_id, '')), '');
  IF e IS NULL THEN
    RETURN false;
  END IF;

  UPDATE outbound_cadencia_sessions s
  SET
    outbound_dispatch_lease_until = NULL,
    outbound_dispatch_lease_execution_id = NULL,
    updated_at = now()
  WHERE s.id = p_session_id
    AND s.outbound_dispatch_lease_execution_id IS NOT DISTINCT FROM e;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

COMMENT ON FUNCTION release_outbound_dispatch_lease(uuid, text) IS
  'Libera o lease somente se o execution_id coincidir com o titular atual.';

GRANT EXECUTE ON FUNCTION try_claim_outbound_session(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION release_outbound_dispatch_lease(uuid, text) TO service_role;
