// Cámara 2D: centra la vista en el jugador y se limita a los bordes del mapa.

const Camera = {
  x: 0,
  y: 0,

  // Calcula el offset de cámara para centrar en (targetX, targetY).
  // El mapa mide mapPixelW × mapPixelH píxeles.
  // Clampa para que no se vea fuera del mapa.
  update(targetX, targetY, mapPixelW, mapPixelH) {
    this.x = targetX - SCREEN_W / 2;
    this.y = targetY - SCREEN_H / 2;

    if (mapPixelW > SCREEN_W) {
      this.x = Math.max(0, Math.min(this.x, mapPixelW - SCREEN_W));
    } else {
      this.x = (mapPixelW - SCREEN_W) / 2;
    }

    if (mapPixelH > SCREEN_H) {
      this.y = Math.max(0, Math.min(this.y, mapPixelH - SCREEN_H));
    } else {
      this.y = (mapPixelH - SCREEN_H) / 2;
    }

    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
  },
};
