const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ENTIDADES_DIR = path.join(__dirname, '..', 'public', 'entidades');
const GENERATED_DIR = path.join(__dirname, '..', 'public', 'generated');
const TILE_SIZE = 32;

function computeFingerprint() {
  const entries = fs.readdirSync(ENTIDADES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let data = '';
  for (const entry of entries) {
    const dirPath = path.join(ENTIDADES_DIR, entry.name);
    const files = fs.readdirSync(dirPath).sort();
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      data += entry.name + '/' + file + ':' + stat.mtimeMs + ':' + stat.size + '|';
    }
  }
  return crypto.createHash('md5').update(data).digest('hex');
}

function loadCache() {
  try {
    const cachePath = path.join(GENERATED_DIR, '.cache.json');
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveCache(fingerprint) {
  const cachePath = path.join(GENERATED_DIR, '.cache.json');
  fs.writeFileSync(cachePath, JSON.stringify({ fingerprint, updatedAt: Date.now() }, null, 2));
}

function entitySpriteSize(entityData) {
  const ts = entityData.tileSize || TILE_SIZE;
  const frames = entityData.frames || 1;
  const tileW = entityData.tileW || 1;
  const tileH = entityData.tileH || 1;
  const directions = entityData.directions || 'none';

  let numDirs = 1;
  if (directions === '4dir') numDirs = 3;
  else if (directions === '8dir') numDirs = 5;

  return {
    frameW: ts * tileW,
    frameH: ts * tileH,
    totalW: ts * tileW * frames * numDirs,
    totalH: ts * tileH,
    numDirs,
  };
}

function buildDirFrames(entityData) {
  const frames = entityData.frames || 1;
  const directions = entityData.directions || 'none';
  const mirror = entityData.mirror !== false;

  if (directions === 'none') {
    return { default: { frameOffset: 0, mirror: false } };
  }

  if (directions === '4dir') {
    return {
      up: { frameOffset: 0, mirror: false },
      right: { frameOffset: frames, mirror: false },
      down: { frameOffset: frames * 2, mirror: false },
      left: { frameOffset: frames, mirror },
    };
  }

  if (directions === '8dir') {
    return {
      up: { frameOffset: 0, mirror: false },
      upRight: { frameOffset: frames, mirror: false },
      right: { frameOffset: frames * 2, mirror: false },
      downRight: { frameOffset: frames * 3, mirror: false },
      down: { frameOffset: frames * 4, mirror: false },
      upLeft: { frameOffset: frames, mirror },
      left: { frameOffset: frames * 2, mirror },
      downLeft: { frameOffset: frames * 3, mirror },
    };
  }

  return { default: { frameOffset: 0, mirror: false } };
}

async function generatePlaceholderSprite(entityData) {
  const color = entityData.defaultColor || '#888';
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const size = entitySpriteSize(entityData);
  const totalW = size.totalW;
  const totalH = size.totalH;
  const ts = entityData.tileSize || TILE_SIZE;
  const tileH = entityData.tileH || 1;

  const frameH = ts * tileH;
  const svg = `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${totalW}" height="${totalH}" fill="rgb(${r},${g},${b})" rx="2"/>
    <line x1="${totalW * 0.25}" y1="${frameH * 0.5}" x2="${totalW * 0.75}" y2="${frameH * 0.5}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="${totalW * 0.5}" y1="${frameH * 0.25}" x2="${totalW * 0.5}" y2="${frameH * 0.75}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function extendSprite(filePath, targetW, targetH) {
  const raw = await sharp(fs.readFileSync(filePath)).ensureAlpha().metadata();
  if (raw.width === targetW && raw.height === targetH) {
    return sharp(fs.readFileSync(filePath)).ensureAlpha().toBuffer();
  }
  const pipeline = sharp(fs.readFileSync(filePath)).ensureAlpha();
  if (raw.width < targetW || raw.height < targetH) {
    return pipeline.extend({
      top: 0, left: 0,
      right: Math.max(0, targetW - raw.width),
      bottom: Math.max(0, targetH - raw.height),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).toBuffer();
  }
  return pipeline.extract({ left: 0, top: 0, width: targetW, height: targetH }).toBuffer();
}

function loadEntityData(entityId) {
  const dirPath = path.join(ENTIDADES_DIR, entityId);
  const entityPath = path.join(dirPath, 'entity.js');
  if (!fs.existsSync(entityPath)) return null;
  return JSON.parse(fs.readFileSync(entityPath, 'utf8'));
}

async function buildAtlasGroup(groupName, entities) {
  if (entities.length === 0) return;

  const sprites = {};
  const compositeOps = [];
  let atlasWidth = 0;
  let atlasHeight = 0;
  let currentRowX = 0;
  let currentRowY = 0;
  let currentRowH = 0;

  const sorted = [...entities].sort((a, b) => {
    const aH = (a.entityData || loadEntityData(a.entityId) || {}).tileH || 1;
    const bH = (b.entityData || loadEntityData(b.entityId) || {}).tileH || 1;
    return bH - aH;
  });

  for (const { entityId } of sorted) {
    const entityData = loadEntityData(entityId);
    if (!entityData) {
      console.warn(`[atlas] ${entityId}: sin entity.js, se omite`);
      continue;
    }

    const dirPath = path.join(ENTIDADES_DIR, entityId);
    const spritePath = path.join(dirPath, 'sprite.png');
    const size = entitySpriteSize(entityData);

    if (currentRowX + size.totalW > 2048 && currentRowX > 0) {
      currentRowX = 0;
      currentRowY += currentRowH;
      currentRowH = 0;
    }

    let spriteBuffer;
    if (fs.existsSync(spritePath)) {
      spriteBuffer = await extendSprite(spritePath, size.totalW, size.totalH);
    } else {
      console.log(`[atlas] ${entityId}: generando placeholder`);
      spriteBuffer = await generatePlaceholderSprite(entityData);
    }

    compositeOps.push({
      input: spriteBuffer,
      top: currentRowY,
      left: currentRowX,
    });

    const spriteEntry = {
      x: currentRowX,
      y: currentRowY,
      w: size.totalW,
      h: size.totalH,
      frames: entityData.frames || 1,
      frameW: size.frameW,
      frameH: size.frameH,
      solid: entityData.solid || false,
      blockVision: entityData.blockVision || false,
      halfBlock: entityData.halfBlock || false,
      halfSolid: entityData.halfSolid || false,
      tileW: entityData.tileW || 1,
      tileH: entityData.tileH || 1,
      type: entityData.type || 'tile',
      name: entityData.name || entityId,
      color: entityData.defaultColor || '#888',
      animSpeed: entityData.animSpeed || 0,
      directions: entityData.directions || 'none',
      mirror: entityData.mirror !== false,
      dirFrames: buildDirFrames(entityData),
      atlas: groupName,
    };

    if (entityData.layers && Object.keys(entityData.layers).length > 0) {
      spriteEntry.layers = {};
      for (const layerName of Object.keys(entityData.layers)) {
        const layer = entityData.layers[layerName];
        spriteEntry.layers[layerName] = {
          frameW: size.frameW,
          frameH: size.frameH,
          frames: layer.frames || entityData.frames || 1,
          animSpeed: layer.animSpeed || entityData.animSpeed || 0,
        };
      }
    }

    sprites[entityId] = spriteEntry;
    currentRowX += size.totalW;
    currentRowH = Math.max(currentRowH, size.totalH);
    atlasWidth = Math.max(atlasWidth, currentRowX);
  }

  atlasHeight = currentRowY + currentRowH;

  if (compositeOps.length === 0) {
    console.log(`[atlas] Grupo "${groupName}": sin entidades para compilar.`);
    return;
  }

  const atlasBuffer = await sharp({
    create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(compositeOps)
    .png()
    .toBuffer();

  const atlasPath = path.join(GENERATED_DIR, `atlas_${groupName}.png`);
  fs.writeFileSync(atlasPath, atlasBuffer);

  const entityOrder = entities.map(e => e.entityId);

  const manifest = {
    tileSize: TILE_SIZE,
    width: atlasWidth,
    height: atlasHeight,
    group: groupName,
    sprites,
    entityOrder,
  };

  const manifestPath = path.join(GENERATED_DIR, `atlas_${groupName}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[atlas] atlas_${groupName}: ${atlasWidth}x${atlasHeight}px, ${Object.keys(sprites).length} entidades`);
}

async function build() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  const fingerprint = computeFingerprint();
  const cache = loadCache();

  if (cache && cache.fingerprint === fingerprint) {
    console.log('[atlas] Sin cambios. Usando atlas cacheado.');
    return false;
  }

  console.log('[atlas] Cambios detectados. Generando atlas...');

  const entries = fs.readdirSync(ENTIDADES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const groups = {};
  for (const entry of entries) {
    const entityData = loadEntityData(entry.name);
    const atlas = entityData ? (entityData.atlas || 'mundo') : 'mundo';
    if (!groups[atlas]) groups[atlas] = [];
    groups[atlas].push({ entityId: entry.name, entityData });
  }

  for (const [groupName, groupEntities] of Object.entries(groups)) {
    await buildAtlasGroup(groupName, groupEntities);
  }

  saveCache(fingerprint);
  console.log(`[atlas] Total: ${Object.keys(groups).length} grupos generados`);
  return true;
}

if (require.main === module) {
  build().then(changed => {
    if (!changed) process.exit(0);
  }).catch(err => {
    console.error('[atlas] Error:', err);
    process.exit(1);
  });
}

module.exports = { build };
