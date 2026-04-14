import "dotenv/config";

import csv from "csvtojson";
import path from "path";
import { promises as fs } from "fs";

import { generateRestaurantRadar, sanitizeLeadRow, slugify } from "./lib/radarGenerator.js";
import { normalizeLeadRows } from "./lib/leadDataUtils.js";

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const valueFlags = new Set(["--output-dir", "--url", "--name", "--index", "--proof-file"]);
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (valueFlags.has(current)) {
      i += 1;
      continue;
    }
    if (!current.startsWith("--")) positional.push(current);
  }

  const csvPath = positional[0] || "ifoodLeads_unificado.csv";
  const outputDir = getArgValue("--output-dir") || "radar-output";
  const leadUrl = getArgValue("--url");
  const leadName = getArgValue("--name");
  const leadIndex = Number.parseInt(getArgValue("--index"), 10);
  const proofFile = getArgValue("--proof-file");

  return {
    csvPath,
    outputDir,
    leadUrl,
    leadName,
    leadIndex: Number.isInteger(leadIndex) && leadIndex >= 0 ? leadIndex : null,
    proofFile,
    printJson: hasFlag("--json"),
  };
}

async function loadCsvRows(csvPath) {
  return csv({ noheader: false }).fromFile(csvPath);
}

function matchesLead(row, filters) {
  if (filters.leadUrl) {
    return sanitizeLeadRow(row).url.toLowerCase() === filters.leadUrl.toLowerCase();
  }
  if (filters.leadName) {
    return sanitizeLeadRow(row).name.toLowerCase() === filters.leadName.toLowerCase();
  }
  return false;
}

async function loadProofMetrics(proofFile) {
  if (!proofFile) return null;
  const fullPath = path.isAbsolute(proofFile) ? proofFile : path.join(process.cwd(), proofFile);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const args = parseArgs();
  const csvPath = path.isAbsolute(args.csvPath) ? args.csvPath : path.join(process.cwd(), args.csvPath);
  const outputRoot = path.isAbsolute(args.outputDir) ? args.outputDir : path.join(process.cwd(), args.outputDir);

  let rows = [];
  try {
    rows = await loadCsvRows(csvPath);
  } catch (error) {
    console.error("Erro ao ler CSV:", csvPath, error.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.error("CSV vazio. Nada para gerar.");
    process.exit(1);
  }

  const normalizedRows = normalizeLeadRows(rows);

  let lead = null;
  if (args.leadUrl || args.leadName) {
    lead = normalizedRows.find((row) => matchesLead(row, args));
  } else if (Number.isInteger(args.leadIndex)) {
    lead = normalizedRows[args.leadIndex] || null;
  } else {
    lead = normalizedRows.find((row) => sanitizeLeadRow(row).instagramUrl) || normalizedRows[0];
  }

  if (!lead) {
    console.error("Lead não encontrado com os filtros informados.");
    process.exit(1);
  }

  let proofMetrics = null;
  try {
    proofMetrics = await loadProofMetrics(args.proofFile);
  } catch (error) {
    console.error("Erro ao ler arquivo de prova social:", error.message);
    process.exit(1);
  }

  const radar = generateRestaurantRadar({
    lead,
    allRows: normalizedRows,
    proofMetrics,
  });

  const leadSlug = slugify(radar.lead.name);
  const leadDir = path.join(outputRoot, leadSlug);
  await ensureDir(leadDir);

  const htmlPath = path.join(leadDir, "radar.html");
  const jsonPath = path.join(leadDir, "radar-data.json");
  const messagesPath = path.join(leadDir, "whatsapp.txt");
  const summaryPath = path.join(leadDir, "summary.json");

  await fs.writeFile(htmlPath, radar.html, "utf8");
  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        lead: radar.lead,
        context: radar.context,
        scores: radar.scores,
        financial: radar.financial,
        recommendations: radar.recommendations,
        redFlags: radar.redFlags,
        roadmap: radar.roadmap,
        question: radar.question,
        warnings: radar.warnings,
        hubspotData: radar.hubspotData,
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(
    messagesPath,
    `ABERTURA\n${radar.messages.opening}\n\nFOLLOW-UP\n${radar.messages.followUp}\n`,
    "utf8"
  );
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        htmlPath,
        jsonPath,
        messagesPath,
        scores: radar.scores,
        opportunityMonthly: {
          min: radar.financial.oportunidadeMin,
          max: radar.financial.oportunidadeMax,
        },
        warnings: radar.warnings,
      },
      null,
      2
    ),
    "utf8"
  );

  if (args.printJson) {
    console.log(
      JSON.stringify(
        {
          htmlPath,
          jsonPath,
          messagesPath,
          summaryPath,
          scores: radar.scores,
          warnings: radar.warnings,
          opening: radar.messages.opening,
          followUp: radar.messages.followUp,
          hubspotData: radar.hubspotData,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Radar gerado com sucesso.");
  console.log("Lead:", radar.lead.name);
  console.log("HTML:", htmlPath);
  console.log("Dados:", jsonPath);
  console.log("Mensagens:", messagesPath);
  console.log("Resumo:", summaryPath);
  if (radar.warnings.length) {
    console.log("Avisos:");
    radar.warnings.forEach((warning) => console.log("-", warning));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
