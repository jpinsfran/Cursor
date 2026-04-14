/**
 * Fluxo de endereço do iFood (modal → busca → sugestão → número opcional).
 * Foco em waits condicionais e preenchimento compatível com inputs controlados (React).
 */

import readline from "readline";

/** Alinhado a diagnoseIfood.js */
export const IFOOD_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ADDRESS_BTN_SELECTORS = [
  "button.delivery-input",
  ".delivery-input",
  'button[class*="address-search-input__button"]',
];

/**
 * Só dentro do modal "Onde você quer receber" — nunca usar placeholder "Buscar" na página inteira
 * (o header tem outro campo parecido e recebia o texto por engano).
 */
const MODAL_INPUT_SELECTORS = [
  '[role="dialog"] .address-search-step input.address-search-input__field:not([disabled])',
  '[role="dialog"] .address-search-input input.address-search-input__field:not([disabled])',
  '[role="dialog"] input.address-search-input__field:not([disabled])',
  '[aria-modal="true"] input.address-search-input__field:not([disabled])',
  '.address-modal-overlay--after-open input.address-search-input__field:not([disabled])',
  '[class*="address-modal"] input.address-search-input__field:not([disabled])',
  '[role="dialog"] input[placeholder*="Buscar endereço" i]:not([disabled])',
  '[aria-modal="true"] input[placeholder*="Buscar endereço" i]:not([disabled])',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {string} prompt */
export function waitForStdinEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => {
      rl.close();
      resolve(undefined);
    });
  });
}

function isManualAddressEnv() {
  const v = String(process.env.IFOOD_MANUAL_ADDRESS || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Aguarda o overlay/modal de endereço (não só o botão da barra).
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 */
export async function waitForAddressModalVisible(page, timeoutMs = 35000) {
  await page
    .waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        const ariaModal = document.querySelector('[aria-modal="true"]');
        const overlay = document.querySelector(
          '.address-modal-overlay--after-open, [class*="address-modal-overlay"]'
        );
        const candidates = [dialog, ariaModal, overlay].filter(Boolean);
        for (const el of candidates) {
          const r = el.getBoundingClientRect?.();
          if (r && r.width > 0 && r.height > 0) return true;
        }
        return false;
      },
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

/**
 * Campo "Buscar endereço e número" somente dentro do modal (evita input do header).
 * @param {import("puppeteer").Page} page
 * @returns {Promise<import("puppeteer").ElementHandle | null>}
 */
export async function findModalAddressInput(page) {
  for (const sel of MODAL_INPUT_SELECTORS) {
    try {
      const h = await page.$(sel);
      if (!h) continue;
      const ok = await h.evaluate((el) => {
        const root = el.closest(
          '[role="dialog"], [aria-modal="true"], [class*="address-modal"], [class*="AddressModal"]'
        );
        return (
          !!root &&
          root.offsetParent !== null &&
          !el.disabled &&
          el.getAttribute("aria-hidden") !== "true"
        );
      });
      if (ok) return h;
      await h.dispose().catch(() => {});
    } catch (_) {}
  }

  const jsHandle = await page.evaluateHandle(() => {
    const roots = [];
    const d = document.querySelector("[role=\"dialog\"]");
    const a = document.querySelector("[aria-modal=\"true\"]");
    const o = document.querySelector(
      ".address-modal-overlay--after-open, [class*=\"address-modal-overlay\"]"
    );
    if (d) roots.push(d);
    if (a) roots.push(a);
    if (o) roots.push(o);
    for (const root of roots) {
      if (!root || root.offsetParent === null) continue;
      const inp = root.querySelector(
        "input.address-search-input__field:not([disabled]), input[placeholder*=\"Buscar endereço\" i]:not([disabled]), .address-search-input input[type=\"text\"]:not([disabled])"
      );
      if (inp && inp.offsetParent !== null) return inp;
    }
    return null;
  });
  const el = jsHandle.asElement();
  if (el) return el;
  await jsHandle.dispose().catch(() => {});
  return null;
}

/**
 * @param {import("puppeteer").Page} page
 */
export async function openAddressModal(page) {
  const addressBtn = ADDRESS_BTN_SELECTORS.join(", ");
  await page.waitForSelector(addressBtn, { timeout: 35000 });
  await page.click(addressBtn);
}

/**
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 * @returns {Promise<import("puppeteer").ElementHandle | null>}
 */
export async function waitForAddressInput(page, timeoutMs = 40000) {
  await waitForAddressModalVisible(page, Math.min(timeoutMs, 35000));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const h = await findModalAddressInput(page);
    if (h) return h;
    await sleep(250);
  }
  return findModalAddressInput(page);
}

/**
 * @param {import("puppeteer").ElementHandle} inputHandle
 * @param {string} value
 */
async function setReactInputValue(inputHandle, value) {
  await inputHandle.evaluate((el, v) => {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/**
 * Clique no campo de busca do modal: iFood/React muitas vezes exige clique no wrapper
 * (.address-search-input) e responde melhor a el.click() + eventos do que só coordenadas.
 * @param {import("puppeteer").Page} page
 * @param {import("puppeteer").ElementHandle} inputHandle
 */
export async function clickModalSearchFieldToActivate(page, inputHandle) {
  await inputHandle.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const wrap =
      el.closest(".address-search-input") ||
      el.closest(".address-search-step") ||
      el.closest('[class*="AddressSearch"]') ||
      el.closest("label") ||
      el.parentElement;
    if (wrap) {
      wrap.scrollIntoView({ block: "center", inline: "nearest" });
      try {
        wrap.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window })
        );
        wrap.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
        );
        wrap.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window })
        );
        wrap.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
        );
        wrap.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
        );
      } catch (_) {
        wrap.click();
      }
    }
    try {
      el.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window })
      );
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window })
      );
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      el.click();
    } catch (_) {
      el.focus();
    }
    el.focus();
  });

  await sleep(120);
  try {
    await inputHandle.click({ delay: 60, force: true });
  } catch (_) {}

  const box = await inputHandle.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(Math.round(x), Math.round(y));
    await sleep(40);
    await page.mouse.down();
    await sleep(40);
    await page.mouse.up();
  }
  await sleep(300);
  await inputHandle.focus();
}

