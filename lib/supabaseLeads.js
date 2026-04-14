import { cleanText, inferRegionFromRow, parseClassification } from "./leadDataUtils.js";
import { withCanonicalPhoneForSupabase, phoneDigitsOnly } from "./phoneBrasil.js";

/**
 * Cliente Supabase para persistir as etapas do pipeline de leads.
 * Usa service_role para bypass de RLS (recomendado para scripts que alimentam as tabelas).
 * Variáveis: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY).
 */

let _client = null;
let _supportsClassificacao = null;

/** Retorna a chave de API: prioridade service_role (recomendado), depois anon. */
function getSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}

async function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = getSupabaseKey();
  if (!url || !key) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    _client = createClient(url, key, { auth: { persistSession: false } });
    return _client;
  } catch (e) {
    return null;
  }
}

function isEnabled() {
  return !!(process.env.SUPABASE_URL && getSupabaseKey());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLikelyBrazilCellphone(value) {
  const digits = phoneDigitsOnly(value || "");
  if (digits.length < 12 || digits.length > 13) return false; // 55 + DDD + 9 + 8
  if (!digits.startsWith("55")) return false;
  const local = digits.slice(-9);
  return local.length === 9 && local.startsWith("9");
}

function hasProfileScrapeData(row) {
  return Boolean(
    (row.instagramUrl || row.instagram_url || "").trim() ||
      (row.instagram_profile_url || "").trim() ||
      (row.instagram_user_id || "").trim() ||
      String(row.seguidores || "").trim() ||
      (row.perfil_do_lead || "").trim() ||
      (row.punch_line || "").trim()
  );
}

function hasRequiredSocialProfileData(row) {
  const hasInstagramRef = Boolean(
    (row.instagramUrl || row.instagram_url || "").trim() ||
      (row.instagram_profile_url || "").trim()
  );
  const hasProfileSummary = Boolean((row.perfil_do_lead || "").trim());
  const hasPunchLine = Boolean((row.punch_line || "").trim());
  return hasInstagramRef && hasProfileSummary && hasPunchLine;
}

function hasRequiredLeadCoreData(row) {
  return Boolean(
    cleanText(row.name) &&
      cleanText(row.cnpj) &&
      isLikelyBrazilCellphone(row.phone)
  );
}

/** Em upsert, não sobrescrever com null/ vazio se já existir valor no banco (evita violar leads_perfil_completude_chk). */
function mergeNonEmptyTrimmed(newVal, existingVal) {
  const n = newVal != null ? String(newVal).trim() : "";
  if (n !== "") return n;
  const o = existingVal != null ? String(existingVal).trim() : "";
  return o !== "" ? String(existingVal).trim() : null;
}

/** NBSP e espaços unicode não são removidos por String#trim() em todos os casos; alinha com o CHECK no Postgres. */
function normalizeRequiredPerfilText(v) {
  if (v == null) return null;
  const s = String(v)
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u2007/g, " ")
    .trim();
  return s === "" ? null : s;
}

function normalizeLeadsPerfilPayloadFields(p) {
  const out = { ...p };
  for (const k of [
    "nome_negocio",
    "perfil_do_lead",
    "punch_line",
    "cnpj",
    "instagram_url",
    "instagram_profile_url",
    "instagram_user_id",
    "seguidores",
  ]) {
    if (out[k] != null) out[k] = normalizeRequiredPerfilText(out[k]);
  }
  return out;
}

/** Espelha CHECK leads_perfil_completude_chk (012_followup_contract_and_leads_perfil_principal.sql). */
function satisfiesLeadsPerfilCompletude(p) {
  const ne = (v) => v != null && normalizeRequiredPerfilText(v) != null;
  if (!ne(p.nome_negocio)) return false;
  if (!ne(p.phone)) return false;
  if (!ne(p.cnpj)) return false;
  if (!ne(p.instagram_url) && !ne(p.instagram_profile_url)) return false;
  if (!ne(p.perfil_do_lead)) return false;
  if (!ne(p.punch_line)) return false;
  return true;
}

