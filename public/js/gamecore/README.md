# 🎮 GameCore — Motor de Juego (50% 2D + 50% Raycasting)

Motor híbrido que combina renderizado **2D top-down** (vista de pájaro) con **Raycasting pseudo-3D** (Wolfenstein 3D style). Cada mapa JSON decide su modo de renderizado. Construido íntegramente en Vanilla JavaScript sobre Canvas 2D.

---

## 📁 Estructura de Archivos

```
gamecore/
├── core.js        ← Bucle principal (game loop + transiciones)
├── input.js       ← Captura de teclado (eventos keydown/keyup)
├── map.js         ← Carga de mapas JSON y consultas de tiles
├── player.js      ← Estado del jugador (posición, stats, 2D/ray)
├── camera.js      ← Cámara 2D (viewport centrado en el jugador)
├── raycaster.js   ← Algoritmo DDA de Raycasting
├── renderer.js    ← Pipeline de dibujado (2D y ray)
└── sprite.js      ← Cargador y dibujado de atlas de sprites
```

```
public/maps/
├── inicio.json    ← Mapa 2D inicial (bosque)
├── cueva.json     ← Mapa ray (mazmorra)
└── COLORES.md     ← Documentación de placeholders de tiles
```

---

## 🔄 Flujo de Ejecución

```
1. core.js: init() fetchea inicio.json y arranca RAF
       │
2. Por cada frame:
       │
       ├─ Transition.active? → saltea Player.update
       │
       ├─ Player.update(dt)
       │    ├─ Map.current.mode === "2d"  → movimiento cardinal + bob
       │    └─ Map.current.mode === "ray" → rotación + forward/strafe
       │
       ├─ Map.checkExits(Player) → si hay salida, Transition.start(fade)
       │
       ├─ Transition.update(dt)
       │
       └─ Renderer.render(Player)
            ├─ mode === "ray" → Raycaster + cielo/suelo/paredes/minimapa
            ├─ mode === "2d"  → draw2D: tiles, cámaras, puertas, jugador
            └─ drawTransition  → overlay negro (fade out/in)
```

---

## 🗺️ Formato de Mapas JSON

Cada mapa se define en un archivo JSON en `public/maps/`. Ejemplo:

```json
{
  "name": "Bosque Inicial",
  "mode": "2d",
  "width": 25,
  "height": 20,
  "tileSize": 32,
  "playerStart": { "x": 12, "y": 15, "dirX": 0, "dirY": -1 },
  "tiles": [[...]],
  "tileColors": {
    "0": { "color": "#4a7c3f", "name": "Pasto", "solid": false },
    "1": { "color": "#5c4033", "name": "Pared", "solid": true },
    "2": { "color": "#b8860b", "name": "Puerta / Transicion", "solid": false },
    "3": { "color": "#2e6da4", "name": "Agua", "solid": true }
  },
  "exits": [
    { "tileX": 23, "tileY": 1, "target": "cueva.json", "spawnX": 1.5, "spawnY": 1.5 }
  ]
}
```

| Campo | Descripción |
|-------|-------------|
| `mode` | `"2d"` o `"ray"` — define el pipeline de renderizado |
| `tileSize` | Tamaño en píxeles de cada tile (solo afecta modo 2D) |
| `playerStart` | Posición inicial y dirección del jugador |
| `tileColors` | Mapa de ID → color, nombre y si es sólido (colisionable) |
| `exits` | Lista de salidas: tile de activación, mapa destino y spawn |

---

## 📄 Documentación por Archivo

### `core.js` — Bucle Principal y Transiciones

Punto de entrada del motor. Arranca el game loop, gestiona las transiciones entre mapas y coordina todos los módulos.

