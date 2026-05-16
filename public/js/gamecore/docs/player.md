# `player.js` — Jugador (Dual Mode)

Representa al jugador con estado completo. Se adapta automáticamente al modo del mapa actual: movimiento cardinal en 2D, rotación + forward/strafe en ray.

## Propiedades generales

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
| `COLLISION_RADIUS` | `number` | `0.5` | Radio de colisión circular en tiles. Medio tile = entidad de 1 tile de diámetro |
| `bobPhase` | `number` | `0` | Fase del seno para la animación de caminar (oscilación). Avanza a 8 rad/s mientras `moving===true`, decae a 6 rad/s² al soltar teclas |
| `bobOffset` | `number` | `0` | Desplazamiento vertical en píxeles: `sin(bobPhase) * 2`. Rango ±2px |
| `moving` | `boolean` | `false` | `true` si el jugador se está moviendo en el frame actual |

## Propiedades modo 2D

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `facingX`, `facingY` | `number` | `0, -1` | Última dirección cardinal de movimiento. Solo se actualiza en ejes puros (horizontal tiene prioridad sobre vertical) |

## Propiedades modo ray

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `dirX`, `dirY` | `number` | `1, 0` | Vector dirección normalizado: hacia dónde mira el jugador |
| `planeX`, `planeY` | `number` | `0, 0.66` | Vector del plano de cámara: determina el FOV. Se calcula como `(-dirY * 0.66, dirX * 0.66)` al cargar un mapa ray |

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `update(dt)` | `dt: number` — delta time en segundos | `void` | Dispatcher: consulta `Map.current.mode` y delega a `update2D()` o `updateRay()` |
| `update2D(dt)` | `dt: number` | `void` | Lee Input (WASD), calcula dx/dy cardinal (solo 0, ±1). Si hay dos ejes, normaliza con ×0.7071. Actualiza `facingX/facingY` priorizando horizontal sobre vertical. Llama a `move()`. Anima bob (fase +8 rad/s, offset = `sin(fase) * 2`) |
| `updateRay(dt)` | `dt: number` | `void` | Lee Input: rotación (`rotate()`), forward/backward (`move(dirX*move, dirY*move)`), strafe izquierda/derecha (`move(-dirY*move, dirX*move)`). Anima bob si hay movimiento |
| `move(dx, dy)` | `dx, dy: number` — desplazamiento en tiles | `void` | Colisión circular con wall sliding: prueba la nueva posición X con `_circleBlocked()` (círculo de radio `COLLISION_RADIUS`), si no colisiona, aplica. Luego prueba Y con la X ya actualizada |
| `_circleBlocked(cx, cy)` | `cx, cy: number` — centro del círculo | `boolean` | Retorna `true` si `Map.current` es null (null guard). Sino, retorna `true` si el círculo colisiona con tiles sólidos (via `Map.checkCircleCollision()`) o con algún NPC/enemigo (distancia < `COLLISION_RADIUS * 2`) |
| `rotate(angle)` | `angle: number` — radianes a rotar (negativo = izquierda) | `void` | Matriz de rotación 2×2 sobre `dirX/dirY` y `planeX/planeY`. Fórmula: `newDirX = dirX*cos - dirY*sin`, `newDirY = dirX*sin + dirY*cos` (idem para plane) |

## Animación bob

```
bobPhase += dt * 8   (mientras moving)
bobPhase -= dt * 6   (al soltar, hasta 0)
bobOffset = sin(bobPhase) * 2   // ±2 píxeles verticales
```

El offset se suma a `player.y * tileSize` en el render 2D para simular el cabeceo al caminar.

## Dependencias

`Input`, `Map`
