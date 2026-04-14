/**
 * Aplica payloads gerados para n8n_update_partial_workflow (updateNode) via API REST.
 * Credenciais: ~/.cursor/mcp.json → mcpServers.n8n.env (N8N_API_URL, N8N_API_KEY).
 * Uso: node scripts/n8nPushPartialFromFile.mjs workflows/_payload_mcp_b.json
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const WEBHOOK_NODE_TYPES = new Set([
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.webhookTrigger',
  'n8n-nodes-base.formTrigger',
  '@n8n/n8n-nodes-langchain.chatTrigger',
]);

function ensureWebhookIds(nodes) {
  if (!nodes) return;
  for (const node of nodes) {
    if (WEBHOOK_NODE_TYPES.has(node.type) && !node.webhookId) {
      node.webhookId = crypto.randomUUID();
    }
  }
}

function cleanWorkflowForUpdate(workflow) {
  const {
    id: _id,
    createdAt,
    updatedAt,
    versionId,
    versionCounter,
    meta,
    staticData,
    pinData,
    tags,
    description,
    isArchived,
    usedCredentials,
    sharedWithProjects,
    triggerCount,
    shared,
    active,
    activeVersionId,
    activeVersion,
    ...cleanedWorkflow
  } = workflow;
  const ALL_KNOWN_SETTINGS_PROPERTIES = new Set([
    'saveExecutionProgress',
    'saveManualExecutions',
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'executionTimeout',
    'errorWorkflow',
    'timezone',
    'executionOrder',
    'callerPolicy',
    'callerIds',
    'timeSavedPerExecution',
    'availableInMCP',
  ]);
  if (cleanedWorkflow.settings && typeof cleanedWorkflow.settings === 'object') {
    const filteredSettings = {};
    for (const [key, value] of Object.entries(cleanedWorkflow.settings)) {
      if (ALL_KNOWN_SETTINGS_PROPERTIES.has(key)) {
        filteredSettings[key] = value;
      }
    }
    if (Object.keys(filteredSettings).length > 0) {
      cleanedWorkflow.settings = filteredSettings;
    } else {
      cleanedWorkflow.settings = { executionOrder: 'v1' };
    }
  } else {
    cleanedWorkflow.settings = { executionOrder: 'v1' };
  }
  ensureWebhookIds(cleanedWorkflow.nodes);
  return cleanedWorkflow;
}

const DANGEROUS_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Mesma semântica do n8n-mcp updateNode: chaves como "parameters.jsCode" viram caminho aninhado. */
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  if (keys.some((k) => DANGEROUS_PATH_KEYS.has(k))) {
    throw new Error(`Caminho inválido: ${path}`);
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      !Object.prototype.hasOwnProperty.call(current, key) ||
      typeof current[key] !== 'object' ||
      current[key] === null
    ) {
      if (value === null) return;
      current[key] = {};
    }
    current = current[key];
  }
  const finalKey = keys[keys.length - 1];
  if (value === null) {
    delete current[finalKey];
  } else {
    current[finalKey] = value;
  }
}

function applyUpdateNode(node, updates) {
  for (const [path, value] of Object.entries(updates)) {
    setNestedProperty(node, path, value);
  }
}

function loadN8nEnv() {
  const p = path.join(os.homedir(), '.cursor', 'mcp.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Arquivo não encontrado: ${p}`);
  }
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const env = cfg.mcpServers?.n8n?.env;
  if (!env?.N8N_API_URL || !env?.N8N_API_KEY) {
    throw new Error('mcpServers.n8n.env (N8N_API_URL, N8N_API_KEY) ausente em ~/.cursor/mcp.json');
  }
  const base = String(env.N8N_API_URL).replace(/\/$/, '');
  const apiUrl = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return { apiUrl, apiKey: env.N8N_API_KEY };
}

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    console.error('Uso: node scripts/n8nPushPartialFromFile.mjs <payload.json>');
    process.exit(1);
  }
  const abs = path.isAbsolute(payloadPath) ? payloadPath : path.join(process.cwd(), payloadPath);
  const { id, operations } = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!id || !Array.isArray(operations)) {
    throw new Error('Payload precisa ter id e operations[]');
  }
  const { apiUrl, apiKey } = loadN8nEnv();
  const headers = {
    'X-N8N-API-KEY': apiKey,
    'Content-Type': 'application/json',
  };

  const getRes = await fetch(`${apiUrl}/workflows/${id}`, { headers });
  const getText = await getRes.text();
  if (!getRes.ok) {
    throw new Error(`GET workflow ${getRes.status}: ${getText.slice(0, 400)}`);
  }
  const workflow = JSON.parse(getText);

  for (const op of operations) {
    if (op.type !== 'updateNode') {
      throw new Error(`Operação não suportada: ${op.type} (só updateNode)`);
    }
    const idx = workflow.nodes.findIndex((n) => n.id === op.nodeId);
    if (idx === -1) {
      throw new Error(`Node id não encontrado: ${op.nodeId}`);
    }
    applyUpdateNode(workflow.nodes[idx], op.updates);
  }

  const cleaned = cleanWorkflowForUpdate(workflow);
  const putRes = await fetch(`${apiUrl}/workflows/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(cleaned),
  });
  const putText = await putRes.text();
  if (!putRes.ok) {
    throw new Error(`PUT workflow ${putRes.status}: ${putText.slice(0, 800)}`);
  }
  const data = JSON.parse(putText);
  console.log(JSON.stringify({ ok: true, workflowId: id, name: data.name, updatedAt: data.updatedAt }, null, 0));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
