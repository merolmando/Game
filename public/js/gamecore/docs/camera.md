# `camera.js` — Cámara 2D

Gestiona el viewport para el modo top-down. Traduce coordenadas del mapa a coordenadas de pantalla centrando al jugador.

## Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `x` | `number` | `0` | Offset horizontal de cámara en píxeles. Se resta a la coordenada de cada elemento para dibujarlo en pantalla |
| `y` | `number` | `0` | Offset vertical de cámara en píxeles |

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `update(tx, ty, mapW, mapH)` | `tx, ty: number` — coordenada del jugador en píxeles; `mapW, mapH: number` — dimensiones totales del mapa en píxeles | `void` | Calcula offset para centrar `(tx, ty)` en la pantalla. Clampa para que no se vea fuera del mapa: si el mapa es más ancho que la pantalla, el offset se mueve entre 0 y `mapW - SCREEN_W`; si es más angosto, centra el mapa completo. Redondea a enteros |

## Algoritmo

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

## Dependencias

`SCREEN_W`, `SCREEN_H` (definidos en raycaster.js)
