# 🎮 GameCore — Motor de Juego (Raycasting Pseudo-3D)

Motor de renderizado pseudo-3D con algoritmo DDA (Digital Differential Analyzer), inspirado en Wolfenstein 3D. Construido íntegramente en Vanilla JavaScript sobre Canvas 2D.

---

## 📁 Estructura de Archivos

```
gamecore/
├── core.js        ← Bucle principal del juego (game loop)
├── input.js       ← Captura de teclado (eventos keydown/keyup)
├── map.js         ← Grid 2D del mundo y consultas de tiles
├── player.js      ← Estado del jugador (posición, stats, movimiento)
├── raycaster.js   ← Algoritmo DDA de Raycasting
├── renderer.js    ← Pipeline de dibujado (cielo, suelo, paredes, minimapa)
└── sprite.js      ← Cargador y dibujado de atlas de sprites
```

---

## 🔄 Flujo de Ejecución

```
1. core.js arranca con requestAnimationFrame
       │
2. Por cada frame:
       │
       ├─ Player.update(dt)       ← Lee Input, actualiza posición/rotación
       │
       └─ Renderer.render(player) ← Dibuja el frame
              │
              ├─ Raycaster.cast(rays, player)  ← Lanza 640 rayos DDA
              ├─ drawCeiling()
              ├─ drawFloor()
              ├─ drawWalls()                   ← Usa datos de los rayos
              └─ drawMinimap()                 ← Vista superior del mapa
```

---

## 📄 Documentación por Archivo

### `core.js` — Bucle Principal

Punto de entrada del motor. Arranca el game loop con `requestAnimationFrame` y controla el delta time.

**Variables clave:**
- `canvas` — referencia al elemento `<canvas id="gameCanvas">`
- `lastTime` — timestamp del frame anterior (para calcular dt)
- `fps` — contador de fotogramas por segundo (actualizado cada 1s)

**Flujo por frame:**
1. Calcula `dt` (delta time en segundos, capado a 50ms para evitar picos)
2. Incrementa contador de FPS
3. Llama a `Player.update(dt)` — actualiza estado del jugador
4. Llama a `Renderer.render(Player)` — dibuja el frame
5. Solicita el siguiente frame con `requestAnimationFrame`

**Dependencias:** `Renderer`, `Player`

---

### `input.js` — Sistema de Input

Captura eventos de teclado y expone una API de consulta para el resto del motor.

**Variables:**
- `keys` — objeto `{}` que mapea tecla → `true/false`

**Métodos de `Input`:**
| Método | Teclas | Acción |
|--------|--------|--------|
| `isDown(key)` | cualquier tecla | Consulta si una tecla está presionada |
| `isLeft()` | `a`, `←` | Rotar cámara a la izquierda |
| `isRight()` | `d`, `→` | Rotar cámara a la derecha |
| `isForward()` | `w`, `↑` | Avanzar hacia adelante |
| `isBackward()` | `s`, `↓` | Retroceder |
| `isStrafeLeft()` | `q` | Strafear a la izquierda |
| `isStrafeRight()` | `e` | Strafear a la derecha |

**Nota:** Previene el scroll de página con las flechas direccionales.

**Dependencias:** ninguna

---

### `map.js` — Mapa del Mundo

Define el grid 2D del mundo y proporciona métodos para consultar tiles.

**Formato del grid:**
```
0 = suelo transitable
1 = pared naranja
2 = pared púrpura
```

**Constantes:**
- `MAP` — array 2D (16×10) que define el mundo
- `MAP_W`, `MAP_H` — dimensiones del mapa

**Métodos de `Map`:**
| Método | Descripción |
|--------|-------------|
| `getTile(x, y)` | Devuelve el tipo de tile en coordenadas float. Fuera de rango → 1 |
| `isSolid(x, y)` | `true` si el tile no es transitable (tile !== 0) |

**Dependencias:** ninguna

---

### `player.js` — Jugador

Estado completo del jugador: posición, dirección, estadísticas y lógica de movimiento.

**Propiedades:**
| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `x`, `y` | float | Posición en el mapa (coordenadas de tile) |
| `dirX`, `dirY` | float | Vector dirección (hacia dónde mira) |
| `planeX`, `planeY` | float | Vector del plano de cámara (perpendicular a dir) |
| `moveSpeed` | float | Velocidad de movimiento (tiles/segundo) |
| `rotSpeed` | float | Velocidad de rotación (radianes/segundo) |
| `hp`, `maxHp` | int | Vida actual y máxima |
| `mp`, `maxMp` | int | Maná actual y máximo |
| `str` | int | Fuerza |
| `int` | int | Inteligencia |
| `level` | int | Nivel del jugador |

**Métodos:**
| Método | Descripción |
|--------|-------------|
| `rotate(angle)` | Rota el vector dirección y plano de cámara usando matriz de rotación |
| `move(dx, dy)` | Mueve al jugador con detección de colisiones separada en X e Y (wall sliding) |
| `update(dt)` | Procesa input y actualiza posición/rotación cada frame |

**Sistema de colisiones:**
Las colisiones se comprueban por separado en cada eje. Si el movimiento en X es válido pero en Y no, el jugador se desliza por la pared en lugar de quedarse pegado.

**Dependencias:** `Input`, `Map`

---

