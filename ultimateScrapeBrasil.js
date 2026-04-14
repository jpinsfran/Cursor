import "dotenv/config";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(process.cwd(), "ultimate-scrape-state.json");
const CSV_SUFFIX = "todos";
const CSV_TODOS = path.join(process.cwd(), "ifoodLeads_todos.csv");
const CSV_CONTATO = path.join(process.cwd(), "ifoodLeads_todos_com_contato.csv");
const CSV_UNIFICADO = path.join(process.cwd(), "ifoodLeads_todos_com_contato_unificado.csv");
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function parseArgs() {
  return {
    reset: process.argv.includes("--reset"),
    onlyScrape: process.argv.includes("--only-scrape"),
    skipScrape: process.argv.includes("--skip-scrape"),
    skipStage2: process.argv.includes("--skip-stage-2"),
    skipStage3: process.argv.includes("--skip-stage-3"),
    useFixedOrder: process.argv.includes("--use-fixed-uf-order"),
  };
}

function readState() {
  if (!existsSync(STATE_PATH)) {
    return {
      nextUfIndex: 0,
      stage1Done: false,
      stage2Done: false,
      stage3Done: false,
      failedUfs: [],
      ufOrder: null,
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {
      nextUfIndex: 0,
      stage1Done: false,
      stage2Done: false,
      stage3Done: false,
      failedUfs: [],
      ufOrder: null,
      updatedAt: new Date().toISOString(),
    };
  }
}

function writeState(state) {
  // Compatibilidade retroativa com estado antigo.
  if (typeof state.scrapeDone === "boolean" && typeof state.stage1Done !== "boolean") state.stage1Done = state.scrapeDone;
  if (typeof state.pipelineDone === "boolean" && typeof state.stage3Done !== "boolean") state.stage3Done = state.pipelineDone;
  if (typeof state.stage2Done !== "boolean") state.stage2Done = false;
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function runNode(scriptName, args) {
  return spawnSync("node", [path.join(__dirname, scriptName), ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: false,
  });
}

async function fetchUfOrderFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("relevant_addresses")
    .select("uf")
    .eq("is_active", true);
  if (error || !data?.length) return null;

  const counts = {};
  for (const row of data) {
    const uf = (row.uf || "").toUpperCase();
    if (!uf) continue;
    counts[uf] = (counts[uf] || 0) + 1;
  }
  const ordered = [...UFS].sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b));
  return { ordered, counts };
}

async function resolveUfOrder(state, useFixedOrder) {
  if (Array.isArray(state.ufOrder) && state.ufOrder.length === UFS.length) {
    return state.ufOrder;
  }
  if (useFixedOrder) {
    state.ufOrder = [...UFS];
    writeState(state);
    return state.ufOrder;
  }
  if (state.nextUfIndex > 0) {
    // Mantém ordem antiga para não bagunçar retomada já iniciada.
    state.ufOrder = [...UFS];
    writeState(state);
    return state.ufOrder;
  }

  const fromSupabase = await fetchUfOrderFromSupabase();
  if (!fromSupabase) {
    state.ufOrder = [...UFS];
    writeState(state);
    return state.ufOrder;
  }

  state.ufOrder = fromSupabase.ordered;
  writeState(state);
  console.log("[ultimate] Ordem de UFs por volume no Supabase:", fromSupabase.ordered.join(", "));
  return state.ufOrder;
}

function runStage1Scrape(state, ufOrder) {
  if (state.stage1Done) {
    console.log("[ultimate] Fase 1 (scrape -> ifood_estabelecimentos) já concluída. Pulando.");
    return state;
  }

  for (let i = state.nextUfIndex; i < ufOrder.length; i++) {
    const uf = ufOrder[i];
    console.log(`\n[ultimate] Scrape UF ${uf} (${i + 1}/${ufOrder.length}) -> ifoodLeads_${CSV_SUFFIX}.csv`);

    const result = runNode("run-scrapes-estado.js", [uf, "--csv-suffix", CSV_SUFFIX]);
    if (result.status !== 0) {
      if (!state.failedUfs.includes(uf)) state.failedUfs.push(uf);
      console.warn(`[ultimate] UF ${uf} finalizou com falha (exit ${result.status}). Continuando...`);
    }

    state.nextUfIndex = i + 1;
    writeState(state);
  }

  state.stage1Done = true;
  writeState(state);
  return state;
}

function ensureCsvExists(filePath, label) {
  if (!existsSync(filePath)) {
    console.error(`[ultimate] ${label} não encontrado: ${filePath}`);
    return false;
  }
  return true;
}

