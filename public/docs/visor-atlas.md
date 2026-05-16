# Visor de Atlas

**Ruta:** `/desarrollo/herramientas/visor-atlas`
**Archivos:** `public/devtools/visor-atlas/`

Explorador visual multi-atlas para inspeccionar todas las entidades registradas en el sistema. Carga los 4 atlas (`mundo`, `entidades`, `ui`, `efectos`) y permite navegar cada entidad con su sprite animado, propiedades y metadatos.

## Interfaz

Panel de 3 columnas:

**Izquierda — Lista de entidades:**
- Búsqueda/filtro por nombre (tipeo en tiempo real)
- Cada entrada muestra: cuadrado de color, nombre, cantidad de frames, tag del grupo (ej: `[mundo]`), indicador de sprite real vs. placeholder
- Click para seleccionar entidad y ver detalle

**Centro — Canvas del atlas:**
- Todos los grupos cargados en canvas apilados verticalmente
- Cada grupo tiene encabezado con nombre y dimensión (ej: `efectos (512×512)`)
- Recuadros coloreados con bordes alrededor de cada entidad dentro del atlas
- Nombre truncado sobre cada recuadro
- Zoom con scroll wheel, botones − / + / Ajustar

**Derecha — Panel de detalle:**
- Preview animado del sprite seleccionado
- Selector de dirección (si la entidad tiene `dirFrames`, elegir dirección y ver mirror)
- Strip de frames: thumbnails de cada frame en fila, resaltado el activo
- Propiedades completas: tipo, sólido, frames, animSpeed, posición en atlas, frameW×frameH, tileW×tileH, direcciones, mirror, halfBlock, blockVision, halfSolid, si tiene sprite real (PNG check)
- Capas: si la entidad tiene layers, se listan con nombre y frames
- Botón: Editar entidad → redirige al Creador de Tiles

## Stats Bar

Header muestra estadísticas consolidadas de todos los atlas:
- **Entidades:** cantidad total de sprites en todos los grupos
- **Frames:** suma de frames de todas las entidades (considerando dirFrames)
- **Dimensiones:** tamaño de cada grupo cargado (ej: `mundo:512×512 entidades:512×512`)

## Detalle de Entidad

Al seleccionar una entidad, el panel derecho muestra:

| Sección | Contenido |
|---------|-----------|
| Preview | Sprite animado via requestAnimationFrame |
| Dirección | Selector dinámico con las direcciones disponibles (up, right, down, etc.) más sus mirror automáticos |
| Strip | Thumbnails de todos los frames, frame activo con borde |
| Tipo | tile/character/enemy/item/effect |
| Sólido | Sí/No |
| Frames | Cantidad total |
| AnimSpeed | Velocidad en segundos |
| Posición | Coordenadas (x, y) en el atlas |
| Frame size | frameW × frameH en píxeles |
| Tile size | tileW × tileH en tiles |
| Direcciones | none/4dir/8dir con detalles |
| Mirror / HalfBlock / BlockVision / HalfSolid | Sí/No |
| Sprite real | Check verde si la entidad tiene imagen PNG, rojo si usa placeholder |
| Capas | Listado si la entidad tiene layers (idle, walk, etc.) |
| Editar | Botón para abrir en Creador de Tiles |

## Arquitectura Multi-Atlas

Carga los 4 grupos en paralelo mediante `Promise.all()`. Cada grupo consiste en:
- `atlas_{name}.json` — metadatos con sprites, entityOrder, dimensiones
- `atlas_{name}.png` — imagen del atlas compilada

Los datos se cachean con timestamp (`?t=`) para evitar caché del navegador. Soporta grupos parciales (si un atlas no existe, se omite sin error).
