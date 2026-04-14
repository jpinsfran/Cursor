import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import xlsx from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const CACHE_DIR = path.join(DATA_DIR, "relevant-addresses-cache");
const IBGE_XLS_URL = "https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2024/POP2024_20241230.xls";
const IBGE_XLS_PATH = path.join(CACHE_DIR, "POP2024_20241230.xls");
const GEOCODE_CACHE_PATH = path.join(CACHE_DIR, "geocode-cache.json");
const REVERSE_CACHE_PATH = path.join(CACHE_DIR, "reverse-cache.json");
const OUTPUT_JSON_PATH = path.join(DATA_DIR, "relevant-addresses-nacional.json");
const OUTPUT_CSV_PATH = path.join(DATA_DIR, "relevant-addresses-nacional.csv");
const GEOCODE_DELAY_MS = 1200;
const HTTP_TIMEOUT_MS = 20000;
const HTTP_MAX_RETRIES = 6;

const UF_ORDER = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function parseArgs() {
  return {
    dryRun: process.argv.includes("--dry-run"),
    skipSupabase: process.argv.includes("--skip-supabase"),
    forceRefresh: process.argv.includes("--force-refresh"),
    onlyGenerate: process.argv.includes("--only-generate"),
    limitCities: parseNumberArg("--limit-cities"),
  };
}

function parseNumberArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return 0;
  const n = parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, headers = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= HTTP_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const waitMs = 5000 * (attempt + 1);
          await sleep(waitMs);
          throw new Error(`HTTP 429`);
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < HTTP_MAX_RETRIES) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr || new Error("Falha HTTP sem erro detalhado");
}

