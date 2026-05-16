# Inspector de Mapas

**Ruta:** `/desarrollo/herramientas/inspector-mapa`
**Archivos:** `public/devtools/inspector-mapa/`

Editor visual de mapas JSON con soporte multi-atlas, capas, exits y edición de personajes.

## Interfaz

Panel de 3 columnas:

**Izquierda — Paleta:** Grid de tiles del atlas multi-atlas. Cada tile muestra su thumbnail con sprite real y el ID numérico. Click para seleccionar.

**Centro — Canvas:** Lienzo del mapa con zoom (0.25x–8x). Pinta y borra tiles con click. Debajo: tabs de capas (Estructura, Terreno, Objetos, Personajes, Enemigos, Eventos, Cielo) y checkbox "Show sky".

**Derecha — Propiedades:** Muestra el tile bajo el cursor (ID, nombre, entityId, color por capa). Lista de exits con tarjetas editables. Selector de mapa por defecto.

## Capas

| Capa | Descripción |
|------|-------------|
| Estructura | Paredes y tiles sólidos. El raycaster usa `isWall()` sobre esta capa |
| Terreno | Suelo/base. Tiles colisionables como agua bloquean al jugador |
| Objetos | Sprites billboard (muebles, decoraciones) |
| Personajes | Entidades con `entityId`, posición flotante y dirección |
| Enemigos | Similar a personajes, renderizados como círculos rojos |
| Eventos | Metadatos por tile (futuro) |
| Cielo | Configuración de color de cielo |

## Controles

- **Click izquierdo:** pintar tile seleccionado
- **Click derecho:** borrar tile (ID 0 = vacío)
- **Click+arrastre:** pintar tiles en trayectoria
- **Doble click:** editar exit / personaje en ese tile
- **Zoom:** scroll wheel o botones +/-/Ajustar
- **Atajos numéricos 1-9:** seleccionar tile de paleta

## Exits

Cada salida tiene:
- Tile de activación (posición en el mapa)
- Mapa destino y coordenadas de spawn
- Dirección visual (↑↓←→)
- Nombre de etiqueta
- Lock (requiere llave)
- Conexión ID (resuelve automáticamente el destino desde otro mapa)

## Personajes y Enemigos

Modal de edición con:
- Selector de entidad filtrado por `type: "character"`
- Selector de dirección (auto-populado desde `dirFrames` del sprite)
- Posición X/Y flotante
- Renderizado en canvas: círculo azul/rojo + flecha direccional + etiqueta + coordenadas

## API

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/mapas` | Listar mapas |
| POST | `/api/mapas` | Guardar mapa |
| DELETE | `/api/mapas/{name}` | Eliminar mapa |
| GET | `/api/mapas/default` | Obtener mapa inicial |
| POST | `/api/mapas/default` | Configurar mapa inicial |
| GET | `/api/mapas/resolve-label?label={label}` | Resolver conexión ID a mapa/destino |

## Arquitectura Multi-Atlas

Carga los 4 grupos (`mundo`, `entidades`, `ui`, `efectos`) en paralelo. Cada grupo tiene su propia imagen en `atlasImages[nombre]`. La paleta se construye unificando todos los sprites de todos los grupos con su `atlasName`.
