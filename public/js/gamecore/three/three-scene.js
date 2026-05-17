const Scene3D = {
  yaw: 0,
  pitch: 0,
  sensitivity: 0.002,
  locked: false,
  clock: null,
  pressedKeys: {},

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1a1a2e);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 100
    );
    this.camera.position.set(2.5, 0.5, 2.5);
    this.camera.rotation.order = 'YXZ';

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    this.blocker = document.getElementById('blocker');
    this.blocker.addEventListener('click', () => this.lock());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
      this.blocker.style.display = this.locked ? 'none' : 'flex';
    });

    document.addEventListener('mousemove', (e) => this._onMouseMove(e));

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  },

  lock() {
    document.body.requestPointerLock();
  },

  _onMouseMove(e) {
    if (!this.locked) return;
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch -= e.movementY * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
  },

  updateCamera() {
    this.camera.position.set(Player.x, 0.5, Player.y);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.updateMatrixWorld(true);
  },

  getForward() {
    return {
      x: -Math.sin(this.yaw),
      z: -Math.cos(this.yaw),
    };
  },

  getRight() {
    return {
      x: Math.cos(this.yaw),
      z: -Math.sin(this.yaw),
    };
  },

  render() {
    this.renderer.render(this.scene, this.camera);
  },
};
