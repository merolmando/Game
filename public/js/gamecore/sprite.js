const Sprite = {
  // Imagen del atlas de sprites (hoja de sprites).
  atlas: null,
  loaded: false,

  // Carga un atlas desde una ruta de imagen.
  load(imagePath) {
    return new Promise(resolve => {
      this.atlas = new Image();
      this.atlas.onload = () => {
        this.loaded = true;
        resolve();
      };
      this.atlas.src = imagePath;
    });
  },

  // Dibuja un sprite recortado del atlas en una posición del canvas.
  // sx, sy, sw, sh = rectángulo de recorte en el atlas.
  // dx, dy, dw, dh = rectángulo de destino en el canvas.
  draw(ctx, id, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!this.loaded) return;
    ctx.drawImage(this.atlas, sx, sy, sw, sh, dx, dy, dw, dh);
  },
};
