const Renderer = {
  mode: '2d',

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.rays = new Array(SCREEN_W);
  },

  render(player) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

    if (!Map.current) return;
    this.mode = Map.current.mode;

    if (this.mode === 'ray') {
      Raycaster.cast(this.rays, player);
      this.drawCeiling(ctx);
      this.drawFloor(ctx);
      this.drawWalls(ctx, player);
      this.drawMinimap(ctx, player);
    } else {
      this.draw2D(ctx, player);
    }

    this.drawTransition(ctx);
    this.drawMessage(ctx);
  },

  drawCeiling(ctx) {
    const sky = Map.current.layers ? Map.current.layers.cielo : null;
    if (sky && sky.type === 'solid') {
      ctx.fillStyle = sky.color;
    } else {
      ctx.fillStyle = '#1a1a2e';
    }
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
  },

  drawFloor(ctx) {
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);
  },

  drawWalls(ctx, player) {
    const spriteAvailable = Sprite.loaded && Sprite.atlasJson;

    for (let x = 0; x < this.rays.length; x++) {
      const ray = this.rays[x];
      const hasTileSprites = Map.current.tileSprites;
      const entityId = hasTileSprites ? Map.current.tileSprites[ray.tileType] : null;
      const sprite = entityId ? Sprite.getEntity(entityId) : null;

      if (spriteAvailable && sprite) {
        const texX = Math.floor(ray.wallX * sprite.frameW);
        const shade = ray.side === 1 ? 0.6 : 1;
        ctx.globalAlpha = shade;
        ctx.drawImage(
          Sprite.atlas,
          sprite.x + texX, sprite.y, 1, sprite.frameH,
          x, ray.drawStart, 1, ray.drawEnd - ray.drawStart
        );
        ctx.globalAlpha = 1;
      } else {
        const info = Map.current.tileColors[ray.tileType];
        const baseColor = info ? info.color : '#888';
        const shade = ray.side === 1 ? 0.6 : 1;
        ctx.fillStyle = this.shadeColor(baseColor, shade);
        ctx.fillRect(x, ray.drawStart, 1, ray.drawEnd - ray.drawStart);
      }
    }
  },

  drawMinimap(ctx, player) {
    const scale = 4;
    const offsetX = 10;
    const offsetY = SCREEN_H - Map.getHeight() * scale - 10;

    const grid = Map.getGrid('estructura') || Map.getGrid('terreno');
    if (!grid) return;

    for (let y = 0; y < Map.getHeight(); y++) {
      for (let x = 0; x < Map.getWidth(); x++) {
        const tile = grid[y][x];
        const info = Map.current.tileColors[tile];
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
    const sky = Map.current.layers ? Map.current.layers.cielo : null;
    if (sky && sky.type === 'solid') {
      ctx.fillStyle = sky.color;
    } else {
      ctx.fillStyle = '#1a1a2e';
    }
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  },

  drawLayer(ctx, layerName) {
    const map = Map.current;
    const grid = Map.getGrid(layerName);
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

        if (spriteAvailable && entityId && Sprite.getEntity(entityId)) {
          const info = Sprite.getEntity(entityId);
          if (info.frames > 1) {
            Sprite.drawAnim(ctx, entityId, sx, sy, ts, ts, this.dt || 0.016);
          } else {
            Sprite.draw(ctx, entityId, sx, sy, ts, ts, 0);
          }
        } else {
          const info = map.tileColors ? map.tileColors[tile] : null;
          ctx.fillStyle = info ? info.color : '#000';
          ctx.fillRect(sx, sy, ts, ts);
        }
      }
    }
  },

  draw2D(ctx, player) {
    const map = Map.current;
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

      const exitTileId = Map.getTile(exit.tileX, exit.tileY, 'estructura');
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
      Sprite.draw(ctx, 'player', px - ts / 2, py - ts / 2, ts, ts, playerFrame);

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
  },

  drawMessage(ctx) {
    if (Map.message && Map.messageTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '14px sans-serif';
      const mw = ctx.measureText(Map.message).width + 40;
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
      ctx.fillText(Map.message, SCREEN_W / 2, my + mh / 2);
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
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.min(255, Math.floor(r * factor));
    const ng = Math.min(255, Math.floor(g * factor));
    const nb = Math.min(255, Math.floor(b * factor));
    return `rgb(${nr},${ng},${nb})`;
  },
};
