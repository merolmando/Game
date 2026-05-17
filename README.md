# 🛡️ Proyecto Tierra Media (MMO Descentralizado)

Un experimento técnico para crear un RPG MMO descentralizado donde cada servidor actúa como un nodo independiente que representa una parte del mapa global.

## 🌌 El Concepto: Red de Nodos
A diferencia de los MMO tradicionales, este proyecto busca la descentralización. Cada instancia ejecutada por un usuario funciona como un **nodo** de la red. La unión de estos nodos conformará el mundo completo de la Tierra Media.

*   **Arquitectura**: P2P / Descentralizada (cada servidor es una parte del mapa).
*    **Objetivo Inicial**: Crear la base técnica: movimiento, interacción con objetos, NPCs y gestión de atlas de tiles/sprites.

## 🎮 Experiencia de Juego
*   **Motor Gráfico**: Híbrido **50% 2D top-down + 50% Raycasting pseudo-3D**. Mapas JSON definen el modo por instancia. Implementado íntegramente en **Vanilla JavaScript**.
*   **Mecánicas Core**: 
    *   Sistema de movimiento y colisiones.
    *   Gestión de estados: Vida (HP), Maná (MP) y Estadísticas (Fuerza, Inteligencia, etc.).
    *   Sistema de Inventario.
    *   Persistencia de progreso del jugador.

## 🛠️ Ecosistema Web & Desarrollo
El sitio se divide en dos grandes vertientes:

### 🌐 Vista Pública (Exploración y Juego)
*   **Inicio**: Presentación del proyecto y estado actual.
*   **Juego**: Acceso directo al motor de Raycasting para jugar en local o LAN.
*   **Devlog**: Diario cronológico documentado con cada cambio importante en el desarrollo.
*   **Hitos**: Línea de tiempo de las etapas alcanzadas.

### 👨‍💻 Vista de Desarrolladores (Herramientas)
*   **Documentación Técnica**: Plan de desarrollo detallado para colaboradores.
*   **DevTools**: Herramientas integradas para la creación de mapas, edición de variables y gestión de tiles/sprites.

## 🚀 Tecnologías
*   **Backend**: Node.js (Evolucionando hacia Express.js).
*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (Sin frameworks externos).
*   **Gráficos**: Engine híbrido 2D top-down + Raycasting con mapas JSON autocontenidos.

