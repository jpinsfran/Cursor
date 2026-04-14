/**
 * Audita telefones entre ifood_estabelecimentos e leads_qualificados (leads com perfil no Supabase).
 * Critérios: mesmos de exportaLeadsComContato / ultimate scrape (lib/phoneBrasil.js).
 *
 * Uso:
 *   node auditPhonesSupabase.js
 *   node auditPhonesSupabase.js --fix   (grava canônico nas duas tabelas)
 */

import "dotenv/config";
import { isEnabled, getClient } from "./lib/supabaseLeads.js";
import { normalizePhoneToDigits, isCelularBrasil, phoneDigitsOnly } from "./lib/phoneBrasil.js";

const PAGE = 500;

async function fetchAllPerfilIds(supabase) {
  const ids = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("leads_perfil")
      .select("ifood_estabelecimento_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    ids.push(...data.map((r) => r.ifood_estabelecimento_id));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function fetchEstabQual(supabase, estabIds) {
  const { data: estabs } = await supabase.from("ifood_estabelecimentos").select("*").in("id", estabIds);
  const { data: quals } = await supabase.from("leads_qualificados").select("*").in("ifood_estabelecimento_id", estabIds);
  const qualByEstab = new Map((quals || []).map((q) => [q.ifood_estabelecimento_id, q]));
  return { estabs: estabs || [], qualByEstab };
}

function rowFromDb(estab, qual) {
  return {
    url: estab.ifood_url,
    ifood_url: estab.ifood_url,
    name: estab.name,
    regiao: estab.regiao,
    phone: (qual?.phone || "").trim() || (estab.phone || "").trim(),
    email: (qual?.email || "").trim() || (estab.email || "").trim(),
  };
}

async function main() {
  const fix = process.argv.includes("--fix");

  if (!isEnabled()) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.");
    process.exit(1);
  }

  const supabase = await getClient();

  console.log("Carregando IDs de leads com perfil...");
  const perfilIds = await fetchAllPerfilIds(supabase);
  console.log("Leads com perfil:", perfilIds.length);

  let mismatch = 0;
  let noPhone = 0;
  let invalidCelular = 0;
  let fixed = 0;
  const samples = [];

  for (let i = 0; i < perfilIds.length; i += 50) {
    const chunk = perfilIds.slice(i, i + 50);
    const { estabs, qualByEstab } = await fetchEstabQual(supabase, chunk);

    for (const estab of estabs) {
      const qual = qualByEstab.get(estab.id);
      const row = rowFromDb(estab, qual);
      const dEst = phoneDigitsOnly(estab.phone);
      const dQual = phoneDigitsOnly(qual?.phone);
      const canonical = normalizePhoneToDigits(row);

      if (!dEst && !dQual && !canonical) {
        noPhone++;
        continue;
      }

      if (canonical && !isCelularBrasil(canonical)) {
        invalidCelular++;
        if (samples.length < 15) {
          samples.push({
            name: (estab.name || "").slice(0, 40),
            estab: dEst,
            qual: dQual,
            canonical,
            note: "não passa em isCelularBrasil após normalizar",
          });
        }
      }

      if (dEst !== dQual) {
        mismatch++;
        if (samples.length < 15) {
          samples.push({
            name: (estab.name || "").slice(0, 40),
            estab: dEst,
            qual: dQual,
            canonical,
          });
        }
      }

      if (fix && canonical && isCelularBrasil(canonical)) {
        if (dEst !== canonical || dQual !== canonical) {
          await supabase.from("ifood_estabelecimentos").update({ phone: canonical }).eq("id", estab.id);
          await supabase
            .from("leads_qualificados")
            .upsert(
              {
                ifood_estabelecimento_id: estab.id,
                phone: canonical,
                email: qual?.email != null ? qual.email : estab.email || null,
              },
              { onConflict: "ifood_estabelecimento_id" }
            );
          fixed++;
        }
      }
    }
  }

  console.log("\n=== Resumo (leads com perfil) ===");
  console.log("Mismatches ifood_estabelecimentos.phone ≠ leads_qualificados.phone:", mismatch);
  console.log("Sem telefone em ambos (após tentativa de linha):", noPhone);
  console.log("Com dígitos mas não celular (revisar manualmente):", invalidCelular);
  if (fix) console.log("Registros ajustados (--fix):", fixed);
  if (samples.length && !fix) {
    console.log("\nAmostras (primeiros casos):");
    for (const s of samples) console.log(JSON.stringify(s));
  }
  if (fix) {
    console.log("\n--fix aplicado: telefone canônico gravado em ifood_estabelecimentos e leads_qualificados.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
