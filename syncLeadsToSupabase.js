import "dotenv/config";
/**
 * Sincroniza um CSV de leads para o Supabase por estágio/tabela.
 * Não altera o CSV; apenas envia os dados para as tabelas.
 *
 * Uso: node syncLeadsToSupabase.js <arquivo.csv>
 *      node syncLeadsToSupabase.js ifoodLeads_unificado.csv
 *      node syncLeadsToSupabase.js ifoodLeads_todos.csv --only-estab
 *      node syncLeadsToSupabase.js ifoodLeads_todos_com_contato.csv --only-qual
 *      node syncLeadsToSupabase.js ifoodLeads_todos_com_contato_unificado.csv --only-perfil
 *
 * Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) no .env.
 *         npm install @supabase/supabase-js
 */

import csv from "csvtojson";
import path from "path";
import { promises as fs } from "fs";
import { isEnabled, upsertEstabelecimento, upsertQualificado, upsertPerfil } from "./lib/supabaseLeads.js";
import { enrichLeadRows } from "./lib/leadDataUtils.js";
import { dedupeRowsByCanonicalPhone } from "./lib/dedupePhoneCsv.js";

function parseModeArg() {
  const onlyEstab = process.argv.includes("--only-estab");
  const onlyQual = process.argv.includes("--only-qual");
  const onlyPerfil = process.argv.includes("--only-perfil");
  const picked = [onlyEstab, onlyQual, onlyPerfil].filter(Boolean).length;
  if (picked > 1) {
    console.error("Use apenas uma flag de modo: --only-estab, --only-qual ou --only-perfil.");
    process.exit(1);
  }
  if (onlyEstab) return "estab";
  if (onlyQual) return "qual";
  if (onlyPerfil) return "perfil";
  return "all";
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), "ifoodLeads_unificado.csv");
  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const mode = parseModeArg();

  if (!isEnabled()) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) no .env.");
    process.exit(1);
  }

  let rows = [];
  try {
    const content = await fs.readFile(fullPath, "utf8");
    rows = await csv({ noheader: false }).fromString(content);
  } catch (e) {
    console.error("Erro ao ler CSV:", fullPath, e.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.log("CSV vazio.");
    return;
  }

  rows = enrichLeadRows(rows, { includeClassification: true });
  rows = dedupeRowsByCanonicalPhone(rows);

  const modeLabel = mode === "all" ? "estab+qual+perfil" : mode;
  console.log("Sincronizando", rows.length, "linhas para o Supabase (modo:", modeLabel + ", dedup por telefone)...");
  let estab = 0, qual = 0, perfil = 0;
  for (const row of rows) {
    const url = (row.url || row.ifood_url || "").trim();
    if (!url) continue;
    try {
      if (mode === "all" || mode === "estab") {
        const id = await upsertEstabelecimento(row);
        if (id) estab++;
      }
      if (mode === "all" || mode === "qual") {
        const id = await upsertQualificado(row);
        if (id) qual++;
      }
      if (mode === "all" || mode === "perfil") {
        const id = await upsertPerfil(row);
        if (id) perfil++;
      }
    } catch (e) {
      console.warn("Linha ignorada:", url?.slice(0, 50), e.message);
    }
  }
  console.log("Concluído. Estabelecimentos:", estab, "| Qualificados:", qual, "| Perfil:", perfil);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
