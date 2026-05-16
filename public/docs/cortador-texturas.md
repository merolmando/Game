# Cortador de Texturas

**Ruta:** `/desarrollo/herramientas/cortador-texturas`
**Archivos:** `public/devtools/cortador-texturas/`

Herramienta para extraer sprites de un spritesheet (PNG/JPG/GIF/WebP) mediante selecciones rectangulares. Cada selección se convierte en una entidad con su sprite recortado y propiedades configurables.

## Interfaz

Panel de 3 columnas:

**Izquierda — Imagen y Entidades:**
- Drop zone: arrastrar imagen o click para seleccionar archivo
- Info de imagen cargada (dimensiones, nombre de archivo)
- Lista de entidades existentes (para referencia)

**Centro — Canvas interactivo:**
- Imagen cargada con zoom ajustable (− / + / Ajustar)
- Grid overlay configurable (toggle + tamaño de grilla)
- Snap a grilla para selecciones precisas (toggle)
- Coordenadas del cursor en tiempo real

**Derecha — Selecciones, Propiedades, Preview:**
- Lista de selecciones con cada nombre y dimensión
- Formulario de propiedades para la selección activa
- Preview del sprite recortado en tiempo real
- Botones Guardar / Eliminar por selección, Guardar Todo

## Creación de Selecciones

- Click-drag sobre la imagen para crear un rectángulo de selección
- Snap a grilla si está activado (redondea coordenadas al múltiplo más cercano de gridSize)
- Múltiples selecciones simultáneas, cada una con color distintivo
- La selección activa se muestra con borde blanco + línea punteada azul + manijas
- Arrastrar para reposicionar una selección existente (click sobre el rectángulo)
- Click derecho para eliminar selección

## Propiedades por Selección

| Campo | Descripción |
|-------|-------------|
| Nombre | ID único de la entidad (validado sin vacíos ni duplicados) |
| Tipo | tile, character, enemy, item, effect |
| Atlas | mundo, entidades, ui, efectos |
| Sólido | Colisionable o no |
| Tile Size | Tamaño en píxeles del tile base (por defecto 32) |
| Tile W, Tile H | Dimensiones en tiles |
| Direcciones | none, 4dir, 8dir |
| Mirror | Espejar left usando right |
| Half Block | Render a mitad de altura visual |
| Block Vision | Bloquea línea de visión |
| Half Solid | Mitad inferior sólida |
| Frames | Cantidad de frames (automático según tileW si el sprite es horizontal) |
| Anim Speed | Velocidad de animación en segundos |

## Preview

- Vista previa del sprite recortado a tamaño real
- Muestra dimensiones (ancho × alto píxeles) y tileSize
- Escala automática para ajustarse al panel derecho

## Guardado

- **Guardar:** POST individual a `/api/entidades` con sprite base64
- **Guardar Todo:** Guarda todas las selecciones en secuencia, validando nombres
- **Eliminar:** Elimina selección del listado (sin afectar el servidor)
- Tras cada guardado el servidor reconstruye el atlas automáticamente
- Feedback visual con fade out en status bar

## Atajos

| Acción | Input |
|--------|-------|
| Zoom | Scroll wheel o botones +/-/Ajustar |
| Snap | Checkbox toggle |
| Grid | Checkbox toggle + input numérico de tamaño |
| Crear selección | Click-drag sobre la imagen |
| Reposicionar | Arrastrar selección existente |
| Eliminar | Click derecho sobre selección |
