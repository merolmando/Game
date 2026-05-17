# Herramientas de Desarrollo (DevTools)

El proyecto incluye 5 herramientas visuales para la creación de contenido. Comparten estilos base via `devtools-base.css` y se sirven desde rutas `/desarrollo/herramientas/{tool}`.

---

## [Inspector de Mapas](inspector-mapa.md)

Editor visual de mapas JSON con capas, exits, personajes y soporte multi-atlas. Permite pintar tiles sobre un grid 2D con vista previa en tiempo real.

**Ruta:** `/desarrollo/herramientas/inspector-mapa`

## [Creador de Tiles](creador-tiles.md)

Editor de pixel-art para crear sprites desde cero. Soporta animación multi-frame, capas por estado (idle, walk, etc.) y exportación a entidades.

**Ruta:** `/desarrollo/herramientas/creador-tiles`

## [Cortador de Texturas](cortador-texturas.md)

Extrae sprites de un spritesheet mediante selecciones rectangulares. Cada selección se convierte en entidad con sprite recortado y propiedades.

**Ruta:** `/desarrollo/herramientas/cortador-texturas`

## [Visor de Atlas](visor-atlas.md)

Explorador visual multi-atlas para inspeccionar todas las entidades con su sprite animado, propiedades y metadatos.

**Ruta:** `/desarrollo/herramientas/visor-atlas`

## [Editor de HUD](editor-hud.md)

Editor visual de Heads-Up Displays con elementos como barra de HP, texto con bindings, minimapa, slots de inventario y más.

**Ruta:** `/desarrollo/herramientas/editor-hud`

---

## API REST Compartida

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/entidades` | GET | Listar entidades registradas |
| `/api/entidades` | POST | Crear/actualizar entidad + sprite base64 + reconstruir atlas |
| `/api/entidades/{id}` | DELETE | Eliminar entidad + reconstruir atlas |
| `/api/atlas/rebuild` | POST | Forzar reconstrucción del atlas |
| `/api/mapas` | GET | Listar mapas disponibles |
| `/api/mapas` | POST | Guardar mapa |
| `/api/mapas/{name}` | DELETE | Eliminar mapa |
| `/api/mapas/{name}/recompute-lightmap` | POST | Regenerar lightmap del mapa (rebotes configurables vía `lightBounces`) |
| `/api/mapas/default` | GET | Obtener mapa inicial |
| `/api/mapas/default` | POST | Configurar mapa inicial |
| `/api/hud` | GET | Listar configuraciones de HUD |
| `/api/hud` | POST | Guardar configuración de HUD |
| `/api/hud/{name}` | DELETE | Eliminar configuración de HUD |

## Arquitectura Multi-Atlas

Las herramientas cargan los 4 grupos del atlas (`mundo`, `entidades`, `ui`, `efectos`). Cada grupo tiene:
- `atlas_{name}.json` — metadatos con sprites, entityOrder, tamaños
- `atlas_{name}.png` — imagen compilada del atlas

Los grupos se cargan en paralelo via `Promise.all()`. Cada sprite referencia su grupo mediante `atlasName`.
