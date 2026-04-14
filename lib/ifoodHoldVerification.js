/**
 * Desafio "segurar botão" em iframe: mouse down/up no viewport, leitura de progresso 0..1,
 * regressão → soltar e pressionar de novo.
 */

const DEFAULT_FRAME_URL_INCLUDES = [
  "arkoselabs",
  "funcaptcha",
  "captcha",
  "challenge",
  "client-api",
  "geo.captcha",
  "perimeterx",
];

const DEFAULT_BUTTON_SELECTORS = [
  'button[class*="verify"]',
  'button[class*="hold"]',
  'button[class*="press"]',
  "[data-theme] button",
  'button[type="button"]',
  "button",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string[]} urlIncludes
 * @returns {import("puppeteer").Frame | null}
 */
export function findChallengeFrame(page, urlIncludes = DEFAULT_FRAME_URL_INCLUDES) {
  for (const f of page.frames()) {
    const u = (f.url() || "").toLowerCase();
    if (!u || u === "about:blank") continue;
    for (const sub of urlIncludes) {
      if (u.includes(sub.toLowerCase())) return f;
    }
  }
  return null;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {{ timeoutMs?: number, pollMs?: number, urlIncludes?: string[] }} [opts]
 * @returns {Promise<import("puppeteer").Frame | null>}
 */
export async function waitForChallengeFrame(page, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 110000;
  const pollMs = opts.pollMs ?? 300;
  const urlIncludes = opts.urlIncludes ?? DEFAULT_FRAME_URL_INCLUDES;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const f = findChallengeFrame(page, urlIncludes);
    if (f) return f;
    await sleep(pollMs);
  }
  return null;
}

/**
 * @param {import("puppeteer").Frame} frame
 * @param {string[]} buttonSelectors
 * @returns {Promise<import("puppeteer").ElementHandle | null>}
 */
async function findHoldButtonInFrame(frame, buttonSelectors) {
  for (const sel of buttonSelectors) {
    try {
      const handles = await frame.$$(sel);
      for (const h of handles) {
        const ok = await h.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 40 && r.height > 20 && el.offsetParent !== null;
        });
        if (ok) return h;
        await h.dispose().catch(() => {});
      }
    } catch (_) {}
  }
  return null;
}

/**
 * @param {import("puppeteer").ElementHandle} buttonHandle
 * @returns {Promise<number>}
 */
async function readProgress(buttonHandle) {
  return buttonHandle.evaluate((btn) => {
    if (!btn) return 0;
    const ariaNow = btn.getAttribute("aria-valuenow");
    const ariaMax = btn.getAttribute("aria-valuemax") || "100";
    if (ariaNow != null && !Number.isNaN(parseFloat(ariaNow))) {
      const m = parseFloat(ariaMax) || 100;
      return Math.min(1, Math.max(0, parseFloat(ariaNow) / m));
    }
    const style = window.getComputedStyle(btn);
    const tx = style.transform;
    if (tx && tx.includes("matrix")) {
      const mat = tx.match(/matrix\(([^)]+)\)/);
      if (mat) {
        const parts = mat[1].split(",").map((x) => parseFloat(x.trim()));
        if (parts.length >= 1 && !Number.isNaN(parts[0])) {
          return Math.min(1, Math.max(0, Math.abs(parts[0])));
        }
      }
    }
    const children = btn.querySelectorAll("*");
    for (const el of children) {
      const cs = window.getComputedStyle(el);
      const t = cs.transform;
      if (t && t.includes("matrix")) {
        const mat = t.match(/matrix\(([^)]+)\)/);
        if (mat) {
          const parts = mat[1].split(",").map((x) => parseFloat(x.trim()));
          if (parts.length >= 1 && !Number.isNaN(parts[0])) {
            const sx = Math.abs(parts[0]);
            if (sx > 0.01 && sx <= 1.01) return Math.min(1, sx);
          }
        }
      }
    }
    const inner = btn.querySelector(
      '[class*="progress"], [class*="fill"], [class*="bar"], [style*="width"]'
    );
    if (inner) {
      const ws = inner.getAttribute("style") || "";
      const wm = ws.match(/width\s*:\s*([\d.]+)%/i);
      if (wm) return Math.min(1, parseFloat(wm[1]) / 100);
    }
    return 0;
  });
}

/**
 * Completa o desafio de segurar botão se o iframe existir.
 * @param {import("puppeteer").Page} page
 * @param {{
 *   waitForFrameMs?: number,
 *   frameUrlIncludes?: string[],
 *   buttonSelectors?: string[],
 *   pollMs?: number,
 *   regressionTolerance?: number,
 *   completeThreshold?: number,
 *   completeStreak?: number,
 *   maxTotalMs?: number,
 *   maxCycles?: number,
 * }} [options]
 * @returns {Promise<{ completed: boolean, skipped: boolean, reason?: string }>}
 */
