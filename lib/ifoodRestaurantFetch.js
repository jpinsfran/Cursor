/**
 * Extrai campos da página HTML do restaurante iFood (mesma heurística do scrapeIfoodLeads).
 * Usado também por rescrapeIfoodIncomplete.js para reparar linhas em que o fetch original falhou.
 */

const DEFAULT_TIMEOUT_MS = 35000;

function parseIfoodRestaurantHtml(body) {
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

  try {
    phone = body.split("telephone")[1].split(",")[0].split('":"')[1].split('"')[0];
  } catch (_) {}

  try {
    cnpj = body.split("CNPJ")[3].split('value":"')[1].split('"}')[0];
  } catch (_) {}

  try {
    streetAddress = body.split("streetAddress")[1].split('":"')[1].split('"}')[0];
  } catch (_) {}

  try {
    name = body.split("<title>")[1].split("<")[0];
  } catch (_) {}

  try {
    neighborhood = body.split("district")[1].split('":"')[1].split('"')[0];
  } catch (_) {}

  try {
    zipcode = body.split("zipCode")[1].split('":"')[1].split('"')[0];
  } catch (_) {}

  try {
    rating = body.split("evaluationAverage")[1].split(":")[1].split(",")[0];
  } catch (_) {}

  try {
    const raw = body.split("otpEmail")[1].split(":")[1].split(",")[0].trim();
    email = raw && raw !== "false" && raw !== "null" && /@/.test(raw) ? raw : "";
  } catch (_) {}

  try {
    cuisine = body.split("servesCuisine")[1].split(":")[1].split(",")[0];
  } catch (_) {}

  try {
    priceRange = body.split("priceRange")[1].split(":")[1].split(",")[0];
  } catch (_) {}

  return {
    name,
    phone,
    cnpj,
    streetAddress,
    neighborhood,
    zipcode,
    rating,
    email,
    cuisine,
    priceRange,
  };
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ name, url, phone, cnpj, streetAddress, neighborhood, zipcode, rating, email, cuisine, priceRange, regiao: string }>}
 */
async function fetchIfoodRestaurantRow(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal || controller.signal;

  try {
    const resp = await fetch(url, { signal });
    const body = await resp.text();
    clearTimeout(to);
    const parsed = parseIfoodRestaurantHtml(body);
    return {
      ...parsed,
      url,
      regiao: "",
    };
  } catch (_) {
    clearTimeout(to);
    return {
      name: "",
      phone: "",
      cnpj: "",
      streetAddress: "",
      neighborhood: "",
      zipcode: "",
      rating: "",
      email: "",
      cuisine: "",
      priceRange: "",
      url,
      regiao: "",
    };
  }
}

export { parseIfoodRestaurantHtml, fetchIfoodRestaurantRow, DEFAULT_TIMEOUT_MS };
