const SpriteManager = {
  sprites: [],
  _texCache: {},
  _animTimers: {},

  async build(mapData) {
    this.clear();
    if (!Sprite.loaded) {
      await Sprite.load(['mundo', 'entidades']);
    }
    if (!Sprite.loaded) return;

    const ts = mapData.tileSprites || {};
    const objetos = mapData.layers && mapData.layers.objetos;

    if (objetos) {
      for (let y = 0; y < mapData.height; y++) {
        for (let x = 0; x < mapData.width; x++) {
          const tileId = objetos[y][x];
          if (tileId && ts[tileId]) {
            this._addBillboard(ts[tileId], x + 0.5, y + 0.5);
          }
        }
      }
    }

    for (const ch of (mapData.characters || [])) {
      this._addBillboard(ch.entityId, ch.x + 0.5, ch.y + 0.5);
    }

    for (const en of (mapData.enemies || [])) {
      this._addBillboard(en.entityId, en.x + 0.5, en.y + 0.5);
    }

    for (const exit of (mapData.exits || [])) {
      if (exit.tileX !== undefined && exit.tileY !== undefined) {
        this._addBillboard(exit.entityId || 'puerta', exit.tileX + 0.5, exit.tileY + 0.5);
      }
    }
  },

  _addBillboard(entityId, wx, wz) {
    const info = Sprite.getEntity(entityId);
    if (!info) return;

    const tileW = info.tileW || 1;
    const tileH = info.tileH || 1;
    const halfBlock = info.halfBlock || false;
    const frames = info.frames || 1;
    const animSpeed = info.animSpeed || 0;

    const textures = this._getTextures(entityId, info, halfBlock);
    if (!textures || textures.length === 0) return;

    const material = new THREE.SpriteMaterial({
      map: textures[0],
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    const mesh = new THREE.Sprite(material);
    const height = halfBlock ? tileH * 0.5 : tileH;
    const yOffset = height * 0.5;

    mesh.position.set(wx, yOffset, wz);
    mesh.scale.set(tileW, height, 1);

    const entry = { mesh, entityId, wx, wz, info, texIndex: 0, textures };
    this.sprites.push(entry);
    Scene3D.scene.add(mesh);

    if (animSpeed > 0 && frames > 1) {
      const key = entityId + '_' + (this.sprites.length - 1);
      this._animTimers[key] = 0;
      entry.animKey = key;
    }
  },

  _getTextures(entityId, info, halfBlock) {
    if (this._texCache[entityId]) return this._texCache[entityId].frames;

    const frames = info.frames || 1;
    const texArray = [];
    const tileSize = 32;

    for (let i = 0; i < frames; i++) {
      const frame = Sprite.getFrame(entityId, i);
      if (!frame) continue;

      const atlas = Sprite.getAtlas(frame.atlasName);
      if (!atlas || !atlas.img) continue;

      const sw = frame.sw;
      const sh = frame.sh;
      const useHalf = halfBlock && sh > tileSize;
      const canvasH = useHalf ? Math.floor(sh / 2) : sh;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      if (useHalf) {
        ctx.drawImage(atlas.img, frame.sx, frame.sy, sw, canvasH, 0, 0, sw, canvasH);
      } else {
        ctx.drawImage(atlas.img, frame.sx, frame.sy, sw, sh, 0, 0, sw, canvasH);
      }

      if (frame.mirror) {
        const temp = document.createElement('canvas');
        temp.width = sw;
        temp.height = canvasH;
        const tCtx = temp.getContext('2d');
        tCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, sw, canvasH);
        ctx.save();
        ctx.translate(sw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(temp, 0, 0);
        ctx.restore();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texArray.push(texture);
    }

    this._texCache[entityId] = { frames: texArray, animSpeed: info.animSpeed || 0 };
    return texArray;
  },

  update(dt) {
    for (const entry of this.sprites) {
      if (!entry.animKey) continue;
      const timer = (this._animTimers[entry.animKey] || 0) + dt;
      this._animTimers[entry.animKey] = timer;
      const speed = entry.info.animSpeed || 0.2;
      const fi = Math.floor(timer / speed) % entry.textures.length;
      if (fi !== entry.texIndex) {
        entry.texIndex = fi;
        entry.mesh.material.map = entry.textures[fi];
        entry.mesh.material.needsUpdate = true;
      }
    }
  },

  clear() {
    for (const entry of this.sprites) {
      Scene3D.scene.remove(entry.mesh);
      entry.mesh.material.dispose();
    }
    this.sprites = [];
    this._animTimers = {};
  },
};
