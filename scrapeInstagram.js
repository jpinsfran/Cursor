/**
 * Scrape Instagram – Etapa 1: extração (bio, seguidores, highlights, 5 posts).
 * Etapa 2: chama instagram_profile_ai.py para perfil_do_lead e punch_line.
 * Não inventar dados; campos vazios quando não houver na fonte.
 *
 * Uso direto:
 *   node scrapeInstagram.js <url_ou_@user> [--out extracao.json]
 *   node scrapeInstagram.js --login   (abre navegador para logar uma vez)
 *
 * Via unificador: runFullInstagramAnalysis(browser, profileUrl, options)
 * Requer: Puppeteer; Python + instagram_profile_ai.py + OPENAI_API_KEY para IA.
 */

import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.instagram.com";
const CHROME_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";
const CHROME_USER_DATA_DIR = path.join(process.cwd(), "instagram_chrome_profile");

const PROFILE_LOAD_MS = 3500;
const HIGHLIGHT_LOAD_MS = 2500;
const POST_LOAD_MS = 2500;
const MAX_HIGHLIGHTS = 15;
const MAX_POSTS = 5;
const PYTHON_TIMEOUT_MS = 90000;

function parseProfileInput(input) {
  const raw = (input || "").trim().replace(/^@/, "");
  if (!raw) return { username: "", profileUrl: "" };
  if (/^https?:\/\//i.test(raw) || /instagram\.com/i.test(raw)) {
    try {
      const url = raw.startsWith("http") ? new URL(raw) : new URL("https://" + raw.replace(/^\/+/, ""));
      const pathname = (url.pathname || "").replace(/\/+$/, "");
      const username = pathname.split("/").filter(Boolean)[0] || raw.replace(/.*instagram\.com\/?/i, "").split("/")[0];
      return { username: username || raw, profileUrl: `https://www.instagram.com/${username || raw}/` };
    } catch (_) {
      const user = raw.replace(/.*instagram\.com\/?/i, "").split("/")[0];
      return { username: user, profileUrl: user ? `https://www.instagram.com/${user}/` : "" };
    }
  }
  return { username: raw.split("/")[0], profileUrl: `https://www.instagram.com/${raw.split("/")[0]}/` };
}

function getArgs() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const useLogin = process.argv.includes("--login");
  const outIdx = process.argv.indexOf("--out");
  const outFile = outIdx !== -1 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : null;
  const { username, profileUrl } = parseProfileInput(argv[0]);
  return { username, profileUrl, outFile, useLogin };
}

/** Executa instagram_profile_ai.py com path do JSON; retorna { perfil_do_lead, punch_line }. */
function runProfileAI(extracaoPath, pythonPath) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "python" : "python3";
    const py = spawn(cmd, [pythonPath, extracaoPath], {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let out = "";
    const t = setTimeout(() => {
      py.kill("SIGTERM");
      reject(new Error("Timeout Python"));
    }, PYTHON_TIMEOUT_MS);
    py.stdout.on("data", (chunk) => { out += chunk; });
    py.on("close", (code, signal) => {
      clearTimeout(t);
      if (signal === "SIGTERM") return reject(new Error("Timeout Python"));
      try {
        const j = JSON.parse(out.trim() || "{}");
        resolve({ perfil_do_lead: j.perfil_do_lead || "", punch_line: j.punch_line || "" });
      } catch (_) {
        resolve({ perfil_do_lead: "", punch_line: "" });
      }
    });
    py.on("error", (err) => { clearTimeout(t); reject(err); });
  });
}

