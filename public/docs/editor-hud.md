# Editor de HUD

**Ruta:** `/desarrollo/herramientas/editor-hud`
**Archivos:** `public/devtools/editor-hud/`

Herramienta visual para diseñar y editar Heads-Up Displays del juego. Soporta tipos de elemento como barra de HP, texto con bindings, minimapa, slots de inventario, imágenes del atlas y log de mensajes.

## Interfaz

Panel de 3 columnas:

**Izquierda — Paleta y Lista:**
- 6 tipos de elemento arrastrables: Barra, Texto, Minimapa, Slot Inv., Imagen, Mensajes
- Lista de elementos del HUD actual con nombre/tipo y botón de delete
- Click en un elemento de la lista para seleccionarlo

**Centro — Canvas de edición:**
- Lienzo del tamaño de la resolución seleccionada (640×480, 800×600, 1024×768)
- Grid overlay toggle
- Elementos renderizados en tiempo real
- Arrastrar elementos para reposicionarlos
- Redimensionar elementos desde bordes y esquinas
- Regla informativa con coordenadas

**Derecha — Propiedades y acciones:**
- Formulario dinámico según el tipo de elemento seleccionado
- Botones Duplicar / Eliminar elemento
- Acciones de HUD: Nuevo, Abrir, Guardar, Exportar JSON, Eliminar HUD

## Tipos de Elemento

| Tipo | Descripción | Propiedades específicas |
|------|-------------|------------------------|
| **Barra** | Barra horizontal o vertical con color de fondo y de relleno | label, showLabel, labelPosition, bgColor, fillColor, borderColor, valueRef, maxRef, direction |
| **Texto** | Texto estático o dinámico con bindings | text (soporta `{player.level}`, `{player.hp}`, etc.), font, spriteFont, color, fontSize |
| **Minimapa** | Mapa en miniatura del nivel | scale, borderColor |
| **Slot Inv.** | Slot individual de inventario | slot (índice), bgColor, borderColor |
| **Imagen** | Sprite del atlas multi-atlas | entityId (selector con tag `[atlasName]`), bgColor |
| **Mensajes** | Log de mensajes del juego | maxMessages, bgColor, borderColor, textColor |

## Propiedades Comunes

Todos los elementos comparten:
- Posición (x, y), tamaño (width, height)
- Visibilidad (visible)
- Orden Z (se controla mediante reordenamiento en lista)

## Bindings de Texto

El elemento Texto soporta variables dinámicas con sintaxis `{ruta.variable}`:
- `{player.hp}`, `{player.maxHp}`
- `{player.mp}`, `{player.maxMp}`
- `{player.xp}`, `{player.level}`
- `{player.name}`
- `{inventory.gold}`

## Canvas Interactivo

- Arrastrar: click y mover para reposicionar
- Redimensionar: bordes y esquinas del elemento seleccionado
- Zoom: − / + (0.5× a 4×)
- Vista previa con resolución seleccionable
- Grid overlay para alineación

## Multi-Atlas

`loadAtlasInfo()` carga los 4 grupos (`mundo`, `entidades`, `ui`, `efectos`). Para elementos Imagen, el selector de sprite muestra `[atlasName]` como tag. `drawImage()` usa `atlasImages[s.atlasName]` para renderizar el sprite correcto.

## Persistencia

| Acción | Descripción |
|--------|-------------|
| Nuevo | Modal para crear HUD con nombre y resolución |
| Abrir | Modal con lista de HUDs guardados, click para cargar |
| Guardar | POST a `/api/hud` con nombre y datos JSON |
| Exportar JSON | Descarga el HUD como archivo .json |
| Eliminar | DELETE a `/api/hud/{name}` (con confirmación) |

## API

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/hud` | Listar configuraciones de HUD |
| POST | `/api/hud` | Guardar/actualizar HUD |
| DELETE | `/api/hud/{name}` | Eliminar HUD |
| GET | `/api/entidades` | Obtener sprites para elementos Imagen |
