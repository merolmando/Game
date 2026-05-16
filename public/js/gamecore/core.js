const Transition = {
  active: false,
  timer: 0,
  halfDuration: 0.5,
  phase: '',
  loaded: false,

  start(duration) {
    this.active = true;
    this.phase = 'fadeOut';
    this.timer = 0;
    this.halfDuration = duration / 2;
    this.loaded = false;
  },

  update(dt) {
    if (!this.active) return;
    this.timer += dt;

    if (this.phase === 'fadeOut' && this.timer >= this.halfDuration) {
      if (!this.loaded) return;
      this.phase = 'fadeIn';
      this.timer = 0;
    } else if (this.phase === 'fadeIn' && this.timer >= this.halfDuration) {
      this.active = false;
      this.phase = '';
    }
  },

  getAlpha() {
    if (!this.active) return 0;
    if (this.phase === 'fadeOut') {
      const t = this.timer / this.halfDuration;
      return t * t;
    } else {
      const t = this.timer / this.halfDuration;
      return 1 - t * (2 - t);
    }
  },
};

const canvas = document.getElementById('gameCanvas');
Renderer.init(canvas);

let lastTime = 0;
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;

async function resolveExitTarget(exit) {
  if (exit.target) return { target: exit.target, spawnData: exit };
  if (exit.connectionId) {
    try {
      const res = await fetch('/api/mapas/resolve-label?label=' + encodeURIComponent(exit.connectionId));
      const data = await res.json();
      if (data.found) {
        const target = '/maps/' + data.fileId + '.json';
        const spawnData = { spawnX: data.tileX + 0.5, spawnY: data.tileY + 0.5 };
        return { target, spawnData };
      }
    } catch (err) {
      console.error('Error resolviendo conexi\u00F3n:', err.message);
    }
  }
  return { target: null, spawnData: null };
}

async function loadMap(path, spawnData) {
  Map.message = '';
  Map.messageTimer = 0;
  if (!path.startsWith('/')) path = '/maps/' + path + '.json';
  const data = await Map.load(path);
  if (spawnData) {
    Player.x = spawnData.spawnX;
    Player.y = spawnData.spawnY;
  } else {
    Player.x = data.playerStart.x;
    Player.y = data.playerStart.y;
  }
  if (data.mode === '2d') {
    Player.facingX = data.playerStart.dirX || 0;
    Player.facingY = data.playerStart.dirY || -1;
  } else {
    Player.dirX = data.playerStart.dirX || 1;
    Player.dirY = data.playerStart.dirY || 0;
    const fov = 0.66;
    Player.planeX = -Player.dirY * fov;
    Player.planeY = Player.dirX * fov;
  }
  Player.spawnTimer = 0.3;
  Camera.x = 0;
  Camera.y = 0;
}

async function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  fpsTimer += dt;
  frameCount++;
  if (fpsTimer >= 1) {
    fps = frameCount;
    frameCount = 0;
    fpsTimer = 0;
  }

  if (!Transition.active) {
    Player.update(dt);

    if (Player.spawnTimer > 0) {
      Player.spawnTimer -= dt;
    } else if (Player.spawnTimer <= 0) {
      const exit = Map.checkExits(Player.x, Player.y);
      if (exit) {
        if (exit.locked && !Player.hasKey(exit.keyId)) {
          Map.message = exit.label ? 'Necesitas una llave para abrir ' + exit.label : 'Puerta bloqueada';
          Map.messageTimer = 2;
        } else {
          Transition.start(1.0);
          resolveExitTarget(exit).then(({ target, spawnData }) => {
            if (target) {
              loadMap(target, spawnData).then(() => {
                Transition.loaded = true;
              }).catch(err => {
                console.error(err.message);
                Transition.loaded = true;
                Map.current = null;
              });
            } else {
              Transition.loaded = true;
            }
          });
        }
      }
    }
  }

  Transition.update(dt);
  if (Map.messageTimer > 0) {
    Map.messageTimer -= dt;
    if (Map.messageTimer <= 0) { Map.message = ''; Map.messageTimer = 0; }
  }
  Renderer.dt = dt;
  Renderer.render(Player);
  HUD.render(Renderer.ctx, Player);
  requestAnimationFrame(gameLoop);
}

async function init() {
  let startMap = '/maps/inicio.json';
  try {
    const res = await fetch('/api/mapas/default');
    if (res.ok) {
      const config = await res.json();
      if (config.defaultMap) startMap = config.defaultMap;
    }
  } catch {}
  await loadMap(startMap);
  await Sprite.load(['mundo', 'entidades']);
  await HUD.init();
  requestAnimationFrame(gameLoop);
}

init();
