/**
 * Gera workflows/.n8n-sdr-code-push.json para n8n_update_partial_workflow / scripts/n8nPushPartialFromFile.mjs
 * a partir de workflows/sdr-outbound-workflow.json (após sync-sdr-outbound-workflow.cjs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const wfPath = path.join(root, 'workflows', 'sdr-outbound-workflow.json');
const w = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const wfId = w.meta?.instanceWorkflowId || 'XolilRXoC0RzMd6E';
const names = ['Filtrar vencidos', 'Preparar touchpoint', 'Claim dispatch lease'];
const operations = [];
for (const name of names) {
  const n = w.nodes.find((x) => x.name === name);
  if (!n?.parameters?.jsCode) {
    throw new Error(`Node ${name} not found or no jsCode`);
  }
  operations.push({
    type: 'updateNode',
    nodeId: n.id,
    updates: { 'parameters.jsCode': n.parameters.jsCode },
  });
}
const out = { id: wfId, intent: 'SDR code nodes anti-rajada', operations };
const dest = path.join(root, 'workflows', '.n8n-sdr-code-push.json');
fs.writeFileSync(dest, JSON.stringify(out), 'utf8');
console.log('Wrote', dest, 'ops=', operations.length);
