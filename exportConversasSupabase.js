/**
 * Exporta do Supabase as tabelas de cadência outbound para CSV (análise / base de conhecimento).
 *
 * Gera:
 *   - sessoes.csv          — outbound_cadencia_sessions (1 linha por lead/sessão)
 *   - eventos.csv          — outbound_cadencia_eventos (1 linha por mensagem/evento)
 *   - conversas_long.csv   — eventos com colunas principais da sessão repetidas (uma linha por mensagem)
 *   - historico_conversas.md — todas as conversas em ordem, como histórico (Markdown)
 *   - por_sessao/<id>.md    — um arquivo por session_id (mesmo conteúdo por conversa)
 *   - conversas_threads.json — array { session_id, meta..., mensagens: [...] } para análise
 *   - conversas_historico.csv — uma linha por mensagem, ordenado como o histórico (sessão + msg_ordem)
 *   - conversas_chat_por_sessao.csv — uma linha por telefone (sessões com mesmo número fundidas); nome + historico_chat ([LEAD]/[AGENTE])
 *   - follow_up_tracking.csv — se a tabela existir e houver dados (opcional)
 *
 * Uso:
 *   node exportConversasSupabase.js
 *   node exportConversasSupabase.js ./pasta-saida
 *   node exportConversasSupabase.js ./pasta-saida --desde=2025-01-01
 *
 * Variáveis: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY)
 */

import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { json2csv } from "json-2-csv";
import { getClient, isEnabled, formatSupabaseError } from "./lib/supabaseLeads.js";
import { phoneDigitsOnly } from "./lib/phoneBrasil.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGE = 1000;

function parseArgs(argv) {
  let outDir = path.join(__dirname, "data", "conversas-export");
  let desde = null;
  for (const a of argv) {
    if (a.startsWith("--desde=")) {
      desde = a.slice("--desde=".length).trim();
      continue;
    }
    if (a.startsWith("-")) continue;
    outDir = path.isAbsolute(a) ? a : path.join(process.cwd(), a);
  }
  return { outDir, desde };
}

