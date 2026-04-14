/**
 * Publica workflows/sdr-outbound-workflow.json na instância n8n (PUT workflow completo).
 *
 * Credenciais: N8N_API_URL e N8N_API_KEY, ou user-n8n em ~/.cursor/mcp.json
 *
 * Uso: node scripts/n8n-push-sdr-outbound-workflow.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_ID = "XolilRXoC0RzMd6E";
const WF_PATH = path.join(__dirname, "..", "workflows", "sdr-outbound-workflow.json");

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
      "Defina N8N_API_URL e N8N_API_KEY ou configure user-n8n em ~/.cursor/mcp.json"
    );
    process.exit(1);
  }
  return { baseUrl, apiKey };
}

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
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
  }
  return parsed;
}

const { baseUrl, apiKey } = loadCredentials();
const w = JSON.parse(fs.readFileSync(WF_PATH, "utf8"));

const putBody = {
  name: w.name,
  nodes: w.nodes,
  connections: w.connections,
  settings: filterSettingsForPut(w.settings),
};

const updated = await apiJson("PUT", baseUrl, apiKey, `/api/v1/workflows/${WORKFLOW_ID}`, putBody);
console.log("OK:", updated.name || WORKFLOW_ID, "| id:", updated.id || WORKFLOW_ID, "| nodes:", updated.nodes?.length);
