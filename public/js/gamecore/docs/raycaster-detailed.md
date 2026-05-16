# Raycaster — Motor de Renderizado Pseudo-3D

El sistema de raycasting es el corazón del modo `ray` del motor híbrido. Implementa el algoritmo DDA (Digital Differential Analyzer) clásico de Wolfenstein 3D, extendido con billboards, floor-casting texturizado y sprites con direcciones.

## Pipeline de Renderizado (Modo Ray)

```
1. drawCeiling: cielo sólido (color desde layers.cielo)
2. drawFloor:   floor-casting texturizado con texels del atlas
3. drawWalls:   columnas de pared desde el raycaster
4. drawObjects: billboards (sprites, entidades, enemigos)
5. drawMinimap: minimapa en esquina inferior izquierda
```

## Raycaster (DDA)

### Constantes

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `SCREEN_W` | `640` | Ancho interno del canvas en píxeles. Determina la cantidad de rayos por frame |
| `SCREEN_H` | `480` | Alto interno del canvas en píxeles |
| `zBuffer` | `Float64Array(640)` | Buffer de profundidad para evitar que billboards se dibujen detrás de paredes |

### Algoritmo DDA paso a paso

Por cada columna `x` de la pantalla (0 a SCREEN_W-1):

```
1.  cameraX = 2 * x / SCREEN_W - 1           → rango [-1, +1]
2.  rayDirX = player.dirX + player.planeX * cameraX
    rayDirY = player.dirY + player.planeY * cameraX
3.  mapX = floor(player.x), mapY = floor(player.y)
4.  deltaDistX = abs(1 / rayDirX)
    deltaDistY = abs(1 / rayDirY)
5.  stepX = (rayDirX < 0) ? -1 : 1
    stepY = (rayDirY < 0) ? -1 : 1
6.  sideDistX = (rayDirX < 0)
      ? (player.x - mapX) * deltaDistX
      : (mapX + 1 - player.x) * deltaDistX
    sideDistY = (rayDirY < 0)
      ? (player.y - mapY) * deltaDistY
      : (mapY + 1 - player.y) * deltaDistY
7.  Bucle DDA (máx. mapWidth * 2 pasos):
      if sideDistX < sideDistY:
        sideDistX += deltaDistX
        mapX += stepX
        side = 0
      else:
        sideDistY += deltaDistY
        mapY += stepY
        side = 1
      if Map.isWall(mapX, mapY): hit = 1, break
      // isWall() solo chequea capa 'estructura'
      // agua y decoraciones NO detienen el rayo
8.  perpDist = (side === 0)
      ? (mapX - player.x + (1 - stepX)/2) / rayDirX
      : (mapY - player.y + (1 - stepY)/2) / rayDirY
9.  lineHeight = SCREEN_H / perpDist
    drawStart = max(0, -lineHeight/2 + SCREEN_H/2)
    drawEnd   = min(SCREEN_H-1, lineHeight/2 + SCREEN_H/2)
10. tileType = Map.getTile(mapX, mapY, 'estructura')
11. rays[x] = { drawStart, drawEnd, side, tileType, perpDist }
```

### Diferencia entre `isWall()` e `isSolid()`

| Función | Capas que chequea | Propósito |
|---------|-------------------|-----------|
| `Map.isWall(x, y)` | Solo `estructura` | Raycaster: solo paredes bloquean rayos |
| `Map.isSolid(x, y)` | `estructura` + `terreno` | Colisión del jugador: agua y paredes bloquean |

### `_addBillboard`

Añade un billboard a la lista de renderizado. Calcula la transformación de sprite, el tamaño en pantalla y las coordenadas de dibujo.

```
transformX = invDet * (dirY * spriteX - dirX * spriteY)
transformY = invDet * (-planeY * spriteX + planeX * spriteY)

spriteScreenX = SCREEN_W/2 * (1 + transformX / transformY)

baseHeight = abs(SCREEN_H / transformY)
height = baseHeight * tileH    // tileH del entity
width  = baseHeight * tileW    // tileW del entity
yOffset = halfBlock ? height/2 : 0

drawStartY = max(0, -height/2 + SCREEN_H/2 + yOffset)
drawEndY   = min(SCREEN_H-1, height/2 + SCREEN_H/2 + yOffset)
drawStartX = max(0, -width/2 + screenX)
drawEndX   = min(SCREEN_W-1, width/2 + screenX)
```

Los billboards se ordenan por distancia (de más lejano a más cercano) para transparencia correcta.

### Soporte Multi-Atlas

Cada billboard obtiene su textura desde el atlas correspondiente (`mundo`, `entidades`, `ui`, `efectos`). El sistema busca el entityId en todos los grupos cargados.

```js
const frame = Sprite.getAnimFrame(entityId, dt);
const atlas = Sprite.getAtlas(frame.atlasName);
ctx.drawImage(atlas.img, sx, frame.sy + crop, 1, frame.sh - crop,
  stripe, obj.drawStartY, 1, obj.drawEndY - obj.drawStartY);
```

### tileW, tileH y halfBlock

| Propiedad | Efecto en billboard |
|-----------|---------------------|
| `tileW` | Multiplica el ancho del billboard: `width = baseHeight * tileW` |
| `tileH` | Multiplica el alto del billboard: `height = baseHeight * tileH` |
| `halfBlock` | Desplaza el billboard hacia abajo: `yOffset = height / 2`. La parte visible arranca desde el horizonte |

### Direcciones y Mirror

Cuando el entity tiene `dirFrames`, el billboard renderiza el frame correspondiente a la dirección actual del personaje. Si la dirección es `left` y `mirror: true`, se aplica flip horizontal con `ctx.scale(-1, 1)`.

## Floor-Casting Texturizado

Renderiza el piso con texturas reales del atlas, con perspectiva correcta y sin distorsión:

```
Por cada columna x y cada píxel y debajo del horizonte:
  rowDist = halfH / (y - halfH)     // distancia al píxel
  floorX = player.x + rowDist * rayDirX
  floorY = player.y + rowDist * rayDirY
  tileX = floor(floorX), tileY = floor(floorY)
  texX = abs((floorX - tileX) * tileSize) % tileSize
  texY = abs((floorY - tileY) * tileSize) % tileSize
  id = terreno[tileY][tileX]
  Si id ≠ 0 y existe sprite → samplear texel del atlas
  Sino → color sólido de tileColors[id]
```

El floor-casting usa un `ImageData` precacheado del atlas `mundo` para acceso pixel por pixel. Los tiles decorativos no-sólidos de la capa `estructura` se blendan como overlay sobre el piso.

## sprites en modo ray

Los siguientes elementos se renderizan como billboards en modo `ray`:

- **Objetos** (`layer: objetos`): tiles con sprites, se pasan con `tileId`
- **Characters**: entidades con `entityId` y posición flotante
- **Enemies**: entidades con `entityId` y posición flotante

Cada uno puede tener animación (multi-frame con `animSpeed`), direcciones (`dirFrames`) y propiedades visuales como `halfBlock`.
