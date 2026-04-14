import fs from "fs";
import path from "path";

const root = path.join(process.cwd());
const wf = JSON.parse(fs.readFileSync(path.join(root, "workflows", "sdr-outbound-workflow.json"), "utf8"));
const payload = {
  id: wf.meta.instanceWorkflowId,
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
};
if (wf.staticData) payload.staticData = wf.staticData;
fs.writeFileSync(path.join(root, "_n8n_sdr_full_update.json"), JSON.stringify(payload), "utf8");
console.log("Wrote _n8n_sdr_full_update.json", Buffer.byteLength(JSON.stringify(payload), "utf8"), "bytes");
