/**
 * Obtém o userId (ID numérico) do Instagram a partir do @username ou da URL do perfil.
 * Usa o perfil Chrome persistente (instagram_chrome_profile) para estar logado.
 *
 * Uso:
 *   node getInstagramUserId.js nike
 *   node getInstagramUserId.js "https://www.instagram.com/nike/"
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

const CHROME_USER_DATA_DIR = path.join(process.cwd(), "instagram_chrome_profile");
const INSTAGRAM_BASE = "https://www.instagram.com";

function parseUsername(input) {
  const raw = (input || "").trim().replace(/^@/, "");
  if (!raw) return "";
  const m = raw.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
  return m ? m[1].split("/")[0] : raw.split("/")[0];
}

async function getUserId(username) {
  const profileUrl = `${INSTAGRAM_BASE}/${username}/`;
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: CHROME_USER_DATA_DIR,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2500));
    const isLogin = await page.evaluate(() => window.location.pathname.includes("/accounts/login"));
    if (isLogin) {
      console.error("Perfil exige login. Rode antes: node scrapeInstagram.js --login");
      return { userId: "", profileUrl, error: "login_required" };
    }
    const userId = await page.evaluate(() => {
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
    await browser.close();
    return { userId: userId || "", profileUrl };
  } catch (e) {
    await browser.close().catch(() => {});
    return { userId: "", profileUrl, error: e.message };
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Uso: node getInstagramUserId.js USERNAME ou URL_DO_PERFIL");
    process.exit(1);
  }
  const username = parseUsername(input);
  if (!username) {
    console.error("Username ou URL inválidos.");
    process.exit(1);
  }
  const result = await getUserId(username);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.userId) {
    console.log("profile_url:", result.profileUrl);
    console.log("user_id:", result.userId);
  } else {
    console.error("userId não encontrado na página.");
    process.exit(1);
  }
}

main();
