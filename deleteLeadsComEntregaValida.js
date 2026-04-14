import fs from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import csv from "csvtojson";
import dotenv from "dotenv";

async function readDeliveredSessionIds(metricsPath) {
  const raw = await fs.readFile(metricsPath, "utf8");
  const json = JSON.parse(raw);
  const sessions = Array.isArray(json?.per_session) ? json.per_session : [];

  const delivered = sessions.filter(
    (s) => s?.contacted === true && s?.failed_without_delivery === false
  );

  const uniqueSessionIds = Array.from(
    new Set(
      delivered
        .map((s) => String(s?.session_id || "").trim())
        .filter((n) => n.length > 0)
    )
  );

  return uniqueSessionIds;
}

async function mapSessionToEstabIds(sessoesCsvPath, sessionIds) {
  const sessionSet = new Set(sessionIds);
  const rows = await csv().fromFile(sessoesCsvPath);
  const ids = new Set();

  for (const row of rows) {
    const sid = String(row.id || "").trim();
    const estab = String(row.ifood_estabelecimento_id || "").trim();
    if (!sid || !estab) continue;
    if (sessionSet.has(sid)) ids.add(estab);
  }

  return Array.from(ids);
}

async function main() {
  // Carrega variáveis do .env local (sem sobrescrever variáveis já exportadas no ambiente).
  dotenv.config();

  const metricsPath = process.argv[2] || "docs/conversas-tracao-deep-metrics.json";
  const sessoesCsvPath = process.argv[3] || "conversas/sessoes.csv";
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY)."
    );
  }

  const sessionIds = await readDeliveredSessionIds(metricsPath);
  if (!sessionIds.length) {
    console.log(
      "[delete-entrega-valida] Nenhum lead com entrega válida encontrado no arquivo."
    );
    return;
  }

  console.log(
    `[delete-entrega-valida] Sessões elegíveis com entrega válida: ${sessionIds.length}`
  );

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const uniqueIds = await mapSessionToEstabIds(sessoesCsvPath, sessionIds);
  console.log(
    `[delete-entrega-valida] ifood_estabelecimento_id mapeados para remoção: ${uniqueIds.length}`
  );

  if (dryRun) {
    console.log("[delete-entrega-valida] Dry-run ativo, nenhuma remoção executada.");
    return;
  }

  if (!uniqueIds.length) {
    console.log(
      "[delete-entrega-valida] Nenhum ifood_estabelecimento_id encontrado. Nada para remover."
    );
    return;
  }

  // Deletar na tabela-mãe; FKs com cascade removem qualificados/perfil/radar/cardápio.
  const { error: delErr } = await supabase
    .from("ifood_estabelecimentos")
    .delete()
    .in("id", uniqueIds);
  if (delErr) throw delErr;

  console.log(
    `[delete-entrega-valida] Remoção concluída. Leads removidos na tabela mãe: ${uniqueIds.length}`
  );
}

main().catch((err) => {
  console.error("[delete-entrega-valida] Falha:", err?.message || err);
  process.exit(1);
});
