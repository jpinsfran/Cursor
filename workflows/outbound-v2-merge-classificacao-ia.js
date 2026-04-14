/**
 * Code node "Classificar Estado" — AGENTE DE OUTBOUND v2 (n8n).
 * Entrada: saída do Basic LLM Chain + Structured Output Parser (classificação).
 * Usa $('Prep Classificar') para texto WhatsApp (agent_output) e session_id.
 * Valida enums contra CHECK do Postgres antes do Update Session.
 */
const prep = $('Prep Classificar').first().json;
const raw = $input.first().json || {};

/** Parser/chain pode devolver campos na raiz ou sob `output` */
let c = raw && typeof raw.output === 'object' && raw.output !== null ? raw.output : raw;

const ALLOW_TEMP = new Set(['quente', 'morno', 'frio']);
const ALLOW_FASE = new Set([
  'abertura',
  'radar_enviado',
  'investigacao',
  'transicao_nola',
  'agendamento',
  'pos_agendamento',
]);

function normEnum(set, v, fallback) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (set.has(s)) return s;
  return fallback;
}

function normBant(v) {
  if (v === true || v === 'true' || String(v).toLowerCase() === 'true') return 'true';
  if (v === false || v === 'false' || String(v).toLowerCase() === 'false') return 'false';
  return null;
}

const prevTemp = normEnum(ALLOW_TEMP, prep.temperatura_prev, 'morno');
const prevFase = normEnum(ALLOW_FASE, prep.conversa_fase_prev, 'abertura');

let temperatura = normEnum(ALLOW_TEMP, c.temperatura, prevTemp);
let conversa_fase = normEnum(ALLOW_FASE, c.conversa_fase, prevFase);

let bant_budget = normBant(c.bant_budget) ?? normBant(prep.bant_budget_prev);
let bant_authority = normBant(c.bant_authority) ?? normBant(prep.bant_authority_prev);
let bant_need = normBant(c.bant_need) ?? normBant(prep.bant_need_prev);
let bant_timeline = normBant(c.bant_timeline) ?? normBant(prep.bant_timeline_prev);

let motivo_perda =
  c.motivo_perda != null && String(c.motivo_perda).trim() !== ''
    ? String(c.motivo_perda).substring(0, 500)
    : null;
if (temperatura === 'frio' && !motivo_perda) {
  const lm = String(prep.lead_mensagem ?? '').trim();
  motivo_perda = lm ? lm.substring(0, 200) : null;
}

return {
  json: {
    output: prep.agent_output,
    session_id: prep.session_id,
    temperatura,
    conversa_fase,
    bant_budget,
    bant_authority,
    bant_need,
    bant_timeline,
    motivo_perda,
  },
};
