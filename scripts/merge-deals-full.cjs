/**
 * Junta todas as páginas de deals perdidos (CLOSER e SDR) em um único JSON por pipeline.
 * CLOSER: lê 6 arquivos em agent-tools + opcional data/closer_page7.json (última página).
 * SDR: lê 2 arquivos em agent-tools (ou mais se tiver paginação).
 * Escreve data/closer_perdidos_full.json e data/sdr_perdidos_full.json.
 */
const fs = require('fs');
const path = require('path');

const agentToolsBase = process.env.AGENT_TOOLS_BASE || 'C:\\Users\\jpins\\.cursor\\projects\\c-Users-jpins-Documents-Nola\\agent-tools';
const dataDir = path.join(__dirname, '..', 'data');

// CLOSER: 6 páginas em agent-tools (100 cada = 600) + página 7 em data (48)
const CLOSER_AGENT_FILES = [
  '8a7b95b4-e5d5-43f2-94f9-3308dceaac64.txt',
  '7392a82d-9d2e-41b1-b63a-7b5f2b42de1d.txt',
  '298a21e6-8443-42fa-b3ae-12f96e417368.txt',
  '66185840-c28c-410c-a5a1-2dd64a7bd21a.txt',
  'd6586b86-cb23-49e7-bb89-eb59979b504b.txt',
  '1eb975df-bba7-47bc-8664-6a2dfb47486e.txt'
];
const CLOSER_PAGE7 = path.join(dataDir, 'closer_page7.json');

// SDR: todas as páginas em agent-tools (page 1-2 originais + 3 a 15)
const SDR_AGENT_FILES = [
  '43e62228-b6ee-458e-84ab-9c8175a94aaa.txt',
  '85152d9e-a1e0-4915-bce7-cdef8bd6b44f.txt',
  '092c292f-2ece-4b94-85c7-8df38956035d.txt',
  'e13535d1-7028-4ab3-8feb-7e1059e7354f.txt',
  '6360596e-bf93-44bc-b0a8-2b591ec5ccc4.txt',
  '758e8646-4c22-4d26-8edf-d46446211212.txt',
  'd45f0aed-88f3-494d-a613-a8e5f650e41b.txt',
  '17ec2fe9-f941-4f3a-bda9-2f1f923d00c1.txt',
  'c4dac9de-480c-4d24-a7d4-9990ca652d97.txt',
  '0499931b-b830-4230-a744-f8335d48163b.txt',
  '703e6f3c-ccc6-46fb-b18c-7a4f6c539c00.txt',
  'ea7b0a1b-b90f-47db-9643-1f3dd2373047.txt',
  '88c4ab20-4acc-42a3-98aa-4acb894397bd.txt',
  '311ad325-4dac-472a-aeaf-c577c9387647.txt',
  'dfe51d05-c569-4faf-8b34-b94bea08127f.txt',
  '71ddf9d4-addb-4744-9852-2a6888f4341b.txt',
  '663e951f-e178-4c50-b5b2-edfc9ccb4239.txt',
  'fc61a962-7b5a-44a2-99b5-a7883b5a7204.txt'
];

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
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const base = fs.existsSync(path.join(agentToolsBase, CLOSER_AGENT_FILES[0])) ? agentToolsBase : path.join(__dirname, '..', '.cursor', 'projects', 'c-Users-jpins-Documents-Nola', 'agent-tools');

  // CLOSER: 6 páginas + opcional page7
  let closerResults = loadResults(base, CLOSER_AGENT_FILES);
  if (fs.existsSync(CLOSER_PAGE7)) {
    try {
      const p7 = JSON.parse(fs.readFileSync(CLOSER_PAGE7, 'utf8'));
      closerResults = closerResults.concat(p7.results || p7 || []);
    } catch (e) {
      console.warn('Erro ao ler closer_page7.json:', e.message);
    }
  }
  fs.writeFileSync(path.join(dataDir, 'closer_perdidos_full.json'), JSON.stringify({ results: closerResults }), 'utf8');
  console.log('CLOSER total:', closerResults.length);
  if (closerResults.length === 600 && !fs.existsSync(CLOSER_PAGE7)) {
    console.log('  → Para 648: adicione HUBSPOT_ACCESS_TOKEN no .env e rode node scripts/fetch-closer-page7.cjs');
  }

  // SDR: 2 páginas (completar depois se houver mais)
  const sdrResults = loadResults(base, SDR_AGENT_FILES);
  fs.writeFileSync(path.join(dataDir, 'sdr_perdidos_full.json'), JSON.stringify({ results: sdrResults }), 'utf8');
  console.log('SDR total:', sdrResults.length);
})();
