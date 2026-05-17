# `renderer.js` — Pipeline de Renderizado (Dual Mode)

Bifurca entre pipeline 2D top-down y pipeline de raycaster pseudo-3D según `Map.current.mode`. También dibuja el overlay de transición.

## Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `mode` | `string` | `'2d'` | Modo actual de renderizado, se actualiza cada frame desde `Map.current.mode` |
| `canvas` | `HTMLCanvasElement` | — | Referencia al canvas, seteada en `init()` |
| `ctx` | `CanvasRenderingContext2D` | — | Contexto 2D del canvas |
| `rays` | `object[]` | `new Array(SCREEN_W)` | Array prealocado para resultados del raycaster |
| `atlasImageData` | `ImageData` | `null` | Pixel data del atlas completo para floor-casting. Se construye lazy en `_buildAtlasData()` |

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `init(canvas)` | `canvas: HTMLCanvasElement` | `void` | Guarda referencia al canvas y su contexto 2D, setea `width/height = SCREEN_W/SCREEN_H`, prealoca `rays[]` |
| `render(player)` | `player: Player` | `void` | Pipeline principal: limpia canvas, si `Map.current === null` retorna (guard contra crash), según `mode` delega a ray pipeline o `draw2D()`, y siempre dibuja `drawTransition()` |
| `drawCeiling(ctx)` | `ctx: CanvasRenderingContext2D` | `void` | Rellena la mitad superior. Lee color desde `layers.cielo.color` si existe; fallback a `#1a1a2e` |
| `drawFloor(ctx, player)` | `ctx, player` | `void` | Floor-casting texturizado: por cada columna/píxel abajo del horizonte (`startY = max(halfH + 1, wallBottom)` para evitar 1px negro en `halfH`), calcula coordenadas del mundo, lee tile de `terreno`, dibuja texel desde el atlas vía `ImageData`. Aplica luz con `globalCompositeOperation = 'multiply'` y relleno con `Map.getLight(tileId)` en el tile visitado (caché por tile para evitar lookup repetido). Si hay atlas y estructura decorativa (tiles no-sólidos), los blend sobre el piso. Fallback a `_drawSolidFloor()` si no hay atlas |
| `_drawSolidFloor(ctx, player)` | `ctx, player` | `void` | Fallback: rellena la mitad inferior con el color del tile de terreno donde está parado el jugador |
| `_buildAtlasData()` | — | `void` | Renderiza el atlas completo en un canvas temporal y captura su `ImageData` para acceso pixel por pixel en floor-casting |
| `drawWalls(ctx, player)` | `ctx, player` | `void` | Itera `rays[]`: por cada columna, obtiene el `tileType` golpeado. Si hay `tileSprites[type]` y el atlas está cargado, samplea 1px del atlas escalado a altura de pared. Aplica color de luz vía `globalCompositeOperation = 'multiply'` después de dibujar el sprite, usando `Map.getLight(tileType)`. Las paredes Y-side (side === 1) se oscurecen con overlay `rgba(0,0,0,0.4)` en vez de `globalAlpha` (evita el efecto transparente). Si no hay atlas, usa `tileColors[type].color` con `shadeColor()` |
| `drawMinimap(ctx, player)` | `ctx, player` | `void` | Dibuja minimapa en esquina inferior izquierda (escala 4px/tile) usando la capa `'estructura'`. Pinta todos los tiles con sus colores. Marca al jugador como círculo rojo con línea de dirección |
| `drawSky(ctx)` | `ctx` | `void` | Rellena todo el canvas con `layers.cielo.color` (o `#1a1a2e` fallback). Se llama al inicio de `draw2D()` |
| `drawLayer(ctx, layerName)` | `ctx, layerName` | `void` | Dibuja una capa del mapa con viewport culling. Para cada tile visible: si tiene `tileSprites[id]` dibuja el sprite del atlas (con animación si frames > 1). Después de dibujar el sprite, aplica luz con `Map.getLight(id)` via `globalCompositeOperation = 'multiply'`. Si no hay sprite, usa `tileColors[id].color`. Tile ID 0 se salta (vacío) |
| `draw2D(ctx, player)` | `ctx, player` | `void` | Pipeline 2D: `drawSky()` → `drawLayer('terreno')` → `drawLayer('estructura')` → exits con brillo pulsante → jugador con sprite del atlas (o cuadrado azul fallback) + línea de dirección + bob. Al terminar las capas, resetea `globalCompositeOperation` a `'source-over'` |
| `drawTransition(ctx)` | `ctx` | `void` | Dibuja overlay negro semitransparente sobre toda la pantalla con alpha de `Transition.getAlpha()`. Si alpha es 0, no dibuja nada |
| `shadeColor(hex, factor)` | `hex: string` (ej `#4a7c3f`), `factor: number` (0-1) | `string` — color RGB | Parsea hex a RGB, multiplica cada canal por `factor`, clamp a 255. Ej: `shadeColor('#ff8800', 0.6)` → `'rgb(153,81,0)'` |

## Pipeline ray

```
1. drawCeiling: rectángulo lleno en mitad superior (color desde layers.cielo)
2. drawFloor:   floor-casting texturizado con sprites del atlas (o color sólido fallback)
                → por cada columna/píxel: calcula coordenada mundial, samplea tile del atlas
                → luz per-channel: rellena sobre tile visitado con color de Map.getLight() usando 'multiply'
                → overlay de tiles decorativos no-sólidos desde capa estructura
3. drawWalls:   itera 640 rayos, dibuja una columna vertical por rayo
                → sprite del atlas si hay tileSprites[type], sino color sólido
                → luz: globalCompositeOperation = 'multiply' con Map.getLight() sobre el sprite
                → si side === 1, oscurece con overlay negro rgba(0,0,0,0.4)
4. drawMinimap: grid 4px/tile desde capa 'estructura' + jugador como punto rojo
```

## Pipeline 2D

```
1. Camera.update(player.x * ts, player.y * ts, mapPixelW, mapPixelH)
2. drawSky() — cielo sólido desde layers.cielo
3. drawLayer('terreno') — suelo/base con sprites del atlas + luz multiply
4. drawLayer('estructura') — paredes y objetos sólidos + luz multiply
5. Reset globalCompositeOperation a 'source-over'
6. Exits: tile sprite + brillo pulsante dorado (rgba(255,215,0, pulse))
7. Jugador: sprite del atlas (player) o cuadrado azul 20×20 fallback
            + línea de dirección blanca + offset bob vertical
```

## Dependencias

`Map`, `Raycaster`, `Camera`, `Transition`