/** Extrai bio, seguidores, links de highlights e dos primeiros 5 posts na página do perfil. */
async function scrapeProfilePage(page, profileUrl) {
  const result = { bio: "", seguidores: "", seguindo: "", posts_count: "", highlightLinks: [], postLinks: [], userId: "" };
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await new Promise((r) => setTimeout(r, PROFILE_LOAD_MS));

  const isLogin = await page.evaluate(() => window.location.pathname.includes("/accounts/login"));
  if (isLogin) return { ...result, error: "login_required" };

  const profile = await page.evaluate(() => {
    const getText = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ""; };
    let bio = "";
    for (const d of document.querySelectorAll("header div")) {
      const t = d.textContent.trim();
      if (t.length > 20 && t.length < 500 && !t.includes("seguidores") && !t.includes("following")) bio = t;
    }
    const all = document.body.innerText || "";
    const followM = all.match(/([\d.,]+(?:K|M|mil)?)\s*(seguidores|followers)/i);
    const followingM = all.match(/([\d.,]+(?:K|M|mil)?)\s*(seguindo|following)/i);
    const postsM = all.match(/([\d.,]+)\s*(publicações|posts)/i);
    const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
      .map((a) => (a.getAttribute("href") || "").replace(/^\/?/, "https://www.instagram.com/").split("?")[0])
      .filter((u) => u && (u.includes("/p/") || u.includes("/reel/")));
    const seen = new Set();
    const uniquePosts = links.filter((u) => { if (seen.has(u)) return false; seen.add(u); return true; }).slice(0, 5);
    const hl = Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]'))
      .map((a) => (a.getAttribute("href") || "").startsWith("http") ? a.getAttribute("href") : "https://www.instagram.com" + a.getAttribute("href"))
      .filter(Boolean);
    const hlUnique = [...new Set(hl)].slice(0, 30);
    return { bio, seguidores: followM ? followM[1].trim() : "", seguindo: followingM ? followingM[1].trim() : "", posts_count: postsM ? postsM[1].trim() : "", postLinks: uniquePosts, highlightLinks: hlUnique };
  });

  result.bio = profile.bio || "";
  result.seguidores = profile.seguidores || "";
  result.seguindo = profile.seguindo || "";
  result.posts_count = profile.posts_count || "";
  result.postLinks = profile.postLinks || [];
  result.highlightLinks = profile.highlightLinks || [];

  const userId = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const m = html.match(/profilePage_(\d+)/) || html.match(/"pk"\s*:\s*(\d+)/) || html.match(/"id"\s*:\s*"(\d{8,})"/);
    return m ? m[1] : "";
  }).catch(() => "");
  result.userId = userId;

  return result;
}

/** Abre cada highlight e coleta título + texto visível. */
async function scrapeHighlights(page, highlightLinks, tempDir) {
  const highlights = [];
  for (let i = 0; i < Math.min(highlightLinks.length, MAX_HIGHLIGHTS); i++) {
    const href = highlightLinks[i];
    try {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise((r) => setTimeout(r, HIGHLIGHT_LOAD_MS));
      const title = await page.evaluate(() => {
        const h = document.querySelector("header") || document.querySelector("section");
        if (!h) return ""; for (const s of h.querySelectorAll("span")) { const t = (s.textContent || "").trim(); if (t.length > 0 && t.length < 80) return t; } return "";
      }).catch(() => "");
      const parts = await page.evaluate(() => {
        const p = []; document.querySelectorAll("span, div[role='button']").forEach((n) => { const t = (n.textContent || "").trim(); if (t.length > 2 && t.length < 500) p.push(t); }); return [...new Set(p)].slice(0, 30);
      }).catch(() => []);
      highlights.push({ titulo: title || `Destaque ${i + 1}`, conteudo_visivel: parts });
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 800));
  }
  return highlights;
}

/** Para cada post (até 5), extrai legenda e salva screenshot da imagem principal em tempDir. */
async function scrapePosts(page, postLinks, tempDir) {
  const posts = [];
  for (let i = 0; i < postLinks.length; i++) {
    const url = postLinks[i];
    const post = { url, legenda: "", image_paths: [] };
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await new Promise((r) => setTimeout(r, POST_LOAD_MS));
      const hasVideo = await page.evaluate(() => !!document.querySelector("video"));
      if (hasVideo) { post.legenda = "[vídeo]"; posts.push(post); await page.goBack({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {}); continue; }
      post.legenda = await page.evaluate(() => {
        const spans = document.querySelectorAll("article span, [role='dialog'] span"); for (const s of spans) { const t = (s.textContent || "").trim(); if (t.length >= 20 && t.length <= 3500) return t; } return "";
      }).catch(() => "");
      const sel = "article img, [role='dialog'] img, main img";
      const hasImg = await page.$(sel);
      if (hasImg && tempDir) {
        const shotPath = path.join(tempDir, `post_${i}.png`);
        await hasImg.screenshot({ path: shotPath }).catch(() => {});
        if (await fs.access(shotPath).then(() => true).catch(() => false)) post.image_paths.push(shotPath);
      }
      posts.push(post);
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 1200));
  }
  return posts;
}

