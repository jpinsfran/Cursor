import fs from "fs";
import path from "path";
import { homedir } from "os";

const WORKFLOW_ID = "CgRaaq7ZUEfgSO1x";

function filterSettingsForPut(settings) {
  if (!settings || typeof settings !== "object") return {};
  const keys = [
    "executionOrder",
    "executionTimeout",
    "saveDataErrorExecution",
    "saveExecutionProgress",
    "saveManualExecutions",
    "timezone",
    "errorWorkflow",
    "callerPolicy",
    "availableInMCP",
  ];
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(settings, k) && settings[k] !== undefined) {
      out[k] = settings[k];
    }
  }
  return out;
}

function loadCredentials() {
  const mcpPath = path.join(homedir(), ".cursor", "mcp.json");
  const raw = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  const env = raw?.mcpServers?.n8n?.env;
  return {
    baseUrl: String(env.N8N_API_URL).replace(/\/$/, ""),
    apiKey: String(env.N8N_API_KEY),
  };
}

const find = `## CONTRATO DE SAIDA

Sua resposta final e apenas o texto que vai para o WhatsApp do lead.
Nao escreva analise, observacao, tag, cabecalho, markdown, JSON ou instrucoes internas.
No maximo 3 a 4 linhas por resposta.
Use linguagem natural e humana, sem corporativismo.

## PRIORIDADE DE REGRAS`;

const repl = `## CONTRATO DE SAIDA

Sua resposta final e apenas o texto que vai para o WhatsApp do lead.
Nao escreva analise, observacao, tag, cabecalho, markdown, JSON ou instrucoes internas na mensagem ao lead.
No maximo 3 a 4 linhas por resposta.
Use linguagem natural e humana, sem corporativismo.

Classificacao operacional (temperatura, conversa_fase, sinais BANT em texto true ou false, motivo_perda quando aplicavel) e persistida em outbound_cadencia_sessions por um segundo estagio no n8n apos sua resposta (Classificacao sessao LLM e merge). Nao inclua JSON nem metadados na mensagem ao lead; o sistema extrai a partir da ultima mensagem do lead, do seu texto e do estado anterior da sessao.

## PRIORIDADE DE REGRAS`;

const { baseUrl, apiKey } = loadCredentials();
const headers = { "X-N8N-API-KEY": apiKey, Accept: "application/json" };

const r = await fetch(`${baseUrl}/api/v1/workflows/${WORKFLOW_ID}`, { headers });
const wf = await r.json();
const sdr = wf.nodes.find((n) => n.name === "SDR");
const sm = sdr.parameters.options.systemMessage;

if (!sm.includes(find)) {
  console.error("Bloco CONTRATO nao encontrado (workflow pode ter sido editado).");
  process.exit(1);
}
if (sm.includes("Classificacao operacional")) {
  console.log("Ja atualizado.");
  process.exit(0);
}

sdr.parameters.options.systemMessage = sm.replace(find, repl);

const putBody = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: filterSettingsForPut(wf.settings),
};

const pr = await fetch(`${baseUrl}/api/v1/workflows/${WORKFLOW_ID}`, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify(putBody),
});
const t = await pr.text();
if (!pr.ok) {
  console.error(pr.status, t.slice(0, 800));
  process.exit(1);
}
console.log("OK: CONTRATO sincronizado no nó SDR");
