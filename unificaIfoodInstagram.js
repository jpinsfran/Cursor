import "dotenv/config";
/**
 * Unifica planilha do iFood com busca e análise do Instagram.
 * Lê o CSV do iFood, para cada linha busca o perfil Instagram (nome + bairro + cidade),
 * roda a análise (perfil_do_lead + punch_line via IA) e grava o CSV unificado em tempo real:
 * após cada lead processado o arquivo *_unificado.csv é atualizado (uma informação por vez).
 *
 * Uso:
 *   node unificaIfoodInstagram.js                    (usa ifoodLeads_SP.csv, processa todos)
 *   node unificaIfoodInstagram.js ifoodLeads_RJ.csv  (arquivo específico)
 *   node unificaIfoodInstagram.js ifoodLeads_SP.csv --limit 5   (só 5 primeiras linhas, teste)
 *   node unificaIfoodInstagram.js ifoodLeads_SP.csv --resume    (pula linhas que já têm instagram_user_id)
 *
 * Requer: Instagram logado no perfil do script (node scrapeInstagram.js --login)
 * Requer: Python + instagram_profile_ai.py + OPENAI_API_KEY para perfil_do_lead e punch_line.
 */

import puppeteer from "puppeteer";
import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";
import { fileURLToPath } from "url";
import { runFullInstagramAnalysis } from "./scrapeInstagram.js";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const CHROME_USER_DATA_DIR = path.join(process.cwd(), "instagram_chrome_profile");
const INSTAGRAM_PROFILE_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi;

function extractFirstInstagramProfileUrl(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== "string") return "";
  const matches = [...htmlOrText.matchAll(INSTAGRAM_PROFILE_REGEX)];
  for (const m of matches) {
    const url = m[0];
    if (!/\/p\//.test(url) && !/\/reel\//.test(url)) return url.replace(/\/+$/, "");
  }
  return "";
}

