const ChunkManager = {
  chunks: [],
  size: 8,
  faceDirs: {
    top:    { v: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], n: [0,1,0],  d: [0,1,0] },
    bottom: { v: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], n: [0,-1,0], d: [0,-1,0] },
    front:  { v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], n: [0,0,1],  d: [0,0,1] },
    back:   { v: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], n: [0,0,-1], d: [0,0,-1] },
    right:  { v: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], n: [1,0,0],  d: [1,0,0] },
    left:   { v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], n: [-1,0,0], d: [-1,0,0] },
  },

  _hexToRGB(hex) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#') return [0.5, 0.5, 0.5];
    return [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255];
  },

  buildFromMap(mapData) {
    this.clear();
    if (!mapData || !mapData.layers) return;

    const numX = Math.ceil(mapData.width / this.size);
    const numZ = Math.ceil(mapData.height / this.size);

    for (let cz = 0; cz < numZ; cz++) {
      for (let cx = 0; cx < numX; cx++) {
        const mesh = this._buildChunk(cx, cz, mapData);
        if (mesh) {
          this.chunks.push({ cx, cz, mesh, visible: true });
          Scene3D.scene.add(mesh);
        }
      }
    }
  },

  _buildChunk(cx, cz, mapData) {
    const sx = cx * this.size, sz = cz * this.size;
    const ex = Math.min(sx + this.size, mapData.width);
    const ez = Math.min(sz + this.size, mapData.height);
    const { layers, tileColors } = mapData;
    const terreno = layers.terreno, estructura = layers.estructura;
    const pos = [], col = [], nor = [], idx = [];
    let vi = 0;
    const h2r = (h) => this._hexToRGB(h);

    // Coord system:
    //   Terreno boxes at y=-1 (from y=-1 to y=0) = walking surface at y=0
    //   Estructura boxes at y=0 (from y=0 to y=1) = walls on the surface
    //   Player camera at y=0.5, feet at y=0
    const solid = (x, y, z) => {
      if (y < -1) return true;
      if (x < 0 || x >= mapData.width || z < 0 || z >= mapData.height) return false;
      if (y === -1) return terreno[z] && terreno[z][x] !== 0 && terreno[z][x] !== undefined;
      if (y === 0) return estructura && estructura[z] && estructura[z][x] !== 0 && estructura[z][x] !== undefined;
      return false;
    };

    const addBox = (wx, wy, wz, rgb) => {
      for (const fd of Object.values(this.faceDirs)) {
        const [dx, dy, dz] = fd.d;
        if (solid(wx + dx, wy + dy, wz + dz)) continue;
        for (const v of fd.v) {
          pos.push(wx + v[0], wy + v[1], wz + v[2]);
          col.push(rgb[0], rgb[1], rgb[2]);
          nor.push(fd.n[0], fd.n[1], fd.n[2]);
        }
        idx.push(vi, vi+1, vi+2,  vi, vi+2, vi+3);
        vi += 4;
      }
    };

    for (let z = sz; z < ez; z++) {
      for (let x = sx; x < ex; x++) {
        const tId = terreno[z][x];
        if (tId !== 0 && tId !== undefined) {
          const info = tileColors[tId];
          addBox(x, -1, z, h2r(info ? info.color : null));
        }
        if (!estructura) continue;
        const eId = estructura[z][x];
        if (eId !== 0 && eId !== undefined) {
          const info = tileColors[eId];
          addBox(x, 0, z, h2r(info ? info.color : null));
        }
      }
    }

    if (vi === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);

    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  },

  update(camera) {
    const frustum = new THREE.Frustum();
    const proj = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(proj);
    const box = new THREE.Box3();

    for (const ch of this.chunks) {
      ch.mesh.geometry.computeBoundingBox();
      const bb = ch.mesh.geometry.boundingBox;
      if (!bb) continue;
      box.copy(bb).applyMatrix4(ch.mesh.matrixWorld);
      const v = frustum.intersectsBox(box);
      if (v !== ch.visible) {
        ch.visible = v;
        ch.mesh.visible = v;
      }
    }
  },

  clear() {
    for (const ch of this.chunks) {
      Scene3D.scene.remove(ch.mesh);
      ch.mesh.geometry.dispose();
      ch.mesh.material.dispose();
    }
    this.chunks = [];
  },
};