function runStage2Qualificados(state) {
  if (state.stage2Done) {
    console.log("[ultimate] Fase 2 (qualificados -> leads_qualificados) já concluída. Pulando.");
    return state;
  }
  if (!state.stage1Done) {
    console.log("[ultimate] Fase 1 ainda não concluída. Não é possível executar a Fase 2.");
    return state;
  }
  if (!ensureCsvExists(CSV_TODOS, "CSV base")) return state;

  console.log("\n[ultimate] Fase 2/3: Atualizar contato por CNPJ (sem sync)...");
  let result = runNode("atualizaTelefonePorCnpj.js", [CSV_TODOS, "--no-sync"]);
  if (result.status !== 0) {
    console.error("[ultimate] Falha na atualização por CNPJ. Rode novamente para retomar.");
    return state;
  }

  console.log("[ultimate] Fase 2/3: Exportar base com contato...");
  result = runNode("exportaLeadsComContato.js", [CSV_TODOS, CSV_CONTATO]);
  if (result.status !== 0) {
    console.error("[ultimate] Falha ao exportar base com contato. Rode novamente para retomar.");
    return state;
  }

  console.log("[ultimate] Fase 2/3: Sync somente qualificados...");
  result = runNode("syncLeadsToSupabase.js", [CSV_CONTATO, "--only-qual"]);
  if (result.status !== 0) {
    console.error("[ultimate] Falha no sync de qualificados. Rode novamente para retomar.");
    return state;
  }

  state.stage2Done = true;
  writeState(state);
  return state;
}

function runStage3Perfil(state) {
  if (state.stage3Done) {
    console.log("[ultimate] Fase 3 (perfil -> leads_perfil) já concluída. Pulando.");
    return state;
  }
  if (!state.stage2Done) {
    console.log("[ultimate] Fase 2 ainda não concluída. Não é possível executar a Fase 3.");
    return state;
  }
  if (!ensureCsvExists(CSV_CONTATO, "CSV com contato")) {
    return state;
  }

  console.log("\n[ultimate] Fase 3/3: Unificar Instagram (sem sync)...");
  let result = runNode("unificaIfoodInstagram.js", [CSV_CONTATO, "--resume", "--no-sync"]);
  if (result.status !== 0) {
    console.error("[ultimate] Falha na unificação Instagram. Rode novamente para retomar.");
    return state;
  }
  if (!ensureCsvExists(CSV_UNIFICADO, "CSV unificado")) {
    return state;
  }

  console.log("[ultimate] Fase 3/3: Sync somente perfil...");
  result = runNode("syncLeadsToSupabase.js", [CSV_UNIFICADO, "--only-perfil"]);
  if (result.status !== 0) {
    console.error("[ultimate] Falha no sync de perfil. Rode novamente para retomar.");
    return state;
  }

  state.stage3Done = true;
  writeState(state);
  return state;
}

async function main() {
  const { reset, onlyScrape, skipScrape, skipStage2, skipStage3, useFixedOrder } = parseArgs();
  if (reset && existsSync(STATE_PATH)) {
    unlinkSync(STATE_PATH);
    console.log("[ultimate] Estado anterior removido (--reset).");
  }

  let state = readState();
  writeState(state);
  const ufOrder = await resolveUfOrder(state, useFixedOrder);

  console.log("[ultimate] Estado atual:");
  console.log(`- nextUfIndex: ${state.nextUfIndex}/${ufOrder.length}`);
  console.log(`- stage1Done: ${state.stage1Done}`);
  console.log(`- stage2Done: ${state.stage2Done}`);
  console.log(`- stage3Done: ${state.stage3Done}`);
  console.log(`- failedUfs: ${state.failedUfs.join(", ") || "(nenhuma)"}`);
  console.log(`- ufOrder: ${ufOrder.join(", ")}`);
  console.log(`- stateFile: ${STATE_PATH}`);

  if (!skipScrape) {
    state = runStage1Scrape(state, ufOrder);
  } else {
    console.log("[ultimate] Fase 1 pulada (--skip-scrape).");
  }

  if (onlyScrape) {
    console.log("[ultimate] Somente Fase 1 executada (--only-scrape).");
    console.log("\n[ultimate] Concluído.");
    return;
  }

  if (!skipStage2) {
    state = runStage2Qualificados(state);
  } else {
    console.log("[ultimate] Fase 2 pulada (--skip-stage-2).");
  }

  if (!skipStage3) {
    state = runStage3Perfil(state);
  } else {
    console.log("[ultimate] Fase 3 pulada (--skip-stage-3).");
  }

  console.log("\n[ultimate] Concluído.");
  if (state.stage3Done) {
    console.log("[ultimate] Planilha final:", CSV_UNIFICADO);
  } else {
    console.log("[ultimate] Há fases pendentes. Rode novamente para retomar do ponto salvo.");
  }
}

main().catch((err) => {
  console.error("[ultimate] Erro:", err.message);
  process.exit(1);
});
