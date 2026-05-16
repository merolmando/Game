const http = require('http');
const fs = require('fs');
const path = require('path');
const { build: buildAtlas } = require('../tools/build-atlas');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const VIEWS_DIR = path.join(__dirname, '../views');
const ENTIDADES_DIR = path.join(PUBLIC_DIR, 'entidades');

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
  '/desarrollo/herramientas': 'desarrollo.html',
  '/devlog': 'devlog.html',
  '/hitos': 'hitos.html',
  '/hitos/actual': 'hitos.html',
  '/hitos/tareas': 'hitos.html',
  '/docs': 'docs.html',
  '/docs/gamecore': 'docs.html',
};

const ROOT_DIR = path.join(__dirname, '..');

const FILE_ROUTES = {
  '/README.md': path.join(ROOT_DIR, 'README.md'),
};

const TOOL_ROUTES = {
  '/desarrollo/herramientas/inspector-mapa': path.join(PUBLIC_DIR, 'devtools/inspector-mapa/index.html'),
  '/desarrollo/herramientas/creador-tiles': path.join(PUBLIC_DIR, 'devtools/creador-tiles/index.html'),
  '/desarrollo/herramientas/cortador-texturas': path.join(PUBLIC_DIR, 'devtools/cortador-texturas/index.html'),
  '/desarrollo/herramientas/visor-atlas': path.join(PUBLIC_DIR, 'devtools/visor-atlas/index.html'),
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

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function listEntities() {
  if (!fs.existsSync(ENTIDADES_DIR)) return [];
  const entries = fs.readdirSync(ENTIDADES_DIR, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entityPath = path.join(ENTIDADES_DIR, entry.name, 'entity.js');
    const spritePath = path.join(ENTIDADES_DIR, entry.name, 'sprite.png');
    if (fs.existsSync(entityPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
        result.push({
          id: entry.name,
          ...data,
          hasSprite: fs.existsSync(spritePath),
        });
      } catch (e) {
        result.push({ id: entry.name, error: 'entity.js inválido' });
      }
    }
  }
  return result;
}

function saveEntity(entityId, entityData, spriteBase64) {
  const dir = path.join(ENTIDADES_DIR, entityId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'entity.js'), JSON.stringify(entityData, null, 2));

  if (spriteBase64) {
    const base64Data = spriteBase64.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(dir, 'sprite.png'), Buffer.from(base64Data, 'base64'));
  }
}

function deleteEntity(entityId) {
  const dir = path.join(ENTIDADES_DIR, entityId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const MAPS_DIR = path.join(PUBLIC_DIR, 'maps');
const MAPS_CONFIG = path.join(MAPS_DIR, 'config.json');

function listMaps() {
  if (!fs.existsSync(MAPS_DIR)) return [];
  const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json') && f !== 'COLORES.md' && f !== 'config.json');
  const result = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, file), 'utf8'));
      result.push({ fileId: file.replace('.json', ''), fileName: file, ...data });
    } catch (e) {
      result.push({ name: file.replace('.json', ''), fileName: file, error: 'JSON inválido' });
    }
  }
  return result;
}

