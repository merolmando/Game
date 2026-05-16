# `core.js` — Bucle Principal y Transiciones

Punto de entrada del motor. Arranca el game loop, gestiona las transiciones entre mapas y coordina todos los módulos.

## Constantes y variables globales

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `canvas` | `HTMLCanvasElement` | Referencia al `<canvas id="gameCanvas">` del DOM |
| `lastTime` | `number` | Timestamp `performance.now()` del frame anterior para calcular delta time |
| `fps` | `number` | Fotogramas por segundo del último segundo medido |
| `frameCount` | `number` | Contador de frames del segundo actual |
| `fpsTimer` | `number` | Acumulador de tiempo para actualizar `fps` cada 1s |

## `Transition`

Sistema de fade out/in que sincroniza la carga asíncrona de mapas con la animación visual.

### Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `active` | `boolean` | `false` | `true` mientras la transición está en curso |
| `timer` | `number` | `0` | Segundos transcurridos desde que empezó la fase actual |
| `halfDuration` | `number` | `0.5` | Mitad del duration total (`duration / 2`) |
| `phase` | `string` | `''` | `'fadeOut'`, `'fadeIn'`, o `''` (inactivo) |
| `loaded` | `boolean` | `false` | Bandera que el `loadMap().then()` setea a `true` cuando el nuevo mapa ya está cargado |

### Métodos

| Método | Parámetros | Descripción |
|--------|-----------|-------------|
| `start(duration)` | `duration: number` — segundos totales del fade out+in | Inicia la transición: setea `active=true`, `phase='fadeOut'`, `timer=0`, `loaded=false` |
| `update(dt)` | `dt: number` — delta time en segundos | Avanza el timer. Si `phase==='fadeOut'` y pasó `halfDuration`, espera a `loaded===true` antes de pasar a `'fadeIn'`. Cuando `fadeIn` termina, desactiva la transición |
| `getAlpha()` | _(ninguno)_ | Devuelve `number` (0-1) para el overlay negro. Curva `easeInQuad` en fadeOut, `easeOutQuad` en fadeIn. `0` si no hay transición activa |

## `loadMap(path)`

| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function loadMap(path: string): Promise<void>` |
| Qué hace | Fetch del JSON del mapa, reposiciona al jugador (`Player.x/y`), setea dirección 2D o ray según `mode`, calcula `planeX/planeY` dinámicamente como `-dirY*0.66` / `dirX*0.66`, resetea `Camera.x/y`, y setea `Player.spawnTimer = 0.3` para evitar re-disparo inmediato de salidas |
| Llamada | Desde `init()` al arranque, y desde `Transition.start()` vía `.then()` |

## `gameLoop(timestamp)`

| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function gameLoop(timestamp: DOMHighResTimeStamp): Promise<void>` |
| Qué hace | Bucle principal de renderizado vía `requestAnimationFrame`. Calcula delta time clampado a 0.05s (50ms máximo por frame). Actualiza contador FPS. Si no hay transición activa: actualiza al jugador, decrementa `spawnTimer`, y si `spawnTimer <= 0` verifica salidas. Si hay salida: inicia transición + `loadMap()` asíncrono. Siempre: actualiza `Transition` y llama a `Renderer.render()`. Vuelve a solicitar `requestAnimationFrame(gameLoop)` |

## `init()`

| Aspecto | Descripción |
|---------|-------------|
| Firma | `async function init(): Promise<void>` |
| Qué hace | Punto de entrada: carga el mapa inicial (`/maps/inicio.json`) y arranca el game loop con `requestAnimationFrame(gameLoop)` |

## Flujo completo de transición

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

## Dependencias

`Map`, `Player`, `Renderer`, `Canvas`
