(function() {

  let mapData = null;
  let selectedTile = null;
  let currentLayer = 'estructura';
  let zoom = 1;
  let showGrid = true;
  let showSky = true;
  let tileSize = 32;
  let mapList = [];
  let defaultMapName = null;
  let editingExitIndex = -1;
  let clickTimeout = null;

  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');
  const paletteContainer = document.getElementById('paletteContainer');
  const propContent = document.getElementById('propContent');
  const exitsContent = document.getElementById('exitsContent');
  const modalOverlay = document.getElementById('modalOverlay');
  const saveStatus = document.getElementById('saveStatus');

  const tilePalette = [];

  let atlasImages = {};
  let atlasSprites = {};

  async function loadAtlases() {
    try {
      const knownAtlases = ['mundo', 'entidades', 'ui', 'efectos'];
      const ts = Date.now();

      const results = await Promise.all(knownAtlases.map(async name => {
        try {
          const [res, img] = await Promise.all([
            fetch('/generated/atlas_' + name + '.json?t=' + ts),
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = '/generated/atlas_' + name + '.png?t=' + ts;
            }),
          ]);
          const json = await res.json();
          return { name, img, json };
        } catch {
          return null;
        }
      }));

      atlasImages = {};
      atlasSprites = {};

      for (const r of results) {
        if (!r) continue;
        atlasImages[r.name] = r.img;
        const sprites = r.json.sprites || {};
        Object.keys(sprites).forEach(entityId => {
          sprites[entityId].atlasName = r.name;
          atlasSprites[entityId] = sprites[entityId];
        });
      }

      const numAtlases = Object.keys(atlasImages).length;
      if (numAtlases === 0) throw new Error('No se cargaron atlases');

      const ids = Object.keys(atlasSprites).sort();
      const palette = [{ id: 0, name: 'Vac\u00EDo', color: '#000000', entityId: null }];
      ids.forEach((entityId, idx) => {
        const s = atlasSprites[entityId];
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
    } catch (e) {
      console.warn('No se pudo cargar atlas múltiple, usando paleta por defecto');
      if (tilePalette.length === 0) {
        tilePalette.push(
          { id: 0, name: 'Vac\u00EDo', color: '#000000', entityId: null },
          { id: 1, name: 'Pared', color: '#5c4033', entityId: null },
          { id: 2, name: 'Puerta', color: '#b8860b', entityId: null },
          { id: 3, name: 'Agua', color: '#2e6da4', entityId: null },
        );
      }
    }
  }

  function remapMapIds() {
    if (!mapData || !atlasSprites) return;

    let oldSprites = mapData.tileSprites;
    if (!oldSprites || Object.keys(oldSprites).length === 0) {
      oldSprites = {};
      const colors = mapData.tileColors;
      if (colors) {
        Object.keys(colors).forEach(key => {
          const c = colors[key];
          const name = (c.name || '').toLowerCase();
          let matched = null;
          Object.keys(atlasSprites).forEach(entityId => {
            const s = atlasSprites[entityId];
            const en = (s.name || entityId).toLowerCase();
            if (name === en || en.includes(name) || name.includes(en)) {
              matched = entityId;
            }
          });
          if (matched) oldSprites[key] = matched;
        });
      }
    }

    const entityToNewId = {};
    tilePalette.forEach(t => {
      if (t.entityId) entityToNewId[t.entityId] = t.id;
    });

    const idMapping = {};
    Object.keys(oldSprites).forEach(oldKey => {
      const oldId = parseInt(oldKey);
      const entityId = oldSprites[oldKey];
      const newId = entityToNewId[entityId];
      if (newId !== undefined && newId !== oldId) {
        idMapping[oldId] = newId;
      }
    });

    const layerNames = ['terreno', 'estructura', 'objetos', 'eventos'];
    layerNames.forEach(layer => {
      const grid = mapData.layers && mapData.layers[layer];
      if (!grid) return;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const val = grid[r][c];
          if (val > 0 && idMapping[val] !== undefined) {
            grid[r][c] = idMapping[val];
          }
        }
      }
    });
  }

  function syncTileMetadataFromAtlas() {
    if (!mapData) return;
    const tileColors = {};
    const tileSprites = {};
    tilePalette.forEach(t => {
      if (t.id === 0) return;
      tileColors[t.id] = {
        color: t.color || '#888',
        name: t.name || 'Tile ' + t.id,
        solid: t.solid || false,
      };
      if (t.entityId) {
        tileSprites[t.id] = t.entityId;
      }
    });
    mapData.tileColors = tileColors;
    mapData.tileSprites = tileSprites;
  }

  function renderPalette() {
    paletteContainer.innerHTML = '';
    tilePalette.forEach(t => {
      const div = document.createElement('div');
      div.className = 'palette-tile' + (selectedTile && selectedTile.id === t.id ? ' selected' : '');
      div.style.background = t.color;
      if (t.id === 0) div.style.background = '#0d1117';

      if (t.id > 0 && t.entityId && atlasSprites[t.entityId]) {
        const sprite = atlasSprites[t.entityId];
        const img = sprite.atlasName ? atlasImages[sprite.atlasName] : null;
        if (img) {
          const c = document.createElement('canvas');
          c.width = sprite.frameW;
          c.height = sprite.frameH;
          c.style.width = '100%';
          c.style.height = '100%';
          c.style.display = 'block';
          const cx = c.getContext('2d');
          cx.drawImage(img, sprite.x, sprite.y, sprite.frameW, sprite.frameH, 0, 0, sprite.frameW, sprite.frameH);
          div.appendChild(c);
        }
      }

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

  function getCellPx() {
    return zoom * (mapData ? (mapData.tileSize || tileSize) : tileSize);
  }

  function resizeCanvas() {
    if (!mapData) return;
    const cellPx = getCellPx();
    const w = mapData.width * cellPx;
    const h = mapData.height * cellPx;
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function render() {
    if (!mapData) return;
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellPx = zoom * (mapData.tileSize || tileSize);

    const isEntityLayer = currentLayer === 'personajes' || currentLayer === 'enemigos';

    if ((currentLayer === 'estructura' || currentLayer === 'terreno' || isEntityLayer) && showSky) {
      const sky = mapData.layers && mapData.layers.cielo;
      if (sky && sky.type === 'solid') {
        ctx.fillStyle = sky.color;
      } else {
        ctx.fillStyle = '#1a1a2e';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (currentLayer === 'cielo') {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0e6d0';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Capa: Cielo \u2014 configura el color en Propiedades', canvas.width / 2, canvas.height / 2);
      return;
    }

    let layersToDraw = [currentLayer];
    if (currentLayer === 'estructura') layersToDraw.unshift('terreno');
    if (isEntityLayer) layersToDraw = ['terreno', 'estructura'];

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
          const x = col * cellPx;
          const y = row * cellPx;
          if (tile > 0) {
            const entityId = mapData.tileSprites ? mapData.tileSprites[tile] : null;
            const sprite = entityId ? atlasSprites[entityId] : null;
            const img = sprite && sprite.atlasName ? atlasImages[sprite.atlasName] : null;
            if (img && sprite) {
              ctx.drawImage(img, sprite.x, sprite.y, sprite.frameW, sprite.frameH, x, y, cellPx, cellPx);
            } else {
              ctx.fillStyle = getTileColor(tile);
              ctx.fillRect(x, y, cellPx, cellPx);
            }
          } else {
            if (l === currentLayer) {
              ctx.fillStyle = '#1a1a2e';
              ctx.fillRect(x, y, cellPx, cellPx);
            } else {
              continue;
            }
          }
        }
      }
    });

    if (showGrid && cellPx > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let row = 0; row <= mapData.height; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * cellPx);
        ctx.lineTo(canvas.width, row * cellPx);
        ctx.stroke();
      }
      for (let col = 0; col <= mapData.width; col++) {
        ctx.beginPath();
        ctx.moveTo(col * cellPx, 0);
        ctx.lineTo(col * cellPx, canvas.height);
        ctx.stroke();
      }
    }

    if (currentLayer === 'estructura' && mapData.exits) {
      const dirArrow = { up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6' };
      mapData.exits.forEach(e => {
        const ex = e.tileX * cellPx;
        const ey = e.tileY * cellPx;
        const exitTileId = mapData.layers && mapData.layers.estructura ? mapData.layers.estructura[e.tileY]?.[e.tileX] : null;
        const entityId = exitTileId && mapData.tileSprites ? mapData.tileSprites[exitTileId] : null;
        const sprite = entityId ? atlasSprites[entityId] : null;
        const img = sprite && sprite.atlasName ? atlasImages[sprite.atlasName] : null;
        if (img && sprite) {
          ctx.drawImage(img, sprite.x, sprite.y, sprite.frameW, sprite.frameH, ex, ey, cellPx, cellPx);
        } else {
          ctx.fillStyle = 'rgba(255,215,0,0.3)';
          ctx.fillRect(ex, ey, cellPx, cellPx);
        }
        ctx.strokeStyle = e.locked ? 'rgba(248,81,73,0.7)' : 'rgba(255,215,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex, ey, cellPx, cellPx);

        if (cellPx >= 24) {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold ' + Math.max(8, cellPx / 3) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const arrow = dirArrow[e.direction || 'up'] || '\u25B2';
          ctx.fillText(arrow, ex + cellPx / 2, ey + 2);

          if (e.label && cellPx >= 32) {
            ctx.font = Math.max(7, cellPx / 4) + 'px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 3;
            ctx.fillText(e.label, ex + cellPx / 2, ey + cellPx / 2 + 2);
            ctx.shadowBlur = 0;
          }
        }

        if (e.locked) {
          ctx.fillStyle = 'rgba(248,81,73,0.3)';
          ctx.fillRect(ex + 2, ey + 2, cellPx - 4, cellPx - 4);
          ctx.fillStyle = '#f85149';
          ctx.font = 'bold ' + Math.max(10, cellPx / 2.5) + 'px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText('\uD83D\uDD12', ex + cellPx / 2, ey + cellPx / 2);
        }
      });
    }

    if (isEntityLayer) {
      const entities = currentLayer === 'personajes' ? (mapData.characters || []) : (mapData.enemies || []);
      entities.forEach(e => {
        const ex = e.x * cellPx;
        const ey = e.y * cellPx;
        ctx.fillStyle = currentLayer === 'personajes' ? 'rgba(74,158,255,0.5)' : 'rgba(255,74,74,0.5)';
        ctx.beginPath();
        ctx.arc(ex, ey, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(e.entityId || '?', ex, ey - 10);
        if (e.direction) {
          ctx.strokeStyle = currentLayer === 'personajes' ? '#58a6ff' : '#ff7b72';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const dirAngle = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
          const a = dirAngle[e.direction] || 0;
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14);
          ctx.stroke();
        }
        if (cellPx >= 24) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(ex - cellPx / 2, ey - cellPx / 2, cellPx, cellPx);
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.fillText('(' + e.x.toFixed(1) + ', ' + e.y.toFixed(1) + ')', ex, ey + 4);
        }
      });
    }
  }

  function updateProperties() {
    if (!mapData) {
      propContent.innerHTML = '<p class="muted">Carga o crea un mapa</p>';
      document.getElementById('mapSizeLabel').textContent = '\u2014';
      document.getElementById('deleteMapGroup').style.display = 'none';
      return;
    }
    document.getElementById('deleteMapGroup').style.display = '';
    document.getElementById('mapSizeLabel').textContent = mapData.width + 'x' + mapData.height + ' \u00B7 ' + mapData.mode;

    const sel = document.getElementById('selModo');
    sel.value = mapData.mode || '2d';

    renderDefaultMapIndicator();
    if (currentLayer === 'personajes' || currentLayer === 'enemigos') {
      exitsContent.innerHTML = '';
      showEntities();
    } else {
      propContent.innerHTML = '<p class="muted">Selecciona un tile en el mapa</p>';
      showExits();
    }
  }

  function showExits() {
    if (!mapData || !mapData.exits || mapData.exits.length === 0) {
      exitsContent.innerHTML = '<p class="muted">Sin salidas</p>';
      return;
    }
    const dirArrow = { up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6' };
    let html = '';
    mapData.exits.forEach((e, i) => {
      const dir = e.direction || 'up';
      const arrow = dirArrow[dir] || '\u25B2';
      const targetName = getMapNameFromTarget(e.target);
      const exists = targetName ? mapList.some(m => (m.fileId || m.fileName.replace('.json', '')) === targetName) : true;
      html += '<div class="exit-card" data-exit="' + i + '">';
      html += '<div class="exit-card-header">';
      html += '<span class="exit-arrow">' + arrow + '</span>';
      html += '<span class="exit-label-text">' + (e.label || e.connectionId || targetName || '\u2014') + '</span>';
      if (e.locked) html += '<span class="exit-locked">\uD83D\uDD12</span>';
      html += '</div>';
      html += '<div class="exit-row"><span class="exit-label">Tile</span><span class="exit-value">(' + e.tileX + ', ' + e.tileY + ')</span></div>';
      if (e.connectionId) {
        html += '<div class="exit-row"><span class="exit-label">Conexi\u00F3n</span><span class="exit-value" style="color:#58a6ff">' + e.connectionId + '</span></div>';
      }
      html += '<div class="exit-row"><span class="exit-label">Destino</span><span class="exit-value">' + (targetName || '\u2014') + (targetName && !exists ? ' <span style="color:#f85149">(no existe)</span>' : '') + '</span></div>';
      html += '<div class="exit-card-actions">';
      html += '<span class="exit-edit" data-exit="' + i + '">Editar</span>';
      html += '<span class="exit-del" data-exit="' + i + '">Eliminar</span>';
      html += '</div>';
      html += '</div>';
    });
    exitsContent.innerHTML = html;
    exitsContent.querySelectorAll('.exit-del').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const i = parseInt(el.dataset.exit);
        mapData.exits.splice(i, 1);
        showExits();
        render();
      });
    });
    exitsContent.querySelectorAll('.exit-card, .exit-edit').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('exit-del')) return;
        const card = el.closest('.exit-card') || el;
        const i = parseInt(card.dataset.exit);
        if (!isNaN(i) && mapData.exits[i]) {
          openExitModal(mapData.exits[i], i);
        }
      });
    });
  }

  function showEntities() {
    exitsContent.innerHTML = '';
    const isChars = currentLayer === 'personajes';
    const entities = isChars ? (mapData.characters || []) : (mapData.enemies || []);
    const label = isChars ? 'Personajes' : 'Enemigos';
    if (entities.length === 0) {
      propContent.innerHTML = '<p class="muted">Sin ' + label.toLowerCase() + '</p>'
        + '<button id="btnAddEntity" class="tool-btn-sm" style="margin-top:0.5rem">+ A\u00F1adir ' + label.slice(0, -1) + '</button>';
    } else {
      let html = '';
      entities.forEach((e, i) => {
        html += '<div class="exit-card" data-entity="' + i + '">';
        html += '<div class="exit-card-header">';
        html += '<span class="exit-label-text">' + (e.entityId || '\u2014') + '</span>';
        html += '</div>';
        html += '<div class="exit-row"><span class="exit-label">Pos</span><span class="exit-value">(' + e.x.toFixed(1) + ', ' + e.y.toFixed(1) + ')</span></div>';
        if (e.direction) {
          html += '<div class="exit-row"><span class="exit-label">Dir</span><span class="exit-value">' + e.direction + '</span></div>';
        }
        html += '<div class="exit-card-actions">';
        html += '<span class="exit-edit" data-entity="' + i + '">Editar</span>';
        html += '<span class="exit-del" data-entity="' + i + '">Eliminar</span>';
        html += '</div></div>';
      });
      html += '<button id="btnAddEntity" class="tool-btn-sm" style="margin-top:0.5rem">+ A\u00F1adir ' + label.slice(0, -1) + '</button>';
      propContent.innerHTML = html;
    }

    document.getElementById('btnAddEntity').addEventListener('click', () => {
      openEntityModal(currentLayer, { entityId: '', x: 0.5, y: 0.5 }, -1);
    });

    document.querySelectorAll('.exit-del[data-entity]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const i = parseInt(el.dataset.entity);
        const arr = isChars ? mapData.characters : mapData.enemies;
        if (arr) arr.splice(i, 1);
        showEntities();
        render();
      });
    });

    document.querySelectorAll('.exit-edit[data-entity], .exit-card[data-entity]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('exit-del')) return;
        const card = el.closest('.exit-card') || el;
        const i = parseInt(card.dataset.entity);
        const arr = isChars ? mapData.characters : mapData.enemies;
        if (!isNaN(i) && arr && arr[i]) {
          openEntityModal(currentLayer, arr[i], i);
        }
      });
    });
  }

  function openEntityModal(layer, entityData, index) {
    const isEdit = index >= 0;
    const isChar = layer === 'personajes';
    const label = isChar ? 'Personaje' : 'Enemigo';

    const entityList = Object.keys(atlasSprites || {}).filter(k => {
      const e = atlasSprites[k];
      return e && (e.type === 'character' || !e.type);
    }).sort();

    function getDirOpts(entityId, currentDir) {
      const s = atlasSprites[entityId];
      const df = s && s.dirFrames;
      if (!df) return '';
      const keys = Object.keys(df);
      return keys.map(k =>
        '<option value="' + k + '"' + (currentDir === k ? ' selected' : '') + '>' + k + '</option>'
      ).join('');
    }

    const entityOpts = entityList.map(id => {
      const e = atlasSprites[id];
      const tag = e && e.atlasName ? ' [' + e.atlasName + ']' : '';
      return '<option value="' + id + '"' + (entityData.entityId === id ? ' selected' : '') + '>' + id + tag + '</option>';
    }).join('');

    showModal((isEdit ? 'Editar ' : 'A\u00F1adir ') + label,
      '<div class="modal-field"><label>Entidad</label><select id="fEntityId" style="width:100%">'
        + '<option value="">Seleccionar...</option>' + entityOpts + '</select></div>' +
      '<div class="modal-field" id="fDirField" style="' + (!atlasSprites[entityData.entityId] || !atlasSprites[entityData.entityId].dirFrames ? 'display:none' : '') + '"><label>Direcci\u00F3n</label><select id="fDirection" style="width:100%">'
        + getDirOpts(entityData.entityId, entityData.direction) + '</select></div>' +
      '<div class="modal-field"><label>Posici\u00F3n X</label><input type="number" id="fEntityX" value="' + entityData.x + '" step="0.1" min="0" max="' + (mapData ? mapData.width : 99) + '"></div>' +
      '<div class="modal-field"><label>Posici\u00F3n Y</label><input type="number" id="fEntityY" value="' + entityData.y + '" step="0.1" min="0" max="' + (mapData ? mapData.height : 99) + '"></div>',
      () => {
        const entityId = document.getElementById('fEntityId').value;
        const x = parseFloat(document.getElementById('fEntityX').value);
        const y = parseFloat(document.getElementById('fEntityY').value);
        if (!entityId) { alert('Seleccion\u00E1 una entidad'); return; }

        const obj = { entityId, x, y };
        const dirSel = document.getElementById('fDirection');
        if (dirSel && dirSel.options.length > 0) {
          obj.direction = dirSel.value;
        }
        const arr = isChar ? mapData.characters : mapData.enemies;
        if (!arr) return;
        if (isEdit && index >= 0) {
          arr[index] = obj;
        } else {
          arr.push(obj);
        }
        showEntities();
        render();
      }
    );

    setTimeout(() => {
      const entitySel = document.getElementById('fEntityId');
      if (!entitySel) return;
      entitySel.addEventListener('change', () => {
        const dirField = document.getElementById('fDirField');
        const dirSel2 = document.getElementById('fDirection');
        if (!dirField || !dirSel2) return;
        const s = atlasSprites[entitySel.value];
        const df = s && s.dirFrames;
        if (df) {
          dirField.style.display = '';
          const keys = Object.keys(df);
          dirSel2.innerHTML = keys.map(k => '<option value="' + k + '">' + k + '</option>').join('');
        } else {
          dirField.style.display = 'none';
          dirSel2.innerHTML = '';
        }
      });
    }, 0);
  }

  function showTileProps(col, row) {
    if (!mapData) return;
    let html = '';
    html += '<div class="prop-row"><span class="prop-label">Tile</span><span class="prop-value">(' + col + ', ' + row + ')</span></div>';
    ['estructura', 'terreno', 'objetos', 'eventos'].forEach(l => {
      const id = getTileAt(l, col, row);
      const t = tilePalette.find(p => p.id === id);
      const name = t ? t.name : '\u2014';
      const entityId = t && t.entityId ? t.entityId : null;
      html += '<div class="prop-row"><span class="prop-label">' + l + '</span><span class="prop-value"><span class="devtools-color-swatch" style="background:' + getTileColor(id) + '"></span>' + name + ' (ID ' + id + ')' + (entityId ? ' <span style="color:#58a6ff;font-size:0.7rem">' + entityId + '</span>' : '') + '</span></div>';
    });
    propContent.innerHTML = html;
  }

  function newMap(w, h, mode) {
    function makeGrid(rows, cols) {
      return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    const tileColors = {};
    const tileSprites = {};
    tilePalette.forEach(t => {
      if (t.id === 0) return;
      tileColors[t.id] = {
        color: t.color || '#888',
        name: t.name || 'Tile ' + t.id,
        solid: t.solid || false,
      };
      if (t.entityId) {
        tileSprites[t.id] = t.entityId;
      }
    });

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
        estructura: makeGrid(h || 20, w || 25),
        objetos: makeGrid(h || 20, w || 25),
        personajes: makeGrid(h || 20, w || 25),
        eventos: makeGrid(h || 20, w || 25),
      },
      tileColors: tileColors,
      tileSprites: tileSprites,
      exits: [],
      characters: [],
      enemies: [],
      lightBounces: 3,
    };
    currentLayer = 'estructura';
    selectedTile = tilePalette[0];
    renderPalette();
    selectTile(selectedTile);
    updateProperties();
    render();
  }

  function resizeMap(newW, newH) {
    if (!mapData) return;
    const oldW = mapData.width;
    const oldH = mapData.height;
    if (newW < 2 || newW > 200 || newH < 2 || newH > 200) {
      alert('Las dimensiones deben estar entre 2 y 200');
      return;
    }
    if (newW === oldW && newH === oldH) return;

    mapData.width = newW;
    mapData.height = newH;

    const layerNames = ['terreno', 'estructura', 'objetos', 'personajes', 'eventos'];
    layerNames.forEach(layer => {
      const grid = mapData.layers[layer];
      if (!grid) return;
      const newGrid = [];
      for (let r = 0; r < newH; r++) {
        if (r < oldH) {
          const row = grid[r].slice(0, newW);
          while (row.length < newW) row.push(0);
          newGrid.push(row);
        } else {
          newGrid.push(Array(newW).fill(0));
        }
      }
      mapData.layers[layer] = newGrid;
    });

    if (mapData.playerStart) {
      mapData.playerStart.x = Math.min(mapData.playerStart.x, newW - 1);
      mapData.playerStart.y = Math.min(mapData.playerStart.y, newH - 1);
    }

    if (mapData.exits) {
      mapData.exits = mapData.exits.filter(e => e.tileX < newW && e.tileY < newH);
    }
    if (mapData.characters) {
      mapData.characters = mapData.characters.filter(c => c.x < newW && c.y < newH);
    }
    if (mapData.enemies) {
      mapData.enemies = mapData.enemies.filter(e => e.x < newW && e.y < newH);
    }

    updateProperties();
    render();
  }

  async function loadMap(path) {
    try {
      const res = await fetch(path + '?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      mapData = await res.json();

      migrateEditorMapData(mapData);

      remapMapIds();
      syncTileMetadataFromAtlas();
      currentLayer = 'estructura';
      updateProperties();
      render();
      renderPalette();
      selectTile(tilePalette[0] || { id: 0, name: 'Vac\u00EDo', color: '#000000' });
    } catch (err) {
      alert('Error al cargar mapa: ' + err.message);
    }
  }

  async function saveMap() {
    if (!mapData) return;
    setSaveStatus('\u231B Guardando...', '#ffd700');
    try {
      const name = (mapData.name || 'mapa').replace(/\s+/g, '_').toLowerCase();
      const res = await fetch('/api/mapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: mapData }),
      });
      const result = await res.json();
      if (result.ok) {
        setSaveStatus('\u2705 Guardado: ' + name, '#3fb950');
        loadMapList();
      } else {
        setSaveStatus('\u274C Error: ' + (result.error || 'desconocido'), '#f85149');
      }
    } catch (err) {
      setSaveStatus('\u274C Error de red', '#f85149');
    }
  }

  function setSaveStatus(msg, color) {
    saveStatus.textContent = msg;
    saveStatus.style.color = color || '#8b949e';
    saveStatus.style.opacity = '1';
    setTimeout(() => {
      if (saveStatus.textContent === msg) {
        saveStatus.style.opacity = '0';
        setTimeout(() => { if (saveStatus.textContent === msg) saveStatus.textContent = ''; }, 300);
      }
    }, 4000);
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellPx = zoom * (mapData ? (mapData.tileSize || tileSize) : tileSize);
    return { col: Math.floor(x / cellPx), row: Math.floor(y / cellPx) };
  }

  canvas.addEventListener('click', e => {
    if (!mapData) return;
    clearTimeout(clickTimeout);
    const { col, row } = getCanvasCoords(e);
    if (col < 0 || col >= mapData.width || row < 0 || row >= mapData.height) return;

    if (currentLayer === 'cielo') {
      showTileProps(col, row);
      return;
    }

    if (currentLayer === 'personajes' || currentLayer === 'enemigos') {
      const entities = currentLayer === 'personajes' ? (mapData.characters || []) : (mapData.enemies || []);
      const existing = entities.findIndex(e => Math.floor(e.x) === col && Math.floor(e.y) === row);
      if (existing >= 0) {
        openEntityModal(currentLayer, entities[existing], existing);
      } else {
        openEntityModal(currentLayer, { entityId: '', x: col + 0.5, y: row + 0.5 }, -1);
      }
      return;
    }

    clickTimeout = setTimeout(() => {
      if (selectedTile && selectedTile.id !== undefined) {
        setTileAt(currentLayer, col, row, selectedTile.id);
        render();
        showTileProps(col, row);
      }
    }, 250);
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
      updateProperties();
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
    zoom = Math.min(zoom * 1.25, 8);
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

  document.getElementById('btnAbrir').addEventListener('click', async () => {
    let optionsHtml = '';
    try {
      const res = await fetch('/api/mapas?t=' + Date.now());
      const mapas = await res.json();
      if (Array.isArray(mapas)) {
        mapas.forEach(m => {
          const label = (m.name || m.fileId) + (m.error ? ' (' + m.error + ')' : '');
          const val = m.fileId || m.fileName.replace('.json', '');
          optionsHtml += '<option value="' + val + '">' + label + '</option>';
        });
      }
    } catch (e) {
      optionsHtml = '<option value="">Error al cargar lista</option>';
    }

    showModal('Abrir Mapa',
      '<div class="modal-field"><label>Mapas del servidor</label><select id="fMapSelect">' +
      optionsHtml +
      '</select></div>' +
      '<div class="modal-field"><label>O sube un archivo</label><input type="file" id="fFileInput" accept=".json"></div>',
      () => {
        const fileInput = document.getElementById('fFileInput');
        if (fileInput.files && fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = e => {
            try {
              mapData = JSON.parse(e.target.result);
              migrateEditorMapData(mapData);
              remapMapIds();
              syncTileMetadataFromAtlas();
              currentLayer = 'estructura';
              updateProperties();
              render();
              renderPalette();
              selectTile(tilePalette[0]);
            } catch(err) {
              alert('Error al parsear JSON: ' + err.message);
            }
          };
          reader.readAsText(fileInput.files[0]);
        } else {
          const mapName = document.getElementById('fMapSelect').value;
          if (mapName) loadMap('/maps/' + mapName + '.json');
        }
      }
    );
  });

  document.getElementById('btnGuardar').addEventListener('click', saveMap);

  document.getElementById('btnSettings').addEventListener('click', () => {
    if (!mapData) return;
    const current = mapData.lightBounces !== undefined ? mapData.lightBounces : 3;
    showModal('Ajustes del Mapa',
      '<div class="modal-field"><label>Rebotes de luz (0–5)</label>' +
      '<input type="number" id="fLightBounces" value="' + current + '" min="0" max="5" style="width:80px"></div>' +
      '<p style="font-size:0.75rem;color:#8b949e;margin-top:4px">0 = solo luz directa, 3 = recomendado</p>',
      () => {
        const v = parseInt(document.getElementById('fLightBounces').value);
        if (!isNaN(v) && v >= 0 && v <= 5) mapData.lightBounces = v;
      }
    );
  });

  document.getElementById('btnEliminar').addEventListener('click', async () => {
    if (!mapData) return;
    const name = (mapData.name || 'mapa').replace(/\s+/g, '_').toLowerCase();
    if (!confirm('¿Eliminar el mapa "' + name + '" definitivamente?')) return;
    try {
      const res = await fetch('/api/mapas/' + encodeURIComponent(name), { method: 'DELETE' });
      const result = await res.json();
      if (result.ok) {
        setSaveStatus('🗑️ Eliminado: ' + name, '#f85149');
        mapData = null;
        document.getElementById('deleteMapGroup').style.display = 'none';
        updateProperties();
        resizeCanvas();
        render();
        loadMapList();
      } else {
        alert('Error al eliminar: ' + (result.error || 'desconocido'));
      }
    } catch (err) {
      alert('Error de red al eliminar');
    }
  });

  document.getElementById('btnResize').addEventListener('click', () => {
    if (!mapData) return;
    showModal('Redimensionar Mapa',
      '<div class="modal-field"><label>Ancho (tiles)</label><input type="number" id="fResizeW" value="' + mapData.width + '" min="2" max="200"></div>' +
      '<div class="modal-field"><label>Alto (tiles)</label><input type="number" id="fResizeH" value="' + mapData.height + '" min="2" max="200"></div>' +
      '<p class="muted" style="font-size:0.75rem">Si reduc\u00EDs el tama\u00F1o, los tiles fuera del nuevo l\u00EDmite se perder\u00E1n.</p>',
      () => {
        const w = parseInt(document.getElementById('fResizeW').value);
        const h = parseInt(document.getElementById('fResizeH').value);
        if (!w || !h || w < 2 || h < 2) { alert('Dimensiones inv\u00E1lidas'); return; }
        resizeMap(w, h);
      }
    );
  });

  document.getElementById('btnAddExit').addEventListener('click', () => {
    if (!mapData) return;
    openExitModal(null);
  });

  canvas.addEventListener('dblclick', e => {
    clearTimeout(clickTimeout);
    if (!mapData || currentLayer === 'cielo') return;
    const { col, row } = getCanvasCoords(e);
    if (col < 0 || col >= mapData.width || row < 0 || row >= mapData.height) return;
    if (currentLayer === 'personajes' || currentLayer === 'enemigos') {
      const entities = currentLayer === 'personajes' ? (mapData.characters || []) : (mapData.enemies || []);
      const existing = entities.findIndex(en => Math.floor(en.x) === col && Math.floor(en.y) === row);
      if (existing >= 0) {
        openEntityModal(currentLayer, entities[existing], existing);
      } else {
        openEntityModal(currentLayer, { entityId: '', x: col + 0.5, y: row + 0.5 }, -1);
      }
      return;
    }
    const existing = (mapData.exits || []).findIndex(ex => ex.tileX === col && ex.tileY === row);
    if (existing >= 0) {
      openExitModal(mapData.exits[existing], existing);
    } else {
      openExitModal({ tileX: col, tileY: row, target: '', spawnX: 2.5, spawnY: 2.5, locked: false, keyId: null });
    }
  });

  async function loadDefaultMap() {
    try {
      const res = await fetch('/api/mapas/default');
      if (res.ok) {
        const data = await res.json();
        defaultMapName = data.defaultMap || 'inicio';
      }
    } catch {}
  }

  async function loadMapList() {
    try {
      const res = await fetch('/api/mapas');
      if (res.ok) {
        mapList = await res.json();
      }
    } catch {}
  }

  function renderDefaultMapIndicator() {
    const el = document.getElementById('defaultMapLabel');
    if (!mapData) { el.textContent = ''; return; }
    const name = mapData.name || '';
    if (defaultMapName && name.toLowerCase() === defaultMapName.toLowerCase()) {
      el.innerHTML = '\u2605 <strong>Mapa inicial</strong>';
      el.style.color = '#ffd700';
    } else {
      el.innerHTML = '\u2606 <a href="#" id="btnSetDefault" style="color:#8b949e;text-decoration:none">Mapa inicial</a>';
      el.style.color = '#484f58';
      const btn = document.getElementById('btnSetDefault');
      if (btn) btn.addEventListener('click', async e => {
        e.preventDefault();
        try {
          const fileId = (mapData.name || 'mapa').replace(/\s+/g, '_').toLowerCase();
          const r = await fetch('/api/mapas/default', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultMap: fileId }),
          });
          if (r.ok) {
            defaultMapName = fileId;
            renderDefaultMapIndicator();
            setSaveStatus('\u2705 Mapa inicial actualizado', '#3fb950');
          }
        } catch {}
      });
    }
  }

  function getMapNameFromTarget(target) {
    if (!target) return '';
    return target.replace('/maps/', '').replace('.json', '');
  }

  function collectConnectionIds() {
    const ids = new Set();
    for (const m of mapList) {
      if (!m.exits) continue;
      for (const ex of m.exits) {
        if (ex.connectionId) ids.add(ex.connectionId);
      }
    }
    return Array.from(ids).sort();
  }

  async function resolveConnection(label) {
    try {
      const res = await fetch('/api/mapas/resolve-label?label=' + encodeURIComponent(label));
      const data = await res.json();
      return data;
    } catch {
      return { found: false };
    }
  }

  function openExitModal(exitData, index) {
    const isEdit = index !== undefined && index >= 0;
    editingExitIndex = isEdit ? index : -1;

    const mapOptions = mapList.map(m => {
      const val = m.fileId || m.fileName.replace('.json', '');
      const label = m.name || val;
      return '<option value="' + val + '"' + (exitData && getMapNameFromTarget(exitData.target) === val ? ' selected' : '') + '>' + label + '</option>';
    }).join('');

    const targetVal = exitData ? exitData.target : '';
    const directionVal = exitData ? (exitData.direction || 'up') : 'up';
    const labelVal = exitData ? (exitData.label || '') : '';
    const lockedVal = exitData ? (exitData.locked || false) : false;
    const keyIdVal = exitData ? (exitData.keyId || '') : '';
    const spawnXVal = exitData ? exitData.spawnX : '2.5';
    const spawnYVal = exitData ? exitData.spawnY : '2.5';
    const tileXVal = exitData ? exitData.tileX : 0;
    const tileYVal = exitData ? exitData.tileY : 0;
    const connIdVal = exitData ? (exitData.connectionId || '') : '';

    const connIds = collectConnectionIds();
    const datalistOpts = connIds.map(id => '<option value="' + id + '">').join('');

    showModal(isEdit ? 'Editar Exit' : 'A\u00F1adir Exit',
      '<div class="modal-field"><label>Tile X</label><input type="number" id="fExitX" value="' + tileXVal + '" min="0" max="' + (mapData ? mapData.width - 1 : 99) + '"></div>' +
      '<div class="modal-field"><label>Tile Y</label><input type="number" id="fExitY" value="' + tileYVal + '" min="0" max="' + (mapData ? mapData.height - 1 : 99) + '"></div>' +
      '<div class="modal-field"><label>ID de conexi\u00F3n</label>' +
        '<input type="text" id="fExitConnId" value="' + connIdVal + '" list="connIdList" placeholder="ej: cueva_entrada" style="width:100%">' +
        '<datalist id="connIdList">' + datalistOpts + '</datalist>' +
        '<div style="display:flex;gap:0.3rem;margin-top:0.3rem">' +
          '<span id="connStatus" style="font-size:0.75rem;color:#8b949e"></span>' +
          '<button id="btnResolveConn" class="tool-btn-sm" type="button" style="font-size:0.7rem">Buscar conexi\u00F3n</button>' +
        '</div>' +
      '</div>' +
      '<div class="modal-field"><label>Mapa destino</label><select id="fExitTarget">' + mapOptions + '</select></div>' +
      (mapList.length === 0 ? '<p class="muted" style="font-size:0.75rem;margin-top:-0.5rem;margin-bottom:0.5rem">No se pudieron cargar los mapas</p>' : '') +
      '<div class="modal-field"><label>Etiqueta</label><input type="text" id="fExitLabel" value="' + labelVal + '" placeholder="ej: Entrada a la Cueva"></div>' +
      '<div class="modal-field"><label>Direcci\u00F3n</label><select id="fExitDirection">' +
        '<option value="up"' + (directionVal === 'up' ? ' selected' : '') + '>\u25B2 Arriba</option>' +
        '<option value="down"' + (directionVal === 'down' ? ' selected' : '') + '>\u25BC Abajo</option>' +
        '<option value="left"' + (directionVal === 'left' ? ' selected' : '') + '>\u25C0 Izquierda</option>' +
        '<option value="right"' + (directionVal === 'right' ? ' selected' : '') + '>\u25B6 Derecha</option>' +
      '</select></div>' +
      '<div class="modal-field"><label>Spawn X</label><input type="number" id="fExitSpawnX" value="' + spawnXVal + '" step="0.1"></div>' +
      '<div class="modal-field"><label>Spawn Y</label><input type="number" id="fExitSpawnY" value="' + spawnYVal + '" step="0.1"></div>' +
      '<div class="modal-field"><label><input type="checkbox" id="fExitLocked"' + (lockedVal ? ' checked' : '') + '> Bloqueado (require llave)</label></div>' +
      '<div class="modal-field" id="fKeyField"' + (lockedVal ? '' : ' style="display:none"') + '><label>ID de llave</label><input type="text" id="fExitKeyId" value="' + keyIdVal + '" placeholder="ej: llave_cueva"></div>',
      () => {
        const tileX = parseInt(document.getElementById('fExitX').value);
        const tileY = parseInt(document.getElementById('fExitY').value);
        const target = document.getElementById('fExitTarget').value;
        const direction = document.getElementById('fExitDirection').value;
        const label = document.getElementById('fExitLabel').value.trim();
        const locked = document.getElementById('fExitLocked').checked;
        const keyId = document.getElementById('fExitKeyId') ? document.getElementById('fExitKeyId').value.trim() : '';
        const spawnX = parseFloat(document.getElementById('fExitSpawnX').value);
        const spawnY = parseFloat(document.getElementById('fExitSpawnY').value);
        const connectionId = document.getElementById('fExitConnId').value.trim() || null;

        const exitObj = {
          tileX, tileY,
          target: target ? (target.startsWith('/maps/') ? target : '/maps/' + target + '.json') : null,
          spawnX, spawnY,
          label: label || null,
          connectionId: connectionId,
          direction: direction || 'up',
          locked: locked || false,
          keyId: keyId || null,
        };

        if (!mapData.exits) mapData.exits = [];
        if (isEdit && editingExitIndex >= 0) {
          mapData.exits[editingExitIndex] = exitObj;
        } else {
          mapData.exits.push(exitObj);
        }
        editingExitIndex = -1;
        showExits();
        render();
      }
    );

    const lockedChk = document.getElementById('fExitLocked');
    if (lockedChk) {
      lockedChk.addEventListener('change', () => {
        const kf = document.getElementById('fKeyField');
        if (kf) kf.style.display = lockedChk.checked ? '' : 'none';
      });
    }

    const connInput = document.getElementById('fExitConnId');
    const connStatus = document.getElementById('connStatus');
    if (connInput && connStatus) {
      if (connInput.value) {
        connStatus.textContent = connInput.value + ' \u2014 Conectando...';
        resolveConnection(connInput.value).then(data => {
          if (data.found) {
            connStatus.textContent = '\uD83D\uDD17 Conectado a ' + data.fileId + ' (' + data.tileX + ', ' + data.tileY + ')';
            connStatus.style.color = '#3fb950';
          } else {
            connStatus.textContent = '\u26A0\uFE0F Sin conectar';
            connStatus.style.color = '#f85149';
          }
        });
      }
      const resolveBtn = document.getElementById('btnResolveConn');
      if (resolveBtn) {
        resolveBtn.addEventListener('click', async () => {
          const label = connInput.value.trim();
          if (!label) { connStatus.textContent = 'Ingres\u00E1 un ID de conexi\u00F3n'; return; }
          connStatus.textContent = 'Buscando...';
          connStatus.style.color = '#8b949e';
          const data = await resolveConnection(label);
          if (data.found) {
            connStatus.textContent = '\uD83D\uDD17 Conectado a ' + data.fileId + ' (' + data.tileX + ', ' + data.tileY + ')';
            connStatus.style.color = '#3fb950';
            const targetSel = document.getElementById('fExitTarget');
            if (targetSel) targetSel.value = data.fileId;
            const sx = document.getElementById('fExitSpawnX');
            const sy = document.getElementById('fExitSpawnY');
            if (sx) sx.value = (data.tileX + 0.5).toFixed(1);
            if (sy) sy.value = (data.tileY + 0.5).toFixed(1);
          } else {
            connStatus.textContent = '\u26A0\uFE0F Sin conectar \u2014 no hay otra puerta con esta etiqueta';
            connStatus.style.color = '#f85149';
          }
        });
      }
    }
  }

  function migrateEditorMapData(data) {
    if (!data.layers) {
      const h = data.height;
      const w = data.width;
      data.layers = {
        cielo: { type: 'solid', color: '#1a1a2e' },
        terreno: Array.from({ length: h }, () => Array(w).fill(0)),
        estructura: data.tiles || Array.from({ length: h }, () => Array(w).fill(0)),
        objetos: Array.from({ length: h }, () => Array(w).fill(0)),
        personajes: Array.from({ length: h }, () => Array(w).fill(0)),
        eventos: Array.from({ length: h }, () => Array(w).fill(0)),
      };
      delete data.tiles;
    } else {
      if (data.layers.mundo && !data.layers.estructura) {
        data.layers.estructura = data.layers.mundo;
        delete data.layers.mundo;
      }
      if (!data.layers.objetos) {
        data.layers.objetos = Array.from({ length: data.height }, () => Array(data.width).fill(0));
      }
    }
    if (!data.characters) data.characters = [];
    if (!data.enemies) data.enemies = [];
  }

  async function init() {
    await Promise.all([
      loadAtlases(),
      loadDefaultMap(),
      loadMapList(),
    ]);
    renderPalette();
    selectTile(tilePalette[0] || { id: 0, name: 'Vac\u00EDo', color: '#000000' });
    newMap(25, 20, '2d');
  }

  init();

})();