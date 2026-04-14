/**
 * Code node "UAZAPI — payload falha" — após IF "Error?" (ramo TRUE = falha envio, ex. HTTP 500).
 * Entrada: saída do nó "UAZAPI — enviar texto" (item com .error em falha).
 */
const prep = $('Preparar touchpoint').first().json;
const msg = $('Gerar Msg').first().json;
const d1 = $('D1 WA variacao').first().json;
const raw = $input.first().json || {};
const err = raw.error || {};
const status = Number(
  err.statusCode ?? err.status ?? err.response?.status ?? raw.statusCode ?? NaN
);
const errMsg =
  (typeof err.message === 'string' && err.message) ||
  (typeof err.error === 'string' && err.error) ||
  '';
let body = err.response?.body ?? err.response?.data ?? err.cause;
if (body && typeof body !== 'string') {
  try {
    body = JSON.stringify(body);
  } catch (e) {
    body = String(body);
  }
}
const mensagemTexto = msg && msg.output != null ? String(msg.output) : '';

const metadata = {
  uazapi_http_status: Number.isFinite(status) ? status : null,
  uazapi_error_message: errMsg.slice(0, 4000),
  uazapi_error_body: body ? String(body).slice(0, 8000) : '',
  falha_motivo:
    status === 500 ? 'erro_provedor_ou_numero_invalido' : 'falha_http_uazapi',
};

return [
  {
    json: {
      session_id: prep.session_id,
      touchpoint_id: prep.touchpoint_id,
      canal: prep.canal,
      formato: 'texto',
      direcao: 'outbound',
      mensagem_texto: mensagemTexto,
      resultado: 'falha_envio',
      metadata,
      abertura_variacao: d1 && d1.abertura_variacao != null ? d1.abertura_variacao : null,
      proximo_envio_at_retry: (() => {
        const t = new Date();
        t.setHours(t.getHours() + 24);
        return t.toISOString();
      })(),
    },
  },
];