/**
 * @param {import("puppeteer").Page} page
 * @param {import("puppeteer").ElementHandle} inputHandle
 * @param {string} address
 * @param {{ typeDelay?: number }} [opts]
 */
export async function fillAddressInput(page, inputHandle, address, opts = {}) {
  const typeDelay = opts.typeDelay ?? 50;
  await clickModalSearchFieldToActivate(page, inputHandle);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(address, { delay: typeDelay });

  await sleep(300);
  let val = await inputHandle.evaluate((el) => el.value || "");
  if (val.length < Math.min(address.length * 0.4, 5)) {
    await setReactInputValue(inputHandle, address);
    await sleep(200);
    val = await inputHandle.evaluate((el) => el.value || "");
  }
  if (val.length < Math.min(address.length * 0.4, 5)) {
    throw new Error(
      "[ifood] Campo de endereço não aceitou o texto (React?). Verifique seletores ou layout."
    );
  }
}

/**
 * Verifica se existe alguma sugestão visível (Google Places, listbox iFood, etc.).
 */
function suggestionVisiblePredicate() {
  const candidates = [
    ...document.querySelectorAll(".pac-item"),
    ...document.querySelectorAll(".pac-container .pac-item"),
    ...document.querySelectorAll('[role="option"]'),
    ...document.querySelectorAll(".address-search-list li"),
    ...document.querySelectorAll('[class*="address-search-list"] li'),
    ...document.querySelectorAll('[class*="AddressSearch"] [role="option"]'),
    ...document.querySelectorAll("ul[role='listbox'] li"),
  ];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    if (
      r.width > 0 &&
      r.height > 0 &&
      st.display !== "none" &&
      st.visibility !== "hidden" &&
      parseFloat(st.opacity || "1") > 0.05
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 */
export async function waitForAddressSuggestions(page, timeoutMs = 40000) {
  try {
    await page.waitForFunction(suggestionVisiblePredicate, { timeout: timeoutMs });
  } catch (_) {
    try {
      await Promise.race([
        page.waitForSelector(".address-search-list li", { timeout: 24000 }),
        page.waitForSelector(".pac-item", { timeout: 24000 }),
        page.waitForSelector('[role="option"]', { timeout: 24000 }),
      ]);
    } catch (_) {}
  }
  await sleep(500);
}

/** Palavras-chave a partir do endereço para casar sugestão (sem inventar dados). */
function suggestionKeywordsFromAddress(address) {
  const parts = address.split(/[,\s]+/).filter(Boolean);
  const kws = [];
  for (const p of parts) {
    const t = p.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (t.length >= 3) kws.push(t);
  }
  if (kws.length === 0) {
    const m = address.match(/\d+/);
    if (m) kws.push(m[0]);
  }
  return [...new Set(kws)].slice(0, 8);
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} address
 */
export async function selectAddressSuggestion(page, address) {
  const keywords = suggestionKeywordsFromAddress(address);
  const clicked = await page.evaluate((kws) => {
    function visible(el) {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        st.display !== "none" &&
        st.visibility !== "hidden" &&
        parseFloat(st.opacity || "1") > 0.05
      );
    }

    function findVisibleSuggestionClickable() {
      const pacItems = [...document.querySelectorAll(".pac-container .pac-item, .pac-item")];
      for (const el of pacItems) {
        if (visible(el)) return el;
      }
      const options = [...document.querySelectorAll('[role="option"]')];
      for (const el of options) {
        if (visible(el)) return el;
      }
      const list = document.querySelector(".address-search-list, [class*='address-search-list']");
      if (list) {
        const items = list.querySelectorAll("li a, li button, li [role=button], li, li span");
        for (const el of items) {
          if (visible(el)) return el;
        }
      }
      const loose = document.querySelectorAll(
        '[class*="suggestion"] a, [class*="Suggestion"], [data-testid*="address"] li'
      );
      for (const el of loose) {
        if (visible(el)) return el;
      }
      return null;
    }

    const clickable = findVisibleSuggestionClickable();
    if (clickable) {
      clickable.click();
      return { ok: true, mode: "first_visible" };
    }

    const pacItem = document.querySelector(".pac-item, .pac-container .pac-item");
    if (pacItem) {
      pacItem.click();
      return { ok: true, mode: "pac_any" };
    }

    const list = document.querySelector(".address-search-list, [class*='address-search-list']");
    if (list) {
      const items = list.querySelectorAll("li a, li button, li [role=button], li");
      for (const el of items) {
        const t = (el.textContent || "").toLowerCase();
        for (const k of kws) {
          if (k && t.includes(k)) {
            el.click();
            return { ok: true, mode: "keyword" };
          }
        }
      }
      for (const el of items) {
        const t = (el.textContent || "").trim();
        if (t.length > 8) {
          el.click();
          return { ok: true, mode: "long_text" };
        }
      }
      if (items[0]) {
        items[0].click();
        return { ok: true, mode: "first_li" };
      }
    }
    return { ok: false, mode: "none" };
  }, keywords);

  if (clicked && typeof clicked === "object" && "ok" in clicked) {
    return /** @type {{ ok: boolean, mode: string }} */ (clicked);
  }
  return { ok: !!clicked, mode: "legacy" };
}

/**
 * Primeira sugestão visível: primeiro el.click() no DOM (React), depois coordenadas.
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 */
export async function clickFirstAddressSuggestion(page, timeoutMs = 35000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const domClick = await page.evaluate(() => {
      function visible(el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return (
          r.width > 8 &&
          r.height > 8 &&
          st.display !== "none" &&
          st.visibility !== "hidden" &&
          parseFloat(st.opacity || "1") > 0.05
        );
      }
      const el =
        [...document.querySelectorAll(".pac-item")].find(visible) ||
        [...document.querySelectorAll('[role="option"]')].find(visible) ||
        [...document.querySelectorAll(".address-search-list li, [class*='address-search-list'] li")].find(
          visible
        );
      if (!el) return false;
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
      try {
        el.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
        );
        el.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
        );
        el.click();
      } catch (_) {
        el.click();
      }
      return true;
    });
    if (domClick) return true;

    const rect = await page.evaluate(() => {
      function visible(el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return (
          r.width > 8 &&
          r.height > 8 &&
          st.display !== "none" &&
          st.visibility !== "hidden"
        );
      }
      const el =
        [...document.querySelectorAll(".pac-item")].find(visible) ||
        [...document.querySelectorAll('[role="option"]')].find(visible);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)) {
      await page.mouse.click(Math.round(rect.x), Math.round(rect.y));
      return true;
    }
    await sleep(200);
  }
  return false;
}

