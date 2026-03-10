/**
 * Gera mini-bi.html a partir dos CSVs de perdidos (CLOSER e SDR).
 * Analisa: valor total perdido, quantidade por motivo, por feature, totais por pipeline.
 * Rode: node scripts/build-mini-bi.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const closerCsv = path.join(root, 'hubspot_perdidos_pipeline_CLOSER.csv');
const sdrCsv = path.join(root, 'hubspot_perdidos_pipeline_SDR.csv');
const outHtml = path.join(root, 'mini-bi.html');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = (cells[j] || '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function num(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeFeature(s) {
  if (!s || !String(s).trim()) return '(sem feature)';
  return String(s).trim();
}

function splitFeatures(s) {
  if (!s || !String(s).trim()) return ['(sem feature)'];
  return String(s).split(';').map((x) => x.trim()).filter(Boolean);
}

function loadCsv(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] };
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

(function run() {
  const closer = loadCsv(closerCsv);
  const sdr = loadCsv(sdrCsv);

  const allRows = [
    ...closer.rows.map((r) => ({ ...r, pipeline: 'CLOSER' })),
    ...sdr.rows.map((r) => ({ ...r, pipeline: 'SDR' }))
  ];

  let totalAmount = 0;
  const byReason = {};
  const byFeature = {};
  const byPipeline = { CLOSER: { count: 0, amount: 0 }, SDR: { count: 0, amount: 0 } };

  for (const r of allRows) {
    const amt = num(r['Valor do negócio']);
    totalAmount += amt;
    const reason = (r['Motivo fechamento perdido'] || '(sem motivo)').trim() || '(sem motivo)';
    byReason[reason] = (byReason[reason] || 0) + 1;
    const feats = splitFeatures(r['Qual feature está indisponível']);
    for (const f of feats) {
      const key = normalizeFeature(f);
      if (!byFeature[key]) byFeature[key] = { count: 0, amount: 0 };
      byFeature[key].count += 1;
      byFeature[key].amount += amt / feats.length;
    }
    const pipe = r.pipeline || 'SDR';
    if (byPipeline[pipe]) {
      byPipeline[pipe].count += 1;
      byPipeline[pipe].amount += amt;
    }
  }

  const topReasons = Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFeatures = Object.entries(byFeature).sort((a, b) => b[1].count - a[1].count).slice(0, 20);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mini BI – Perdidos HubSpot</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root { --bg: #0f1419; --card: #1a2332; --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff; --lost: #f85149; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; }
    h1 { font-size: 1.35rem; font-weight: 600; margin-bottom: 1rem; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi { background: var(--card); border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #30363d; }
    .kpi .label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi .value { font-size: 1.6rem; font-weight: 700; margin-top: 0.25rem; color: var(--lost); }
    .kpi .sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.25rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--card); border-radius: 10px; padding: 1rem; border: 1px solid #30363d; }
    .card h2 { font-size: 1rem; margin: 0 0 1rem; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #30363d; }
    th { color: var(--muted); font-weight: 500; }
    .chart-wrap { height: 280px; position: relative; }
  </style>
</head>
<body>
  <h1>Mini BI – Negócios perdidos (HubSpot)</h1>
  <p style="color: var(--muted); margin-bottom: 1.5rem;">CLOSER: ${byPipeline.CLOSER.count} leads · SDR: ${byPipeline.SDR.count} leads</p>

  <div class="kpis">
    <div class="kpi">
      <div class="label">Valor total perdido</div>
      <div class="value">R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${allRows.length} negócios</div>
    </div>
    <div class="kpi">
      <div class="label">CLOSER</div>
      <div class="value">R$ ${byPipeline.CLOSER.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${byPipeline.CLOSER.count} perdidos</div>
    </div>
    <div class="kpi">
      <div class="label">SDR</div>
      <div class="value">R$ ${byPipeline.SDR.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${byPipeline.SDR.count} perdidos</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Top motivos de perda (quantidade)</h2>
      <div class="chart-wrap"><canvas id="chartReasons"></canvas></div>
    </div>
    <div class="card">
      <h2>Top features indisponíveis (quantidade)</h2>
      <div class="chart-wrap"><canvas id="chartFeatures"></canvas></div>
    </div>
  </div>

  <div class="card" style="margin-top: 1.5rem;">
    <h2>Motivos de perda (detalhe)</h2>
    <table>
      <thead><tr><th>Motivo</th><th>Qtd</th></tr></thead>
      <tbody>
${topReasons.map(([k, v]) => `        <tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>

  <div class="card" style="margin-top: 1.5rem;">
    <h2>Features indisponíveis (detalhe)</h2>
    <table>
      <thead><tr><th>Feature</th><th>Qtd</th><th>Valor estimado (R$)</th></tr></thead>
      <tbody>
${topFeatures.map(([k, v]) => `        <tr><td>${escapeHtml(k)}</td><td>${v.count}</td><td>${v.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>

  <script>
    const reasonsLabels = ${JSON.stringify(topReasons.map(([k]) => k))};
    const reasonsData = ${JSON.stringify(topReasons.map(([, v]) => v))};
    const featuresLabels = ${JSON.stringify(topFeatures.map(([k]) => k))};
    const featuresData = ${JSON.stringify(topFeatures.map(([, v]) => v.count))};
    new Chart(document.getElementById('chartReasons'), {
      type: 'bar',
      data: { labels: reasonsLabels, datasets: [{ label: 'Qtd', data: reasonsData, backgroundColor: '#58a6ff80', borderColor: '#58a6ff', borderWidth: 1 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
    new Chart(document.getElementById('chartFeatures'), {
      type: 'bar',
      data: { labels: featuresLabels, datasets: [{ label: 'Qtd', data: featuresData, backgroundColor: '#f8514980', borderColor: '#f85149', borderWidth: 1 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  </script>
</body>
</html>`;

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const reasonRows = topReasons.map(([k, v]) => `        <tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('\n');
  const featureRows = topFeatures.map(([k, v]) => `        <tr><td>${esc(k)}</td><td>${v.count}</td><td>${v.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('\n');

  const htmlOut = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mini BI – Perdidos HubSpot</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root { --bg: #0f1419; --card: #1a2332; --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff; --lost: #f85149; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; }
    h1 { font-size: 1.35rem; font-weight: 600; margin-bottom: 1rem; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi { background: var(--card); border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #30363d; }
    .kpi .label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi .value { font-size: 1.6rem; font-weight: 700; margin-top: 0.25rem; color: var(--lost); }
    .kpi .sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.25rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--card); border-radius: 10px; padding: 1rem; border: 1px solid #30363d; }
    .card h2 { font-size: 1rem; margin: 0 0 1rem; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #30363d; }
    th { color: var(--muted); font-weight: 500; }
    .chart-wrap { height: 280px; position: relative; }
  </style>
</head>
<body>
  <h1>Mini BI – Negócios perdidos (HubSpot)</h1>
  <p style="color: var(--muted); margin-bottom: 1.5rem;">CLOSER: ${byPipeline.CLOSER.count} leads · SDR: ${byPipeline.SDR.count} leads</p>
  <div class="kpis">
    <div class="kpi">
      <div class="label">Valor total perdido</div>
      <div class="value">R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${allRows.length} negócios</div>
    </div>
    <div class="kpi">
      <div class="label">CLOSER</div>
      <div class="value">R$ ${byPipeline.CLOSER.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${byPipeline.CLOSER.count} perdidos</div>
    </div>
    <div class="kpi">
      <div class="label">SDR</div>
      <div class="value">R$ ${byPipeline.SDR.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="sub">${byPipeline.SDR.count} perdidos</div>
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <h2>Top motivos de perda (quantidade)</h2>
      <div class="chart-wrap"><canvas id="chartReasons"></canvas></div>
    </div>
    <div class="card">
      <h2>Top features indisponíveis (quantidade)</h2>
      <div class="chart-wrap"><canvas id="chartFeatures"></canvas></div>
    </div>
  </div>
  <div class="card" style="margin-top: 1.5rem;">
    <h2>Motivos de perda (detalhe)</h2>
    <table>
      <thead><tr><th>Motivo</th><th>Qtd</th></tr></thead>
      <tbody>
${reasonRows}
      </tbody>
    </table>
  </div>
  <div class="card" style="margin-top: 1.5rem;">
    <h2>Features indisponíveis (detalhe)</h2>
    <table>
      <thead><tr><th>Feature</th><th>Qtd</th><th>Valor estimado (R$)</th></tr></thead>
      <tbody>
${featureRows}
      </tbody>
    </table>
  </div>
  <script>
    const reasonsLabels = ${JSON.stringify(topReasons.map(([k]) => k))};
    const reasonsData = ${JSON.stringify(topReasons.map(([, v]) => v))};
    const featuresLabels = ${JSON.stringify(topFeatures.map(([k]) => k))};
    const featuresData = ${JSON.stringify(topFeatures.map(([, v]) => v.count))};
    new Chart(document.getElementById('chartReasons'), {
      type: 'bar',
      data: { labels: reasonsLabels, datasets: [{ label: 'Qtd', data: reasonsData, backgroundColor: '#58a6ff80', borderColor: '#58a6ff', borderWidth: 1 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
    new Chart(document.getElementById('chartFeatures'), {
      type: 'bar',
      data: { labels: featuresLabels, datasets: [{ label: 'Qtd', data: featuresData, backgroundColor: '#f8514980', borderColor: '#f85149', borderWidth: 1 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outHtml, htmlOut);
  console.log('Gerado:', outHtml);
})();
