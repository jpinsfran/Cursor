/**
 * Code node "Preparar touchpoint" — SDR Outbound (n8n).
 * Resolves which touchpoint to send, skips unsupported channels,
 * and outputs all session data flat for the AI Agent prompt.
 */

const ORDER = [
  { id: 'D1_WA', canal: 'whatsapp', dia: 1 },
  { id: 'D3_WA', canal: 'whatsapp', dia: 3 },
  { id: 'D5_EMAIL', canal: 'email', dia: 5 },
  { id: 'D7_WA', canal: 'whatsapp', dia: 7 },
  { id: 'D8_LI', canal: 'linkedin', dia: 8 },
  { id: 'D10_WA', canal: 'whatsapp', dia: 10 },
  { id: 'D13_LIG', canal: 'ligacao', dia: 13 },
  { id: 'D14_WA', canal: 'whatsapp', dia: 14 },
  { id: 'D17_EMAIL', canal: 'email', dia: 17 },
  { id: 'D19_WA', canal: 'whatsapp', dia: 19 },
  { id: 'D21_WA', canal: 'whatsapp', dia: 21 },
];

function nextSlotAfter(tpId, tier, email, linkedin) {
  const idx = ORDER.findIndex((o) => o.id === tpId);
  let i = idx + 1;
  while (i < ORDER.length) {
    const n = ORDER[i];
    if (n.canal === 'email' && !email) { i++; continue; }
    if (n.canal === 'linkedin' && !linkedin) { i++; continue; }
    if (n.id === 'D13_LIG' && tier !== 'A') { i++; continue; }
    return n;
  }
  return null;
}

function isUnsupportedInV1(def) {
  return def.canal === 'email' || def.canal === 'linkedin' || def.canal === 'ligacao';
}

function hoursFromNow(h) {
  const t = new Date();
  t.setHours(t.getHours() + h);
  return t.toISOString();
}

function getSpDateParts(refDate) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(refDate);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

function nowSpHour(refDate) {
  return getSpDateParts(refDate).hour;
}

function isWithinSendWindowSp(refDate, startHour, endHourExclusive) {
  const h = nowSpHour(refDate);
  return h >= startHour && h < endHourExclusive;
}

function nextWindowStartSp(refDate, startHour) {
  const p = getSpDateParts(refDate);
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour + 3, p.minute, p.second));
  const h = p.hour;
  if (h >= startHour) {
    utc.setUTCDate(utc.getUTCDate() + 1);
  }
  utc.setUTCHours(startHour + 3, 0, 0, 0);
  return utc.toISOString();
}

function toDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nextBusinessDayNineAMSp(baseDate) {
  const source = toDateSafe(baseDate) || new Date();
  const sourceSp = new Date(source.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = sourceSp.getDay();
  const addDays = day === 5 ? 3 : day === 6 ? 2 : 1;
  sourceSp.setDate(sourceSp.getDate() + addDays);
  sourceSp.setHours(9, 0, 0, 0);
  const utcIso = new Date(sourceSp.toLocaleString('en-US', { timeZone: 'UTC' })).toISOString();
  return utcIso;
}

function pickFollowupAction(session, now) {
  const waitingAt = toDateSafe(session.ultimo_evento_aguardando_resposta_at || session.ultima_outbound_at);
  if (!waitingAt) return null;
  const elapsedMs = now.getTime() - waitingAt.getTime();
  const oneHourMs = 60 * 60 * 1000;
  const isOpenStatus = ['novo', 'em_cadencia', 'em_conversa'].includes(session.status || 'novo');
  if (!isOpenStatus || session.cadencia_pausada === true) return null;

  if (!session.reforco_1h_enviado_at && elapsedMs >= oneHourMs) {
    return {
      action: 'enviar_reforco_1h',
      message_kind: 'reforco_1h',
      next_check_at: nextBusinessDayNineAMSp(waitingAt.toISOString()),
    };
  }

  if (!session.followup_d1_9h_enviado_at) {
    const d1At = toDateSafe(nextBusinessDayNineAMSp(waitingAt.toISOString()));
    if (d1At && now >= d1At) {
      return {
        action: 'enviar_followup_d1_9h',
        message_kind: 'followup_d1_9h',
        next_check_at: null,
      };
    }
    return {
      action: 'aguardar_followup_d1_9h',
      message_kind: null,
      next_check_at: d1At ? d1At.toISOString() : null,
    };
  }

  return null;
}

const item = $input.first().json;
const now = new Date();
const nowIso = now.toISOString();
let tp = item.proximo_touchpoint_id || ORDER[0].id;
const tier = item.tier || 'B';
const email = item.email || '';
const linkedin = item.linkedin_url || '';
const phone = item.phone_e164 || item.phone || '';

let guard = 0;
while (guard++ < 24) {
  const def = ORDER.find((o) => o.id === tp) || ORDER[0];
  if (!isUnsupportedInV1(def)) break;
  const n = nextSlotAfter(tp, tier, email, linkedin);
  if (!n) break;
  tp = n.id;
}

const def = ORDER.find((o) => o.id === tp) || ORDER[0];
const followup = pickFollowupAction(item, now);
const sendWindowStartHour = 8;
const sendWindowEndHourExclusive = 18;
const maxCombinedDailySends = 15;
const sentTodayCombined = Number(item.disparos_enviados_hoje_combined || item.disparos_enviados_hoje || 0);
const inSendWindow = isWithinSendWindowSp(now, sendWindowStartHour, sendWindowEndHourExclusive);
const dailyCapReached = sentTodayCombined >= maxCombinedDailySends;
const touchDoneCount = Array.isArray(item.touchpoints_executados) ? item.touchpoints_executados.length : 0;
const isInitialDisparo = touchDoneCount === 0 && !item.ultimo_touchpoint_id && tp === 'D1_WA';
const throttleApplies = isInitialDisparo;
const canSendNow = throttleApplies ? (inSendWindow && !dailyCapReached) : true;

let skip = false;
let skipReason = '';
if (def.canal === 'email' && !email) { skip = true; skipReason = 'sem_email'; }
if (def.canal === 'linkedin' && !linkedin) { skip = true; skipReason = 'sem_linkedin'; }
if (def.id === 'D13_LIG' && tier !== 'A') { skip = true; skipReason = 'tier_nao_A'; }
if (def.canal === 'ligacao') { skip = true; skipReason = 'ligacao_manual'; }
if (throttleApplies && !inSendWindow) { skip = true; skipReason = 'fora_janela_08_18_sp'; }
if (throttleApplies && dailyCapReached) { skip = true; skipReason = 'limite_15_disparos_dia_atingido'; }

const next = skip ? null : nextSlotAfter(tp, tier, email, linkedin);
const proximoAt = skip
  ? (
    throttleApplies
      ? (inSendWindow ? hoursFromNow(1) : nextWindowStartSp(now, sendWindowStartHour))
      : hoursFromNow(1)
  )
  : (next ? hoursFromNow(48) : null);

let statusFinal = 'em_cadencia';
if (!skip && !next && tp === 'D21_WA') statusFinal = 'encerrado_breakup';

const touchDone = Array.isArray(item.touchpoints_executados) ? [...item.touchpoints_executados] : [];
if (!skip && !touchDone.includes(tp)) touchDone.push(tp);

return [{
  json: {
    session_id: item.id,
    touchpoint_id: tp,
    timezone_operacional: 'America/Sao_Paulo',
    janela_envio_inicio_hora: sendWindowStartHour,
    janela_envio_fim_hora_exclusiva: sendWindowEndHourExclusive,
    sp_hora_atual: nowSpHour(now),
    disparos_enviados_hoje_combined: sentTodayCombined,
    limite_disparos_dia_combined: maxCombinedDailySends,
    throttle_applies: throttleApplies,
    is_initial_disparo: isInitialDisparo,
    in_send_window: inSendWindow,
    daily_cap_reached: dailyCapReached,
    can_send_now: canSendNow,
    followup_action: followup ? followup.action : null,
    followup_message_kind: followup ? followup.message_kind : null,
    followup_next_check_at: followup ? followup.next_check_at : null,
    ultimo_evento_aguardando_resposta_id: item.ultimo_evento_aguardando_resposta_id || null,
    ultimo_evento_aguardando_resposta_at: item.ultimo_evento_aguardando_resposta_at || item.ultima_outbound_at || null,
    ultimo_evento_aguardando_resposta_tipo: item.ultimo_evento_aguardando_resposta_tipo || null,
    reforco_1h_enviado_at: item.reforco_1h_enviado_at || null,
    followup_d1_9h_enviado_at: item.followup_d1_9h_enviado_at || null,
    canal: def.canal,
    skip,
    skipReason,
    phone_e164: phone,
    proximo_touchpoint_id: next ? next.id : null,
    proximo_envio_at: proximoAt,
    status_final: statusFinal,
    touchpoints_executados: touchDone,
    nome_lead: item.nome_lead || '',
    nome_negocio: item.nome_negocio || '',
    regiao: item.regiao || '',
    bairro: item.bairro || '',
    cuisine: item.cuisine || '',
    price_range: item.price_range || '',
    rating: item.rating || '',
    cnpj: item.cnpj || '',
    email: item.email || '',
    perfil_do_lead: item.perfil_do_lead || '',
    rapport: item.rapport || '',
    seguidores: item.seguidores || '',
    instagram_profile_url: item.instagram_profile_url || '',
    ifood_url: item.ifood_url || '',
    classificacao: item.classificacao || '',
    radar_url: item.radar_url || '',
    radar_score_geral: item.radar_score_geral || '',
    radar_score_reputacao: item.radar_score_reputacao || '',
    radar_score_digital: item.radar_score_digital || '',
    radar_score_competitivo: item.radar_score_competitivo || '',
    radar_score_financeiro: item.radar_score_financeiro || '',
    radar_oportunidade_min: item.radar_oportunidade_min || '',
    radar_oportunidade_max: item.radar_oportunidade_max || '',
    hubspot_contact_id: item.hubspot_contact_id || '',
    hubspot_deal_id: item.hubspot_deal_id || '',
    _retomada: item._retomada || false,
    primeira_mensagem_enviada_at_candidate: (!skip && canSendNow) ? (item.primeira_mensagem_enviada_at || item.primeiro_contato_at || nowIso) : null,
  },
}];