/**
 * Clica elemento visível cujo texto contém uma das substrings.
 * Botões vermelhos do iFood podem ser div/span, não só <button>.
 * @param {import("puppeteer").Page} page
 * @param {string[]} textNeedles
 * @param {number} timeoutMs
 */
export async function clickButtonContainingText(page, textNeedles, timeoutMs = 45000) {
  const needles = textNeedles.map((s) => s.toLowerCase());
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const domClick = await page.evaluate((needles) => {
      const root =
        document.querySelector('[role="dialog"]') ||
        document.querySelector("[aria-modal=\"true\"]") ||
        document.querySelector(".address-modal-overlay--after-open") ||
        document.body;
      const candidates = root.querySelectorAll(
        'button, [role="button"], a[href], input[type="submit"], [class*="btn"], [class*="Button"], div[tabindex="0"]'
      );
      for (const el of candidates) {
        if (!el.offsetParent) continue;
        const t = (el.textContent || el.innerText || el.value || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (t.length < 3) continue;
        for (const n of needles) {
          if (n && t.includes(n)) {
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            el.scrollIntoView({ block: "center", behavior: "auto" });
            try {
              el.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
              );
              el.dispatchEvent(
                new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
              );
              el.click();
            } catch (_) {
              el.click();
            }
            return true;
          }
        }
      }
      return false;
    }, needles);
    if (domClick) return true;

    const rect = await page.evaluate((needles) => {
      const root =
        document.querySelector('[role="dialog"]') ||
        document.querySelector("[aria-modal=\"true\"]") ||
        document.querySelector(".address-modal-overlay--after-open") ||
        document.body;
      const candidates = root.querySelectorAll(
        'button, [role="button"], a[href], input[type="submit"], [class*="btn"], [class*="Button"], div[tabindex="0"]'
      );
      for (const el of candidates) {
        if (!el.offsetParent) continue;
        const t = (el.textContent || el.innerText || el.value || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        for (const n of needles) {
          if (n && t.includes(n)) {
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
      }
      return null;
    }, needles);
    if (rect) {
      await page.mouse.click(Math.round(rect.x), Math.round(rect.y));
      return true;
    }
    await sleep(280);
  }
  return false;
}

/**
 * Rola o conteúdo do modal de endereço até o fim (o botão "Salvar endereço" costuma ficar abaixo da dobra).
 * @param {import("puppeteer").Page} page
 */
export async function scrollAddressModalToBottom(page) {
  await page.evaluate(() => {
    const root =
      document.querySelector("[role=dialog]") ||
      document.querySelector("[aria-modal='true']") ||
      document.querySelector(".address-modal-overlay--after-open");
    if (!root) return;
    function scrollEl(el) {
      if (!el) return;
      if (el.scrollHeight > el.clientHeight + 15) {
        el.scrollTop = el.scrollHeight;
      }
      for (const c of el.children) {
        scrollEl(c);
      }
    }
    scrollEl(root);
    root.scrollTop = root.scrollHeight;
  });
  await sleep(350);
}

/**
 * Clica em "Salvar endereço" (CTA vermelho no rodapé do formulário).
 * Mais específico que clickButtonContainingText: rola o modal, prioriza botão grande / fundo vermelho
 * e repete clique DOM + mouse (mesma ideia do fluxo que funciona em "Confirmar localização").
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 */
export async function clickSalvarEnderecoButton(page, timeoutMs = 48000) {
  const needle = "salvar endereço";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await scrollAddressModalToBottom(page);

    const clicked = await page.evaluate(() => {
      const root =
        document.querySelector("[role=dialog]") ||
        document.querySelector("[aria-modal='true']") ||
        document.querySelector(".address-modal-overlay--after-open") ||
        document.body;

      const nodes = root.querySelectorAll(
        "button, [role='button'], input[type='submit'], a[href], [class*='btn']"
      );
      const matches = [];
      for (const el of nodes) {
        if (!el.offsetParent) continue;
        const t = (el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (!t.includes("salvar endereço")) continue;
        if (t.length > 80) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 12) continue;
        const st = getComputedStyle(el);
        const bg = (st.backgroundColor || "").toLowerCase();
        const redish =
          bg.includes("rgb(255") ||
          bg.includes("rgb(234") ||
          bg.includes("rgb(230") ||
          bg.includes("rgb(226") ||
          bg.includes("rgb(220") ||
          /#[ec][0-9a-f]{5}/i.test(bg) ||
          (el.className && /btn--primary|primary|red|danger|default/i.test(el.className));
        const area = r.width * r.height;
        matches.push({ el, area, redish, r });
      }
      if (matches.length === 0) return null;
      matches.sort((a, b) => {
        if (a.redish !== b.redish) return b.redish ? 1 : -1;
        return b.area - a.area;
      });
      const best = matches[0].el;
      best.scrollIntoView({ block: "end", behavior: "auto" });
      try {
        best.focus?.();
        best.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window })
        );
        best.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        best.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window })
        );
        best.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        best.click();
      } catch (_) {
        best.click();
      }
      const r = best.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (clicked && typeof clicked.x === "number") {
      await sleep(120);
      await page.mouse.move(Math.round(clicked.x), Math.round(clicked.y));
      await page.mouse.click(Math.round(clicked.x), Math.round(clicked.y));
      return true;
    }

    const fallback = await clickButtonContainingText(page, ["salvar endereço"], 800);
    if (fallback) return true;

    await sleep(400);
  }
  return false;
}

