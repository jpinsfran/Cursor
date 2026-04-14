/**
 * Concatena todas as planilhas ifoodLeads_*.csv em uma única (ifoodLeads_todos.csv).
 * Ignora arquivos *_unificado.csv.
 *
 * Uso: node concatenaIfoodLeads.js
 *      node concatenaIfoodLeads.js ifoodLeads_todos.csv   (nome do arquivo de saída)
 */

import { readdir, writeFile } from "fs/promises";
import path from "path";
import csv from "csvtojson";
import { json2csv } from "json-2-csv";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";
import { dedupeRowsByCanonicalPhone } from "./lib/dedupePhoneCsv.js";

const DIR = process.cwd();
const PREFIX = "ifoodLeads_";
const SUFFIX_UNIFICADO = "_unificado";

async function main() {
  const outName = process.argv[2] && process.argv[2].endsWith(".csv")
    ? process.argv[2]
    : "ifoodLeads_todos.csv";

  const files = await readdir(DIR);
  const csvFiles = files.filter(
    (f) => f.startsWith(PREFIX) && f.endsWith(".csv") && !f.includes(SUFFIX_UNIFICADO) && f !== outName
  );

  if (csvFiles.length === 0) {
    console.log("Nenhum arquivo ifoodLeads_*.csv encontrado (excluindo *_unificado.csv).");
    return;
  }

  console.log("Arquivos a concatenar:", csvFiles.join(", "));

  const allRows = [];
  const allColumns = new Set();

  for (const file of csvFiles) {
    const filePath = path.join(DIR, file);
    const regiao = path.basename(file, ".csv").replace(PREFIX, "") || path.basename(file, ".csv");
    const rows = await csv().fromFile(filePath);
    for (const row of rows) {
      const r = { ...row };
      if (!r.regiao) r.regiao = regiao;
      allRows.push(r);
      Object.keys(r).forEach((k) => allColumns.add(k));
    }
  }

  const columns = ["regiao", ...Array.from(allColumns).filter((c) => c !== "regiao")];
  allRows.forEach((r) => {
    columns.forEach((col) => {
      if (!Object.prototype.hasOwnProperty.call(r, col)) r[col] = "";
    });
  });

  let normalizedRows = normalizeLeadRows(allRows);
  normalizedRows = dedupeRowsByCanonicalPhone(normalizedRows);
  const csvContent = await json2csv(normalizedRows, { emptyFieldValue: "" });
  const outPath = path.join(DIR, outName);
  await writeFile(outPath, "\uFEFF" + csvContent, "utf8");

  console.log("Salvo:", outPath, "| Linhas (após dedup telefone):", normalizedRows.length, "| antes:", allRows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