function saveMapFile(name, data) {
  const filePath = path.join(MAPS_DIR, name + '.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function deleteMapFile(name) {
  const filePath = path.join(MAPS_DIR, name + '.json');
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  if (method === 'GET' && url === '/api/entidades') {
    return sendJson(res, 200, listEntities());
  }

  if (method === 'POST' && url === '/api/entidades') {
    return parseJsonBody(req).then(async body => {
      const { entityId, entityData, spriteBase64 } = body;
      if (!entityId || !entityData) {
        return sendJson(res, 400, { error: 'entityId y entityData son requeridos' });
      }
      try {
        saveEntity(entityId, entityData, spriteBase64 || null);
        await buildAtlas();
        sendJson(res, 200, { ok: true, entityId });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
    }).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
  }

  if (method === 'DELETE' && url.startsWith('/api/entidades/')) {
    const entityId = url.replace('/api/entidades/', '');
    if (!entityId) return sendJson(res, 400, { error: 'entityId requerido' });
    if (!fs.existsSync(path.join(ENTIDADES_DIR, entityId))) {
      return sendJson(res, 404, { error: 'Entidad no encontrada' });
    }
    deleteEntity(entityId);
    buildAtlas().then(() => {
      sendJson(res, 200, { ok: true, entityId });
    });
    return;
  }

  if (method === 'POST' && url === '/api/atlas/rebuild') {
    buildAtlas().then(() => {
      sendJson(res, 200, { ok: true });
    }).catch(err => {
      sendJson(res, 500, { error: err.message });
    });
    return;
  }

  if (method === 'GET' && url === '/api/mapas') {
    return sendJson(res, 200, listMaps());
  }

  if (method === 'POST' && url === '/api/mapas') {
    return parseJsonBody(req).then(async body => {
      const { name, data } = body;
      if (!name || !data) {
        return sendJson(res, 400, { error: 'name y data son requeridos' });
      }
      try {
        saveMapFile(name, data);
        sendJson(res, 200, { ok: true, name });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
    }).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
  }

  if (method === 'GET' && url === '/api/mapas/default') {
    try {
      if (fs.existsSync(MAPS_CONFIG)) {
        const config = JSON.parse(fs.readFileSync(MAPS_CONFIG, 'utf8'));
        return sendJson(res, 200, config);
      }
      return sendJson(res, 200, { defaultMap: 'inicio' });
    } catch {
      return sendJson(res, 200, { defaultMap: 'inicio' });
    }
  }

  if (method === 'POST' && url === '/api/mapas/default') {
    return parseJsonBody(req).then(body => {
      if (!body.defaultMap) return sendJson(res, 400, { error: 'defaultMap requerido' });
      fs.writeFileSync(MAPS_CONFIG, JSON.stringify({ defaultMap: body.defaultMap }, null, 2));
      sendJson(res, 200, { ok: true, defaultMap: body.defaultMap });
    }).catch(err => {
      sendJson(res, 400, { error: err.message });
    });
    return;
  }

  if (method === 'DELETE' && url.startsWith('/api/mapas/')) {
    const mapName = url.replace('/api/mapas/', '');
    if (!mapName) return sendJson(res, 400, { error: 'name requerido' });
    const filePath = path.join(MAPS_DIR, mapName + '.json');
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: 'Mapa no encontrado' });
    }
    try {
      deleteMapFile(mapName);
      sendJson(res, 200, { ok: true, name: mapName });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (method === 'GET' && req.url.startsWith('/api/mapas/resolve-label')) {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const label = parsedUrl.searchParams.get('label');
    if (!label) return sendJson(res, 400, { error: 'label requerido' });
    const maps = listMaps();
    for (const map of maps) {
      if (!map.exits) continue;
      for (const exit of map.exits) {
        if (exit.connectionId === label) {
          return sendJson(res, 200, {
            found: true,
            fileId: map.fileId,
            tileX: exit.tileX,
            tileY: exit.tileY,
            direction: exit.direction || 'up'
          });
        }
      }
    }
    return sendJson(res, 200, { found: false });
  }

  if (ROUTES[url]) {
    const filePath = path.join(VIEWS_DIR, ROUTES[url]);
    return serveFile(res, filePath, 'text/html');
  }

  if (FILE_ROUTES[url]) {
    const ext = path.extname(FILE_ROUTES[url]);
    return serveFile(res, FILE_ROUTES[url], MIME_TYPES[ext] || 'text/plain');
  }

  if (TOOL_ROUTES[url]) {
    return serveFile(res, TOOL_ROUTES[url], 'text/html');
  }

  const filePath = path.join(PUBLIC_DIR, url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  serveFile(res, filePath, contentType);
});

buildAtlas().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}/`);
  });
}).catch(err => {
  console.error('Error al construir el atlas:', err);
  process.exit(1);
});
