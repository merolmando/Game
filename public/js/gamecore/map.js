const Map = {
  current: null,

  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error al cargar mapa (${res.status}): ${path}`);
    const data = await res.json();
    this.current = data;
    return data;
  },

  getTile(x, y) {
    if (!this.current) return 1;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.current.width || iy < 0 || iy >= this.current.height) return 1;
    return this.current.tiles[iy][ix];
  },

  isSolid(x, y) {
    if (!this.current) return true;
    const id = this.getTile(x, y);
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
};
