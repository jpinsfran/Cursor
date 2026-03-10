/**
 * Exporta deals perdidos (v3) a partir de data/closer_perdidos_full.json e data/sdr_perdidos_full.json.
 * Valor do negócio vem do próprio fetch (property amount); não usa mapeamento separado.
 * Observações de atividades: opcional deal_notes_observations_map.json (dealId -> texto).
 * Gera: hubspot_perdidos_pipeline_CLOSER.csv, hubspot_perdidos_pipeline_SDR.csv.
 */
const fs = require('fs');
const path = require('path');

const agentToolsBase = process.env.AGENT_TOOLS_BASE || 'C:\\Users\\jpins\\.cursor\\projects\\c-Users-jpins-Documents-Nola\\agent-tools';
const dataDir = path.join(__dirname, '..', 'data');

// Se existir data/closer_perdidos_full.json ou data/sdr_perdidos_full.json, usa (exportação completa)
const CLOSER_FULL = path.join(dataDir, 'closer_perdidos_full.json');
const SDR_FULL = path.join(dataDir, 'sdr_perdidos_full.json');

const CLOSER_FILES = [
  '2dc58ac6-6154-48d6-9291-c075428c5691.txt',
  '14e11933-ea89-47cc-9a09-e45723ffbe47.txt'
];
const SDR_FILES = [
  '43e62228-b6ee-458e-84ab-9c8175a94aaa.txt',
  '85152d9e-a1e0-4915-bce7-cdef8bd6b44f.txt'
];

const MAP_FILE = path.join(__dirname, 'deal_notes_observations_map.json');

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function row(d, contactName, observationsText) {
  const p = d.properties || {};
  const amount = p.amount != null && p.amount !== '' ? String(p.amount) : '';
  return [
    escapeCsv(p.dealname),
    escapeCsv(contactName),
    escapeCsv(amount),
    escapeCsv(p.qual_feature_esta_indisponivel_),
    escapeCsv(p.closed_lost_reason),
    escapeCsv(p.hs_v2_date_entered_246594929),
    escapeCsv(p.hs_v2_date_entered_closedlost),
    escapeCsv(p.numero_de_lojas),
    escapeCsv(p.observacao_de_importacao || p.notes || p.description || ''),
    escapeCsv(observationsText || '')
  ].join(',');
}

const header = 'Nome do negócio,Nome do contato no negócio,Valor do negócio,Qual feature está indisponível,Motivo fechamento perdido,Data entrada perdido SDR,Data entrada perdido CLOSER,Número de lojas,Observação,Observações de atividades';

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

function loadObservationsMap() {
  if (!fs.existsSync(MAP_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  } catch (e) {
    console.warn('Erro ao ler mapa de observações:', e.message);
    return {};
  }
}

function loadFromFullFile(fullPath) {
  if (!fs.existsSync(fullPath)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return j.results || [];
  } catch (e) {
    return null;
  }
}

(function run() {
  const base = fs.existsSync(path.join(agentToolsBase, CLOSER_FILES[0])) ? agentToolsBase : path.join(__dirname, '..', '.cursor', 'projects', 'c-Users-jpins-Documents-Nola', 'agent-tools');

  const observationsMap = loadObservationsMap();
  const mapCount = Object.keys(observationsMap).length;
  if (mapCount > 0) console.log('Mapa de observações de atividades:', mapCount, 'deals');

  const closerResults = loadFromFullFile(CLOSER_FULL) || loadResults(base, CLOSER_FILES);
  const sdrResults = loadFromFullFile(SDR_FULL) || loadResults(base, SDR_FILES);

  const outDir = path.join(__dirname, '..');

  const csvCloser = [header, ...closerResults.map(d => row(d, '', observationsMap[d.id]))].join('\n');
  const csvSdr = [header, ...sdrResults.map(d => row(d, '', observationsMap[d.id]))].join('\n');

  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_CLOSER.csv'), '\ufeff' + csvCloser, 'utf8');
  fs.writeFileSync(path.join(outDir, 'hubspot_perdidos_pipeline_SDR.csv'), '\ufeff' + csvSdr, 'utf8');

  console.log('hubspot_perdidos_pipeline_CLOSER.csv:', closerResults.length, 'linhas');
  console.log('hubspot_perdidos_pipeline_SDR.csv:', sdrResults.length, 'linhas');
  console.log('CSVs gerados em', outDir);
})();
