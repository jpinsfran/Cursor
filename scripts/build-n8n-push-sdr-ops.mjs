/**
 * Gera JSON de operações para n8n_update_partial_workflow (SDR Outbound).
 * Uso: node scripts/build-n8n-push-sdr-ops.mjs > /tmp/sdr-ops.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const prep = fs.readFileSync(path.join(root, "workflows/sdr-outbound-prepare-touchpoint.js"), "utf8");
const filt = fs.readFileSync(path.join(root, "workflows/sdr-outbound-filtrar-vencidos.js"), "utf8");
const d1 = fs.readFileSync(path.join(root, "workflows/sdr-outbound-d1-wa-variacao.js"), "utf8");

const fieldValues = [
  { fieldId: "proximo_touchpoint_id", fieldValue: "={{ $('Preparar touchpoint').item.json.proximo_touchpoint_id }}" },
  { fieldId: "proximo_envio_at", fieldValue: "={{ $('Preparar touchpoint').item.json.proximo_envio_at }}" },
  { fieldId: "status", fieldValue: "={{ $('Preparar touchpoint').item.json.status_final }}" },
  { fieldId: "ultimo_touchpoint_id", fieldValue: "={{ $('Preparar touchpoint').item.json.touchpoint_id }}" },
  { fieldId: "ultima_outbound_at", fieldValue: "={{ $now.toISO() }}" },
  { fieldId: "reforco_1h_enviado_at", fieldValue: "={{ $('Preparar touchpoint').item.json.patch_reforco_1h_at }}" },
  { fieldId: "followup_d1_9h_enviado_at", fieldValue: "={{ $('Preparar touchpoint').item.json.patch_followup_d1_9h_at }}" },
  {
    fieldId: "d1_abertura_variacao",
    fieldValue:
      "={{ $('Preparar touchpoint').item.json.touchpoint_id === 'D1_WA' && $('D1 WA variacao').item.json.abertura_variacao != null ? $('D1 WA variacao').item.json.abertura_variacao : $('Preparar touchpoint').item.json.d1_abertura_variacao }}",
  },
];

const operations = [
  { type: "updateNode", nodeId: "code-filter-due-001", updates: { "parameters.jsCode": filt } },
  { type: "updateNode", nodeId: "code-prepare-001", updates: { "parameters.jsCode": prep } },
  { type: "updateNode", nodeId: "code-d1-wa-var-001", updates: { "parameters.jsCode": d1 } },
  {
    type: "updateNode",
    nodeId: "supa-update-session-001",
    updates: { "parameters.fieldsUi.fieldValues": fieldValues },
  },
];

const out = {
  id: "XolilRXoC0RzMd6E",
  intent: "Sync SDR Outbound code + d1_abertura_variacao session field",
  operations,
};
const dest = path.join(root, "workflows", ".n8n-push-sdr-ops.json");
fs.writeFileSync(dest, JSON.stringify(out), "utf8");
console.log("Wrote", dest);
