/**
 * Encontra o perfil e o userId do Instagram usando CNPJ, nome do estabelecimento e/ou telefone.
 * - CNPJ: consulta Brasil API e usa razão social + nome fantasia + cidade na busca (desambigua por localização).
 * - Nome + cidade/bairro/telefone: monta busca específica para reduzir homônimos.
 *
 * Uso:
 *   node findInstagramByCnpj.js --cnpj 12345678000199
 *   node findInstagramByCnpj.js --name "Pizzaria do Zé" --city "São Paulo"
 *   node findInstagramByCnpj.js --name "Bar do João" --city "Rio" --neighborhood "Copacabana"
 *   node findInstagramByCnpj.js --name "Restaurante X" --city "SP" --phone "11999999999"
 */

import puppeteer from "puppeteer";
import path from "path";

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const CHROME_USER_DATA_DIR = path.join(process.cwd(), "instagram_chrome_profile");
const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";
const INSTAGRAM_PROFILE_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi;
const INSTAGRAM_BASE = "https://www.instagram.com";

function extractFirstInstagramProfileUrl(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== "string") return "";
  const matches = [...htmlOrText.matchAll(INSTAGRAM_PROFILE_REGEX)];
  for (const m of matches) {
    const url = m[0];
    if (!/\/p\//.test(url) && !/\/reel\//.test(url)) return url.replace(/\/+$/, "");
  }
  return "";
}

/** Normaliza CNPJ para só dígitos (14) */
function normalizeCnpj(cnpj) {
  return String(cnpj || "").replace(/\D/g, "").slice(0, 14);
}

/** Busca dados do CNPJ na Brasil API */
async function fetchCnpjData(cnpj) {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return null;
  try {
    const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Erro ao consultar CNPJ:", e.message);
    return null;
  }
}

/** Monta query de busca: prioriza nome fantasia + cidade para achar o perfil certo */
function buildSearchQuery(options) {
  const { name, city, neighborhood, phone, cnpjData } = options;
  const parts = [];
  if (name) parts.push(name.trim());
  if (cnpjData) {
    const fantasia = (cnpjData.nome_fantasia || "").trim();
    const razao = (cnpjData.razao_social || "").trim();
    const municipio = (cnpjData.municipio || "").trim();
    const uf = (cnpjData.uf || "").trim();
    const bairro = (cnpjData.bairro || "").trim();
    if (fantasia && !parts.includes(fantasia)) parts.push(fantasia);
    else if (razao && !parts.length) parts.push(razao);
    if (municipio) parts.push(municipio);
    if (uf) parts.push(uf);
    if (bairro && bairro !== municipio) parts.push(bairro);
  } else {
    if (city) parts.push(city.trim());
    if (neighborhood) parts.push(neighborhood.trim());
    if (phone) parts.push(String(phone).replace(/\D/g, "").slice(-8));
  }
  return parts.filter(Boolean).join(" ");
}

function getArgs() {
  const argv = process.argv.slice(2);
  const get = (key) => {
    const i = argv.indexOf(key);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : "";
  };
  return {
    cnpj: get("--cnpj"),
    name: get("--name"),
    city: get("--city"),
    neighborhood: get("--neighborhood"),
    phone: get("--phone"),
    skipUserId: argv.includes("--no-user-id"),
  };
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

async function getUserIdFromProfilePage(browser, profileUrl) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  let userId = "";
  try {
    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2500));
    if (await page.evaluate(() => window.location.pathname.includes("/accounts/login"))) {
      await page.close();
      return "";
    }
    userId = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const profilePageMatch = html.match(/profilePage_(\d+)/);
      if (profilePageMatch) return profilePageMatch[1];
      const idMatch = html.match(/"id"\s*:\s*"(\d{8,})"/);
      if (idMatch) return idMatch[1];
      const pkMatch = html.match(/"pk"\s*:\s*(\d+)/);
      if (pkMatch) return pkMatch[1];
      const meta = document.querySelector('meta[property="instapp:owner_user_id"]');
      if (meta && meta.content) return meta.content.trim();
      return "";
    });
  } catch (_) {}
  await page.close();
  return userId;
}

async function main() {
  const args = getArgs();
  let cnpjData = null;
  let query = "";

  if (args.cnpj) {
    console.log("Consultando CNPJ na Brasil API...");
    cnpjData = await fetchCnpjData(args.cnpj);
    if (!cnpjData) {
      console.error("CNPJ não encontrado ou API indisponível.");
      process.exit(1);
    }
    console.log("Razão social:", cnpjData.razao_social);
    if (cnpjData.nome_fantasia) console.log("Nome fantasia:", cnpjData.nome_fantasia);
    console.log("Município:", cnpjData.municipio, cnpjData.uf);
    query = buildSearchQuery({
      name: args.name || cnpjData.nome_fantasia || cnpjData.razao_social,
      cnpjData,
    });
  } else if (args.name) {
    query = buildSearchQuery({
      name: args.name,
      city: args.city,
      neighborhood: args.neighborhood,
      phone: args.phone,
    });
  } else {
    console.error("Uso:");
    console.error("  node findInstagramByCnpj.js --cnpj 12345678000199");
    console.error('  node findInstagramByCnpj.js --name "Nome" --city "Cidade" [--neighborhood "Bairro"] [--phone "11999999999"]');
    process.exit(1);
  }

  if (!query.trim()) {
    console.error("Nada para buscar. Informe --cnpj ou --name (e --city se quiser).");
    process.exit(1);
  }

  console.log("Buscando no DuckDuckGo:", query + " instagram");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: CHROME_USER_DATA_DIR,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  try {
    const profileUrl = await searchInstagramByQuery(browser, query);
    if (!profileUrl) {
      console.log("Nenhum perfil Instagram encontrado para essa busca.");
      return;
    }
    const username = profileUrl.replace(/.*instagram\.com\//i, "").replace(/\/.*$/, "");
    console.log("profile_url:", profileUrl);
    console.log("username:", username);

    if (!args.skipUserId) {
      console.log("Obtendo userId (abre perfil no mesmo navegador)...");
      const userId = await getUserIdFromProfilePage(browser, profileUrl);
      if (userId) {
        console.log("user_id:", userId);
      } else {
        console.warn("userId não obtido (perfil pode exigir login). Rode: node scrapeInstagram.js --login");
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
