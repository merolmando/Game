const http = require('http');
const fs = require('fs');
const path = require('path');
const { build: buildAtlas } = require('../tools/build-atlas');

const PORT = parseInt(process.env.PORT, 10) || 3000;
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

function headers(contentType) {
  return { 'Content-Type': contentType, ...securityHeaders() };
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, headers('text/html'));
        res.end('<h1>404 - Página no encontrada</h1><a href="/">Volver al inicio</a>');
      } else {
        res.writeHead(500, headers('text/html'));
        res.end(`<h1>Error del servidor: ${err.code}</h1>`);
      }
    } else {
      res.writeHead(200, headers(contentType));
      res.end(content, 'utf-8');
    }
  });
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders() });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const MAX_BODY = 1024 * 1024; // 1MB
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error('Body demasiado grande (máx 1MB)'));
      }
      body += chunk;
    });
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

// Solo permite IDs alfanuméricos con guiones y guiones bajos
function isValidId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && /^[\w-]+$/.test(id);
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
  if (!isValidId(entityId)) throw new Error('entityId inválido');
  const dir = path.join(ENTIDADES_DIR, entityId);
  // Verificar que el path resuelve dentro de ENTIDADES_DIR
  if (!path.resolve(dir).startsWith(path.resolve(ENTIDADES_DIR))) throw new Error('entityId inválido');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'entity.js'), JSON.stringify(entityData, null, 2));

  if (spriteBase64) {
    const base64Data = spriteBase64.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(dir, 'sprite.png'), Buffer.from(base64Data, 'base64'));
  }
}

function deleteEntity(entityId) {
  if (!isValidId(entityId)) throw new Error('entityId inválido');
  const dir = path.join(ENTIDADES_DIR, entityId);
  if (!path.resolve(dir).startsWith(path.resolve(ENTIDADES_DIR))) throw new Error('entityId inválido');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function hasEmissiveTiles(mapData) {
  const w = mapData.width, h = mapData.height;
  const cached = {};
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
        if (cached[entityId] === undefined) {
          const ed = loadEntityData(entityId);
          cached[entityId] = ed && ed.emission && ed.emission > 0;
        }
        if (cached[entityId]) return true;
      }
    }
  }
  return false;
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
  if (!isValidId(entityId)) return null;
  const entityPath = path.join(ENTIDADES_DIR, entityId, 'entity.js');
  if (!path.resolve(entityPath).startsWith(path.resolve(ENTIDADES_DIR))) return null;
  if (!fs.existsSync(entityPath)) return null;
  return JSON.parse(fs.readFileSync(entityPath, 'utf8'));
}

