import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wf = path.join(__dirname, "metrics-aggregator-workflow.json");
const j = JSON.parse(fs.readFileSync(wf, "utf8"));

const datesCode = fs.readFileSync(path.join(__dirname, "calcular-periodo-metricas.js"), "utf8");
const agregarCode = fs.readFileSync(path.join(__dirname, "agregar-metricas-code.js"), "utf8");

const maDates = j.nodes.find((n) => n.id === "ma-dates");
maDates.parameters.jsCode = datesCode;
maDates.parameters.mode = "runOnceForAllItems";

const maAgregar = j.nodes.find((n) => n.id === "ma-agregar");
maAgregar.parameters.jsCode = agregarCode;
maAgregar.parameters.mode = "runOnceForAllItems";

fs.writeFileSync(wf, JSON.stringify(j, null, 2), "utf8");
console.log("Updated", wf);