/**
 * Fallback: foco no input do modal + seta para baixo + Enter (Places / listbox).
 * @param {import("puppeteer").Page} page
 */
export async function selectAddressSuggestionByKeyboard(page) {
  const input = await findModalAddressInput(page);
  if (!input) return false;

  try {
    await clickModalSearchFieldToActivate(page, input);
    await sleep(200);
    await page.keyboard.press("ArrowDown");
    await sleep(250);
    await page.keyboard.press("Enter");
    await sleep(400);
    return true;
  } finally {
    await input.dispose().catch(() => {});
  }
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} address
 */
export async function fillAddressNumberIfPresent(page, address) {
  const numberInput = await page.$(
    '.address-number input, input[name*="number"], input[placeholder*="número" i]'
  );
  if (!numberInput) return false;
  const num = (address.match(/\d+/) || [])[0];
  if (!num) return false;
  await numberInput.focus();
  await numberInput.type(num, { delay: 60 });
  await sleep(500);
  const confirmBtn = await page.$(
    '.address-number button[type="submit"], .address-number .btn--default, .address-number button.btn'
  );
  if (confirmBtn) await confirmBtn.click();
  await sleep(1500);
  return true;
}

/**
 * Aguarda links de restaurante, iframe de desafio, ou sumiço do overlay de endereço.
 * @param {import("puppeteer").Page} page
 * @param {number} timeoutMs
 */
