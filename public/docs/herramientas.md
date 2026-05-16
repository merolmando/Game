# Herramientas de Desarrollo (DevTools)

El proyecto incluye 5 herramientas visuales integradas para la creación de contenido del juego. Todas comparten estilos base via `devtools-base.css` y se sirven desde rutas `/desarrollo/herramientas/{tool}`.

Acceso: Navegar a `/desarrollo/herramientas` o cada herramienta individualmente.

---

## Inspector de Mapas

**Ruta:** `/desarrollo/herramientas/inspector-mapa`
**Archivos:** `public/devtools/inspector-mapa/`

Editor visual de mapas JSON. Permite pintar tiles sobre un grid 2D con vista previa en tiempo real.

### Funcionalidades

- **Capas:** terreno, estructura, objetos, personajes, enemigos. Cada capa se renderiza por separado
- **Paleta de tiles:** thumbnails con sprite real del atlas. Incluye Vacío, los tiles del atlas y atajos numéricos (1-9) para selección rápida
- **Zoom:** scroll wheel, botones +/-/Ajustar. El tamaño de celda se adapta al `tileSize` del mapa
- **Redimensionar:** cambia width/height del mapa, filtra personajes y enemigos fuera de los nuevos límites
- **Persistencia:** guardado via `POST /api/mapas` con feedback visual de fade out
- **Exits:** edición de salidas (tile de activación, mapa destino, spawn, dirección, conexión)
- **Personajes/Enemigos:** modal con selector de entidad (filtrado por `type: character`), coordenadas y dirección. Se renderizan como círculos azules/rojos con flecha direccional
- **Propiedades de tile:** inspector lateral que muestra el ID, nombre, entityId y color de cada tile al clickear
- **Abrir mapa:** modal con lista dinámica desde el servidor

### API

El inspector usa los endpoints REST:
- `GET /api/mapas` — lista mapas disponibles
- `POST /api/mapas` — guarda mapa
- `DELETE /api/mapas/{name}` — elimina mapa
- `GET /api/mapas/default` — mapa inicial configurado

### Arquitectura Multi-Atlas

Carga todos los grupos del atlas (`mundo`, `entidades`, `ui`, `efectos`) mediante `loadAtlases()`. Cada grupo tiene su propia imagen (`atlasImages[nombre]`). La paleta y el render de tiles usan el sprite correspondiente según `atlasName`.

---

## Creador de Tiles

**Ruta:** `/desarrollo/herramientas/creador-tiles`
**Archivos:** `public/devtools/creador-tiles/`

Editor de pixel-art para crear sprites desde cero.

### Herramientas de dibujo

| Herramienta | Atajo | Descripción |
|------------|-------|-------------|
| Pincel | `B` | Dibuja píxeles individuales con el color seleccionado |
| Goma | `E` | Borra píxeles (sin color = transparente) |
| Bote de pintura | `G` | Flood fill: reemplaza un color contiguo por el color actual |
| Gotero | `I` | Toma el color de un píxel del lienzo |
| Línea | `L` | Dibuja líneas rectas con algoritmo Bresenham, preview en tiempo real |
| Rectángulo | `R` | Rectángulo relleno, preview en tiempo real |

### Paleta de colores

- 16 colores predefinidos en la paleta
- Selector HEX para color exacto
- Color picker nativo del navegador
- El color seleccionado se muestra con borde en la paleta

### Propiedades de entidad

| Campo | Descripción |
|-------|-------------|
| Nombre | Identificador único de la entidad (se guarda como ID) |
| Tipo | `tile`, `character`, `enemy`, `item`, `effect` |
| Atlas | Grupo al que pertenece (`mundo`, `entidades`, `ui`, `efectos`) |
| Sólido | Si el tile es colisionable |
| Tile Size | Tamaño en píxeles del tile base |
| Tile W, Tile H | Dimensiones en tiles (ej: 1×2 para personajes altos) |
| Direcciones | `ninguna`, `4dir` (up/right/down/left), `8dir` (up/upRight/right/downRight/down) |
| Mirror | Left usa flip horizontal de Right (solo si Direcciones ≠ ninguna) |
| Half Block | Renderiza a mitad de altura visual |
| Block Vision | Bloquea la línea de visión (futuro) |
| Half Solid | Solo la mitad inferior es sólida (futuro) |
| Frames | Cantidad de frames de animación |
| Anim Speed | Velocidad de animación en segundos |

### Sistema de capas por entidad

Las entidades pueden tener `layers` que agrupan frames por nombre (idle, walk, etc.). Cada capa tiene sus propios frames y animSpeed. La UI muestra tabs de capa.

### Sistema de frames

- Navegador de frames (anterior/siguiente/agregar/eliminar)
- Duplicación de frame actual
- Vista previa animada en tiempo real
- `spriteToBase64()` genera el canvas con tamaño correcto según tileW/tileH y direcciones

### Undo/Redo

- Sistema basado en snapshots (Ctrl+Z / Ctrl+Shift+Z)
- 50 niveles de historial
- Cada acción de dibujo guarda un snapshot automático

### Preview

- Preview en tamaño real en panel lateral
- Actualización en tiempo real al dibujar
- Frame actual resaltado en la tira de preview

---

## Cortador de Texturas

