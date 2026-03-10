/**
 * Atualiza as colunas phone e email do CSV de leads iFood usando CNPJ.
 * 1) Brasil API (Receita); 2) se vazio ou só fixo, tenta OpenCNPJ como fallback.
 * Só grava phone quando for CELULAR (ou fixo com --incluir-fixo). Ver PLANO_ALTERNATIVO_TELEFONE.md.
 *
 * Uso:
 *   node atualizaTelefonePorCnpj.js [arquivo.csv]
 *   node atualizaTelefonePorCnpj.js ifoodLeads_todos.csv --limit 10
 *   node atualizaTelefonePorCnpj.js ifoodLeads_todos.csv --dry-run
 *   node atualizaTelefonePorCnpj.js ifoodLeads_todos.csv --incluir-fixo
 *   node atualizaTelefonePorCnpj.js ifoodLeads_todos.csv --skip-opencnpj   (não usa fallback OpenCNPJ)
 */

import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";
const OPENCNPJ_URL = "https://kitana.opencnpj.com/cnpj";
const DELAY_MS = 800;
const DELAY_OPENCNPJ_MS = 700;
const FETCH_TIMEOUT_MS = 12000;

function normalizeCnpj(str) {
  const digits = String(str || "").replace(/\D/g, "").slice(0, 14);
  return digits.length === 14 ? digits : "";
}

function phoneFromApi(dddTelefone) {
  if (!dddTelefone || typeof dddTelefone !== "string") return "";
  const digits = String(dddTelefone).replace(/\D/g, "").trim();
  if (digits.length < 10) return "";
  if (/^0+$/.test(digits)) return "";
  return digits;
}

/** True se número é celular brasileiro (não fixo): 11 dígitos e 3º dígito = 7, 8 ou 9 (bandas móveis). */
function ehCelular(digits) {
  if (!digits || typeof digits !== "string") return false;
  const d = String(digits).replace(/\D/g, "");
  if (d.length !== 11) return false;
  const primeiroDoAssinante = d[2];
  return primeiroDoAssinante === "7" || primeiroDoAssinante === "8" || primeiroDoAssinante === "9";
}

function emailFromApi(val) {
  if (!val || typeof val !== "string") return "";
  const email = val.trim();
  return email && /@/.test(email) ? email : "";
}

/** Retorna { phone, email } a partir da resposta da Brasil API (apenas dados da fonte). */
async function fetchDadosCnpj(cnpj) {
  const digits = normalizeCnpj(cnpj);
  if (!digits) return { phone: "", email: "" };

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NolaScript/1.0)" },
        signal: controller.signal,
      });
      clearTimeout(to);
      if (res.status === 404 || res.status === 400) return { phone: "", email: "" };
      if (!res.ok) return { phone: "", email: "" };
      const data = await res.json();
      const raw1 = (data.ddd_telefone_1 != null && data.ddd_telefone_1 !== "") ? String(data.ddd_telefone_1) : "";
      const raw2 = (data.ddd_telefone_2 != null && data.ddd_telefone_2 !== "") ? String(data.ddd_telefone_2) : "";
      const phone = phoneFromApi(raw1) || phoneFromApi(raw2) || "";
      const email = emailFromApi(data.email || "");
      return { phone, email };
    } finally {
      clearTimeout(to);
    }
  } catch (_) {
    return { phone: "", email: "" };
  }
}

