/**
 * Nó "Filtrar vencidos" — SDR Outbound (n8n).
 * Cadência: só entra se proximo_envio_at venceu E passou intervalo mínimo (72h) desde ultima_outbound_at.
 * Reforço 1h: ramo separado (não exige gap de 72h) — Prepare decide prioridade (follow-up antes da cadência).
 *
 * Anti-disparo em massa: exige sempre ≥1h desde ultima_outbound_at antes de enfileirar qualquer envio
 * (cadência, reforço ou retomada). Sem isso, reforcoDue ficava true a cada 15min após +1h da primeira msg.
 *
 * Inbound: se ultima_inbound_at > ultima_outbound_at (e não for flag_resposta_bot), não enfileira novo/em_cadencia.
 */
const now = Date.now();
const MS_48H = 48 * 60 * 60 * 1000;
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
    if (silenceMs >= MS_48H && minSinceLastOutbound) {
      d.status = "em_cadencia";
      d.cadencia_pausada = false;
      d._retomada = true;
      out.push({ json: d });
    }
  }
}
return out;
