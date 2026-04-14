/**
 * Uso: node scripts/apply-n8n-metrics-mcp.cjs
 * Lê _n8n_mcp_apply_compact.json e imprime instrução (o MCP é aplicado pelo agente via call_mcp_tool).
 * Ou: importe o JSON no n8n manualmente se necessário.
 */
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "_n8n_mcp_apply_compact.json");
const o = JSON.parse(fs.readFileSync(p, "utf8"));
console.log("OK payload", p, "bytes", Buffer.byteLength(JSON.stringify(o)));
console.log("id", o.id, "ops", o.operations.length);