/** Fallback: OpenCNPJ. Retorna { phone, email } a partir de data.telefone e data.email. */
async function fetchOpenCNPJ(cnpj) {
  const digits = normalizeCnpj(cnpj);
  if (!digits) return { phone: "", email: "" };

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${OPENCNPJ_URL}/${digits}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NolaScript/1.0)" },
        signal: controller.signal,
      });
      clearTimeout(to);
      if (!res.ok) return { phone: "", email: "" };
      const json = await res.json();
      const data = json?.data ?? json;
      const rawPhone = (data?.telefone != null && data.telefone !== "") ? String(data.telefone) : "";
      const phone = phoneFromApi(rawPhone);
      const email = emailFromApi(data?.email ?? "");
      return { phone, email };
    } finally {
      clearTimeout(to);
    }
  } catch (_) {
    return { phone: "", email: "" };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const incluirFixo = process.argv.includes("--incluir-fixo");
  const skipOpenCNPJ = process.argv.includes("--skip-opencnpj");
  const csvPath = path.resolve(argv[0] || path.join(process.cwd(), "ifoodLeads_todos.csv"));
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
  const dryRun = process.argv.includes("--dry-run");

  let content;
  try {
    content = await fs.readFile(csvPath, "utf8");
  } catch (e) {
    console.error("Erro ao ler CSV:", e.message);
    process.exit(1);
  }

  const rows = await csv({ noheader: false }).fromString(content);
  if (!rows.length) {
    console.log("CSV vazio.");
    return;
  }

  let updatedPhone = 0;
  let updatedEmail = 0;
  let skippedNoCnpj = 0;
  let skippedNoData = 0;
  let skippedFixo = 0;
  let fromOpenCNPJ = 0;

  const toProcess = limit > 0 ? rows.slice(0, limit) : rows;
  const total = toProcess.length;
  const totalComCnpj = toProcess.filter((r) => normalizeCnpj(r.cnpj)).length;

  console.log(`Processando ${total} linhas (${totalComCnpj} com CNPJ). Dry-run: ${dryRun}`);
  console.log(`Telefone: só celular (11 dígitos, 3º=7,8 ou 9). Use --incluir-fixo para gravar fixo. Fallback: OpenCNPJ${skipOpenCNPJ ? " (desativado)" : ""}.\n`);

  let processadosComCnpj = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const cnpj = normalizeCnpj(row.cnpj);

    if (!cnpj) {
      skippedNoCnpj++;
      continue;
    }

    processadosComCnpj++;
    let apiPhone = "";
    let apiEmail = "";
    const brasil = await fetchDadosCnpj(cnpj);
    await sleep(DELAY_MS);
    apiPhone = brasil.phone;
    apiEmail = brasil.email;

    if (!skipOpenCNPJ && (!apiPhone || (apiPhone && !incluirFixo && !ehCelular(apiPhone)) || !apiEmail)) {
      const open = await fetchOpenCNPJ(cnpj);
      await sleep(DELAY_OPENCNPJ_MS);
      if (open.phone && (incluirFixo || ehCelular(open.phone)) && (!apiPhone || !ehCelular(apiPhone))) {
        apiPhone = open.phone;
        fromOpenCNPJ++;
      }
      if (!apiEmail && open.email) apiEmail = open.email;
    }

    if (!apiPhone && !apiEmail) {
      skippedNoData++;
    } else {
      if (apiPhone) {
        if (incluirFixo || ehCelular(apiPhone)) {
          const oldPhone = (row.phone != null ? String(row.phone) : "").trim();
          if (oldPhone !== apiPhone) {
            row.phone = apiPhone;
            updatedPhone++;
          }
        } else {
          skippedFixo++;
        }
      }
      if (apiEmail) {
        const emailNorm = String(apiEmail).trim().toLowerCase();
        const oldEmail = (row.email != null ? String(row.email) : "").trim().toLowerCase();
        if (oldEmail !== emailNorm) {
          row.email = emailNorm;
          updatedEmail++;
        }
      }
    }

    if (!dryRun && processadosComCnpj % 50 === 0) {
      const csvContent = await json2csv(rows);
      await fs.writeFile(csvPath, "\uFEFF" + csvContent, "utf8");
      console.log(`  [checkpoint] Salvou após ${processadosComCnpj} consultas.`);
    }

    if (processadosComCnpj % 10 === 0 || processadosComCnpj === totalComCnpj) {
      const pct = totalComCnpj ? ((100 * processadosComCnpj) / totalComCnpj).toFixed(1) : "0";
      console.log(
        `  [ ${processadosComCnpj}/${totalComCnpj} ] ${pct}% | Telefones: ${updatedPhone} | Emails: ${updatedEmail} | Sem dados API: ${skippedNoData}`
      );
    }
  }

  if (!dryRun && (updatedPhone > 0 || updatedEmail > 0)) {
    const csvContent = await json2csv(rows);
    await fs.writeFile(csvPath, "\uFEFF" + csvContent, "utf8");
  }

  console.log(`Concluído. Telefones atualizados: ${updatedPhone}${fromOpenCNPJ > 0 ? ` (${fromOpenCNPJ} via OpenCNPJ)` : ""}, e-mails: ${updatedEmail}, sem CNPJ: ${skippedNoCnpj}, API sem dados: ${skippedNoData}${skippedFixo > 0 ? `, fixo não gravado: ${skippedFixo}. Use --incluir-fixo para gravar fixo.` : "."}`);
  if (dryRun && (updatedPhone > 0 || updatedEmail > 0)) console.log("(Dry-run: nenhum arquivo foi alterado.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