function sanitizeForCsv(str) {
  if (str == null) return "";
  return String(str).replace(/\r\n|\n|\r/g, "; ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Análise completa: scrape + IA. Retorna perfil_do_lead e punch_line.
 * @param {import("puppeteer").Browser} browser - já aberto (ex.: pelo unificaIfoodInstagram)
 * @param {string} profileUrlOrUsername - URL ou @user
 * @param {{ pythonPath?: string, ifoodContext?: object }} options
 */
async function runFullInstagramAnalysis(browser, profileUrlOrUsername, options = {}) {
  const { username, profileUrl } = parseProfileInput(profileUrlOrUsername);
  if (!username) return { error: "username_invalido" };

  const pythonPath = options.pythonPath || path.join(__dirname, "instagram_profile_ai.py");
  const tempDir = path.join(process.cwd(), "instagram_temp", `run_${username}_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });

    const profileData = await scrapeProfilePage(page, profileUrl);
    if (profileData.error) {
      await page.close();
      return { error: profileData.error, profileUrl };
    }

    const highlights = await scrapeHighlights(page, profileData.highlightLinks || [], tempDir);
    const posts = await scrapePosts(page, profileData.postLinks || [], tempDir);

    const extracao = {
      perfil_url: profileUrl,
      bio: profileData.bio || "",
      seguidores: profileData.seguidores || "",
      seguindo: profileData.seguindo || "",
      posts_count: profileData.posts_count || "",
      highlights,
      posts_recentes: posts.map((p) => ({ legenda: p.legenda || "", image_paths: p.image_paths || [] })),
      extraido_em: new Date().toISOString(),
      ifood_context: options.ifoodContext || null,
    };

    const extracaoPath = path.join(tempDir, "extracao.json");
    await fs.writeFile(extracaoPath, JSON.stringify(extracao, null, 2), "utf8");

    const pythonExists = await fs.access(pythonPath).then(() => true).catch(() => false);
    let perfil_do_lead = "";
    let punch_line = "";
    if (pythonExists) {
      try {
        const ai = await runProfileAI(extracaoPath, pythonPath);
        perfil_do_lead = ai.perfil_do_lead || "";
        punch_line = ai.punch_line || "";
      } catch (_) {}
    }

    await page.close();

    return {
      profileUrl,
      userId: profileData.userId || "",
      seguidores: profileData.seguidores || "",
      perfil_do_lead: sanitizeForCsv(perfil_do_lead),
      punch_line: sanitizeForCsv(punch_line),
      conclusao: sanitizeForCsv(perfil_do_lead),
      destaques_visao_geral: "",
      stories_ativos_visao_geral: "",
    };
  } catch (err) {
    if (page) await page.close().catch(() => {});
    return { error: err.message || "erro_desconhecido", profileUrl };
  } finally {
    await fs.rm(tempDir, { recursive: true }).catch(() => {});
  }
}

/** Modo --login: abre Chrome com perfil persistente para logar no Instagram. */
async function runLoginFlow() {
  console.log("Abrindo navegador. Faça login no Instagram e feche a janela (ou aguarde 2 min).");
  console.log("Perfil salvo em:", CHROME_USER_DATA_DIR);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: CHROME_USER_DATA_DIR,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const [page] = await browser.pages();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));
  console.log("Logado? Feche a janela ou aguarde 2 min.");
  await new Promise((r) => setTimeout(r, 120000));
  await browser.close().catch(() => {});
  console.log("Perfil salvo. Nas próximas execuções o script usará essa sessão.");
}

async function main() {
  const { username, profileUrl, outFile, useLogin } = getArgs();
  if (useLogin) {
    await runLoginFlow();
    return;
  }
  if (!profileUrl) {
    console.error("Uso: node scrapeInstagram.js <url ou @usuario> [--out extracao.json]");
    console.error("      node scrapeInstagram.js --login");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: CHROME_USER_DATA_DIR,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  try {
    const result = await runFullInstagramAnalysis(browser, profileUrl, {});
    await browser.close();
    if (result.error) {
      console.warn("Erro:", result.error);
      process.exit(1);
    }
    if (outFile) {
      const full = path.resolve(outFile);
      await fs.writeFile(full, JSON.stringify(result, null, 2), "utf8");
      console.log("Salvo:", full);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    await browser.close().catch(() => {});
    console.error(e);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes("scrapeInstagram")) {
  main();
}

export { runFullInstagramAnalysis, parseProfileInput };
