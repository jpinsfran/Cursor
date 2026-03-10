/**
 * Monta deal_notes_observations_map.json: para cada deal, concatena o texto das Notas associadas (hs_note_body).
 * Usa data/closer_perdidos_full.json e data/sdr_perdidos_full.json como lista de deals.
 * Requer HUBSPOT_ACCESS_TOKEN no .env.
 * Rode: node scripts/fetch-observations-map.cjs
 * Depois: node scripts/export-hubspot-perdidos-v3.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*HUBSPOT_ACCESS_TOKEN\s*=(.+)/);
    if (m) process.env.HUBSPOT_ACCESS_TOKEN = m[1].trim();
  });
}
const token = process.env.HUBSPOT_ACCESS_TOKEN;
const dataDir = path.join(__dirname, '..', 'data');
const outMapFile = path.join(__dirname, 'deal_notes_observations_map.json');

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.hubapi.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      const str = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(str);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 207) {
          reject(new Error(`${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getDealNoteIds(dealIds) {
  if (dealIds.length === 0) return [];
  const res = await api('POST', '/crm/v4/associations/deals/notes/batch/read', {
    inputs: dealIds.map((id) => ({ id }))
  });
  return res.results || [];
}

async function getNotesBatch(noteIds) {
  if (noteIds.length === 0) return {};
  const res = await api('POST', '/crm/v3/objects/notes/batch/read', {
    inputs: noteIds.map((id) => ({ id })),
    properties: ['hs_note_body', 'hs_timestamp']
  });
  const out = {};
  for (const r of res.results || []) {
    const body = r.properties?.hs_note_body;
    if (body) out[r.id] = stripHtml(body);
  }
  return out;
}

function loadDealIds(onlyPipeline) {
  const ids = new Set();
  let files = ['closer_perdidos_full.json', 'sdr_perdidos_full.json'];
  if (onlyPipeline === 'closer') files = ['closer_perdidos_full.json'];
  if (onlyPipeline === 'sdr') files = ['sdr_perdidos_full.json'];
  for (const name of files) {
    const p = path.join(dataDir, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const r of j.results || []) {
      if (r.id) ids.add(String(r.id));
    }
  }
  return Array.from(ids);
}

async function run() {
  if (!token) {
    console.error('Defina HUBSPOT_ACCESS_TOKEN no .env');
    process.exit(1);
  }

  const onlyPipeline = process.argv[2] || ''; // 'closer' ou 'sdr' para limitar
  const dealIds = loadDealIds(onlyPipeline);
  console.log('Deals a processar:', dealIds.length, onlyPipeline ? '(' + onlyPipeline.toUpperCase() + ')' : '(todos)');

  const BATCH_DEALS = 100;
  const BATCH_NOTES = 100;
  const dealToNoteIds = {};
  const allNoteIds = new Set();

  for (let i = 0; i < dealIds.length; i += BATCH_DEALS) {
    const batch = dealIds.slice(i, i + BATCH_DEALS);
    const results = await getDealNoteIds(batch);
    for (const r of results) {
      const dealId = r.from?.id;
      if (!dealId) continue;
      const noteIds = (r.to || []).map((t) => String(t.toObjectId));
      dealToNoteIds[dealId] = noteIds;
      noteIds.forEach((id) => allNoteIds.add(id));
    }
    console.log(`Associações: ${Math.min(i + BATCH_DEALS, dealIds.length)}/${dealIds.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  const noteIdList = Array.from(allNoteIds);
  const noteIdToText = {};
  for (let i = 0; i < noteIdList.length; i += BATCH_NOTES) {
    const batch = noteIdList.slice(i, i + BATCH_NOTES);
    const texts = await getNotesBatch(batch);
    Object.assign(noteIdToText, texts);
    console.log(`Notas lidas: ${Math.min(i + BATCH_NOTES, noteIdList.length)}/${noteIdList.length}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  const map = {};
  if (onlyPipeline && fs.existsSync(outMapFile)) {
    try {
      Object.assign(map, JSON.parse(fs.readFileSync(outMapFile, 'utf8')));
    } catch (e) {}
  }
  for (const dealId of dealIds) {
    const nids = dealToNoteIds[dealId] || [];
    const texts = nids.map((nid) => noteIdToText[nid]).filter(Boolean);
    if (texts.length) map[dealId] = texts.join(' | ');
    else if (onlyPipeline && map[dealId] === undefined) map[dealId] = '';
  }

  fs.writeFileSync(outMapFile, JSON.stringify(map, null, 0), 'utf8');
  const withNotes = Object.keys(map).filter((id) => map[id]).length;
  console.log('Salvo:', outMapFile, '→', withNotes, 'deals com observações');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
