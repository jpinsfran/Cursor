/**
 * Verifica quantos registros existem em ifood_estabelecimentos e leads_qualificados.
 * Uso: node verifica-contagem-supabase.js
 */
import "dotenv/config";
import { getClient, isEnabled } from "./lib/supabaseLeads.js";

async function main() {
  if (!isEnabled()) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }
  const supabase = await getClient();
  if (!supabase) {
    console.error("Não foi possível criar o cliente Supabase.");
    process.exit(1);
  }

  const { count: countEstab, error: errEstab } = await supabase
    .from("ifood_estabelecimentos")
    .select("id", { count: "exact", head: true });

  const { count: countQual, error: errQual } = await supabase
    .from("leads_qualificados")
    .select("ifood_estabelecimento_id", { count: "exact", head: true });

  if (errEstab) {
    console.error("Erro ifood_estabelecimentos:", errEstab.message);
    process.exit(1);
  }
  if (errQual) {
    console.error("Erro leads_qualificados:", errQual.message);
    process.exit(1);
  }

  console.log("ifood_estabelecimentos:", countEstab, "registros");
  console.log("leads_qualificados:", countQual, "registros");

  if (countEstab != null && countEstab < 10) {
    const { data: amostra } = await supabase
      .from("ifood_estabelecimentos")
      .select("id, ifood_url, name")
      .limit(5);
    console.log("Amostra:", amostra);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
