/**
 * Gera JSON de operações para AGENTE DE OUTBOUND v2: Set "Dados Lead" + Agent "SDR" systemMessage.
 * Prompt: AGENTE_OUTBOUND_V2_PROMPT_FINAL_v3_1_HIBRIDO.md (a partir de ## PAPEL E OBJETIVO)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const md = fs.readFileSync(path.join(root, "AGENTE_OUTBOUND_V2_PROMPT_FINAL_v3_1_HIBRIDO.md"), "utf8");
const lines = md.split(/\r?\n/);
const startIdx = lines.findIndex((l) => l.startsWith("## PAPEL E OBJETIVO"));
const body = startIdx >= 0 ? lines.slice(startIdx).join("\n") : md;
const systemMessage = "=" + body;

const assignmentsBase = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/n8n-agente-dados-lead-assignments.json"), "utf8")
);

const operations = [
  {
    type: "updateNode",
    nodeId: "v2-dadoslead",
    updates: { "parameters.assignments.assignments": assignmentsBase },
  },
  {
    type: "updateNode",
    nodeId: "v2-sdr",
    updates: { "parameters.options.systemMessage": systemMessage },
  },
];

const out = {
  id: "CgRaaq7ZUEfgSO1x",
  intent: "Dados Lead d1_abertura_variacao + SDR prompt v3.1 hibrido",
  operations,
};
const dest = path.join(root, "workflows", ".n8n-push-agente-ops.json");
fs.writeFileSync(dest, JSON.stringify(out), "utf8");
console.log("Wrote", dest);
