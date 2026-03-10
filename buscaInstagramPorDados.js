/**
 * Busca link do Instagram quando não veio no scrape do iFood.
 * Usa: nome do restaurante (+ bairro/cidade se quiser) para buscar no DuckDuckGo
 * e extrair o primeiro perfil Instagram encontrado.
 *
 * Uso:
 *   node buscaInstagramPorDados.js "Nome do Restaurante"
 *   node buscaInstagramPorDados.js "Nome do Restaurante" "Bela Vista SP"
 *   node buscaInstagramPorDados.js --csv ifoodLeads_SP.csv   (preenche instagramUrl vazios)
 */

import puppeteer from "puppeteer";
import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const INSTAGRAM_PROFILE_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi;

/** Extrai a primeira URL de perfil Instagram (não post /p/) de um texto/HTML */
function extractFirstInstagramProfileUrl(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== "string") return "";
  const matches = [...htmlOrText.matchAll(INSTAGRAM_PROFILE_REGEX)];
  for (const m of matches) {
    const url = m[0];
    if (!/\/p\//.test(url) && !/\/reel\//.test(url)) {
      return url.replace(/\/+$/, "");
    }
  }
  return "";
}

/** Busca no DuckDuckGo por "nome restaurante instagram" e retorna a primeira URL de perfil encontrada */
async function searchInstagramByQuery(browser, query) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  let found = "";
  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + " instagram")}&t=h_`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));
    const html = await page.content();
    found = extractFirstInstagramProfileUrl(html);
  } catch (e) {
    console.warn("Busca falhou:", e.message);
  } finally {
    await page.close();
  }
  return found;
}

/** Normaliza nome do restaurante para busca (remove sufixo iFood, etc.) */
function normalizeNameForSearch(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/\s*\|\s*SAO PAULO\s*\|\s*iFood/gi, "")
    .replace(/\s*\|\s*[A-Za-z\s]+\s*\|\s*iFood/gi, "")
    .replace(/\s*\|\s*iFood/gi, "")
    .trim();
}

async function runSingleSearch(name, location = "") {
  const query = [normalizeNameForSearch(name), location].filter(Boolean).join(" ");
  if (!query) {
    console.error("Informe o nome do restaurante.");
    process.exit(1);
  }
  console.log("Buscando:", query + " instagram");
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 800 },
    });
    const url = await searchInstagramByQuery(browser, query);
    if (url) console.log("Instagram encontrado:", url);
    else console.log("Nenhum perfil Instagram encontrado para essa busca.");
    return url;
  } finally {
    if (browser) await browser.close();
  }
}

async function runCsvFill(csvPath) {
  const baseDir = path.dirname(path.resolve(csvPath));
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
  const hasInstagramCol = rows[0].hasOwnProperty("instagramUrl");
  if (!hasInstagramCol) {
    rows.forEach((r) => (r.instagramUrl = ""));
  }
  const toFill = rows.filter((r) => !r.instagramUrl || String(r.instagramUrl).trim() === "");
  console.log("Total de linhas:", rows.length, "| Sem Instagram:", toFill.length);
  if (toFill.length === 0) {
    console.log("Todos já possuem instagramUrl.");
    return;
  }
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 800 },
    });
    for (let i = 0; i < toFill.length; i++) {
      const row = toFill[i];
      const name = row.name || "";
      const neighborhood = row.neighborhood || "";
      const query = [normalizeNameForSearch(name), neighborhood].filter(Boolean).join(" ");
      if (!query) continue;
      process.stdout.write(`[${i + 1}/${toFill.length}] ${name.slice(0, 40)}... `);
      const url = await searchInstagramByQuery(browser, query);
      row.instagramUrl = url || row.instagramUrl || "";
      const idx = rows.findIndex((r) => r.url === row.url && r.name === row.name);
      if (idx >= 0) rows[idx].instagramUrl = row.instagramUrl;
      console.log(url || "(não encontrado)");
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    if (browser) await browser.close();
  }
  const csvContent = await json2csv(rows);
  await fs.writeFile(fullPath, csvContent, "utf8");
  console.log("CSV atualizado:", fullPath);
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const csvIndex = process.argv.indexOf("--csv");
  if (csvIndex !== -1 && process.argv[csvIndex + 1]) {
    await runCsvFill(process.argv[csvIndex + 1]);
    return;
  }
  const name = argv[0] || "";
  const location = argv[1] || "";
  if (!name) {
    console.error("Uso:");
    console.error('  node buscaInstagramPorDados.js "Nome do Restaurante" [Bairro ou Cidade]');
    console.error("  node buscaInstagramPorDados.js --csv ifoodLeads_SP.csv");
    process.exit(1);
  }
  await runSingleSearch(name, location);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
