/**
 * Atualiza parameters.jsCode de um nó Code por nome (GET workflow + PUT completo).
 * Preserva demais nós, conexões e metadados retornados pela API.
 *
 * Credenciais: N8N_API_URL e N8N_API_KEY no ambiente, ou ~/.cursor/mcp.json (user-n8n.env).
 *
 * Uso: node scripts/n8n-update-code-node.mjs <workflowId> <nodeName> <path/to/code.js>
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCredentials() {
  let baseUrl = process.env.N8N_API_URL?.replace(/\/$/, "") || "";
  let apiKey = process.env.N8N_API_KEY || "";
  if (!baseUrl || !apiKey) {
    const mcpPath = path.join(homedir(), ".cursor", "mcp.json");
    try {
      const raw = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      const env =
        raw?.mcpServers?.n8n?.env ||
        raw?.mcpServers?.["user-n8n"]?.env;
      if (env?.N8N_API_URL) baseUrl = String(env.N8N_API_URL).replace(/\/$/, "");
      if (env?.N8N_API_KEY) apiKey = String(env.N8N_API_KEY);
    } catch {
      // ignore
    }
  }
  if (!baseUrl || !apiKey) {
    console.error(
      "Defina N8N_API_URL e N8N_API_KEY ou configure o servidor n8n em ~/.cursor/mcp.json"
    );
    process.exit(1);
  }
  return { baseUrl, apiKey };
}

async function apiJson(method, baseUrl, apiKey, pathname, body) {
  const url = new URL(pathname, baseUrl + "/");
  const headers = {
    "X-N8N-API-KEY": apiKey,
    Accept: "application/json",
  };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { _raw: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 1200)}`);
  }
  return parsed;
}

const workflowId = process.argv[2];
const nodeName = process.argv[3];
const codePath = process.argv[4];

if (!workflowId || !nodeName || !codePath) {
  console.error(
    "Uso: node scripts/n8n-update-code-node.mjs <workflowId> <nodeName> <path.js>"
  );
  process.exit(1);
}

const jsCode = fs.readFileSync(path.resolve(codePath), "utf8");
const { baseUrl, apiKey } = loadCredentials();

const wf = await apiJson("GET", baseUrl, apiKey, `/api/v1/workflows/${workflowId}`);
const node = wf.nodes?.find((n) => n.name === nodeName);
if (!node) {
  console.error(`Nó não encontrado: "${nodeName}"`);
  process.exit(1);
}
node.parameters = node.parameters || {};
node.parameters.jsCode = jsCode;

/**
 * A API pública PUT /workflows/:id só aceita um subconjunto de chaves em `settings`
 * (campos como binaryMode/timeSavedMode vindos do GET geram 400).
 */
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

const putBody = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: filterSettingsForPut(wf.settings),
};

const updated = await apiJson(
  "PUT",
  baseUrl,
  apiKey,
  `/api/v1/workflows/${workflowId}`,
  putBody
);
console.log(
  "OK:",
  updated.name || workflowId,
  "| node:",
  nodeName,
  "| jsCode chars:",
  jsCode.length
);
