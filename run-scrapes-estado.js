/**
 * Roda o scrape do iFood para todos os endereços de um estado.
 * Fonte preferida: Supabase (relevant_addresses). Fallback: lista estática ENDERECOS_POR_ESTADO.
 * Cada endereço acumula no mesmo CSV (ifoodLeads_UF.csv); o scrapeIfoodLeads.js já desduplica por URL.
 *
 * Uso: node run-scrapes-estado.js SP
 *      node run-scrapes-estado.js RJ
 *      node run-scrapes-estado.js SP --limit 3   (só os N primeiros endereços)
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (opcional; se ausente, usa lista estática).
 */

import "dotenv/config";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Lista estática: fallback quando Supabase indisponível ou tabela vazia (fonte: PLANO_SCRAPE_ESTADOS.md). */
const ENDERECOS_POR_ESTADO = {
  AC: ["Av. Ceará 1000, Rio Branco", "Av. Brasil 500, Rio Branco", "Rua Benjamim Constant 200, Rio Branco"],
  AL: ["Av. Fernandes Lima 1000, Maceió", "Av. Durval de Goés Monteiro 500, Maceió", "Praia de Jatiúca, Maceió"],
  AP: ["Av. FAB 1000, Macapá", "Av. Procópio Rola 500, Macapá"],
  AM: ["Av. Constantino Nery 1000, Manaus", "Av. Djalma Batista 500, Manaus", "Av. Torquato Tapajós 1000, Manaus", "Centro, Manaus"],
  BA: ["Av. Tancredo Neves 1000, Salvador", "Barra, Salvador", "Pituba, Salvador", "Av. Getúlio Vargas 500, Feira de Santana", "Centro, Vitória da Conquista"],
  CE: ["Av. Beira Mar 1000, Fortaleza", "Aldeota, Fortaleza", "Meireles, Fortaleza", "Av. Padre Cícero 500, Juazeiro do Norte"],
  DF: ["SQS 116 Bloco A, Brasília", "SBS Quadra 1, Brasília", "Taguatinga Centro, Brasília", "Águas Claras, Brasília", "Ceilândia Centro, Brasília"],
  ES: ["Av. Vitória 1000, Vitória", "Praia do Canto, Vitória", "Av. Saturnino Rangel Mauro 500, Vila Velha", "Centro, Serra"],
  GO: ["Av. Anhanguera 1000, Goiânia", "Setor Sul, Goiânia", "Setor Marista, Goiânia", "Av. Independência 500, Aparecida de Goiânia"],
  MA: ["Av. Litorânea 1000, São Luís", "Renascença, São Luís", "Av. Dorgival Pinheiro de Sousa 500, Imperatriz"],
  MT: ["Av. Isaac Póvoas 1000, Cuiabá", "Centro, Cuiabá", "Av. Castelo Branco 500, Várzea Grande"],
  MS: ["Av. Afonso Pena 1000, Campo Grande", "Centro, Campo Grande", "Av. Marcelino Pires 500, Dourados"],
  MG: ["Av. Afonso Pena 1000, Belo Horizonte", "Savassi, Belo Horizonte", "Pampulha, Belo Horizonte", "Av. João Naves 1000, Uberlândia", "Av. João César de Oliveira 500, Contagem", "Centro, Juiz de Fora"],
  PA: ["Av. Presidente Vargas 1000, Belém", "Nazaré, Belém", "Av. Independência 500, Ananindeua"],
  PB: ["Av. Epitácio Pessoa 1000, João Pessoa", "Tambaú, João Pessoa", "Av. Floriano Peixoto 500, Campina Grande"],
  PR: ["Av. Sete de Setembro 1000, Curitiba", "Batel, Curitiba", "Av. Madre Leônia 500, Londrina", "Av. Herval 500, Maringá", "Centro, Ponta Grossa"],
  PE: ["Av. Boa Viagem 1000, Recife", "Boa Viagem, Recife", "Centro, Olinda", "Av. Agamenon Magalhães 500, Caruaru"],
  PI: ["Av. Frei Serafim 1000, Teresina", "Centro, Teresina", "Av. São Sebastião 500, Parnaíba"],
  RJ: ["Av. das Américas 1000, Rio de Janeiro", "Copacabana, Rio de Janeiro", "Tijuca, Rio de Janeiro", "Centro, Rio de Janeiro", "Av. Visconde do Rio Branco 500, Niterói", "Centro, Nova Iguaçu"],
  RN: ["Av. Praia de Ponta Negra 1000, Natal", "Capim Macio, Natal", "Av. Rio Branco 500, Mossoró"],
  RS: ["Av. Osvaldo Aranha 1000, Porto Alegre", "Moinhos de Vento, Porto Alegre", "Av. Júlio de Castilhos 500, Caxias do Sul", "Centro, Pelotas", "Centro, Canoas"],
  RO: ["Av. Presidente Dutra 1000, Porto Velho", "Av. Ji-Paraná 500, Ji-Paraná"],
  RR: ["Av. Capitão Ene Garcez 1000, Boa Vista", "Centro, Boa Vista"],
  SC: ["Av. Beira Mar Norte 1000, Florianópolis", "Centro, Florianópolis", "Av. Getúlio Vargas 500, Joinville", "Centro, Blumenau", "Centro, Itajaí"],
  SP: ["Av. Paulista 1000, São Paulo", "Pinheiros, São Paulo", "Vila Madalena, São Paulo", "Moema, São Paulo", "Centro, São Paulo", "Av. Brasil 500, Campinas", "Av. Ana Costa 500, Santos", "Av. Nove de Julho 500, Ribeirão Preto", "Av. São José 500, São José dos Campos", "Rua da Consolação 500, Santo André"],
  SE: ["Av. Beira Mar 1000, Aracaju", "Atalaia, Aracaju", "Centro, Aracaju"],
  TO: ["Av. Teotônio Segurado 1000, Palmas", "Quadra 103 Sul, Palmas", "Centro, Palmas"],
};

