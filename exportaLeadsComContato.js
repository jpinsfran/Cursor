/**
 * Gera uma planilha apenas com leads que têm telefone CELULAR (e opcionalmente e-mail).
 * Considera celular: 11 dígitos (3º = 7, 8 ou 9) ou 9 dígitos começando com 7, 8 ou 9 (sem DDD no campo).
 * Normaliza números para 11 dígitos (DDD + número): infere DDD pela cidade/região (ddd-brasil.js) ou usa --ddd.
 *
 * Uso:
 *   node exportaLeadsComContato.js input.csv saida.csv   (DDD inferido por cidade/UF do CSV)
 *   node exportaLeadsComContato.js input.csv saida.csv --ddd 12   (força DDD quando inferência falhar)
 *   node exportaLeadsComContato.js input.csv saida.csv --incluir-fixo   (mantém fixo também; padrão = só celular)
 */

import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";
import { fileURLToPath } from "url";
import { getDddForRow } from "./ddd-brasil.js";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";
import { dedupeRowsByCanonicalPhone } from "./lib/dedupePhoneCsv.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function soDigitos(val) {
  return String(val ?? "").replace(/\D/g, "");
}

/**
 * Retorna true se o número é celular brasileiro (não fixo).
 * Celular: 10 ou 11 dígitos (com DDD) com 3º = 7, 8 ou 9; ou 9 dígitos (sem DDD) começando com 7, 8 ou 9.
 * O nono dígito é obrigatório no Brasil (Anatel, conclusão fev/2017), mas APIs podem retornar 10 dígitos.
 */
function ehCelular(val) {
  const digits = soDigitos(val);
  if (digits.length === 11 || digits.length === 10) {
    return digits[2] === "7" || digits[2] === "8" || digits[2] === "9";
  }
  if (digits.length === 9) {
    return digits[0] === "7" || digits[0] === "8" || digits[0] === "9";
  }
  return false;
}

/** Telefone válido (10+ dígitos). Para filtrar só celular, use ehCelular. */
function temTelefoneValido(val) {
  const digits = soDigitos(val);
  return digits.length >= 10;
}

function temEmailValido(val) {
  if (val == null || val === "") return false;
  const s = String(val).trim();
  return s !== "false" && s.length > 0 && /@/.test(s);
}

/**
 * Normaliza phone para 11 dígitos (DDD + número).
 * Se já tiver 11 dígitos, retorna só os dígitos. Se tiver 9 e ddd for informado, prependa ddd.
 */
function normalizarPhoneComDdd(phone, ddd) {
  const digits = soDigitos(phone);
  if (digits.length === 11) return digits;
  if (digits.length === 9 && ddd != null && String(ddd).replace(/\D/g, "").length >= 2) {
    const d = String(ddd).replace(/\D/g, "").slice(0, 2);
    return d + digits;
  }
  return digits.length ? digits : "";
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const incluirFixo = process.argv.includes("--incluir-fixo");
  const dddIdx = process.argv.indexOf("--ddd");
  const ddd = dddIdx !== -1 && process.argv[dddIdx + 1] ? process.argv[dddIdx + 1] : null;

  const inputPath = path.resolve(argv[0] || path.join(process.cwd(), "ifoodLeads_todos.csv"));
  const outputPath = path.resolve(
    argv[1] || path.join(path.dirname(inputPath), "ifoodLeads_com_contato.csv")
  );

  const soCelular = !incluirFixo;
  const consideraTelefone = incluirFixo ? temTelefoneValido : ehCelular;

  let content;
  try {
    content = await fs.readFile(inputPath, "utf8");
  } catch (e) {
    console.error("Erro ao ler CSV:", e.message);
    process.exit(1);
  }

  const rows = await csv({ noheader: false }).fromString(content);
  let comContato = rows.filter((r) =>
    soCelular ? ehCelular(r.phone) : consideraTelefone(r.phone) || temEmailValido(r.email)
  );

  // Normalizar phone para 11 dígitos: inferir DDD por cidade/UF (ddd-brasil) ou usar --ddd
  let comDddInferido = 0;
  let semDdd = 0;
  comContato = comContato.map((r) => {
    const row = { ...r };
    if (row.phone != null && row.phone !== "") {
      const dddUsar = getDddForRow(row, ddd);
      const antes = soDigitos(row.phone).length;
      row.phone = normalizarPhoneComDdd(row.phone, dddUsar);
      if (antes === 9) {
        if (dddUsar) comDddInferido++;
        else semDdd++;
      }
    }
    return row;
  });
  if (comDddInferido > 0 || semDdd > 0) {
    console.log(`DDD: ${comDddInferido} números de 9 dígitos com DDD (cidade/UF ou --ddd); ${semDdd} sem DDD encontrado.`);
  }
  if (ddd) console.log(`Fallback --ddd: ${ddd}`);

  comContato = normalizeLeadRows(comContato);
  comContato = dedupeRowsByCanonicalPhone(comContato);
  const csvContent = await json2csv(comContato);
  await fs.writeFile(outputPath, "\uFEFF" + csvContent, "utf8");

  console.log(`Total de linhas no arquivo: ${rows.length}`);
  console.log(`Critério: ${soCelular ? "apenas telefone CELULAR" : incluirFixo ? "telefone (fixo ou celular) ou e-mail" : "celular ou e-mail"}`);
  console.log(`Linhas na planilha: ${comContato.length}`);
  console.log(`Planilha gerada: ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
