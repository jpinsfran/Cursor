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

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

// Ex.: "Av Paulista 1000, São Paulo" SP
const FETCH_TIMEOUT_MS = 15000;

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
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      headless: false,
      ignoreHTTPSErrors: true,
      slowMo: 250,
    });

    const [page] = await browser.pages();

    console.log("Navigating to ifood...");
    await page.goto("https://www.ifood.com.br/restaurantes", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 4000));

    // botão "Escolha um endereço" 
    console.log("Opening address modal...");
    const addressBtn =
      'button.delivery-input, .delivery-input, button[class*="address-search-input__button"]';
    await page.waitForSelector(addressBtn, { timeout: 15000 });
    await page.click(addressBtn);
    await new Promise((r) => setTimeout(r, 4000));

    // "Buscar endereço e número" – vários seletores (iFood muda o layout)
    const modalInputSelectors = [
      '.address-search-step input.address-search-input__field:not([disabled])',
      '.address-search-input input.address-search-input__field',
      'input[placeholder*="endereço" i], input[placeholder*="Endereço"]',
      'input[placeholder*="buscar" i], input[placeholder*="Buscar"]',
      '.address-search-input input[type="text"]',
      '[class*="address-search"] input:not([disabled])',
      'form input[type="text"]',
    ];
    let modalInput = null;
    for (const sel of modalInputSelectors) {
      try {
        modalInput = await page.$(sel);
        if (modalInput) break;
      } catch (_) {}
    }
    if (!modalInput) {
      await page.waitForSelector('input[type="text"]', { timeout: 12000 }).catch(() => null);
      modalInput = await page.$('input[type="text"]');
    }
    if (!modalInput) {
      throw new Error("Campo de endereço não encontrado. O iFood pode ter alterado a página.");
    }
    console.log("Address input found.");
    await modalInput.click();
    await new Promise((r) => setTimeout(r, 500));
    await page.keyboard.type(address, { delay: 80 });
    await new Promise((r) => setTimeout(r, 5000));

    // Aguardar sugestões
    try {
      await Promise.race([
        page.waitForSelector(".address-search-list li", { timeout: 12000 }),
        page.waitForSelector(".pac-item", { timeout: 12000 }),
      ]);
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 800));

    // Clicar na primeira sugestão
    console.log("Selecting address suggestion...");
    const suggestionClicked = await page.evaluate(() => {
      const pacItem = document.querySelector(".pac-item, .pac-container .pac-item");
      if (pacItem) {
        pacItem.click();
        return true;
      }
      const list = document.querySelector(".address-search-list");
      if (list) {
        const items = list.querySelectorAll("li a, li button, li [role=button], li");
        for (const el of items) {
          const t = (el.textContent || "").toLowerCase();
          if (t.includes("avenida") || t.includes("rangel") || t.length > 15) {
            el.click();
            return true;
          }
        }
        if (items[0]) {
          items[0].click();
          return true;
        }
      }
      return false;
    });
    console.log("Suggestion clicked:", suggestionClicked);
    await new Promise((r) => setTimeout(r, 8000));

    // Passo "número do endereço" (se aparecer)
    const numberInput = await page.$('.address-number input, input[name*="number"], input[placeholder*="número" i]');
    if (numberInput) {
      const num = (address.match(/\d+/) || ["393"])[0];
      await numberInput.type(num, { delay: 80 });
      await new Promise((r) => setTimeout(r, 1500));
      const confirmBtn = await page.$('.address-number button[type="submit"], .address-number .btn--default, .address-number button.btn');
      if (confirmBtn) await confirmBtn.click();
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Aguardar modal fechar e lista carregar
    await new Promise((r) => setTimeout(r, 6000));
    try {
      await page.waitForFunction(
        () => !document.querySelector(".address-modal-overlay--after-open") || document.querySelector('a[href*="/restaurantes/"], a[href*="/delivery/"]'),
        { timeout: 20000 }
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
        await page.waitForSelector(sel, { timeout: 25000 });
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
            let phone = "";
            let cnpj = "";
            let streetAddress = "";
            let name = "";
            let neighborhood = "";
            let zipcode = "";
            let rating = "";
            let email = "";
            let cuisine = "";
            let priceRange = "";
            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            return fetch(url, { signal: controller.signal })
              .then((resp) => resp.text())
              .then((body) => {
                try {
                  phone = body
                    .split("telephone")[1]
                    .split(",")[0]
                    .split('":"')[1]
                    .split('"')[0];
                } catch (error) {
                  console.log("failed to get phone");
                }

                try {
                  cnpj = body
                    .split("CNPJ")[3]
                    .split('value":"')[1]
                    .split('"}')[0];
                } catch (error) {
                  console.log("failed to get cnpj");
                }

                try {
                  streetAddress = body
                    .split("streetAddress")[1]
                    .split('":"')[1]
                    .split('"}')[0];
                } catch (error) {
                  console.log("failed to get streetAddress");
                }

                try {
                  name = body.split("<title>")[1].split("<")[0];
                } catch (error) {
                  console.log("failed to get name");
                }

                try {
                  neighborhood = body
                    .split("district")[1]
                    .split('":"')[1]
                    .split('"')[0];
                } catch (error) {
                  console.log("failed to get neighborhood");
                }

                try {
                  zipcode = body
                    .split("zipCode")[1]
                    .split('":"')[1]
                    .split('"')[0];
                } catch (error) {
                  console.log("failed to get zipcode");
                }

                try {
                  rating = body
                    .split("evaluationAverage")[1]
                    .split(":")[1]
                    .split(",")[0];
                } catch (error) {
                  console.log("failed to get rating");
                }

                try {
                  const raw = body.split("otpEmail")[1].split(":")[1].split(",")[0].trim();
                  email = raw && raw !== "false" && raw !== "null" && /@/.test(raw) ? raw : "";
                } catch (error) {
                  console.log("failed to get email");
                }

                try {
                  cuisine = body
                    .split("servesCuisine")[1]
                    .split(":")[1]
                    .split(",")[0];
                } catch (error) {
                  console.log("failed to get cuisine");
                }

                try {
                  priceRange = body
                    .split("priceRange")[1]
                    .split(":")[1]
                    .split(",")[0];
                } catch (error) {
                  console.log("failed to get priceRange");
                }

                console.log("Scraped data", {
                  name,
                  url,
                  phone,
                  cnpj,
                  streetAddress,
                  neighborhood,
                  zipcode,
                  rating,
                  email,
                  cuisine,
                  priceRange,
                });

                clearTimeout(to);
                return {
                  name,
                  url,
                  phone,
                  cnpj,
                  streetAddress,
                  neighborhood,
                  zipcode,
                  rating,
                  email,
                  cuisine,
                  priceRange,
                  regiao: suffix,
                };
              })
              .catch((err) => {
                clearTimeout(to);
                return {
                  name,
                  url,
                  phone,
                  cnpj,
                  streetAddress,
                  neighborhood,
                  zipcode,
                  rating,
                  email,
                  cuisine,
                  priceRange,
                  regiao: suffix,
                };
              });
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

    const allData = [...savedData, ...uniqueData];
    console.log("Total data entries:", allData.length);

    console.log("Updating CSV...");
    const leadsContent = await json2csv(allData);
    await fs.writeFile(filePath, "\uFEFF" + leadsContent, "utf8");

    try {
      const { isEnabled, upsertEstabelecimento } = await import("./lib/supabaseLeads.js");
      if (isEnabled()) {
        let n = 0;
        for (const row of allData) {
          const id = await upsertEstabelecimento(row);
          if (id) n++;
        }
        if (n > 0) console.log("[Supabase] Sincronizados", n, "estabelecimentos.");
      }
    } catch (_) {}

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
