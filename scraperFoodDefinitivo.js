/**
 * SCRAPER DEFINITIVO – Estabelecimentos da linha food
 *
 * Você informa apenas a REGIÃO de interesse; o script:
 *  1) Gera a planilha de leads do iFood (scrapeIfoodLeads.js)
 *  2) Para cada lead, busca o Instagram e faz análise completa (destaques, posts, link externo, unidades)
 *  3) Gera a planilha unificada (iFood + Instagram).
 *
 * Uso:
 *   node scraperFoodDefinitivo.js SP
 *   node scraperFoodDefinitivo.js RJ
 *   node scraperFoodDefinitivo.js "Av Paulista 1000" SP
 *   node scraperFoodDefinitivo.js SP --skip-ifood    (só unifica; usa ifoodLeads_SP.csv já existente)
 *   node scraperFoodDefinitivo.js SP --limit 3      (teste: só 3 estabelecimentos na unificação)
 *
 * Antes da primeira execução: node scrapeInstagram.js --login
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ADDRESSES = {
  SP: "Av Paulista 1000",
  RJ: "Avenida Engenheiro Gastão Rangel 393",
  GO: "Av Goiás 1000",
  MG: "Av Afonso Pena 1000",
  PR: "Av Sete de Setembro 1000",
  RS: "Av Borges de Medeiros 1000",
  BA: "Av Sete de Setembro 1000",
  SC: "Centro Florianópolis SC",
};

function getArgs() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const skipIfood = process.argv.includes("--skip-ifood");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
  let address, suffix;
  if (argv.length >= 2) {
    address = argv[0];
    suffix = argv[1].toUpperCase();
  } else if (argv.length === 1) {
    suffix = argv[0].toUpperCase();
    address = DEFAULT_ADDRESSES[suffix] || "Av Paulista 1000";
  } else {
    address = "Av Paulista 1000";
    suffix = "SP";
  }
  const csvPath = path.join(process.cwd(), `ifoodLeads_${suffix}.csv`);
  const unificadoPath = path.join(process.cwd(), `ifoodLeads_${suffix}_unificado.csv`);
  return { address, suffix, csvPath, unificadoPath, skipIfood, limit };
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(__dirname, script), ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

async function main() {
  const { address, suffix, csvPath, skipIfood, limit } = getArgs();

  console.log("=== Scraper definitivo – Food ===\n");
  console.log("Região:", suffix, "| Endereço base:", address);
  console.log("CSV iFood:", csvPath);
  console.log("");

  if (!skipIfood) {
    console.log("Etapa 1/2: Gerando planilha de leads do iFood...");
    try {
      await runNode("scrapeIfoodLeads.js", [address, suffix]);
    } catch (e) {
      console.error("Falha na etapa iFood:", e.message);
      process.exit(1);
    }
    console.log("");
  } else {
    try {
      await fs.access(csvPath);
    } catch {
      console.error("Arquivo não encontrado:", csvPath, "(remova --skip-ifood para gerar)");
      process.exit(1);
    }
    console.log("Pulando iFood (--skip-ifood). Usando:", csvPath);
    console.log("");
  }

  console.log("Etapa 2/2: Busca Instagram + análise completa (destaques, unidades, link externo)...");
  const unifyArgs = [csvPath];
  if (limit > 0) unifyArgs.push("--limit", String(limit));
  try {
    await runNode("unificaIfoodInstagram.js", unifyArgs);
  } catch (e) {
    console.error("Falha na unificação:", e.message);
    process.exit(1);
  }

  console.log("\n=== Concluído ===");
  console.log("Planilha unificada:", path.join(process.cwd(), `ifoodLeads_${suffix}_unificado.csv`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
