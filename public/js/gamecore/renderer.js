const Renderer = {
  mode: '2d',
  atlasImageData: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.rays = new Array(SCREEN_W);
  },

  _buildAtlasData() {
    if (!Sprite.loaded) return;
    const mundo = Sprite.getAtlas('mundo');
    if (!mundo || !mundo.img) return;
    const c = document.createElement('canvas');
    c.width = mundo.img.width;
    c.height = mundo.img.height;
    const cx = c.getContext('2d');
    cx.drawImage(mundo.img, 0, 0);
    this.atlasImageData = cx.getImageData(0, 0, c.width, c.height);
  },

  render(player) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

    if (!GameMap.current) return;
    this.mode = GameMap.current.mode;

    if (this.mode === 'ray') {
      Raycaster.cast(this.rays, player);
      this.drawCeiling(ctx);
      this.drawFloor(ctx, player);
      this.drawWalls(ctx, player);
      this.drawObjects(ctx, player);
      this.drawMinimap(ctx, player);
    } else {
      this.draw2D(ctx, player);
    }

    this.drawTransition(ctx);
    this.drawMessage(ctx);
  },

  drawCeiling(ctx) {
    const sky = GameMap.current.layers ? GameMap.current.layers.cielo : null;
    if (sky && sky.type === 'solid') {
      ctx.fillStyle = sky.color;
    } else {
      ctx.fillStyle = '#1a1a2e';
    }
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
  },

  _drawSolidFloor(ctx, player) {
    if (GameMap.current && GameMap.current.layers && GameMap.current.layers.terreno && player) {
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      const tileId = (GameMap.current.layers.terreno[py] && GameMap.current.layers.terreno[py][px]) || 0;
      const info = GameMap.current.tileColors ? GameMap.current.tileColors[tileId] : null;
      ctx.fillStyle = info ? info.color : '#2d2d44';
    } else {
      ctx.fillStyle = '#2d2d44';
    }
    ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);
  },

  drawFloor(ctx, player) {
    if (Sprite.loaded && Sprite.getAtlas('mundo') && !this.atlasImageData) {
      this._buildAtlasData();
    }

    const map = GameMap.current;
    if (!map || !map.layers || !map.layers.terreno || !player) {
      this._drawSolidFloor(ctx, player);
      return;
    }

    if (!this.atlasImageData || !Sprite.getAtlas('mundo')) {
      this._drawSolidFloor(ctx, player);
      return;
    }

    const terreno = map.layers.terreno;
    const estructura = map.layers.estructura;
    const tileSprites = map.tileSprites || {};
    const tileColors = map.tileColors || {};
    const tileSize = map.tileSize || 32;
    const mapW = map.width;
    const mapH = map.height;
    const halfH = SCREEN_H / 2;

    if (!this._floorImg) this._floorImg = ctx.createImageData(SCREEN_W, halfH);
    const floorImg = this._floorImg;
    const fdata = floorImg.data;
    const aData = this.atlasImageData;
    const aW = aData.width;
    let lightCacheX = -1, lightCacheY = -1, lightCache = { r: 1, g: 1, b: 1 };

    for (let x = 0; x < SCREEN_W; x++) {
      const ray = this.rays[x];
        const wallBottom = Math.ceil(ray.drawEnd);
      const startY = Math.max(halfH + 1, wallBottom);

      const cameraX = 2 * x / SCREEN_W - 1;
      const rayDirX = player.dirX + player.planeX * cameraX;
      const rayDirY = player.dirY + player.planeY * cameraX;

      for (let y = startY; y < SCREEN_H; y++) {
        const p = y - halfH;
        if (p <= 0) continue;

        const rowDist = halfH / p;

        const floorX = player.x + rowDist * rayDirX;
        const floorY = player.y + rowDist * rayDirY;

        const tileX = Math.floor(floorX);
        const tileY = Math.floor(floorY);

        let r = 30, g = 30, b = 40;
        let alpha = 255;

        if (tileX >= 0 && tileX < mapW && tileY >= 0 && tileY < mapH) {
          const texX = Math.abs(Math.floor((floorX - tileX) * tileSize)) % tileSize;
          const texY = Math.abs(Math.floor((floorY - tileY) * tileSize)) % tileSize;

          const tId = terreno[tileY][tileX];
          if (tId !== 0) {
            const eId = tileSprites[tId];
            const sprite = eId ? Sprite.getEntity(eId) : null;
            if (sprite) {
              const atX = sprite.x + texX;
              const atY = sprite.y + texY;
              const idx = (atY * aW + atX) * 4;
              r = aData.data[idx];
              g = aData.data[idx + 1];
              b = aData.data[idx + 2];
              alpha = aData.data[idx + 3];
            } else {
              const info = tileColors[tId];
              if (info) {
                r = parseInt(info.color.slice(1, 3), 16);
                g = parseInt(info.color.slice(3, 5), 16);
                b = parseInt(info.color.slice(5, 7), 16);
              }
            }
          }

          if (estructura && alpha > 128) {
            const estId = estructura[tileY][tileX];
            if (estId !== 0) {
              const eId2 = tileSprites[estId];
              const sprite2 = eId2 ? Sprite.getEntity(eId2) : null;
              if (sprite2 && sprite2.solid === false) {
                const atX2 = sprite2.x + texX;
                const atY2 = sprite2.y + texY;
                const idx2 = (atY2 * aW + atX2) * 4;
                const or2 = aData.data[idx2];
                const og2 = aData.data[idx2 + 1];
                const ob2 = aData.data[idx2 + 2];
                const oa2 = aData.data[idx2 + 3];
                if (oa2 > 128) {
                  const fa = oa2 / 255;
                  r = Math.floor(r * (1 - fa) + or2 * fa);
                  g = Math.floor(g * (1 - fa) + og2 * fa);
                  b = Math.floor(b * (1 - fa) + ob2 * fa);
                }
              }
            }
          }
        }

        if (tileX !== lightCacheX || tileY !== lightCacheY) {
          lightCacheX = tileX;
          lightCacheY = tileY;
          lightCache = GameMap.getLight(tileX, tileY);
        }
        const fi = ((y - halfH) * SCREEN_W + x) * 4;
        fdata[fi] = Math.floor(r * lightCache.r);
        fdata[fi + 1] = Math.floor(g * lightCache.g);
        fdata[fi + 2] = Math.floor(b * lightCache.b);
        fdata[fi + 3] = 255;
      }
    }

    ctx.putImageData(floorImg, 0, halfH);
  },

  drawWalls(ctx, player) {
    const spriteAvailable = Sprite.loaded && Sprite.atlasJson;

    for (let x = 0; x < this.rays.length; x++) {
      const ray = this.rays[x];
      const hasTileSprites = GameMap.current.tileSprites;
      const entityId = hasTileSprites ? GameMap.current.tileSprites[ray.tileType] : null;
      const sprite = entityId ? Sprite.getEntity(entityId) : null;
      // Luz del tile adyacente a la cara visible de la pared
      let lx = ray.mapX, ly = ray.mapY;
      if (ray.side === 0) lx += ray.stepX === -1 ? 1 : -1;
      else ly += ray.stepY === -1 ? 1 : -1;

      let light;
      if (ray.side === 0) {
        const a = GameMap.getLight(lx, ray.mapY - 1);
        const b = GameMap.getLight(lx, ray.mapY);
        light = {
          r: a.r + (b.r - a.r) * ray.wallX,
          g: a.g + (b.g - a.g) * ray.wallX,
          b: a.b + (b.b - a.b) * ray.wallX,
        };
      } else {
        const a = GameMap.getLight(ray.mapX - 1, ly);
        const b = GameMap.getLight(ray.mapX, ly);
        light = {
          r: a.r + (b.r - a.r) * ray.wallX,
          g: a.g + (b.g - a.g) * ray.wallX,
          b: a.b + (b.b - a.b) * ray.wallX,
        };
      }

      const sideDark = ray.side === 1 ? 0.85 : 1;
      light.r *= sideDark;
      light.g *= sideDark;
      light.b *= sideDark;

      if (spriteAvailable && sprite && Sprite.atlas) {
        const texX = Math.floor(ray.wallX * sprite.frameW);
        ctx.drawImage(
          Sprite.atlas,
          sprite.x + texX, sprite.y, 1, sprite.frameH,
          x, ray.drawStart, 1, ray.drawEnd - ray.drawStart
        );
        if (light.r < 1 || light.g < 1 || light.b < 1) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = `rgb(${Math.floor(light.r * 255)},${Math.floor(light.g * 255)},${Math.floor(light.b * 255)})`;
          ctx.fillRect(x, ray.drawStart, 1, ray.drawEnd - ray.drawStart);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        const info = GameMap.current.tileColors[ray.tileType];
        const baseColor = info ? info.color : '#888';
        const intensity = (light.r + light.g + light.b) / 3;
        const shade = intensity * (ray.side === 1 ? 0.6 : 1);
        ctx.fillStyle = this.shadeColor(baseColor, shade);
        ctx.fillRect(x, ray.drawStart, 1, ray.drawEnd - ray.drawStart);
      }
    }
  },

  drawObjects(ctx, player) {
    const billboards = Raycaster.getBillboards(player);
    for (const obj of billboards) {
      let entityId = obj.entityId;
      if (!entityId && GameMap.current.tileSprites) entityId = GameMap.current.tileSprites[obj.tileId];
      const light = GameMap.getLight(obj.bx, obj.by);

      for (let stripe = obj.drawStartX; stripe <= obj.drawEndX; stripe++) {
        if (stripe < 0 || stripe >= SCREEN_W) continue;
        if (Raycaster.zBuffer[stripe] < obj.dist) continue;

        const texX = ((stripe - obj.screenX + obj.width / 2) / obj.width);
        const texXClamped = Math.max(0, Math.min(1, texX));

        if (Sprite.loaded && entityId && Sprite.getEntity(entityId)) {
          const frame = Sprite.getAnimFrame(entityId, this.dt || 0.016);
          if (frame) {
            const atlasName = frame.atlasName || 'mundo';
            const atlas = Sprite.getAtlas(atlasName);
            if (atlas && atlas.img) {
              const sx = frame.sx + Math.floor(texXClamped * frame.sw);
              ctx.drawImage(
                atlas.img,
                sx, frame.sy, 1, frame.sh,
                stripe, obj.drawStartY, 1, obj.drawEndY - obj.drawStartY
              );
              if (light.r < 1 || light.g < 1 || light.b < 1) {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = `rgb(${Math.floor(light.r * 255)},${Math.floor(light.g * 255)},${Math.floor(light.b * 255)})`;
                ctx.fillRect(stripe, obj.drawStartY, 1, obj.drawEndY - obj.drawStartY);
                ctx.globalCompositeOperation = 'source-over';
              }
            }
          }
        } else {
          const colorId = obj.tileId || 1;
          const info = GameMap.current.tileColors ? GameMap.current.tileColors[colorId] : null;
          const intensity = (light.r + light.g + light.b) / 3;
          ctx.fillStyle = this.shadeColor(info ? info.color : '#888', intensity);
          ctx.fillRect(stripe, obj.drawStartY, 1, obj.drawEndY - obj.drawStartY);
        }
      }
    }
  },

  drawMinimap(ctx, player) {
    const scale = 4;
    const offsetX = 10;
    const offsetY = SCREEN_H - GameMap.getHeight() * scale - 10;

    const grid = GameMap.getGrid('estructura') || GameMap.getGrid('terreno');
    if (!grid) return;

    for (let y = 0; y < GameMap.getHeight(); y++) {
      for (let x = 0; x < GameMap.getWidth(); x++) {
        const tile = grid[y][x];
        const info = GameMap.current.tileColors[tile];
        ctx.fillStyle = info ? info.color : '#333';
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }

    const px = offsetX + player.x * scale;
    const py = offsetY + player.y * scale;
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f44';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.dirX * 10, py + player.dirY * 10);
    ctx.stroke();
  },

  drawSky(ctx) {
    const sky = GameMap.current.layers ? GameMap.current.layers.cielo : null;
    if (sky && sky.type === 'solid') {
      ctx.fillStyle = sky.color;
    } else {
      ctx.fillStyle = '#1a1a2e';
    }
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  },

  drawLayer(ctx, layerName) {
    const map = GameMap.current;
    const grid = GameMap.getGrid(layerName);
    if (!grid) return;

    const ts = map.tileSize;
    const spriteAvailable = Sprite.loaded && Sprite.atlasJson;

    const startCol = Math.floor(Camera.x / ts);
    const startRow = Math.floor(Camera.y / ts);
    const endCol = Math.ceil((Camera.x + SCREEN_W) / ts);
    const endRow = Math.ceil((Camera.y + SCREEN_H) / ts);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
        const tile = grid[row][col];
        if (tile === 0) continue;

        const sx = Math.round(col * ts - Camera.x);
        const sy = Math.round(row * ts - Camera.y);

        let entityId = null;
        if (map.tileSprites) entityId = map.tileSprites[tile];

        const light = GameMap.getLight(col, row);

        if (spriteAvailable && entityId && Sprite.getEntity(entityId)) {
          const info = Sprite.getEntity(entityId);
          const fw = info.frameW || ts;
          const fh = info.frameH || ts;
          const halfBlock = info.halfBlock && fh > ts;
          const displayH = halfBlock ? fh / 2 : fh;
          const dy = sy - (displayH - ts);
          if (info.frames > 1) {
            Sprite.drawAnim(ctx, entityId, sx, dy, fw, displayH, this.dt || 0.016);
          } else {
            Sprite.draw(ctx, entityId, sx, dy, fw, displayH, 0);
          }
          if (light.r < 1 || light.g < 1 || light.b < 1) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgb(${Math.floor(light.r * 255)},${Math.floor(light.g * 255)},${Math.floor(light.b * 255)})`;
            ctx.fillRect(sx, dy, fw, displayH);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else {
          const info = map.tileColors ? map.tileColors[tile] : null;
          const intensity = (light.r + light.g + light.b) / 3;
          ctx.fillStyle = this.shadeColor(info ? info.color : '#000', intensity);
          ctx.fillRect(sx, sy, ts, ts);
        }
      }
    }
  },

  draw2D(ctx, player) {
    const map = GameMap.current;
    const ts = map.tileSize;
    const mapPixelW = map.width * ts;
    const mapPixelH = map.height * ts;

    Camera.update(player.x * ts, player.y * ts, mapPixelW, mapPixelH);

    this.drawSky(ctx);
    this.drawLayer(ctx, 'terreno');
    this.drawLayer(ctx, 'estructura');
    this.drawLayer(ctx, 'objetos');

    const pulse = Math.sin(Date.now() / 400) * 0.15 + 0.35;
    const dirArrow = { up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6' };
    for (const exit of map.exits || []) {
      const ex = Math.round(exit.tileX * ts - Camera.x);
      const ey = Math.round(exit.tileY * ts - Camera.y);

      const exitTileId = GameMap.getTile(exit.tileX, exit.tileY, 'estructura');
      let entityId = null;
      if (map.tileSprites) entityId = map.tileSprites[exitTileId];

      const spriteAvailable = Sprite.loaded && Sprite.atlasJson;
      if (spriteAvailable && entityId && Sprite.getEntity(entityId)) {
        Sprite.drawAnim(ctx, entityId, ex, ey, ts, ts, 0.016);
      } else {
        const info = map.tileColors ? map.tileColors[exitTileId] : null;
        ctx.fillStyle = info ? info.color : '#b8860b';
        ctx.fillRect(ex, ey, ts, ts);
      }

      const borderColor = exit.locked ? 'rgba(248,81,73, 0.7)' : `rgba(255, 215, 0, ${pulse})`;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = exit.locked ? 2 : 1;
      ctx.strokeRect(ex - 2, ey - 2, ts + 4, ts + 4);

      if (ts >= 24) {
        ctx.fillStyle = exit.locked ? '#f85149' : '#ffd700';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const arrow = dirArrow[exit.direction || 'up'] || '\u25B2';
        ctx.fillText(arrow, ex + ts / 2, ey + 2);

        if (exit.label && ts >= 32) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 3;
          ctx.fillText(exit.label, ex + ts / 2, ey + ts / 2 + 4);
          ctx.shadowBlur = 0;
        }
      }

      if (exit.locked) {
        ctx.font = '16px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f85149';
        ctx.fillText('\uD83D\uDD12', ex + ts / 2, ey + ts / 2);
      }
    }

    const px = Math.round(player.x * ts - Camera.x);
    const py = Math.round(player.y * ts - Camera.y) + Math.round(player.bobOffset);

    const spriteAvailable = Sprite.loaded && Sprite.atlasJson;
    if (spriteAvailable && Sprite.getEntity('player')) {
      const playerFrame = player.moving ? 1 + Math.floor(Date.now() / 200) % 3 : 0;
      const pInfo = Sprite.getEntity('player');
      const pW = pInfo ? (pInfo.frameW || ts) : ts;
      const pH = pInfo ? (pInfo.frameH || ts) : ts;
      const phb = pInfo && pInfo.halfBlock && pH > ts;
      Sprite.draw(ctx, 'player', px - pW / 2, py - (phb ? pH / 2 : pH), pW, phb ? pH / 2 : pH, playerFrame);

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + player.facingX * ts * 0.6, py + player.facingY * ts * 0.6);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      const halfSize = 10;
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(px - halfSize, py - halfSize, halfSize * 2, halfSize * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + player.facingX * 16, py + player.facingY * 16);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (spriteAvailable) {
      for (const ch of GameMap.current.characters || []) {
        const cx = Math.round(ch.x * ts - Camera.x);
        const cy = Math.round(ch.y * ts - Camera.y);
        const cInfo = Sprite.getEntity(ch.entityId);
        const cW = cInfo ? (cInfo.frameW || ts) : ts;
        const cH = cInfo ? (cInfo.frameH || ts) : ts;
        const chb = cInfo && cInfo.halfBlock && cH > ts;
        Sprite.drawAnim(ctx, ch.entityId, cx - cW / 2, cy - (chb ? cH / 2 : cH), cW, chb ? cH / 2 : cH, this.dt || 0.016);
      }
      for (const en of GameMap.current.enemies || []) {
        const ex = Math.round(en.x * ts - Camera.x);
        const ey = Math.round(en.y * ts - Camera.y);
        const eInfo = Sprite.getEntity(en.entityId);
        const eW = eInfo ? (eInfo.frameW || ts) : ts;
        const eH = eInfo ? (eInfo.frameH || ts) : ts;
        const ehb = eInfo && eInfo.halfBlock && eH > ts;
        Sprite.drawAnim(ctx, en.entityId, ex - eW / 2, ey - (ehb ? eH / 2 : eH), eW, ehb ? eH / 2 : eH, this.dt || 0.016);
      }
    }
  },

  drawMessage(ctx) {
    if (GameMap.message && GameMap.messageTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '14px sans-serif';
      const mw = ctx.measureText(GameMap.message).width + 40;
      const mh = 36;
      const mx = (SCREEN_W - mw) / 2;
      const my = SCREEN_H - 60;
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(mx + r, my);
      ctx.lineTo(mx + mw - r, my);
      ctx.quadraticCurveTo(mx + mw, my, mx + mw, my + r);
      ctx.lineTo(mx + mw, my + mh - r);
      ctx.quadraticCurveTo(mx + mw, my + mh, mx + mw - r, my + mh);
      ctx.lineTo(mx + r, my + mh);
      ctx.quadraticCurveTo(mx, my + mh, mx, my + mh - r);
      ctx.lineTo(mx, my + r);
      ctx.quadraticCurveTo(mx, my, mx + r, my);
      ctx.fill();
      ctx.fillStyle = '#f0e6d0';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GameMap.message, SCREEN_W / 2, my + mh / 2);
      ctx.restore();
    }
  },

  drawTransition(ctx) {
    const alpha = Transition.getAlpha();
    if (alpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  },

  shadeColor(hex, factor) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#') hex = '#888';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.min(255, Math.floor(r * factor));
    const ng = Math.min(255, Math.floor(g * factor));
    const nb = Math.min(255, Math.floor(b * factor));
    return `rgb(${nr},${ng},${nb})`;
  },
};
