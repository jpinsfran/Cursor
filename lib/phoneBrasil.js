/**
 * Telefone brasileiro para Supabase: mesma regra do pipeline (exportaLeadsComContato / ultimate scrape).
 * - Celular: 10 ou 11 dígitos com DDD e 3º dígito 7/8/9; ou 9 dígitos (sem DDD) 7/8/9.
 * - Normaliza para dígitos; com 9 dígitos, antecede DDD via getDddForRow (cidade/UF da URL ou região).
 */

import { cleanText, inferRegionFromRow } from "./leadDataUtils.js";
import { getDddForRow } from "../ddd-brasil.js";

export function phoneDigitsOnly(val) {
  return String(val ?? "").replace(/\D/g, "");
}

/**
 * Celular BR (não fixo): mesmo critério de exportaLeadsComContato.js
 */
export function isCelularBrasil(val) {
  const digits = phoneDigitsOnly(val);
  if (digits.length === 11 || digits.length === 10) {
    return digits[2] === "7" || digits[2] === "8" || digits[2] === "9";
  }
  if (digits.length === 9) {
    return digits[0] === "7" || digits[0] === "8" || digits[0] === "9";
  }
  return false;
}

/**
 * Garante row com regiao/url/name para inferência de DDD (usa inferRegionFromRow).
 */
function rowForDdd(row) {
  return {
    ...row,
    regiao: row.regiao || inferRegionFromRow(row),
    url: row.url || row.ifood_url,
    ifood_url: row.ifood_url || row.url,
  };
}

/**
 * Normaliza para string só dígitos; 9 dígitos → DDD + 9 (quando DDD inferível).
 */
export function normalizePhoneToDigits(row) {
  const raw = cleanText(row.phone || row.telefone || "");
  if (!raw) return "";
  let digits = phoneDigitsOnly(raw);
  if (digits.length === 11) return digits;
  if (digits.length === 10 && isCelularBrasil(digits)) return digits;
  if (digits.length === 9 && isCelularBrasil(digits)) {
    const r = rowForDdd(row);
    const ddd = getDddForRow(r);
    if (ddd && ddd.length >= 2) return String(ddd).replace(/\D/g, "").slice(0, 2) + digits;
  }
  return digits;
}

/**
 * Retorna cópia da linha com phone canônico (dígitos) ou string vazia se inválido/vazio.
 */
export function withCanonicalPhoneForSupabase(row) {
  if (!row || typeof row !== "object") return row;
  const normalized = normalizePhoneToDigits(row);
  return { ...row, phone: normalized };
}
