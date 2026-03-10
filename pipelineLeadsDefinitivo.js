/**
 * PIPELINE LEADS DEFINITIVO – Um comando para o fluxo completo
 *
 * Executa em sequência:
 *  1) Scrape iFood (ou usa CSV existente)
 *  2) Atualiza telefones/email por CNPJ (Brasil API)
 *  3) Filtra apenas leads com telefone/e-mail válido
 *  4) Unifica com Instagram (busca perfil + análise completa)
 *
 * Saída final: uma única planilha → ifoodLeads_<sufixo>_com_contato_unificado.csv
 *
 * Uso:
 *   node pipelineLeadsDefinitivo.js SP
 *   node pipelineLeadsDefinitivo.js RJ
 *   node pipelineLeadsDefinitivo.js "Av Paulista 1000" SP
 *   node pipelineLeadsDefinitivo.js SP --skip-ifood   (pula etapa 1; usa ifoodLeads_SP.csv existente)
 *   node pipelineLeadsDefinitivo.js --from-todos      (usa ifoodLeads_todos.csv; só etapas 2, 3, 4)
 *   node pipelineLeadsDefinitivo.js SP --limit 5     (teste: limita unificação Instagram a 5 linhas)
 *   node pipelineLeadsDefinitivo.js "São José dos Campos" SP --ddd 12   (opcional: fallback DDD se inferência por cidade falhar)
 *
 * Pré-requisito: node scrapeInstagram.js --login (uma vez)
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
  const fromTodos = process.argv.includes("--from-todos");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
  const dddIdx = process.argv.indexOf("--ddd");
  const ddd = dddIdx !== -1 && process.argv[dddIdx + 1] ? process.argv[dddIdx + 1] : null;

  let address, suffix, csvPath, comContatoPath;

  if (fromTodos) {
    suffix = "todos";
    address = null;
    csvPath = path.join(process.cwd(), "ifoodLeads_todos.csv");
    comContatoPath = path.join(process.cwd(), "ifoodLeads_todos_com_contato.csv");
  } else {
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
    csvPath = path.join(process.cwd(), `ifoodLeads_${suffix}.csv`);
    comContatoPath = path.join(process.cwd(), `ifoodLeads_${suffix}_com_contato.csv`);
  }

  const unificadoPath = comContatoPath.replace(/(\.csv)?$/i, "_unificado.csv");
  return { address, suffix, csvPath, comContatoPath, unificadoPath, skipIfood, fromTodos, limit, ddd };
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
  const { address, suffix, csvPath, comContatoPath, unificadoPath, skipIfood, fromTodos, limit, ddd } = getArgs();

  console.log("=== Pipeline Leads Definitivo ===\n");
  if (fromTodos) {
    console.log("Modo: base ifoodLeads_todos.csv (etapas 2 → 3 → 4)");
  } else {
    console.log("Região:", suffix, "| Endereço base:", address || "N/A");
  }
  console.log("CSV iFood:", csvPath);
  console.log("Com contato:", comContatoPath);
  console.log("Planilha definitiva:", unificadoPath);
  console.log("");

  if (!fromTodos && !skipIfood) {
    console.log("Etapa 1/4: Gerando planilha de leads do iFood...");
    try {
      await runNode("scrapeIfoodLeads.js", [address, suffix]);
    } catch (e) {
      console.error("Falha na etapa iFood:", e.message);
      process.exit(1);
    }
    console.log("");
  } else if (fromTodos || skipIfood) {
    try {
      await fs.access(csvPath);
    } catch {
      console.error("Arquivo não encontrado:", csvPath, fromTodos ? "(gere/concatene antes)" : "(remova --skip-ifood para gerar)");
      process.exit(1);
    }
    if (fromTodos) {
      console.log("Etapa 1: Pulada (--from-todos). Usando", csvPath);
    } else {
      console.log("Etapa 1: Pulada (--skip-ifood). Usando", csvPath);
    }
    console.log("");
  }

  console.log("Etapa 2/4: Atualizando telefones/e-mail por CNPJ (Brasil API)...");
  try {
    await runNode("atualizaTelefonePorCnpj.js", [csvPath]);
  } catch (e) {
    console.error("Falha na atualização por CNPJ:", e.message);
    process.exit(1);
  }
  console.log("");

  console.log("Etapa 3/4: Filtrando apenas leads com telefone CELULAR (DDD inferido por cidade/região)...");
  const exportArgs = [csvPath, comContatoPath];
  if (ddd) exportArgs.push("--ddd", ddd);
  try {
    await runNode("exportaLeadsComContato.js", exportArgs);
  } catch (e) {
    console.error("Falha ao filtrar com contato:", e.message);
    process.exit(1);
  }
  console.log("");

  console.log("Etapa 4/4: Busca Instagram + análise completa (destaques, unidades, link externo)...");
  const unifyArgs = [comContatoPath];
  if (limit > 0) unifyArgs.push("--limit", String(limit));
  try {
    await runNode("unificaIfoodInstagram.js", unifyArgs);
  } catch (e) {
    console.error("Falha na unificação Instagram:", e.message);
    process.exit(1);
  }

  console.log("\n=== Concluído ===");
  console.log("Planilha definitiva:", unificadoPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
