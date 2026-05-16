// Resolución del canvas (más baja = más rendimiento).
// Se escala al tamaño real del canvas vía CSS.
const SCREEN_W = 640;
const SCREEN_H = 480;

const Raycaster = {
  zBuffer: new Float64Array(SCREEN_W),

  cast(rays, player) {
    for (let x = 0; x < rays.length; x++) {
      const cameraX = 2 * x / SCREEN_W - 1;
      const rayDirX = player.dirX + player.planeX * cameraX;
      const rayDirY = player.dirY + player.planeY * cameraX;

      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);

      const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

      let stepX, stepY;
      let sideDistX, sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - player.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - player.y) * deltaDistY;
      }

      let hit = 0;
      let side;
      let steps = 0;
      const maxSteps = Math.max(Map.getWidth(), Map.getHeight()) * 2;

      while (hit === 0 && steps < maxSteps) {
        steps++;
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (Map.isWall(mapX, mapY)) hit = 1;
      }

      let perpDist;
      if (side === 0) {
        perpDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
      }
      this.zBuffer[x] = perpDist;

      const lineHeight = Math.floor(SCREEN_H / perpDist);
      const drawStart = Math.max(0, -lineHeight / 2 + SCREEN_H / 2);
      const drawEnd = Math.min(SCREEN_H - 1, lineHeight / 2 + SCREEN_H / 2);

      const tileType = Map.getTile(mapX, mapY, 'estructura');

      let wallX;
      if (side === 0) {
        wallX = player.y + perpDist * rayDirY;
      } else {
        wallX = player.x + perpDist * rayDirX;
      }
      wallX -= Math.floor(wallX);

      rays[x] = {
        drawStart,
        drawEnd,
        side,
        tileType,
        perpDist,
        wallX,
        mapX,
        mapY,
      };
    }
  },

  getBillboards(player) {
    const billboards = [];

    const grid = Map.getGrid('objetos');
    if (grid) {
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          const tileId = grid[row][col];
          if (tileId === 0) continue;
          this._addBillboard(billboards, player, col + 0.5, row + 0.5, tileId, null);
        }
      }
    }

    if (Map.current.characters) {
      for (const ch of Map.current.characters) {
        this._addBillboard(billboards, player, ch.x, ch.y, null, ch.entityId);
      }
    }

    if (Map.current.enemies) {
      for (const en of Map.current.enemies) {
        this._addBillboard(billboards, player, en.x, en.y, null, en.entityId);
      }
    }

    billboards.sort((a, b) => b.dist - a.dist);
    return billboards;
  },

  _addBillboard(list, player, bx, by, tileId, entityId) {
    const spriteX = bx - player.x;
    const spriteY = by - player.y;

    const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
    const transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY);
    const transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY);

    if (transformY <= 0) return;

    let tileW = 1, tileH = 1, halfBlock = false;
    if (entityId) {
      const info = Sprite.getEntity(entityId);
      if (info) {
        tileW = info.tileW || 1;
        tileH = info.tileH || 1;
        halfBlock = info.halfBlock || false;
      }
    }

    const baseHeight = Math.abs(Math.floor(SCREEN_H / transformY));
    const height = baseHeight * tileH;
    const width = baseHeight * tileW;
    const yOffset = halfBlock ? height / 2 : 0;

    const screenX = Math.floor(SCREEN_W / 2 * (1 + transformX / transformY));

    list.push({
      bx, by,
      tileId,
      entityId,
      dist: transformY,
      screenX,
      width,
      height,
      tileW,
      tileH,
      halfBlock,
      drawStartY: Math.max(0, -height / 2 + SCREEN_H / 2 + yOffset),
      drawEndY: Math.min(SCREEN_H - 1, height / 2 + SCREEN_H / 2 + yOffset),
      drawStartX: Math.max(0, -width / 2 + screenX),
      drawEndX: Math.min(SCREEN_W - 1, width / 2 + screenX),
    });
  },
};
