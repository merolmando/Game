const Sprite = {
  atlases: {},
  loaded: false,
  animTimers: {},
  _atlasList: [],

  get atlas() {
    const m = this.atlases['mundo'];
    return m ? m.img : null;
  },

  get atlasJson() {
    const m = this.atlases['mundo'];
    return m ? m.json : null;
  },

  async load(names) {
    if (!names) {
      try {
        const res = await fetch('/generated/atlas.json?t=' + Date.now());
        if (res.ok) {
          names = ['mundo'];
        }
      } catch {}
    }
    if (!names || names.length === 0) names = ['mundo'];

    const fetchPromises = names.map(async name => {
      try {
        const [imgRes, jsonRes] = await Promise.all([
          fetch(`/generated/atlas_${name}.png?t=${Date.now()}`),
          fetch(`/generated/atlas_${name}.json?t=${Date.now()}`),
        ]);

        if (!imgRes.ok || !jsonRes.ok) {
          console.warn(`[Sprite] atlas_${name}: no encontrado`);
          return null;
        }

        const json = await jsonRes.json();

        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error(`Error al cargar atlas_${name}.png`));
          img.src = `/generated/atlas_${name}.png?t=${Date.now()}`;
        });

        return { name, img, json };
      } catch (err) {
        console.warn(`[Sprite] atlas_${name}: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);

    for (const result of results) {
      if (result) {
        this.atlases[result.name] = { img: result.img, json: result.json };
        this._atlasList.push(result.name);
      }
    }

    this.loaded = this._atlasList.length > 0;
    if (this.loaded) {
      const total = this._atlasList.length;
      let count = 0;
      for (const name of this._atlasList) {
        count += Object.keys(this.atlases[name].json.sprites).length;
      }
      console.log(`[Sprite] ${total} atlases cargados, ${count} entidades totales`);
    } else {
      console.warn('[Sprite] No se pudo cargar ningún atlas. Renderizado con colores de fallback.');
    }
  },

  _findEntity(entityId) {
    for (const name of this._atlasList) {
      const atlas = this.atlases[name];
      if (atlas && atlas.json && atlas.json.sprites[entityId]) {
        return { atlas: name, data: atlas.json.sprites[entityId], img: atlas.img };
      }
    }
    return null;
  },

  getEntity(entityId) {
    const found = this._findEntity(entityId);
    return found ? found.data : null;
  },

  getAtlas(name) {
    return this.atlases[name] || null;
  },

  getAtlasNames() {
    return [...this._atlasList];
  },

  getImageData(name) {
    const atlas = this.atlases[name];
    if (!atlas || !atlas.img) return null;

    if (!atlas._imageData) {
      const c = document.createElement('canvas');
      c.width = atlas.img.width;
      c.height = atlas.img.height;
      const cx = c.getContext('2d');
      cx.drawImage(atlas.img, 0, 0);
      atlas._imageData = cx.getImageData(0, 0, c.width, c.height);
    }
    return atlas._imageData;
  },

  _resolveDir(entityData, direction) {
    if (!direction) return { frameOffset: 0, mirror: false };
    const df = entityData.dirFrames;
    if (!df) return { frameOffset: 0, mirror: false };
    const entry = df[direction] || df['default'] || { frameOffset: 0, mirror: false };
    return entry;
  },

  getFrame(entityId, frameIndex, direction) {
    const found = this._findEntity(entityId);
    if (!found) return null;
    const info = found.data;
    const f = frameIndex !== undefined ? frameIndex % info.frames : 0;
    const dir = this._resolveDir(info, direction);
    const actualFrame = (dir.frameOffset + f) % (info.frames * (info.dirFrames ? Object.keys(info.dirFrames).length : 1));
    return {
      sx: info.x + actualFrame * info.frameW,
      sy: info.y,
      sw: info.frameW,
      sh: info.frameH,
      atlasName: found.atlas,
      mirror: dir.mirror,
    };
  },

  getAnimFrame(entityId, dt, direction) {
    const info = this.getEntity(entityId);
    if (!info || info.frames <= 1) return this.getFrame(entityId, 0, direction);

    if (!this.animTimers[entityId]) this.animTimers[entityId] = 0;
    this.animTimers[entityId] += dt;

    const speed = info.animSpeed || 0.2;
    const frameIndex = Math.floor(this.animTimers[entityId] / speed) % info.frames;
    return this.getFrame(entityId, frameIndex, direction);
  },

  resetAnim(entityId) {
    this.animTimers[entityId] = 0;
  },

  draw(ctx, entityId, dx, dy, dw, dh, frameIndex, direction) {
    if (!this.loaded) return false;
    const found = this._findEntity(entityId);
    if (!found) return false;

    const fi = frameIndex !== undefined ? frameIndex : 0;
    const frame = this.getFrame(entityId, fi, direction);
    if (!frame) return false;

    if (frame.mirror) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(found.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(found.img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
    }
    return true;
  },

  drawAnim(ctx, entityId, dx, dy, dw, dh, dt, direction) {
    if (!this.loaded) return false;
    const found = this._findEntity(entityId);
    if (!found) return false;

    const frame = this.getAnimFrame(entityId, dt, direction);
    if (!frame) return false;

    if (frame.mirror) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(found.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(found.img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
    }
    return true;
  },
};