### `raycaster.js` — Algoritmo DDA

Implementación del algoritmo Digital Differential Analyzer para renderizado pseudo-3D, el mismo usado en Wolfenstein 3D.

**Constantes:**
- `SCREEN_W` = 640 (resolución horizontal del canvas)
- `SCREEN_H` = 480 (resolución vertical del canvas)

**Método `cast(rays, player)`:**
Lanza un rayo por cada columna de píxeles de la pantalla (640 rayos por frame).

**Algoritmo por cada rayo:**
1. **Coordenada de cámara:** `cameraX = 2 * x / SCREEN_W - 1` (mapea píxel a rango [-1, 1])
2. **Dirección del rayo:** `rayDir = dir + plane * cameraX`
3. **Delta distance:** distancia que debe recorrer el rayo para cruzar una celda completa en X o Y
4. **Side distance:** distancia desde la posición actual hasta el primer borde de celda en X e Y
5. **Bucle DDA:** avanza el rayo celda por celda en la dirección que tenga menor `sideDist`
6. **Hit:** cuando encuentra un tile sólido, registra qué lado golpeó (0 = E/W, 1 = N/S)
7. **Distancia perpendicular:** evita el efecto "ojo de pez" usando la distancia perpendicular en lugar de euclidiana
8. **Altura de línea:** `lineHeight = SCREEN_H / perpDist` — a mayor distancia, más pequeña

**Resultado por rayo:**
```javascript
{
  drawStart,  // línea vertical: píxel inicial Y
  drawEnd,    // línea vertical: píxel final Y
  side,       // 0 = pared E/W, 1 = pared N/S
  tileType,   // tipo de tile golpeado (para color)
  perpDist,   // distancia perpendicular (para profundidad)
}
```

**Dependencias:** `Map`

---

### `renderer.js` — Pipeline de Renderizado

Gestiona todo el dibujado en el canvas 2D.

**Método `init(canvas)`:**
- Obtiene el contexto 2D
- Configura resolución interna (640×480)
- Inicializa el buffer de rayos

**Método `render(player)`:**
Orden de dibujado (pintor):
1. `drawCeiling()` — mitad superior, color oscuro (`#1a1a2e`)
2. `drawFloor()` — mitad inferior, color medio (`#2d2d44`)
3. `drawWalls()` — franjas verticales usando datos del raycaster
4. `drawMinimap()` — minimapa en esquina inferior izquierda

**Sombras de paredes:**
Las paredes en el eje N/S (`side === 1`) se oscurecen al 60% para dar sensación de profundidad y volumen.

**Minimapa:**
- Escala 4px por tile
- Posición: esquina inferior izquierda con margen de 10px
- Muestra el grid completo, la posición del jugador (círculo rojo) y su dirección (línea roja)

**Método auxiliar `shadeColor(hex, factor)`:**
Convierte un color hexadecimal a rgb y lo oscurece según un factor (0-1).

**Dependencias:** `Raycaster`, `Map`

---

### `sprite.js` — Atlas de Sprites

Utilidad para cargar y dibujar sprites desde una hoja de sprites (atlas).

**Propiedades:**
- `atlas` — objeto `Image` con la textura cargada
- `loaded` — booleano que indica si la imagen está lista

**Métodos:**
| Método | Descripción |
|--------|-------------|
| `load(imagePath)` | Carga un atlas desde una ruta. Devuelve una Promise |
| `draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh)` | Dibuja un recorte del atlas en el canvas |

**Uso:**
```javascript
await Sprite.load('/img/atlas.png');
Sprite.draw(ctx, 0, 0, 32, 32, 100, 100, 64, 64);
```

**Dependencias:** ninguna

---

## 🧠 Conceptos Técnicos

### Delta Time (dt)
El `dt` representa el tiempo transcurrido entre el frame anterior y el actual, en segundos. Multiplicar velocidades por `dt` garantiza que el movimiento sea independiente de los FPS:

```javascript
movimiento = velocidad * dt  // tiles/segundo, no tiles/frame
```

### DDA Raycasting
El algoritmo DDA es un método eficiente para detectar intersecciones entre un rayo y un grid. A diferencia del raycasting ingenuo (avanzar pasos fijos pequeños), el DDA solo comprueba los bordes de las celdas, lo que lo hace mucho más rápido y adecuado para tiempo real.

### Wall Sliding
Cuando el jugador choca contra una pared, el movimiento se evalúa por separado en X e Y. Si solo un eje está bloqueado, el jugador se desliza a lo largo de la pared.

---

## 🚀 Cómo Extender

### Añadir un nuevo tipo de tile
1. Agregar el ID en `map.js` (ej: `3`)
2. Agregar el color en `renderer.js` → `tileColors`
3. Opcional: agregar textura en `raycaster.js`

### Añadir NPCs/objetos (sprites)
1. Crear un atlas de sprites en `public/img/`
2. Cargarlo con `Sprite.load('/img/mi_atlas.png')`
3. Implementar el ordenamiento por profundidad en el renderer
4. Dibujar sprites entre el suelo y el minimapa

### Integrar red multijugador
1. Serializar `Player` (posición, stats) como JSON
2. Enviar/recibir vía WebSocket (o la capa de red que implementes)
3. Actualizar posiciones de otros jugadores como sprites en el renderer
