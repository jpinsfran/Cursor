/**
 * Análise profunda: contactados vs resposta, modelos de 1ª abertura (texto/tags),
 * touchpoint na 1ª resposta, pós-Radar.
 *
 * Uso:
 *   node scripts/analyzeConversasDeep.js [--html out.html] [--json out.json] [--sessoes path/sessoes.csv] [--quiet] [conversas_threads.json]
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csvtojson";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const RADAR_REGEX = /\bradar\b/i;

function parseArgs(argv) {
  let jsonPath = null;
  let htmlOut = null;
  let jsonOut = null;
  let sessoesPath = null;
  let quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--html") {
      htmlOut = argv[++i] || null;
      continue;
    }
    if (a === "--json") {
      jsonOut = argv[++i] || null;
      continue;
    }
    if (a === "--sessoes") {
      sessoesPath = argv[++i] || null;
      continue;
    }
    if (a === "--quiet") {
      quiet = true;
      continue;
    }
    if (a.startsWith("-")) continue;
    if (!jsonPath) jsonPath = a;
  }
  return {
    jsonPath: jsonPath
      ? path.isAbsolute(jsonPath)
        ? jsonPath
        : path.join(process.cwd(), jsonPath)
      : path.join(repoRoot, "conversas", "conversas_threads.json"),
    htmlOut: htmlOut
      ? path.isAbsolute(htmlOut)
        ? htmlOut
        : path.join(process.cwd(), htmlOut)
      : null,
    jsonOut: jsonOut
      ? path.isAbsolute(jsonOut)
        ? jsonOut
        : path.join(process.cwd(), jsonOut)
      : null,
    sessoesPath: sessoesPath
      ? path.isAbsolute(sessoesPath)
        ? sessoesPath
        : path.join(process.cwd(), sessoesPath)
      : null,
    quiet,
  };
}

function isLeadEntry(m) {
  return (m.touchpoint_id || "") === "LEAD_ENTRY" || (m.canal || "") === "system";
}

/** Outbound “real” (não é só entrada de lead na base). */
function isRealOutbound(m) {
  return m.direcao === "outbound" && !isLeadEntry(m);
}

/** Entrega válida para contar como “recebeu mensagem”. */
function outboundEntregue(m) {
  if (!isRealOutbound(m)) return false;
  const r = (m.resultado || "").trim();
  if (r === "falha_envio") return false;
  return true;
}

function mentionsRadar(m) {
  return RADAR_REGEX.test(String(m.mensagem_texto || ""));
}

/** Decodifica entidades HTML comuns no export (nomes de negócio, apóstrofos). */
function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Chave estável para comparar textos: minúsculas, sem acento, números → placeholder.
 */
