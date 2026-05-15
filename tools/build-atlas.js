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

async function generatePlaceholderSprite(entityId, entityData) {
  const color = entityData.defaultColor || '#888';
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const ts = entityData.tileSize || TILE_SIZE;
  const frames = entityData.frames || 1;
  const totalW = ts * frames;

  const channels = [];
  for (let i = 0; i < frames; i++) {
    const brightness = 1 - i * 0.08;
    const rr = Math.min(255, Math.round(r * brightness));
    const gg = Math.min(255, Math.round(g * brightness));
    const bb = Math.min(255, Math.round(b * brightness));

    const svg = `<svg width="${ts}" height="${ts}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${ts}" height="${ts}" fill="rgb(${rr},${gg},${bb})" rx="2"/>
      <rect x="2" y="2" width="${ts - 4}" height="${ts - 4}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" rx="1"/>
      <line x1="${ts * 0.25}" y1="${ts * 0.5}" x2="${ts * 0.75}" y2="${ts * 0.5}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <line x1="${ts * 0.5}" y1="${ts * 0.25}" x2="${ts * 0.5}" y2="${ts * 0.75}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </svg>`;
    channels.push(svg);
  }

  const spriteBuffers = await Promise.all(
    channels.map(svg => sharp(Buffer.from(svg)).png().toBuffer())
  );

  if (frames === 1) return spriteBuffers[0];

  const composite = await sharp({
    create: { width: totalW, height: ts, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite(
    spriteBuffers.map((buf, i) => ({ input: buf, top: 0, left: i * ts }))
  ).png().toBuffer();

  return composite;
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

  const sprites = {};
  let currentX = 0;
  const ts = TILE_SIZE;
  const rowHeight = ts;

  const compositeOps = [];

  for (const entry of entries) {
    const entityId = entry.name;
    const dirPath = path.join(ENTIDADES_DIR, entityId);
    const entityPath = path.join(dirPath, 'entity.js');
    const spritePath = path.join(dirPath, 'sprite.png');

    if (!fs.existsSync(entityPath)) {
      console.warn(`[atlas] ${entityId}: sin entity.js, se omite`);
      continue;
    }

    const entityData = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
    const frames = entityData.frames || 1;
    const entityTileSize = entityData.tileSize || ts;

    let spriteBuffer;
    if (fs.existsSync(spritePath)) {
      spriteBuffer = await sharp(fs.readFileSync(spritePath))
        .ensureAlpha()
        .toBuffer();
    } else {
      console.log(`[atlas] ${entityId}: generando placeholder`);
      spriteBuffer = await generatePlaceholderSprite(entityId, entityData);
    }

    const spriteWidth = entityTileSize * frames;
    const spriteHeight = entityTileSize;

    compositeOps.push({
      input: spriteBuffer,
      top: 0,
      left: currentX,
    });

    sprites[entityId] = {
      x: currentX,
      y: 0,
      w: entityTileSize,
      h: entityTileSize,
      frames: frames,
      frameW: entityTileSize,
      frameH: entityTileSize,
      solid: entityData.solid || false,
      type: entityData.type || 'tile',
      name: entityData.name || entityId,
      color: entityData.defaultColor || '#888',
      animSpeed: entityData.animSpeed || 0,
    };

    currentX += spriteWidth;
  }

  if (compositeOps.length === 0) {
    console.log('[atlas] No hay entidades para compilar.');
    return false;
  }

  const atlasWidth = currentX;
  const atlasHeight = rowHeight;

  const atlasBuffer = await sharp({
    create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(compositeOps)
    .png()
    .toBuffer();

  const atlasPath = path.join(GENERATED_DIR, 'atlas.png');
  fs.writeFileSync(atlasPath, atlasBuffer);

  const manifest = {
    tileSize: ts,
    width: atlasWidth,
    height: atlasHeight,
    sprites,
    entityOrder: entries.map(e => e.name),
  };

  const manifestPath = path.join(GENERATED_DIR, 'atlas.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  saveCache(fingerprint);
  console.log(`[atlas] Atlas generado: ${atlasWidth}x${atlasHeight}px, ${Object.keys(sprites).length} entidades`);

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
