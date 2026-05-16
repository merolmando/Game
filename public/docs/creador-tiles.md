# Creador de Tiles

**Ruta:** `/desarrollo/herramientas/creador-tiles`
**Archivos:** `public/devtools/creador-tiles/`

Editor de pixel-art para crear sprites desde cero. Soporta animación multi-frame, capas por estado (idle, walk, etc.) y exportación a entidades con todas sus propiedades (tileW, tileH, direcciones, mirror, sólido, etc.).

## Interfaz

Panel de 3 columnas:

**Izquierda — Herramientas, Color, Lienzo:**
- 6 herramientas de dibujo con atajos de teclado (Pincel `B`, Goma `E`, Bote `G`, Gotero `I`, Línea `L`, Rectángulo `R`)
- Botones Deshacer/Rehacer (Ctrl+Z / Ctrl+Shift+Z)
- Paleta de 16 colores predefinidos + color picker nativo + entrada HEX
- Tamaño de lienzo configurable (4×4 a 128×128)
- Zoom (− / +) hasta 3200%

**Centro — Canvas:**
- Lienzo de edición con zoom. Click izquierdo pinta, derecho borra
- Preview en tiempo real de la herramienta activa (línea/rectángulo muestran preview al arrastrar)

**Derecha — Propiedades, Preview, Entidades:**
- Nombre (ID único), Tipo (tile/character/enemy/item/effect), Atlas (mundo/entidades/ui/efectos)
- Sólido, BlockVision, HalfBlock, HalfSolid, Mirror
- TileSize, TileW, TileH (permite sprites multi-tile como personajes de 1×2)
- Direcciones: none, 4dir (up/right/down/left), 8dir (up/upRight/right/downRight/down/downLeft/left/upLeft)
- Frames, AnimSpeed (velocidad de animación en segundos)
- Navegador de frames con anterior/siguiente, vista previa animada
- Sistema de capas por entidad: cada capa (idle, walk, atk...) tiene sus propios frames y animSpeed
- Vista previa en tamaño real (panel lateral)
- Lista de entidades existentes (cargadas desde `/api/entidades`)

## Herramientas

| Herramienta | Atajo | Descripción |
|-------------|-------|-------------|
| Pincel | `B` | Dibuja píxeles individuales |
| Goma | `E` | Borra a transparente |
| Bote | `G` | Flood fill (rellena área contigua del mismo color) |
| Gotero | `I` | Toma color de un píxel del canvas |
| Línea | `L` | Algoritmo Bresenham, preview en tiempo real |
| Rectángulo | `R` | Rectángulo relleno, preview en tiempo real |

## Sistema de Frames

- Frame inicial único. Se agregan frames con botón `+` y cada frame tiene su propio grid de píxeles
- Navegación: ◀ / ▶ con label de frame activo
- Duplicación del frame actual al agregar
- Vista previa animada en tiempo real combinando todos los frames
- Al guardar, `spriteToBase64()` genera el canvas completo a la resolución correcta según tileW, tileH, direcciones y frames

## Capas (Layers)

Las entidades pueden tener capas que agrupan frames por nombre:
- `_all` (Todo): capa por defecto que contiene todos los frames
- Capas nombradas: idle, walk, atk, hurt, etc.
- Cada capa tiene su propio contador de frames y animSpeed
- La UI muestra tabs de capa clickeables
- Se pueden agregar/quitar capas dinámicamente

## Sistema Undo/Redo

- Snapshot automático antes de cada acción de dibujo
- 50 niveles de historial
- Atajos Ctrl+Z (deshacer) / Ctrl+Shift+Z (rehacer)
- Cada snapshot guarda el grid completo de píxeles del frame activo

## API

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/entidades` | Listar entidades (poblado del sidebar) |
| POST | `/api/entidades` | Guardar entidad con sprite en base64 + reconstruir atlas |
| DELETE | `/api/entidades/{id}` | Eliminar entidad + reconstruir atlas |

## Guardado

El botón Guardar serializa el sprite a base64 con `canvas.toDataURL()`, arma el payload JSON con todas las propiedades (entityId, type, atlasName, tileSize, tileW, tileH, directions, mirror, halfBlock, blockVision, halfSolid, solid, frames, animSpeed, layers, dirFrames) y lo envía via POST a `/api/entidades`. El servidor reconstruye el atlas automáticamente.