/** Serializa objetos/array para string no CSV (metadata, touchpoints_executados, etc.). */
function flattenForCsv(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) {
      out[k] = "";
    } else if (typeof v === "object") {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function fetchAllPaged(supabase, table, { orderColumn = "created_at", desde = null, select = "*" } = {}) {
  let from = 0;
  const all = [];
  for (;;) {
    let q = supabase.from(table).select(select).order(orderColumn, { ascending: true }).range(from, from + PAGE - 1);
    if (desde) {
      q = supabase
        .from(table)
        .select(select)
        .gte(orderColumn, `${desde}T00:00:00.000Z`)
        .order(orderColumn, { ascending: true })
        .range(from, from + PAGE - 1);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** follow_up_tracking pode não existir em projetos antigos — ignora erro 42P01 / PGRST205 */
async function fetchFollowUpOptional(supabase) {
  const { data, error } = await supabase
    .from("follow_up_tracking")
    .select("*")
    .order("id", { ascending: true })
    .range(0, PAGE - 1);
  if (error) {
    const msg = formatSupabaseError(error) || String(error.message || error);
    if (/relation|does not exist|schema cache/i.test(msg)) {
      return [];
    }
    throw error;
  }
  if (!data?.length) return [];
  let all = [...data];
  let from = PAGE;
  for (;;) {
    const { data: page, error: err2 } = await supabase
      .from("follow_up_tracking")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (err2) throw err2;
    if (!page?.length) break;
    all.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Agrupa eventos por session_id e ordena por created_at (cronológico). */
function groupEventsBySession(eventos) {
  const map = new Map();
  for (const e of eventos) {
    const sid = e.session_id;
    if (!sid) continue;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(e);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return map;
}

function formatMessageBody(text) {
  const t = text == null ? "" : String(text).trim();
  if (!t) return "_Sem texto registrado._";
  if (t.includes("\n") || t.includes("```") || t.length > 280) {
    const safe = t.replace(/```/g, "`\`\`");
    return `\n\`\`\`\n${safe}\n\`\`\`\n`;
  }
  return t;
}

/**
 * Monta bloco Markdown de uma sessão (cabeçalho + mensagens em ordem).
 */
function renderSessionMarkdown(session, msgs) {
  const sid = session.id;
  const nome = session.nome_negocio || session.nome_lead || "(sem nome)";
  const phone = session.phone ?? "";
  const lines = [];
  lines.push(`## ${nome}`);
  lines.push("");
  lines.push(`| Campo | Valor |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **session_id** | \`${sid}\` |`);
  lines.push(`| **Telefone** | ${phone || "—"} |`);
  lines.push(`| **Status** | ${session.status ?? "—"} |`);
  lines.push(`| **Lead respondeu** | ${session.lead_respondeu_alguma_vez === true ? "sim" : session.lead_respondeu_alguma_vez === false ? "não" : "—"} |`);
  lines.push(`| **Primeiro contato** | ${session.primeiro_contato_at ?? "—"} |`);
  lines.push(`| **Última inbound** | ${session.ultima_inbound_at ?? "—"} |`);
  lines.push(`| **Última outbound** | ${session.ultima_outbound_at ?? "—"} |`);
  lines.push("");
  lines.push(`### Histórico (${msgs.length} evento(s))`);
  lines.push("");

  if (msgs.length === 0) {
    lines.push("_Nenhum evento de mensagem neste export (verifique filtro \`--desde\` ou dados em \`outbound_cadencia_eventos\`)._");
    lines.push("");
    return lines.join("\n");
  }

  let i = 1;
  for (const e of msgs) {
    const when = e.created_at ?? "";
    const dir = (e.direcao || "").toUpperCase();
    const tp = e.touchpoint_id ? ` · ${e.touchpoint_id}` : "";
    const canal = e.canal ? ` · ${e.canal}` : "";
    const res = e.resultado ? ` · resultado: ${e.resultado}` : "";
    const title = `**${i}. [${when}] ${dir}${tp}${canal}${res}**`;
    lines.push(title);
    const body = (e.mensagem_texto && String(e.mensagem_texto).trim()) || (e.resumo && String(e.resumo).trim()) || "";
    lines.push(formatMessageBody(body));
    lines.push("");
    i++;
  }
  return lines.join("\n");
}

function buildThreadsPayload(sessoes, eventosBySession) {
  const sortedSessions = [...sessoes].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );

  return sortedSessions.map((s) => {
    const msgs = eventosBySession.get(s.id) || [];
    return {
      session_id: s.id,
      phone: s.phone ?? null,
      nome_negocio: s.nome_negocio ?? null,
      nome_lead: s.nome_lead ?? null,
      status: s.status ?? null,
      lead_respondeu_alguma_vez: s.lead_respondeu_alguma_vez ?? null,
      primeiro_contato_at: s.primeiro_contato_at ?? null,
      ultima_inbound_at: s.ultima_inbound_at ?? null,
      ultima_outbound_at: s.ultima_outbound_at ?? null,
      mensagens: msgs.map((e) => ({
        id: e.id,
        created_at: e.created_at,
        direcao: e.direcao,
        touchpoint_id: e.touchpoint_id ?? null,
        canal: e.canal ?? null,
        resultado: e.resultado ?? null,
        mensagem_texto: e.mensagem_texto ?? null,
        resumo: e.resumo ?? null,
      })),
    };
  });
}

async function writeHistoricoExports(outDir, sessoes, eventos) {
  const eventosBySession = groupEventsBySession(eventos);
  const sortedSessions = [...sessoes].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );

  const dirPorSessao = path.join(outDir, "por_sessao");
  await fs.mkdir(dirPorSessao, { recursive: true });

  const chunks = [];
  chunks.push("# Histórico de conversas (export Supabase)");
  chunks.push("");
  chunks.push(`Total de sessões: **${sessoes.length}** · Total de eventos: **${eventos.length}**`);
  chunks.push("");
  chunks.push("---");
  chunks.push("");

  for (const s of sortedSessions) {
    const msgs = eventosBySession.get(s.id) || [];
    chunks.push(renderSessionMarkdown(s, msgs));
    chunks.push("");
    chunks.push("---");
    chunks.push("");

    const oneFile = path.join(dirPorSessao, `${s.id}.md`);
    const single = [`# Conversa · ${s.nome_negocio || s.nome_lead || s.id}`, "", renderSessionMarkdown(s, msgs)];
    await fs.writeFile(oneFile, single.join("\n"), "utf8");
  }

  const pHist = path.join(outDir, "historico_conversas.md");
  await fs.writeFile(pHist, chunks.join("\n"), "utf8");

  const payload = buildThreadsPayload(sessoes, eventosBySession);
  const pJson = path.join(outDir, "conversas_threads.json");
  await fs.writeFile(pJson, JSON.stringify(payload, null, 2), "utf8");

  return { pHist, pJson, dirPorSessao, countFiles: sortedSessions.length };
}

const EMPTY_SESSION_COLS = {
  session_phone: "",
  session_nome_negocio: "",
  session_nome_lead: "",
  session_status: "",
  session_lead_respondeu: "",
  session_primeiro_contato_at: "",
  session_ultima_inbound_at: "",
  session_ultima_outbound_at: "",
  session_ultimo_touchpoint_id: "",
};

function sessionColumnsForExport(s) {
  if (!s) return { ...EMPTY_SESSION_COLS };
  return {
    session_phone: s.phone ?? "",
    session_nome_negocio: s.nome_negocio ?? "",
    session_nome_lead: s.nome_lead ?? "",
    session_status: s.status ?? "",
    session_lead_respondeu: s.lead_respondeu_alguma_vez ?? "",
    session_primeiro_contato_at: s.primeiro_contato_at ?? "",
    session_ultima_inbound_at: s.ultima_inbound_at ?? "",
    session_ultima_outbound_at: s.ultima_outbound_at ?? "",
    session_ultimo_touchpoint_id: s.ultimo_touchpoint_id ?? "",
  };
}

/** inbound = lead; outbound = agente (cadência / sistema). */
function quemFala(direcao) {
  const d = String(direcao || "").trim().toLowerCase();
  if (d === "inbound") return "LEAD";
  if (d === "outbound") return "AGENTE";
  return d ? d.toUpperCase() : "";
}

function textoEventoChat(e) {
  const t = e.mensagem_texto != null && String(e.mensagem_texto).trim();
  if (t) return t;
  const r = e.resumo != null && String(e.resumo).trim();
  return r || "";
}

/** Bloco único estilo chat: cada mensagem com cabeçalho [LEAD|AGENTE] + ISO time + corpo. */
function buildHistoricoChatText(msgs) {
  const parts = [];
  for (const e of msgs) {
    const who = quemFala(e.direcao);
    const label = who || "?";
    const when = e.created_at ?? "";
    const body = textoEventoChat(e);
    parts.push(`[${label}] ${when}\n${body}`);
  }
  return parts.join("\n\n");
}

/** Telefone canônico para agrupar (≥10 dígitos); vazio = tratar sessão isolada. */
function sessionPhoneKey(s) {
  const d = phoneDigitsOnly(s.phone ?? "");
  return d.length >= 10 ? d : "";
}

/**
 * Uma linha por telefone: funde eventos de todas as sessões com o mesmo número (evita histórico duplicado).
 * session_id = sessão “keeper” (mais recente por updated_at). Sem telefone válido: uma linha por sessão.
 */
function buildChatPorSessaoRows(sessoes, eventos) {
  const eventosBySession = groupEventsBySession(eventos);
  const sortedSessions = [...sessoes].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );

  const byPhone = new Map();
  for (const s of sortedSessions) {
    const key = sessionPhoneKey(s);
    const mapKey = key || `__nophone__${s.id}`;
    if (!byPhone.has(mapKey)) byPhone.set(mapKey, []);
    byPhone.get(mapKey).push(s);
  }

  const rows = [];
  const phoneKeysOrdered = [...byPhone.keys()].sort((a, b) => {
    if (a.startsWith("__nophone__") && !b.startsWith("__nophone__")) return 1;
    if (!a.startsWith("__nophone__") && b.startsWith("__nophone__")) return -1;
    const ga = byPhone.get(a)[0];
    const gb = byPhone.get(b)[0];
    return new Date(gb.updated_at || gb.created_at) - new Date(ga.updated_at || ga.created_at);
  });

  for (const mapKey of phoneKeysOrdered) {
    const group = byPhone.get(mapKey);
    const keeper = group[0];
    const allMsgs = [];
    for (const s of group) {
      allMsgs.push(...(eventosBySession.get(s.id) || []));
    }
    allMsgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const nome = keeper.nome_negocio || keeper.nome_lead || "";
    rows.push(
      flattenForCsv({
        session_id: keeper.id,
        nome_estabelecimento: nome,
        historico_chat: buildHistoricoChatText(allMsgs),
      })
    );
  }
  return rows;
}

/** Mesma ordem de sessões que historico_conversas.md: updated_at/created_at desc; mensagens por created_at asc. */
function buildHistoricoRows(sessoes, eventos) {
  const eventosBySession = groupEventsBySession(eventos);
  const sortedSessions = [...sessoes].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );
  const rows = [];
  for (const s of sortedSessions) {
    const msgs = eventosBySession.get(s.id) || [];
    const base = sessionColumnsForExport(s);
    let ord = 1;
    for (const e of msgs) {
      rows.push(
        flattenForCsv({
          ...base,
          msg_ordem: ord,
          evento_id: e.id,
          session_id: s.id,
          evento_created_at: e.created_at,
          direcao: e.direcao,
          touchpoint_id: e.touchpoint_id ?? "",
          canal: e.canal ?? "",
          resultado: e.resultado ?? "",
          mensagem_texto: e.mensagem_texto ?? "",
          resumo: e.resumo ?? "",
          mensagem_texto_len: e.mensagem_texto != null ? String(e.mensagem_texto).length : "",
        })
      );
      ord++;
    }
  }
  return rows;
}

function buildLongRows(sessoes, eventos) {
  const byId = new Map(sessoes.map((s) => [s.id, s]));

  return eventos.map((e) => {
    const s = byId.get(e.session_id);
    const base = sessionColumnsForExport(s);
    return flattenForCsv({
      ...base,
      evento_id: e.id,
      session_id: e.session_id,
      evento_created_at: e.created_at,
      direcao: e.direcao,
      touchpoint_id: e.touchpoint_id ?? "",
      canal: e.canal ?? "",
      resultado: e.resultado ?? "",
      mensagem_texto: e.mensagem_texto ?? "",
      resumo: e.resumo ?? "",
      mensagem_texto_len: e.mensagem_texto != null ? String(e.mensagem_texto).length : "",
    });
  });
}

async function main() {
  const { outDir, desde } = parseArgs(process.argv.slice(2));

  if (!isEnabled()) {
    console.error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) no .env");
    process.exit(1);
  }

  const supabase = await getClient();
  if (!supabase) {
    console.error("Não foi possível criar o cliente Supabase.");
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  console.log(desde ? `Filtro: created_at >= ${desde}` : "Sem filtro de data (todas as linhas).");
  console.log("Lendo outbound_cadencia_sessions…");
  const sessoes = await fetchAllPaged(supabase, "outbound_cadencia_sessions", {
    orderColumn: "created_at",
    desde,
    select: "*",
  });
  console.log(`  → ${sessoes.length} sessões`);

  console.log("Lendo outbound_cadencia_eventos…");
  const eventos = await fetchAllPaged(supabase, "outbound_cadencia_eventos", {
    orderColumn: "created_at",
    desde,
    select: "*",
  });
  console.log(`  → ${eventos.length} eventos`);

  const sessoesFlat = sessoes.map(flattenForCsv);
  const eventosFlat = eventos.map(flattenForCsv);
  const longRows = buildLongRows(sessoes, eventos);
  const historicoRows = buildHistoricoRows(sessoes, eventos);
  const chatPorSessaoRows = buildChatPorSessaoRows(sessoes, eventos);

  const opts = { emptyFieldValue: "" };

  const pSess = path.join(outDir, "sessoes.csv");
  const pEv = path.join(outDir, "eventos.csv");
  const pLong = path.join(outDir, "conversas_long.csv");
  const pHistCsv = path.join(outDir, "conversas_historico.csv");
  const pChatSess = path.join(outDir, "conversas_chat_por_sessao.csv");

  await fs.writeFile(pSess, await json2csv(sessoesFlat, opts), "utf8");
  await fs.writeFile(pEv, await json2csv(eventosFlat, opts), "utf8");
  await fs.writeFile(pLong, await json2csv(longRows, opts), "utf8");
  await fs.writeFile(pHistCsv, await json2csv(historicoRows, opts), "utf8");
  await fs.writeFile(pChatSess, await json2csv(chatPorSessaoRows, opts), "utf8");

  console.log("Escrito:", pSess);
  console.log("Escrito:", pEv);
  console.log("Escrito:", pLong);
  console.log("Escrito:", pHistCsv);
  console.log("Escrito:", pChatSess);

  console.log("Gerando histórico por session_id (Markdown + JSON)…");
  const { pHist, pJson, dirPorSessao, countFiles } = await writeHistoricoExports(outDir, sessoes, eventos);
  console.log("Escrito:", pHist);
  console.log("Escrito:", pJson);
  console.log("Pasta:", dirPorSessao, `(${countFiles} arquivos .md)`);

  try {
    const fu = await fetchFollowUpOptional(supabase);
    if (fu.length) {
      const pFu = path.join(outDir, "follow_up_tracking.csv");
      await fs.writeFile(pFu, await json2csv(fu.map(flattenForCsv), opts), "utf8");
      console.log("Escrito:", pFu, `(${fu.length} linhas)`);
    } else {
      console.log("follow_up_tracking: sem dados ou tabela ausente (omitido).");
    }
  } catch (e) {
    console.warn("follow_up_tracking:", formatSupabaseError(e) || e.message);
  }

  console.log("Concluído.");
}

main().catch((e) => {
  console.error(formatSupabaseError(e) || e);
  process.exit(1);
});
