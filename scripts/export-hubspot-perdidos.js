/**
 * Gera CSVs de deals perdidos por pipeline a partir dos JSON do HubSpot MCP.
 * Colunas: Nome do negócio, Nome do contato, Fase, Motivo, Feature indisponível, Nº lojas, Observação, Data perdido.
 */
const fs = require('fs');
const path = require('path');

const agentToolsBase = process.env.AGENT_TOOLS_BASE || path.join(__dirname, '..', '.cursor', 'projects', 'c-Users-jpins-Documents-Nola', 'agent-tools');
const defaultFiles = [
  '17465347-a649-4a9e-a414-9642d09141b9.txt',
  '252052ee-fa1a-47b1-a5e8-50c6444f4012.txt'
];
const pipe145Files = [
  '6920838f-c478-4bd2-b408-d6c94609c86d.txt',
  '1dd49a4f-91e9-4296-a7a0-6549cbbd0353.txt'
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function row(d, contactName = '') {
  const p = d.properties || {};
  return [
    escapeCsv(p.dealname),
    escapeCsv(contactName),
    'Perdido',
    escapeCsv(p.closed_lost_reason),
    escapeCsv(p.qual_feature_esta_indisponivel_),
    escapeCsv(p.numero_de_lojas),
    escapeCsv(p.observacao_de_importacao || p.notes || p.description || ''),
    escapeCsv(p.closedate || p.hs_lastmodifieddate || '')
  ].join(',');
}

const header = 'Nome do negócio,Nome do contato no negócio,Fase do funil em que foi perdido,Motivo de fechamento perdido,Feature indisponível,Número de lojas,Observação,Data que entrou na fase Perdido';

function loadResults(baseDir, fileNames) {
  let results = [];
  for (const name of fileNames) {
    const fullPath = path.join(baseDir, name);
    if (!fs.existsSync(fullPath)) {
      console.warn('Arquivo não encontrado:', fullPath);
      continue;
    }
    const raw = fs.readFileSync(fullPath, 'utf8');
    const j = JSON.parse(raw);
    results = results.concat(j.results || []);
  }
  return results;
}

// Onde o MCP escreve os JSON (path absoluto)
const altBase = 'C:\\Users\\jpins\\.cursor\\projects\\c-Users-jpins-Documents-Nola\\agent-tools';
const base = fs.existsSync(path.join(altBase, defaultFiles[0])) ? altBase : agentToolsBase;

(function run() {
  const defaultResults = loadResults(base, defaultFiles);
  const pipe145Results = loadResults(base, pipe145Files);

  const outDir = path.join(__dirname, '..');

  // Pipeline default -> CLOSER; pipeline 145028430 -> SDR (convenção; usuário pode renomear)
  const csvDefault = [header, ...defaultResults.map(d => row(d))].join('\n');
  const csv145 = [header, ...pipe145Results.map(d => row(d))].join('\n');

  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_CLOSER.csv'), '\ufeff' + csvDefault, 'utf8');
  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_SDR.csv'), '\ufeff' + csv145, 'utf8');

  console.log('hubspot_perdidos_pipeline_CLOSER.csv:', defaultResults.length, 'linhas');
  console.log('hubspot_perdidos_pipeline_SDR.csv:', pipe145Results.length, 'linhas');
  console.log('CSVs gerados em', outDir);
})();
