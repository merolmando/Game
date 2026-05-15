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

async function loadMap(path) {
  const data = await Map.load(path);
  Player.x = data.playerStart.x;
  Player.y = data.playerStart.y;
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
        Transition.start(1.0);
        loadMap(exit.target).then(() => {
          Transition.loaded = true;
        }).catch(err => {
          console.error(err.message);
          Transition.loaded = true;
          Map.current = null;
        });
      }
    }
  }

  Transition.update(dt);
  Renderer.dt = dt;
  Renderer.render(Player);
  requestAnimationFrame(gameLoop);
}

async function init() {
  await loadMap('/maps/inicio.json');
  await Sprite.load();
  requestAnimationFrame(gameLoop);
}

init();
