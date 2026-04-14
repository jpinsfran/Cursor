/**
 * Code node "Preparar touchpoint" — SDR Outbound (n8n).
 * Resolves which touchpoint to send, skips unsupported channels,
 * and outputs all session data flat for the AI Agent prompt.
 *
 * Contrato follow-up (012): reforço ~1h e follow-up D+1 9h têm prioridade sobre a cadência D3+.
 * Quebra de silêncio (016): em em_conversa, 3h sem resposta do lead → até 2 mensagens WH;
 *   após a 2ª, status em_cadencia e próximo slot da cadência (head atual).
 *
 * Cadência (anti-spam): próximo envio usa dia relativo (ORDER[].dia) a partir de dia_referencia
 * ou primeiro_contato_at em America/Sao_Paulo, não mais +1h após D1. Intervalo mínimo de 72h
 * entre envios de cadência vs ultima_outbound_at quando aplicável.
 */

/** Mínimo entre mensagens de cadência (touchpoints ORDER), alinhado ao plano omnichannel */
const MIN_MS_BETWEEN_CADENCE_OUTBOUND = 72 * 60 * 60 * 1000;

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

/** Dia 1 da cadência em calendário SP (YYYY-MM-DD de dia_referencia ou data de primeiro_contato_at). */
function getCadenceAnchorSp(item) {
  const dr = item.dia_referencia;
  if (dr != null && String(dr).trim() !== '') {
    const s = String(dr).slice(0, 10);
    const parts = s.split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
  }
  const pc = toDateSafe(item.primeiro_contato_at);
  if (pc) {
    const p = getSpDateParts(pc);
    return { year: p.year, month: p.month, day: p.day };
  }
  const p = getSpDateParts(new Date());
  return { year: p.year, month: p.month, day: p.day };
}

