/**
 * Nó "Filtrar vencidos" — SDR Outbound (n8n).
 * Cadência: só entra se proximo_envio_at venceu E passou intervalo mínimo (72h) desde ultima_outbound_at.
 * Reforço 1h: ramo separado (não exige gap de 72h) — Prepare decide prioridade (follow-up antes da cadência).
 *
 * Anti-disparo em massa: exige sempre ≥1h desde ultima_outbound_at antes de enfileirar qualquer envio
 * (cadência, reforço ou retomada). Sem isso, reforcoDue ficava true a cada 15min após +1h da primeira msg.
 *
 * Inbound: se ultima_inbound_at > ultima_outbound_at (e não for flag_resposta_bot), não enfileira novo/em_cadencia.
 *
 * em_conversa: 3h sem resposta do lead após último inbound → até 2 mensagens QUEBRA_SILENCIO (3h entre elas);
 * com 2 tentativas feitas, não enfileira mais (volta à cadência só após Prepare marcar após a 2ª).
 */
const now = Date.now();
/** Silêncio do lead (em_conversa) antes de tentar quebrar; 3h entre cada tentativa nossa. */
const MS_3H = 3 * 60 * 60 * 1000;
const MS_72H = 72 * 60 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;
const out = [];
for (const item of $input.all()) {
  const d = item.json;
  const lastOut = d.ultima_outbound_at ? new Date(d.ultima_outbound_at).getTime() : 0;
  const minSinceLastOutbound = !lastOut || now - lastOut >= MS_1H;

  const lastIn = d.ultima_inbound_at ? new Date(d.ultima_inbound_at).getTime() : 0;
  const ignoreInboundBecauseBot = d.flag_resposta_bot === true;
  /** Lead falou depois do nosso último outbound (ou há inbound sem outbound): orquestrador não deve continuar cadência/reforço. */
  const inboundAheadOfOutbound = lastIn && (!lastOut || lastIn > lastOut);

  if (["novo", "em_cadencia"].includes(d.status) && !d.cadencia_pausada) {
    if (inboundAheadOfOutbound && !ignoreInboundBecauseBot) {
      continue;
    }
    const proximoOk = d.proximo_envio_at && new Date(d.proximo_envio_at).getTime() <= now;
    const minGapCadenciaOk = !lastOut || now - lastOut >= MS_72H;

    const ref = d.ultimo_evento_aguardando_resposta_at || d.ultima_outbound_at;
    const tRef = ref ? new Date(ref).getTime() : NaN;
    const reforcoDue = !d.reforco_1h_enviado_at && Number.isFinite(tRef) && now - tRef >= MS_1H;

    if (proximoOk && minGapCadenciaOk && minSinceLastOutbound) {
      out.push({ json: d });
    } else if (reforcoDue && minSinceLastOutbound) {
      out.push({ json: d });
    }
    continue;
  }
  if (d.status === "em_conversa" && d.ultima_inbound_at) {
    const silenceMs = now - new Date(d.ultima_inbound_at).getTime();
    const tent = Number(d.quebra_silencio_tentativas || 0);
    if (tent >= 2 || !minSinceLastOutbound) {
      continue;
    }
    if (tent === 0) {
      if (silenceMs >= MS_3H) {
        d._retomada = true;
        d._quebra_silencio_indice = 1;
        out.push({ json: d });
      }
      continue;
    }
    if (tent === 1) {
      const sinceOurLast = lastOut ? now - lastOut : 0;
      const leadStillSilent = lastIn < lastOut;
      if (leadStillSilent && sinceOurLast >= MS_3H && silenceMs >= MS_3H) {
        d._retomada = true;
        d._quebra_silencio_indice = 2;
        out.push({ json: d });
      }
    }
  }
}
return out;
