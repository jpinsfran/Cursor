/**
 * Exporta deals perdidos com propriedades corretas (v2).
 * Colunas: Nome do negócio, Nome do contato, Qual feature indisponível, Motivo fechamento perdido,
 * Data entrada perdido SDR, Data entrada perdido CLOSER, Número de lojas, Observação.
 * Motivo: closed_lost_reason (motivo_de_perda não existe na API).
 */
const fs = require('fs');
const path = require('path');

const agentToolsBase = process.env.AGENT_TOOLS_BASE || 'C:\\Users\\jpins\\.cursor\\projects\\c-Users-jpins-Documents-Nola\\agent-tools';

const CLOSER_FILES = [
  '2dc58ac6-6154-48d6-9291-c075428c5691.txt',
  '14e11933-ea89-47cc-9a09-e45723ffbe47.txt'
];
const SDR_FILES = [
  '43e62228-b6ee-458e-84ab-9c8175a94aaa.txt',
  '85152d9e-a1e0-4915-bce7-cdef8bd6b44f.txt'
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
    escapeCsv(p.qual_feature_esta_indisponivel_),
    escapeCsv(p.closed_lost_reason),
    escapeCsv(p.hs_v2_date_entered_246594929),
    escapeCsv(p.hs_v2_date_entered_closedlost),
    escapeCsv(p.numero_de_lojas),
    escapeCsv(p.observacao_de_importacao || p.notes || p.description || '')
  ].join(',');
}

const header = 'Nome do negócio,Nome do contato no negócio,Qual feature está indisponível,Motivo fechamento perdido,Data entrada perdido SDR,Data entrada perdido CLOSER,Número de lojas,Observação';

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

(function run() {
  const base = fs.existsSync(path.join(agentToolsBase, CLOSER_FILES[0])) ? agentToolsBase : path.join(__dirname, '..', '.cursor', 'projects', 'c-Users-jpins-Documents-Nola', 'agent-tools');

  const closerResults = loadResults(base, CLOSER_FILES);
  const sdrResults = loadResults(base, SDR_FILES);

  const outDir = path.join(__dirname, '..');

  const csvCloser = [header, ...closerResults.map(d => row(d))].join('\n');
  const csvSdr = [header, ...sdrResults.map(d => row(d))].join('\n');

  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_CLOSER.csv'), '\ufeff' + csvCloser, 'utf8');
  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_SDR.csv'), '\ufeff' + csvSdr, 'utf8');

  console.log('hubspot_perdidos_pipeline_CLOSER.csv:', closerResults.length, 'linhas');
  console.log('hubspot_perdidos_pipeline_SDR.csv:', sdrResults.length, 'linhas');
  console.log('CSVs gerados em', outDir);
})();
