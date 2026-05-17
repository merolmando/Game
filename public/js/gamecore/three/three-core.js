const Game3D = {
  lastTime: 0,
  fps: 0,
  frameCount: 0,
  fpsTimer: 0,

  async init() {
    Scene3D.init();

    let startMap = '/maps/inicio.json';
    try {
      const res = await fetch('/api/mapas/default');
      if (res.ok) {
        const config = await res.json();
        if (config.defaultMap) startMap = '/maps/' + config.defaultMap + '.json';
      }
    } catch {}

    await GameMap.load(startMap);
    Player.x = GameMap.current.playerStart.x;
    Player.y = GameMap.current.playerStart.y;
    ChunkManager.buildFromMap(GameMap.current);
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  },

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.fpsTimer += dt;
    this.frameCount++;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this._update(dt);
    Scene3D.updateCamera();
    ChunkManager.update(Scene3D.camera);
    Scene3D.render();

    document.getElementById('hud-fps').textContent = 'FPS: ' + this.fps;
    document.getElementById('hud-pos').textContent =
      'Pos: ' + Player.x.toFixed(2) + ', ' + Player.y.toFixed(2);

    requestAnimationFrame((t) => this._loop(t));
  },

  _update(dt) {
    if (!Scene3D.locked) return;

    const speed = Player.moveSpeed * dt;
    const forward = Scene3D.getForward();
    const right = Scene3D.getRight();

    let dx = 0, dz = 0;

    if (Input.isForward()) { dx += forward.x; dz += forward.z; }
    if (Input.isBackward()) { dx -= forward.x; dz -= forward.z; }
    if (Input.isStrafeLeft()) { dx -= right.x; dz -= right.z; }
    if (Input.isStrafeRight()) { dx += right.x; dz += right.z; }

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;
      Player.move(dx, dz);
    }

    const exit = GameMap.checkExits(Player.x, Player.y);
    if (exit) {
      if (exit.target) {
        GameMap.load(exit.target).then(() => {
          Player.x = exit.spawnX || GameMap.current.playerStart.x;
          Player.y = exit.spawnY || GameMap.current.playerStart.y;
        });
      }
    }
  },
};

Game3D.init().catch(err => {
  console.error('Error al iniciar juego 3D:', err);
  document.body.innerHTML = '<div style="color:#f85149;padding:2rem;text-align:center">' +
    '<h1>Error al cargar el juego 3D</h1><p>' + err.message + '</p></div>';
});
