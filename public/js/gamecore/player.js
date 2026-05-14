const Player = {
  // Posición en el mapa (coordenadas float, tiles de 1x1).
  x: 2.5,
  y: 2.5,
  // Vector dirección (hacia dónde mira el jugador).
  dirX: 1,
  dirY: 0,
  // Vector del plano de la cámara (perpendicular a dir, define el FOV).
  planeX: 0,
  planeY: 0.66,
  // Velocidades de movimiento y rotación por segundo.
  moveSpeed: 3.0,
  rotSpeed: 2.0,
  // Estadísticas del jugador (vida, maná, atributos).
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  str: 10,
  int: 10,
  level: 1,

  // Rota el vector dirección y el plano de cámara usando matriz de rotación.
  rotate(angle) {
    const { dirX, dirY, planeX, planeY } = this;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.dirX = dirX * cos - dirY * sin;
    this.dirY = dirX * sin + dirY * cos;
    this.planeX = planeX * cos - planeY * sin;
    this.planeY = planeX * sin + planeY * cos;
  },

  // Mueve al jugador comprobando colisiones por separado en X e Y.
  // Esto permite deslizarse por las paredes en lugar de quedarse pegado.
  move(dx, dy) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!Map.isSolid(nx, this.y)) this.x = nx;
    if (!Map.isSolid(this.x, ny)) this.y = ny;
  },

  // Procesa input y actualiza posición/rotación cada frame.
  update(dt) {
    const move = this.moveSpeed * dt;
    const rot = this.rotSpeed * dt;

    if (Input.isLeft()) this.rotate(-rot);
    if (Input.isRight()) this.rotate(rot);

    if (Input.isForward()) {
      this.move(this.dirX * move, this.dirY * move);
    }
    if (Input.isBackward()) {
      this.move(-this.dirX * move, -this.dirY * move);
    }
    if (Input.isStrafeLeft()) {
      this.move(-this.dirY * move, this.dirX * move);
    }
    if (Input.isStrafeRight()) {
      this.move(this.dirY * move, -this.dirX * move);
    }
  },
};
