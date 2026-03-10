/**
 * Busca a 7ª página (48 deals) de perdidos CLOSER e salva em data/closer_page7.json.
 * Requer HUBSPOT_ACCESS_TOKEN no .env (Private App ou OAuth).
 * Rode: node scripts/fetch-closer-page7.cjs
 * Depois: node scripts/merge-deals-full.cjs && node scripts/export-hubspot-perdidos-v3.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*HUBSPOT_ACCESS_TOKEN\s*=\s*(.+)/);
    if (m) process.env.HUBSPOT_ACCESS_TOKEN = m[1].trim();
  });
}
const token = process.env.HUBSPOT_ACCESS_TOKEN;
const dataDir = path.join(__dirname, '..', 'data');
const outFile = path.join(dataDir, 'closer_page7.json');

const body = JSON.stringify({
  filterGroups: [{
    filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: 'closedlost' },
      { propertyName: 'pipeline', operator: 'EQ', value: 'default' }
    ]
  }],
  properties: [
    'dealname', 'closed_lost_reason', 'qual_feature_esta_indisponivel_',
    'numero_de_lojas', 'observacao_de_importacao',
    'hs_v2_date_entered_closedlost', 'hs_v2_date_entered_246594929'
  ],
  limit: 100,
  after: '600'
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
      console.error('Erro HubSpot:', res.statusCode, data.slice(0, 300));
      process.exit(1);
    }
    const j = JSON.parse(data);
    const results = j.results || [];
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ results }), 'utf8');
    console.log('data/closer_page7.json:', results.length, 'deals');
  });
});
req.on('error', (e) => { console.error(e); process.exit(1); });
req.write(body);
req.end();
