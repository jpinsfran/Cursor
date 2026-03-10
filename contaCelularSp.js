/**
 * Conta quantos números em ifoodLeads_SP.csv são celular (11 dígitos, 3º=7,8,9).
 * Uso: node contaCelularSp.js
 */
import { readFileSync } from "fs";
import { join } from "path";
import csv from "csvtojson";

const csvPath = join(process.cwd(), "ifoodLeads_SP.csv");
const content = readFileSync(csvPath, "utf8");
const rows = await csv({ noheader: false }).fromString(content);

function ehCelular(val) {
  if (val == null || val === "") return false;
  const digits = String(val).replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const primeiroDoAssinante = digits[2];
  return primeiroDoAssinante === "7" || primeiroDoAssinante === "8" || primeiroDoAssinante === "9";
}

let celular = 0;
let fixo10 = 0;
let fixo11 = 0;
let noveDig = 0;
let vazio = 0;
let outro = 0;

for (const row of rows) {
  const phone = (row.phone != null ? String(row.phone) : "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!digits.length) {
    vazio++;
    continue;
  }
  if (digits.length === 11) {
    if (ehCelular(phone)) celular++;
    else fixo11++;
    continue;
  }
  if (digits.length === 10) {
    fixo10++;
    continue;
  }
  if (digits.length === 9) {
    const primeiro = digits[0];
    if (primeiro === "7" || primeiro === "8" || primeiro === "9") {
      celular++; // 9 dígitos começando com 7/8/9 = provável celular (sem DDD no campo)
    } else {
      noveDig++;
    }
    continue;
  }
  outro++;
}

const total = rows.length;
console.log("ifoodLeads_SP.csv — Análise da coluna phone\n");
console.log("Total de linhas (leads):", total);
console.log("---");
console.log("Celular (11 dígitos, 3º = 7, 8 ou 9):", celular, `(${(100 * celular / total).toFixed(1)}%)`);
console.log("  (inclui 9 dígitos que começam com 7/8/9 = celular sem DDD no campo)");
console.log("Fixo (10 dígitos):", fixo10);
console.log("11 dígitos mas 3º = 2–6 (fixo):", fixo11);
console.log("9 dígitos que não são 7/8/9 (fixo ou indefinido):", noveDig);
console.log("Vazio:", vazio);
console.log("Outro formato:", outro);
console.log("---");
console.log("Resumo: celular =", celular, "| fixo/outros =", total - celular);
