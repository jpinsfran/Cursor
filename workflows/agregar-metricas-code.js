/**
 * Cole no nó "Agregar Métricas" (n8n Code, runOnceForAllItems).
 * Variações D1_WA: tenta RPC d1_wa_variacao_metricas (igual view SQL); fallback JS.
 */
return await (async () => {
  const outbound = $("Eventos Outbound Hoje").all();
  const inbound = $("Eventos Inbound Hoje").all();
  const agendados = $("Agendados Hoje").all();
  const periodo = $("Calcular Período").all()[0].json;

  const byCanal = {};
  for (const evt of outbound) {
    const c = evt.json.canal || "desconhecido";
    if (!byCanal[c]) byCanal[c] = { enviados: 0, respostas: 0, agendamentos: 0 };
    byCanal[c].enviados++;
  }

  const sessionsContacted = new Set(outbound.map((e) => e.json.session_id));
  const inboundToday = inbound.filter((e) => sessionsContacted.has(e.json.session_id));
  for (const evt of inboundToday) {
    const c = evt.json.canal || "whatsapp";
    if (!byCanal[c]) byCanal[c] = { enviados: 0, respostas: 0, agendamentos: 0 };
    byCanal[c].respostas++;
  }

  for (const _s of agendados) {
    const c = "whatsapp";
    if (!byCanal[c]) byCanal[c] = { enviados: 0, respostas: 0, agendamentos: 0 };
    byCanal[c].agendamentos++;
  }

  const rows = Object.entries(byCanal).map(([canal, m]) => ({
    bucket_inicio: periodo.week_start,
    bucket_fim: periodo.week_end,
    canal,
    enviados: m.enviados,
    respostas: m.respostas,
    agendamentos: m.agendamentos,
  }));

  const totalEnviados = outbound.length;
  const totalRespostas = inboundToday.length;
  const totalAgendados = agendados.length;
  const taxaResposta = totalEnviados > 0 ? ((totalRespostas / totalEnviados) * 100).toFixed(1) : "0";
  const taxaAgendamento = totalEnviados > 0 ? ((totalAgendados / totalEnviados) * 100).toFixed(1) : "0";

  const respostasBot = inboundToday.filter((e) => (e.json.response_actor || "") === "bot").length;
  const respostasHumano = inboundToday.filter((e) => (e.json.response_actor || "") === "humano").length;
  const contatosErrados = inboundToday.filter((e) => (e.json.contact_outcome || "") === "contato_errado").length;
  const numerosInexistentes = inboundToday.filter((e) => (e.json.contact_outcome || "") === "numero_inexistente").length;

  const responseMinutes = [];
  for (const i of inboundToday) {
    const sid = i.json.session_id;
    const inAt = new Date(i.json.created_at).getTime();
    if (!sid || !Number.isFinite(inAt)) continue;
    const nextOut = outbound
      .filter((o) => o.json.session_id === sid)
      .map((o) => new Date(o.json.created_at).getTime())
      .filter((t) => Number.isFinite(t) && t > inAt)
      .sort((a, b) => a - b)[0];
    if (nextOut) {
      const diffMin = (nextOut - inAt) / 60000;
      if (diffMin >= 0) responseMinutes.push(diffMin);
    }
  }
  const avgTeamResponseMinutes = responseMinutes.length
    ? (responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length).toFixed(1)
    : null;

  let variacoes_d1_wa;
  let variacoes_d1_wa_texto;

  const pFrom = periodo.today_start;
  const pTo = periodo.today_end_exclusive;
  try {
    const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
    if (base && key && pFrom && pTo) {
      const rpc = await this.helpers.httpRequest({
        method: "POST",
        url: `${base}/rest/v1/rpc/d1_wa_variacao_metricas`,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: { p_from: pFrom, p_to: pTo },
        json: true,
      });
      const parsed = Array.isArray(rpc) ? rpc : [];
      if (parsed.length) {
        variacoes_d1_wa = parsed.map((r) => ({
          abertura_variacao: r.abertura_variacao,
          enviados: Number(r.enviados),
          com_resposta: Number(r.com_resposta),
          taxa_resposta: `${Number(r.pct_resposta).toFixed(1)}%`,
        }));
        variacoes_d1_wa_texto = parsed
          .map(
            (r) =>
              `Var. ${r.abertura_variacao}: ${Number(r.pct_resposta).toFixed(1)}% (${r.com_resposta}/${r.enviados})`
          )
          .join("\n");
      }
    }
  } catch (_) {
    /* fallback abaixo */
  }

  if (!variacoes_d1_wa_texto) {
    function spDate(iso) {
      return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    }
    const inboundRows = inbound
      .map((e) => e.json)
      .filter((i) => i.direcao === "inbound" || i.direcao == null);
    function hasReplyAfterD1(d1Json) {
      const t0 = new Date(d1Json.created_at).getTime();
      const day0 = spDate(d1Json.created_at);
      return inboundRows.some(
        (i) =>
          i.session_id === d1Json.session_id &&
          new Date(i.created_at).getTime() >= t0 &&
          spDate(i.created_at) === day0
      );
    }
    const varMetric = {
      1: { enviados: 0, com_resposta: 0 },
      2: { enviados: 0, com_resposta: 0 },
      3: { enviados: 0, com_resposta: 0 },
    };
    for (const evt of outbound) {
      const j = evt.json;
      if (j.touchpoint_id !== "D1_WA") continue;
      if (j.abertura_variacao == null) continue;
      const v = Number(j.abertura_variacao);
      if (v !== 1 && v !== 2 && v !== 3) continue;
      if ((j.resultado || "") === "falha_envio") continue;
      varMetric[v].enviados++;
      if (hasReplyAfterD1(j)) varMetric[v].com_resposta++;
    }
    variacoes_d1_wa = [1, 2, 3].map((v) => {
      const m = varMetric[v];
      const pct = m.enviados > 0 ? ((m.com_resposta / m.enviados) * 100).toFixed(1) : "0";
      return {
        abertura_variacao: v,
        enviados: m.enviados,
        com_resposta: m.com_resposta,
        taxa_resposta: `${pct}%`,
      };
    });
    variacoes_d1_wa_texto = [1, 2, 3]
      .map((v) => {
        const m = varMetric[v];
        const pct = m.enviados > 0 ? ((m.com_resposta / m.enviados) * 100).toFixed(1) : "0";
        return `Var. ${v}: ${pct}% (${m.com_resposta}/${m.enviados})`;
      })
      .join("\n");
  }

  const summary = {
    data: periodo.today,
    enviados: totalEnviados,
    respostas: totalRespostas,
    agendamentos: totalAgendados,
    taxa_resposta: `${taxaResposta}%`,
    taxa_agendamento: `${taxaAgendamento}%`,
    respostas_bot: respostasBot,
    respostas_humano: respostasHumano,
    contatos_errados: contatosErrados,
    numeros_inexistentes: numerosInexistentes,
    tempo_medio_resposta_equipe_min: avgTeamResponseMinutes,
    variacoes_d1_wa,
    variacoes_d1_wa_texto,
  };

  return [{ json: { rows, summary } }];
})();
