// Punto de entrada del motor de juego.
// Inicializa el renderer y arranca el bucle principal.

const canvas = document.getElementById('gameCanvas');

Renderer.init(canvas);

let lastTime = 0;
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;

// Bucle principal: se ejecuta una vez por frame (sincronizado con el monitor).
function gameLoop(timestamp) {
  // Delta time en segundos, capado a 50ms para evitar picos (ej. al cambiar de pestaña).
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // Contador de FPS (se actualiza cada segundo).
  fpsTimer += dt;
  frameCount++;
  if (fpsTimer >= 1) {
    fps = frameCount;
    frameCount = 0;
    fpsTimer = 0;
  }

  // Actualizar estado del juego y renderizar.
  Player.update(dt);
  Renderer.render(Player);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
