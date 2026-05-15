(function() {

  let mapData = null;
  let selectedTile = null;
  let currentLayer = 'mundo';
  let zoom = 1;
  let showGrid = true;
  let showSky = true;
  let tileSize = 32;
  let selectedExit = null;

  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');
  const paletteContainer = document.getElementById('paletteContainer');
  const propContent = document.getElementById('propContent');
  const exitsContent = document.getElementById('exitsContent');
  const modalOverlay = document.getElementById('modalOverlay');

  const tilePalette = [
    { id: 0, name: 'Vacío', color: '#000000' },
    { id: 1, name: 'Pared', color: '#5c4033' },
    { id: 2, name: 'Puerta', color: '#b8860b' },
    { id: 3, name: 'Agua', color: '#2e6da4' },
  ];

  async function loadExternalPalette() {
    try {
      const res = await fetch('/generated/atlas.json');
      if (res.ok) {
        const atlas = await res.json();
        const ids = Object.keys(atlas.sprites).sort();
        const palette = [{ id: 0, name: 'Vacío', color: '#000000', entityId: null }];
        ids.forEach((entityId, idx) => {
          const s = atlas.sprites[entityId];
          palette.push({
            id: idx + 1,
            name: s.name || entityId,
            color: s.color || '#888',
            entityId: entityId,
            solid: s.solid || false,
          });
        });
        tilePalette.length = 0;
        tilePalette.push(...palette);
      }
    } catch (e) {
      console.warn('No se pudo cargar el atlas, usando paleta por defecto');
    }
  }

  function renderPalette() {
    paletteContainer.innerHTML = '';
    tilePalette.forEach(t => {
      const div = document.createElement('div');
      div.className = 'palette-tile' + (selectedTile && selectedTile.id === t.id ? ' selected' : '');
      div.style.background = t.color;
      if (t.id === 0) div.style.background = '#0d1117';
      if (t.id > 0) {
        const label = document.createElement('span');
        label.className = 'palette-id';
        label.textContent = t.id;
        div.appendChild(label);
      }
      div.title = t.name + ' (ID ' + t.id + ')';
      div.addEventListener('click', () => selectTile(t));
      paletteContainer.appendChild(div);
    });
  }

  function selectTile(t) {
    selectedTile = t;
    renderPalette();
    document.getElementById('paletteColor').style.background = t.color;
    if (t.id === 0) document.getElementById('paletteColor').style.background = '#0d1117';
    document.getElementById('paletteName').textContent = t.name + ' (ID ' + t.id + ')';
  }

  function getGrid(layer) {
    if (!mapData || !mapData.layers) return null;
    if (layer === 'cielo') return null;
    return mapData.layers[layer] || null;
  }

  function getTileAt(layer, col, row) {
    const grid = getGrid(layer);
    if (!grid) return 0;
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return 0;
    return grid[row][col];
  }

  function setTileAt(layer, col, row, id) {
    const grid = getGrid(layer);
    if (!grid) return;
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return;
    grid[row][col] = id;
  }

  function getTileColor(id) {
    const t = tilePalette.find(p => p.id === id);
    return t ? t.color : '#888';
  }

  function resizeCanvas() {
    if (!mapData) return;
    const w = mapData.width * tileSize * zoom;
    const h = mapData.height * tileSize * zoom;
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function render() {
    if (!mapData) return;
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = tileSize * zoom;

    if ((currentLayer === 'mundo' || currentLayer === 'terreno') && showSky) {
      const sky = mapData.layers && mapData.layers.cielo;
      if (sky && sky.type === 'solid') {
        ctx.fillStyle = sky.color;
      } else {
        ctx.fillStyle = '#1a1a2e';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const layersToDraw = [];
    if (currentLayer === 'cielo') {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0e6d0';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Capa: Cielo — configura el color en Propiedades', canvas.width / 2, canvas.height / 2);
      return;
    }

    layersToDraw.push(currentLayer);

    if (currentLayer === 'mundo') layersToDraw.unshift('terreno');

    const drawnLayers = {};
    layersToDraw.forEach(l => {
      if (drawnLayers[l]) return;
      drawnLayers[l] = true;
      const grid = getGrid(l);
      if (!grid) return;
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          const tile = grid[row][col];
          if (tile === 0 && l !== currentLayer) continue;
          const x = col * ts;
          const y = row * ts;
          if (tile > 0) {
            ctx.fillStyle = getTileColor(tile);
          } else {
            if (l === currentLayer) {
              ctx.fillStyle = '#1a1a2e';
            } else {
              continue;
            }
          }
          ctx.fillRect(x, y, ts, ts);
        }
      }
    });

    if (showGrid && ts > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let row = 0; row <= (mapData.height); row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * ts);
        ctx.lineTo(canvas.width, row * ts);
        ctx.stroke();
      }
      for (let col = 0; col <= (mapData.width); col++) {
        ctx.beginPath();
        ctx.moveTo(col * ts, 0);
        ctx.lineTo(col * ts, canvas.height);
        ctx.stroke();
      }
    }

    if (currentLayer === 'mundo' && mapData.exits) {
      mapData.exits.forEach(e => {
        const ex = e.tileX * ts;
        const ey = e.tileY * ts;
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.fillRect(ex, ey, ts, ts);
        ctx.strokeStyle = 'rgba(255,215,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex, ey, ts, ts);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', ex + ts / 2, ey + ts / 2 + 4);
      });
    }
  }

  function updateProperties() {
    if (!mapData) {
      propContent.innerHTML = '<p class="muted">Carga o crea un mapa</p>';
      document.getElementById('mapSizeLabel').textContent = '—';
      return;
    }
    document.getElementById('mapSizeLabel').textContent = mapData.width + 'x' + mapData.height + ' · ' + mapData.mode;

    const sel = document.getElementById('selModo');
    sel.value = mapData.mode || '2d';

    showExits();
  }

  function showExits() {
    if (!mapData || !mapData.exits || mapData.exits.length === 0) {
      exitsContent.innerHTML = '<p class="muted">Sin salidas</p>';
      return;
    }
    let html = '';
    mapData.exits.forEach((e, i) => {
      html += '<div class="exit-card">';
      html += '<div class="exit-row"><span class="exit-label">Tile</span><span class="exit-value">(' + e.tileX + ', ' + e.tileY + ')</span></div>';
      html += '<div class="exit-row"><span class="exit-label">Destino</span><span class="exit-value">' + (e.target || '—') + '</span></div>';
      html += '<div class="exit-row"><span class="exit-label">Spawn</span><span class="exit-value">(' + (e.spawnX || '—') + ', ' + (e.spawnY || '—') + ')</span></div>';
      html += '<div class="exit-row"><span class="exit-del" data-exit="' + i + '">Eliminar</span></div>';
      html += '</div>';
    });
    exitsContent.innerHTML = html;
    exitsContent.querySelectorAll('.exit-del').forEach(el => {
      el.addEventListener('click', () => {
        const i = parseInt(el.dataset.exit);
        mapData.exits.splice(i, 1);
        showExits();
        render();
      });
    });
  }

  function showTileProps(col, row) {
    if (!mapData) return;
    let html = '';
    html += '<div class="prop-row"><span class="prop-label">Tile</span><span class="prop-value">(' + col + ', ' + row + ')</span></div>';
    ['mundo', 'terreno', 'personajes', 'eventos'].forEach(l => {
      const id = getTileAt(l, col, row);
      const t = tilePalette.find(p => p.id === id);
      const name = t ? t.name : '—';
      html += '<div class="prop-row"><span class="prop-label">' + l + '</span><span class="prop-value"><span class="devtools-color-swatch" style="background:' + getTileColor(id) + '"></span>' + name + ' (ID ' + id + ')</span></div>';
    });
    propContent.innerHTML = html;
  }

  function newMap(w, h, mode) {
    function makeGrid(rows, cols) {
      return Array.from({ length: rows }, () => Array(cols).fill(0));
    }
    mapData = {
      name: 'Nuevo Mapa',
      mode: mode || '2d',
      width: w || 25,
      height: h || 20,
      tileSize: 32,
      playerStart: { x: 2, y: 2, dirX: 0, dirY: -1 },
      layers: {
        cielo: { type: 'solid', color: '#1a1a2e' },
        terreno: makeGrid(h || 20, w || 25),
        mundo: makeGrid(h || 20, w || 25),
        personajes: makeGrid(h || 20, w || 25),
        eventos: makeGrid(h || 20, w || 25),
      },
      tileColors: mapData ? mapData.tileColors : {
        "0": { "color": "#4a7c3f", "name": "Pasto", "solid": false },
        "1": { "color": "#5c4033", "name": "Pared", "solid": true },
        "2": { "color": "#b8860b", "name": "Puerta", "solid": false },
        "3": { "color": "#2e6da4", "name": "Agua", "solid": true }
      },
      tileSprites: mapData ? mapData.tileSprites : {
        "0": "pasto",
        "1": "pared_piedra",
        "2": "puerta",
        "3": "agua"
      },
      exits: [],
    };
    currentLayer = 'mundo';
    selectedTile = tilePalette[0];
    renderPalette();
    selectTile(selectedTile);
    updateProperties();
    render();
  }

  async function loadMap(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      mapData = await res.json();

      if (!mapData.layers) {
        const h = mapData.height;
        const w = mapData.width;
        mapData.layers = {
          cielo: { type: 'solid', color: '#1a1a2e' },
          terreno: Array.from({ length: h }, () => Array(w).fill(0)),
          mundo: mapData.tiles || Array.from({ length: h }, () => Array(w).fill(0)),
          personajes: Array.from({ length: h }, () => Array(w).fill(0)),
          eventos: Array.from({ length: h }, () => Array(w).fill(0)),
        };
        delete mapData.tiles;
      }

      currentLayer = 'mundo';
      updateProperties();
      render();
      selectTile(tilePalette[0]);
    } catch (err) {
      alert('Error al cargar mapa: ' + err.message);
    }
  }

  function saveMap() {
    if (!mapData) return;
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (mapData.name || 'mapa') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function showModal(title, bodyHtml, onOk) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    modalOverlay.style.display = 'flex';
    document.getElementById('modalCancel').onclick = () => modalOverlay.style.display = 'none';
    document.getElementById('modalOk').onclick = () => {
      modalOverlay.style.display = 'none';
      onOk();
    };
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ts = tileSize * zoom;
    const col = Math.floor(x / ts);
    const row = Math.floor(y / ts);
    return { col, row };
  }

  canvas.addEventListener('click', e => {
    if (!mapData) return;
    const { col, row } = getCanvasCoords(e);
    if (col < 0 || col >= mapData.width || row < 0 || row >= mapData.height) return;

    if (currentLayer === 'cielo') {
      showTileProps(col, row);
      return;
    }

    if (selectedTile && selectedTile.id !== undefined) {
      setTileAt(currentLayer, col, row, selectedTile.id);
      render();
      showTileProps(col, row);
    }
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!mapData) return;
    const { col, row } = getCanvasCoords(e);
    if (col < 0 || col >= mapData.width || row < 0 || row >= mapData.height) return;
    if (currentLayer !== 'cielo') {
      setTileAt(currentLayer, col, row, 0);
      render();
      showTileProps(col, row);
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!mapData || e.buttons !== 1) return;
    const { col, row } = getCanvasCoords(e);
    if (col < 0 || col >= mapData.width || row < 0 || row >= mapData.height) return;
    if (currentLayer !== 'cielo' && selectedTile && selectedTile.id !== undefined) {
      setTileAt(currentLayer, col, row, selectedTile.id);
      render();
    }
  });

  document.querySelectorAll('.layer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.layer-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentLayer = tab.dataset.layer;
      render();
    });
  });

  document.getElementById('chkGrid').addEventListener('change', e => {
    showGrid = e.target.checked;
    render();
  });

  document.getElementById('chkMostrarCielo').addEventListener('change', e => {
    showSky = e.target.checked;
    render();
  });

  document.getElementById('selModo').addEventListener('change', e => {
    if (mapData) mapData.mode = e.target.value;
  });

  document.getElementById('zoomIn').addEventListener('click', () => {
    zoom = Math.min(zoom * 1.25, 4);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    render();
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    zoom = Math.max(zoom / 1.25, 0.25);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    render();
  });

  document.getElementById('btnNuevo').addEventListener('click', () => {
    showModal('Nuevo Mapa',
      '<div class="modal-field"><label>Ancho (tiles)</label><input type="number" id="fAncho" value="25" min="2" max="100"></div>' +
      '<div class="modal-field"><label>Alto (tiles)</label><input type="number" id="fAlto" value="20" min="2" max="100"></div>' +
      '<div class="modal-field"><label>Modo</label><select id="fModo"><option value="2d">2D</option><option value="ray">Raycast</option></select></div>',
      () => {
        const w = parseInt(document.getElementById('fAncho').value) || 25;
        const h = parseInt(document.getElementById('fAlto').value) || 20;
        const mode = document.getElementById('fModo').value;
        newMap(w, h, mode);
      }
    );
  });

  document.getElementById('btnAbrir').addEventListener('click', () => {
    showModal('Abrir Mapa',
      '<div class="modal-field"><label>Mapa predefinido</label><select id="fMapSelect">' +
      '<option value="/maps/inicio.json">Bosque Inicial (inicio.json)</option>' +
      '<option value="/maps/cueva.json">Cueva Oscura (cueva.json)</option>' +
      '</select></div>' +
      '<div class="modal-field"><label>O sube un archivo</label><input type="file" id="fFileInput" accept=".json"></div>',
      () => {
        const fileInput = document.getElementById('fFileInput');
        if (fileInput.files && fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = e => {
            try { mapData = JSON.parse(e.target.result); if (!mapData.layers) throw new Error('Formato inválido'); currentLayer = 'mundo'; updateProperties(); render(); selectTile(tilePalette[0]); } catch(err) { alert('Error al parsear JSON: ' + err.message); }
          };
          reader.readAsText(fileInput.files[0]);
        } else {
          const path = document.getElementById('fMapSelect').value;
          loadMap(path);
        }
      }
    );
  });

  document.getElementById('btnGuardar').addEventListener('click', saveMap);

  document.getElementById('btnAddExit').addEventListener('click', () => {
    if (!mapData) return;
    showModal('Añadir Exit',
      '<div class="modal-field"><label>Tile X</label><input type="number" id="fExitX" value="0" min="0" max="' + (mapData.width - 1) + '"></div>' +
      '<div class="modal-field"><label>Tile Y</label><input type="number" id="fExitY" value="0" min="0" max="' + (mapData.height - 1) + '"></div>' +
      '<div class="modal-field"><label>Mapa destino</label><input type="text" id="fExitTarget" value="/maps/"></div>' +
      '<div class="modal-field"><label>Spawn X</label><input type="number" id="fExitSpawnX" value="2.5" step="0.1"></div>' +
      '<div class="modal-field"><label>Spawn Y</label><input type="number" id="fExitSpawnY" value="2.5" step="0.1"></div>',
      () => {
        if (!mapData.exits) mapData.exits = [];
        mapData.exits.push({
          tileX: parseInt(document.getElementById('fExitX').value),
          tileY: parseInt(document.getElementById('fExitY').value),
          target: document.getElementById('fExitTarget').value,
          spawnX: parseFloat(document.getElementById('fExitSpawnX').value),
          spawnY: parseFloat(document.getElementById('fExitSpawnY').value),
        });
        showExits();
        render();
      }
    );
  });

  async function init() {
    await loadExternalPalette();
    renderPalette();
    selectTile(tilePalette[0]);
    newMap(25, 20, '2d');
  }

  init();

})();
