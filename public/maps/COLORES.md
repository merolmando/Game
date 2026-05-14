# 🗺️ Mapa de Colores — Placeholders

Cada tile ID representa un tipo de celda en el mapa. Los colores son placeholders visuales hasta que se implementen texturas reales desde un spritesheet.

---

## 🟩 Tile 0 — Pasto (Verde `#4a7c3f`)
- **Transitable:** Sí
- **Descripción:** Suelo estándar del mundo exterior. El jugador puede caminar libremente.
- **Futuro:** Reemplazar por sprite de pasto con variaciones.

## 🟫 Tile 1 — Pared (Marrón `#5c4033`)
- **Transitable:** No
- **Descripción:** Pared del mapa. Bloquea el paso y activa colisiones.
- **Futuro:** Reemplazar por sprites de pared según el bioma (piedra, madera, etc.).

## 🟨 Tile 2 — Puerta / Transición (Dorado `#b8860b`)
- **Transitable:** Sí
- **Descripción:** Tile de salida. Al pisarlo se activa una transición visual (fade out/in) y se carga el mapa destino definido en `exits` del JSON.
- **Futuro:** Animación de puerta con sprites.

## 🟦 Tile 3 — Agua (Azul `#2e6da4`)
- **Transitable:** No
- **Descripción:** Agua superficial. Bloquea el paso.
- **Futuro:** Animación de ondas con sprites, posiblemente navegable con barca.

---

## Cuándo y cómo se usan

- En mapas con `mode: "2d"` se renderizan como cuadros de `tileSize × tileSize` px con la cámara siguiendo al jugador.
- En mapas con `mode: "ray"` los colores se definen en el `tileColors` del JSON pero solo los tiles > 0 se renderizan como paredes en el Raycaster.
- Los IDs pueden variar por mapa. Cada JSON define su propio `tileColors`.

## Cómo añadir un tile nuevo

1. Asignar un ID numérico nuevo en el array `tiles` del JSON.
2. Añadir la entrada en `tileColors` con `color`, `name` y `solid`.
3. Documentarlo aquí.
