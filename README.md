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
- [x] **Motor GameCore**: Game loop, input, cámara 2D, raycaster DDA, renderer dual-mode (2D + ray), sistema de capas (cielo/terreno/mundo/personajes/eventos).
- [x] **Atlas de sprites**: Sistema auto-generado desde `public/entidades/` con 5 entidades (player, pasto, pared_piedra, puerta, agua). Render texturizado en modo ray y 2D.
- [x] **Mapas**: `inicio.json` (modo 2D) y `cueva.json` (modo ray) con capas y tile IDs donde 0 = vacío.
- [x] **Transiciones**: Fade out/in entre mapas con carga asíncrona.
- [x] **API REST**: Endpoints para CRUD de entidades (`/api/entidades`) y mapas (`/api/mapas`) con persistencia en servidor y reconstrucción automática del atlas.
- [x] **Creador de Tiles**: Editor pixel-art en `/desarrollo/herramientas/creador-tiles` con pincel, goma, bote, gotero, línea, rectángulo, undo/redo, soporte multi-frame, capas por entidad, preview en vivo y guardado directo al servidor.
- [x] **Cortador de Spritesheets**: Herramienta en `/desarrollo/herramientas/cortador-texturas` que permite seleccionar rectángulos de una imagen subida, nombrarlos y guardarlos como entidades con sprite real. Snap a grilla, preview, Guardar Todo.
- [x] **Inspector de Mapas**: Editor visual de mapas con paleta de tiles del atlas (thumbnails con sprite real), pintado con sprites en vez de colores sólidos, persistencia via API REST. Disponible en `/desarrollo/herramientas/inspector-mapa`.
- [x] **Herramientas**: 4 herramientas integradas (inspector-mapa, creador-tiles, cortador-texturas, visor-atlas) con estilos base compartidos via `devtools-base.css`. Endpoints API REST para persistencia de entidades y mapas.

## 📅 Próximos Hitos
- [ ] **Hito 2: Interacción**: Creación de objetos básicos y NPCs con IA simple.
- [ ] **Hito 3: Atributos**: Sistema de estadísticas (HP, MP, STR, INT) e inventario.
