import "dotenv/config";

import csv from "csvtojson";
import path from "path";
import { promises as fs } from "fs";
import puppeteer from "puppeteer";

import { generateRestaurantRadar, sanitizeLeadRow, slugify } from "./lib/radarGenerator.js";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";
import { isEnabled, getClient, upsertRadar, radarExistsForUrl, fetchRankingMap } from "./lib/supabaseLeads.js";
import { uploadRadarPdf, ensureBucket } from "./lib/supabaseStorage.js";

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const CONCURRENCY = 5;

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return "";
  return process.argv[idx + 1] || "";
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const valueFlags = new Set(["--limit", "--output-dir"]);
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (valueFlags.has(argv[i])) { i += 1; continue; }
    if (!argv[i].startsWith("--")) positional.push(argv[i]);
  }

  return {
    csvPath: positional[0] || "ifoodLeads_unificado.csv",
    limit: Number.parseInt(getArgValue("--limit"), 10) || 0,
    resume: hasFlag("--resume"),
    force: hasFlag("--force"),
    dryRun: hasFlag("--dry-run"),
    onlyWithProfile: hasFlag("--only-with-profile"),
    outputDir: getArgValue("--output-dir") || "radar-output",
  };
}

async function generatePdf(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 816, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 300));
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

async function processChunk(browser, chunk, allRows, args, stats, rankingMap) {
  await Promise.all(
    chunk.map(async (row) => {
      const lead = sanitizeLeadRow(row);
      const slug = slugify(lead.name);

      try {
        if (args.resume && !args.force) {
          const ifoodUrl = (row.url || row.ifood_url || "").trim();
          if (ifoodUrl && (await radarExistsForUrl(ifoodUrl))) {
            stats.skipped += 1;
            return;
          }
        }

        const ifoodUrl = (row.url || row.ifood_url || "").trim();
        const ranking = rankingMap.get(ifoodUrl) || null;
        const radar = generateRestaurantRadar({ lead: row, allRows, ranking });
        const pdfBuffer = await generatePdf(browser, radar.html);

        if (args.dryRun) {
          const localDir = path.join(args.outputDir, slug);
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, "radar.pdf"), pdfBuffer);
          stats.generated += 1;
          return;
        }

        const pdfUrl = await uploadRadarPdf(slug, pdfBuffer);
        if (!pdfUrl) {
          console.warn(`  [WARN] Upload falhou para ${slug}`);
          stats.errors += 1;
          return;
        }

        await upsertRadar(row, {
          pdfUrl,
          slug,
          scores: radar.scores,
          financial: radar.financial,
          messages: radar.messages,
        });

        stats.generated += 1;
      } catch (err) {
        console.warn(`  [ERROR] ${slug}: ${err.message}`);
        stats.errors += 1;
      }
    })
  );
}

async function main() {
  const args = parseArgs();
  const csvPath = path.isAbsolute(args.csvPath) ? args.csvPath : path.join(process.cwd(), args.csvPath);
  const outputDir = path.isAbsolute(args.outputDir) ? args.outputDir : path.join(process.cwd(), args.outputDir);
  args.outputDir = outputDir;

  let rows = [];
  try {
    rows = await csv({ noheader: false }).fromFile(csvPath);
  } catch (err) {
    console.error("Erro ao ler CSV:", csvPath, err.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.error("CSV vazio.");
    process.exit(1);
  }

  const allRows = normalizeLeadRows(rows);

  let filteredRows = allRows;
  if (args.onlyWithProfile && isEnabled()) {
    console.log("Filtrando leads com perfil (leads_perfil)...");
    const supabase = await getClient();
    const profileUrls = new Set();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from("leads_perfil")
        .select("ifood_estabelecimento_id")
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      const ids = data.map((d) => d.ifood_estabelecimento_id);
      const { data: estabs } = await supabase
        .from("ifood_estabelecimentos")
        .select("ifood_url")
        .in("id", ids);
      for (const e of estabs || []) {
        if (e.ifood_url) profileUrls.add(e.ifood_url.trim());
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
    filteredRows = allRows.filter((row) => {
      const url = (row.url || row.ifood_url || "").trim();
      return profileUrls.has(url);
    });
    console.log(`Leads com perfil: ${filteredRows.length} de ${allRows.length}`);
  }

  const toProcess = args.limit > 0 ? filteredRows.slice(0, args.limit) : filteredRows;

  if (!args.dryRun && !isEnabled()) {
    console.error("Supabase não configurado. Use --dry-run para gerar PDFs localmente.");
    process.exit(1);
  }

  if (!args.dryRun) {
    const bucketOk = await ensureBucket();
    if (!bucketOk) {
      console.error("Não foi possível criar/acessar o bucket no Supabase Storage.");
      process.exit(1);
    }
  }

  let rankingMap = new Map();
  if (isEnabled()) {
    console.log("Carregando rankings do Supabase...");
    rankingMap = await fetchRankingMap();
    console.log(`Rankings carregados: ${rankingMap.size} estabelecimentos`);
  }

  console.log(`Batch Radar: ${toProcess.length} leads | concorrência: ${CONCURRENCY} | dry-run: ${args.dryRun} | resume: ${args.resume}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    defaultViewport: { width: 1280, height: 900 },
  });

  const stats = { generated: 0, skipped: 0, errors: 0 };
  const startTime = Date.now();

  try {
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      const chunk = toProcess.slice(i, i + CONCURRENCY);
      const progress = Math.min(i + CONCURRENCY, toProcess.length);
      process.stdout.write(`\r[${progress}/${toProcess.length}] gerados: ${stats.generated} | erros: ${stats.errors} | pulados: ${stats.skipped}`);
      await processChunk(browser, chunk, allRows, args, stats, rankingMap);
    }
  } finally {
    await browser.close();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\nConcluído em ${elapsed}s`);
  console.log(`  Gerados: ${stats.generated}`);
  console.log(`  Pulados: ${stats.skipped}`);
  console.log(`  Erros:   ${stats.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
