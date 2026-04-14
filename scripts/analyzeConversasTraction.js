/**
 * Análise de tração a partir de conversas_threads.json (export do Supabase).
 * Uso: node scripts/analyzeConversasTraction.js [--html out.html] [--json out.json] [caminho/conversas_threads.json]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const SHORT_ACK = new Set(["oi","ola","opa","sim","ok","👍","ok!","bom dia","boa tarde","boa noite"]);

function parseArgs(argv) {
  let jsonPath = null, htmlOut = null, jsonOut = null, quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--html") { htmlOut = argv[++i] || null; continue; }
    if (a === "--json") { jsonOut = argv[++i] || null; continue; }
    if (a === "--quiet") { quiet = true; continue; }
    if (a.startsWith("-")) continue;
    if (!jsonPath) jsonPath = a;
  }
  return {
    jsonPath: jsonPath ? (path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath)) : path.join(repoRoot, "conversas", "conversas_threads.json"),
    htmlOut: htmlOut ? (path.isAbsolute(htmlOut) ? htmlOut : path.join(process.cwd(), htmlOut)) : null,
    jsonOut: jsonOut ? (path.isAbsolute(jsonOut) ? jsonOut : path.join(process.cwd(), jsonOut)) : null,
    quiet,
  };
}

function normText(t) { return String(t || "").trim().toLowerCase().replace(/\s+/g, " "); }
function isLeadEntry(m) { return (m.touchpoint_id || "") === "LEAD_ENTRY" || (m.canal || "") === "system"; }
function realOutbound(msgs) { return msgs.filter((m) => m.direcao === "outbound" && !isLeadEntry(m)); }

function analyze(data) {
  const byStatus = {};
  let totalMsgs = 0, inboundC = 0, outboundC = 0, falhaEnvio = 0;
  let ghost = 0, fizzle = 0, engaged = 0;
  const tpOut = {};
  const phones = new Map();

  for (const s of data) {
    byStatus[s.status || "null"] = (byStatus[s.status || "null"] || 0) + 1;
    const ph = s.phone || "";
    phones.set(ph, (phones.get(ph) || 0) + 1);
    const msgs = [...(s.mensagens || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (const m of msgs) {
      totalMsgs++;
      if (m.direcao === "inbound") inboundC++; else outboundC++;
      if ((m.resultado || "").trim() === "falha_envio") falhaEnvio++;
      if (m.direcao === "outbound") {
        const tp = m.touchpoint_id || "(sem_tp)";
        tpOut[tp] = (tpOut[tp] || 0) + 1;
      }
    }
    const inb = msgs.filter((m) => m.direcao === "inbound");
    const outReal = realOutbound(msgs);
    if (inb.length === 0 && outReal.length >= 1) ghost++;
    if (inb.length > 0) {
      const onlyShort = inb.every((m) => {
        const t = normText(m.mensagem_texto);
        return t.length <= 12 || SHORT_ACK.has(t);
      });
      if (inb.length <= 3 && onlyShort && outReal.length > inb.length + 1) fizzle++;
      if (inb.length >= 2 || (inb.length === 1 && normText(inb[0].mensagem_texto).length > 25)) engaged++;
    }
  }

  const dupNumbers = [...phones.values()].filter((c) => c > 1).length;
  const sessionsOnDupPhones = data.filter((s) => (phones.get(s.phone) || 0) > 1).length;
  const n = data.length;
  const leadFlag = data.filter((s) => s.lead_respondeu_alguma_vez).length;

  return {
    generatedAt: new Date().toISOString(),
    sessions: n,
    messages: {
      total: totalMsgs,
      inbound: inboundC,
      outbound: outboundC,
      ratio_out_per_in: inboundC ? Math.round((outboundC / inboundC) * 100) / 100 : null,
    },
    falha_envio_count: falhaEnvio,
    lead_respondeu_alguma_vez: { count: leadFlag, pct: n ? Math.round((1000 * leadFlag) / n) / 10 : 0 },
    byStatus,
    heuristics: {
      ghost: { description: "1+ outbound real, 0 inbound", count: ghost, pct: n ? Math.round((1000 * ghost) / n) / 10 : 0 },
      fizzle: { description: "ate 3 inbound curtos, mais out que troca", count: fizzle, pct: n ? Math.round((1000 * fizzle) / n) / 10 : 0 },
      engaged: { description: "2+ inbound OU 1 inbound > 25 chars", count: engaged, pct: n ? Math.round((1000 * engaged) / n) / 10 : 0 },
    },
    duplicate_phones: { numbers_with_multiple_sessions: dupNumbers, sessions_affected: sessionsOnDupPhones },
    touchpoint_outbound: tpOut,
  };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHtml(m, sourceFile) {
  const bar = (label, pct, color) => {
    const w = Math.min(100, Math.max(0, pct));
    return `<div class="bar-row"><span class="bar-label">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div><span class="bar-pct">${pct}%</span></div>`;
  };
  const tpRows = Object.entries(m.touchpoint_outbound).sort((a, b) => b[1] - a[1])
    .map(([tp, c]) => `<tr><td><code>${escapeHtml(tp)}</code></td><td>${c}</td></tr>`).join("");
  const statusRows = Object.entries(m.byStatus).sort((a, b) => b[1] - a[1])
    .map(([st, c]) => `<tr><td>${escapeHtml(st)}</td><td>${c}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Tração outbound</title>
<style>:root{font-family:system-ui,sans-serif;background:#0f1419;color:#e6edf3}body{max-width:900px;margin:0 auto;padding:1.5rem}h1{font-size:1.35rem}h2{font-size:1.05rem;color:#8b949e;margin-top:1.5rem}.meta{color:#8b949e;font-size:.9rem}.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.75rem;margin:1rem 0}.kpi{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:.75rem 1rem}.kpi strong{display:block;font-size:1.35rem;color:#58a6ff}.kpi span{font-size:.8rem;color:#8b949e}.bar-row{display:grid;grid-template-columns:220px 1fr 48px;align-items:center;gap:.5rem;margin:.35rem 0;font-size:.9rem}.bar-track{height:10px;background:#30363d;border-radius:5px;overflow:hidden}.bar-fill{height:100%;border-radius:5px}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{padding:.45rem .5rem;border-bottom:1px solid #30363d}th{color:#8b949e}code{background:#161b22;padding:.1rem .35rem;border-radius:4px}footer{margin-top:2rem;font-size:.8rem;color:#6e7681}</style></head><body>
<h1>Diagnóstico de tração</h1><p class="meta">${escapeHtml(m.generatedAt)}<br/><code>${escapeHtml(sourceFile)}</code></p>
<div class="kpis"><div class="kpi"><strong>${m.sessions}</strong><span>Sessões</span></div><div class="kpi"><strong>${m.messages.total}</strong><span>Mensagens</span></div><div class="kpi"><strong>${m.messages.ratio_out_per_in ?? "—"}</strong><span>Out/in</span></div><div class="kpi"><strong>${m.lead_respondeu_alguma_vez.pct}%</strong><span>Flag respondeu</span></div><div class="kpi"><strong>${m.falha_envio_count}</strong><span>falha_envio</span></div></div>
<h2>Heurísticas</h2>${bar("Fantasma", m.heuristics.ghost.pct, "#f85149")}${bar("Engajamento", m.heuristics.engaged.pct, "#3fb950")}${bar("Esfriamento", m.heuristics.fizzle.pct, "#d29922")}
<h2>Status</h2><table><thead><tr><th>status</th><th>qtd</th></tr></thead><tbody>${statusRows}</tbody></table>
<h2>Touchpoint (outbound)</h2><table><thead><tr><th>id</th><th>qtd</th></tr></thead><tbody>${tpRows}</tbody></table>
<p>Telefones com &gt;1 sessão: <strong>${m.duplicate_phones.numbers_with_multiple_sessions}</strong> · sessões: <strong>${m.duplicate_phones.sessions_affected}</strong></p>
<footer>node scripts/analyzeConversasTraction.js · docs/OUTBOUND_TRACAO_DIAGNOSTICO_VISUAL.md</footer></body></html>`;
}

function main() {
  const { jsonPath, htmlOut, jsonOut, quiet } = parseArgs(process.argv.slice(2));
  if (!existsSync(jsonPath)) { console.error("Não encontrado:", jsonPath); process.exit(1); }
  const data = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(data)) { console.error("JSON deve ser array."); process.exit(1); }
  const metrics = analyze(data);
  if (!quiet) console.log(JSON.stringify(metrics, null, 2));
  if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(metrics, null, 2), "utf8"); if (!quiet) console.error("JSON:", jsonOut); }
  if (htmlOut) { writeFileSync(htmlOut, buildHtml(metrics, jsonPath), "utf8"); if (!quiet) console.error("HTML:", htmlOut); }
}
main();
