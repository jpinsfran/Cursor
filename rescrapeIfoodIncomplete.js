/**
 * Re-busca páginas do iFood para linhas em que o scrape original falhou (só URL / sem nome).
 * O scrape normal não reprocessa URLs já salvas no CSV; use este script para corrigir.
 *
 * Uso:
 *   node rescrapeIfoodIncomplete.js ifoodLeads_todos.csv
 *   node rescrapeIfoodIncomplete.js ifoodLeads_todos.csv --dry-run
 *   node rescrapeIfoodIncomplete.js ifoodLeads_todos.csv --limit 20
 */

import "dotenv/config";
import csv from "csvtojson";
import { json2csv } from "json-2-csv";
import path from "path";
import { promises as fs } from "fs";
import { cleanText } from "./lib/leadDataUtils.js";
import { fetchIfoodRestaurantRow } from "./lib/ifoodRestaurantFetch.js";

const FETCH_FIELDS = [
  "name",
  "phone",
  "cnpj",
  "streetAddress",
  "neighborhood",
  "zipcode",
  "rating",
  "email",
  "cuisine",
  "priceRange",
];

function rowUrl(row) {
  return cleanText(row.url || row.ifood_url || "");
}

/** Linha típica de falha de fetch: tem URL mas nome vazio (demais campos costumam vir vazios). */
function isIncomplete(row) {
  const url = rowUrl(row);
  if (!url) return false;
  const name = cleanText(row.name);
  return !name;
}

function mergeFetched(row, fresh) {
  const out = { ...row };
  for (const f of FETCH_FIELDS) {
    const v = fresh[f];
    if (v != null && String(v).trim() !== "") out[f] = v;
  }
  const u = fresh.url || rowUrl(row);
  if (out.url !== undefined) out.url = u;
  if (Object.prototype.hasOwnProperty.call(out, "ifood_url")) out.ifood_url = u;
  return out;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const dryRun = process.argv.includes("--dry-run");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;

  const csvPath = path.resolve(argv[0] || path.join(process.cwd(), "ifoodLeads_todos.csv"));
  let content;
  try {
    content = await fs.readFile(csvPath, "utf8");
  } catch (e) {
    console.error("Erro ao ler:", csvPath, e.message);
    process.exit(1);
  }

  const rows = await csv({ noheader: false }).fromString(content);
  if (!rows.length) {
    console.log("CSV vazio.");
    return;
  }

  const incompleteIdx = [];
  rows.forEach((row, i) => {
    if (isIncomplete(row)) incompleteIdx.push(i);
  });

  const toFix = limit > 0 ? incompleteIdx.slice(0, limit) : incompleteIdx;
  console.log("Linhas no CSV:", rows.length);
  console.log("Incompletas (URL sem nome):", incompleteIdx.length);
  console.log("A processar:", toFix.length, dryRun ? "(dry-run)" : "");

  if (dryRun) {
    toFix.slice(0, 15).forEach((i) => console.log("  ", rowUrl(rows[i])));
    if (toFix.length > 15) console.log("  ...");
    return;
  }

  const CONCURRENCY = 10;
  let updated = 0;
  for (let i = 0; i < toFix.length; i += CONCURRENCY) {
    const batch = toFix.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (idx) => {
        const row = rows[idx];
        const url = rowUrl(row);
        const fresh = await fetchIfoodRestaurantRow(url);
        const merged = mergeFetched(row, fresh);
        const gainedName = cleanText(merged.name);
        if (gainedName) updated++;
        return { idx, merged, gainedName };
      })
    );
    for (const { idx, merged } of results) {
      rows[idx] = merged;
    }
    console.log(`Progresso: ${Math.min(i + CONCURRENCY, toFix.length)}/${toFix.length}`);
  }

  const outContent = await json2csv(rows, { emptyFieldValue: "" });
  await fs.writeFile(csvPath, "\uFEFF" + outContent, "utf8");
  console.log("Salvo:", csvPath, "| Linhas que passaram a ter nome:", updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