function normalizeModelKey(text) {
  let t = decodeHtmlEntities(text);
  t = stripAccents(t.toLowerCase());
  t = t.replace(/\d+[.,]?\d*/g, "#");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Anonimiza trechos típicos de personalização (região, nome do negócio antes de “chamou”)
 * para agrupar o mesmo modelo com nomes diferentes.
 */
function loosenTemplateKey(normalizedLower) {
  let t = normalizedLower;
  /** Primeiro: região antes de “e o/a …”, senão após substituir a loja o lookahead quebra. */
  t = t.replace(
    /\b(no|na|em)\s+[^.?!]{4,55}?\s+(?=e\s+[oa]\s)/gi,
    "$1 §regiao§ "
  );
  t = t.replace(
    /\be\s+[oa]\s+[^.?!]{2,130}?\s+cham(ou|aram)\b/giu,
    "e §loja§ chamou"
  );
  /** “seu X chamou”, “a padaria X chamou” (quando não pegou o caso acima). */
  t = t.replace(
    /\b(seu|sua)\s+[^.?!]{2,100}?\s+cham(ou|aram)\b/giu,
    "$1 §negocio§ chamou"
  );
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Tags heurísticas derivadas só do texto (para comparar tendências quando n por cópia é baixo).
 */
function detectOpeningTags(text) {
  const raw = String(text || "");
  const t = stripAccents(raw.toLowerCase());
  const tags = [];
  const add = (id) => {
    if (!tags.includes(id)) tags.push(id);
  };
  if (/\brecorte\b|\bestudo\s+exclusiv|\bmaterial\s+gratuit|\binsights\b/i.test(t)) {
    add("recorte_estudo_material_gratuito");
  }
  if (/\b(rating|score|pontua)/i.test(t)) {
    add("menciona_metrica_rating_ou_score");
  }
  if (
    /falo com|falando com|representante|quem decide|com algu[eé]m do/i.test(t)
  ) {
    add("pergunta_interlocutor_ou_quem_decide");
  }
  if (/posso (te )?enviar|compartilhar|mandar (pra|para)|quer (receber|que eu)/i.test(t)) {
    add("cta_enviar_ou_compartilhar");
  }
  if (/\bnola\b|\bdante\b|analista do nola|aqui [eé] do nola/i.test(t)) {
    add("assinatura_nola_ou_remetente");
  }
  if (/^(oi,?\s*)?(só |insistindo|tudo certo\?\s*o estudo)/i.test(t.trim())) {
    add("follow_up_ou_reforco_nao_primeiro_toque");
  }
  return tags;
}

function truncatePreview(s, max = 240) {
  const x = String(s || "").replace(/\s+/g, " ").trim();
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1)}…`;
}

/** Primeiro outbound real com entrega válida (mensagem de abertura efetiva). */
function firstDeliveredOpening(msgs) {
  for (const m of msgs) {
    if (outboundEntregue(m)) return m;
  }
  return null;
}

function analyzeSession(s, sessaoRow) {
  const msgs = [...(s.mensagens || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const realOutAll = msgs.filter(isRealOutbound);
  const delivered = realOutAll.filter(outboundEntregue);
  const failedOnly =
    realOutAll.length > 0 &&
    delivered.length === 0 &&
    realOutAll.every((m) => (m.resultado || "").trim() === "falha_envio");

  const contacted = delivered.length > 0;

  let firstInboundIdx = -1;
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].direcao === "inbound") {
      firstInboundIdx = i;
      break;
    }
  }

  let touchpointPrimeiraResposta = null;
  let lastOutboundBeforeFirstIn = null;
  if (firstInboundIdx > 0) {
    for (let j = firstInboundIdx - 1; j >= 0; j--) {
      if (msgs[j].direcao === "outbound" && !isLeadEntry(msgs[j])) {
        lastOutboundBeforeFirstIn = msgs[j];
        touchpointPrimeiraResposta =
          msgs[j].touchpoint_id || "(sem_tp)";
        break;
      }
    }
    if (!lastOutboundBeforeFirstIn) {
      for (let j = firstInboundIdx - 1; j >= 0; j--) {
        if (msgs[j].direcao === "outbound") {
          lastOutboundBeforeFirstIn = msgs[j];
          touchpointPrimeiraResposta = isLeadEntry(msgs[j])
            ? "(inbound_sem_outbound_cadencia_antes)"
            : msgs[j].touchpoint_id || "(sem_tp)";
          break;
        }
      }
    }
  }

  /** Latência: primeiro inbound menos o último outbound de cadência imediatamente antes (não LEAD_ENTRY). */
  let msAtePrimeiraResposta = null;
  if (firstInboundIdx >= 0 && lastOutboundBeforeFirstIn && !isLeadEntry(lastOutboundBeforeFirstIn)) {
    const t0 = new Date(lastOutboundBeforeFirstIn.created_at).getTime();
    const t1 = new Date(msgs[firstInboundIdx].created_at).getTime();
    msAtePrimeiraResposta = t1 - t0;
  }

  let radarOutboundIdx = -1;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (isRealOutbound(m) && mentionsRadar(m)) {
      radarOutboundIdx = i;
      break;
    }
  }

  let inboundAntesRadar = false;
  if (radarOutboundIdx >= 0) {
    for (let i = 0; i < radarOutboundIdx; i++) {
      if (msgs[i].direcao === "inbound") {
        inboundAntesRadar = true;
        break;
      }
    }
  }

  let posRadar = null;
  if (radarOutboundIdx >= 0) {
    const after = msgs.slice(radarOutboundIdx + 1);
    const inAfter = after.filter((m) => m.direcao === "inbound").length;
    const outAfter = after.filter((m) => m.direcao === "outbound").length;
    const last = msgs[msgs.length - 1] || null;
    let parada = "thread_vazia";
    if (last) {
      if (last.direcao === "outbound") {
        parada = "ultimo_evento_outbound_lead_nao_respondeu_apos";
      } else {
        parada = "ultimo_evento_inbound_aguardando_agente_ou_fim";
      }
    }
    posRadar = {
      primeiro_radar_em: msgs[radarOutboundIdx].created_at,
      mensagens_apos_radar: after.length,
      inbound_apos_radar: inAfter,
      outbound_apos_radar: outAfter,
      ultimo_evento_direcao: last ? last.direcao : null,
      classificacao_parada_snapshot: parada,
    };
  }

  const radarUrlNaBase = Boolean(
    sessaoRow &&
      String(sessaoRow.radar_url || "").trim() !== ""
  );

  const openingMsg = firstDeliveredOpening(msgs);
  let abertura_primeira_entrega = null;
  if (openingMsg) {
    const texto = String(openingMsg.mensagem_texto || "");
    const nk = normalizeModelKey(texto);
    const lk = loosenTemplateKey(nk);
    abertura_primeira_entrega = {
      touchpoint_id: openingMsg.touchpoint_id || "(sem_tp)",
      texto_preview: truncatePreview(texto),
      modelo_chave_normalizado: nk,
      modelo_chave_agrupamento: lk,
      tags_detectadas: detectOpeningTags(texto),
    };
  }

  return {
    session_id: s.session_id,
    nome_negocio: s.nome_negocio || null,
    contacted,
    failed_without_delivery: failedOnly,
    responded: firstInboundIdx >= 0,
    touchpoint_primeira_resposta: touchpointPrimeiraResposta,
    ms_ate_primeira_resposta: msAtePrimeiraResposta,
    radar_mencionado_em_outbound: radarOutboundIdx >= 0,
    inbound_antes_de_mencionar_radar: inboundAntesRadar,
    pos_radar: posRadar,
    radar_url_na_base: sessaoRow ? radarUrlNaBase : null,
    conversa_fase_sessao: sessaoRow ? sessaoRow.conversa_fase || null : null,
    abertura_primeira_entrega: abertura_primeira_entrega,
  };
}

function pctRound(num, den) {
  return den > 0 ? Math.round((1000 * num) / den) / 10 : 0;
}

function aggregateOpeningModels(contactedList, taxaCohortPct) {
  const byGroup = new Map();
  const byTag = new Map();
  let semTag = { contactados: 0, responderam: 0 };

  for (const p of contactedList) {
    const a = p.abertura_primeira_entrega;
    if (!a) continue;

    if (!byGroup.has(a.modelo_chave_agrupamento)) {
      byGroup.set(a.modelo_chave_agrupamento, {
        contactados: 0,
        responderam: 0,
        exemplos: [],
      });
    }
    const row = byGroup.get(a.modelo_chave_agrupamento);
    row.contactados += 1;
    if (p.responded) row.responderam += 1;
    if (
      row.exemplos.length < 3 &&
      !row.exemplos.includes(a.texto_preview)
    ) {
      row.exemplos.push(a.texto_preview);
    }

    if (a.tags_detectadas.length === 0) {
      semTag.contactados += 1;
      if (p.responded) semTag.responderam += 1;
    }
    for (const tag of a.tags_detectadas) {
      if (!byTag.has(tag)) {
        byTag.set(tag, { contactados: 0, responderam: 0 });
      }
      const t = byTag.get(tag);
      t.contactados += 1;
      if (p.responded) t.responderam += 1;
    }
  }

  const rankingGrupos = [...byGroup.entries()]
    .map(([modelo_chave_agrupamento, v]) => ({
      modelo_chave_agrupamento,
      contactados: v.contactados,
      responderam: v.responderam,
      taxa_resposta_pct: pctRound(v.responderam, v.contactados),
      exemplos_reais_mensagem: v.exemplos,
    }))
    .sort((a, b) => {
      if (b.contactados !== a.contactados) return b.contactados - a.contactados;
      return b.taxa_resposta_pct - a.taxa_resposta_pct;
    });

  const rankingTags = [...byTag.entries()]
    .map(([tag, v]) => {
      const taxa = pctRound(v.responderam, v.contactados);
      return {
        tag,
        contactados: v.contactados,
        responderam: v.responderam,
        taxa_resposta_pct: taxa,
        diff_pp_vs_taxa_cohort:
          Math.round((taxa - taxaCohortPct) * 10) / 10,
      };
    })
    .sort((a, b) => b.contactados - a.contactados);

  const nMin = 3;
  const melhoresComVolume = [...rankingGrupos]
    .filter((g) => g.contactados >= nMin)
    .sort((a, b) => {
      if (b.taxa_resposta_pct !== a.taxa_resposta_pct) {
        return b.taxa_resposta_pct - a.taxa_resposta_pct;
      }
      return b.contactados - a.contactados;
    })
    .slice(0, 12);

  return {
    taxa_resposta_cohort_contactados_pct: taxaCohortPct,
    definicao:
      "1ª mensagem = primeiro outbound real com entrega válida (não falha_envio), ordem cronológica.",
    nota_interpretacao:
      "Grupos usam texto anonimizado (números, trechos típicos de loja/região). Taxa = responderam / contactados naquele grupo. n baixo: interpretação frágil; compare também ranking por tags. diff_pp_vs_taxa_cohort = taxa da tag − taxa global dos contactados (não é causalidade).",
    amostra_sem_tag_heuristica: {
      contactados: semTag.contactados,
      responderam: semTag.responderam,
      taxa_resposta_pct: pctRound(semTag.responderam, semTag.contactados),
    },
    ranking_por_grupo_texto: rankingGrupos,
    melhores_grupos_taxa_com_n_minimo: melhoresComVolume,
    n_minimo_usado: nMin,
    ranking_por_tags: rankingTags,
  };
}

function aggregate(perSession) {
  const contacted = perSession.filter((p) => p.contacted);
  const respondedAmongContacted = contacted.filter((p) => p.responded);

  const tpCounts = {};
  for (const p of respondedAmongContacted) {
    const tp = p.touchpoint_primeira_resposta || "(sem_tp)";
    tpCounts[tp] = (tpCounts[tp] || 0) + 1;
  }

  const tpPct = {};
  const nResp = respondedAmongContacted.length;
  for (const [tp, c] of Object.entries(tpCounts)) {
    tpPct[tp] =
      nResp > 0 ? Math.round((1000 * c) / nResp) / 10 : 0;
  }

  const comRadarTexto = perSession.filter((p) => p.radar_mencionado_em_outbound);
  const paradaCounts = {};
  for (const p of comRadarTexto) {
    if (!p.pos_radar) continue;
    const k = p.pos_radar.classificacao_parada_snapshot;
    paradaCounts[k] = (paradaCounts[k] || 0) + 1;
  }

  let cruzamentoRadarBase = null;
  const withBase = perSession.filter((p) => p.radar_url_na_base !== null);
  if (withBase.length) {
    const a = withBase.filter((p) => p.radar_url_na_base && p.radar_mencionado_em_outbound).length;
    const b = withBase.filter((p) => p.radar_url_na_base && !p.radar_mencionado_em_outbound).length;
    const c = withBase.filter((p) => !p.radar_url_na_base && p.radar_mencionado_em_outbound).length;
    const d = withBase.filter((p) => !p.radar_url_na_base && !p.radar_mencionado_em_outbound).length;
    cruzamentoRadarBase = {
      radar_url_preenchido_e_mencionou_no_texto: a,
      radar_url_preenchido_nao_mencionou: b,
      sem_url_mas_mencionou_radar: c,
      sem_url_nao_mencionou: d,
      nota:
        "radar_url vem do CSV sessoes; mencionou = regex na mensagem outbound.",
    };
  }

  const inboundAntesRadarCount = comRadarTexto.filter(
    (p) => p.inbound_antes_de_mencionar_radar
  ).length;

  const latencies = respondedAmongContacted
    .map((p) => p.ms_ate_primeira_resposta)
    .filter((x) => x != null && x >= 0);
  const medianMs =
    latencies.length === 0
      ? null
      : [...latencies].sort((a, b) => a - b)[
          Math.floor(latencies.length / 2)
        ];

  const taxaCohort =
    contacted.length > 0
      ? Math.round(
          (1000 * respondedAmongContacted.length) / contacted.length
        ) / 10
      : 0;
  const modelosAbertura = aggregateOpeningModels(contacted, taxaCohort);

  return {
    cohort: {
      total_sessoes_export: perSession.length,
      contactados_entrega_valida: contacted.length,
      contactados_so_falha_envio: perSession.filter((p) => p.failed_without_delivery)
        .length,
      responderam_entre_contactados: respondedAmongContacted.length,
      taxa_resposta_sobre_contactados_pct:
        contacted.length > 0
          ? Math.round(
              (1000 * respondedAmongContacted.length) / contacted.length
            ) / 10
          : 0,
    },
    primeira_resposta_por_touchpoint: {
      contagens: tpCounts,
      pct_sobre_quem_respondeu: tpPct,
      nota:
        "Touchpoint do ultimo outbound antes do primeiro inbound; (sem_tp) se agente nao gravou TP.",
    },
    radar: {
      sessoes_com_mencao_radar_em_outbound: comRadarTexto.length,
      inbound_antes_de_mencionar_radar_count: inboundAntesRadarCount,
      classificacao_ultimo_evento_apos_primeiro_radar: paradaCounts,
      nota_parada:
        "Snapshot: ultimo evento da thread apos primeiro outbound que menciona Radar.",
    },
    cruzamento_radar_url_csv: cruzamentoRadarBase,
    latencia_primeira_resposta_ms: {
      mediana_apos_primeiro_out_entregue: medianMs,
      amostras: latencies.length,
    },
    modelos_abertura: modelosAbertura,
    per_session: perSession,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(report, sourceFile, sessoesFile) {
  const c = report.cohort;
  const tp = report.primeira_resposta_por_touchpoint.contagens || {};
  const tpRows = Object.entries(tp)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) =>
        `<tr><td><code>${escapeHtml(k)}</code></td><td>${v}</td><td>${report.primeira_resposta_por_touchpoint.pct_sobre_quem_respondeu[k] ?? 0}%</td></tr>`
    )
    .join("");

  const parada = report.radar.classificacao_ultimo_evento_apos_primeiro_radar || {};
  const paradaRows = Object.entries(parada)
    .map(
      ([k, v]) =>
        `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`
    )
    .join("");

  let cruzHtml = "";
  const cr = report.cruzamento_radar_url_csv;
  if (cr) {
    cruzHtml = `<h2>Cruzamento radar_url (CSV) x menção no texto</h2><table><thead><tr><th>Caso</th><th>Qtd</th></tr></thead><tbody>
<tr><td>URL na base + mencionou Radar</td><td>${cr.radar_url_preenchido_e_mencionou_no_texto}</td></tr>
<tr><td>URL na base + não mencionou</td><td>${cr.radar_url_preenchido_nao_mencionou}</td></tr>
<tr><td>Sem URL + mencionou Radar</td><td>${cr.sem_url_mas_mencionou_radar}</td></tr>
<tr><td>Sem URL + não mencionou</td><td>${cr.sem_url_nao_mencionou}</td></tr></tbody></table><p class="meta">${escapeHtml(cr.nota || "")}</p>`;
  }

  const medMin =
    report.latencia_primeira_resposta_ms.mediana_apos_primeiro_out_entregue !=
    null
      ? (
          report.latencia_primeira_resposta_ms
            .mediana_apos_primeiro_out_entregue /
          60000
        ).toFixed(1)
      : "—";

  const ma = report.modelos_abertura || {};
  const taxaCohortMa = ma.taxa_resposta_cohort_contactados_pct ?? c.taxa_resposta_sobre_contactados_pct;
  const tagRows = (ma.ranking_por_tags || [])
    .map(
      (row) =>
        `<tr><td><code>${escapeHtml(row.tag)}</code></td><td>${row.contactados}</td><td>${row.responderam}</td><td>${row.taxa_resposta_pct}%</td><td>${row.diff_pp_vs_taxa_cohort != null ? (row.diff_pp_vs_taxa_cohort > 0 ? "+" : "") + row.diff_pp_vs_taxa_cohort : "—"}</td></tr>`
    )
    .join("");
  const grupoTop = (ma.ranking_por_grupo_texto || [])
    .slice(0, 25)
    .map((row) => {
      const ex = (row.exemplos_reais_mensagem || [])
        .map((e) => `<div class="excerpt">${escapeHtml(e)}</div>`)
        .join("");
      return `<tr><td class="modelkey"><code>${escapeHtml(
        row.modelo_chave_agrupamento
      )}</code></td><td>${row.contactados}</td><td>${
        row.responderam
      }</td><td>${row.taxa_resposta_pct}%</td><td>${ex}</td></tr>`;
    })
    .join("");
  const melhoresRows = (ma.melhores_grupos_taxa_com_n_minimo || [])
    .map(
      (row) =>
        `<tr><td><code>${escapeHtml(
          row.modelo_chave_agrupamento
        )}</code></td><td>${row.contactados}</td><td>${
          row.responderam
        }</td><td>${row.taxa_resposta_pct}%</td></tr>`
    )
    .join("");
  const nMin = ma.n_minimo_usado ?? 3;
  const semTag = ma.amostra_sem_tag_heuristica;

  const modelosHtml = `<h2>Modelos de abertura (1º outbound entregue)</h2>
<p class="meta">${escapeHtml(ma.definicao || "")}</p>
<p class="def"><strong>Interpretação:</strong> ${escapeHtml(
    ma.nota_interpretacao || ""
  )}</p>
<h3 style="font-size:1rem;color:#8b949e;margin-top:1rem">Por tags no texto (tendências — várias tags por mensagem possível)</h3>
<p class="meta">Taxa cohort (contactados): ${taxaCohortMa}%. Coluna Δ = taxa da tag − cohort (associação, não prova causal).</p>
<table><thead><tr><th>tag</th><th>contactados</th><th>responderam</th><th>taxa</th><th>Δ vs cohort</th></tr></thead><tbody>${tagRows}</tbody></table>
${
  semTag
    ? `<p class="meta">Mensagens sem nenhuma tag heurística: ${semTag.contactados} contactados, ${semTag.responderam} responderam (${semTag.taxa_resposta_pct}%).</p>`
    : ""
}
<h3 style="font-size:1rem;color:#8b949e;margin-top:1rem">Grupos por texto anonimizado (volume)</h3>
<table class="wide"><thead><tr><th>chave agrupamento</th><th>n</th><th>resp</th><th>taxa</th><th>exemplos reais (até 3)</th></tr></thead><tbody>${grupoTop}</tbody></table>
<h3 style="font-size:1rem;color:#8b949e;margin-top:1rem">Maior taxa entre grupos com n ≥ ${nMin}</h3>
<table><thead><tr><th>chave agrupamento</th><th>n</th><th>resp</th><th>taxa</th></tr></thead><tbody>${melhoresRows}</tbody></table>
<p class="meta">Ordenação “melhores”: taxa desc.; empate: n maior. Use com cautela se n for pequeno.</p>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Análise profunda — tração</title>
<style>:root{font-family:system-ui,sans-serif;background:#0f1419;color:#e6edf3}body{max-width:960px;margin:0 auto;padding:1.5rem;line-height:1.45}h1{font-size:1.35rem}h2{font-size:1.05rem;color:#8b949e;margin-top:1.5rem}.meta{color:#8b949e;font-size:.85rem}.def{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:.75rem 1rem;margin:1rem 0;font-size:.88rem}.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;margin:1rem 0}.kpi{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:.75rem 1rem}.kpi strong{display:block;font-size:1.25rem;color:#58a6ff}.kpi span{font-size:.75rem;color:#8b949e}table{width:100%;border-collapse:collapse;font-size:.88rem}th,td{padding:.45rem .5rem;border-bottom:1px solid #30363d;text-align:left;vertical-align:top}th{color:#8b949e}code{background:#161b22;padding:.1rem .35rem;border-radius:4px;font-size:.85em}.excerpt{font-size:.8rem;color:#c9d1d9;margin:.25rem 0;line-height:1.35;word-break:break-word}.modelkey code{white-space:pre-wrap;word-break:break-word;font-size:.78rem}footer{margin-top:2rem;font-size:.8rem;color:#6e7681}</style></head><body>
<h1>Análise profunda — respostas por touchpoint e pós-Radar</h1>
<p class="meta">${escapeHtml(report.generatedAt)}<br/>Threads: <code>${escapeHtml(sourceFile)}</code>${sessoesFile ? `<br/>Sessões CSV: <code>${escapeHtml(sessoesFile)}</code>` : ""}</p>
<div class="def"><strong>Definições:</strong> ${escapeHtml(JSON.stringify(report.definitions))}</div>
<div class="kpis">
<div class="kpi"><strong>${c.contactados_entrega_valida}</strong><span>Contactados (≥1 out entregue)</span></div>
<div class="kpi"><strong>${c.responderam_entre_contactados}</strong><span>Responderam (entre contactados)</span></div>
<div class="kpi"><strong>${c.taxa_resposta_sobre_contactados_pct}%</strong><span>Taxa resposta / contactados</span></div>
<div class="kpi"><strong>${report.radar.sessoes_com_mencao_radar_em_outbound}</strong><span>Sessões c/ menção Radar</span></div>
<div class="kpi"><strong>${medMin} min</strong><span>Mediana até 1ª resposta</span></div>
</div>
${modelosHtml}
<h2>1ª resposta — touchpoint do último outbound antes do 1º inbound</h2>
<p class="meta">Base: ${c.responderam_entre_contactados} leads que responderam (entre contactados).</p>
<table><thead><tr><th>touchpoint_id</th><th>qtd</th><th>% sobre quem respondeu</th></tr></thead><tbody>${tpRows}</tbody></table>
<h2>Radar — após 1º outbound que menciona “Radar”</h2>
<p class="meta">Sessões com menção: ${report.radar.sessoes_com_mencao_radar_em_outbound}. Inbound antes dessa menção: ${report.radar.inbound_antes_de_mencionar_radar_count}.</p>
<table><thead><tr><th>Classificação (último evento da thread após Radar)</th><th>qtd</th></tr></thead><tbody>${paradaRows}</tbody></table>
${cruzHtml}
<footer>node scripts/analyzeConversasDeep.js · docs/OUTBOUND_TRACAO_DIAGNOSTICO_VISUAL.md</footer>
</body></html>`;
}

async function main() {
  const { jsonPath, htmlOut, jsonOut, sessoesPath, quiet } = parseArgs(
    process.argv.slice(2)
  );

  if (!existsSync(jsonPath)) {
    console.error("Não encontrado:", jsonPath);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(data)) {
    console.error("JSON deve ser array.");
    process.exit(1);
  }

  let sessoesById = new Map();
  let sessoesFileResolved = null;
  const defaultSessoes = path.join(repoRoot, "conversas", "sessoes.csv");
  const csvPath = sessoesPath || (existsSync(defaultSessoes) ? defaultSessoes : null);
  if (csvPath && existsSync(csvPath)) {
    sessoesFileResolved = csvPath;
    const rows = await csv().fromFile(csvPath);
    for (const row of rows) {
      const id = row.id || row.session_id;
      if (id) sessoesById.set(String(id), row);
    }
  }

  const definitions = {
    contactado:
      "≥1 outbound real (não LEAD_ENTRY) com resultado não falha_envio",
    primeira_resposta_tp:
      "touchpoint_id do último outbound de cadência (não LEAD_ENTRY) antes do 1º inbound",
    radar_mencao: "primeiro outbound (real) com /\\bradar\\b/i no texto",
    parada_snapshot:
      "último evento da thread após primeiro outbound tipo Radar",
    modelo_abertura:
      "1º outbound real entregue na thread; agrupamento por texto normalizado + anonimização (§loja§/§regiao§); tags = padrões no texto",
  };

  const perSession = data.map((s) =>
    analyzeSession(s, sessoesById.get(s.session_id) || null)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    definitions,
    ...aggregate(perSession),
  };

  if (!quiet) console.log(JSON.stringify(report, null, 2));
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
    if (!quiet) console.error("JSON:", jsonOut);
  }
  if (htmlOut) {
    const full = { ...report, definitions };
    writeFileSync(
      htmlOut,
      buildHtml(full, jsonPath, sessoesFileResolved),
      "utf8"
    );
    if (!quiet) console.error("HTML:", htmlOut);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
