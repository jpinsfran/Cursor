import "dotenv/config";
/**
 * Sincroniza um CSV de leads para o Supabase (ifood_estabelecimentos, leads_qualificados, leads_perfil).
 * Não altera o CSV; apenas envia os dados para as tabelas.
 *
 * Uso: node syncLeadsToSupabase.js <arquivo.csv>
 *      node syncLeadsToSupabase.js ifoodLeads_unificado.csv
 *
 * Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) no .env.
 *         npm install @supabase/supabase-js
 */

import csv from "csvtojson";
import path from "path";
import { promises as fs } from "fs";
import { isEnabled, upsertEstabelecimento, upsertQualificado, upsertPerfil } from "./lib/supabaseLeads.js";

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), "ifoodLeads_unificado.csv");
  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);

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

  console.log("Sincronizando", rows.length, "linhas para o Supabase...");
  let estab = 0, qual = 0, perfil = 0;
  for (const row of rows) {
    const url = (row.url || row.ifood_url || "").trim();
    if (!url) continue;
    try {
      const id = await upsertEstabelecimento(row);
      if (id) estab++;
      if ((row.phone || "").trim() || (row.email || "").trim()) {
        await upsertQualificado(row);
        qual++;
      }
      if ((row.perfil_do_lead || "").trim() || (row.punch_line || "").trim()) {
        await upsertPerfil(row);
        perfil++;
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
