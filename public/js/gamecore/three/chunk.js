const ChunkManager = {
  chunks: [],
  size: 8,
  lodDist: [15, 30],
  _entityCache: null,
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

  async _ensureEntityCache() {
    if (this._entityCache) return;
    this._entityCache = {};
    const names = ['mundo', 'entidades'];
    for (const name of names) {
      try {
        const res = await fetch('/generated/atlas_' + name + '.json?t=' + Date.now());
        if (res.ok) {
          const json = await res.json();
          if (json.sprites) Object.assign(this._entityCache, json.sprites);
        }
      } catch (e) {}
    }
  },

  _getEmission(tileId, tileSprites) {
    const entityId = tileSprites && tileSprites[tileId];
    if (!entityId || !this._entityCache) return null;
    const entity = this._entityCache[entityId];
    if (!entity || !entity.emission) return null;
    return {
      intensity: entity.emission,
      color: this._hexToRGB(entity.emissionColor || '#ffffff'),
    };
  },

  _getLight(x, z, lightmap) {
    if (!lightmap || !lightmap[z] || !lightmap[z][x]) return [1, 1, 1];
    return this._hexToRGB(lightmap[z][x]);
  },

  _finalColor(base, emission) {
    let r = base[0], g = base[1], b = base[2];
    if (emission) {
      r = Math.min(1, r + emission.color[0] * emission.intensity);
      g = Math.min(1, g + emission.color[1] * emission.intensity);
      b = Math.min(1, b + emission.color[2] * emission.intensity);
    }
    return [r, g, b];
  },

  async buildFromMap(mapData) {
    this.clear();
    if (!mapData || !mapData.layers) return;
    await this._ensureEntityCache();
    const numX = Math.ceil(mapData.width / this.size);
    const numZ = Math.ceil(mapData.height / this.size);
    for (let cz = 0; cz < numZ; cz++) {
      for (let cx = 0; cx < numX; cx++) {
        const meshes = this._buildChunk(cx, cz, mapData);
        const hasMesh = meshes.some(m => m !== null);
        if (!hasMesh) continue;
        this.chunks.push({ cx, cz, meshes, lod: 0 });
        for (let i = 0; i < 3; i++) {
          if (meshes[i]) {
            meshes[i].visible = (i === 0);
            Scene3D.scene.add(meshes[i]);
          }
        }
      }
    }
  },

  _buildChunk(cx, cz, mapData) {
    try {
      return [
        this._buildLOD0(cx, cz, mapData),
        this._buildLOD1(cx, cz, mapData),
        this._buildLOD2(cx, cz, mapData),
      ];
    } catch (e) {
      console.warn('Error building chunk', cx, cz, e);
      return [null, null, null];
    }
  },

  _buildLOD0(cx, cz, mapData) {
    const sx = cx * this.size, sz = cz * this.size;
    const ex = Math.min(sx + this.size, mapData.width);
    const ez = Math.min(sz + this.size, mapData.height);
    const { layers, tileColors, tileSprites, lightmap } = mapData;
    const terreno = layers.terreno, estructura = layers.estructura;
    const pos = [], col = [], nor = [], idx = [];
    let vi = 0;
    const h2r = (h) => this._hexToRGB(h);
    const self = this;

    const solid = (x, y, z) => {
      if (y < -1) return true;
      if (x < 0 || x >= mapData.width || z < 0 || z >= mapData.height) return false;
      if (y === -1) return terreno[z] && terreno[z][x] !== 0 && terreno[z][x] !== undefined;
      if (y === 0) return estructura && estructura[z] && estructura[z][x] !== 0 && estructura[z][x] !== undefined;
      return false;
    };

    const addBox = (wx, wy, wz, rgb, tileId) => {
      const light = self._getLight(wx, wz, lightmap);
      const emission = self._getEmission(tileId, tileSprites);
      const fc = self._finalColor([rgb[0]*light[0], rgb[1]*light[1], rgb[2]*light[2]], emission);
      for (const fd of Object.values(this.faceDirs)) {
        const [dx, dy, dz] = fd.d;
        if (solid(wx + dx, wy + dy, wz + dz)) continue;
        for (const v of fd.v) {
          pos.push(wx + v[0], wy + v[1], wz + v[2]);
          col.push(fc[0], fc[1], fc[2]);
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
          addBox(x, -1, z, h2r(info ? info.color : null), tId);
        }
        if (!estructura) continue;
        const eId = estructura[z][x];
        if (eId !== 0 && eId !== undefined) {
          const info = tileColors[eId];
          addBox(x, 0, z, h2r(info ? info.color : null), eId);
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

  _buildLOD1(cx, cz, mapData) {
    const sx = cx * this.size, sz = cz * this.size;
    const ex = Math.min(sx + this.size, mapData.width);
    const ez = Math.min(sz + this.size, mapData.height);
    const { layers, tileColors, tileSprites, lightmap } = mapData;
    const terreno = layers.terreno, estructura = layers.estructura;
    const pos = [], col = [], nor = [], idx = [];
    let vi = 0;
    const h2r = (h) => this._hexToRGB(h);
    const self = this;

    const getBlockId = (grid, bx, bz) => {
      if (!grid || bx < 0 || bz < 0 || bx + 2 > mapData.width || bz + 2 > mapData.height) return null;
      let id = null;
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          const t = grid[bz + dz][bx + dx];
          if (t === 0 || t === undefined) return null;
          if (id === null) id = t;
          else if (id !== t) return null;
        }
      }
      return id;
    };

    const blockExists = (grid, bx, bz) => getBlockId(grid, bx, bz) !== null;

    const solid = (x, y, z) => {
      if (y < -1) return true;
      if (x < 0 || x >= mapData.width || z < 0 || z >= mapData.height) return false;
      if (y === -1) return terreno[z] && terreno[z][x] !== 0 && terreno[z][x] !== undefined;
      if (y === 0) return estructura && estructura[z] && estructura[z][x] !== 0 && estructura[z][x] !== undefined;
      return false;
    };

    const avgLight = (bx, bz) => {
      if (!lightmap) return [1, 1, 1];
      let r = 0, g = 0, b = 0, n = 0;
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          const lx = bx + dx, lz = bz + dz;
          if (lightmap[lz] && lightmap[lz][lx]) {
            const l = self._hexToRGB(lightmap[lz][lx]);
            r += l[0]; g += l[1]; b += l[2]; n++;
          }
        }
      }
      return n > 0 ? [r/n, g/n, b/n] : [1, 1, 1];
    };

    const covered = new Set();
    const mk = (p, x, z) => covered.add(p + '_' + x + '_' + z);
    const cv = (p, x, z) => covered.has(p + '_' + x + '_' + z);

    const addMergedBox = (bx, bz, wy, rgb, tileId) => {
      const light = avgLight(bx, bz);
      const emission = self._getEmission(tileId, tileSprites);
      const fc = self._finalColor([rgb[0]*light[0], rgb[1]*light[1], rgb[2]*light[2]], emission);
      for (const fd of Object.values(this.faceDirs)) {
        const [dx, dy, dz] = fd.d;
        const nx = bx + dx * 2, ny = wy + dy, nz = bz + dz * 2;
        const grid = (wy === -1) ? terreno : estructura;
        if (dy === 0) {
          if (blockExists(grid, nx, nz)) continue;
        } else {
          let allSolid = true;
          for (let tz = 0; tz < 2 && allSolid; tz++) {
            for (let tx = 0; tx < 2 && allSolid; tx++) {
              if (!solid(bx + tx, ny, bz + tz)) allSolid = false;
            }
          }
          if (allSolid) continue;
        }
        for (const v of fd.v) {
          pos.push(bx + v[0] * 2, wy + v[1], bz + v[2] * 2);
          col.push(fc[0], fc[1], fc[2]);
          nor.push(fd.n[0], fd.n[1], fd.n[2]);
        }
        idx.push(vi, vi+1, vi+2,  vi, vi+2, vi+3);
        vi += 4;
      }
    };

    const addTileBox = (wx, wy, wz, rgb, tileId) => {
      const light = self._getLight(wx, wz, lightmap);
      const emission = self._getEmission(tileId, tileSprites);
      const fc = self._finalColor([rgb[0]*light[0], rgb[1]*light[1], rgb[2]*light[2]], emission);
      for (const fd of Object.values(this.faceDirs)) {
        const [dx, dy, dz] = fd.d;
        if (solid(wx + dx, wy + dy, wz + dz)) continue;
        for (const v of fd.v) {
          pos.push(wx + v[0], wy + v[1], wz + v[2]);
          col.push(fc[0], fc[1], fc[2]);
          nor.push(fd.n[0], fd.n[1], fd.n[2]);
        }
        idx.push(vi, vi+1, vi+2,  vi, vi+2, vi+3);
        vi += 4;
      }
    };

    for (let bz = sz; bz + 2 <= ez; bz += 2) {
      for (let bx = sx; bx + 2 <= ex; bx += 2) {
        const tId = getBlockId(terreno, bx, bz);
        if (tId !== null) {
          const info = tileColors[tId];
          addMergedBox(bx, -1, bz, h2r(info ? info.color : null), tId);
          for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) mk('t', bx+dx, bz+dz);
        }
        if (!estructura) continue;
        const eId = getBlockId(estructura, bx, bz);
        if (eId !== null) {
          const info = tileColors[eId];
          addMergedBox(bx, 0, bz, h2r(info ? info.color : null), eId);
          for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) mk('e', bx+dx, bz+dz);
        }
      }
    }

    for (let z = sz; z < ez; z++) {
      for (let x = sx; x < ex; x++) {
        if (!cv('t', x, z)) {
          const tId = terreno[z][x];
          if (tId !== 0 && tId !== undefined) {
            const info = tileColors[tId];
            addTileBox(x, -1, z, h2r(info ? info.color : null), tId);
          }
        }
        if (!estructura) continue;
        if (!cv('e', x, z)) {
          const eId = estructura[z][x];
          if (eId !== 0 && eId !== undefined) {
            const info = tileColors[eId];
            addTileBox(x, 0, z, h2r(info ? info.color : null), eId);
          }
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

  _buildLOD2(cx, cz, mapData) {
    const sx = cx * this.size, sz = cz * this.size;
    const ex = Math.min(sx + this.size, mapData.width);
    const ez = Math.min(sz + this.size, mapData.height);
    const { layers, tileColors, lightmap } = mapData;
    const terreno = layers.terreno, estructura = layers.estructura;
    const h2r = (h) => this._hexToRGB(h);
    const self = this;

    let tR = 0, tG = 0, tB = 0, tCount = 0;
    let eR = 0, eG = 0, eB = 0, eCount = 0;

    for (let z = sz; z < ez; z++) {
      for (let x = sx; x < ex; x++) {
        const tId = terreno[z][x];
        if (tId !== 0 && tId !== undefined) {
          const c = h2r(tileColors[tId] ? tileColors[tId].color : null);
          const l = self._getLight(x, z, lightmap);
          tR += c[0] * l[0]; tG += c[1] * l[1]; tB += c[2] * l[2]; tCount++;
        }
        if (!estructura) continue;
        const eId = estructura[z][x];
        if (eId !== 0 && eId !== undefined) {
          const c = h2r(tileColors[eId] ? tileColors[eId].color : null);
          const l = self._getLight(x, z, lightmap);
          eR += c[0] * l[0]; eG += c[1] * l[1]; eB += c[2] * l[2]; eCount++;
        }
      }
    }

    if (tCount === 0 && eCount === 0) return null;

    const yMin = tCount > 0 ? -1 : 0;
    const yMax = eCount > 0 ? 1 : 0;
    const yCenter = (yMin + yMax) / 2;
    const yHeight = yMax - yMin;
    const totalR = tR + eR, totalG = tG + eG, totalB = tB + eB;
    const totalCount = tCount + eCount;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sx + this.size / 2, yCenter, sz + this.size / 2);
    mesh.scale.set(this.size, yHeight, this.size);
    mesh.material.color.setRGB(totalR / totalCount, totalG / totalCount, totalB / totalCount);
    return mesh;
  },

  update(camera) {
    const frustum = new THREE.Frustum();
    const proj = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(proj);
    const box = new THREE.Box3();
    const px = Player.x, pz = Player.y;

    for (const ch of this.chunks) {
      const cx = ch.cx * this.size + this.size / 2;
      const cz = ch.cz * this.size + this.size / 2;
      const dist = Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2);

      let newLod = 0;
      if (dist >= this.lodDist[1]) newLod = 2;
      else if (dist >= this.lodDist[0]) newLod = 1;

      if (newLod !== ch.lod) {
        ch.lod = newLod;
        for (let i = 0; i < 3; i++) {
          if (ch.meshes[i]) ch.meshes[i].visible = (i === newLod);
        }
      }

      const activeMesh = ch.meshes[ch.lod];
      if (!activeMesh) continue;
      activeMesh.geometry.computeBoundingBox();
      const bb = activeMesh.geometry.boundingBox;
      if (!bb) continue;
      box.copy(bb).applyMatrix4(activeMesh.matrixWorld);
      const v = frustum.intersectsBox(box);
      activeMesh.visible = v;
    }
  },

  clear() {
    for (const ch of this.chunks) {
      for (let i = 0; i < 3; i++) {
        if (ch.meshes[i]) {
          Scene3D.scene.remove(ch.meshes[i]);
          ch.meshes[i].geometry.dispose();
          ch.meshes[i].material.dispose();
        }
      }
    }
    this.chunks = [];
  },
};
