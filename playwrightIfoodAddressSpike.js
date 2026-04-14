/**
 * Spike Playwright: mesmo fluxo inicial de endereço (abrir modal → campo → digitar → 1ª sugestão).
 * Para comparar com Puppeteer quando cliques falham (actionability / retries).
 *
 * Uso: node playwrightIfoodAddressSpike.js [endereco]
 * Requer: npx playwright install chromium (ou channel chrome)
 */
import { chromium } from "playwright";

const ADDRESS = process.argv[2] || "Centro, Bauru, SP";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    channel: process.env.PW_CHANNEL || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("[playwright-spike] Abrindo ifood…");
  await page.goto("https://www.ifood.com.br/restaurantes", {
    waitUntil: "domcontentloaded",
    timeout: 65000,
  });
  await sleep(4000);

  const openBtn = page.locator(
    "button.delivery-input, .delivery-input, button[class*='address-search-input__button']"
  );
  await openBtn.first().click({ timeout: 35000 });
  await sleep(1500);

  const dialogInput = page
    .locator('[role="dialog"] input.address-search-input__field')
    .or(page.locator('[aria-modal="true"] input.address-search-input__field'))
    .first();
  await dialogInput.waitFor({ state: "visible", timeout: 40000 });
  await dialogInput.click();
  await sleep(300);
  await dialogInput.fill(ADDRESS);
  console.log("[playwright-spike] Texto preenchido no campo do modal.");
  await sleep(5000);

  const firstPac = page.locator(".pac-item").first();
  try {
    await firstPac.click({ timeout: 20000 });
    console.log("[playwright-spike] Clique em .pac-item:first.");
  } catch (e) {
    console.warn("[playwright-spike] Sem .pac-item ou clique falhou:", e?.message || e);
  }

  console.log(
    "[playwright-spike] Encerrando em 45s (feche antes se quiser). Estenda o script para Confirmar/Salvar se fizer sentido."
  );
  await sleep(45000);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
