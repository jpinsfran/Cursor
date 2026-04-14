import "dotenv/config";

import puppeteer from "puppeteer";
import { generateRestaurantRadar, sanitizeLeadRow, slugify } from "./lib/radarGenerator.js";
import { isEnabled, getClient, upsertRadar, fetchRankingMap } from "./lib/supabaseLeads.js";
import { uploadRadarPdf, ensureBucket } from "./lib/supabaseStorage.js";

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const CONCURRENCY = 5;

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

async function fetchMissingLeads(supabase) {
  const { data: perfisData } = await supabase
    .from("leads_perfil")
    .select("ifood_estabelecimento_id");
  const perfilIds = new Set(perfisData.map((p) => p.ifood_estabelecimento_id));

  const allRadarIds = new Set();
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("radars")
      .select("ifood_estabelecimento_id")
      .range(from, from + 999);
    if (!data?.length) break;
    data.forEach((r) => allRadarIds.add(r.ifood_estabelecimento_id));
    if (data.length < 1000) break;
    from += 1000;
  }

  return [...perfilIds].filter((id) => !allRadarIds.has(id));
}

async function buildRowFromSupabase(supabase, estabId) {
  const { data: estab } = await supabase
    .from("ifood_estabelecimentos")
    .select("*")
    .eq("id", estabId)
    .single();
  if (!estab) return null;

  const { data: perfil } = await supabase
    .from("leads_perfil")
    .select("*")
    .eq("ifood_estabelecimento_id", estabId)
    .maybeSingle();

  const { data: qual } = await supabase
    .from("leads_qualificados")
    .select("*")
    .eq("ifood_estabelecimento_id", estabId)
    .maybeSingle();

  return {
    url: estab.ifood_url || "",
    ifood_url: estab.ifood_url || "",
    name: estab.name || "",
    phone: qual?.phone || estab.phone || "",
    email: qual?.email || estab.email || "",
    neighborhood: estab.neighborhood || "",
    regiao: estab.regiao || "",
    rating: String(estab.rating ?? ""),
    cuisine: estab.cuisine || "",
    priceRange: estab.price_range || "",
    seguidores: perfil?.seguidores ?? "",
    instagram_profile_url: perfil?.instagram_profile_url || "",
    perfil_do_lead: perfil?.perfil_do_lead || "",
    punch_line: perfil?.punch_line || "",
    cnpj: estab.cnpj || "",
  };
}

(async () => {
  if (!isEnabled()) {
    console.error("Supabase não configurado.");
    process.exit(1);
  }

  const supabase = await getClient();

  console.log("Buscando leads com perfil sem radar...");
  const missingIds = await fetchMissingLeads(supabase);
  console.log(`Encontrados: ${missingIds.length} leads faltantes`);

  if (!missingIds.length) {
    console.log("Nenhum lead faltante. Tudo já gerado!");
    process.exit(0);
  }

  const bucketOk = await ensureBucket();
  if (!bucketOk) {
    console.error("Falha ao acessar bucket Supabase Storage.");
    process.exit(1);
  }

  console.log("Carregando rankings...");
  const rankingMap = await fetchRankingMap();
  console.log(`Rankings: ${rankingMap.size} estabelecimentos`);

  console.log("Montando dados dos leads a partir do Supabase...");
  const rows = [];
  for (const id of missingIds) {
    const row = await buildRowFromSupabase(supabase, id);
    if (row) rows.push(row);
  }
  console.log(`Leads prontos: ${rows.length}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const stats = { generated: 0, errors: 0 };
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (row) => {
        const lead = sanitizeLeadRow(row);
        const slug = slugify(lead.name);
        try {
          const ifoodUrl = (row.url || row.ifood_url || "").trim();
          const ranking = rankingMap.get(ifoodUrl) || null;
          const radar = generateRestaurantRadar({ lead: row, allRows: rows, ranking });
          const pdfBuffer = await generatePdf(browser, radar.html);

          const pdfUrl = await uploadRadarPdf(slug, pdfBuffer);
          if (!pdfUrl) {
            console.warn(`  [WARN] Upload falhou: ${slug}`);
            stats.errors++;
            return;
          }

          await upsertRadar(row, {
            pdfUrl,
            slug,
            scores: radar.scores,
            financial: radar.financial,
            messages: radar.messages,
          });

          stats.generated++;
        } catch (err) {
          console.warn(`  [ERROR] ${slug}: ${err.message}`);
          stats.errors++;
        }
      })
    );
    process.stdout.write(
      `\r[${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}] gerados: ${stats.generated} | erros: ${stats.errors}`
    );
  }

  await browser.close();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\nConcluído em ${elapsed}s`);
  console.log(`  Gerados: ${stats.generated}`);
  console.log(`  Erros:   ${stats.errors}`);
})();
