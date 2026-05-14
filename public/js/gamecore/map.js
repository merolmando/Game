// Mapa del mundo en formato grid 2D.
// 0 = suelo transitable, 1 = pared naranja, 2 = pared púrpura.
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,2,2,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,0,2,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

const Map = {
  // Devuelve el tipo de tile en una posición (coordenadas float).
  // Si está fuera del mapa, devuelve 1 (pared por defecto).
  getTile(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= MAP_W || iy < 0 || iy >= MAP_H) return 1;
    return MAP[iy][ix];
  },

  // True si la posición es una pared (no transitable).
  isSolid(x, y) {
    return this.getTile(x, y) !== 0;
  },
};
