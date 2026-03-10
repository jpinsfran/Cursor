/**
 * Remove linhas que contenham a palavra "teste" (qualquer coluna, case insensitive)
 * dos CSVs de perdidos CLOSER e SDR. Mantém o header.
 * Uso: node scripts/filter-teste-from-csv.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  path.join(root, 'hubspot_perdidos_pipeline_CLOSER.csv'),
  path.join(root, 'hubspot_perdidos_pipeline_SDR.csv')
];

/** Parseia CSV linha a linha (respeitando aspas e quebras de linha dentro de campos). Retorna { rows: string[], parsed: any[][] }. */
function parseCsvToRows(content) {
  const rows = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQuotes && content[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      cur += c;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && content[i + 1] === '\n') i++;
      rows.push(cur);
      cur = '';
    } else cur += c;
  }
  if (cur) rows.push(cur);
  return rows;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function rowContainsTeste(cells) {
  return cells.some(cell => String(cell).toLowerCase().includes('teste'));
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('Arquivo não encontrado:', filePath);
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const bom = raw.charCodeAt(0) === 0xFEFF ? '\ufeff' : '';
  const content = bom ? raw.slice(1) : raw;
  const rows = parseCsvToRows(content);
  if (rows.length < 2) return;
  const header = rows[0];
  const dataRows = rows.slice(1).filter(Boolean);
  let kept = 0;
  let removed = 0;
  const outRows = [header];
  for (const rowStr of dataRows) {
    const cells = parseCsvLine(rowStr);
    if (rowContainsTeste(cells)) {
      removed++;
    } else {
      outRows.push(rowStr);
      kept++;
    }
  }
  const out = bom + outRows.join('\n');
  try {
    fs.writeFileSync(filePath, out, 'utf8');
    console.log(path.basename(filePath) + ':', kept, 'linhas mantidas,', removed, 'removidas (teste)');
  } catch (err) {
    if (err.code === 'EBUSY') {
      const altPath = filePath.replace(/\.csv$/i, '_sem_teste.csv');
      fs.writeFileSync(altPath, out, 'utf8');
      console.log(path.basename(filePath) + ':', kept, 'mantidas,', removed, 'removidas. (Arquivo original aberto → salvo em', path.basename(altPath) + ')');
    } else throw err;
  }
}

for (const f of files) processFile(f);