export async function waitAfterAddressUntilListOrChallenge(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const hasMerchant = !!document.querySelector(
        'a[href*="/restaurantes/"], a[href*="/delivery/"]'
      );
      const iframes = [...document.querySelectorAll("iframe")];
      let challengeIframe = false;
      for (const f of iframes) {
        const s = (f.getAttribute("src") || "").toLowerCase();
        if (
          s.includes("arkoselabs") ||
          s.includes("funcaptcha") ||
          s.includes("captcha") ||
          s.includes("challenge") ||
          s.includes("geo.") ||
          s.includes("client-api")
        ) {
          challengeIframe = true;
          break;
        }
      }
      const overlay = document.querySelector(".address-modal-overlay--after-open");
      const overlayOpen = !!(overlay && overlay.offsetParent !== null);
      return { hasMerchant, challengeIframe, overlayOpen };
    });
    if (state.hasMerchant || state.challengeIframe) return state;
    if (!state.overlayOpen) {
      await sleep(400);
      const hasMerchant2 = await page.evaluate(
        () => !!document.querySelector('a[href*="/restaurantes/"], a[href*="/delivery/"]')
      );
      if (hasMerchant2) return { hasMerchant: true, challengeIframe: false, overlayOpen: false };
    }
    await sleep(250);
  }
  return { hasMerchant: false, challengeIframe: false, overlayOpen: true };
}

