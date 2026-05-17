# `map.js` — Cargador de Mapas

Carga mapas desde archivos JSON y expone consultas de tiles, colisiones y salidas. Es el puente entre los datos del mapa y el resto del motor.

## Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `current` | `object` | `null` | Datos del mapa cargado actualmente (todo el JSON). `null` si aún no se cargó uno o si hubo error |

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `load(path)` | `path: string` — ruta al JSON (ej: `/maps/inicio.json`) | `Promise<object>` — datos parseados | Fetch + validación HTTP (`if (!res.ok)` lanza error). Setea `this.current` con los datos |
| `getTile(x, y, layer)` | `x, y: number` — coordenadas float; `layer: string` — nombre de capa (`'estructura'` por defecto) | `number` — ID del tile (0-255) | Convierte a enteros con `Math.floor()`. Si está fuera de los límites del mapa o la capa no existe, retorna `1` (sólido por defecto) |
| `getGrid(layer)` | `layer: string` — nombre de capa | `number[][] \| null` | Retorna el grid 2D de una capa. Para `cielo` retorna el objeto de configuración. Si la capa no existe o el mapa es legacy, retorna `null` |
| `isSolid(x, y)` | `x, y: number` — coordenadas float | `boolean` | Consulta `estructura` y `terreno`. Si **alguna** capa tiene un tile sólido en esa posición, retorna `true`. Usada para colisión del jugador (agua en `terreno` bloquea el paso) |
| `isWall(x, y)` | `x, y: number` — coordenadas float | `boolean` | Consulta solo `estructura`. Retorna `true` solo si hay un tile sólido en esa capa. Usada por el raycaster (solo paredes bloquean rayos) |
| `checkCircleCollision(cx, cy, radius)` | `cx, cy: number` — centro del círculo; `radius: number` — radio en tiles | `boolean` | Recorre tiles que el círculo toca. Para cada tile sólido, verifica overlap círculo vs rectángulo (distancia al punto más cercano del tile). Out-of-bounds = bloqueado |
| `_tileInBounds(tx, ty)` | `tx, ty: number` — coordenadas enteras de tile | `boolean` | Verifica si un tile está dentro de los límites del mapa |
| `_isTileSolid(id)` | `id: number` — ID numérico de tile | `boolean` | Helper: dado un ID de tile, consulta `entity.solid` del atlas si existe, fallback a `tileColors[id].solid`, default `true` |
| `checkExits(px, py)` | `px, py: number` — posición del jugador | `object \| null` | Por distancia circular con radio 0.5: calcula el punto más cercano del tile de salida al centro del jugador. Si la distancia es < 0.5, activa la salida. No requiere estar centrado en el tile |
| `getLight(tileId)` | `tileId: number` — ID de tile | `{r, g, b}` — canales 0-1 | Retorna el color de luz para un tile desde `lightmap[tileId]` (hex `#RRGGBB`). Clampa cada canal a [0, 1]. Backward compat con lightmap numérico legacy (un solo float → mismo valor en R, G, B). Si no hay lightmap, retorna `{r:1, g:1, b:1}` (full bright) |

## Estructura de `Map.current` (objeto cargado)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | `string` | Nombre legible del mapa |
| `mode` | `string` | `'2d'` o `'ray'` — determina pipeline de render y control |
| `width`, `height` | `number` | Dimensiones del grid en tiles |
| `tileSize` | `number` | Píxeles por tile (solo afecta modo 2D) |
| `playerStart` | `object` | `{ x, y, dirX, dirY }` — spawn point y dirección inicial |
| `layers` | `object` | 5 capas: `cielo` (config `{type, color}`) + `terreno`, `mundo`, `personajes`, `eventos` (grids `number[][]`). ID 0 = vacío en todas |
| `tileSprites` | `object` | `{ [id]: string }` — mapea ID de tile a entityId del atlas (`public/entidades/`) |
| `tileColors` | `object` | `{ [id]: { color, name, solid } }` — configuración por ID (fallback si no hay sprite) |
| `exits` | `object[]` | `[{ tileX, tileY, target, spawnX, spawnY }]` — transiciones a otros mapas |
| `lightmap` | `object` | `{ [tileId]: "#RRGGBB" }` — color de luz por tile. Generado por el servidor al guardar el mapa |
| `lightBounces` | `number` | `3` — cantidad de rebotes del lightmap (0-5). 0 = solo luz directa |
| `tiles` | `number[][]` | (legacy) Grid 2D de tiles planos. Solo presente en mapas sin `layers` |

## Sistema de capas

```
Orden de render (modo 2D): Cielo → Terreno → Estructura → Objetos
- cielo:      Configuración de color sólido para el cielo (drawSky/drawCeiling)
- terreno:    Suelo/base visual del mapa. También contiene tiles colisionables como agua (bloquean al jugador via `isSolid()` pero no al raycaster)
- estructura: Paredes y tiles sólidos. El raycaster usa `isWall()` sobre esta capa. Solo tiles con `solid: true` se renderizan como paredes
- objetos:    Sprites billboard (muebles, decoraciones). Se renderizan en modo ray como billboards y en 2D como capa superior
```

Mapas legacy con `tiles[][]` o capa `mundo` se migran automáticamente: tiles de pared (entityId contiene "pared") van a `estructura`, el resto (pasto, agua, decoraciones) va a `terreno`.

## Dependencias

ninguna
