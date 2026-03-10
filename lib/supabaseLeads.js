/**
 * Cliente Supabase para persistir as etapas do pipeline de leads.
 * Usa service_role para bypass de RLS (recomendado para scripts que alimentam as tabelas).
 * Variáveis: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY).
 */

let _client = null;

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

/**
 * Normaliza linha do CSV (campos podem vir com nomes em camelCase ou iguais ao schema).
 */
function rowToEstabelecimento(row) {
  const url = (row.url || row.ifood_url || "").trim();
  if (!url) return null;
  return {
    ifood_url: url,
    name: (row.name || "").trim() || "Sem nome",
    phone: (row.phone || "").trim() || null,
    cnpj: (row.cnpj || "").trim() || null,
    street_address: (row.streetAddress || row.street_address || "").trim() || null,
    neighborhood: (row.neighborhood || "").trim() || null,
    zipcode: (row.zipcode || "").trim() || null,
    rating: (row.rating != null ? String(row.rating) : null) || null,
    email: (row.email || "").trim() || null,
    cuisine: (row.cuisine != null ? String(row.cuisine).replace(/^"+|"+$/g, "") : null) || null,
    price_range: (row.priceRange || row.price_range || "").trim() || null,
    regiao: (row.regiao || "").trim() || null,
  };
}

/**
 * 1) Upsert em ifood_estabelecimentos. Retorna o id do estabelecimento (ou null se Supabase desabilitado).
 */
async function upsertEstabelecimento(row) {
  const supabase = await getClient();
  if (!supabase) return null;
  const data = rowToEstabelecimento(row);
  if (!data) return null;
  const { data: inserted, error } = await supabase
    .from("ifood_estabelecimentos")
    .upsert(data, { onConflict: "ifood_url" })
    .select("id")
    .single();
  if (error) {
    console.warn("[Supabase] ifood_estabelecimentos:", error.message);
    return null;
  }
  return inserted?.id ?? null;
}

/**
 * 2) Marca estabelecimento como qualificado (contato encontrado). Cria o estabelecimento se ainda não existir.
 */
async function upsertQualificado(row) {
  const supabase = await getClient();
  if (!supabase) return null;
  const ifoodUrl = (row.url || row.ifood_url || "").trim();
  if (!ifoodUrl) return null;
  let estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) {
    estabId = await upsertEstabelecimento(row);
    if (!estabId) return null;
  }
  const { error } = await supabase.from("leads_qualificados").upsert(
    {
      ifood_estabelecimento_id: estabId,
      phone: (row.phone || "").trim() || null,
      email: (row.email || "").trim() || null,
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
  let estabId = await getEstabelecimentoIdByUrl(supabase, ifoodUrl);
  if (!estabId) {
    estabId = await upsertEstabelecimento(row);
    if (!estabId) return null;
  }
  const { error } = await supabase.from("leads_perfil").upsert(
    {
      ifood_estabelecimento_id: estabId,
      instagram_url: (row.instagramUrl || row.instagram_url || "").trim() || null,
      instagram_profile_url: (row.instagram_profile_url || "").trim() || null,
      instagram_user_id: (row.instagram_user_id || "").trim() || null,
      seguidores: (row.seguidores != null ? String(row.seguidores) : null) || null,
      perfil_do_lead: (row.perfil_do_lead || "").trim() || null,
      punch_line: (row.punch_line || "").trim() || null,
    },
    { onConflict: "ifood_estabelecimento_id" }
  );
  if (error) {
    console.warn("[Supabase] leads_perfil:", error.message);
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

async function getEstabelecimentoIdByUrl(supabase, ifoodUrl) {
  const { data } = await supabase.from("ifood_estabelecimentos").select("id").eq("ifood_url", ifoodUrl).single();
  return data?.id ?? null;
}

export { getClient, isEnabled, upsertEstabelecimento, upsertQualificado, upsertPerfil, upsertCardapio, rowToEstabelecimento };