/** Erros comuns de rede/HTTPS no Node (undici) durante fetch ao REST do Supabase. */
function isTransientNetworkError(error) {
  if (!error) return false;
  let e = error;
  for (let i = 0; i < 8 && e; i++) {
    const msg = String(e.message || "").toLowerCase();
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("socket")) return true;
    const code = e.code;
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN")
      return true;
    e = e.cause;
  }
  return false;
}

/** Inclui cadeia `cause` (Node 18+ / undici coloca ENOTFOUND, TLS, etc. no cause). */
function formatSupabaseError(error) {
  if (!error) return "";
  const segments = [];
  let e = error;
  for (let i = 0; i < 8 && e; i++) {
    const m = e.message || String(e);
    const extras = [];
    if (e.code != null) extras.push(`code=${e.code}`);
    if (e.details) extras.push(`details=${e.details}`);
    if (e.hint) extras.push(`hint=${e.hint}`);
    if (e.errno != null) extras.push(`errno=${e.errno}`);
    if (e.syscall) extras.push(`syscall=${e.syscall}`);
    segments.push(extras.length ? `${m} (${extras.join(", ")})` : m);
    e = e.cause;
  }
  return segments.join(" | ");
}

function warnLeadsPerfilErrorContext(logLabel, lastError) {
  const msg = formatSupabaseError(lastError);
  if (!msg.includes("leads_perfil")) return;
  console.warn(
    "[Supabase] Contexto:",
    "`leads_perfil` não é escrito por upsertEstabelecimento no Node; se o erro aparece aqui, o Postgres tem trigger/função em `ifood_estabelecimentos` que insere linha incompleta (ex.: phone NULL).",
    "Correção: rode no SQL Editor a migration `supabase/migrations/014_drop_extra_triggers_ifood_estabelecimentos.sql` (remove triggers extras; mantém só updated_at). Opcional: `supabase/diagnostics/list_triggers_ifood_estabelecimentos.sql` para inspecionar antes."
  );
}

async function supportsClassificacaoColumn(supabase) {
  if (_supportsClassificacao != null) return _supportsClassificacao;
  const { error } = await supabase
    .from("ifood_estabelecimentos")
    .select("classificacao")
    .limit(1);
  _supportsClassificacao = !error;
  if (error) {
    console.warn("[Supabase] Coluna classificacao ainda não existe. Aplique a migration nova para sincronizá-la.");
  }
  return _supportsClassificacao;
}

/**
 * Normaliza linha do CSV (campos podem vir com nomes em camelCase ou iguais ao schema).
 */
function rowToEstabelecimento(row) {
  const url = cleanText(row.url || row.ifood_url);
  if (!url) return null;
  return {
    ifood_url: url,
    name: cleanText(row.name) || "Sem nome",
    phone: cleanText(row.phone) || null,
    cnpj: cleanText(row.cnpj) || null,
    street_address: cleanText(row.streetAddress || row.street_address) || null,
    neighborhood: cleanText(row.neighborhood) || null,
    zipcode: cleanText(row.zipcode) || null,
    rating: (row.rating != null ? String(row.rating) : null) || null,
    email: cleanText(row.email) || null,
    cuisine: cleanText(row.cuisine != null ? String(row.cuisine).replace(/^"+|"+$/g, "") : null) || null,
    price_range: cleanText(row.priceRange || row.price_range) || null,
    regiao: inferRegionFromRow(row) || null,
  };
}

/**
 * 1) Upsert em ifood_estabelecimentos. Retorna o id do estabelecimento (ou null se Supabase desabilitado).
 */
/**
 * @param {object} [opts]
 * @param {string} [opts.logLabel] rótulo nos logs (ex.: chamada aninhada desde upsertPerfil)
 */