**Constantes y variables globales:**
| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `canvas` | `HTMLCanvasElement` | Referencia al `<canvas id="gameCanvas">` del DOM |
| `lastTime` | `number` | Timestamp `performance.now()` del frame anterior para calcular delta time |
| `fps` | `number` | Fotogramas por segundo del último segundo medido |
| `frameCount` | `number` | Contador de frames del segundo actual |
| `fpsTimer` | `number` | Acumulador de tiempo para actualizar `fps` cada 1s |

**`Transition`**: Sistema de fade out/in que sincroniza la carga asíncrona de mapas con la animación visual.

Propiedades:
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `active` | `boolean` | `false` | `true` mientras la transición está en curso |
| `timer` | `number` | `0` | Segundos transcurridos desde que empezó la fase actual |
| `halfDuration` | `number` | `0.5` | Mitad del duration total (`duration / 2`) |
| `phase` | `string` | `''` | `'fadeOut'`, `'fadeIn'`, o `''` (inactivo) |
| `loaded` | `boolean` | `false` | Bandera que el `loadMap().then()` setea a `true` cuando el nuevo mapa ya está cargado |

Métodos:
| Método | Parámetros | Descripción |
|--------|-----------|-------------|
| `start(duration)` | `duration: number` — segundos totales del fade out+in | Inicia la transición: setea `active=true`, `phase='fadeOut'`, `timer=0`, `loaded=false` |
| `update(dt)` | `dt: number` — delta time en segundos | Avanza el timer. Si `phase==='fadeOut'` y pasó `halfDuration`, espera a `loaded===true` antes de pasar a `'fadeIn'`. Cuando `fadeIn` termina, desactiva la transición |
| `getAlpha()` | _(ninguno)_ | Devuelve `number` (0-1) para el overlay negro. Curva `easeInQuad` en fadeOut, `easeOutQuad` en fadeIn. `0` si no hay transición activa |

**`loadMap(path)`**:
| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function loadMap(path: string): Promise<void>` |
| Qué hace | Fetch del JSON del mapa, reposiciona al jugador (`Player.x/y`), setea dirección 2D o ray según `mode`, calcula `planeX/planeY` dinámicamente como `-dirY*0.66` / `dirX*0.66`, resetea `Camera.x/y`, y setea `Player.spawnTimer = 0.3` para evitar re-disparo inmediato de salidas |
| Llamada | Desde `init()` al arranque, y desde `Transition.start()` vía `.then()` |

**`gameLoop(timestamp)`**:
| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function gameLoop(timestamp: DOMHighResTimeStamp): Promise<void>` |
| Qué hace | Bucle principal de renderizado vía `requestAnimationFrame`. Calcula delta time clampado a 0.05s (50ms máximo por frame). Actualiza contador FPS. Si no hay transición activa: actualiza al jugador, decrementa `spawnTimer`, y si `spawnTimer <= 0` verifica salidas. Si hay salida: inicia transición + `loadMap()` asíncrono. Siempre: actualiza `Transition` y llama a `Renderer.render()`. Vuelve a solicitar `requestAnimationFrame(gameLoop)` |

**`init()`**:
| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function init(): Promise<void>` |
| Qué hace | Punto de entrada: carga el mapa inicial (`/maps/inicio.json`) y arranca el game loop con `requestAnimationFrame(gameLoop)` |

**Flujo completo de transición:**
```
1. Player atraviesa tile de salida
2. Transition.start(1.0)         → phase='fadeOut', active=true
3. loadMap(path).then(...)       → carga async del mapa
4. Transition.update(dt) cada frame
   ├─ Fade out: timer avanza, alpha sube con easeInQuad
   ├─ Llega a halfDuration (0.5s)
   │   └─ Espera a loaded===true (la promesa de loadMap)
   └─ Cuando loaded=true → phase='fadeIn', timer=0
       └─ Fade in: alpha baja con easeOutQuad
