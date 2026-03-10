/**
 * Busca a propriedade amount (valor do negócio) para todos os deals em
 * data/closer_perdidos_full.json e data/sdr_perdidos_full.json e grava data/deal_amount_map.json.
 * Requer HUBSPOT_ACCESS_TOKEN no .env.
 * Rode: node scripts/fetch-amount-batch.cjs
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
const outFile = path.join(dataDir, 'deal_amount_map.json');

function api(path, body) {
  return new Promise((resolve, reject) => {
    const str = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.hubapi.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(str)
      }
    }, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          reject(new Error(`${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(str);
    req.end();
  });
}

function loadDealIds() {
  const ids = [];
  for (const name of ['closer_perdidos_full.json', 'sdr_perdidos_full.json']) {
    const p = path.join(dataDir, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const r of j.results || []) {
      if (r.id) ids.push(String(r.id));
    }
  }
  return [...new Set(ids)];
}

async function run() {
  if (!token) {
    console.error('Defina HUBSPOT_ACCESS_TOKEN no .env');
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dealIds = loadDealIds();
  console.log('Deals a buscar amount:', dealIds.length);

  const BATCH = 100;
  const map = {};
  for (let i = 0; i < dealIds.length; i += BATCH) {
    const batch = dealIds.slice(i, i + BATCH);
    const res = await api('/crm/v3/objects/deals/batch/read', {
      inputs: batch.map((id) => ({ id })),
      properties: ['amount']
    });
    for (const r of res.results || []) {
      const v = r.properties?.amount;
      if (v != null && v !== '') map[r.id] = v;
    }
    console.log(`Amount: ${Math.min(i + BATCH, dealIds.length)}/${dealIds.length}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  fs.writeFileSync(outFile, JSON.stringify(map, null, 0), 'utf8');
  console.log('Salvo:', outFile, '→', Object.keys(map).length, 'deals com valor');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
