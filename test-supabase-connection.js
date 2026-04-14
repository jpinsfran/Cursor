/**
 * Testa conexão com Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Uso: node test-supabase-connection.js
 */
import "dotenv/config";
import { getClient, isEnabled, formatSupabaseError } from "./lib/supabaseLeads.js";

async function main() {
  if (!isEnabled()) {
    console.error("Falha: SUPABASE_URL ou chave (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY) não definidos no .env");
    process.exit(1);
  }
  const supabase = await getClient();
  if (!supabase) {
    console.error("Falha: não foi possível criar o cliente Supabase.");
    process.exit(1);
  }
  const { data, error } = await supabase.from("ifood_estabelecimentos").select("id").limit(1);
  if (error) {
    console.error("Erro na conexão:", formatSupabaseError(error));
    console.error(
      "Dica: fetch failed costuma ser rede/DNS/TLS/firewall/VPN ou projeto Supabase pausado. Confira SUPABASE_URL (https://xxx.supabase.co) no .env."
    );
    process.exit(1);
  }
  console.log("Conexão OK. Supabase respondeu. (registros na tabela ifood_estabelecimentos:", Array.isArray(data) ? data.length : 0, ")");
}

main();
