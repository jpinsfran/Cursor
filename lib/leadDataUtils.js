function cleanText(value) {
  if (value == null) return "";
  const cleaned = String(value).replace(/^\uFEFF/, "").trim();
  if (!cleaned || /^(null|undefined)$/i.test(cleaned)) return "";
  return cleaned;
}

function normalizeRegionKey(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function titleCaseWords(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isUfCode(value) {
  return /^[A-Z]{2}$/.test(cleanText(value));
}

function inferRegionFromUrl(url) {
  const match = cleanText(url).match(/\/delivery\/([^/]+)-([a-z]{2})(?:\/|$)/i);
  if (!match?.[1]) return "";
  return titleCaseWords(match[1].replace(/-/g, " "));
}

function inferRegionFromName(name) {
  const cleanedName = cleanText(name);
  if (!cleanedName) return "";
  const match =
    cleanedName.match(/\|\s*([^|]+?)\s*\|\s*iFood\s*$/i) ||
    cleanedName.match(/\|\s*([^|]+?)\s*\|/);
  return match?.[1] ? titleCaseWords(match[1]) : "";
}

function inferRegionFromRow(row = {}) {
  const directRegion = cleanText(row.regiao || row.regiao_nome || row.region || row.city);
  if (directRegion && !isUfCode(directRegion)) return directRegion;

  const fromUrl = inferRegionFromUrl(row.url || row.ifood_url || "");
  if (fromUrl) return fromUrl;

  const fromName = inferRegionFromName(row.name || row.tenant || row.restaurant || "");
  if (fromName) return fromName;

  return directRegion;
}

function parseRating(value) {
  const cleaned = cleanText(value).replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseClassification(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeLeadRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    regiao: inferRegionFromRow(row),
  }));
}

function enrichLeadRows(rows = [], options = {}) {
  const { includeClassification = false } = options;
  const enriched = normalizeLeadRows(rows);

  if (!includeClassification) {
    return enriched.map(({ classificacao, ...row }) => row);
  }

  const grouped = new Map();
  enriched.forEach((row) => {
    const regionKey = normalizeRegionKey(row.regiao);
    if (!regionKey) {
      row.classificacao = "";
      return;
    }
    if (!grouped.has(regionKey)) grouped.set(regionKey, []);
    grouped.get(regionKey).push({ row });
  });

  for (const entries of grouped.values()) {
    entries.sort((a, b) => {
      const ratingA = parseRating(a.row.rating);
      const ratingB = parseRating(b.row.rating);
      if (ratingA !== ratingB) return (ratingB ?? Number.NEGATIVE_INFINITY) - (ratingA ?? Number.NEGATIVE_INFINITY);

      const nameCompare = cleanText(a.row.name).localeCompare(cleanText(b.row.name), "pt-BR", { sensitivity: "base" });
      if (nameCompare !== 0) return nameCompare;

      return cleanText(a.row.url || a.row.ifood_url).localeCompare(cleanText(b.row.url || b.row.ifood_url), "pt-BR", {
        sensitivity: "base",
      });
    });

    entries.forEach(({ row }, position) => {
      row.classificacao = String(position + 1);
    });
  }

  return enriched;
}

export {
  cleanText,
  enrichLeadRows,
  inferRegionFromName,
  inferRegionFromRow,
  inferRegionFromUrl,
  isUfCode,
  normalizeLeadRows,
  normalizeRegionKey,
  parseClassification,
  parseRating,
  titleCaseWords,
};