**Ruta:** `/desarrollo/herramientas/cortador-texturas`
**Archivos:** `public/devtools/cortador-texturas/`

Permite seleccionar rectángulos de una imagen (spritesheet) y guardarlos como entidades con sprite real.

### Carga de imagen

- Drag & drop sobre el área de upload
- Click para seleccionar archivo
- Formatos: PNG, JPG, GIF, WebP

### Canvas interactivo

- Zoom con scroll wheel, botones +/-/Ajustar
- Grid overlay configurable (tamaño y toggle)
- Snap a grilla para selecciones precisas
- Coordenadas del cursor en tiempo real

### Selecciones

- Click-drag para crear rectángulos de selección
- Múltiples selecciones simultáneas, cada una con su propio color
- Arrastrar para reposicionar una selección existente
- Click derecho para eliminar

### Propiedades por selección

Cada selección tiene su propio formulario de propiedades:
- Nombre (se usará como entityId)
- Tipo (tile, character, enemy, item, effect)
- Atlas (mundo, entidades, ui, efectos)
- Sólido
- Tile Size, Tile W, Tile H
- Direcciones, Mirror
- Half Block, Block Vision, Half Solid
- Frames, Anim Speed

### Preview

- Vista previa del sprite recortado en tiempo real
- Muestra dimensiones, tileSize y cantidad de frames
- Escala automática para ajustarse al panel

### Guardado

- Guardar individual o Guardar Todo
- Validación de nombres (sin vacíos, sin duplicados)
- POST a `/api/entidades` con sprite en base64
- Atlas reconstruido automáticamente tras cada guardado

---

## Visor de Atlas

**Ruta:** `/desarrollo/herramientas/visor-atlas`
**Archivos:** `public/devtools/visor-atlas/`

Explorador visual de todos los grupos del atlas multi-atlas.

### Canvas principal

- Carga todos los grupos en canvas apilados verticalmente
- Cada grupo tiene su encabezado con nombre y dimensión
- Recuadros coloreados por entidad con nombre truncado
- Atlas filter: muestra solo un grupo o todos
- Zoom con scroll wheel, botones +/-/Ajustar

### Lista de entidades

- Panel izquierdo con búsqueda/filtro
- Cada entrada muestra: color, nombre, cantidad de frames, grupo (tag), indicador de sprite real/placeholder
- Click para seleccionar y ver detalle

### Panel de detalle

- **Preview animado:** sprite con animación via requestAnimationFrame
- **Selector de dirección:** si la entidad tiene `dirFrames`, permite elegir dirección y muestra mirror
- **Strip de frames:** thumbnails de cada frame, resaltado el activo
- **Propiedades:** tipo, sólido, frames, animSpeed, posición en atlas, tamaño de frame (frameW×frameH), tileW×tileH, direcciones, mirror, halfBlock, sprite real (PNG check)
- **Capas:** si la entidad tiene layers, se listan
- **Botón:** "Editar en Creador de Tiles" para modificar la entidad

### Stats bar

- Cantidad de entidades totales (entre todos los grupos)
- Frames totales
- Dimensiones de cada grupo cargado

---

## Editor de HUD

**Ruta:** `/desarrollo/herramientas/editor-hud`
**Archivos:** `public/devtools/editor-hud/`

Herramienta visual para diseñar interfaces de usuario (Heads-Up Display).

### Canvas de edición

- Lienzo del tamaño del HUD configurable
- Grid overlay para alinear elementos
- Vista previa en tiempo real

### Elementos del HUD

| Tipo | Descripción |
|------|-------------|
| Barra | Barra horizontal/vertical con color de fondo y de relleno |
| Texto | Texto estático o dinámico (bindings a variables del jugador) |
| Sprite | Imagen del atlas con soporte multi-atlas |
| Icono | Icono simple con posición y tamaño |

### Propiedades de elementos

- Posición (X, Y), tamaño (W, H)
- Color, opacidad
- Binding a variable del jugador (HP, MP, etc.)
- Atlas y sprite para elementos gráficos
- Orden Z (capas)

### Multi-Atlas

Carga todos los grupos del atlas mediante `loadAtlasInfo()`. El selector de sprite muestra etiquetas `[atlasName]` para identificar el grupo de cada entidad. `drawImage()` usa `atlasImages[s.atlasName]` para obtener la imagen correcta.

### Persistencia

- Guardado via `POST /api/hud` con nombre y datos JSON
- Lista de HUDs guardados con carga para edición
- Eliminación de HUDs existentes

---

## API REST Compartida

Todas las herramientas usan los siguientes endpoints comunes:

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/entidades` | GET | Listar entidades registradas |
| `/api/entidades` | POST | Crear/actualizar entidad + sprite base64 + reconstruir atlas |
| `/api/entidades/{id}` | DELETE | Eliminar entidad + reconstruir atlas |
| `/api/atlas/rebuild` | POST | Forzar reconstrucción del atlas |
| `/api/mapas` | GET | Listar mapas disponibles |
| `/api/mapas` | POST | Guardar mapa |
| `/api/mapas/{name}` | DELETE | Eliminar mapa |
| `/api/hud` | GET | Listar/configuraciones de HUD |
| `/api/hud` | POST | Guardar configuración de HUD |
| `/api/hud/{name}` | DELETE | Eliminar configuración de HUD |
