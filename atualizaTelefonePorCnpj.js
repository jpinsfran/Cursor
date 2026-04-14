/**
 * Atualiza as colunas phone e email do CSV de leads iFood usando CNPJ.
 * Ordem (sempre): 1) OpenCNPJ primeiro (mais simples); 2) se não encontrar celular, BrasilAPI; 3) se não encontrar, desiste (mantém o que já existe).
 * Só grava CELULAR (10 ou 11 dígitos com DDD, 3º = 7/8/9). Fixo nunca é gravado; mantém o que já existe.
 * Ao final, sincroniza com Supabase (ifood_estabelecimentos e leads_qualificados) a menos que use --no-sync.
 *
 * Uso:
 *   node atualizaTelefonePorCnpj.js [arquivo.csv]
 *   node atualizaTelefonePorCnpj.js ifoodLeads.csv --limit 10
 *   node atualizaTelefonePorCnpj.js ifoodLeads.csv --dry-run
 *   node atualizaTelefonePorCnpj.js ifoodLeads.csv --incluir-fixo
 *   node atualizaTelefonePorCnpj.js ifoodLeads.csv --skip-opencnpj
 *   node atualizaTelefonePorCnpj.js ifoodLeads.csv --no-sync   (não sincroniza com Supabase)
 */

import "dotenv/config";
import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";
const OPENCNPJ_URL = "https://api.opencnpj.org";
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

/**
 * True se o número é celular brasileiro (não fixo).
 * Celular pode ter 10 ou 11 dígitos (com DDD): Anatel tornou o nono dígito obrigatório em todo o Brasil
 * (conclusão em fev/2017), mas muitas APIs/bases ainda retornam o formato antigo com 10 dígitos.
 * Regra: 10 ou 11 dígitos e 3º dígito (primeiro do assinante) = 7, 8 ou 9 (bandas móveis).
 * Ref.: Anatel – nono dígito em celulares; formato atual (11 dígitos) DDD + 9 + 8 dígitos.
 */
function ehCelular(digits) {
  if (!digits || typeof digits !== "string") return false;
  const d = String(digits).replace(/\D/g, "");
  if (d.length !== 11 && d.length !== 10) return false;
  const primeiroDoAssinante = d[2];
  return primeiroDoAssinante === "7" || primeiroDoAssinante === "8" || primeiroDoAssinante === "9";
}

/**
 * Dada uma lista de valores brutos de telefone (strings), retorna o MELHOR: primeiro celular
 * encontrado; se nenhum for celular, o primeiro válido. Garante que, quando há fixo e celular,
 * priorizamos o celular.
 */
function bestPhoneFromRawList(rawList) {
  const valid = rawList
    .filter((r) => r != null && String(r).trim() !== "")
    .map((r) => phoneFromApi(String(r)))
    .filter((p) => p !== "");
  if (!valid.length) return "";
  const celular = valid.find((p) => ehCelular(p));
  return celular !== undefined ? celular : valid[0];
}

function emailFromApi(val) {
  if (!val || typeof val !== "string") return "";
  const email = val.trim();
  return email && /@/.test(email) ? email : "";
}

/** Retorna { phone, email } a partir da resposta da Brasil API. Considera os DOIS números (ddd_telefone_1 e ddd_telefone_2) e prioriza celular. */
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
      const phone = bestPhoneFromRawList([raw1, raw2]);
      const email = emailFromApi(data.email || "");
      return { phone, email };
    } finally {
      clearTimeout(to);
    }
  } catch (_) {
    return { phone: "", email: "" };
  }
}

/**
 * Extrai de uma string que pode conter vários telefones (ex.: "(48) 3304-5605 / (48) 96181-1859")
 * uma lista de strings, uma por número.
 */
function splitMultiplePhones(str) {
  if (!str || typeof str !== "string") return [];
  const s = str.trim();
  if (!s) return [];
  return s
    .split(/\s*[\/,;]\s*|\s+e\s+|\s+ou\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);
}

