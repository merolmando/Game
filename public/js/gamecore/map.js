const Map = {
  current: null,
  message: '',
  messageTimer: 0,

  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error al cargar mapa (${res.status}): ${path}`);
    const data = await res.json();
    migrateMapData(data);
    this.current = data;
    return data;
  },

  getGrid(layer) {
    if (!this.current) return null;
    if (this.current.layers) {
      const l = this.current.layers[layer];
      if (layer === 'cielo') return l;
      return Array.isArray(l) ? l : null;
    }
    if (layer === 'estructura' && this.current.tiles) return this.current.tiles;
    return null;
  },

  getTile(x, y, layer) {
    layer = layer || 'estructura';
    if (!this.current) return 1;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.current.width || iy < 0 || iy >= this.current.height) return 1;

    if (this.current.layers) {
      const grid = this.current.layers[layer];
      if (Array.isArray(grid)) return grid[iy][ix];
      return 0;
    }

    if (layer === 'estructura' && this.current.tiles) return this.current.tiles[iy][ix];
    return 0;
  },

  _isTileSolid(id) {
    if (id === 0) return false;
    if (this.current.tileSprites && this.current.tileSprites[id]) {
      const entityId = this.current.tileSprites[id];
      const entity = Sprite.getEntity(entityId);
      if (entity) return entity.solid;
    }
    const info = this.current.tileColors[id];
    return info ? info.solid : true;
  },

  isWall(x, y) {
    if (!this.current) return true;
    const id = this.getTile(x, y, 'estructura');
    return this._isTileSolid(id);
  },

  isSolid(x, y) {
    if (!this.current) return true;
    const idEstructura = this.getTile(x, y, 'estructura');
    if (this._isTileSolid(idEstructura)) return true;
    const idTerreno = this.getTile(x, y, 'terreno');
    return this._isTileSolid(idTerreno);
  },

  _tileInBounds(tx, ty) {
    return this.current && tx >= 0 && tx < this.current.width && ty >= 0 && ty < this.current.height;
  },

  checkCircleCollision(cx, cy, radius) {
    if (!this.current) return true;
    const minTX = Math.floor(cx - radius);
    const maxTX = Math.floor(cx + radius);
    const minTY = Math.floor(cy - radius);
    const maxTY = Math.floor(cy + radius);
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (!this._tileInBounds(tx, ty)) return true;
        const idEstructura = this.getTile(tx, ty, 'estructura');
        const idTerreno = this.getTile(tx, ty, 'terreno');
        if (!this._isTileSolid(idEstructura) && !this._isTileSolid(idTerreno)) continue;
        const closestX = Math.max(tx, Math.min(cx, tx + 1));
        const closestY = Math.max(ty, Math.min(cy, ty + 1));
        const dx = cx - closestX;
        const dy = cy - closestY;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  },

  checkExits(px, py) {
    if (!this.current) return null;
    for (const exit of this.current.exits || []) {
      const closestX = Math.max(exit.tileX, Math.min(px, exit.tileX + 1));
      const closestY = Math.max(exit.tileY, Math.min(py, exit.tileY + 1));
      const dx = px - closestX;
      const dy = py - closestY;
      if (dx * dx + dy * dy < 0.5 * 0.5) return exit;
    }
    return null;
  },

  getWidth() {
    return this.current ? this.current.width : 0;
  },

  getHeight() {
    return this.current ? this.current.height : 0;
  },

  getLight(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!this.current || !this.current.lightmap) return 1.0;
    if (iy < 0 || iy >= this.current.lightmap.length) return 0.5;
    if (ix < 0 || ix >= this.current.lightmap[iy].length) return 0.5;
    return this.current.lightmap[iy][ix];
  },
};

function _isWallEntity(entityId) {
  return entityId && entityId.includes('pared');
}

function migrateMapData(data) {
  function isWallTile(id) {
    if (id === 0) return false;
    const entityId = data.tileSprites && data.tileSprites[id];
    if (entityId) return _isWallEntity(entityId);
    const info = data.tileColors && data.tileColors[id];
    if (info) {
      const name = (info.name || '').toLowerCase();
      return name.includes('pared') || name.includes('wall');
    }
    return true;
  }

  if (!data.layers) {
    const h = data.height;
    const w = data.width;
    const oldTiles = data.tiles || Array.from({ length: h }, () => Array(w).fill(0));
    const newEstructura = Array.from({ length: h }, () => Array(w).fill(0));
    const newTerreno = Array.from({ length: h }, () => Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = oldTiles[y][x];
        if (isWallTile(id)) newEstructura[y][x] = id;
        else newTerreno[y][x] = id;
      }
    }
    data.layers = {
      cielo: { type: 'solid', color: '#1a1a2e' },
      terreno: newTerreno,
      estructura: newEstructura,
      objetos: Array.from({ length: h }, () => Array(w).fill(0)),
    };
    delete data.tiles;
  } else {
    if (data.layers.mundo) {
      if (!data.layers.estructura) {
        const h = data.height;
        const w = data.width;
        const mundo = data.layers.mundo;
        const newEstructura = Array.from({ length: h }, () => Array(w).fill(0));
        const newTerreno = data.layers.terreno
          ? data.layers.terreno.map(row => [...row])
          : Array.from({ length: h }, () => Array(w).fill(0));
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const id = mundo[y][x];
            if (id === 0) continue;
            if (isWallTile(id)) newEstructura[y][x] = id;
            else newTerreno[y][x] = id;
          }
        }
        data.layers.estructura = newEstructura;
        data.layers.terreno = newTerreno;
      }
      delete data.layers.mundo;
    }
    if (!data.layers.objetos) {
      data.layers.objetos = Array.from({ length: data.height }, () => Array(data.width).fill(0));
    }
  }
  if (!data.characters) data.characters = [];
  if (!data.enemies) data.enemies = [];
}
