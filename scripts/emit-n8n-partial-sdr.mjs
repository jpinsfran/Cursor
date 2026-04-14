import fs from "fs";
import path from "path";

const root = process.cwd();
const prep = fs.readFileSync(path.join(root, "workflows", "sdr-outbound-prepare-touchpoint.js"), "utf8").replace(/\r\n/g, "\n");
const wf = JSON.parse(fs.readFileSync(path.join(root, "workflows", "sdr-outbound-workflow.json"), "utf8"));

const filtNode = wf.nodes.find((n) => n.name === "Filtrar vencidos");
const filt = filtNode.parameters.jsCode;

const gerar = wf.nodes.find((n) => n.name === "Gerar Msg");
const systemMessage = gerar.parameters.options.systemMessage;

const supUp = wf.nodes.find((n) => n.id === "supa-update-session-001");
const supEv = wf.nodes.find((n) => n.id === "supa-insert-event-001");

const operations = [
  { type: "updateNode", nodeId: "code-prepare-001", updates: { "parameters.jsCode": prep } },
  { type: "updateNode", nodeId: "code-filter-due-001", updates: { "parameters.jsCode": filt } },
  {
    type: "updateNode",
    nodeId: "supa-update-session-001",
    updates: { "parameters.fieldsUi.fieldValues": supUp.parameters.fieldsUi.fieldValues },
  },
  {
    type: "updateNode",
    nodeId: "supa-insert-event-001",
    updates: { "parameters.fieldsUi.fieldValues": supEv.parameters.fieldsUi.fieldValues },
  },
  {
    type: "updateNode",
    nodeId: "db20f3fb-5e88-4f56-a951-723786079d0d",
    updates: { "parameters.options.systemMessage": systemMessage },
  },
];

fs.writeFileSync(path.join(root, "_n8n_sdr_partial_ops.json"), JSON.stringify(operations), "utf8");
console.log("Wrote _n8n_sdr_partial_ops.json", operations.length, "ops");
