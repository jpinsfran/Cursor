import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wfPath = path.join(__dirname, "sdr-outbound-workflow.json");

const prepareCode = fs.readFileSync(path.join(__dirname, "sdr-outbound-prepare-touchpoint.js"), "utf8");
const filterCode = fs.readFileSync(path.join(__dirname, "sdr-outbound-filtrar-vencidos.js"), "utf8");

const j = JSON.parse(fs.readFileSync(wfPath, "utf8"));

const prep = j.nodes.find((n) => n.id === "code-prepare-001");
if (!prep) throw new Error("code-prepare-001 not found");
prep.parameters.jsCode = prepareCode;

const filt = j.nodes.find((n) => n.id === "code-filter-due-001");
if (!filt) throw new Error("code-filter-due-001 not found");
filt.parameters.jsCode = filterCode;

const trig = j.nodes.find((n) => n.id === "trig-schedule-001");
if (trig?.parameters?.rule?.interval?.[0]) {
  trig.parameters.rule.interval[0].minutesInterval = 15;
}
if (trig) trig.name = "Cron cadência 15min";

j.meta = j.meta || {};
j.meta.notes =
  "Cron 15 min (ajustável). Cadência: próximo envio por dia relativo SP + 72h mínimo entre envios; Filtrar vencidos não usa mais proximoOk OR reforcoDue sem gap.";

fs.writeFileSync(wfPath, JSON.stringify(j, null, 2), "utf8");
console.log("Embedded prepare + filter; cron set to 15 min:", wfPath);
