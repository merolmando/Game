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

Punto de entrada del motor. Arranca el game loop y gestiona las transiciones entre mapas.

**Variables clave:**
- `canvas` — referencia al `<canvas id="gameCanvas">`
- `lastTime` — timestamp del frame anterior (para calcular dt)
- `fps` — contador de fotogramas por segundo (actualizado cada 1s)

**`Transition`**: Sistema de fade out/in:
- `start(duration)` → inicia fade out. Crea el flag `loaded = false`.
- `update(dt)` → avanza el timer. Al llegar a la mitad del duration, espera a que `loaded === true` antes de pasar a fadeIn. Esto sincroniza la transición con la carga asíncrona del mapa.
- `getAlpha()` → devuelve opacidad actual (0-1) para el overlay negro.
- Curva: `easeInQuad` para fade out, `easeOutQuad` para fade in.
- **Flujo completo:** `Transition.start(1.0)` → `loadMap(path).then(() => Transition.loaded = true)` — el RAF cycle nunca se interrumpe porque la carga usa `.then()` en vez de `await`.

**`loadMap(path)`**: Carga un JSON de mapa, reposiciona al jugador y resetea la cámara.

**Dependencias:** `Map`, `Player`, `Renderer`

---

### `input.js` — Sistema de Input

Sin cambios. Captura teclado con API `{ key: true/false }`.

**Métodos de `Input`:**
| Método | Teclas | En modo 2D | En modo ray |
|--------|--------|------------|-------------|
| `isForward()` | `w`, `↑` | Mover arriba | Avanzar |
| `isBackward()` | `s`, `↓` | Mover abajo | Retroceder |
| `isLeft()` | `a`, `←` | Mover izquierda | Rotar izquierda |
| `isRight()` | `d`, `→` | Mover derecha | Rotar derecha |
| `isStrafeLeft()` | `q` | — | Strafear izquierda |
| `isStrafeRight()` | `e` | — | Strafear derecha |

**Dependencias:** ninguna

---

### `map.js` — Cargador de Mapas

Carga mapas desde JSON y expone consultas de tiles, colisiones y salidas.

**Métodos de `Map`:**
| Método | Descripción |
|--------|-------------|
| `load(path)` | Fetch + parse del JSON. Valida HTTP (<code>if (!res.ok)</code>) y lanza error si falla. Almacena en `this.current` |
| `getTile(x, y)` | Devuelve el ID del tile en coordenadas float. Fuera de rango → 1 |
| `isSolid(x, y)` | `true` si el tile tiene `solid: true` en `tileColors`. Por defecto `true` |
| `checkExits(px, py)` | Busca una salida en la posición del jugador (<code>Math.floor(px + 0.5)</code> para centrar en tile). Devuelve el exit o `null` |

**Propiedades de `Map.current`:**
- `name`, `mode`, `width`, `height`, `tileSize`
- `tiles[][]` — grid 2D de IDs
- `tileColors{}` — configuración visual y física por ID
- `exits[]` — lista de transiciones
- `playerStart` — spawn point

**Dependencias:** ninguna

---

### `player.js` — Jugador (Dual Mode)

Se adapta al modo del mapa actual.

**Propiedades modo 2D:**
| Propiedad | Descripción |
|-----------|-------------|
| `facingX`, `facingY` | Última dirección cardinal de movimiento |
| `bobPhase` | Fase del seno para la animación de caminar |
| `bobOffset` | Desplazamiento vertical (±2px) |
| `moving` | `true` si el jugador se está moviendo |

**Propiedades modo ray:**
| Propiedad | Descripción |
|-----------|-------------|
| `dirX`, `dirY` | Vector dirección (hacia dónde mira) |
| `planeX`, `planeY` | Vector del plano de cámara (FOV) |

**Métodos:**
| Método | Descripción |
|--------|-------------|
| `update(dt)` | Detecta `Map.current.mode` y llama a `update2D()` o `updateRay()` |
| `update2D(dt)` | Movimiento cardinal (WASD). Normaliza diagonales (×0.7071). Anima bob |
| `updateRay(dt)` | Rotación + forward/backward/strafe. Igual que antes |
| `move(dx, dy)` | Mueve con colisiones separadas X/Y (wall sliding) |
| `rotate(angle)` | Rota vector dirección y plano de cámara |

**Animación bob:** `sin(bobPhase) × 2`. Avanza a 8 rad/s mientras se mueve, decae al soltar teclas.

**Dependencias:** `Input`, `Map`

---

### `camera.js` — Cámara 2D

Gestiona el viewport para el modo top-down.

**Propiedades:**
- `x`, `y` — offset de cámara en píxeles

**Métodos:**
| Método | Descripción |
|--------|-------------|
| `update(tx, ty, mapW, mapH)` | Centra en el jugador y clampa a bordes del mapa |

**Comportamiento:**
- Centra `(targetX, targetY)` en el medio de la pantalla.
- Si el mapa es más chico que la pantalla, centra el mapa completo.
- Redondea a enteros para evitar subpixel rendering.

**Dependencias:** `SCREEN_W`, `SCREEN_H` (raycaster.js)

---

### `raycaster.js` — Algoritmo DDA

Sin cambios. Ver documentación original más abajo.

---

### `renderer.js` — Pipeline de Renderizado (Dual Mode)

Bifurca según `Map.current.mode`.

**Método `render(player)`:**
1. Limpia canvas
2. Si `Map.current === null`, retorna sin dibujar (evita crash tras error de carga)
3. Si `mode === "ray"`: raycaster + cielo/suelo/paredes/minimapa
4. Si `mode === "2d"`: `draw2D()`
5. Siempre: `drawTransition()`

**`draw2D(ctx, player)`:**
1. Actualiza cámara centrada en el jugador
2. Itera solo los tiles visibles (viewport culling)
3. Dibuja cada tile con su color según `tileColors`
4. Dibuja puertas con brillo pulsante (`rgba(255, 215, 0, pulsos)`)
5. Dibuja jugador: cuadrado azul `#4a9eff` con línea de dirección blanca y bob vertical

**`drawTransition(ctx)`:**
Dibuja overlay negro con alpha obtenido de `Transition.getAlpha()`.

**Dependencias:** `Map`, `Raycaster`, `Camera`, `Transition`

---

### `sprite.js` — Atlas de Sprites

Sin cambios. Utilidad para cargar y dibujar sprites desde una hoja de sprites.

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