## ✅ Estado Actual
- [x] **Servidor base** con rutas, assets y vistas.
- [x] **Motor GameCore**: Game loop, input, cámara 2D, raycaster DDA, renderer dual-mode (2D + ray), sistema de capas (cielo/terreno/estructura/objetos).
- [x] **Atlas de sprites**: Sistema auto-generado desde `public/entidades/` con 8 entidades (player, pasto, pared_piedra, puerta, agua, pasto_con_baldosas, pasto_con_hierbas, pasto_sencillo). Render texturizado en modo ray y 2D.
- [x] **Mapas**: `inicio.json` (modo 2D) y `cueva.json`, `bosque_inicial.json` (modo ray) con sistema de capas.
- [x] **Transiciones**: Fade out/in entre mapas con carga asíncrona.
- [x] **Colisión circular**: Jugador y NPCs con radio 0.5 (1 tile de diámetro). Colisión por separado en ejes X/Y para sliding. Detección círculo vs tile con distancia al rectángulo más cercano. Colisión jugador↔NPC por distancia entre centros.
- [x] **Piso texturizado**: Floor-casting con texturas reales del atlas (pasto, pasto_con_baldosas, etc.) con perspectiva correcta. Fallback a color sólido si no hay atlas.
- [x] **Sistema de capas separado**: `estructura` para paredes (sólidas, raycaster), `terreno` para piso/base con tiles colisionables (agua). `isWall()` y `isSolid()` separados.
- [x] **API REST**: Endpoints para CRUD de entidades (`/api/entidades`) y mapas (`/api/mapas`) con persistencia en servidor y reconstrucción automática del atlas.
- [x] **Creador de Tiles**: Editor pixel-art en `/desarrollo/herramientas/creador-tiles` con pincel, goma, bote, gotero, línea, rectángulo, undo/redo, soporte multi-frame, capas por entidad, preview en vivo y guardado directo al servidor.
- [x] **Cortador de Spritesheets**: Herramienta en `/desarrollo/herramientas/cortador-texturas` que permite seleccionar rectángulos de una imagen subida, nombrarlos y guardarlos como entidades con sprite real. Snap a grilla, preview, Guardar Todo.
- [x] **Inspector de Mapas**: Editor visual de mapas con paleta de tiles del atlas (thumbnails con sprite real), pintado con sprites en vez de colores sólidos, persistencia via API REST. Disponible en `/desarrollo/herramientas/inspector-mapa`.
- [x] **Multi-atlas**: Migración a múltiples atlas por categoría (`atlas_mundo.png`, `atlas_entidades.png`, `atlas_ui.png`). `build-atlas.js` agrupa entidades por campo `atlas` y genera PNG+JSON por grupo. `sprite.js` con búsqueda cross-atlas y getters backward-compatibles.
- [x] **Sistema de direcciones**: Entidades con `4dir` / `8dir` y layout en spritesheet (3/5 bloques de frames). Mirror automático (flip horizontal). `dirFrames` en atlas JSON.
- [x] **TileW/TileH**: Entidades declaran tamaño en tiles. `frameW = tileW * tileSize`, `frameH = tileH * tileSize`. `halfBlock` renderiza a mitad de altura (raycaster y 2D). `raycaster.js` `_addBillboard` usa tileW/tileH. `renderer.js` usa frameW/frameH.
- [x] **5 DevTools adaptadas a multi-atlas**: visor-atlas (canvas apilados, selector de atlas, detalle con dirFrames, dirección en preview), inspector-mapa (loadAtlases multi-grupo, selector de dirección en personajes), creador-tiles (campos tileW/tileH/directions/halfBlock guardados, spriteToBase64 multi-dir), cortador-texturas (campos tileW/tileH/directions/halfBlock en selecciones), editor-hud (loadAtlasInfo multi-grupo, atlas tags).
- [x] **halfBlock en renderer 2D**: drawLayer y draw2D reducen altura a la mitad para player, characters y enemies.
- [x] **Motor 3D (Three.js)**: Nueva ruta `/juego3d` con escena WebGL, PointerLock, mouse look (yaw+pitch), WASD con colisión reusada.
- [x] **Sistema de Chunks 8×8**: División del mapa en chunks de 8×8 tiles. Cada chunk genera un BufferGeometry con vóxeles (terreno en y=-1, estructura en y=0). Vertex colors desde `tileColors`. Culling de caras ocultas entre vóxeles adyacentes.
- [x] **Frustum Culling**: Solo se renderizan los chunks dentro del cono de visión de la cámara.
- [x] **LOD 3 niveles por chunk**: LOD0 (detalle completo, merged voxels), LOD1 (merge 2×2 del mismo tileId en cajas más grandes, fallback a 1×1 para bloques no uniformes), LOD2 (caja única con color promedio del chunk). Selección por distancia: 0–15, 15–30, 30+.
- [x] **Sprites Billboard (Three.js)**: Extracción de sprites del atlas a `THREE.Sprite` con texturas recortadas a `CanvasTexture`. Soporte para capas `objetos`, `characters`, `enemies`, `exits`. Animación multi-frame (`animSpeed`). `halfBlock` para sprites de media altura (arbustos).
- [x] **Fade transitions + HUD**: Transición fade in/out al cambiar de mapa (CSS overlay 300ms). HUD HTML con barras de HP/MP, nivel, crosshair, indicador de proximidad a exits. Nombre del mapa al entrar.

## 📅 Próximos Hitos
- [ ] **Hito 2: Interacción**: Creación de objetos básicos y NPCs con IA simple.
- [ ] **Hito 3: Atributos**: Sistema de estadísticas (HP, MP, STR, INT) e inventario.
- [x] **Fase 3 (Three.js)**: Sprites billboard del atlas para árboles, objetos, NPCs y enemigos.
- [x] **Fase 4 (Three.js)**: LOD 3 niveles por chunk (detalle → merge 2×2 → caja única).
- [x] **Fase 5 (Three.js)**: Exits con fade, HUD overlay, pulido final.
