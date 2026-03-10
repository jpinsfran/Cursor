/**
 * Servidor HTTP mínimo para abrir o Mini BI com dados em tempo real.
 * Sirve a pasta raiz do projeto para que o mini-bi.html possa carregar os CSVs.
 * Uso: node scripts/serve-bi.cjs
 * Depois abra no navegador: http://localhost:3333/mini-bi.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const ROOT = path.join(__dirname, '..');

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0];
  if (file === '/') file = '/mini-bi.html';
  const filePath = path.join(ROOT, file.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
    fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIMES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache');
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Mini BI (filtros Todos/CLOSER/SDR): http://localhost:' + PORT + '/mini-bi.html');
  console.log('Feche com Ctrl+C.');
});
