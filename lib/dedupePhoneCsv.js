/**
 * Deduplica linhas de planilha por telefone canônico (só dígitos, mín. 10).
 * Mantém a primeira ocorrência na ordem do array (ex.: CSV antigo + linhas novas do scrape).
 */

import { phoneDigitsOnly } from "./phoneBrasil.js";

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ phoneKey?: string }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function dedupeRowsByCanonicalPhone(rows, options = {}) {
  const phoneKey = options.phoneKey || "phone";
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const digits = phoneDigitsOnly(row[phoneKey] ?? "");
    if (digits.length >= 10) {
      if (seen.has(digits)) continue;
      seen.add(digits);
    }
    out.push(row);
  }
  return out;
}
