import "dotenv/config";
import path from "path";
import csv from "csvtojson";
import { createClient } from "@supabase/supabase-js";

function normalizeText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractCityUfFromUrl(url) {
  const m = String(url || "").match(/\/delivery\/([^/]+)-([a-z]{2})\//i);
  if (!m) return null;
  const citySlug = m[1] || "";
  const city = normalizeText(citySlug.replace(/-/g, " "));
  const uf = String(m[2] || "").toUpperCase();
  if (!city || !uf) return null;
  return { city, uf };
}

function extractCityUfFromRow(row) {
  const fromUrl = extractCityUfFromUrl(row.url || row.ifood_url);
  if (fromUrl) return fromUrl;

  const regiao = normalizeText(row.regiao || "");
  if (regiao) {
    const ufFromName = String(row.name || "").match(/\|\s*([A-Z]{2})\s*\|/);
    if (ufFromName?.[1]) {
      return { city: regiao, uf: ufFromName[1].toUpperCase() };
    }
  }
  return null;
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), "ifoodLeads_todos.csv");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY são obrigatórios.");

  const rows = await csv().fromFile(csvPath);
  const cityUfCount = new Map();
  for (const row of rows) {
    const parsed = extractCityUfFromRow(row);
    if (!parsed) continue;
    const k = `${parsed.city}|${parsed.uf}`;
    cityUfCount.set(k, (cityUfCount.get(k) || 0) + 1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: addresses, error } = await supabase
    .from("relevant_addresses")
    .select("id, city, uf, is_active")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  let done = 0;
  let pending = 0;
  const now = new Date().toISOString();
  for (const item of addresses || []) {
    const cityKey = normalizeText(item.city || "");
    const uf = String(item.uf || "").toUpperCase();
    const count = cityUfCount.get(`${cityKey}|${uf}`) || 0;
    const status = count > 0 ? "done" : "pending";

    const { error: upErr } = await supabase
      .from("relevant_addresses")
      .update({
        search_status: status,
        last_found_count: count,
        last_searched_at: count > 0 ? now : null,
      })
      .eq("id", item.id);
    if (upErr) throw new Error(upErr.message);

    if (status === "done") done++;
    else pending++;
  }

  console.log("Backfill concluído.");
  console.log("CSV:", csvPath);
  console.log("Ativos analisados:", (addresses || []).length);
  console.log("done:", done);
  console.log("pending:", pending);
}

main().catch((err) => {
  console.error("[erro]", err.message);
  process.exit(1);
});
