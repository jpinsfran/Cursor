/**
 * Mapeamento e lookup de DDD por cidade/estado (Brasil).
 * Usa ddd-cidades.json (gerado por build-ddd-map.js a partir de fontes Anatel/Wikipédia).
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let map = { cidades: {}, estados: {} };

try {
  const raw = readFileSync(join(__dirname, "ddd-cidades.json"), "utf8");
  map = JSON.parse(raw);
} catch (_) {}

/** Normaliza nome para busca: sem acentos, maiúsculo, espaços simples. */
export function normalizeCidade(str) {
  if (str == null || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Retorna DDD (2 dígitos) para cidade normalizada, ou null. */
export function getDddPorCidade(cidadeNormalizada) {
  if (!cidadeNormalizada) return null;
  const d = map.cidades[cidadeNormalizada];
  return d != null ? String(d).padStart(2, "0") : null;
}

/** Retorna DDD padrão do estado (UF 2 letras), ou null. */
export function getDddPorEstado(uf) {
  if (!uf || typeof uf !== "string") return null;
  const u = uf.toUpperCase().replace(/\s/g, "").slice(0, 2);
  const d = map.estados[u];
  return d != null ? String(d).padStart(2, "0") : null;
}

/**
 * Extrai cidade e UF de uma linha do CSV (iFood).
 * Ordem: coluna regiao; depois slug da URL (delivery/cidade-uf/); depois trecho entre | no name.
 */
export function extractCidadeUfFromRow(row) {
  let cidade = "";
  let uf = "";

  if (row.regiao && String(row.regiao).trim()) {
    cidade = String(row.regiao).trim();
  }
  if (row.url && typeof row.url === "string") {
    const m = row.url.match(/\/delivery\/([^/]+)-([a-z]{2})(?:\/|$)/i);
    if (m) {
      const slug = m[1];
      const state = m[2];
      if (!cidade) cidade = slug.replace(/-/g, " ");
      if (state) uf = state.toUpperCase();
    }
  }
  if (!cidade && row.name && typeof row.name === "string") {
    const bar = row.name.match(/\|\s*([^|]+)\s*\|/);
    if (bar) cidade = bar[1].replace(/\s*\|\s*iFood\s*$/i, "").trim();
  }

  const cidadeNorm = normalizeCidade(cidade);
  return { cidade: cidadeNorm, uf: uf ? uf.slice(0, 2) : "" };
}

/**
 * Retorna o DDD a usar para esta linha: por cidade, depois por UF, depois fallback (param).
 */
export function getDddForRow(row, fallbackDdd = null) {
  const { cidade, uf } = extractCidadeUfFromRow(row);
  const porCidade = getDddPorCidade(cidade);
  if (porCidade) return porCidade;
  const porEstado = getDddPorEstado(uf);
  if (porEstado) return porEstado;
  const fallback = fallbackDdd != null ? String(fallbackDdd).replace(/\D/g, "").slice(0, 2) : null;
  return fallback || null;
}

export default { normalizeCidade, getDddPorCidade, getDddPorEstado, extractCidadeUfFromRow, getDddForRow };