async function upsertEstabelecimento(row, opts = {}) {
  const logLabel = opts.logLabel || "ifood_estabelecimentos";
  const supabase = await getClient();
  if (!supabase) return null;
  const data = rowToEstabelecimento(withCanonicalPhoneForSupabase(row));
  if (!data) return null;
  // Só envia classificação se vier na linha; omitir evita sobrescrever ranking só no Supabase (migration/trigger) com null.
  if (await supportsClassificacaoColumn(supabase)) {
    const cls = parseClassification(row.classificacao);
    if (cls != null) data.classificacao = cls;
  }

  const digits = phoneDigitsOnly(data.phone || "");
  if (digits.length >= 10) {
    const { data: existingList, error: findErr } = await supabase
      .from("ifood_estabelecimentos")
      .select("id, ifood_url")
      .eq("phone", digits)
      .limit(2);
    if (findErr) {
      console.warn(`[Supabase] ${logLabel} (busca telefone):`, formatSupabaseError(findErr));
    } else {
      const existing = existingList?.[0];
      if (existing && existing.ifood_url && existing.ifood_url !== data.ifood_url) {
        const updatePayload = { ...data };
        delete updatePayload.ifood_url;
        const backoffMs = [250, 750, 1500];
        let lastError = null;
        for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
          const { data: updated, error } = await supabase
            .from("ifood_estabelecimentos")
            .update(updatePayload)
            .eq("id", existing.id)
            .select("id")
            .single();
          if (!error) return updated?.id ?? existing.id;
          lastError = error;
          if (!isTransientNetworkError(error) || attempt === backoffMs.length) break;
          await sleep(backoffMs[attempt]);
        }
        console.warn(`[Supabase] ${logLabel} (merge por telefone):`, formatSupabaseError(lastError));
        warnLeadsPerfilErrorContext(logLabel, lastError);
        return existing.id;
      }
    }
  }

  const backoffMs = [250, 750, 1500];
  let lastError = null;
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const { data: inserted, error } = await supabase
      .from("ifood_estabelecimentos")
      .upsert(data, { onConflict: "ifood_url" })
      .select("id")
      .single();
    if (!error) return inserted?.id ?? null;
    lastError = error;
    if (!isTransientNetworkError(error) || attempt === backoffMs.length) break;
    await sleep(backoffMs[attempt]);
  }
  console.warn(`[Supabase] ${logLabel}:`, formatSupabaseError(lastError));
  warnLeadsPerfilErrorContext(logLabel, lastError);
  return null;
}

/**
 * 2) Marca estabelecimento como qualificado (contato encontrado). Cria o estabelecimento se ainda não existir.
 */
async function upsertQualificado(row) {
  const supabase = await getClient();
  if (!supabase) return null;
  const rowPrep = withCanonicalPhoneForSupabase(row);
  const ifoodUrl = (rowPrep.url || rowPrep.ifood_url || "").trim();
  if (!ifoodUrl) return null;
  const hasCnpj = !!(cleanText(rowPrep.cnpj) || "");
  const hasCellphone = isLikelyBrazilCellphone(rowPrep.phone);
  if (!hasCnpj || !hasCellphone) return null;
  let estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) {
    estabId = await upsertEstabelecimento(rowPrep, { logLabel: "ifood_estabelecimentos (antes de leads_qualificados)" });
    if (!estabId) return null;
  } else if ((rowPrep.phone || "").trim()) {
    await upsertEstabelecimento(rowPrep, { logLabel: "ifood_estabelecimentos (antes de leads_qualificados)" });
  }
  const { error } = await supabase.from("leads_qualificados").upsert(
    {
      ifood_estabelecimento_id: estabId,
      phone: (rowPrep.phone || "").trim() || null,
      email: (rowPrep.email || "").trim() || null,
    },
    { onConflict: "ifood_estabelecimento_id" }
  );
  if (error) {
    console.warn("[Supabase] leads_qualificados:", error.message);
    return null;
  }
  return estabId;
}

/**
 * 3) Atualiza perfil/rapport (Instagram + perfil_do_lead + punch_line). Cria o estabelecimento se ainda não existir.
 */