5. Transition activa=false, el jugador reaparece en el nuevo mapa
```

**Dependencias:** `Map`, `Player`, `Renderer`, `Canvas`

---

### `input.js` — Sistema de Input

Captura eventos de teclado y expone un API unificada para consultar el estado de las teclas. Los nombres de tecla se normalizan a minúsculas.

**Variables globales:**
| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `keys` | `object` | Mapa `{ tecla: boolean }` — se actualiza con cada `keydown`/`keyup`. Ej: `keys['w'] === true` mientras W está presionada |

**Event listeners:**
| Evento | Qué hace |
|--------|----------|
| `document.addEventListener('keydown', e)` | Setea `keys[e.key.toLowerCase()] = true`. Previene scroll con `e.preventDefault()` para las flechas direccionales |
| `document.addEventListener('keyup', e)` | Setea `keys[e.key.toLowerCase()] = false` |

**Métodos de `Input`:**
| Método | Teclas que detecta | En modo 2D | En modo ray |
|--------|--------------------|------------|-------------|
| `isDown(key)` | cualquier tecla (string) | Útil para consultas genéricas | — |
| `isForward()` | `w`, `↑` | Mover arriba (dy = -1) | Avanzar en dirección del vector dir |
| `isBackward()` | `s`, `↓` | Mover abajo (dy = +1) | Retroceder en dirección opuesta |
| `isLeft()` | `a`, `←` | Mover izquierda (dx = -1) | Rotar cámara a la izquierda |
| `isRight()` | `d`, `→` | Mover derecha (dx = +1) | Rotar cámara a la derecha |
| `isStrafeLeft()` | `q` | — | Strafear perpendicular a la izquierda |
| `isStrafeRight()` | `e` | — | Strafear perpendicular a la derecha |

**Nota:** `isDown(key)` es el método base; los demás wrappers llaman a `isDown()` internamente. Esto permite re-mapear teclas cambiando solo el string en el wrapper.

**Dependencias:** ninguna

---

### `map.js` — Cargador de Mapas

Carga mapas desde archivos JSON y expone consultas de tiles, colisiones y salidas. Es el puente entre los datos del mapa y el resto del motor.

**Propiedades:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `current` | `object` | `null` | Datos del mapa cargado actualmente (todo el JSON). `null` si aún no se cargó uno o si hubo error |

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `load(path)` | `path: string` — ruta al JSON (ej: `/maps/inicio.json`) | `Promise<object>` — datos parseados | Fetch + validación HTTP (`if (!res.ok)` lanza error). Setea `this.current` con los datos |
| `getTile(x, y)` | `x, y: number` — coordenadas float (pueden tener decimales) | `number` — ID del tile (0-255) | Convierte a enteros con `Math.floor()`. Si está fuera de los límites del mapa, retorna `1` (sólido por defecto) |
| `isSolid(x, y)` | `x, y: number` — coordenadas float | `boolean` | Consulta `tileColors[id].solid`. Si el tile ID no está en `tileColors`, asume `true` (colisionable) |
| `checkExits(px, py)` | `px, py: number` — posición del jugador en coordenadas float | `object \| null` | Centra al tile con `Math.floor(px + 0.5)`. Itera `exits[]` y devuelve el primero que coincida, o `null` si no hay salida en esa posición |

**Estructura de `Map.current` (objeto cargado):**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | `string` | Nombre legible del mapa |
| `mode` | `string` | `'2d'` o `'ray'` — determina pipeline de render y control |
| `width`, `height` | `number` | Dimensiones del grid en tiles |
| `tileSize` | `number` | Píxeles por tile (solo afecta modo 2D) |
| `playerStart` | `object` | `{ x, y, dirX, dirY }` — spawn point y dirección inicial |
| `tiles` | `number[][]` | Grid 2D: `tiles[fila][columna]` = ID del tile |
| `tileColors` | `object` | `{ [id]: { color, name, solid } }` — configuración por ID |
| `exits` | `object[]` | `[{ tileX, tileY, target, spawnX, spawnY }]` — transiciones a otros mapas |

**Dependencias:** ninguna

---

### `player.js` — Jugador (Dual Mode)

Representa al jugador con estado completo. Se adapta automáticamente al modo del mapa actual: movimiento cardinal en 2D, rotación + forward/strafe en ray.

**Propiedades generales:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `x`, `y` | `number` | `2.5` | Posición en coordenadas float del grid (1 tile = 1 unidad). Ej: `x=2.5` = centro del tile (2,0) |
| `moveSpeed` | `number` | `3.0` | Velocidad de movimiento en tiles/segundo |
| `rotSpeed` | `number` | `2.0` | Velocidad de rotación en radianes/segundo (solo modo ray) |
| `hp` | `number` | `100` | Puntos de vida actuales |
| `maxHp` | `number` | `100` | Puntos de vida máximos |
| `mp` | `number` | `50` | Puntos de maná actuales |
| `maxMp` | `number` | `50` | Puntos de maná máximos |
| `str` | `number` | `10` | Fuerza (daño físico) |
| `int` | `number` | `10` | Inteligencia (daño mágico) |
| `level` | `number` | `1` | Nivel del jugador |
| `spawnTimer` | `number` | `0` | Timer de protección al spawn. Mientras > 0, no se checkean exits. Se setea a 0.3s tras cargar un mapa y decrece cada frame |
| `bobPhase` | `number` | `0` | Fase del seno para la animación de caminar (oscilación). Avanza a 8 rad/s mientras `moving===true`, decae a 6 rad/s² al soltar teclas |
| `bobOffset` | `number` | `0` | Desplazamiento vertical en píxeles: `sin(bobPhase) * 2`. Rango ±2px |
| `moving` | `boolean` | `false` | `true` si el jugador se está moviendo en el frame actual |

**Propiedades modo 2D:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `facingX`, `facingY` | `number` | `0, -1` | Última dirección cardinal de movimiento. Solo se actualiza en ejes puros (horizontal tiene prioridad sobre vertical) |

**Propiedades modo ray:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `dirX`, `dirY` | `number` | `1, 0` | Vector dirección normalizado: hacia dónde mira el jugador |
| `planeX`, `planeY` | `number` | `0, 0.66` | Vector del plano de cámara: determina el FOV. Se calcula como `(-dirY * 0.66, dirX * 0.66)` al cargar un mapa ray |

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `update(dt)` | `dt: number` — delta time en segundos | `void` | Dispatcher: consulta `Map.current.mode` y delega a `update2D()` o `updateRay()` |
| `update2D(dt)` | `dt: number` | `void` | Lee Input (WASD), calcula dx/dy cardinal (solo 0, ±1). Si hay dos ejes, normaliza con ×0.7071. Actualiza `facingX/facingY` priorizando horizontal sobre vertical. Llama a `move()`. Anima bob (fase +8 rad/s, offset = `sin(fase) * 2`) |
| `updateRay(dt)` | `dt: number` | `void` | Lee Input: rotación (`rotate()`), forward/backward (`move(dirX*move, dirY*move)`), strafe izquierda/derecha (`move(-dirY*move, dirX*move)`). Anima bob si hay movimiento |
| `move(dx, dy)` | `dx, dy: number` — desplazamiento en tiles | `void` | Wall sliding: prueba colisión en X primero, luego en Y por separado. Si un eje está bloqueado, el otro aún se ejecuta |
| `rotate(angle)` | `angle: number` — radianes a rotar (negativo = izquierda) | `void` | Matriz de rotación 2×2 sobre `dirX/dirY` y `planeX/planeY`. Fórmula: `newDirX = dirX*cos - dirY*sin`, `newDirY = dirX*sin + dirY*cos` (idem para plane) |

**Animación bob:**
```
bobPhase += dt * 8   (mientras moving)
bobPhase -= dt * 6   (al soltar, hasta 0)
bobOffset = sin(bobPhase) * 2   // ±2 píxeles verticales
```
El offset se suma a `player.y * tileSize` en el render 2D para simular el cabeceo al caminar.

**Dependencias:** `Input`, `Map`

---

### `camera.js` — Cámara 2D

Gestiona el viewport para el modo top-down. Traduce coordenadas del mapa a coordenadas de pantalla centrando al jugador.

**Propiedades:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `x` | `number` | `0` | Offset horizontal de cámara en píxeles. Se resta a la coordenada de cada elemento para dibujarlo en pantalla |
| `y` | `number` | `0` | Offset vertical de cámara en píxeles |

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `update(tx, ty, mapW, mapH)` | `tx, ty: number` — coordenada del jugador en píxeles; `mapW, mapH: number` — dimensiones totales del mapa en píxeles | `void` | Calcula offset para centrar `(tx, ty)` en la pantalla. Clampa para que no se vea fuera del mapa: si el mapa es más ancho que la pantalla, el offset se mueve entre 0 y `mapW - SCREEN_W`; si es más angosto, centra el mapa completo. Redondea a enteros |

**Algoritmo:**
```
x = targetX - SCREEN_W / 2
y = targetY - SCREEN_H / 2

