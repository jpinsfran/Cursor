import "dotenv/config";
/**
 * Scrape de leads do iFood por endereço/região.
 * Função principal: buscar oportunidades de leads para a base de prospecção.
 * Extrai: name, url, phone, cnpj, streetAddress, neighborhood, zipcode, rating, email, cuisine, priceRange.
 */
import puppeteer from "puppeteer";
import csv from "csvtojson";
import { promises as fs } from "fs";
import { json2csv } from "json-2-csv";
import path from "path";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";
import { dedupeRowsByCanonicalPhone } from "./lib/dedupePhoneCsv.js";
import { fetchIfoodRestaurantRow } from "./lib/ifoodRestaurantFetch.js";
import { IFOOD_USER_AGENT, runAddressFlow } from "./lib/ifoodAddressAutomation.js";
import { maybeCompleteHoldChallenge } from "./lib/ifoodHoldVerification.js";

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

// Ex.: "Av Paulista 1000, São Paulo" SP
const FETCH_TIMEOUT_MS = 35000;
const GOTO_RETRIES = 3;

const SLOW_MO_MS = Number.parseInt(process.env.IFOOD_SLOW_MO ?? "0", 10) || 0;

const getArgs = () => {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const address = argv[0] || "Avenida Engenheiro Gastão Rangel 393";
  const suffix = argv[1] || "RJ";
  const filePath = path.join(process.cwd(), `ifoodLeads_${suffix}.csv`);
  return { address, filePath, suffix };
};

