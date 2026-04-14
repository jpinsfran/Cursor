/**
 * Diagnóstico de hit-testing: elementFromPoint no centro do input do modal,
 * estrutura do modal e (opcionalmente) da lista Places após digitar.
 *
 * Uso: node diagnoseIfoodClicks.js [endereco_para_teste]
 * Ex.: node diagnoseIfoodClicks.js "Centro, Bauru, SP"
 */
import "dotenv/config";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import {
  IFOOD_USER_AGENT,
  openAddressModal,
  waitForAddressInput,
} from "./lib/ifoodAddressAutomation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const address = process.argv[2] || "Centro, Bauru, SP";

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(IFOOD_USER_AGENT);

  console.log("\n=== 1) Navegando para /restaurantes ===\n");
  await page.goto("https://www.ifood.com.br/restaurantes", {
    waitUntil: "domcontentloaded",
    timeout: 65000,
  });
  await sleep(4000);

  console.log("=== 2) Abrindo modal de endereço ===\n");
  await openAddressModal(page);
  await sleep(1500);

  const inputHandle = await waitForAddressInput(page, 40000);
  if (!inputHandle) {
    console.error("Campo do modal não encontrado.");
    await browser.close();
    process.exit(1);
  }

  const box = await inputHandle.boundingBox();
  const info = await inputHandle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      center: { cx, cy },
      inputTag: el.tagName,
      inputClass: el.className,
      inputPlaceholder: el.getAttribute("placeholder") || "",
      topTag: top ? top.tagName : null,
      topClass: top ? top.className : null,
      topId: top ? top.id : null,
      sameAsInput: top === el,
    };
  });

  console.log("Bounding box (viewport):", box);
  console.log("Centro (getBoundingClientRect):", info.center);
  console.log("Input:", info.inputTag, "| class:", String(info.inputClass).slice(0, 120));
  console.log("Placeholder:", info.inputPlaceholder);
  console.log("elementFromPoint(centro):", info.topTag, "| class:", String(info.topClass || "").slice(0, 120));
  console.log("elementFromPoint === input?", info.sameAsInput);
  if (!info.sameAsInput && info.topTag) {
    console.log(
      "\n[diag] ATENÇÃO: o centro do retângulo do input não é o próprio input — outro elemento está no topo (overlay, wrapper, etc.).\n"
    );
  }

  const modalSnippet = await page.evaluate(() => {
    const dialog =
      document.querySelector("[role=dialog]") ||
      document.querySelector("[aria-modal=true]") ||
      document.querySelector(".address-modal-overlay--after-open");
    if (!dialog) return "(sem dialog/overlay encontrado)";
    const html = dialog.outerHTML || "";
    return html.length > 12000 ? html.slice(0, 12000) + "\n... [truncado]" : html;
  });
  console.log("\n=== 3) HTML do modal/overlay (até ~12k chars) ===\n");
  console.log(modalSnippet);

  console.log("\n=== 4) Digitando endereço de teste e reavaliando Places ===\n");
  await inputHandle.focus();
  await page.keyboard.type(address, { delay: 40 });
  await sleep(5000);

  const placesInfo = await page.evaluate(() => {
    const pac = document.querySelector(".pac-container");
    const first = document.querySelector(".pac-item");
    let fromPoint = null;
    if (first) {
      const r = first.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      fromPoint = {
        cx,
        cy,
        topTag: top ? top.tagName : null,
        topClass: top ? top.className : "",
        sameAsPacItem: top === first,
      };
    }
    const pacHtml = pac
      ? pac.outerHTML.length > 6000
        ? pac.outerHTML.slice(0, 6000) + "\n... [truncado]"
        : pac.outerHTML
      : "(sem .pac-container)";
    return { fromPoint, pacHtml };
  });

  console.log("elementFromPoint no centro do primeiro .pac-item:", placesInfo.fromPoint);
  console.log("\n=== 5) HTML .pac-container (até ~6k) ===\n");
  console.log(placesInfo.pacHtml);

  await inputHandle.dispose().catch(() => {});

  console.log("\n=== Fim do diagnóstico. Feche o navegador ou aguarde 30s. ===\n");
  await sleep(30000);
  await browser.close().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