function hasLineOfSight(mapData, x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1, cy = y1;

  while (cx !== x2 || cy !== y2) {
    if ((cx !== x1 || cy !== y1) && (cx !== x2 || cy !== y2)) {
      const grid = mapData.layers && mapData.layers.estructura;
      if (grid && grid[cy] && grid[cy][cx]) {
        return false;
      }
    }
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return true;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = v => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function progressBar(label, current, total) {
  const pct = Math.floor((current / total) * 100);
  const filled = Math.floor(pct / 5);
  const bar = '[' + '='.repeat(filled) + ' '.repeat(20 - filled) + ']';
  process.stdout.write('\r' + label + ': ' + bar + ' ' + pct + '%');
}

function computeLightmap(mapData) {
  const w = mapData.width, h = mapData.height;
  const ambient = 0.04;
  const maxRadius = 10;
  const bounceRadius = 4;
  const numBounces = mapData.lightBounces !== undefined ? mapData.lightBounces : 3;
  const bounceFactors = Array.from({ length: numBounces }, (_, i) => 0.4 / Math.pow(2, i));
  const bounceThreshold = 0.3;

  // Inicializar lightmap RGB con ambient
  const lightmap = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ r: ambient, g: ambient, b: ambient }))
  );

  // Encontrar emisores con color
  const emitters = [];
  const emitterCache = {};

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
        if (emitterCache[entityId] === undefined) {
          const ed = loadEntityData(entityId);
          if (ed && ed.emission && ed.emission > 0) {
            const color = ed.emissionColor ? hexToRgb(ed.emissionColor) : { r: 1, g: 1, b: 1 };
            emitterCache[entityId] = { intensity: ed.emission, color };
          } else {
            emitterCache[entityId] = null;
          }
        }
        const cached = emitterCache[entityId];
        if (cached) {
          emitters.push({ x, y, intensity: cached.intensity, color: cached.color });
        }
      }
    }
  }

  if (emitters.length === 0) {
    // Sin emisores → lightmap full bright
    return Array.from({ length: h }, () => Array(w).fill('#ffffff'));
  }

  console.log('');
  const totalTiles = w * h;

  // === Directo: rayos desde cada emisor ===
  for (let y = 0; y < h; y++) {
    progressBar('Directo', y * w, totalTiles);
    for (let x = 0; x < w; x++) {
      let totalR = ambient, totalG = ambient, totalB = ambient;
      for (const e of emitters) {
        const dx = x - e.x, dy = y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= maxRadius && hasLineOfSight(mapData, e.x, e.y, x, y)) {
          const atten = e.intensity / (dist * 0.4 + 0.5);
          totalR += e.color.r * atten;
          totalG += e.color.g * atten;
          totalB += e.color.b * atten;
        }
      }
      lightmap[y][x] = {
        r: clamp01(totalR),
        g: clamp01(totalG),
        b: clamp01(totalB),
      };
    }
  }
  progressBar('Directo', totalTiles, totalTiles);
  console.log('');

  // === Rebotes ===
  for (let bounce = 0; bounce < bounceFactors.length; bounce++) {
    const factor = bounceFactors[bounce];
    const label = 'Rebote ' + (bounce + 1);
    // Nueva capa acumuladora para este rebote
    const bounceAccum = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => ({ r: 0, g: 0, b: 0 }))
    );

    let processed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        processed++;
        progressBar(label, processed, totalTiles);
        // Las paredes no rebotan luz (bloquean propagación)
        const grid = mapData.layers && mapData.layers.estructura;
        if (grid && grid[y] && grid[y][x] > 0) continue;
        const src = lightmap[y][x];
        const intensity = (src.r + src.g + src.b) / 3;
        if (intensity < bounceThreshold) continue;

        for (let dy = -bounceRadius; dy <= bounceRadius; dy++) {
          for (let dx = -bounceRadius; dx <= bounceRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > bounceRadius) continue;
            if (!hasLineOfSight(mapData, x, y, nx, ny)) continue;

            const atten = factor / (dist * 0.5 + 0.5);
            bounceAccum[ny][nx].r += src.r * atten;
            bounceAccum[ny][nx].g += src.g * atten;
            bounceAccum[ny][nx].b += src.b * atten;
          }
        }
      }
    }

    // Acumular y clamar
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        lightmap[y][x].r = clamp01(lightmap[y][x].r + bounceAccum[y][x].r);
        lightmap[y][x].g = clamp01(lightmap[y][x].g + bounceAccum[y][x].g);
        lightmap[y][x].b = clamp01(lightmap[y][x].b + bounceAccum[y][x].b);
      }
    }
    progressBar(label, totalTiles, totalTiles);
    console.log('');
  }

  // Clamp final [0.01, 1.0] y convertir a hex
  const hexResult = Array.from({ length: h }, () => Array(w).fill('#000000'));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.max(0.01, clamp01(lightmap[y][x].r));
      const g = Math.max(0.01, clamp01(lightmap[y][x].g));
      const b = Math.max(0.01, clamp01(lightmap[y][x].b));
      hexResult[y][x] = rgbToHex(r, g, b);
    }
  }

  console.log('Lightmap generado: ' + w + 'x' + h);
  return hexResult;
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
    if (!entityId || !isValidId(entityId)) return sendJson(res, 400, { error: 'entityId inválido' });
    if (!fs.existsSync(path.join(ENTIDADES_DIR, entityId))) {
      return sendJson(res, 404, { error: 'Entidad no encontrada' });
    }
    deleteEntity(entityId);
    buildAtlas().then(() => {
      sendJson(res, 200, { ok: true, entityId });
    }).catch(err => {
      sendJson(res, 500, { error: err.message });
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

  if (method === 'POST' && url.startsWith('/api/mapas/') && url.endsWith('/recompute-lightmap')) {
    const mapName = url.replace('/api/mapas/', '').replace('/recompute-lightmap', '');
    if (!mapName || !isValidId(mapName)) return sendJson(res, 400, { error: 'name inválido' });
    try {
      const filePath = path.join(MAPS_DIR, mapName + '.json');
      if (!path.resolve(filePath).startsWith(path.resolve(MAPS_DIR))) return sendJson(res, 400, { error: 'name inválido' });
      if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'Mapa no encontrado' });
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const hasEmitters = hasEmissiveTiles(data);
      if (!hasEmitters) {
        delete data.lightmap;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return sendJson(res, 200, { ok: true, generated: false, reason: 'sin emisores' });
      }
      data.lightmap = computeLightmap(data);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      sendJson(res, 200, { ok: true, generated: true });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (method === 'DELETE' && url.startsWith('/api/mapas/')) {
    const mapName = url.replace('/api/mapas/', '');
    if (!mapName || !isValidId(mapName)) return sendJson(res, 400, { error: 'name inválido' });
    const filePath = path.join(MAPS_DIR, mapName + '.json');
    if (!path.resolve(filePath).startsWith(path.resolve(MAPS_DIR))) return sendJson(res, 400, { error: 'name inválido' });
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
      if (!isValidId(name)) return sendJson(res, 400, { error: 'name inválido' });
      const filePath = path.join(HUD_DIR, name + '.json');
      if (!path.resolve(filePath).startsWith(path.resolve(HUD_DIR))) return sendJson(res, 400, { error: 'name inválido' });
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
      if (!isValidId(name)) return sendJson(res, 400, { error: 'name inválido' });
      if (!fs.existsSync(HUD_DIR)) fs.mkdirSync(HUD_DIR, { recursive: true });
      fs.writeFileSync(path.join(HUD_DIR, name + '.json'), JSON.stringify(data, null, 2));
      sendJson(res, 200, { ok: true, name });
    }).catch(err => sendJson(res, 400, { error: err.message }));
  }

  if (method === 'DELETE' && url.startsWith('/api/hud/')) {
    const hudName = url.replace('/api/hud/', '');
    if (!hudName || !isValidId(hudName)) return sendJson(res, 400, { error: 'name inválido' });
    const filePath = path.join(HUD_DIR, hudName + '.json');
    if (!path.resolve(filePath).startsWith(path.resolve(HUD_DIR))) return sendJson(res, 400, { error: 'name inválido' });
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

  const filePath = path.resolve(path.join(PUBLIC_DIR, url));
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    return res.end('<h1>403 - Acceso denegado</h1>');
  }
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
