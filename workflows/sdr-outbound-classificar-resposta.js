/**
 * Code node "Classificar resposta inbound" — SDR Outbound (n8n).
 * Usa sinais simples e auditáveis (sem inferência inventada) para classificar:
 * - response_actor: humano | bot | desconhecido
 * - contact_outcome: ok | contato_errado | numero_inexistente
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const item = $input.first().json;
const nowIso = new Date().toISOString();
const text = norm(item.mensagem_texto || item.text || item.body || '');
const sourceKind = norm(item.source_kind || item.origem || '');

const botHints = [
  'resposta automatica',
  'mensagem automatica',
  'auto reply',
  'autoreply',
  'sou um assistente virtual',
  'atendimento automatizado',
  'bot',
];

const wrongContactHints = [
  'nao sou o dono',
  'nao sou responsavel',
  'numero errado',
  'nao e daqui',
  'nao trabalho aqui',
  'contato errado',
];

const invalidNumberHints = [
  'numero inexistente',
  'numero nao existe',
  'destinatario inexistente',
  'nao possui whatsapp',
  'invalid wa number',
];

const isBotBySource = sourceKind === 'bot' || sourceKind === 'automation';
const isBotByText = botHints.some((h) => text.includes(h));
const isWrongContact = wrongContactHints.some((h) => text.includes(h));
const isInvalidNumber = invalidNumberHints.some((h) => text.includes(h));

let responseActor = 'humano';
if (isBotBySource || isBotByText) responseActor = 'bot';
if (!text && !isBotBySource && !isBotByText) responseActor = 'desconhecido';

let contactOutcome = 'ok';
if (isWrongContact) contactOutcome = 'contato_errado';
if (isInvalidNumber) contactOutcome = 'numero_inexistente';
const classificationReason = isInvalidNumber
  ? 'hint_numero_inexistente'
  : isWrongContact
    ? 'hint_contato_errado'
    : (isBotBySource || isBotByText)
      ? 'hint_bot'
      : 'fallback_humano';
const classificationConfidence = isInvalidNumber || isWrongContact || isBotBySource || isBotByText ? 0.9 : 0.6;

return [
  {
    json: {
      ...item,
      response_actor: responseActor,
      contact_outcome: contactOutcome,
      flag_resposta_bot: responseActor === 'bot',
      flag_contato_errado: contactOutcome === 'contato_errado',
      flag_numero_inexistente: contactOutcome === 'numero_inexistente',
      classification_reason: classificationReason,
      classification_confidence: classificationConfidence,
      message_kind: 'resposta_lead',
      primeira_resposta_lead_at_candidate: item.primeira_resposta_lead_at || item.primeira_resposta_positiva_at || nowIso,
    },
  },
];
