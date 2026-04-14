/**
 * Code node "Claim dispatch lease" — SDR Outbound (n8n).
 * Coloque APÓS "Um lead por vez" (saída do lote) e ANTES de "Preparar touchpoint".
 * Depende de: supabase/migrations/015_outbound_dispatch_lease.sql (RPC try_claim_outbound_session).
 *
 * Requer credencial **Supabase API** neste nó (senão getCredentials falha e claimed fica sempre false).
 *
 * Saída: repete os campos da sessão + _dispatch_claimed (boolean) + _dispatch_execution_id (string).
 */

function parseRpcBoolean(raw) {
  if (typeof raw === 'boolean') return raw;
  if (raw === true || raw === 'true') return true;
  if (Array.isArray(raw) && raw.length > 0) return parseRpcBoolean(raw[0]);
  if (raw != null && typeof raw === 'object' && 'try_claim_outbound_session' in raw) {
    return Boolean(raw.try_claim_outbound_session);
  }
  return false;
}

return await (async function () {
  const row = $input.first().json;
  const sessionId = row.id ?? row.session_id;
  if (!sessionId) {
    return [
      {
        json: {
          ...row,
          _dispatch_claimed: false,
          _dispatch_skip_reason: 'no_session_id',
          _dispatch_execution_id: '',
          _dispatch_rpc_error: '',
        },
      },
    ];
  }
  const executionId =
    typeof $execution !== 'undefined' && $execution.id != null
      ? String($execution.id)
      : `no-exec-${Date.now()}`;

  /** TTL do lease (segundos); alinhado ao plano anti-rajada (3–5 min de processamento). */
  const TTL_SECONDS = 300;

  let claimed = false;
  let rpcError = '';
  try {
    const cred = await this.getCredentials('supabaseApi');
    const host = String(cred.host || '').replace(/\/$/, '');
    const key = cred.serviceRole;
    if (!host || !key) {
      rpcError = 'credencial_supabase_incompleta_host_ou_serviceRole';
    } else {
      const raw = await this.helpers.httpRequest({
        method: 'POST',
        url: `${host}/rest/v1/rpc/try_claim_outbound_session`,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_session_id: sessionId,
          p_execution_id: executionId,
          p_ttl_seconds: TTL_SECONDS,
        }),
        json: true,
      });
      claimed = parseRpcBoolean(raw);
    }
  } catch (e) {
    claimed = false;
    rpcError = e && e.message ? String(e.message).slice(0, 500) : 'rpc_exception';
  }

  const skipReason = claimed
    ? ''
    : rpcError
      ? 'rpc_error'
      : 'lease_busy_or_rpc_returned_false';

  return [
    {
      json: {
        ...row,
        _dispatch_claimed: claimed,
        _dispatch_execution_id: executionId,
        _dispatch_skip_reason: skipReason,
        _dispatch_rpc_error: rpcError,
      },
    },
  ];
}).call(this);
