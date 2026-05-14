# 🛡️ Proyecto Tierra Media (MMO Descentralizado)

Un experimento técnico para crear un RPG MMO descentralizado donde cada servidor actúa como un nodo independiente que representa una parte del mapa global.

## 🌌 El Concepto: Red de Nodos
A diferencia de los MMO tradicionales, este proyecto busca la descentralización. Cada instancia ejecutada por un usuario funciona como un **nodo** de la red. La unión de estos nodos conformará el mundo completo de la Tierra Media.

*   **Arquitectura**: P2P / Descentralizada (cada servidor es una parte del mapa).
*    **Objetivo Inicial**: Crear la base técnica: movimiento, interacción con objetos, NPCs y gestión de atlas de tiles/sprites.

## 🎮 Experiencia de Juego
*   **Motor Gráfico**: Renderizado 2D con técnica de **Raycasting** (estilo *Wolfenstein 3D*) implementado íntegramente en **Vanilla JavaScript**.
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
*   **Gráficos**: Engine de Raycasting propio.

## 📅 Roadmap / Próximos Hitos
- [x] Estructura de carpetas inicial y servidor base.
- [ ] **Hito 1: El Núcleo**: Implementación de plantilla de personaje, movimiento básico y sistema de gestión de Atlas (Tiles & Sprites).
- [ ] **Hito 2: Interacción**: Creación de objetos básicos y NPCs con IA simple.
- [ ] **Hito 3: Atributos**: Sistema de estadísticas (HP, MP, STR, INT) e inventario.
- [ ] **Hito 4: Herramientas**: Lanzamiento de la subpágina de desarrolladores con editor de mapas.
