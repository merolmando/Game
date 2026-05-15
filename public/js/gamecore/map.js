const Map = {
  current: null,

  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error al cargar mapa (${res.status}): ${path}`);
    const data = await res.json();
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
    if (layer === 'mundo') return this.current.tiles;
    return null;
  },

  getTile(x, y, layer) {
    layer = layer || 'mundo';
    if (!this.current) return 1;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.current.width || iy < 0 || iy >= this.current.height) return 1;

    if (this.current.layers) {
      const grid = this.current.layers[layer];
      if (Array.isArray(grid)) return grid[iy][ix];
      return 0;
    }

    if (layer === 'mundo') return this.current.tiles[iy][ix];
    return 0;
  },

  isSolid(x, y) {
    if (!this.current) return true;
    const id = this.getTile(x, y, 'mundo');

    if (id === 0) return false;

    if (this.current.tileSprites && this.current.tileSprites[id]) {
      const entityId = this.current.tileSprites[id];
      const entity = Sprite.getEntity(entityId);
      if (entity) return entity.solid;
    }

    const info = this.current.tileColors[id];
    return info ? info.solid : true;
  },

  checkExits(px, py) {
    if (!this.current) return null;
    const ix = Math.floor(px + 0.5);
    const iy = Math.floor(py + 0.5);
    for (const exit of this.current.exits || []) {
      if (exit.tileX === ix && exit.tileY === iy) return exit;
    }
    return null;
  },

  getWidth() {
    return this.current ? this.current.width : 0;
  },

  getHeight() {
    return this.current ? this.current.height : 0;
  },
};
