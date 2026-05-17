const Game3D = {
  lastTime: 0,
  fps: 0,
  frameCount: 0,
  fpsTimer: 0,
  _fading: false,
  _loaded: false,

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
    await ChunkManager.buildFromMap(GameMap.current);
    await SpriteManager.build(GameMap.current);
    this._showMapName(GameMap.current.name || '');
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

    if (!this._fading) {
      this._update(dt);
    }
    Scene3D.updateCamera();
    ChunkManager.update(Scene3D.camera);
    SpriteManager.update(dt);
    Scene3D.render();

    try {
      document.getElementById('hud-fps').textContent = 'FPS: ' + this.fps;
      document.getElementById('hud-pos').textContent =
        'Pos: ' + Player.x.toFixed(2) + ', ' + Player.y.toFixed(2);

      const hpPct = (Player.hp / Player.maxHp * 100).toFixed(1);
      const mpPct = (Player.mp / Player.maxMp * 100).toFixed(1);
      document.getElementById('hp-fill').style.width = hpPct + '%';
      document.getElementById('mp-fill').style.width = mpPct + '%';
      document.getElementById('hp-text').textContent = Player.hp + '/' + Player.maxHp;
      document.getElementById('mp-text').textContent = Player.mp + '/' + Player.maxMp;
      document.getElementById('hud-level').textContent = 'Nivel ' + Player.level;
    } catch (e) {
      if (!this._hudWarned) { console.warn('HUD error:', e); this._hudWarned = true; }
    }

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
        this._fadeOut().then(() => {
          return GameMap.load(exit.target);
        }).then(async () => {
          Player.x = exit.spawnX || GameMap.current.playerStart.x;
          Player.y = exit.spawnY || GameMap.current.playerStart.y;
          await ChunkManager.buildFromMap(GameMap.current);
          await SpriteManager.build(GameMap.current);
          this._showMapName(GameMap.current.name || '');
          this._fadeIn();
        }).catch(err => {
          console.error('Error en transición:', err);
          this._fadeIn();
        });
      }
    }

    this._updateExitPrompt();
  },

  _updateExitPrompt() {
    const el = document.getElementById('exit-prompt');
    if (!el || !GameMap.current) { if (el) el.style.display = 'none'; return; }
    let nearest = null, nearDist = Infinity;
    for (const ex of (GameMap.current.exits || [])) {
      if (ex.tileX === undefined || ex.tileY === undefined) continue;
      const dx = Player.x - (ex.tileX + 0.5);
      const dy = Player.y - (ex.tileY + 0.5);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearDist) { nearDist = d; nearest = ex; }
    }
    if (nearest && nearDist < 2) {
      el.textContent = nearest.label ? 'Salir: ' + nearest.label : 'Salir (E)';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  },

  _fadeOut() {
    return new Promise(resolve => {
      this._fading = true;
      const el = document.getElementById('fadeOverlay');
      if (el) el.classList.add('active');
      setTimeout(resolve, 350);
    });
  },

  _fadeIn() {
    const el = document.getElementById('fadeOverlay');
    if (el) el.classList.remove('active');
    this._fading = false;
  },

  _showMapName(name) {
    const el = document.getElementById('map-name');
    if (!el) return;
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(this._mapNameTimer);
    this._mapNameTimer = setTimeout(() => el.classList.remove('show'), 2000);
  },
};

Game3D.init().catch(err => {
  console.error('Error al iniciar juego 3D:', err);
  document.body.innerHTML = '<div style="color:#f85149;padding:2rem;text-align:center">' +
    '<h1>Error al cargar el juego 3D</h1><p>' + err.message + '</p></div>';
});