async function upsertPerfil(row) {
  const supabase = await getClient();
  if (!supabase) return null;
  const ifoodUrl = (row.url || row.ifood_url || "").trim();
  if (!ifoodUrl) return null;
  if (!hasProfileScrapeData(row)) return null;
  if (!hasRequiredSocialProfileData(row)) return null;
  if (!hasRequiredLeadCoreData(row)) return null;
  let estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) {
    estabId = await upsertEstabelecimento(row, { logLabel: "ifood_estabelecimentos (pré-requisito leads_perfil)" });
    if (!estabId) return null;
  }
  const { data: qualificado } = await supabase
    .from("leads_qualificados")
    .select("ifood_estabelecimento_id")
    .eq("ifood_estabelecimento_id", estabId)
    .maybeSingle();
  if (!qualificado?.ifood_estabelecimento_id) return null;

  const { data: existing } = await supabase
    .from("leads_perfil")
    .select("*")
    .eq("ifood_estabelecimento_id", estabId)
    .maybeSingle();

  const nomeCandidate = cleanText(row.name) || cleanText(row.tenant) || null;
  const phoneNew = phoneDigitsOnly(row.phone || "") || null;
  const igUrlNew = (row.instagramUrl || row.instagram_url || "").trim() || null;
  const igProfNew = (row.instagram_profile_url || "").trim() || null;

  const payload = {
    ifood_estabelecimento_id: estabId,
    ifood_url: ifoodUrl,
    nome_negocio: mergeNonEmptyTrimmed(nomeCandidate, existing?.nome_negocio),
    phone: mergeNonEmptyTrimmed(phoneNew, existing?.phone),
    email: (row.email || "").trim() || null,
    cnpj: mergeNonEmptyTrimmed(cleanText(row.cnpj) || null, existing?.cnpj),
    street_address: cleanText(row.streetAddress || row.street_address) || null,
    neighborhood: cleanText(row.neighborhood) || null,
    zipcode: cleanText(row.zipcode) || null,
    rating: row.rating != null ? String(row.rating) : null,
    cuisine: cleanText(row.cuisine != null ? String(row.cuisine).replace(/^"+|"+$/g, "") : null) || null,
    price_range: cleanText(row.priceRange || row.price_range) || null,
    regiao: inferRegionFromRow(row) || null,
    classificacao: parseClassification(row.classificacao),
    instagram_url: mergeNonEmptyTrimmed(igUrlNew, existing?.instagram_url),
    instagram_profile_url: mergeNonEmptyTrimmed(igProfNew, existing?.instagram_profile_url),
    instagram_user_id: (row.instagram_user_id || "").trim() || null,
    seguidores: (row.seguidores != null ? String(row.seguidores) : null) || null,
    perfil_do_lead: mergeNonEmptyTrimmed((row.perfil_do_lead || "").trim() || null, existing?.perfil_do_lead),
    punch_line: mergeNonEmptyTrimmed((row.punch_line || "").trim() || null, existing?.punch_line),
  };

  const payloadNorm = normalizeLeadsPerfilPayloadFields(payload);
  Object.assign(payload, payloadNorm);

  if (!satisfiesLeadsPerfilCompletude(payload)) {
    console.warn(
      "[Supabase] leads_perfil: linha ainda incompleta para completude_chk (após merge com existente); upsert ignorado.",
      { ifood_url: ifoodUrl }
    );
    return null;
  }

  const { error } = await supabase.from("leads_perfil").upsert(payload, {
    onConflict: "ifood_estabelecimento_id",
  });
  if (error) {
    console.warn("[Supabase] leads_perfil:", formatSupabaseError(error));
    return null;
  }
  return estabId;
}

/**
 * 4) Cardápio (para uso futuro com seu scrape de menu). payload = objeto/array com itens do cardápio.
 */
