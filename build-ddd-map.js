/**
 * Gera ddd-cidades.json a partir de ddd_sp_parse.txt (SP) + DDDs por estado.
 * Rodar: node build-ddd-map.js
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function normalize(str) {
  return String(str)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const cwd = process.cwd();
const out = { cidades: {}, estados: {} };

// DDD padrão por UF (primeiro DDD do estado)
const estados = {
  AC: "68", AL: "82", AM: "92", AP: "96", BA: "71", CE: "85", DF: "61", ES: "27",
  GO: "62", MA: "98", MG: "31", MS: "67", MT: "65", PA: "91", PB: "83", PE: "81",
  PI: "86", PR: "41", RJ: "21", RN: "84", RO: "69", RR: "95", RS: "51", SC: "48",
  SE: "79", SP: "11", TO: "63",
};
out.estados = estados;

// SP: parse ddd_sp_parse.txt se existir
const spPath = join(cwd, "ddd_sp_parse.txt");
try {
  const sp = readFileSync(spPath, "utf8");
  for (const line of sp.split(/\r?\n/)) {
    const [cidade, ddd] = line.split("|").map((s) => s?.trim());
    if (cidade && ddd && /^\d{2}$/.test(ddd)) {
      out.cidades[normalize(cidade)] = ddd;
    }
  }
} catch (_) {}

// Garantir cidades que aparecem nos leads
const extras = [
  ["FLORIANOPOLIS", "48"], ["SAO JOSE DOS CAMPOS", "12"], ["SAO PAULO", "11"],
  ["RIO DE JANEIRO", "21"], ["BELO HORIZONTE", "31"], ["CURITIBA", "41"],
  ["PORTO ALEGRE", "51"], ["BRASILIA", "61"], ["SALVADOR", "71"], ["RECIFE", "81"],
  ["FORTALEZA", "85"], ["CAMPINAS", "19"], ["GUARULHOS", "11"], ["SANTOS", "13"],
];
extras.forEach(([c, d]) => { out.cidades[c] = d; });

writeFileSync(join(cwd, "ddd-cidades.json"), JSON.stringify(out, null, 0), "utf8");
console.log("ddd-cidades.json gerado. Cidades:", Object.keys(out.cidades).length, "| Estados:", Object.keys(out.estados).length);