si mapW > SCREEN_W:
    x = clamp(x, 0, mapW - SCREEN_W)
sino:
    x = (mapW - SCREEN_W) / 2   // centrar mapa chico

(idem para Y)

x = Math.round(x)
y = Math.round(y)
```

**Dependencias:** `SCREEN_W`, `SCREEN_H` (definidos en raycaster.js)

---

### `raycaster.js` — Algoritmo DDA (Digital Differential Analyzer)

Implementa el raycasting clásico de Wolfenstein 3D: lanza un rayo por cada columna de píxeles de la pantalla y calcula la distancia a la pared más cercana.

**Constantes:**
| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `SCREEN_W` | `640` | Ancho interno del canvas en píxeles (se escala vía CSS). Determina la cantidad de rayos por frame |
| `SCREEN_H` | `480` | Alto interno del canvas en píxeles |

**`Raycaster`**: objeto singleton.

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `cast(rays, player)` | `rays: object[]` — array de `SCREEN_W` elementos que se llenará con los resultados; `player: Player` | `void` | Lanza un rayo por cada columna de píxeles. Cada elemento de `rays[x]` recibe `{ drawStart, drawEnd, side, tileType, perpDist }` |

**Variables locales del algoritmo DDA (por rayo):**
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

**Estructura del resultado (`rays[x]`):**
```json
{
  "drawStart": 120,     // Y inicial de la pared en pantalla
  "drawEnd": 360,       // Y final de la pared en pantalla
  "side": 0,            // 0=vertical, 1=horizontal
  "tileType": 1,        // ID del tile golpeado
  "perpDist": 2.34      // distancia perpendicular
}
```

**Algoritmo paso a paso:**
```
1. Para cada columna x en [0, SCREEN_W):
   a. Calcular cameraX = 2*x/SCREEN_W - 1      → rango [-1, +1]
   b. Calcular rayDir = player.dir + player.plane * cameraX
   c. Inicializar mapX, mapY en el tile del jugador
   d. Calcular deltaDist (distancia por celda)
   e. Calcular step y sideDist (distancia al primer borde)
   f. Bucle DDA:
      - Avanzar al siguiente borde de celda (X o Y, el que esté más cerca)
      - Si la celda es sólida (Map.getTile > 0) → hit = 1, break
   g. Calcular perpDist (distancia perpendicular anti-fish-eye)
   h. Calcular lineHeight, drawStart, drawEnd
   i. Guardar ray = { drawStart, drawEnd, side, tileType, perpDist }
