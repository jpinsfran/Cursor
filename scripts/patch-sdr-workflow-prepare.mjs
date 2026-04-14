/**
 * Embeds workflows/sdr-outbound-prepare-touchpoint.js into workflows/sdr-outbound-workflow.json
 * for the node id code-prepare-001.
 */
import fs from "fs";
import path from "path";

const root = path.join(process.cwd());
const jsPath = path.join(root, "workflows", "sdr-outbound-prepare-touchpoint.js");
const wfPath = path.join(root, "workflows", "sdr-outbound-workflow.json");

let code = fs.readFileSync(jsPath, "utf8");
code = code.replace(/\r\n/g, "\n");
const wf = JSON.parse(fs.readFileSync(wfPath, "utf8"));
const node = wf.nodes.find((n) => n.id === "code-prepare-001");
if (!node) throw new Error("code-prepare-001 not found");
node.parameters.jsCode = code;
fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2) + "\n", "utf8");
console.error("Patched", wfPath);
