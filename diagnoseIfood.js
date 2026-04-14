/**
 * Script de diagnóstico: abre a página do iFood, preenche endereço,
 * inspeciona o DOM e imprime seletores/estrutura para adaptar o scraper.
 */
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import { IFOOD_USER_AGENT } from "./lib/ifoodAddressAutomation.js";
import { findChallengeFrame } from "./lib/ifoodHoldVerification.js";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ADDRESS = "Avenida Engenheiro Gastão Rangel 393";

async function logAllFrames(page) {
  console.log("\n[diagnose] Frames (name | url):");
  for (const f of page.frames()) {
    const u = f.url() || "(empty)";
    const n = f.name() || "";
    console.log(`   ${n || "(sem nome)"} | ${u.slice(0, 180)}`);
  }
}

async function logChallengeFrameHints(page) {
  const frame = findChallengeFrame(page);
  if (!frame) {
    console.log(
      "\n[diagnose] Nenhum iframe de desafio detectado pelas URLs padrão (arkoselabs, captcha, challenge…). Use logAllFrames acima para ajustar frameUrlIncludes."
    );
    return;
  }
  console.log("\n[diagnose] Iframe candidato a verificação:", frame.url().slice(0, 180));
  try {
    const info = await frame.evaluate(() => {
      const out = [];
      const buttons = document.querySelectorAll("button, [role=button]");
      for (let i = 0; i < Math.min(12, buttons.length); i++) {
        const b = buttons[i];
        const r = b.getBoundingClientRect();
        const dataAttrs = [...b.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => `${a.name}=${(a.value || "").slice(0, 50)}`);
        out.push({
          tag: b.tagName,
          className: (b.className || "").slice(0, 120),
          ariaLabel: b.getAttribute("aria-label"),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`,
          dataAttrs,
        });
      }
      return out;
    });
    console.log("[diagnose] Botões no iframe (amostra):", JSON.stringify(info, null, 2));
  } catch (e) {
    console.log("[diagnose] Erro ao ler iframe:", e?.message || e);
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(IFOOD_USER_AGENT);

  console.log("1. Navegando para ifood.com.br/restaurantes ...");
  await page.goto("https://www.ifood.com.br/restaurantes", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 4000));

  // Fluxo de endereço: botão -> input -> digitar (teclado) -> aguardar sugestões -> clicar na sugestão
  const btnSel =
    'button[class*="address-search-input__button"], button[class*="address"]';
  const inputSel =
    'input[class*="address-search-input__field"], input[class*="address"], input[placeholder*="endereço" i], input[placeholder*="Endereço"]';

  console.log("\n2. Clicando no botão de endereço...");
  try {
    await page.waitForSelector(btnSel, { timeout: 10000 });
    await page.click(btnSel);
  } catch (e) {
    console.log("   Botão não encontrado, tentando clicar em área de endereço.");
    await page.evaluate(() => {
      const b = document.querySelector('button[class*="address"], [aria-label*="endereço" i]');
      if (b) b.click();
    });
  }
  await new Promise((r) => setTimeout(r, 1500));

  console.log("   Focando e digitando endereço no input...");
  await page.waitForSelector(inputSel, { timeout: 8000 });
  await page.click(inputSel);
  await new Promise((r) => setTimeout(r, 300));
  await page.keyboard.type(ADDRESS, { delay: 80 });
  await new Promise((r) => setTimeout(r, 3500));

  // Clicar na primeira sugestão de endereço (ou no botão "Confirmar endereço" / container de sugestão)
  console.log("   Clicando na sugestão de endereço...");
  const suggestionClicked = await page.evaluate(() => {
    const selectors = [
      'div[class*="btn-address"]',
      '[class*="address-suggestion"]',
      '[class*="suggestion"] a',
      'button',
      'li a',
      '[role="option"]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return true;
        }
      } catch (_) {}
    }
    const all = document.querySelectorAll('[class*="address"], [class*="suggestion"], button, a');
    for (const el of all) {
      const t = (el.textContent || "").toLowerCase();
      if (t.includes("avenida") || t.includes("rangel") || t.includes("393") || (t.includes("confirmar") && t.length < 25)) {
        el.click();
        return true;
      }
    }
    return false;
  });
  console.log("   Sugestão clicada:", suggestionClicked);
  await new Promise((r) => setTimeout(r, 6000));

  await logAllFrames(page);
  await logChallengeFrameHints(page);

  // Inspecionar links de restaurantes (vários padrões de URL do iFood)
  const linkInfo = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/restaurantes/"], a[href*="/restaurante/"], a[href*="ifood.com.br/delivery/"], a[href*="merchant"]');
    const samples = [];
    const classes = new Set();
    links.forEach((a, i) => {
      if (i < 15) {
        samples.push({
          href: a.getAttribute("href"),
          className: a.className,
          text: (a.textContent || "").slice(0, 60),
        });
      }
      if (a.className) a.className.split(/\s+/).forEach((c) => classes.add(c));
    });
    return {
      totalLinks: links.length,
      samples,
      allClasses: [...classes].filter((c) => c && c.length < 80),
    };
  });

  console.log("\n3. Links de restaurantes encontrados:", linkInfo.totalLinks);
  linkInfo.samples.forEach((s, i) =>
    console.log(`   [${i}] ${s.className || "(no class)"} => ${s.href}`)
  );
  console.log("   Classes usadas nos links:", linkInfo.allClasses.slice(0, 30).join(", "));

  // Procurar botão "Ver mais"
  const verMaisInfo = await page.evaluate(() => {
    const buttons = document.querySelectorAll("button, a, [role=button], [class*='button']");
    const verMais = [];
    buttons.forEach((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      if (t.includes("ver mais") || t === "ver mais") {
        verMais.push({
          tag: el.tagName,
          class: el.className,
          text: t,
        });
      }
    });
    return verMais;
  });
  console.log("\n4. Botões 'Ver mais':", verMaisInfo.length);
  verMaisInfo.forEach((b) => console.log("   ", b.tag, b.class, b.text));

  // Listar todos os seletores possíveis para cards de restaurante
  const possibleSelectors = await page.evaluate(() => {
    const selectors = [
      "a.merchant-v2__link",
      "a[href*='/restaurantes/']",
      "a[href*='/restaurante/']",
      "[class*='merchant'] a",
      "[class*='restaurant'] a",
      "[class*='card'] a[href*='restaurante']",
      "a[class*='link'][href*='restaurante']",
    ];
    const result = {};
    for (const sel of selectors) {
      try {
        const n = document.querySelectorAll(sel).length;
        result[sel] = n;
      } catch (e) {
        result[sel] = "erro";
      }
    }
    return result;
  });
  console.log("\n5. Contagem por seletor:", possibleSelectors);

  // Listar TODOS os links href da página para descobrir padrão
  const allLinks = await page.evaluate(() => {
    const as = document.querySelectorAll("a[href]");
    return [...as].slice(0, 80).map((a) => ({
      href: a.getAttribute("href"),
      class: (a.className || "").slice(0, 60),
    }));
  });
  console.log("\n5b. Amostra de links (href) na página:");
  allLinks.forEach((l, i) => {
    if (l.href && !l.href.startsWith("#") && l.href.length < 120)
      console.log(`   ${i} ${l.class || ""} => ${l.href}`);
  });

  // Salvar HTML completo do body para análise
  const fullBody = await page.evaluate(() => document.body.innerHTML);
  await fs.writeFile(
    "c:\\Users\\jpins\\Documents\\Nola\\ifood-page-snippet.html",
    fullBody.slice(0, 80000),
    "utf8"
  );
  console.log("\n6. HTML do body (até 80k) salvo em ifood-page-snippet.html");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
