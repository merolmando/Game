const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const VIEWS_DIR = path.join(__dirname, '../views');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ROUTES = {
  '/': 'index.html',
  '/juego': 'juego.html',
  '/desarrollo': 'desarrollo.html',
  '/devlog': 'devlog.html',
  '/hitos': 'hitos.html',
  '/docs': 'docs.html',
  '/docs/gamecore': 'docs.html',
};

const ROOT_DIR = path.join(__dirname, '..');

const FILE_ROUTES = {
  '/README.md': path.join(ROOT_DIR, 'README.md'),
};

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Página no encontrada</h1><a href="/">Volver al inicio</a>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error del servidor: ${err.code}</h1>`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (ROUTES[url]) {
    const filePath = path.join(VIEWS_DIR, ROUTES[url]);
    return serveFile(res, filePath, 'text/html');
  }

  if (FILE_ROUTES[url]) {
    const ext = path.extname(FILE_ROUTES[url]);
    return serveFile(res, FILE_ROUTES[url], MIME_TYPES[ext] || 'text/plain');
  }

  const filePath = path.join(PUBLIC_DIR, url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  serveFile(res, filePath, contentType);
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}/`);
});