async function searchInstagramByQuery(browser, query) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  let found = "";
  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + " instagram")}&t=h_`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1800));
    const html = await page.content();
    found = extractFirstInstagramProfileUrl(html);
  } catch (e) {
    console.warn("  Busca falhou:", e.message);
  } finally {
    await page.close();
  }
  return found;
}

function normalizeNameForSearch(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/\s*\|\s*SAO PAULO\s*\|\s*iFood/gi, "")
    .replace(/\s*\|\s*[A-Za-z\s]+\s*\|\s*iFood/gi, "")
    .replace(/\s*\|\s*iFood/gi, "")
    .trim();
}

/** Colapsa quebras de linha; usa ";" como separador entre itens nas descrições. */
function sanitizeForCsv(val) {
  if (val == null) return "";
  const s = String(val).replace(/\r\n|\n|\r/g, "; ").replace(/\s{2,}/g, " ").trim();
  return s;
}

function sanitizeRow(row) {
  const textCols = ["perfil_do_lead", "punch_line"];
  textCols.forEach((col) => {
    if (row[col] != null) row[col] = sanitizeForCsv(row[col]);
  });
  if (row.email != null && (String(row.email).toLowerCase() === "false" || String(row.email).toLowerCase() === "null")) {
    row.email = "";
  }
  return row;
}

const WRITE_RETRIES = 4;
const WRITE_RETRY_MS = 800;

/** Grava a planilha em UTF-8 (BOM). Escreve em .tmp e troca pelo destino; se o destino estiver bloqueado (ex.: aberto no editor), mantém em .tmp. */
async function writeCsvNow(rows, outPath) {
  const copy = normalizeLeadRows(rows).map((r) => ({ ...r }));
  copy.forEach(sanitizeRow);
  const csvContent = await json2csv(copy);
  const data = "\uFEFF" + csvContent;
  const tmpPath = outPath + ".tmp";
  await fs.writeFile(tmpPath, data, { encoding: "utf8" });
  for (let attempt = 1; attempt <= WRITE_RETRIES; attempt++) {
    try {
      await fs.rename(tmpPath, outPath);
      return;
    } catch (err) {
      if ((err.code === "EBUSY" || err.code === "EACCES" || err.code === "EPERM") && attempt < WRITE_RETRIES) {
        await new Promise((r) => setTimeout(r, WRITE_RETRY_MS));
        continue;
      }
      console.warn("\n(Aviso) Arquivo de saída está em uso. Dados gravados em:", tmpPath);
      return;
    }
  }
}

function getArgs() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const csvPath = argv[0] || path.join(process.cwd(), "ifoodLeads_SP.csv");
  const limitIndex = process.argv.indexOf("--limit");
  const limit = limitIndex !== -1 && process.argv[limitIndex + 1] ? parseInt(process.argv[limitIndex + 1], 10) : 0;
  const resume = process.argv.includes("--resume");
  const noSync = process.argv.includes("--no-sync");
  const cityIndex = process.argv.indexOf("--city");
  const citySuffix = cityIndex !== -1 && process.argv[cityIndex + 1] ? process.argv[cityIndex + 1] : "";
  return { csvPath, limit, resume, citySuffix, noSync };
}

async function main() {
  const { csvPath, limit, resume, citySuffix, noSync } = getArgs();
  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);

  let rows = [];
  try {
    rows = await csv().fromFile(fullPath);
  } catch (e) {
    console.error("Erro ao ler CSV:", fullPath, e.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.log("CSV vazio.");
    return;
  }

  rows = normalizeLeadRows(rows);

  const toProcess = limit > 0 ? rows.slice(0, limit) : rows;
  const needColumns = [
    "instagram_profile_url", "instagram_user_id",
    "seguidores", "perfil_do_lead", "punch_line",
  ];
  rows.forEach((r) => {
    needColumns.forEach((col) => {
      if (!r.hasOwnProperty(col)) r[col] = "";
    });
  });

  const toRun = resume
    ? toProcess.filter((r) => !r.instagram_user_id || String(r.instagram_user_id).trim() === "")
    : toProcess;

  if (toRun.length === 0) {
    console.log("Nenhuma linha para processar (--resume e todas já têm instagram_user_id, ou limite 0).");
    const outPath = fullPath.endsWith("_unificado.csv")
    ? fullPath
    : fullPath.replace(/(\.csv)?$/i, "_unificado.csv");
    const normalizedRows = normalizeLeadRows(rows);
    normalizedRows.forEach(sanitizeRow);
    const csvContent = await json2csv(normalizedRows);
    await fs.writeFile(outPath, "\uFEFF" + csvContent, "utf8");
    console.log("CSV unificado salvo:", outPath);
    return;
  }

  const outPath = fullPath.endsWith("_unificado.csv")
    ? fullPath
    : fullPath.replace(/(\.csv)?$/i, "_unificado.csv");
  console.log("Linhas a processar:", toRun.length, "de", toProcess.length);
  console.log("CSV será atualizado em tempo real a cada lead:", outPath);
  console.log("Abrindo navegador (use o mesmo perfil do Instagram: node scrapeInstagram.js --login)...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: CHROME_USER_DATA_DIR,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  try {
    for (let i = 0; i < toRun.length; i++) {
      const row = toRun[i];
      const name = normalizeNameForSearch(row.name || row.tenant || row.restaurant || "");
      const neighborhood = (row.neighborhood || "").trim();
      const city = citySuffix || (row.regiao || "").trim() || (path.basename(fullPath, ".csv").replace("ifoodLeads_", "").replace("vucasolution_leads", "") || "SP");
      const query = [name, neighborhood, city].filter(Boolean).join(" ");

      process.stdout.write(`[${i + 1}/${toRun.length}] ${(row.name || row.tenant || row.restaurant || "").slice(0, 45)}... `);

      if (!query.trim()) {
        console.log("(sem nome/bairro, pulando)");
        continue;
      }

      const profileUrl = await searchInstagramByQuery(browser, query);
      if (!profileUrl) {
        console.log("Instagram não encontrado.");
        row.instagram_profile_url = "";
        row.instagram_user_id = "";
        row.seguidores = "";
        row.perfil_do_lead = "";
        row.punch_line = "";
        const idx = rows.findIndex((r) => (row.domain ? r.domain === row.domain : r.url === row.url && r.name === row.name));
        if (idx >= 0) Object.assign(rows[idx], row);
        await writeCsvNow(rows, outPath);
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      const ifoodContext = {
        name: (row.name || row.tenant || row.restaurant || "").trim(),
        cuisine: String(row.cuisine || "").replace(/^"+|"+$/g, "").trim(),
        regiao: (row.regiao || citySuffix || "").trim(),
        neighborhood: (row.neighborhood || "").trim(),
      };
      const result = await runFullInstagramAnalysis(browser, profileUrl, { ifoodContext });
      if (result.error) {
        console.log("Análise falhou:", result.error);
        row.instagram_profile_url = profileUrl;
        row.instagram_user_id = "";
        row.seguidores = "";
        row.perfil_do_lead = "";
        row.punch_line = "";
      } else {
        row.instagram_profile_url = result.profileUrl;
        row.instagramUrl = result.profileUrl || row.instagramUrl || "";
        row.instagram_user_id = result.userId || "";
        row.seguidores = result.seguidores || "";
        row.perfil_do_lead = result.perfil_do_lead || "";
        row.punch_line = result.punch_line || "";
        console.log("OK →", (result.userId || "sem id"));
      }

      const idx = rows.findIndex((r) => (row.domain ? r.domain === row.domain : r.url === row.url && r.name === row.name));
      if (idx >= 0) Object.assign(rows[idx], row);

      await writeCsvNow(rows, outPath);

      if (!noSync) {
        try {
          const { isEnabled, upsertEstabelecimento, upsertQualificado, upsertPerfil } = await import("./lib/supabaseLeads.js");
          if (isEnabled() && (row.url || row.ifood_url)) {
            await upsertEstabelecimento(row);
            if ((row.phone || "").trim() || (row.email || "").trim()) await upsertQualificado(row);
            if ((row.perfil_do_lead || "").trim() || (row.punch_line || "").trim()) await upsertPerfil(row);
          }
        } catch (_) {}
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log("\nPlanilha unificada final salva:", outPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