```

**Dependencias:** `Map` (getTile), `SCREEN_W`, `SCREEN_H`

---

### `renderer.js` — Pipeline de Renderizado (Dual Mode)

Bifurca entre pipeline 2D top-down y pipeline de raycaster pseudo-3D según `Map.current.mode`. También dibuja el overlay de transición.

**Propiedades:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `mode` | `string` | `'2d'` | Modo actual de renderizado, se actualiza cada frame desde `Map.current.mode` |
| `canvas` | `HTMLCanvasElement` | — | Referencia al canvas, seteada en `init()` |
| `ctx` | `CanvasRenderingContext2D` | — | Contexto 2D del canvas |
| `rays` | `object[]` | `new Array(SCREEN_W)` | Array prealocado para resultados del raycaster |

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `init(canvas)` | `canvas: HTMLCanvasElement` | `void` | Guarda referencia al canvas y su contexto 2D, setea `width/height = SCREEN_W/SCREEN_H`, prealoca `rays[]` |
| `render(player)` | `player: Player` | `void` | Pipeline principal: limpia canvas, si `Map.current === null` retorna (guard contra crash), según `mode` delega a ray pipeline o `draw2D()`, y siempre dibuja `drawTransition()` |
| `drawCeiling(ctx)` | `ctx: CanvasRenderingContext2D` | `void` | Rellena la mitad superior de la pantalla con `#1a1a2e` (cielo oscuro) |
| `drawFloor(ctx)` | `ctx: CanvasRenderingContext2D` | `void` | Rellena la mitad inferior con `#2d2d44` (suelo) |
| `drawWalls(ctx, player)` | `ctx, player` | `void` | Itera `rays[]`: por cada columna, obtiene el `tileColors` del `tileType` golpeado, aplica sombra (`side===1` → factor 0.6), dibuja una línea vertical de 1px de ancho desde `drawStart` hasta `drawEnd` |
| `drawMinimap(ctx, player)` | `ctx, player` | `void` | Dibuja minimapa en esquina inferior izquierda (escala 4px/tile). Pinta todos los tiles con sus colores. Marca al jugador como círculo rojo con línea de dirección |
| `draw2D(ctx, player)` | `ctx, player` | `void` | Pipeline 2D completo: actualiza cámara, hace viewport culling (solo tiles visibles), dibuja tiles con `tileColors`, dibuja puertas con brillo pulsante (`rgba(255,215,0, pulso)` donde `pulso = sin(Date.now()/400)*0.15+0.35`), dibuja jugador como cuadrado `#4a9eff` de 20×20 con línea de dirección blanca y offset de bob vertical |
| `drawTransition(ctx)` | `ctx` | `void` | Dibuja overlay negro semitransparente sobre toda la pantalla con alpha de `Transition.getAlpha()`. Si alpha es 0, no dibuja nada |
| `shadeColor(hex, factor)` | `hex: string` (ej `#4a7c3f`), `factor: number` (0-1) | `string` — color RGB | Parsea hex a RGB, multiplica cada canal por `factor`, clamp a 255. Ej: `shadeColor('#ff8800', 0.6)` → `'rgb(153,81,0)'` |

