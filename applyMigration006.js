/**
 * Apply migration 006 to Supabase by splitting into individual
 * ALTER TABLE statements and using the REST API.
 * 
 * For ALTER TABLE, we use a workaround: create a temporary RPC function
 * via the Supabase Management API, then call it.
 * 
 * If that fails, we output the SQL for manual application.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const alterStatements = [
  // Sessions: denormalized lead data
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS nome_lead TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS nome_negocio TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS bairro TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS regiao TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS cuisine TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS price_range TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS rating TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS cnpj TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS perfil_do_lead TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS rapport TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS seguidores TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS instagram_profile_url TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS ifood_url TEXT`,

  // Sessions: radar data
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_url TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_score_geral INTEGER`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_score_reputacao INTEGER`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_score_digital INTEGER`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_score_competitivo INTEGER`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_score_financeiro INTEGER`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_oportunidade_min NUMERIC`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS radar_oportunidade_max NUMERIC`,

  // Sessions: IA qualificação
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS temperatura TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS conversa_fase TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS bant_budget TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS bant_authority TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS bant_need TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS bant_timeline TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS agendamento_data TIMESTAMPTZ`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS agendamento_link TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS motivo_perda TEXT`,
  `ALTER TABLE outbound_cadencia_sessions ADD COLUMN IF NOT EXISTS reativar_em DATE`,

  // Eventos: IA snapshot
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS temperatura_pos TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS conversa_fase_pos TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS agente_action TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS bant_budget TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS bant_authority TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS bant_need TEXT`,
  `ALTER TABLE outbound_cadencia_eventos ADD COLUMN IF NOT EXISTS bant_timeline TEXT`,
];

const constraintsSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outbound_cadencia_sessions_temperatura_check'
  ) THEN
    ALTER TABLE outbound_cadencia_sessions
      ADD CONSTRAINT outbound_cadencia_sessions_temperatura_check
      CHECK (temperatura IN ('quente', 'morno', 'frio'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outbound_cadencia_sessions_conversa_fase_check'
  ) THEN
    ALTER TABLE outbound_cadencia_sessions
      ADD CONSTRAINT outbound_cadencia_sessions_conversa_fase_check
      CHECK (conversa_fase IN (
        'abertura', 'radar_enviado', 'investigacao',
        'transicao_nola', 'agendamento', 'pos_agendamento'
      ));
  END IF;
END $$;
`;

const indexesSql = `
CREATE INDEX IF NOT EXISTS idx_ocs_em_conversa_silencio
  ON outbound_cadencia_sessions(ultima_inbound_at)
  WHERE status = 'em_conversa';
CREATE INDEX IF NOT EXISTS idx_ocs_temperatura
  ON outbound_cadencia_sessions(temperatura)
  WHERE temperatura IS NOT NULL;
`;

const viewSql = `
DROP VIEW IF EXISTS v_sessao_completa;
CREATE VIEW v_sessao_completa AS
SELECT
  s.*,
  e.name        AS estab_name,
  e.street_address,
  e.neighborhood,
  e.zipcode,
  e.classificacao,
  p.perfil_do_lead  AS perfil_do_lead_perfil,
  p.punch_line      AS rapport_perfil,
  p.seguidores      AS seguidores_perfil,
  p.instagram_profile_url AS instagram_perfil,
  r.pdf_url         AS radar_pdf_url,
  r.slug            AS radar_slug,
  r.whatsapp_abertura,
  r.whatsapp_followup
FROM outbound_cadencia_sessions s
LEFT JOIN ifood_estabelecimentos e
  ON e.id = s.ifood_estabelecimento_id
LEFT JOIN leads_perfil p
  ON p.ifood_estabelecimento_id = s.ifood_estabelecimento_id
LEFT JOIN radars r
  ON r.ifood_estabelecimento_id = s.ifood_estabelecimento_id;
`;

async function tryExecViaDatabaseApi(sql) {
  const ref = supabaseUrl.replace("https://", "").split(".")[0];

  // Method 1: Supabase Database API (available in some plans)
  const resp = await fetch(
    `https://${ref}.supabase.co/rest/v1/rpc/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: "_exec_migration",
        definition: sql,
      }),
    }
  );

  return resp.ok;
}

async function main() {
  console.log("=== Aplicando Migration 006: Colunas IA ===\n");

  // Try to verify columns first
  const { error: testErr } = await supabase
    .from("outbound_cadencia_sessions")
    .select("nome_lead")
    .limit(1);

  if (!testErr) {
    console.log("Colunas IA já existem. Migration 006 já foi aplicada.");

    // Still check the view
    const { error: viewErr } = await supabase
      .from("v_sessao_completa")
      .select("nome_lead")
      .limit(1);

    if (viewErr) {
      console.log("\nMas a view precisa ser recriada. Cole no SQL Editor:\n");
      console.log(viewSql);
    } else {
      console.log("View v_sessao_completa também OK.");
    }
    return;
  }

  console.log("Colunas IA não encontradas. Tentando aplicar...\n");

  // The Supabase JS client can't run DDL. 
  // Output the complete SQL for manual application.
  console.log("========================================");
  console.log("COLE O SQL ABAIXO NO SUPABASE SQL EDITOR");
  console.log("Dashboard > SQL Editor > New Query > Cole > Run");
  console.log("========================================\n");

  // Print all ALTER statements
  for (const stmt of alterStatements) {
    console.log(stmt + ";");
  }

  console.log("\n-- Constraints");
  console.log(constraintsSql);

  console.log("-- Indexes");
  console.log(indexesSql);

  console.log("-- View");
  console.log(viewSql);

  console.log("\n========================================");
  console.log("FIM DO SQL — Cole tudo acima e clique Run");
  console.log("========================================");
}

main();