async function upsertCardapio(ifoodUrl, payload) {
  const supabase = await getClient();
  if (!supabase) return null;
  const url = (ifoodUrl || "").trim();
  if (!url) return null;
  const { data: estab } = await supabase.from("ifood_estabelecimentos").select("id").eq("ifood_url", url).single();
  if (!estab?.id) return null;
  const { error } = await supabase.from("cardapio").upsert(
    { ifood_estabelecimento_id: estab.id, payload: payload || null },
    { onConflict: "ifood_estabelecimento_id" }
  );
  if (error) {
    console.warn("[Supabase] cardapio:", error.message);
    return null;
  }
  return estab.id;
}

/**
 * 5) Upsert em radars (scores, PDF URL, mensagens WhatsApp). Cria o estabelecimento se ainda nao existir.
 */
async function upsertRadar(row, radarData) {
  const supabase = await getClient();
  if (!supabase) return null;
  const ifoodUrl = (row.url || row.ifood_url || "").trim();
  if (!ifoodUrl) return null;
  let estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) {
    estabId = await upsertEstabelecimento(row, { logLabel: "ifood_estabelecimentos (antes de radars)" });
    if (!estabId) return null;
  }
  const { error } = await supabase.from("radars").upsert(
    {
      ifood_estabelecimento_id: estabId,
      pdf_url: radarData.pdfUrl || null,
      slug: radarData.slug || null,
      score_geral: radarData.scores?.geral ?? null,
      score_reputacao: radarData.scores?.reputacao ?? null,
      score_digital: radarData.scores?.digital ?? null,
      score_competitivo: radarData.scores?.competitivo ?? null,
      score_financeiro: radarData.scores?.financeiro ?? null,
      nivel: radarData.scores?.nivel || null,
      oportunidade_mensal_min: radarData.financial?.oportunidadeMin ?? null,
      oportunidade_mensal_max: radarData.financial?.oportunidadeMax ?? null,
      oportunidade_anual_min: radarData.financial?.oportunidadeAnualMin ?? null,
      oportunidade_anual_max: radarData.financial?.oportunidadeAnualMax ?? null,
      whatsapp_abertura: radarData.messages?.opening || null,
      whatsapp_followup: radarData.messages?.followUp || null,
    },
    { onConflict: "ifood_estabelecimento_id" }
  );
  if (error) {
    console.warn("[Supabase] radars:", error.message);
    return null;
  }
  return estabId;
}

/**
 * Verifica se um radar ja existe para o estabelecimento (usado pelo --resume).
 */
async function radarExistsForUrl(ifoodUrl) {
  const supabase = await getClient();
  if (!supabase) return false;
  const estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) return false;
  const { data } = await supabase
    .from("radars")
    .select("id")
    .eq("ifood_estabelecimento_id", estabId)
    .single();
  return !!data?.id;
}

async function getEstabelecimentoIdByUrl(supabase, ifoodUrl) {
  const { data } = await supabase.from("ifood_estabelecimentos").select("id").eq("ifood_url", ifoodUrl).single();
  return data?.id ?? null;
}

/**
 * Busca todos os estabelecimentos com classificacao e regiao, retorna um Map<ifood_url, {posicaoRegional, totalRegiao}>.
 */
async function fetchRankingMap() {
  const supabase = await getClient();
  if (!supabase) return new Map();

  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("ifood_estabelecimentos")
      .select("ifood_url, regiao, rating")
      .order("rating", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const byRegion = {};
  for (const r of all) {
    if (!r.regiao) continue;
    if (!byRegion[r.regiao]) byRegion[r.regiao] = [];
    byRegion[r.regiao].push(r);
  }

  const map = new Map();
  for (const [regiao, rows] of Object.entries(byRegion)) {
    const total = rows.length;
    rows.forEach((r, idx) => {
      if (r.ifood_url) {
        map.set(r.ifood_url, { posicaoRegional: idx + 1, totalRegiao: total, regiao });
      }
    });
  }
  return map;
}

export {
  getClient,
  isEnabled,
  formatSupabaseError,
  upsertEstabelecimento,
  upsertQualificado,
  upsertPerfil,
  upsertCardapio,
  upsertRadar,
  radarExistsForUrl,
  fetchRankingMap,
  rowToEstabelecimento,
};
