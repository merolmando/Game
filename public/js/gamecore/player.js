const Player = {
  // Posición en el mapa (coordenadas float, tiles de 1x1).
  x: 2.5,
  y: 2.5,
  // Vector dirección para modo raycaster.
  dirX: 1,
  dirY: 0,
  planeX: 0,
  planeY: 0.66,
  // Dirección facial para modo 2D.
  facingX: 0,
  facingY: -1,
  // Velocidades.
  moveSpeed: 3.0,
  rotSpeed: 2.0,
  // Estadísticas.
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  str: 10,
  int: 10,
  level: 1,
  // Protección al spawn: no se checkean exits durante este tiempo.
  spawnTimer: 0,
  // Keys que el jugador ha recolectado (para puertas bloqueadas).
  keys: [],
  hasKey(keyId) { return this.keys.includes(keyId); },
  // Animación de bob (oscilación al caminar).
  bobPhase: 0,
  bobOffset: 0,
  moving: false,

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
  move(dx, dy) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!Map.isSolid(nx, this.y)) this.x = nx;
    if (!Map.isSolid(this.x, ny)) this.y = ny;
  },

  update(dt) {
    const mode = Map.current ? Map.current.mode : 'ray';

    if (mode === '2d') {
      this.update2D(dt);
    } else {
      this.updateRay(dt);
    }
  },

  updateRay(dt) {
    const move = this.moveSpeed * dt;
    const rot = this.rotSpeed * dt;

    if (Input.isLeft()) this.rotate(-rot);
    if (Input.isRight()) this.rotate(rot);

    this.moving = false;
    if (Input.isForward()) { this.move(this.dirX * move, this.dirY * move); this.moving = true; }
    if (Input.isBackward()) { this.move(-this.dirX * move, -this.dirY * move); this.moving = true; }
    if (Input.isStrafeLeft()) { this.move(-this.dirY * move, this.dirX * move); this.moving = true; }
    if (Input.isStrafeRight()) { this.move(this.dirY * move, -this.dirX * move); this.moving = true; }
  },

  update2D(dt) {
    const move = this.moveSpeed * dt;
    let dx = 0;
    let dy = 0;

    if (Input.isForward()) dy = -1;
    if (Input.isBackward()) dy = 1;
    if (Input.isLeft()) dx = -1;
    if (Input.isRight()) dx = 1;

    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      const len = dx !== 0 && dy !== 0 ? 0.7071 : 1;
      if (dx !== 0) { this.facingX = dx; this.facingY = 0; }
      else { this.facingY = dy; this.facingX = 0; }
      this.move(dx * move * len, dy * move * len);
      this.bobPhase += dt * 8;
    } else {
      if (this.bobPhase > 0) this.bobPhase = Math.max(0, this.bobPhase - dt * 6);
    }

    this.bobOffset = Math.sin(this.bobPhase) * 2;
  },
};