/**
 * Fluxo completo: modal → texto → sugestão → número → espera pós-endereço.
 * @param {import("puppeteer").Page} page
 * @param {string} address
 * @param {{
 *   modalOpenWaitMs?: number,
 *   typeDelay?: number,
 *   suggestionTimeoutMs?: number,
 *   manualAddressStep?: boolean,
 * }} [options]
 */
export async function runAddressFlow(page, address, options = {}) {
  const modalOpenWaitMs = options.modalOpenWaitMs ?? 1200;
  const typeDelay = options.typeDelay ?? 50;
  const suggestionTimeoutMs = options.suggestionTimeoutMs ?? 42000;
  const manualAddressStep =
    options.manualAddressStep !== undefined ? options.manualAddressStep : isManualAddressEnv();

  console.log("[ifood] Fase: abrir modal endereço");
  await openAddressModal(page);
  await sleep(modalOpenWaitMs);

  console.log("[ifood] Fase: aguardar campo de busca");
  const inputHandle = await waitForAddressInput(page, 40000);
  if (!inputHandle) {
    throw new Error("[ifood] Campo de endereço não encontrado.");
  }

  if (manualAddressStep) {
    console.log(
      "[ifood] Modo manual (IFOOD_MANUAL_ADDRESS): digite o endereço no modal, escolha a primeira sugestão no navegador, depois volte ao terminal e pressione Enter para continuar."
    );
    try {
      await waitForStdinEnter("Pressione Enter aqui após selecionar a sugestão de endereço… ");
    } finally {
      await inputHandle.dispose().catch(() => {});
    }
  } else {
    console.log("[ifood] Fase: preencher endereço");
    try {
      await fillAddressInput(page, inputHandle, address, { typeDelay });
    } finally {
      await inputHandle.dispose().catch(() => {});
    }

    console.log("[ifood] Fase: aguardar sugestões");
    await waitForAddressSuggestions(page, suggestionTimeoutMs);

    const visibleYet = await page.evaluate(suggestionVisiblePredicate).catch(() => false);
    if (!visibleYet) {
      console.log("[ifood] Nenhuma sugestão visível ainda; aguardando mais 3s…");
      await sleep(3000);
    }

    console.log("[ifood] Fase: selecionar sugestão");
    let suggestionOk = await clickFirstAddressSuggestion(page, 36000);
    console.log("[ifood] Primeira sugestão (clique por coordenadas):", suggestionOk);
    if (!suggestionOk) {
      const sel = await selectAddressSuggestion(page, address);
      suggestionOk = sel.ok;
      console.log("[ifood] Sugestão (clique DOM):", sel);
    }
    if (!suggestionOk) {
      console.log("[ifood] Tentando fallback teclado (↓ Enter)…");
      const kb = await selectAddressSuggestionByKeyboard(page);
      console.log("[ifood] Fallback teclado:", kb);
      suggestionOk = kb;
    }
    if (!suggestionOk) {
      console.warn(
        "[ifood] Aviso: não foi possível confirmar seleção da sugestão. O modal pode continuar aberto."
      );
    }
  }

  await sleep(900);

  console.log("[ifood] Fase: confirmar localização (mapa)");
  const okConfirmarMapa = await clickButtonContainingText(
    page,
    ["confirmar localização"],
    34000
  );
  console.log("[ifood] Botão Confirmar localização:", okConfirmarMapa);

  await sleep(700);

  console.log("[ifood] Fase: número do imóvel (se existir)");
  await fillAddressNumberIfPresent(page, address);

  await sleep(500);
  await scrollAddressModalToBottom(page);

  console.log("[ifood] Fase: salvar endereço");
  const okSalvar = await clickSalvarEnderecoButton(page, 48000);
  console.log("[ifood] Botão Salvar endereço:", okSalvar);

  await sleep(1200);

  console.log("[ifood] Fase: aguardar lista ou desafio de verificação");
  const waitState = await waitAfterAddressUntilListOrChallenge(page, 48000);
  console.log("[ifood] Pós-endereço:", waitState);

  try {
    await page.waitForFunction(
      () =>
        !document.querySelector(".address-modal-overlay--after-open") ||
        !!document.querySelector('a[href*="/restaurantes/"], a[href*="/delivery/"]'),
      { timeout: 35000 }
    );
  } catch (_) {}
}
