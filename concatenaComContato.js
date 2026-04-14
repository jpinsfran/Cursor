/**
 * Concatena planilhas *_com_contato.csv em uma única (ifoodLeads_com_contato_unificado.csv).
 * Usa o cabeçalho do primeiro (com regiao, instagramUrl); demais ganham essas colunas vazias se faltarem.
 *
 * Uso: node concatenaComContato.js
 *      node concatenaComContato.js saida.csv
 */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import csv from "csvtojson";
import { json2csv } from "json-2-csv";
import { dedupeRowsByCanonicalPhone } from "./lib/dedupePhoneCsv.js";

const DIR = process.cwd();
const FILES = [
  "ifoodLeads_com_contato.csv",
  "ifoodLeads_SP_com_contato.csv",
  "ifoodLeads_BA_com_contato.csv",
];
const OUT_DEFAULT = "ifoodLeads_com_contato_unificado.csv";

function normalizeRow(row) {
  if (row.regiao === undefined) row.regiao = "";
  if (row.instagramUrl === undefined) row.instagramUrl = "";
  return row;
}

async function main() {
  const outName = process.argv[2] && process.argv[2].endsWith(".csv")
    ? process.argv[2]
    : OUT_DEFAULT;

  const outPath = path.join(DIR, outName);
  const allRows = [];
  const counts = [];

  for (const file of FILES) {
    const filePath = path.join(DIR, file);
    try {
      const content = await readFile(filePath, "utf8");
      const rows = await csv({ noheader: false }).fromString(content);
      rows.forEach(normalizeRow);
      allRows.push(...rows);
      counts.push({ file, n: rows.length });
    } catch (err) {
      if (err.code === "ENOENT") {
        console.warn("Arquivo não encontrado, pulando:", file);
      } else throw err;
    }
  }

  const deduped = dedupeRowsByCanonicalPhone(allRows);
  const csvContent = await json2csv(deduped, { emptyFieldValue: "" });
  await writeFile(outPath, "\uFEFF" + csvContent, "utf8");

  const sum = counts.map((c) => c.n).join(" + ");
  console.log("Concatenado:", sum, "=", allRows.length, "linhas brutas →", deduped.length, "após dedup telefone");
  counts.forEach((c) => console.log("  ", c.file, ":", c.n));
  console.log("Salvo:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
