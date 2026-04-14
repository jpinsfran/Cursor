/**
 * One-off: read n8n_get_workflow full JSON (stdout or file), write repo-safe workflow JSON.
 * Usage: node scripts/export-sdr-outbound-workflow.mjs < path/to/get_workflow.json
 */
import fs from "fs";
import path from "path";

const inPath = process.argv[2];
const raw = inPath
  ? fs.readFileSync(inPath, "utf8")
  : fs.readFileSync(0, "utf8");
const payload = JSON.parse(raw);
const data = payload.data ?? payload;
if (!data.nodes || !data.connections) {
  console.error("Missing data.nodes / data.connections");
  process.exit(1);
}

const CRED_PLACEHOLDERS = {
  supabaseApi: { id: "CONFIGURE_SUPABASE_CREDENTIAL_ID", name: "Supabase" },
  httpBearerAuth: { id: "CONFIGURE_HUBSPOT_BEARER_CREDENTIAL_ID", name: "HubSpot Token" },
  openAiApi: { id: "CONFIGURE_OPENAI_CREDENTIAL_ID", name: "OpenAI" },
  postgres: { id: "CONFIGURE_POSTGRES_CREDENTIAL_ID", name: "Postgres" },
};

function redactNode(node) {
  const n = { ...node };
  if (n.credentials && typeof n.credentials === "object") {
    const c = {};
    for (const [k, v] of Object.entries(n.credentials)) {
      c[k] = CRED_PLACEHOLDERS[k] ?? { id: "CONFIGURE_CREDENTIAL_ID", name: v?.name || k };
    }
    n.credentials = c;
  }
  return n;
}

const nodes = data.nodes.map(redactNode);

const staticData = { ...(data.staticData || {}) };
delete staticData["node:Cron cadência 15min"];

const out = {
  name: data.name,
  meta: {
    instanceWorkflowId: data.id,
    exportedAt: new Date().toISOString().slice(0, 10),
    notes:
      "Espelho da instância n8n.nola.com.br. Credenciais são placeholders; reassociar na importação. Schedule 45 min, timezone America/Sao_Paulo.",
  },
  nodes,
  connections: data.connections,
  settings: data.settings || { executionOrder: "v1" },
};

if (Object.keys(staticData).length) out.staticData = staticData;

const dest = path.join(process.cwd(), "workflows", "sdr-outbound-workflow.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
console.error("Wrote", dest);
