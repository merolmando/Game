# `raycaster.js` — Algoritmo DDA (Digital Differential Analyzer)

Implementa el raycasting clásico de Wolfenstein 3D: lanza un rayo por cada columna de píxeles de la pantalla y calcula la distancia a la pared más cercana.

## Constantes

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `SCREEN_W` | `640` | Ancho interno del canvas en píxeles (se escala vía CSS). Determina la cantidad de rayos por frame |
| `SCREEN_H` | `480` | Alto interno del canvas en píxeles |

## `Raycaster`

Objeto singleton.

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `cast(rays, player)` | `rays: object[]` — array de `SCREEN_W` elementos que se llenará con los resultados; `player: Player` | `void` | Lanza un rayo por cada columna de píxeles. Cada elemento de `rays[x]` recibe `{ drawStart, drawEnd, side, tileType, perpDist }` |

## Variables locales del algoritmo DDA (por rayo)

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `cameraX` | `number` | Coordenada en el plano de la cámara: mapea `[0, SCREEN_W-1]` a `[-1, +1]`. Fórmula: `2 * x / SCREEN_W - 1` |
| `rayDirX, rayDirY` | `number` | Vector dirección del rayo: `dir + plane * cameraX`. Cada columna tiene un rayo con ángulo ligeramente distinto |
| `mapX, mapY` | `number` | Celda actual del mapa que el rayo está atravesando. Arranca en `Math.floor(player.x), Math.floor(player.y)` |
| `deltaDistX, deltaDistY` | `number` | Distancia que el rayo necesita recorrer para avanzar una celda completa en X o Y. Fórmula: `abs(1 / rayDir)`. Si rayDir es 0, se setea a `1e30` (infinito práctico) |
| `stepX, stepY` | `number` | Dirección del paso: `+1` si rayDir > 0, `-1` si rayDir < 0 |
| `sideDistX, sideDistY` | `number` | Distancia desde el origen del rayo hasta el primer borde de celda en X o Y. Se calcula según la dirección del paso |
| `hit` | `number` | Flag: `0` mientras el rayo no haya chocado, `1` cuando encuentra una pared |
| `side` | `number` | `0` = pared vertical (face este/oeste), `1` = pared horizontal (face norte/sur). Determina el sombreado |
| `perpDist` | `number` | Distancia perpendicular desde la cámara hasta la pared. **No** es la distancia euclidiana — usa la distancia perpendicular para evitar el efecto "ojo de pez". Fórmula: si `side === 0`: `(mapX - player.x + (1 - stepX) / 2) / rayDirX`; si `side === 1`: `(mapY - player.y + (1 - stepY) / 2) / rayDirY` |
| `lineHeight` | `number` | Altura en píxeles de la columna de pared a dibujar: `SCREEN_H / perpDist`. Más lejos = más pequeña |
| `drawStart` | `number` | Coordenada Y inicial del segmento de pared: `-lineHeight / 2 + SCREEN_H / 2`. Clamp a `[0, SCREEN_H-1]` |
| `drawEnd` | `number` | Coordenada Y final del segmento de pared: `lineHeight / 2 + SCREEN_H / 2`. Clamp a `[0, SCREEN_H-1]` |
| `tileType` | `number` | ID del tile que golpeó el rayo (`Map.getTile(mapX, mapY)`) |

## Estructura del resultado (`rays[x]`)

```json
{
  "drawStart": 120,
  "drawEnd": 360,
  "side": 0,
  "tileType": 1,
  "perpDist": 2.34
}
```

## Algoritmo paso a paso

```
1. Para cada columna x en [0, SCREEN_W):
   a. Calcular cameraX = 2*x/SCREEN_W - 1      → rango [-1, +1]
   b. Calcular rayDir = player.dir + player.plane * cameraX
   c. Inicializar mapX, mapY en el tile del jugador
   d. Calcular deltaDist (distancia por celda)
   e. Calcular step y sideDist (distancia al primer borde)
   f. Bucle DDA (con límite de `maxSteps = mapWidth * 2` para evitar loop infinito en mapas sin bordes):
      - Avanzar al siguiente borde de celda (X o Y, el que esté más cerca)
      - Si la celda es una pared (Map.isWall()) → hit = 1, break
      - Nota: isWall() solo chequea la capa 'estructura' con solid: true.
        El agua y tiles decorativos NO detienen el rayo.
   g. Calcular perpDist (distancia perpendicular anti-fish-eye)
   h. Calcular lineHeight, drawStart, drawEnd
   i. Guardar ray = { drawStart, drawEnd, side, tileType, perpDist }
```

## Dependencias

`Map` (isWall), `SCREEN_W`, `SCREEN_H`
