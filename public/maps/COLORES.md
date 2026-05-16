# 🗺️ Mapa de Tiles — Sistema de Capas

Cada tile ID representa un tipo de celda en el mapa. Los tiles se renderizan con sprites reales del atlas (`public/generated/atlas.png`), con fallback a colores sólidos si no hay atlas disponible.

---

## Sistema de Capas

Los mapas usan 4 capas:

| Capa | Propósito | Colisión | Render |
|------|-----------|----------|--------|
| `terreno` | Piso/base del mapa (pasto, agua, decoraciones) | `isSolid()` chequea tiles sólidos en esta capa (agua bloquea al jugador) | Floor-casting texturizado en modo ray, drawLayer en 2D |
| `estructura` | Paredes y obstáculos verticales | `isWall()` solo para raycaster, `isSolid()` para colisión jugador | Raycaster DDA (paredes 3D) en modo ray, drawLayer en 2D |
| `objetos` | Muebles, decoraciones, billboards | No tiene colisión | Billboards en modo ray, drawLayer en 2D |
| `cielo` | Color del cielo/techo | — | drawCeiling en modo ray, drawSky en 2D |

## Tiles Actuales

### Tile 0 — Vacío
- **ID:** 0
- **Transitable:** Sí
- **Descripción:** Celda vacía en cualquier capa. No se renderiza y no bloquea el paso.

### Tile 1 — Pasto
- **ID:** 1
- **Sprite:** `pasto` (verde `#4a7c3f`)
- **Transitable:** Sí
- **Capa:** `terreno`
- **Descripción:** Suelo estándar del mundo exterior.

### Tile 2 — Pared de Piedra
- **ID:** 2
- **Sprite:** `pared_piedra` (marrón `#5c4033`)
- **Transitable:** No
- **Capa:** `estructura`
- **Descripción:** Pared del mapa. Bloquea el paso y detiene los rayos del raycaster.

### Tile 3 — Puerta / Transición
- **ID:** 3
- **Sprite:** `puerta` (dorado `#b8860b`)
- **Transitable:** Sí
- **Capa:** `estructura` o `terreno`
- **Descripción:** Tile de salida. Al pisarlo se activa una transición visual (fade out/in) y se carga el mapa destino.

### Tile 4 — Agua
- **ID:** 4
- **Sprite:** `agua` (azul `#2e6da4`)
- **Transitable:** No (colisión circular)
- **Capa:** `terreno`
- **Descripción:** Agua superficial. Bloquea el paso (vía `isSolid()`) pero NO es una pared (no detiene rayos del raycaster).

### Tile 5+ — Variantes de pasto decorativo
- **ID:** 5+
- **Sprites:** `pasto_con_baldosas`, `pasto_con_hierbas`, `pasto_sencillo`
- **Transitable:** Sí
- **Capa:** `terreno`
- **Descripción:** Variaciones visuales del pasto para decorar el suelo.

---

## Colisión Circular

Jugador y NPCs tienen colisión circular con **radio 0.5** (medio tile = entidad de 1 tile de diámetro). La detección usa distancia círculo vs rectángulo para tiles, y distancia entre centros para entidades.

---

## Migración Automática

Mapas legacy con capa `mundo` se migran automáticamente al cargarse:
- Tiles cuyo sprite contiene "pared" → `estructura`
- Tiles de agua, pasto, puerta, decoraciones → `terreno`
