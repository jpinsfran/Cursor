/**
 * Pilot Validation — SDR Outbound IA (ponta a ponta)
 *
 * Steps:
 *   1. Apply migration 005 (if not done yet)
 *   2. Insert test leads (insert-test-leads ou insert-custom com JSON)
 *   3. Verify data in v_sessao_completa
 *   4. Simulate D1 dispatch by triggering SDR Outbound
 *   5. Verify session state after dispatch
 *
 * Usage:
 *   node pilotValidateOutbound.js apply-migration   # runs the SQL migration
 *   node pilotValidateOutbound.js insert-test-leads  # inserts test leads
 *   node pilotValidateOutbound.js check-sessions      # lists active sessions
 *   node pilotValidateOutbound.js check-events        # lists events for test sessions
 *   node pilotValidateOutbound.js cleanup             # removes test data
 *   node pilotValidateOutbound.js insert-custom [arquivo.json]  # leads do JSON (default: pilot-test-leads.custom.json)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const TEST_TAG = "pilot_test_outbound";

async function applyMigration() {
  console.log("Applying migration 005...");
  const sql = readFileSync(
    "supabase/migrations/005_outbound_cadencia_omnichannel.sql",
    "utf-8"
  );

  const { data, error } = await supabase.rpc("exec_sql", { sql_text: sql });
  if (error) {
    console.error("Migration error (rpc exec_sql):", error.message);
    console.log(
      "\nIf exec_sql is not available, apply the migration manually:"
    );
    console.log(
      "  psql $DATABASE_URL -f supabase/migrations/005_outbound_cadencia_omnichannel.sql"
    );
    console.log("  OR use Supabase Dashboard > SQL Editor > paste the file.");
    return;
  }
  console.log("Migration applied successfully.");
}

async function insertTestLeads() {
  console.log("Inserting test leads...\n");

  // Detect if the IA columns exist (migration 006)
  const { error: colTest } = await supabase
    .from("outbound_cadencia_sessions")
    .insert({ phone: "__col_test__", bairro: "test" })
    .select("id");

  const hasIaCols = !colTest;
  if (!hasIaCols) {
    console.log(
      "⚠  IA columns not found. Apply migration 006 first for full data.\n" +
      "   Inserting with base columns only.\n"
    );
    // clean up probe
  }
  await supabase
    .from("outbound_cadencia_sessions")
    .delete()
    .eq("phone", "__col_test__");

  const base1 = {
    phone: "5511999990001",
    phone_e164: "+5511999990001",
    tier: "A",
    angulo_copy: 1,
    status: "novo",
    proximo_touchpoint_id: "D1_WA",
    proximo_envio_at: new Date().toISOString(),
    metadata: { tag: TEST_TAG },
  };

  const base2 = {
    phone: "5511999990002",
    phone_e164: "+5511999990002",
    tier: "A",
    angulo_copy: 3,
    status: "novo",
    proximo_touchpoint_id: "D1_WA",
    proximo_envio_at: new Date().toISOString(),
    metadata: { tag: TEST_TAG },
  };

  const base3 = {
    phone: "5511999990003",
    phone_e164: "+5511999990003",
    tier: "B",
    angulo_copy: 2,
    status: "novo",
    proximo_touchpoint_id: "D1_WA",
    proximo_envio_at: new Date().toISOString(),
    metadata: { tag: TEST_TAG },
  };

  if (hasIaCols) {
    Object.assign(base1, {
      nome_lead: "Teste Piloto 1",
      nome_negocio: "Restaurante Piloto SP",
      bairro: "Vila Mariana",
      regiao: "São Paulo",
      cuisine: "Brasileira",
      price_range: "$$$",
      rating: "4.7",
      radar_score_geral: 62,
      radar_score_reputacao: 70,
      radar_score_digital: 45,
      radar_score_competitivo: 68,
      radar_score_financeiro: 55,
      radar_oportunidade_min: 2800,
      radar_oportunidade_max: 5200,
      radar_url: "https://nola.com.br/radar/restaurante-piloto-sp",
    });
    Object.assign(base2, {
      nome_lead: "Teste Piloto 2",
      nome_negocio: "Sushi House Teste",
      bairro: "Pinheiros",
      regiao: "São Paulo",
      cuisine: "Japonesa",
      price_range: "$$",
      rating: "4.3",
      radar_score_geral: 48,
      radar_score_reputacao: 55,
      radar_score_digital: 30,
      radar_score_competitivo: 60,
      radar_score_financeiro: 40,
      radar_oportunidade_min: 3500,
      radar_oportunidade_max: 6800,
      radar_url: "https://nola.com.br/radar/sushi-house-teste",
    });
    Object.assign(base3, {
      nome_lead: "Teste Piloto 3",
      nome_negocio: "Burger Lab Teste",
      bairro: "Itaim Bibi",
      regiao: "São Paulo",
      cuisine: "Hambúrguer",
      price_range: "$$",
      rating: "4.5",
      radar_score_geral: 55,
      radar_score_reputacao: 62,
      radar_score_digital: 42,
      radar_score_competitivo: 58,
      radar_score_financeiro: 52,
      radar_oportunidade_min: 1900,
      radar_oportunidade_max: 4100,
      radar_url: "https://nola.com.br/radar/burger-lab-teste",
    });
  }

  const testLeads = [base1, base2, base3];

  const selectCols = hasIaCols
    ? "id, phone, nome_negocio, status, proximo_touchpoint_id"
    : "id, phone, status, proximo_touchpoint_id";

  const { data, error } = await supabase
    .from("outbound_cadencia_sessions")
    .insert(testLeads)
    .select(selectCols);

  if (error) {
    console.error("Insert error:", error.message);
    return;
  }

  console.log("Inserted test leads:");
  data.forEach((r) =>
    console.log(
      `  ${r.id}  |  ${r.phone}  |  ${r.nome_negocio || "(apply migration 006)"}  |  ${r.status}  |  next: ${r.proximo_touchpoint_id}`
    )
  );
  console.log(
    "\nNext step: activate SDR Outbound and AGENTE DE OUTBOUND v2 workflows in n8n."
  );
  console.log(
    "The SDR Outbound schedule trigger will pick up these leads on next run."
  );
}

const IA_SESSION_KEYS = new Set([
  "nome_lead",
  "nome_negocio",
  "bairro",
  "regiao",
  "cuisine",
  "price_range",
  "rating",
  "perfil_do_lead",
  "rapport",
  "seguidores",
  "instagram_profile_url",
  "ifood_url",
  "cnpj",
  "classificacao",
  "email",
  "radar_score_geral",
  "radar_score_reputacao",
  "radar_score_digital",
  "radar_score_competitivo",
  "radar_score_financeiro",
  "radar_oportunidade_min",
  "radar_oportunidade_max",
  "radar_url",
]);

const BASE_SESSION_KEYS = new Set([
  "phone",
  "phone_e164",
  "tier",
  "angulo_copy",
  "status",
  "proximo_touchpoint_id",
  "proximo_envio_at",
  "metadata",
]);

function stripToBaseColumns(row) {
  const out = {};
  for (const k of BASE_SESSION_KEYS) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

function normalizeCustomLead(raw, defaultsFn) {
  const base = defaultsFn();
  const merged = { ...base, ...raw };
  const phoneDigits = String(merged.phone ?? "").replace(/\D/g, "");
  if (!phoneDigits) {
    throw new Error("phone obrigatório (dígitos)");
  }
  merged.phone = phoneDigits;
  if (!merged.phone_e164) merged.phone_e164 = `+${phoneDigits}`;
  merged.metadata = {
    ...base.metadata,
    ...(raw.metadata || {}),
    tag: TEST_TAG,
    source: "custom_json",
  };
  return merged;
}

async function insertCustomLeads() {
  const fileArg = process.argv[3];
  const filePath = fileArg
    ? resolve(process.cwd(), fileArg)
    : resolve(process.cwd(), "pilot-test-leads.custom.json");

  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    console.log(
      "Copie pilot-test-leads.example.json → pilot-test-leads.custom.json e edite (telefone real, nome do negócio, etc.)."
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("JSON inválido:", e.message);
    process.exit(1);
  }

  let rawLeads;
  if (Array.isArray(parsed)) rawLeads = parsed;
  else if (parsed.leads && Array.isArray(parsed.leads)) rawLeads = parsed.leads;
  else {
    console.error('Use um array JSON ou { "leads": [ ... ] } (remova _readme do exemplo).');
    process.exit(1);
  }

  if (rawLeads.length === 0) {
    console.error("Lista de leads vazia.");
    process.exit(1);
  }

  const { error: colTest } = await supabase
    .from("outbound_cadencia_sessions")
    .insert({ phone: "__col_test__", bairro: "test" })
    .select("id");
  const hasIaCols = !colTest;
  await supabase
    .from("outbound_cadencia_sessions")
    .delete()
    .eq("phone", "__col_test__");

  if (!hasIaCols) {
    console.log(
      "⚠  Colunas IA (006) ausentes — inserindo só campos base. Aplique a migration 006 para nome_negocio, radar_*, etc.\n"
    );
  }

  const defaultsFn = () => ({
    tier: "A",
    angulo_copy: 1,
    status: "novo",
    proximo_touchpoint_id: "D1_WA",
    proximo_envio_at: new Date().toISOString(),
    metadata: { tag: TEST_TAG, source: "custom_json" },
  });

  const rows = [];
  for (const raw of rawLeads) {
    let row;
    try {
      row = normalizeCustomLead(raw, defaultsFn);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    if (!hasIaCols) {
      rows.push(stripToBaseColumns(row));
    } else {
      const cleaned = { ...row };
      for (const k of Object.keys(cleaned)) {
        if (!BASE_SESSION_KEYS.has(k) && !IA_SESSION_KEYS.has(k)) {
          delete cleaned[k];
        }
      }
      rows.push(cleaned);
    }
  }

  const selectCols = hasIaCols
    ? "id, phone, nome_negocio, status, proximo_touchpoint_id"
    : "id, phone, status, proximo_touchpoint_id";

  const { data, error } = await supabase
    .from("outbound_cadencia_sessions")
    .insert(rows)
    .select(selectCols);

  if (error) {
    console.error("Insert error:", error.message);
    return;
  }

  console.log("Leads personalizados inseridos:\n");
  data.forEach((r) =>
    console.log(
      `  ${r.id}  |  ${r.phone}  |  ${r.nome_negocio || "(sem nome — aplique 006)"}  |  ${r.status}  |  next: ${r.proximo_touchpoint_id}`
    )
  );
  console.log("\nCleanup: node pilotValidateOutbound.js cleanup");
}

async function checkSessions() {
  console.log("Active outbound sessions:\n");

  const { data, error } = await supabase
    .from("outbound_cadencia_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }
  if (!data.length) {
    console.log("  (no sessions found)");
    return;
  }

  data.forEach((s) => {
    console.log(`--- ${s.nome_negocio} (${s.phone}) ---`);
    console.log(`  id:            ${s.id}`);
    console.log(`  status:        ${s.status}`);
    console.log(`  temperatura:   ${s.temperatura || "-"}`);
    console.log(`  fase:          ${s.conversa_fase || "-"}`);
    console.log(`  próximo:       ${s.proximo_touchpoint_id || "-"}`);
    console.log(
      `  executados:    [${(s.touchpoints_executados || []).join(", ")}]`
    );
    console.log(`  pausada:       ${s.cadencia_pausada}`);
    console.log(`  respondeu:     ${s.lead_respondeu_alguma_vez}`);
    console.log(
      `  BANT:          B=${s.bant_budget || "-"} A=${s.bant_authority || "-"} N=${s.bant_need || "-"} T=${s.bant_timeline || "-"}`
    );
    console.log(`  updated:       ${s.updated_at}`);
    console.log();
  });
}

async function checkEvents() {
  console.log("Recent outbound events:\n");

  const { data, error } = await supabase
    .from("outbound_cadencia_eventos")
    .select(
      "id, session_id, touchpoint_id, canal, direcao, mensagem_texto, temperatura_pos, conversa_fase_pos, agente_action, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }
  if (!data.length) {
    console.log("  (no events found)");
    return;
  }

  data.forEach((e) => {
    const msg = (e.mensagem_texto || "").substring(0, 80);
    console.log(
      `[${e.created_at}] ${e.direcao.toUpperCase()} | ${e.touchpoint_id || "-"} | ${e.canal || "-"} | temp=${e.temperatura_pos || "-"} | fase=${e.conversa_fase_pos || "-"} | action=${e.agente_action || "-"}`
    );
    console.log(`  msg: ${msg}${msg.length >= 80 ? "..." : ""}`);
    console.log();
  });
}

async function checkView() {
  console.log("v_sessao_completa (first 5 rows):\n");

  const { data, error } = await supabase
    .from("v_sessao_completa")
    .select("id, phone, status, estab_name, radar_pdf_url, radar_slug")
    .limit(5);

  if (error) {
    console.error("View query error:", error.message);
    console.log("Make sure migration 005 has been applied.");
    return;
  }

  data.forEach((r) => {
    console.log(
      `  ${r.id} | ${r.phone} | status=${r.status} | estab=${r.estab_name || "-"} | radar=${r.radar_slug || "-"}`
    );
  });
}

async function cleanup() {
  console.log("Cleaning up test data...");

  const { data: sessions } = await supabase
    .from("outbound_cadencia_sessions")
    .select("id")
    .contains("metadata", { tag: TEST_TAG });

  if (!sessions?.length) {
    console.log("  No test data found.");
    return;
  }

  const ids = sessions.map((s) => s.id);
  console.log(`  Found ${ids.length} test sessions.`);

  const { error: evtErr } = await supabase
    .from("outbound_cadencia_eventos")
    .delete()
    .in("session_id", ids);

  if (evtErr) console.error("  Events cleanup error:", evtErr.message);
  else console.log("  Events cleaned.");

  const { error: sesErr } = await supabase
    .from("outbound_cadencia_sessions")
    .delete()
    .in("id", ids);

  if (sesErr) console.error("  Sessions cleanup error:", sesErr.message);
  else console.log("  Sessions cleaned.");

  console.log("Done.");
}

const command = process.argv[2];

const commands = {
  "apply-migration": applyMigration,
  "insert-test-leads": insertTestLeads,
  "insert-custom": insertCustomLeads,
  "check-sessions": checkSessions,
  "check-events": checkEvents,
  "check-view": checkView,
  cleanup: cleanup,
};

if (!command || !commands[command]) {
  console.log("Usage: node pilotValidateOutbound.js <command>\n");
  console.log("Commands:");
  Object.keys(commands).forEach((c) => console.log(`  ${c}`));
  process.exit(1);
}

commands[command]();