export async function waitAndCompleteHoldChallenge(page, options = {}) {
  const frameUrlIncludes = options.frameUrlIncludes ?? DEFAULT_FRAME_URL_INCLUDES;
  const buttonSelectors = options.buttonSelectors ?? DEFAULT_BUTTON_SELECTORS;
  const pollMs = options.pollMs ?? 100;
  const regressionTolerance = options.regressionTolerance ?? 0.08;
  const completeThreshold = options.completeThreshold ?? 0.97;
  const completeStreak = options.completeStreak ?? 4;
  const maxTotalMs = options.maxTotalMs ?? 140000;
  const maxCycles = options.maxCycles ?? 80;
  const waitForFrameMs = options.waitForFrameMs ?? 65000;

  const frame =
    options._frame ||
    findChallengeFrame(page, frameUrlIncludes) ||
    (await waitForChallengeFrame(page, { timeoutMs: waitForFrameMs, urlIncludes: frameUrlIncludes }));

  if (!frame) {
    return { completed: false, skipped: true, reason: "no_challenge_frame" };
  }

  console.log("[ifood] Verificação: iframe detectado", frame.url().slice(0, 120));

  await sleep(800);

  let buttonHandle = await findHoldButtonInFrame(frame, buttonSelectors);
  if (!buttonHandle) {
    return { completed: false, skipped: false, reason: "button_not_found" };
  }

  const startAll = Date.now();
  let cycle = 0;
  let lastP = 0;
  let streak = 0;
  let holding = false;

  async function centerOf(handle) {
    const box = await handle.boundingBox();
    if (!box) return null;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  while (Date.now() - startAll < maxTotalMs && cycle < maxCycles) {
    const c = await centerOf(buttonHandle);
    if (!c) {
      await buttonHandle.dispose().catch(() => {});
      buttonHandle = await findHoldButtonInFrame(frame, buttonSelectors);
      if (!buttonHandle) return { completed: false, skipped: false, reason: "button_lost" };
      continue;
    }

    await page.mouse.move(c.x, c.y);
    if (!holding) {
      await page.mouse.down();
      holding = true;
      lastP = 0;
      streak = 0;
    }

    await sleep(pollMs);

    let p = 0;
    try {
      p = await readProgress(buttonHandle);
    } catch (_) {
      p = lastP;
    }

    if (p < lastP - regressionTolerance && lastP > 0.05) {
      console.log("[ifood] Verificação: progresso regrediu, soltando e reiniciando");
      await page.mouse.up();
      holding = false;
      lastP = 0;
      streak = 0;
      cycle += 1;
      await sleep(250);
      continue;
    }

    if (p >= lastP) lastP = p;

    if (p >= completeThreshold) {
      streak += 1;
      if (streak >= completeStreak) {
        await page.mouse.up();
        holding = false;
        console.log("[ifood] Verificação: concluída (progresso cheio)");
        await buttonHandle.dispose().catch(() => {});
        await sleep(1500);
        return { completed: true, skipped: false };
      }
    } else {
      streak = 0;
    }

    if (p >= 0.999) {
      await page.mouse.up();
      holding = false;
      await buttonHandle.dispose().catch(() => {});
      await sleep(1500);
      return { completed: true, skipped: false };
    }
  }

  if (holding) await page.mouse.up().catch(() => {});
  await buttonHandle.dispose().catch(() => {});
  return { completed: false, skipped: false, reason: "timeout_or_max_cycles" };
}

/**
 * Se existir iframe de desafio (após breve espera), tenta completar; senão retorna skipped.
 * @param {import("puppeteer").Page} page
 * @param {Parameters<typeof waitAndCompleteHoldChallenge>[1] & { waitForFrameMs?: number }} [options]
 */
export async function maybeCompleteHoldChallenge(page, options = {}) {
  const waitMs = options.waitForFrameMs ?? 32000;
  const urlIncludes = options.frameUrlIncludes ?? DEFAULT_FRAME_URL_INCLUDES;
  const frame =
    findChallengeFrame(page, urlIncludes) ||
    (await waitForChallengeFrame(page, { timeoutMs: waitMs, urlIncludes }));
  if (!frame) {
    return { completed: false, skipped: true, reason: "no_frame" };
  }
  return waitAndCompleteHoldChallenge(page, { ...options, _frame: frame });
}