const scrapeIfoodLeads = async () => {
  const { address, filePath, suffix } = getArgs();
  console.log("Address:", address);
  console.log("Output CSV:", filePath.replace(/\\\\/g, "\\"));
  if (["1", "true", "yes"].includes(String(process.env.IFOOD_MANUAL_ADDRESS || "").toLowerCase())) {
    console.log(
      "[ifood] IFOOD_MANUAL_ADDRESS: busca e sugestão serão manuais no navegador; no terminal, pressione Enter após escolher o endereço."
    );
  }
  let browser = null;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        `--user-agent=${IFOOD_USER_AGENT}`,
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      headless: false,
      ignoreHTTPSErrors: true,
      slowMo: SLOW_MO_MS,
    });

    let [page] = await browser.pages();
    if (!page) page = await browser.newPage();
    await page.setUserAgent(IFOOD_USER_AGENT);

    async function gotoWithRetry(url) {
      for (let attempt = 1; attempt <= GOTO_RETRIES; attempt++) {
        try {
          if (attempt > 1) {
            // Recria a página após detach/frame reset para evitar estado corrompido.
            try {
              if (!page.isClosed()) await page.close();
            } catch (_) {}
            page = await browser.newPage();
            await page.setUserAgent(IFOOD_USER_AGENT);
          }
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 65000 });
          return;
        } catch (err) {
          const msg = String(err?.message || "");
          const retriable =
            msg.includes("Navigating frame was detached") ||
            msg.includes("LifecycleWatcher disposed") ||
            msg.includes("Execution context was destroyed") ||
            msg.includes("Target closed");
          if (!retriable || attempt === GOTO_RETRIES) throw err;
          console.warn(`[retry] page.goto falhou (tentativa ${attempt}/${GOTO_RETRIES}): ${msg}`);
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }

    console.log("Navigating to ifood...");
    await gotoWithRetry("https://www.ifood.com.br/restaurantes");
    await new Promise((r) => setTimeout(r, 4000));

    await runAddressFlow(page, address, {
      modalOpenWaitMs: 1200,
      typeDelay: 50,
      suggestionTimeoutMs: 35000,
    });

    const holdResult = await maybeCompleteHoldChallenge(page, {
      waitForFrameMs: 40000,
      maxTotalMs: 140000,
    });
    if (!holdResult.skipped) {
      console.log("[ifood] Resultado verificação segurar:", holdResult);
    }

    await new Promise((r) => setTimeout(r, 2000));
    try {
      await page.waitForFunction(
        () => !document.querySelector(".address-modal-overlay--after-open") || document.querySelector('a[href*="/restaurantes/"], a[href*="/delivery/"]'),
        { timeout: 40000 }
      );
    } catch (_) {}

    // Aguardar lista de restaurantes (vários seletores do novo layout)
    const merchantSelectors = [
      'a.merchant-v2__link',
      'a[href*="/restaurantes/"]',
      'a[href*="/delivery/"]',
      '[class*="cardstack"] a[href*="restaurante"]',
      '[class*="merchant"] a[href]',
    ];
    let urls = [];
    for (const sel of merchantSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 45000 });
        const handles = await page.$$(sel);
        for (const h of handles) {
          const href = await h.evaluate((el) => el.getAttribute("href"));
          if (href && (href.includes("/restaurantes/") || href.includes("/delivery/")) && !urls.includes(href)) {
            urls.push(href.startsWith("http") ? href : "https://www.ifood.com.br" + href);
          }
        }
        if (urls.length > 0) break;
      } catch (_) {}
    }
    console.log("Initial merchant links:", urls.length);

    // Coleta de URLs sem page.evaluate para evitar "detached Frame" após cliques
    async function collectMerchantUrls() {
      const out = new Set();
      for (const sel of merchantSelectors) {
        try {
          const handles = await page.$$(sel);
          for (const h of handles) {
            try {
              const href = await h.evaluate((el) => el.getAttribute("href"));
              if (href && (href.includes("/restaurantes/") || href.includes("/delivery/"))) out.add(href);
            } catch (_) {}
          }
        } catch (_) {}
      }
      return [...out];
    }
    urls = await collectMerchantUrls();
    // Fallback: extrair do estado Next.js (cardstack/restaurantsByCity)
    if (urls.length === 0) {
      const fromState = await page.evaluate(() => {
        const script = document.getElementById("__NEXT_DATA__");
        if (!script || !script.textContent) return [];
        try {
          const data = JSON.parse(script.textContent);
          const list = data?.props?.pageProps?.initialState?.restaurantsByCity?.list ||
            data?.props?.pageProps?.initialState?.cardstackConfig?.data?.restaurants ||
            [];
          return (list || []).map((m) => m.slug ? `/restaurantes/${m.slug}` : m.url || m.link).filter(Boolean);
        } catch (_) {
          return [];
        }
      });
      urls = fromState.map((s) => (s.startsWith("http") ? s : "https://www.ifood.com.br" + s));
    }
    urls = urls.map((href) => (href.startsWith("http") ? href : "https://www.ifood.com.br" + href));

    try {
      for (let round = 0; round < 500 && urls.length < 10000; round++) {
        let verMais = false;
        const cardstackBtn = await page.$(".cardstack-nextcontent__button");
        if (cardstackBtn) {
          await cardstackBtn.click();
          verMais = true;
        } else {
          const buttons = await page.$$("button, [role=button]");
          for (const b of buttons) {
            const text = await b.evaluate((el) => (el.textContent || "").trim().toLowerCase());
            if (text.includes("ver mais")) {
              await b.click();
              verMais = true;
              break;
            }
          }
        }
        if (!verMais) break;
        await new Promise((r) => setTimeout(r, 3000));
        const newUrls = await collectMerchantUrls();
        const base = "https://www.ifood.com.br";
        for (const href of newUrls) {
          const full = href.startsWith("http") ? href : base + href;
          if (!urls.includes(full)) urls.push(full);
        }
      }
    } catch (error) {
      console.log("Error looping through restaurants:", error);
    }

    // Não fecha o browser para evitar TargetCloseError; deixa rodar até o fim
    console.log("Retrieved", urls.length, " restaurant urls!");

    console.log("Scraping data...");
    let fullData = [];
    try {
      for (let i = 0; i < urls.length; i += 10) {
        const chunk = urls.slice(i, i + 10);
        const data = await Promise.all(
          chunk.map(async (url) => {
            const row = await fetchIfoodRestaurantRow(url, { timeoutMs: FETCH_TIMEOUT_MS });
            console.log("Scraped data", {
              name: row.name,
              url: row.url,
              phone: row.phone,
              cnpj: row.cnpj,
              streetAddress: row.streetAddress,
              neighborhood: row.neighborhood,
              zipcode: row.zipcode,
              rating: row.rating,
              email: row.email,
              cuisine: row.cuisine,
              priceRange: row.priceRange,
            });
            return row;
          })
        );
        fullData = [...fullData, ...data];
      }
    } catch (error) {
      console.log("Error scraping data:", error);
    }

    console.log("Reading saved data...");
    let savedData = [];
    try {
      await fs.access(filePath);
      savedData = await csv().fromFile(filePath);
    } catch (error) {
      console.log("No existing CSV found or error reading file, starting with empty dataset.");
    }
    console.log("Removing duplicates...");
    const uniqueData = fullData.filter((item) => {
      return !savedData.some((savedItem) => savedItem.url === item.url);
    });
    console.log("Unique data", uniqueData);

    let allData = normalizeLeadRows([...savedData, ...uniqueData]);
    allData = dedupeRowsByCanonicalPhone(allData);
    console.log("Total data entries:", allData.length);

    console.log("Updating CSV...");
    const leadsContent = await json2csv(allData);
    await fs.writeFile(filePath, "\uFEFF" + leadsContent, "utf8");
    console.log("CSV gravado:", filePath);

    const skipSupabase = ["1", "true", "yes"].includes(
      String(process.env.IFOOD_SKIP_SUPABASE_SYNC || "").toLowerCase()
    );
    const urlKey = (row) => String(row?.url ?? row?.ifood_url ?? "").trim();
    const urlsNovos = new Set(uniqueData.map(urlKey).filter(Boolean));
    const syncSupabaseFull = ["1", "true", "yes"].includes(
      String(process.env.IFOOD_SYNC_SUPABASE_FULL || "").toLowerCase()
    );
    let rowsParaSupabase = syncSupabaseFull
      ? allData
      : allData.filter((row) => urlsNovos.has(urlKey(row)));

    if (skipSupabase) {
      console.log("[Supabase] Pulado (IFOOD_SKIP_SUPABASE_SYNC).");
    } else {
      try {
        const { isEnabled, upsertEstabelecimento } = await import("./lib/supabaseLeads.js");
        if (isEnabled()) {
          if (!syncSupabaseFull && urlsNovos.size === 0) {
            console.log("[Supabase] Nenhuma URL nova neste scrape; sync ignorado.");
          } else if (rowsParaSupabase.length === 0) {
            console.log(
              "[Supabase] Nenhuma linha correspondente no CSV após dedupe (URLs novas podem ter sido fundidas por telefone duplicado)."
            );
          } else {
            const total = rowsParaSupabase.length;
            const modo = syncSupabaseFull ? "completo (IFOOD_SYNC_SUPABASE_FULL)" : "somente linhas novas deste scrape";
            console.log(
              `[Supabase] Sincronizando ${total} linha(s) (${modo}) em ifood_estabelecimentos...`
            );
            let n = 0;
            for (let i = 0; i < rowsParaSupabase.length; i++) {
              const row = rowsParaSupabase[i];
              const id = await upsertEstabelecimento(row);
              if (id) n++;
              const done = i + 1;
              if (done % 250 === 0 || done === total) {
                console.log(`[Supabase] Progresso: ${done}/${total} (${n} upserts ok)`);
              }
            }
            console.log("[Supabase] Concluído:", n, "estabelecimentos sincronizados.");
          }
        }
      } catch (_) {}
    }

    return Promise.resolve("Ifood leads scraped successfully!");
  } catch (error) {
    console.log("scrapeIfoodLeads Error: ", error);
    return Promise.reject(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

export { scrapeIfoodLeads };

if (process.argv[1] && process.argv[1].includes("scrapeIfoodLeads.js")) {
  scrapeIfoodLeads()
    .then((message) => {
      console.log(message);
      process.exit(0);
    })
    .catch((error) => {
      console.error("scrapeIfoodLeads failed:", error);
      process.exit(1);
    });
}
