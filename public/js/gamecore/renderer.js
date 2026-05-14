const Renderer = {
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // La resolución interna es fija; el CSS escala el canvas al tamaño del contenedor.
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    // Buffer de rayos: un resultado por cada columna de píxeles.
    this.rays = new Array(SCREEN_W);
  },

  // Dibuja el frame completo cada ciclo del game loop.
  render(player) {
    const ctx = this.ctx;

    // Calcula todos los rayos para la posición actual del jugador.
    Raycaster.cast(this.rays, player);

    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

    this.drawCeiling(ctx);
    this.drawFloor(ctx);
    this.drawWalls(ctx, player);
    this.drawMinimap(ctx, player);
  },

  // Cielo: mitad superior de la pantalla.
  drawCeiling(ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
  },

  // Suelo: mitad inferior de la pantalla.
  drawFloor(ctx) {
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);
  },

  // Paredes: dibuja una franja vertical por cada rayo.
  drawWalls(ctx, player) {
    // Mapa de colores según el tipo de tile.
    const tileColors = {
      1: '#c97b3a',
      2: '#6b4c8a',
    };

    for (let x = 0; x < this.rays.length; x++) {
      const ray = this.rays[x];
      const baseColor = tileColors[ray.tileType] || '#888';
      // Las paredes en el eje Y (N/S) se ven más oscuras para dar sensación 3D.
      const shade = ray.side === 1 ? 0.6 : 1;
      ctx.fillStyle = this.shadeColor(baseColor, shade);
      ctx.fillRect(x, ray.drawStart, 1, ray.drawEnd - ray.drawStart);
    }
  },

  // Minimapa en la esquina inferior izquierda para orientación.
  drawMinimap(ctx, player) {
    const scale = 4;
    const offsetX = 10;
    const offsetY = SCREEN_H - MAP_H * scale - 10;

    // Dibuja el grid del mapa.
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        ctx.fillStyle = MAP[y][x] === 0 ? '#333' : '#888';
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }

    // Posición del jugador en el minimapa.
    const px = offsetX + player.x * scale;
    const py = offsetY + player.y * scale;
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();

    // Dirección hacia donde mira el jugador.
    ctx.strokeStyle = '#f44';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.dirX * 10, py + player.dirY * 10);
    ctx.stroke();
  },

  // Oscurece un color hexadecimal por un factor (0-1).
  shadeColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.min(255, Math.floor(r * factor));
    const ng = Math.min(255, Math.floor(g * factor));
    const nb = Math.min(255, Math.floor(b * factor));
    return `rgb(${nr},${ng},${nb})`;
  },
};