const UFS_VALIDOS = Object.keys(ENDERECOS_POR_ESTADO).sort();

/** Busca endereços ativos do Supabase para a UF, ordenados por execution_order. */
async function fetchAddressesFromSupabase(uf) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("relevant_addresses")
      .select("address, execution_order")
      .eq("uf", uf)
      .eq("is_active", true)
      .order("execution_order", { ascending: true });
    if (error) {
      console.warn("[run-scrapes-estado] Supabase error:", error.message);
      return null;
    }
    if (!data || data.length === 0) return [];
    return data.map((r) => r.address);
  } catch (e) {
    console.warn("[run-scrapes-estado] Supabase unavailable:", e.message);
    return null;
  }
}

function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const uf = (argv[0] || "").toUpperCase().trim();
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : null;

  if (!uf || !ENDERECOS_POR_ESTADO[uf]) {
    console.error("Uso: node run-scrapes-estado.js <UF> [--limit N]");
    console.error("UF válidos:", UFS_VALIDOS.join(", "));
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, "scrapeIfoodLeads.js");

  (async () => {
    let enderecos = await fetchAddressesFromSupabase(uf);
    if (enderecos == null) {
      console.log("[run-scrapes-estado] Supabase não configurado ou indisponível; usando lista estática.\n");
      enderecos = ENDERECOS_POR_ESTADO[uf];
    } else if (enderecos.length === 0) {
      console.log("[run-scrapes-estado] Nenhum endereço ativo no Supabase para " + uf + "; usando lista estática.\n");
      enderecos = ENDERECOS_POR_ESTADO[uf];
    } else {
      console.log("[run-scrapes-estado] Endereços carregados do Supabase (relevant_addresses).\n");
    }

    const toRun = limit ? enderecos.slice(0, limit) : enderecos;
    let failed = 0;

    console.log(`Estado: ${uf} | Endereços: ${toRun.length} de ${enderecos.length} | CSV: ifoodLeads_${uf}.csv`);
    console.log("Cada rodada acumula no mesmo CSV (desduplicação por URL).\n");

    for (let i = 0; i < toRun.length; i++) {
      const endereco = toRun[i];
      console.log(`[${i + 1}/${toRun.length}] ${endereco}`);
      const result = spawnSync("node", [scriptPath, endereco, uf], {
        stdio: "inherit",
        cwd: __dirname,
        shell: true,
      });
      if (result.status !== 0) {
        failed++;
        console.error(`[FALHA] Endereço ${i + 1} (exit ${result.status}). Continuando... O CSV já salvo mantém o que foi coletado.`);
      }
      if (i < toRun.length - 1) console.log("");
    }

    console.log(`\nConcluído: ${toRun.length} endereços para ${uf}. Sucesso: ${toRun.length - failed}, Falhas: ${failed}. Arquivo: ifoodLeads_${uf}.csv`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}

main();
