/**
 * Busca os 2000 deals perdidos MAIS RECENTES do pipeline SDR (ordenados por hs_lastmodifieddate DESC).
 * Salva em data/sdr_perdidos_full.json. Requer HUBSPOT_ACCESS_TOKEN no .env.
 * Rode: node scripts/fetch-sdr-perdidos-full.cjs
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
const outFile = path.join(dataDir, 'sdr_perdidos_full.json');

const PROPERTIES = [
  'dealname', 'closed_lost_reason', 'qual_feature_esta_indisponivel_',
  'numero_de_lojas', 'observacao_de_importacao', 'amount',
  'hs_v2_date_entered_closedlost', 'hs_v2_date_entered_246594929'
];

function search(after = null) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      filterGroups: [{
        filters: [
          { propertyName: 'dealstage', operator: 'EQ', value: '246594929' },
          { propertyName: 'pipeline', operator: 'EQ', value: '145028430' }
        ]
      }],
      properties: PROPERTIES,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
      limit: 100,
      ...(after != null && { after: String(after) })
    });
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/crm/v3/objects/deals/search',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HubSpot ${res.statusCode}: ${data.slice(0, 400)}`));
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
    req.write(body);
    req.end();
  });
}

async function run() {
  if (!token) {
    console.error('Defina HUBSPOT_ACCESS_TOKEN no .env');
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const MAX_SDR = 2000;
  const all = [];
  let after = undefined;
  let page = 0;
  do {
    page++;
    const res = await search(after);
    const results = res.results || [];
    const toAdd = results.slice(0, MAX_SDR - all.length);
    all.push(...toAdd);
    after = res.paging?.next?.after ?? null;
    console.log(`Página ${page}: +${toAdd.length} (total: ${all.length})`);
    if (all.length >= MAX_SDR) break;
    if (after != null) await new Promise((r) => setTimeout(r, 120));
  } while (after != null);

  fs.writeFileSync(outFile, JSON.stringify({ results: all }), 'utf8');
  console.log('Salvo:', outFile, '→', all.length, 'deals (máx. 2000 mais recentes)');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