/**
 * OpenCNPJ (api.opencnpj.org): retorna data.telefone e às vezes mais de um número (em um campo ou em telefone_2, etc.).
 * Coleta TODOS os números (incl. split no campo quando vier "fixo / celular") e retorna o melhor (prioriza celular).
 * Email quando disponível (OpenCNPJ às vezes melhor que BrasilAPI).
 */
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
      const rawPhones = [];
      const push = (v) => {
        if (v != null && String(v).trim() !== "") rawPhones.push(String(v).trim());
      };
      if (data?.telefone != null) {
        const t = String(data.telefone).trim();
        if (t) {
          const parts = splitMultiplePhones(t);
          if (parts.length) parts.forEach((p) => rawPhones.push(p));
          else rawPhones.push(t);
        }
      }
      if (data?.telefone_2 != null) push(data.telefone_2);
      if (data?.telefone2 != null) push(data.telefone2);
      if (data?.celular != null) push(data.celular);
      if (Array.isArray(data?.telefones)) {
        data.telefones.forEach((t) => {
          const num = t?.numero ?? (typeof t === "string" ? t : null);
          if (num != null && String(num).trim() !== "") {
            const ddd = (t?.ddd ?? "").trim();
            rawPhones.push(ddd ? `${ddd}${String(num).replace(/\D/g, "")}` : String(num));
          }
        });
      }
      for (const key of Object.keys(data || {})) {
        if (/telefone|celular|ddd_telefone/i.test(key) && key !== "telefone" && key !== "telefone_2" && key !== "telefone2" && key !== "celular") {
          const v = data[key];
          if (v != null && typeof v === "string" && v.trim().length >= 10) rawPhones.push(v.trim());
        }
      }
      const phone = bestPhoneFromRawList(rawPhones);
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
  const noSync = process.argv.includes("--no-sync");
  const csvPath = path.resolve(argv[0] || path.join(process.cwd(), "ifoodLeads.csv"));
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
  let fromCommercial = 0;

  const toProcess = limit > 0 ? rows.slice(0, limit) : rows;
  const total = toProcess.length;
  const totalComCnpj = toProcess.filter((r) => normalizeCnpj(r.cnpj)).length;

  console.log(`Processando ${total} linhas (${totalComCnpj} com CNPJ). Dry-run: ${dryRun}`);
  console.log(`Telefone: 1º OpenCNPJ (mais simples), 2º BrasilAPI se não achar, 3º desiste (mantém existente). Só celular. Sync: ${noSync ? "não" : "sim"}.\n`);

  let processadosComCnpj = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const cnpj = normalizeCnpj(row.cnpj);
    const commercialPhone = (row.phone != null ? String(row.phone) : "").trim();

    if (!cnpj) {
      skippedNoCnpj++;
      continue;
    }

    processadosComCnpj++;
    let apiPhone = "";
    let apiEmail = "";

    const open = !skipOpenCNPJ ? await fetchOpenCNPJ(cnpj) : { phone: "", email: "" };
    if (!skipOpenCNPJ) await sleep(DELAY_OPENCNPJ_MS);
    if (open.phone && ehCelular(open.phone)) {
      apiPhone = open.phone;
      fromOpenCNPJ++;
    }
    apiEmail = open.email || "";

    if (!apiPhone) {
      const brasil = await fetchDadosCnpj(cnpj);
      await sleep(DELAY_MS);
      if (brasil.phone && ehCelular(brasil.phone)) apiPhone = brasil.phone;
      if (!apiEmail && brasil.email) apiEmail = brasil.email;
    }

    // Só usamos número da API se for CELULAR. Se for fixo, mantém o que já existe (comercial/delivery).
    const finalPhone = (apiPhone && ehCelular(apiPhone)) ? apiPhone : commercialPhone;

    if (!finalPhone && !apiEmail) {
    skippedNoData++;
    } else {
      if (finalPhone) {
        if (ehCelular(finalPhone)) {
          if (commercialPhone !== finalPhone) {
            row.phone = finalPhone;
            updatedPhone++;
          }
          if (!apiPhone && finalPhone) fromCommercial++;
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

  console.log(`Concluído. Telefones atualizados: ${updatedPhone}${fromOpenCNPJ > 0 ? ` (${fromOpenCNPJ} via OpenCNPJ)` : ""}${fromCommercial > 0 ? ` (${fromCommercial} mantidos/comercial)` : ""}, e-mails: ${updatedEmail}, sem CNPJ: ${skippedNoCnpj}, API sem dados: ${skippedNoData}${skippedFixo > 0 ? `, fixo não gravado: ${skippedFixo}. Use --incluir-fixo para gravar fixo.` : "."}`);
  if (dryRun && (updatedPhone > 0 || updatedEmail > 0)) console.log("(Dry-run: nenhum arquivo foi alterado.)");

  if (!dryRun && (updatedPhone > 0 || updatedEmail > 0) && !noSync) {
    try {
      const { isEnabled, upsertEstabelecimento, upsertQualificado, upsertPerfil } = await import("./lib/supabaseLeads.js");
      if (isEnabled()) {
        console.log("\nSincronizando com Supabase...");
        let estab = 0, qual = 0, perfil = 0;
        for (const row of rows) {
          const url = (row.url || row.ifood_url || "").trim();
          if (!url) continue;
          try {
            const id = await upsertEstabelecimento(row);
            if (id) estab++;
            if ((row.phone || "").trim() || (row.email || "").trim()) {
              await upsertQualificado(row);
              qual++;
            }
            if ((row.perfil_do_lead || "").trim() || (row.punch_line || "").trim()) {
              await upsertPerfil(row);
              perfil++;
            }
          } catch (e) {
            console.warn("Linha ignorada:", url?.slice(0, 50), e.message);
          }
        }
        console.log("Supabase: estabelecimentos:", estab, "| qualificados:", qual, "| perfil:", perfil);
      } else {
        console.log("\nSupabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY). Pulando sync.");
      }
    } catch (e) {
      console.warn("Erro ao sincronizar com Supabase:", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
