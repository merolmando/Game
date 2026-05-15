const Sprite = {
  atlas: null,
  atlasJson: null,
  loaded: false,
  animTimers: {},

  async load() {
    try {
      const [imgRes, jsonRes] = await Promise.all([
        fetch('/generated/atlas.png'),
        fetch('/generated/atlas.json'),
      ]);
      if (!imgRes.ok || !jsonRes.ok) throw new Error('No se pudo cargar el atlas');

      this.atlasJson = await jsonRes.json();

      this.atlas = new Image();
      await new Promise((resolve, reject) => {
        this.atlas.onload = resolve;
        this.atlas.onerror = () => reject(new Error('Error al cargar atlas.png'));
        this.atlas.src = '/generated/atlas.png';
      });

      this.loaded = true;
      console.log('[Sprite] Atlas cargado:', this.atlasJson.width + 'x' + this.atlasJson.height + ', ' + Object.keys(this.atlasJson.sprites).length + ' entidades');
    } catch (err) {
      console.warn('[Sprite] No se pudo cargar el atlas:', err.message);
      console.warn('[Sprite] El renderizado usará colores de fallback.');
    }
  },

  getEntity(entityId) {
    if (!this.atlasJson) return null;
    return this.atlasJson.sprites[entityId] || null;
  },

  getFrame(entityId, frameIndex) {
    const info = this.getEntity(entityId);
    if (!info) return null;
    const f = frameIndex % info.frames;
    return {
      sx: info.x + f * info.frameW,
      sy: info.y,
      sw: info.frameW,
      sh: info.frameH,
    };
  },

  getAnimFrame(entityId, dt) {
    const info = this.getEntity(entityId);
    if (!info || info.frames <= 1) return this.getFrame(entityId, 0);

    if (!this.animTimers[entityId]) this.animTimers[entityId] = 0;
    this.animTimers[entityId] += dt;

    const speed = info.animSpeed || 0.2;
    const frameIndex = Math.floor(this.animTimers[entityId] / speed) % info.frames;
    return this.getFrame(entityId, frameIndex);
  },

  resetAnim(entityId) {
    this.animTimers[entityId] = 0;
  },

  draw(ctx, entityId, dx, dy, dw, dh, frameIndex) {
    if (!this.loaded || !this.atlas) return false;

    const info = this.getEntity(entityId);
    if (!info) return false;

    const fi = frameIndex !== undefined ? frameIndex : 0;
    const frame = this.getFrame(entityId, fi);
    if (!frame) return false;

    ctx.drawImage(this.atlas, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
    return true;
  },

  drawAnim(ctx, entityId, dx, dy, dw, dh, dt) {
    const frame = this.getAnimFrame(entityId, dt);
    if (!frame || !this.loaded || !this.atlas) return false;

    ctx.drawImage(this.atlas, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
    return true;
  },
};
