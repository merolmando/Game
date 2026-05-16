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
  '/desarrollo/herramientas/editor-hud': path.join(PUBLIC_DIR, 'devtools/editor-hud/index.html'),
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

const HUD_DIR = path.join(PUBLIC_DIR, 'generated', 'hud');

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

function loadEntityData(entityId) {
  const entityPath = path.join(ENTIDADES_DIR, entityId, 'entity.js');
  if (!fs.existsSync(entityPath)) return null;
  return JSON.parse(fs.readFileSync(entityPath, 'utf8'));
}

function _isSolidTile(mapData, tileId) {
  if (!tileId) return false;
  const entityId = mapData.tileSprites && mapData.tileSprites[tileId];
  if (entityId) {
    const ed = loadEntityData(entityId);
    if (ed && ed.solid) return true;
  }
  const info = mapData.tileColors && mapData.tileColors[tileId];
  return info ? !!info.solid : true;
}

function hasLineOfSight(mapData, x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1, cy = y1;

  while (cx !== x2 || cy !== y2) {
    if ((cx !== x1 || cy !== y1) && (cx !== x2 || cy !== y2)) {
      const grid = mapData.layers && mapData.layers.estructura;
      if (grid && grid[cy] && grid[cy][cx] && _isSolidTile(mapData, grid[cy][cx])) {
        return false;
      }
    }
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return true;
}

function computeLightmap(mapData) {
  const w = mapData.width, h = mapData.height;
  const ambient = 0.4;
  const lightmap = Array.from({ length: h }, () => Array(w).fill(ambient));

  const emitters = [];
  const emissionCache = {};

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const layers = mapData.layers || {};
      for (const layerName of ['estructura', 'terreno', 'objetos']) {
        const grid = layers[layerName];
        if (!grid || !grid[y]) continue;
        const tileId = grid[y][x];
        if (!tileId || tileId === 0) continue;
        const entityId = mapData.tileSprites && mapData.tileSprites[tileId];
        if (!entityId) continue;
        if (emissionCache[entityId] === undefined) {
          const ed = loadEntityData(entityId);
          emissionCache[entityId] = ed ? (ed.emission || 0) : 0;
        }
        if (emissionCache[entityId] > 0) {
          emitters.push({ x, y, emission: emissionCache[entityId] });
        }
      }
    }
  }

  if (emitters.length === 0) return lightmap;

  const maxRadius = 10;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let total = ambient;
      for (const e of emitters) {
        const dx = x - e.x, dy = y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= maxRadius && hasLineOfSight(mapData, e.x, e.y, x, y)) {
          total += e.emission / (dist * 0.4 + 0.5);
        }
      }
      lightmap[y][x] = Math.min(1, total);
    }
  }
  return lightmap;
}

function saveMapFile(name, data) {
  data.lightmap = computeLightmap(data);
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

  if (method === 'GET' && url === '/api/hud') {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const name = parsedUrl.searchParams.get('name');
    if (name) {
      const filePath = path.join(HUD_DIR, name + '.json');
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return sendJson(res, 200, data);
        } catch { return sendJson(res, 404, { error: 'Error al leer HUD' }); }
      } else {
        return sendJson(res, 404, { error: 'HUD no encontrado' });
      }
    }
    if (!fs.existsSync(HUD_DIR)) return sendJson(res, 200, []);
    const files = fs.readdirSync(HUD_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => ({ name: f.replace('.json', ''), file: f }));
    return sendJson(res, 200, list);
  }

  if (method === 'POST' && url === '/api/hud') {
    return parseJsonBody(req).then(body => {
      const { name, data } = body;
      if (!name || !data) return sendJson(res, 400, { error: 'name y data son requeridos' });
      if (!fs.existsSync(HUD_DIR)) fs.mkdirSync(HUD_DIR, { recursive: true });
      fs.writeFileSync(path.join(HUD_DIR, name + '.json'), JSON.stringify(data, null, 2));
      sendJson(res, 200, { ok: true, name });
    }).catch(err => sendJson(res, 400, { error: err.message }));
  }

  if (method === 'DELETE' && url.startsWith('/api/hud/')) {
    const hudName = url.replace('/api/hud/', '');
    if (!hudName) return sendJson(res, 400, { error: 'name requerido' });
    const filePath = path.join(HUD_DIR, hudName + '.json');
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'HUD no encontrado' });
    try {
      fs.rmSync(filePath);
      sendJson(res, 200, { ok: true, name: hudName });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
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