**Pipeline ray (`drawCeiling + drawFloor + drawWalls + drawMinimap`):**
```
1. drawCeiling: rectángulo lleno en mitad superior
2. drawFloor:   rectángulo lleno en mitad inferior
3. drawWalls:   itera 640 rayos, dibuja una columna vertical por rayo
                → color base desde tileColors[id]
                → si side === 1, oscurece 40% (factor 0.6)
4. drawMinimap: grid 4px/tile + jugador como punto rojo
```

**Pipeline 2D (`draw2D`):**
```
1. Camera.update(player.x * ts, player.y * ts, mapPixelW, mapPixelH)
2. Calcular rango visible de tiles (startCol/Row, endCol/Row)
3. Para cada tile visible:
   - Obtener color de tileColors[id]
   - Dibujar rect en (col*ts - cam.x, row*ts - cam.y)
4. Para cada exit:
   - Dibujar tile de salida con su color
   - Superponer brillo pulsante dorado
5. Dibujar jugador:
   - Cuadrado azul 20×20 centrado en (player.x*ts - cam.x, player.y*ts - cam.y + bobOffset)
   - Línea blanca desde el centro hacia (facingX*16, facingY*16)
```

**Dependencias:** `Map`, `Raycaster`, `Camera`, `Transition`

---

