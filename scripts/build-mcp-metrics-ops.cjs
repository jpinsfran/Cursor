const fs = require("fs");
const path = require("path");

const wfPath = path.join(__dirname, "..", "workflows", "metrics-aggregator-workflow.json");
const j = JSON.parse(fs.readFileSync(wfPath, "utf8"));
let code = j.nodes.find((n) => n.id === "ma-agregar").parameters.jsCode;
code = code.replace(/\$\('Calcular Período'\)/g, "$('Calcular Periodo')");

// Texto atual no n8n (Agregador 95QTb55ZLM0r0AIe) — patch cirúrgico
const findNotify =
  "D1_WA por variacao: V1={{ $json.summary.d1_wa_variacoes.v1 }} V2={{ $json.summary.d1_wa_variacoes.v2 }} V3={{ $json.summary.d1_wa_variacoes.v3 }} sem={{ $json.summary.d1_wa_variacoes.sem_variacao }}";

const replaceNotify =
  "D1_WA — taxa resposta por variacao:\n{{ $json.summary.variacoes_d1_wa_texto }}";

const ops = {
  id: "95QTb55ZLM0r0AIe",
  intent: "D1_WA: taxa resposta por variacao no resumo + jsCode alinhado à view SQL",
  operations: [
    {
      type: "updateNode",
      nodeId: "ma-agregar",
      updates: { "parameters.jsCode": code },
    },
    {
      type: "patchNodeField",
      nodeId: "ma-notify",
      fieldPath: "parameters.bodyParameters.parameters.1.value",
      patches: [{ find: findNotify, replace: replaceNotify }],
    },
  ],
};

const outPath = path.join(__dirname, "..", "mcp-metrics-ops.json");
fs.writeFileSync(outPath, JSON.stringify(ops));
console.log("Wrote", outPath, "jsCode length", code.length);
