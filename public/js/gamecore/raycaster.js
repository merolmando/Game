// Resolución del canvas (más baja = más rendimiento).
// Se escala al tamaño real del canvas vía CSS.
const SCREEN_W = 640;
const SCREEN_H = 480;

const Raycaster = {
  // Lanza un rayo por cada columna de píxeles de la pantalla.
  // Implementa el algoritmo DDA (Digital Differential Analyzer)
  // usado originalmente en Wolfenstein 3D.
  cast(rays, player) {
    for (let x = 0; x < rays.length; x++) {
      // Coordenada en el plano de la cámara: -1 a 1.
      const cameraX = 2 * x / SCREEN_W - 1;
      // Dirección del rayo actual.
      const rayDirX = player.dirX + player.planeX * cameraX;
      const rayDirY = player.dirY + player.planeY * cameraX;

      // Celda del mapa donde comienza el rayo.
      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);

      // Distancia que recorre el rayo para avanzar una celda completa.
      const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

      // Dirección del paso (-1 o 1) y distancia inicial al primer borde de celda.
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

      // Bucle DDA: avanza el rayo celda por celda hasta chocar con una pared.
      let hit = 0;
      let side; // 0 = pared vertical (E/W), 1 = pared horizontal (N/S).

      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (Map.getTile(mapX, mapY) > 0) hit = 1;
      }

      // Distancia perpendicular: evita el efecto "ojo de pez".
      let perpDist;
      if (side === 0) {
        perpDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
      }

      // Altura de la línea a dibujar en pantalla (más lejos = más pequeña).
      const lineHeight = Math.floor(SCREEN_H / perpDist);
      const drawStart = Math.max(0, -lineHeight / 2 + SCREEN_H / 2);
      const drawEnd = Math.min(SCREEN_H - 1, lineHeight / 2 + SCREEN_H / 2);

      // Tipo de tile que golpeó el rayo (para el color de la pared).
      const tileType = Map.getTile(mapX, mapY);

      rays[x] = {
        drawStart,
        drawEnd,
        side,
        tileType,
        perpDist,
      };
    }
  },
};
