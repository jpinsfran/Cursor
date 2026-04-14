/**
 * Code node "Claim dispatch lease" — SDR Outbound (n8n).
 * Coloque APÓS "Um lead por vez" (saída do lote) e ANTES de "Preparar touchpoint".
 * Depende de: supabase/migrations/015_outbound_dispatch_lease.sql (RPC try_claim_outbound_session).
 *
 * Saída: repete os campos da sessão + _dispatch_claimed (boolean) + _dispatch_execution_id (string).
 */

return await (async function () {
  const row = $input.first().json;
  const sessionId = row.id;
  if (!sessionId) {
    return [
      {
        json: {
          ...row,
          _dispatch_claimed: false,
          _dispatch_skip_reason: 'no_session_id',
          _dispatch_execution_id: '',
        },
      },
    ];
  }

  const cred = await this.getCredentials('supabaseApi');
  const host = String(cred.host || '').replace(/\/$/, '');
  const key = cred.serviceRole;
  const executionId =
    typeof $execution !== 'undefined' && $execution.id != null
      ? String($execution.id)
      : `no-exec-${Date.now()}`;

  let claimed = false;
  try {
    const raw = await this.helpers.httpRequest({
      method: 'POST',
      url: `${host}/rest/v1/rpc/try_claim_outbound_session`,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: {
        p_session_id: sessionId,
        p_execution_id: executionId,
        p_ttl_seconds: 240,
      },
      json: true,
    });
    if (raw === true || raw === 'true') claimed = true;
    else if (typeof raw === 'boolean') claimed = raw;
  } catch (e) {
    claimed = false;
  }

  return [
    {
      json: {
        ...row,
        _dispatch_claimed: claimed,
        _dispatch_execution_id: executionId,
        _dispatch_skip_reason: claimed ? '' : 'lease_busy_or_rpc_error',
      },
    },
  ];
}).call(this);