/** Soma dias no calendário a partir de âncora SP (usa meio-dia UTC para estabilidade). */
function addCalendarDaysFromAnchor(anchor, deltaDays) {
  const utc = Date.UTC(anchor.year, anchor.month - 1, anchor.day + deltaDays, 12, 0, 0);
  const p = getSpDateParts(new Date(utc));
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Primeiro instante permitido para o touchpoint de dia relativo N (1 = dia âncora),
 * às startHour SP (Brasil UTC-3 fixo: UTC = startHour + 3 no mesmo dia civil).
 */
function cadenceSlotIsoForDiaRelativo(anchor, diaRelativo, startHourSp) {
  const delta = Math.max(0, diaRelativo - 1);
  const t = addCalendarDaysFromAnchor(anchor, delta);
  const hourUtc = startHourSp + 3;
  return new Date(Date.UTC(t.year, t.month - 1, t.day, hourUtc, 0, 0, 0)).toISOString();
}

function maxIsoString(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return ta >= tb ? a : b;
}

/** Chave YYYY-MM-DD do instante em calendário America/Sao_Paulo (comparar mesmo dia civil). */
function calendarDateKeySp(d) {
  const p = getSpDateParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Próximo dia civil (não pula sábado/domingo), às 09:00 em America/Sao_Paulo, relativo à data civil de baseDate.
 * Usa o mesmo deslocamento UTC+3 que cadenceSlotIsoForDiaRelativo (9h SP → 12:00 UTC).
 */
function nextCalendarDayNineAMSp(baseDate) {
  const base = toDateSafe(baseDate) || new Date();
  const p = getSpDateParts(base);
  const next = addCalendarDaysFromAnchor({ year: p.year, month: p.month, day: p.day }, 1);
  const hourUtc = 9 + 3;
  return new Date(Date.UTC(next.year, next.month - 1, next.day, hourUtc, 0, 0, 0)).toISOString();
}

/**
 * Reforço 1h só depois de 1h sem resposta; follow-up D+1 9h só no dia civil seguinte ao reforço (9h SP).
 * Não retorna "aguardar D+1" nos primeiros 60 min (deixa cadência / null).
 */
function pickFollowupAction(session, now) {
  const touchList = Array.isArray(session.touchpoints_executados) ? session.touchpoints_executados : [];

  const waitingAt = toDateSafe(session.ultimo_evento_aguardando_resposta_at || session.ultima_outbound_at);
  if (!waitingAt) return null;
  const elapsedMs = now.getTime() - waitingAt.getTime();
  const oneHourMs = 60 * 60 * 1000;
  /** Reforço / follow-up D+1 só para orquestrador em novo ou em_cadencia — nunca em em_conversa. */
  const isOpenStatus = ['novo', 'em_cadencia'].includes(session.status || 'novo');
  if (!isOpenStatus || session.cadencia_pausada === true) return null;

  const lastIn = toDateSafe(session.ultima_inbound_at);
  const lastOutDt = toDateSafe(session.ultima_outbound_at);
  if (lastIn && lastOutDt && lastIn.getTime() > lastOutDt.getTime() && !session.flag_resposta_bot) {
    return null;
  }

  if (!session.reforco_1h_enviado_at && !touchList.includes('REFORCO_1H') && elapsedMs >= oneHourMs) {
    return {
      action: 'enviar_reforco_1h',
      message_kind: 'reforco_1h',
      next_check_at: nextCalendarDayNineAMSp(now),
    };
  }

  if (session.reforco_1h_enviado_at && !session.followup_d1_9h_enviado_at && !touchList.includes('FOLLOWUP_D1_9H')) {
    const refAt = toDateSafe(session.reforco_1h_enviado_at);
    const d1AtIso = nextCalendarDayNineAMSp(session.reforco_1h_enviado_at);
    const d1At = toDateSafe(d1AtIso);
    if (!d1At) return null;

    if (now < d1At) {
      return {
        action: 'aguardar_followup_d1_9h',
        message_kind: null,
        next_check_at: d1AtIso,
      };
    }

    if (refAt && calendarDateKeySp(now) === calendarDateKeySp(refAt)) {
      return {
        action: 'aguardar_followup_d1_9h',
        message_kind: null,
        next_check_at: d1AtIso,
      };
    }

    if (now >= d1At) {
      return {
        action: 'enviar_followup_d1_9h',
        message_kind: 'followup_d1_9h',
        next_check_at: null,
      };
    }
  }

  return null;
}

const item = $input.first().json;
const now = new Date();
const nowIso = now.toISOString();
const tier = item.tier || 'B';
const email = item.email || '';
const linkedin = item.linkedin_url || '';
const phone = item.phone_e164 || item.phone || '';

const sendWindowStartHour = 8;
const sendWindowEndHourExclusive = 18;
const maxCombinedDailySends = 15;
const sentTodayCombined = Number(item.disparos_enviados_hoje_combined || item.disparos_enviados_hoje || 0);
const inSendWindow = isWithinSendWindowSp(now, sendWindowStartHour, sendWindowEndHourExclusive);
const dailyCapReached = sentTodayCombined >= maxCombinedDailySends;

const followup = pickFollowupAction(item, now);

/** Follow-up D+1 9h ainda não é hora: não dispara D3 no lugar — só reagenda. */
if (followup && followup.action === 'aguardar_followup_d1_9h') {
  return [{
    json: {
      ai_context_version: 'v2_contract',
      session_id: item.id,
      touchpoint_id: item.proximo_touchpoint_id || 'D1_WA',
      canal: 'whatsapp',
      skip: true,
      skipReason: 'aguardar_followup_d1_9h',
      proximo_envio_at: followup.next_check_at,
      proximo_touchpoint_id: item.proximo_touchpoint_id,
      status_final: item.status || 'em_cadencia',
      followup_action: followup.action,
      followup_message_kind: null,
      followup_next_check_at: followup.next_check_at,
      outbound_message_kind: null,
      patch_reforco_1h_at: item.reforco_1h_enviado_at || null,
      patch_followup_d1_9h_at: item.followup_d1_9h_enviado_at || null,
      phone_e164: phone,
      throttle_applies: false,
      can_send_now: false,
      touchpoints_executados: Array.isArray(item.touchpoints_executados) ? [...item.touchpoints_executados] : [],
      d1_abertura_variacao:
        item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
          ? Number(item.d1_abertura_variacao)
          : null,
      nome_lead: item.nome_lead || '',
      nome_negocio: item.nome_negocio || '',
      regiao: item.regiao || '',
      bairro: item.bairro || '',
      cuisine: item.cuisine || '',
      rating: item.rating || '',
      perfil_do_lead: item.perfil_do_lead || '',
      rapport: item.rapport || '',
      radar_score_geral: item.radar_score_geral || '',
      ultimo_evento_aguardando_resposta_at: item.ultimo_evento_aguardando_resposta_at || item.ultima_outbound_at || null,
      patch_quebra_silencio_tentativas: Number(item.quebra_silencio_tentativas || 0),
      cadencia_pausada: item.cadencia_pausada === true,
    },
  }];
}

/** Reforço 1h ou follow-up D+1 9h — touchpoints virtuais WhatsApp (prioridade). */
if (followup && (followup.action === 'enviar_reforco_1h' || followup.action === 'enviar_followup_d1_9h')) {
  const mk = followup.message_kind;
  const tp = mk === 'reforco_1h' ? 'REFORCO_1H' : 'FOLLOWUP_D1_9H';
  let proximoAt;
  if (mk === 'reforco_1h') {
    proximoAt = followup.next_check_at || hoursFromNow(2);
  } else {
    proximoAt = hoursFromNow(48);
  }
  const touchDoneBase = Array.isArray(item.touchpoints_executados) ? [...item.touchpoints_executados] : [];

  /** Orquestrador: nenhum envio automático fora de 8–18h America/Sao_Paulo. */
  if (!inSendWindow) {
    return [{
      json: {
        ai_context_version: 'v2_contract',
        session_id: item.id,
        touchpoint_id: tp,
        canal: 'whatsapp',
        skip: true,
        skipReason: 'fora_janela_08_18_sp',
        throttle_applies: false,
        is_initial_disparo: false,
        in_send_window: inSendWindow,
        daily_cap_reached: dailyCapReached,
        can_send_now: false,
        timezone_operacional: 'America/Sao_Paulo',
        janela_envio_inicio_hora: sendWindowStartHour,
        janela_envio_fim_hora_exclusiva: sendWindowEndHourExclusive,
        sp_hora_atual: nowSpHour(now),
        disparos_enviados_hoje_combined: sentTodayCombined,
        limite_disparos_dia_combined: maxCombinedDailySends,
        followup_action: followup.action,
        followup_message_kind: mk,
        followup_next_check_at: followup.next_check_at,
        outbound_message_kind: null,
        patch_reforco_1h_at: item.reforco_1h_enviado_at || null,
        patch_followup_d1_9h_at: item.followup_d1_9h_enviado_at || null,
        phone_e164: phone,
        proximo_touchpoint_id: item.proximo_touchpoint_id,
        proximo_envio_at: nextWindowStartSp(now, sendWindowStartHour),
        status_final: item.status || 'em_cadencia',
        touchpoints_executados: touchDoneBase,
        d1_abertura_variacao:
          item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
            ? Number(item.d1_abertura_variacao)
            : null,
        nome_lead: item.nome_lead || '',
        nome_negocio: item.nome_negocio || '',
        regiao: item.regiao || '',
        bairro: item.bairro || '',
        cuisine: item.cuisine || '',
        rating: item.rating || '',
        perfil_do_lead: item.perfil_do_lead || '',
        rapport: item.rapport || '',
        radar_score_geral: item.radar_score_geral || '',
        ultimo_evento_aguardando_resposta_at: item.ultimo_evento_aguardando_resposta_at || item.ultima_outbound_at || null,
        patch_quebra_silencio_tentativas: Number(item.quebra_silencio_tentativas || 0),
        cadencia_pausada: item.cadencia_pausada === true,
      },
    }];
  }

  const touchDone = [...touchDoneBase];
  if (!touchDone.includes(tp)) touchDone.push(tp);

  return [{
    json: {
      ai_context_version: 'v2_contract',
      session_id: item.id,
      touchpoint_id: tp,
      canal: 'whatsapp',
      skip: false,
      skipReason: '',
      throttle_applies: false,
      is_initial_disparo: false,
      in_send_window: inSendWindow,
      daily_cap_reached: dailyCapReached,
      can_send_now: true,
      timezone_operacional: 'America/Sao_Paulo',
      janela_envio_inicio_hora: sendWindowStartHour,
      janela_envio_fim_hora_exclusiva: sendWindowEndHourExclusive,
      sp_hora_atual: nowSpHour(now),
      disparos_enviados_hoje_combined: sentTodayCombined,
      limite_disparos_dia_combined: maxCombinedDailySends,
      followup_action: followup.action,
      followup_message_kind: mk,
      followup_next_check_at: followup.next_check_at,
      outbound_message_kind: mk,
      patch_reforco_1h_at: mk === 'reforco_1h' ? nowIso : (item.reforco_1h_enviado_at || null),
      patch_followup_d1_9h_at: mk === 'followup_d1_9h' ? nowIso : (item.followup_d1_9h_enviado_at || null),
      ultimo_evento_aguardando_resposta_id: item.ultimo_evento_aguardando_resposta_id || null,
      ultimo_evento_aguardando_resposta_at: item.ultimo_evento_aguardando_resposta_at || item.ultima_outbound_at || null,
      ultimo_evento_aguardando_resposta_tipo: item.ultimo_evento_aguardando_resposta_tipo || null,
      reforco_1h_enviado_at: item.reforco_1h_enviado_at || null,
      followup_d1_9h_enviado_at: item.followup_d1_9h_enviado_at || null,
      phone_e164: phone,
      proximo_touchpoint_id: item.proximo_touchpoint_id,
      proximo_envio_at: proximoAt,
      status_final: 'em_cadencia',
      touchpoints_executados: touchDone,
      d1_abertura_variacao:
        item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
          ? Number(item.d1_abertura_variacao)
          : null,
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
      primeira_mensagem_enviada_at_candidate: null,
      patch_quebra_silencio_tentativas: Number(item.quebra_silencio_tentativas || 0),
      cadencia_pausada: item.cadencia_pausada === true,
      ai_context_minimo: {
        session_id: item.id,
        touchpoint_id: tp,
        canal: 'whatsapp',
        d1_abertura_variacao:
          item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
            ? Number(item.d1_abertura_variacao)
            : null,
        status_sessao: item.status || 'novo',
        followup_action: followup.action,
        ultimo_response_actor: item.ultimo_response_actor || null,
        flag_resposta_bot: Boolean(item.flag_resposta_bot),
        flag_contato_errado: Boolean(item.flag_contato_errado),
        flag_numero_inexistente: Boolean(item.flag_numero_inexistente),
      },
    },
  }];
}

/** Quebra de silêncio (em_conversa): Filtrar vencidos marca _retomada + _quebra_silencio_indice 1 ou 2. */
if (
  item.status === 'em_conversa' &&
  item._retomada &&
  (item._quebra_silencio_indice === 1 || item._quebra_silencio_indice === 2)
) {
  const idx = Number(item._quebra_silencio_indice);
  const tpQ = idx === 1 ? 'QUEBRA_SILENCIO_1' : 'QUEBRA_SILENCIO_2';
  const touchDoneQ = Array.isArray(item.touchpoints_executados) ? [...item.touchpoints_executados] : [];

  /** Orquestrador: quebra de silêncio só dentro da janela 8–18h SP. */
  if (!inSendWindow) {
    return [{
      json: {
        ai_context_version: 'v2_contract',
        session_id: item.id,
        touchpoint_id: tpQ,
        canal: 'whatsapp',
        skip: true,
        skipReason: 'fora_janela_08_18_sp',
        throttle_applies: false,
        is_initial_disparo: false,
        in_send_window: inSendWindow,
        daily_cap_reached: dailyCapReached,
        can_send_now: false,
        timezone_operacional: 'America/Sao_Paulo',
        janela_envio_inicio_hora: sendWindowStartHour,
        janela_envio_fim_hora_exclusiva: sendWindowEndHourExclusive,
        sp_hora_atual: nowSpHour(now),
        disparos_enviados_hoje_combined: sentTodayCombined,
        limite_disparos_dia_combined: maxCombinedDailySends,
        followup_action: null,
        followup_message_kind: null,
        followup_next_check_at: null,
        outbound_message_kind: null,
        patch_reforco_1h_at: item.reforco_1h_enviado_at || null,
        patch_followup_d1_9h_at: item.followup_d1_9h_enviado_at || null,
        patch_quebra_silencio_tentativas: Number(item.quebra_silencio_tentativas || 0),
        phone_e164: phone,
        proximo_touchpoint_id: item.proximo_touchpoint_id || ORDER[0].id,
        proximo_envio_at: nextWindowStartSp(now, sendWindowStartHour),
        status_final: item.status || 'em_conversa',
        touchpoints_executados: touchDoneQ,
        cadencia_pausada: item.cadencia_pausada === true,
        nome_lead: item.nome_lead || '',
        nome_negocio: item.nome_negocio || '',
        regiao: item.regiao || '',
        bairro: item.bairro || '',
        cuisine: item.cuisine || '',
        rating: item.rating || '',
        d1_abertura_variacao:
          item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
            ? Number(item.d1_abertura_variacao)
            : null,
        _retomada: item._retomada || false,
      },
    }];
  }

  if (!touchDoneQ.includes(tpQ)) touchDoneQ.push(tpQ);

  let proximoAtQ;
  let statusFinalQ;
  let proximoTpHead = item.proximo_touchpoint_id || ORDER[0].id;

  if (idx === 1) {
    proximoAtQ = hoursFromNow(3);
    statusFinalQ = 'em_conversa';
  } else {
    statusFinalQ = 'em_cadencia';
    let tpc = item.proximo_touchpoint_id || ORDER[0].id;
    let guardQ = 0;
    while (guardQ++ < 24) {
      const d0 = ORDER.find((o) => o.id === tpc) || ORDER[0];
      if (!isUnsupportedInV1(d0)) break;
      const n0 = nextSlotAfter(tpc, tier, email, linkedin);
      if (!n0) break;
      tpc = n0.id;
    }
    const dHead = ORDER.find((o) => o.id === tpc) || ORDER[0];
    const anchorQ = getCadenceAnchorSp(item);
    const diaCad = Number.isFinite(dHead.dia) ? dHead.dia : 1;
    let slotCad = cadenceSlotIsoForDiaRelativo(anchorQ, diaCad, sendWindowStartHour);
    const minPorGap = new Date(now.getTime() + MIN_MS_BETWEEN_CADENCE_OUTBOUND).toISOString();
    proximoAtQ = maxIsoString(slotCad, minPorGap);
    proximoTpHead = tpc;
  }

  return [{
    json: {
      ai_context_version: 'v2_contract',
      session_id: item.id,
      touchpoint_id: tpQ,
      canal: 'whatsapp',
      skip: false,
      skipReason: '',
      throttle_applies: false,
      is_initial_disparo: false,
      in_send_window: inSendWindow,
      daily_cap_reached: dailyCapReached,
      can_send_now: true,
      timezone_operacional: 'America/Sao_Paulo',
      janela_envio_inicio_hora: sendWindowStartHour,
      janela_envio_fim_hora_exclusiva: sendWindowEndHourExclusive,
      sp_hora_atual: nowSpHour(now),
      disparos_enviados_hoje_combined: sentTodayCombined,
      limite_disparos_dia_combined: maxCombinedDailySends,
      followup_action: null,
      followup_message_kind: null,
      followup_next_check_at: null,
      outbound_message_kind: 'quebra_silencio',
      patch_reforco_1h_at: item.reforco_1h_enviado_at || null,
      patch_followup_d1_9h_at: item.followup_d1_9h_enviado_at || null,
      patch_quebra_silencio_tentativas: idx,
      ultimo_evento_aguardando_resposta_id: item.ultimo_evento_aguardando_resposta_id || null,
      ultimo_evento_aguardando_resposta_at: item.ultimo_evento_aguardando_resposta_at || item.ultima_outbound_at || null,
      ultimo_evento_aguardando_resposta_tipo: item.ultimo_evento_aguardando_resposta_tipo || null,
      reforco_1h_enviado_at: item.reforco_1h_enviado_at || null,
      followup_d1_9h_enviado_at: item.followup_d1_9h_enviado_at || null,
      phone_e164: phone,
      proximo_touchpoint_id: proximoTpHead,
      proximo_envio_at: proximoAtQ,
      status_final: statusFinalQ,
      touchpoints_executados: touchDoneQ,
      cadencia_pausada: idx === 2 ? false : item.cadencia_pausada === true,
      d1_abertura_variacao:
        item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
          ? Number(item.d1_abertura_variacao)
          : null,
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
      _retomada: true,
      primeira_mensagem_enviada_at_candidate: null,
      ai_context_minimo: {
        session_id: item.id,
        touchpoint_id: tpQ,
        canal: 'whatsapp',
        d1_abertura_variacao:
          item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
            ? Number(item.d1_abertura_variacao)
            : null,
        status_sessao: item.status || 'novo',
        followup_action: null,
        ultimo_response_actor: item.ultimo_response_actor || null,
        flag_resposta_bot: Boolean(item.flag_resposta_bot),
        flag_contato_errado: Boolean(item.flag_contato_errado),
        flag_numero_inexistente: Boolean(item.flag_numero_inexistente),
      },
    },
  }];
}

let tp = item.proximo_touchpoint_id || ORDER[0].id;

let guard = 0;
while (guard++ < 24) {
  const def = ORDER.find((o) => o.id === tp) || ORDER[0];
  if (!isUnsupportedInV1(def)) break;
  const n = nextSlotAfter(tp, tier, email, linkedin);
  if (!n) break;
  tp = n.id;
}

const def = ORDER.find((o) => o.id === tp) || ORDER[0];
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
/** Cadência WhatsApp (D3+, etc.): mesma janela 8–18h SP que D1 inicial. */
if (!skip && def.canal === 'whatsapp' && !throttleApplies && !inSendWindow) {
  skip = true;
  skipReason = 'fora_janela_08_18_sp';
}

const next = skip ? null : nextSlotAfter(tp, tier, email, linkedin);

let proximoAt;
if (skip) {
  if (skipReason === 'fora_janela_08_18_sp') {
    proximoAt = nextWindowStartSp(now, sendWindowStartHour);
  } else if (throttleApplies) {
    proximoAt = inSendWindow ? hoursFromNow(1) : nextWindowStartSp(now, sendWindowStartHour);
  } else {
    proximoAt = hoursFromNow(1);
  }
} else if (!skip && next) {
  const nextDef = ORDER.find((o) => o.id === next.id);
  const anchor = getCadenceAnchorSp(item);
  const diaAlvo = nextDef && Number.isFinite(nextDef.dia) ? nextDef.dia : 1;
  let slotCadencia = cadenceSlotIsoForDiaRelativo(anchor, diaAlvo, sendWindowStartHour);
  const lastOut = toDateSafe(item.ultima_outbound_at);
  if (lastOut) {
    const minPorGap = new Date(lastOut.getTime() + MIN_MS_BETWEEN_CADENCE_OUTBOUND).toISOString();
    slotCadencia = maxIsoString(slotCadencia, minPorGap);
  }
  proximoAt = slotCadencia;
} else {
  proximoAt = null;
}

let statusFinal = 'em_cadencia';
if (!skip && !next && tp === 'D21_WA') statusFinal = 'encerrado_breakup';

const touchDone = Array.isArray(item.touchpoints_executados) ? [...item.touchpoints_executados] : [];
if (!skip && !touchDone.includes(tp)) touchDone.push(tp);

return [{
  json: {
    ai_context_version: 'v2_contract',
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
    outbound_message_kind: null,
    patch_reforco_1h_at: item.reforco_1h_enviado_at || null,
    patch_followup_d1_9h_at: item.followup_d1_9h_enviado_at || null,
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
    /** 1–3: variação A/B da primeira mensagem D1_WA (sessão); vem do Supabase após primeiro envio */
    d1_abertura_variacao:
      item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
        ? Number(item.d1_abertura_variacao)
        : null,
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
    patch_quebra_silencio_tentativas: Number(item.quebra_silencio_tentativas || 0),
    cadencia_pausada: item.cadencia_pausada === true,
    ai_context_minimo: {
      session_id: item.id,
      touchpoint_id: tp,
      canal: def.canal,
      d1_abertura_variacao:
        item.d1_abertura_variacao != null && item.d1_abertura_variacao !== ''
          ? Number(item.d1_abertura_variacao)
          : null,
      status_sessao: item.status || 'novo',
      followup_action: followup ? followup.action : null,
      ultimo_response_actor: item.ultimo_response_actor || null,
      flag_resposta_bot: Boolean(item.flag_resposta_bot),
      flag_contato_errado: Boolean(item.flag_contato_errado),
      flag_numero_inexistente: Boolean(item.flag_numero_inexistente),
    },
    primeira_mensagem_enviada_at_candidate: (!skip && canSendNow) ? (item.primeira_mensagem_enviada_at || item.primeiro_contato_at || nowIso) : null,
  },
}];
