# Game Project — Agent Instructions

## Communication
- Directo y conciso, máximo 3-4 líneas de texto
- Sin emojis a menos que el usuario los use
- Sin preámbulos ni resúmenes del código escrito
- Sin explicaciones de lo que se hizo después de ejecutar comandos
- Una palabra o línea si es suficiente

## Code Style
- Nombres de variables, funciones y archivos en INGLÉS
- Código sin comentarios inline
- JSDoc solo en la firma de funciones públicas (parámetros y retorno)
- Documentación detallada de API en README.md, NO en los .js
- Vanilla JS sin frameworks, sin dependencias externas

## Architecture
- 50/50: 2D top-down + Raycasting pseudo-3D
- Server: Node.js http nativo (src/)
- Game engine: 8 módulos en public/js/gamecore/
- Mapas como JSON en public/maps/ con mode, tileColors, exits
- 5 views HTML en views/ con server-side routing

## GameCore Engine Rules
- Transition sincroniza carga async con .then() (nunca await en gameLoop)
- Player.spawnTimer = 0.3s al cargar mapa (evita re-disparo de exits)
- Exits en rutas absolutas (/maps/...)
- Camera plane dinámico: -dirY*0.66, dirX*0.66
- Facing 2D prioriza horizontal sobre vertical
- render() retorna temprano si Map.current === null

## Commits
- Commits atómicos: un commit por feature completa
- Mensajes en español, cortos, descriptivos

## Project Structure
```
/Game
├── public/
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js
│   │   └── gamecore/
│   │       ├── core.js
│   │       ├── input.js
│   │       ├── map.js
│   │       ├── player.js
│   │       ├── camera.js
│   │       ├── raycaster.js
│   │       ├── renderer.js
│   │       └── sprite.js
│   ├── img/
│   └── maps/
│       ├── inicio.json
│       ├── cueva.json
│       └── COLORES.md
├── src/server.js
├── views/   (6 HTML: index, juego, desarrollo, devlog, hitos, docs)
└── README.md
```

## Architecture
- 50/50 hybrid: 2D top-down + Raycasting pseudo-3D
- Everything in Vanilla JS, zero external dependencies
- Maps are self-contained JSON files with mode, tileColors, exits
- Game loop uses requestAnimationFrame with delta time
- Decentralized MMO architecture (each server instance = node)
- README and docs rendered client-side via custom markdown parser