### `sprite.js` — Cargador y Dibujado de Atlas de Sprites

Utilidad para cargar una hoja de sprites (sprite sheet) y dibujar recortes de ella en el canvas. Diseñado para futuros NPCs, objetos e ítems tanto en modo 2D como en modo ray.

**Propiedades:**
| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `atlas` | `HTMLImageElement` | `null` | Imagen del atlas de sprites cargada. `null` hasta que se invoque `load()` |
| `loaded` | `boolean` | `false` | `true` una vez que la imagen del atlas terminó de cargarse |

**Métodos:**
| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `load(imagePath)` | `imagePath: string` — ruta al archivo de imagen (ej: `/img/sprites.png`) | `Promise<void>` | Crea un `new Image()`, asigna `src`, resuelve la promesa cuando `onload` se dispara. Setea `loaded = true` |
| `draw(ctx, id, sx, sy, sw, sh, dx, dy, dw, dh)` | `ctx: CanvasRenderingContext2D`; `sx, sy, sw, sh: number` — rectángulo de recorte en el atlas; `dx, dy, dw, dh: number` — rectángulo de destino en el canvas | `void` | Dibuja un sprite recortado del atlas en el canvas usando `ctx.drawImage(atlas, sx, sy, sw, sh, dx, dy, dw, dh)`. Si `loaded === false`, retorna sin dibujar |

**Ejemplo de uso:**
```js
// Cargar atlas al inicio
await Sprite.load('/img/sprites.png');

// En el render loop (modo 2D):
const screenX = npc.x * ts - Camera.x;
const screenY = npc.y * ts - Camera.y;
Sprite.draw(ctx, null, 0, 0, 32, 32, screenX, screenY, 32, 32);
```

**Dependencias:** ninguna

---

## 🧠 Conceptos Técnicos

### Sistema de Transiciones
Al pisar un tile de salida (`exits` en el JSON):
1. El game loop detecta la salida y congela el movimiento del jugador.
2. Se inicia un **fade out** (pantalla se vuelve negra en `duration/2` segundos).
3. En el punto medio: se carga el nuevo mapa y se reposiciona al jugador.
4. Se inicia el **fade in** (pantalla vuelve a la normalidad en `duration/2` segundos).
5. El jugador recupera el control.

### Dual Mode
Cada mapa tiene un `mode` que determina cómo se controla al jugador y cómo se renderiza la escena. El raycaster se mantiene intacto para modo `ray`. El modo `2d` añade un renderer top-down con cámara.

### Wall Sliding (ambos modos)
El movimiento se evalúa por separado en X e Y. Si solo un eje está bloqueado, el jugador se desliza a lo largo de la pared.

---

## 🚀 Cómo Extender

### Añadir un mapa nuevo
1. Crear `public/maps/mi_mapa.json` con el formato descrito.
2. Añadir un `exit` en otro mapa que apunte a `mi_mapa.json`.

### Añadir un tile nuevo
1. Asignar ID nuevo en el JSON.
2. Añadir `"id": { "color": "...", "name": "...", "solid": bool }` en `tileColors`.
3. Documentar en `public/maps/COLORES.md`.

### Añadir NPCs/objetos (sprites en 2D)
1. En `draw2D()`, obtener posición del NPC y calcular screen coords con la cámara.
2. Dibujar con `Sprite.draw()` o con un rectángulo de color.
3. Para modo ray, ver documentación original.

### Integrar red multijugador
1. Serializar posición del jugador según el modo actual.
2. Enviar/recibir vía WebSocket.
3. Renderizar otros jugadores como sprites en el modo correspondiente.
