/**
 * GET workflow AGENTE DE OUTBOUND v2, insere cadeia Classificação sessão LLM
 * (Modelo + Parser + Chain) entre Prep Classificar e Classificar Estado,
 * atualiza jsCode de Classificar Estado, PUT com settings filtrados.
 *
 * Uso: node scripts/n8n-patch-outbound-v2-classificacao.mjs
 */
import fs from "fs";
import path from "path";
import { homedir } from "os";

const WORKFLOW_ID = "CgRaaq7ZUEfgSO1x";

function loadCredentials() {
  let baseUrl = process.env.N8N_API_URL?.replace(/\/$/, "") || "";
  let apiKey = process.env.N8N_API_KEY || "";
  if (!baseUrl || !apiKey) {
    const mcpPath = path.join(homedir(), ".cursor", "mcp.json");
    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    const env = raw?.mcpServers?.n8n?.env || raw?.mcpServers?.["user-n8n"]?.env;
    if (env?.N8N_API_URL) baseUrl = String(env.N8N_API_URL).replace(/\/$/, "");
    if (env?.N8N_API_KEY) apiKey = String(env.N8N_API_KEY);
  }
  if (!baseUrl || !apiKey) {
    console.error("Credenciais n8n ausentes");
    process.exit(1);
  }
  return { baseUrl, apiKey };
}

async function apiJson(method, baseUrl, apiKey, pathname, body) {
  const url = new URL(pathname, baseUrl + "/");
  const headers = { "X-N8N-API-KEY": apiKey, Accept: "application/json" };
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 1500)}`);
  return parsed;
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

const schema = JSON.stringify(
  JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "workflows/outbound-v2-classificacao-sessao-schema.json"),
      "utf8"
    )
  )
);

const chainText =
  '={{ "Voce classifica a sessao outbound. Use APENAS evidencia nas mensagens; nao invente.\\n\\nENTRADA:\\n" + JSON.stringify({ ultima_mensagem_lead: $json.lead_mensagem, resposta_agente_whatsapp: $json.agent_output, estado_anterior: { temperatura: $json.temperatura_prev, conversa_fase: $json.conversa_fase_prev, bant_budget: $json.bant_budget_prev, bant_authority: $json.bant_authority_prev, bant_need: $json.bant_need_prev, bant_timeline: $json.bant_timeline_prev } }) + "\\n\\nRegras: temperatura quente se interesse claro ou agendamento; frio se recusa ou opt out; senao morno. conversa_fase conforme funil. bant_* true ou false conforme evidencia explicita; false se ausente. motivo_perda texto curto se frio; senao string vazia. Responda conforme o schema." }}';

const newNodes = [
  {
    id: "v2-modelo-classif",
    name: "Modelo Classificação",
    type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
    typeVersion: 1.3,
    position: [2180, -200],
    parameters: {
      model: {
        __rl: true,
        value: "gpt-4.1-mini",
        mode: "list",
        cachedResultName: "gpt-4.1-mini",
      },
      options: { temperature: 0.2 },
    },
    credentials: {
      openAiApi: { id: "50x22wdA1ZL0zF3h", name: "OpenAi account - N8N" },
    },
  },
  {
    id: "v2-parser-classif",
    name: "Parser classificação sessão",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1.3,
    position: [2240, -560],
    parameters: {
      schemaType: "manual",
      inputSchema: schema,
      autoFix: false,
    },
  },
  {
    id: "v2-chain-classif",
    name: "Classificação sessão LLM",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [2200, -400],
    parameters: {
      promptType: "define",
      text: chainText,
      hasOutputParser: true,
    },
  },
];

const mergeJs = fs.readFileSync(
  path.join(process.cwd(), "workflows/outbound-v2-merge-classificacao-ia.js"),
  "utf8"
);

const { baseUrl, apiKey } = loadCredentials();
const wf = await apiJson("GET", baseUrl, apiKey, `/api/v1/workflows/${WORKFLOW_ID}`);

const byId = new Set(wf.nodes.map((n) => n.id));
for (const nn of newNodes) {
  if (!byId.has(nn.id)) {
    wf.nodes.push(nn);
    byId.add(nn.id);
  }
}

const classificar = wf.nodes.find((n) => n.name === "Classificar Estado");
if (classificar) {
  classificar.parameters = classificar.parameters || {};
  classificar.parameters.jsCode = mergeJs;
}

const conn = wf.connections || {};

/** Prep Classificar -> Classificação sessão LLM */
if (!conn["Prep Classificar"]) conn["Prep Classificar"] = { main: [[]] };
conn["Prep Classificar"].main = [
  [
    {
      node: "Classificação sessão LLM",
      type: "main",
      index: 0,
    },
  ],
];

conn["Classificação sessão LLM"] = {
  main: [
    [
      {
        node: "Classificar Estado",
        type: "main",
        index: 0,
      },
    ],
  ],
};

conn["Modelo Classificação"] = {
  ai_languageModel: [
    [
      {
        node: "Classificação sessão LLM",
        type: "ai_languageModel",
        index: 0,
      },
    ],
  ],
};

conn["Parser classificação sessão"] = {
  ai_outputParser: [
    [
      {
        node: "Classificação sessão LLM",
        type: "ai_outputParser",
        index: 0,
      },
    ],
  ],
};

wf.connections = conn;

const putBody = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: filterSettingsForPut(wf.settings),
};

await apiJson("PUT", baseUrl, apiKey, `/api/v1/workflows/${WORKFLOW_ID}`, putBody);
console.log("OK: workflow patched, nodes:", wf.nodes.length);