function normalizeText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function downloadIbgeFile(forceRefresh) {
  if (!forceRefresh && (await exists(IBGE_XLS_PATH))) return;
  console.log("[ibge] Baixando arquivo oficial:", IBGE_XLS_URL);
  const res = await fetch(IBGE_XLS_URL, {
    headers: { "User-Agent": "nola-relevant-addresses-sync/1.0" },
  });
  if (!res.ok) throw new Error(`Falha ao baixar arquivo IBGE: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(IBGE_XLS_PATH, buffer);
}

function pickColumn(columns, patterns) {
  const normalized = columns.map((c) => ({ raw: c, n: normalizeText(c).toLowerCase() }));
  for (const p of patterns) {
    const found = normalized.find((c) => p.test(c.n));
    if (found) return found.raw;
  }
  return null;
}

function parseIbgeMunicipiosFromXls() {
  const wb = xlsx.readFile(IBGE_XLS_PATH);
  const sheetName = wb.SheetNames.find((n) => normalizeText(n).toLowerCase().includes("municip")) || wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", range: 1 });
  if (!rows.length) return [];

  const columns = Object.keys(rows[0]);
  const colUf = pickColumn(columns, [/^sigla da uf$/, /^uf$/]);
  const colMunicipio = pickColumn(columns, [/nome do municipio/, /^municipio$/]);
  const colPop = pickColumn(columns, [/populacao estimada/, /^populacao$/]);
  const colCodMun = pickColumn(columns, [/codigo do municipio/, /cod.*municipio/]);

  if (!colUf || !colMunicipio || !colPop) {
    throw new Error("Não foi possível identificar colunas obrigatórias no XLS do IBGE.");
  }

  const parsed = [];
  for (const row of rows) {
    const uf = String(row[colUf] || "").trim().toUpperCase();
    const city = String(row[colMunicipio] || "").trim();
    const pop = parseInt(String(row[colPop]).replace(/[^\d]/g, ""), 10);
    const codMun = String(row[colCodMun] || "").replace(/[^\d]/g, "");
    if (!uf || !city || !Number.isFinite(pop)) continue;
    parsed.push({ uf, city, population: pop, codMun: codMun || null });
  }
  return parsed;
}

async function loadJsonCache(filePath) {
  if (!(await exists(filePath))) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveJsonCache(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function geocodeKey(city, uf) {
  return `${normalizeText(city).toLowerCase()}|${uf}`;
}

function reverseKey(lat, lon) {
  return `${lat.toFixed(5)}|${lon.toFixed(5)}`;
}

async function geocodeCityCenter(city, uf, cache, forceRefresh) {
  const key = geocodeKey(city, uf);
  if (!forceRefresh && cache[key]) return cache[key];

  const query = encodeURIComponent(`${city}, ${uf}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`;
  const data = await fetchJsonWithRetry(url, {
    "User-Agent": "nola-relevant-addresses-sync/1.0 (contact: local-script)",
  });
  const first = data?.[0];
  if (!first?.lat || !first?.lon || !first?.display_name) {
    cache[key] = null;
    return null;
  }
  const result = {
    lat: Number(first.lat),
    lon: Number(first.lon),
    address: String(first.display_name),
  };
  cache[key] = result;
  await sleep(GEOCODE_DELAY_MS);
  return result;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function offsetLatLon(lat, lon, distanceKm, bearingDeg) {
  const R = 6371;
  const brng = toRad(bearingDeg);
  const d = distanceKm / R;
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

async function reverseGeocode(lat, lon, reverseCache, forceRefresh) {
  const key = reverseKey(lat, lon);
  if (!forceRefresh && reverseCache[key]) return reverseCache[key];

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const data = await fetchJsonWithRetry(url, {
    "User-Agent": "nola-relevant-addresses-sync/1.0 (contact: local-script)",
  });
  const address = String(data?.display_name || "").trim();
  reverseCache[key] = address || null;
  await sleep(GEOCODE_DELAY_MS);
  return reverseCache[key];
}

function segmentsForPopulation(population) {
  if (population >= 6000000) return 15;
  if (population >= 3000000) return 12;
  if (population >= 1000000) return 10;
  if (population >= 500000) return 8;
  return 1;
}

async function buildRelevantAddresses(cities, geocodeCache, reverseCache, forceRefresh) {
  const records = [];
  const missing = [];
  const metroSegments = {
    "Sao Paulo|SP": [
      "Sé",
      "Paulista",
      "Pinheiros",
      "Vila Mariana",
      "Moema",
      "Santana",
      "Tatuapé",
      "Itaquera",
      "Lapa",
      "Santo Amaro",
      "Campo Limpo",
      "Butantã",
      "Ipiranga",
      "Vila Madalena",
      "Liberdade",
    ],
    "Rio de Janeiro|RJ": [
      "Centro",
      "Copacabana",
      "Barra da Tijuca",
      "Tijuca",
      "Botafogo",
      "Méier",
      "Campo Grande",
      "Jacarepaguá",
      "Madureira",
      "Recreio dos Bandeirantes",
      "Ipanema",
      "Bangu",
    ],
    "Brasilia|DF": ["Asa Sul", "Asa Norte", "Taguatinga", "Ceilândia", "Águas Claras", "Samambaia", "Plano Piloto", "Guará", "Gama", "Sobradinho"],
    "Salvador|BA": ["Centro", "Barra", "Pituba", "Brotas", "Itapuã", "Cajazeiras", "Paralela", "Comércio", "Rio Vermelho", "Lapa"],
    "Fortaleza|CE": ["Centro", "Aldeota", "Meireles", "Montese", "Parangaba", "Messejana", "Benfica", "Papicu", "Varjota", "Cocó"],
    "Belo Horizonte|MG": ["Centro", "Savassi", "Pampulha", "Buritis", "Venda Nova", "Lourdes", "Barreiro", "Santa Efigênia", "Cidade Nova", "Carlos Prates"],
    "Manaus|AM": ["Centro", "Adrianópolis", "Vieiralves", "Cidade Nova", "Alvorada", "Compensa", "Japiim", "Ponta Negra", "Flores", "Mauazinho"],
    "Curitiba|PR": ["Centro", "Batel", "Água Verde", "Santa Felicidade", "Boqueirão", "Portão", "Cabral", "CIC", "Pinheirinho", "Bigorrilho"],
    "Recife|PE": ["Centro", "Boa Viagem", "Casa Forte", "Espinheiro", "Madalena", "Afogados", "Imbiribeira", "Pina", "Santo Amaro", "Boa Vista"],
    "Porto Alegre|RS": ["Centro", "Moinhos de Vento", "Menino Deus", "Petrópolis", "Partenon", "Sarandi", "Zona Sul", "Azenha", "Passo D'Areia", "Tristeza"],
  };

  const ordered = [...cities].sort((a, b) => {
    const ufIdx = UF_ORDER.indexOf(a.uf) - UF_ORDER.indexOf(b.uf);
    if (ufIdx !== 0) return ufIdx;
    return b.population - a.population;
  });

  for (let cityIdx = 0; cityIdx < ordered.length; cityIdx++) {
    const city = ordered[cityIdx];
    if (cityIdx % 25 === 0) {
      console.log(`[geocode] Progresso cidades: ${cityIdx}/${ordered.length}`);
    }
    const points = [];
    points.push({ label: "centro", address: `Centro, ${city.city}, ${city.uf}, Brasil` });
    const cityKey = `${normalizeText(city.city)}|${city.uf}`;
    const curated = metroSegments[cityKey] || [];
    if (curated.length > 0) {
      for (let i = 0; i < curated.length; i++) {
        points.push({
          label: `segmento_${String(i + 1).padStart(2, "0")}`,
          address: `${curated[i]}, ${city.city}, ${city.uf}, Brasil`,
        });
      }
    } else {
      const segments = segmentsForPopulation(city.population);
      if (segments > 1) {
        const dirs = ["Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste", "Área Central", "Área Comercial", "Área Residencial"];
        for (let i = 1; i < Math.min(segments, dirs.length + 1); i++) {
          points.push({
            label: `segmento_${String(i).padStart(2, "0")}`,
            address: `${dirs[i - 1]}, ${city.city}, ${city.uf}, Brasil`,
          });
        }
      }
    }

    const dedup = new Set();
    const uniquePoints = [];
    for (const p of points) {
      const k = normalizeText(p.address).toLowerCase();
      if (dedup.has(k)) continue;
      dedup.add(k);
      uniquePoints.push(p);
    }

    uniquePoints.forEach((p, idx) => {
      records.push({
        address: p.address,
        uf: city.uf,
        city: city.city,
        label: p.label,
        execution_order: idx + 1,
        is_active: true,
        source: "ibge_pop2024_nominatim",
        population: city.population,
      });
    });
  }

  return { records, missing };
}

async function writeArtifacts(records, missing) {
  await fs.writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_records: records.length,
        total_cities: new Set(records.map((r) => `${r.city}|${r.uf}`)).size,
        missing_geocode: missing,
        records,
      },
      null,
      2
    ),
    "utf8"
  );

  const header = "address,uf,city,label,execution_order,is_active,source,population";
  const lines = records.map((r) =>
    [
      safeCsv(r.address),
      safeCsv(r.uf),
      safeCsv(r.city),
      safeCsv(r.label),
      safeCsv(r.execution_order),
      safeCsv(r.is_active),
      safeCsv(r.source),
      safeCsv(r.population),
    ].join(",")
  );
  await fs.writeFile(OUTPUT_CSV_PATH, [header, ...lines].join("\n"), "utf8");
}

function groupCountsByUf(records) {
  const counts = {};
  for (const r of records) counts[r.uf] = (counts[r.uf] || 0) + 1;
  return counts;
}

function topSegmentedCities(records, topN = 10) {
  const byCity = {};
  for (const r of records) {
    const key = `${r.city}/${r.uf}`;
    byCity[key] = (byCity[key] || 0) + 1;
  }
  return Object.entries(byCity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

async function replaceSupabase(records) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY são obrigatórios.");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: delError } = await supabase.from("relevant_addresses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw new Error(`Erro ao limpar relevant_addresses: ${delError.message}`);

  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH).map((r) => ({
      address: r.address,
      uf: r.uf,
      city: r.city,
      label: r.label,
      execution_order: r.execution_order,
      is_active: true,
      source: r.source,
    }));
    const { error } = await supabase.from("relevant_addresses").insert(chunk);
    if (error) throw new Error(`Erro ao inserir lote ${i}-${i + chunk.length}: ${error.message}`);
  }

  const { data, error } = await supabase
    .from("relevant_addresses")
    .select("uf")
    .eq("is_active", true);
  if (error) throw new Error(`Erro ao validar relevant_addresses: ${error.message}`);
  return data?.length || 0;
}

async function main() {
  const args = parseArgs();
  await ensureDirs();
  await downloadIbgeFile(args.forceRefresh);

  const municipios = parseIbgeMunicipiosFromXls();
  let filtered = municipios.filter((m) => m.population > 100000);
  if (args.limitCities > 0) filtered = filtered.slice(0, args.limitCities);

  console.log(`[ibge] Municípios no arquivo: ${municipios.length}`);
  console.log(`[ibge] Municípios filtrados (>100k): ${filtered.length}`);

  const geocodeCache = await loadJsonCache(GEOCODE_CACHE_PATH);
  const reverseCache = await loadJsonCache(REVERSE_CACHE_PATH);

  const { records, missing } = await buildRelevantAddresses(filtered, geocodeCache, reverseCache, args.forceRefresh);
  await saveJsonCache(GEOCODE_CACHE_PATH, geocodeCache);
  await saveJsonCache(REVERSE_CACHE_PATH, reverseCache);
  await writeArtifacts(records, missing);

  const byUf = groupCountsByUf(records);
  console.log("[dataset] Endereços por UF:", byUf);
  console.log("[dataset] Top cidades por segmentação:", topSegmentedCities(records));
  console.log("[dataset] Cidades sem geocode:", missing.length);
  console.log("[dataset] Arquivos:", OUTPUT_JSON_PATH, OUTPUT_CSV_PATH);

  if (args.onlyGenerate || args.skipSupabase || args.dryRun) {
    console.log("[supabase] Dry-run/skip ativo. Não foi feito replace na tabela.");
    return;
  }

  const total = await replaceSupabase(records);
  console.log(`[supabase] Replace concluído. Endereços ativos na tabela: ${total}`);
}

main().catch((err) => {
  console.error("[erro]", err.message);
  process.exit(1);
});
