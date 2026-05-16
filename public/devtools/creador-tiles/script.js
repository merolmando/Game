(function() {

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#ff0040', '#ff8c00',
    '#ffd700', '#00e436', '#00b8c4', '#0044ff',
    '#8b00ff', '#ff69b4', '#8b4513', '#808080',
    '#4a7c3f', '#5c4033', '#2e6da4', '#b8860b',
  ];

  let currentTool = 'pencil';
  let currentColor = '#ffffff';
  let canvasW = 32;
  let canvasH = 32;
  let zoom = 8;
  let currentFrame = 0;
  let totalFrames = 1;
  let isDrawing = false;
  let toolStart = null;
  let toolCurrent = null;

  const framesData = [];

  let layers = {};
  let layerOrder = [];
  let activeLayer = '_all';

  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO = 50;

  const drawCanvas = document.getElementById('drawCanvas');
  const ctx = drawCanvas.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');
  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas.getContext('2d');

  function initLayers() {
    layers = { '_all': { frames: totalFrames, animSpeed: 0 } };
    layerOrder = ['_all'];
    activeLayer = '_all';
    renderLayerTabs();
  }

  function getLayerFrames() {
    const l = layers[activeLayer];
    return l ? l.frames : totalFrames;
  }

  function setActiveLayer(name) {
    if (!layers[name]) return;
    activeLayer = name;
    const l = layers[name];
    let frameOffset = 0;
    for (const ln of layerOrder) {
      if (ln === name) break;
      frameOffset += layers[ln].frames;
    }
    if (currentFrame < frameOffset || currentFrame >= frameOffset + l.frames) {
      currentFrame = frameOffset;
    }
    syncFrameNav();
    renderLayerTabs();
    render();
    renderPreview();
  }

  function renderLayerTabs() {
    const container = document.getElementById('layerTabs');
    container.innerHTML = '';
    const show = Object.keys(layers).length > 1 || (layers['_all'] && layers['_all'].frames < totalFrames);
    document.getElementById('layerSection').style.display = show ? 'block' : 'none';
    document.getElementById('btnRemoveLayer').disabled = layerOrder.length <= 1;
    layerOrder.forEach(name => {
      const btn = document.createElement('button');
      btn.className = 'layer-tab' + (name === activeLayer ? ' active' : '');
      const l = layers[name];
      btn.textContent = (name === '_all' ? 'Todo' : name) + ' (' + l.frames + ')';
      btn.title = 'AnimSpeed: ' + (l.animSpeed || 0);
      btn.addEventListener('click', () => setActiveLayer(name));
      container.appendChild(btn);
    });
  }

  function initFrames() {
    framesData.length = 0;
    for (let f = 0; f < totalFrames; f++) {
      const grid = [];
      for (let r = 0; r < canvasH; r++) {
        const row = [];
        for (let c = 0; c < canvasW; c++) row.push(null);
        grid.push(row);
      }
      framesData.push(grid);
    }
  }

  function getActiveGrid() {
    return framesData[currentFrame] || null;
  }

  function resizeDrawCanvas() {
    drawCanvas.width = canvasW * zoom;
    drawCanvas.height = canvasH * zoom;
    drawCanvas.style.width = (canvasW * zoom) + 'px';
    drawCanvas.style.height = (canvasH * zoom) + 'px';
  }

  function render() {
    resizeDrawCanvas();
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    const grid = getActiveGrid();
    if (!grid) return;

    const z = zoom;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const color = grid[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * z, r * z, z, z);
        }
      }
    }

    if (isDrawing && toolStart && toolCurrent && (currentTool === 'line' || currentTool === 'rect')) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(toolStart.col * z + z / 2, toolStart.row * z + z / 2);
        ctx.lineTo(toolCurrent.col * z + z / 2, toolCurrent.row * z + z / 2);
        ctx.stroke();
      } else {
        const x = Math.min(toolStart.col, toolCurrent.col) * z;
        const y = Math.min(toolStart.row, toolCurrent.row) * z;
        const w = (Math.abs(toolCurrent.col - toolStart.col) + 1) * z;
        const h = (Math.abs(toolCurrent.row - toolStart.row) + 1) * z;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, w, h);
      }
    }

    if (z >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let r = 0; r <= grid.length; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * z);
        ctx.lineTo(drawCanvas.width, r * z);
        ctx.stroke();
      }
      for (let c = 0; c <= (grid[0] || []).length; c++) {
        ctx.beginPath();
        ctx.moveTo(c * z, 0);
        ctx.lineTo(c * z, drawCanvas.height);
        ctx.stroke();
      }
    }
  }

  function renderPreview() {
    const grid = getActiveGrid();
    if (!grid) return;
    previewCanvas.width = canvasW;
    previewCanvas.height = canvasH;
    previewCtx.clearRect(0, 0, canvasW, canvasH);
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const color = grid[r][c];
        if (color) {
          previewCtx.fillStyle = color;
          previewCtx.fillRect(c, r, 1, 1);
        }
      }
    }
    document.getElementById('previewSize').textContent = canvasW + '\u00d7' + canvasH + ' px';
  }

  function syncFrameNav() {
    const lf = getLayerFrames();
    const nav = document.getElementById('frameNav');
    nav.style.display = lf > 1 || totalFrames > 1 ? 'block' : 'none';
    let offset = 0;
    for (const ln of layerOrder) {
      if (ln === activeLayer) break;
      offset += layers[ln].frames;
    }
    const localFrame = currentFrame - offset;
    document.getElementById('frameLabel').textContent = (localFrame + 1) + ' / ' + lf;
  }

  function getPixelCoords(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const z = zoom;
    return { col: Math.floor(x / z), row: Math.floor(y / z) };
  }

  function setPixel(col, row, color) {
    const grid = getActiveGrid();
    if (!grid) return;
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return;
    grid[row][col] = color;
  }

  function getPixel(col, row) {
    const grid = getActiveGrid();
    if (!grid) return null;
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return null;
    return grid[row][col];
  }

  function floodFill(col, row, fillColor) {
    const grid = getActiveGrid();
    if (!grid) return;
    const targetColor = getPixel(col, row);
    if (targetColor === fillColor) return;
    const visited = new Set();
    const stack = [[col, row]];
    while (stack.length > 0) {
      const [c, r] = stack.pop();
      const key = c + ',' + r;
      if (visited.has(key)) continue;
      visited.add(key);
      if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) continue;
      if (grid[r][c] !== targetColor) continue;
      grid[r][c] = fillColor;
      stack.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]);
    }
  }

  function plotLine(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    while (true) {
      points.push({ col: x, row: y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
  }

  function pushUndo() {
    const snap = framesData.map(grid => grid.map(row => [...row]));
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(framesData.map(grid => grid.map(row => [...row])));
    const snap = undoStack.pop();
    for (let f = 0; f < framesData.length && f < snap.length; f++) {
      for (let r = 0; r < framesData[f].length && r < snap[f].length; r++) {
        for (let c = 0; c < framesData[f][r].length && c < snap[f][r].length; c++) {
          framesData[f][r][c] = snap[f][r][c];
        }
      }
    }
    render();
    renderPreview();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(framesData.map(grid => grid.map(row => [...row])));
    const snap = redoStack.pop();
    for (let f = 0; f < framesData.length && f < snap.length; f++) {
      for (let r = 0; r < framesData[f].length && r < snap[f].length; r++) {
        for (let c = 0; c < framesData[f][r].length && c < snap[f][r].length; c++) {
          framesData[f][r][c] = snap[f][r][c];
        }
      }
    }
    render();
    renderPreview();
  }

  drawCanvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDrawing = true;
    const pos = getPixelCoords(e);

    if (currentTool === 'line' || currentTool === 'rect') {
      toolStart = { ...pos };
      toolCurrent = { ...pos };
      return;
    }

    pushUndo();

    if (currentTool === 'pencil') {
      setPixel(pos.col, pos.row, currentColor);
      render(); renderPreview();
    } else if (currentTool === 'eraser') {
      setPixel(pos.col, pos.row, null);
      render(); renderPreview();
    } else if (currentTool === 'fill') {
      floodFill(pos.col, pos.row, currentColor);
      render(); renderPreview();
    } else if (currentTool === 'picker') {
      const color = getPixel(pos.col, pos.row);
      if (color) setCurrentColor(color);
    }
  });

  drawCanvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    const pos = getPixelCoords(e);

    if (currentTool === 'line' || currentTool === 'rect') {
      toolCurrent = { ...pos };
      render();
      return;
    }

    if (currentTool === 'pencil') {
      setPixel(pos.col, pos.row, currentColor);
      render(); renderPreview();
    } else if (currentTool === 'eraser') {
      setPixel(pos.col, pos.row, null);
      render(); renderPreview();
    }
  });

  drawCanvas.addEventListener('mouseup', e => {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentTool === 'line' && toolStart && toolCurrent) {
      pushUndo();
      const points = plotLine(toolStart.col, toolStart.row, toolCurrent.col, toolCurrent.row);
      points.forEach(p => setPixel(p.col, p.row, currentColor));
      toolStart = null; toolCurrent = null;
      render(); renderPreview();
      return;
    }

    if (currentTool === 'rect' && toolStart && toolCurrent) {
      pushUndo();
      const x0 = Math.min(toolStart.col, toolCurrent.col);
      const y0 = Math.min(toolStart.row, toolCurrent.row);
      const x1 = Math.max(toolStart.col, toolCurrent.col);
      const y1 = Math.max(toolStart.row, toolCurrent.row);
      for (let r = y0; r <= y1; r++) {
        for (let c = x0; c <= x1; c++) {
          setPixel(c, r, currentColor);
        }
      }
      toolStart = null; toolCurrent = null;
      render(); renderPreview();
      return;
    }

    toolStart = null; toolCurrent = null;
  });

  document.addEventListener('mouseup', () => {
    if (isDrawing && (currentTool === 'line' || currentTool === 'rect')) {
      isDrawing = false;
      toolStart = null; toolCurrent = null;
      render();
    }
  });

  document.addEventListener('mouseleave', () => {
    if (isDrawing && (currentTool === 'line' || currentTool === 'rect')) {
      isDrawing = false;
      toolStart = null; toolCurrent = null;
      render();
    }
  });

  drawCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { col, row } = getPixelCoords(e);
    pushUndo();
    setPixel(col, row, null);
    render(); renderPreview();
  });

  drawCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoom = Math.min(zoom * 1.25, 24);
    } else {
      zoom = Math.max(zoom / 1.25, 1);
    }
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100 / 8 * 100) / 100 + '%';
    render();
  }, { passive: false });

  function setCurrentTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-icon-btn').forEach(b => b.classList.remove('active'));
    const map = { pencil: 'toolPencil', eraser: 'toolEraser', fill: 'toolFill', picker: 'toolPicker', line: 'toolLine', rect: 'toolRect' };
    const el = document.getElementById(map[tool]);
    if (el) el.classList.add('active');
    toolStart = null; toolCurrent = null;
  }

  document.getElementById('toolPencil').addEventListener('click', () => setCurrentTool('pencil'));
  document.getElementById('toolEraser').addEventListener('click', () => setCurrentTool('eraser'));
  document.getElementById('toolFill').addEventListener('click', () => setCurrentTool('fill'));
  document.getElementById('toolPicker').addEventListener('click', () => setCurrentTool('picker'));
  document.getElementById('toolLine').addEventListener('click', () => setCurrentTool('line'));
  document.getElementById('toolRect').addEventListener('click', () => setCurrentTool('rect'));

  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (ctrl && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
    if (ctrl && e.key === 'Z') { e.preventDefault(); redo(); return; }
    switch (e.key.toLowerCase()) {
      case 'b': setCurrentTool('pencil'); break;
      case 'e': setCurrentTool('eraser'); break;
      case 'g': setCurrentTool('fill'); break;
      case 'i': setCurrentTool('picker'); break;
      case 'l': setCurrentTool('line'); break;
      case 'r': setCurrentTool('rect'); break;
    }
  });

  function renderPalette() {
    const container = document.getElementById('colorPalette');
    container.innerHTML = '';
    PRESET_COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'color-swatch-btn' + (c === currentColor ? ' active' : '');
      btn.style.background = c;
      btn.dataset.color = c;
      btn.addEventListener('click', () => setCurrentColor(c));
      container.appendChild(btn);
    });
  }

  function setCurrentColor(color) {
    currentColor = color;
    document.getElementById('currentColorSwatch').style.background = color;
    document.getElementById('colorPicker').value = color;
    document.getElementById('colorHex').value = color;
    document.querySelectorAll('.color-swatch-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.color === color);
    });
  }

  document.getElementById('colorPicker').addEventListener('input', e => {
    setCurrentColor(e.target.value);
  });

  document.getElementById('colorHex').addEventListener('change', e => {
    let val = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setCurrentColor(val);
    }
  });

  document.getElementById('zoomIn').addEventListener('click', () => {
    zoom = Math.min(zoom * 1.25, 24);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100 / 8 * 100) / 100 + '%';
    render();
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    zoom = Math.max(zoom / 1.25, 1);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100 / 8 * 100) / 100 + '%';
    render();
  });

  function updateCanvasSizeFromTile() {
    const ts = parseInt(document.getElementById('propTileSize').value) || 32;
    const tileW = parseInt(document.getElementById('propTileW').value) || 1;
    const tileH = parseInt(document.getElementById('propTileH').value) || 1;
    const newW = ts * tileW;
    const newH = ts * tileH;
    document.getElementById('canvasW').value = newW;
    document.getElementById('canvasH').value = newH;
    if (newW !== canvasW || newH !== canvasH) {
      canvasW = newW;
      canvasH = newH;
      initFrames();
      render();
      renderPreview();
    }
  }

  document.getElementById('propTileW').addEventListener('change', updateCanvasSizeFromTile);
  document.getElementById('propTileH').addEventListener('change', updateCanvasSizeFromTile);
  document.getElementById('propTileSize').addEventListener('change', updateCanvasSizeFromTile);
  document.getElementById('propDirections').addEventListener('change', () => {
    const dir = document.getElementById('propDirections').value;
    document.getElementById('propMirror').disabled = dir === 'none';
  });

  document.getElementById('btnApplySize').addEventListener('click', () => {
    const newW = parseInt(document.getElementById('canvasW').value) || 32;
    const newH = parseInt(document.getElementById('canvasH').value) || 32;
    if (newW < 4 || newW > 128 || newH < 4 || newH > 128) return;
    canvasW = newW;
    canvasH = newH;
    totalFrames = parseInt(document.getElementById('propFrames').value) || 1;
    currentFrame = 0;
    initFrames();
    initLayers();
    syncFrameNav();
    render();
    renderPreview();
  });

  document.getElementById('propFrames').addEventListener('change', () => {
    const prevTotal = totalFrames;
    totalFrames = parseInt(document.getElementById('propFrames').value) || 1;
    if (totalFrames < 1) totalFrames = 1;
    if (totalFrames > 64) totalFrames = 64;
    currentFrame = Math.min(currentFrame, totalFrames - 1);
    while (framesData.length < totalFrames) {
      const grid = [];
      for (let r = 0; r < canvasH; r++) {
        const row = [];
        for (let c = 0; c < canvasW; c++) row.push(null);
        grid.push(row);
      }
      framesData.push(grid);
    }
    if (totalFrames !== prevTotal) {
      initLayers();
    }
    syncFrameNav();
    render();
    renderPreview();
  });

  document.getElementById('framePrev').addEventListener('click', () => {
    let offset = 0;
    for (const ln of layerOrder) {
      if (ln === activeLayer) break;
      offset += layers[ln].frames;
    }
    if (currentFrame > offset) {
      currentFrame--;
      syncFrameNav();
      render();
      renderPreview();
    }
  });

  document.getElementById('frameNext').addEventListener('click', () => {
    let offset = 0;
    for (const ln of layerOrder) {
      if (ln === activeLayer) break;
      offset += layers[ln].frames;
    }
    const lf = getLayerFrames();
    if (currentFrame < offset + lf - 1) {
      currentFrame++;
      syncFrameNav();
      render();
      renderPreview();
    }
  });

  document.getElementById('btnAddLayer').addEventListener('click', () => {
    const name = prompt('Nombre de la capa:');
    if (!name || name === '_all' || layers[name]) return;
    const framesLeft = totalFrames - Object.values(layers).reduce((s, l) => s + l.frames, 0);
    if (framesLeft <= 0) {
      alert('No quedan frames libres. Aumentá la cantidad de frames primero.');
      return;
    }
    const take = Math.min(framesLeft, parseInt(prompt('Frames para "' + name + '":', String(framesLeft))) || framesLeft);
    layers[name] = { frames: take, animSpeed: 0 };
    layerOrder.push(name);
    setActiveLayer(name);
    renderLayerTabs();
    syncFrameNav();
  });

  document.getElementById('btnRemoveLayer').addEventListener('click', () => {
    if (layerOrder.length <= 1) return;
    if (activeLayer === '_all') return;
    const name = activeLayer;
    const frames = layers[name].frames;
    if (!confirm('Eliminar capa "' + name + '" (' + frames + ' frames)?')) return;
    delete layers[name];
    const idx = layerOrder.indexOf(name);
    layerOrder.splice(idx, 1);
    setActiveLayer(layerOrder[Math.min(idx, layerOrder.length - 1)]);
    renderLayerTabs();
    syncFrameNav();
  });

  function getEntityData() {
    const data = {
      type: document.getElementById('propType').value,
      name: document.getElementById('propName').value,
      solid: document.getElementById('propSolid').checked,
      frames: totalFrames,
      animSpeed: parseFloat(document.getElementById('propAnimSpeed').value) || 0,
      tileSize: parseInt(document.getElementById('propTileSize').value) || canvasW,
      tileW: parseInt(document.getElementById('propTileW').value) || 1,
      tileH: parseInt(document.getElementById('propTileH').value) || 1,
      directions: document.getElementById('propDirections').value,
      mirror: document.getElementById('propMirror').checked,
      halfBlock: document.getElementById('propHalfBlock').checked,
      blockVision: document.getElementById('propBlockVision').checked,
      halfSolid: document.getElementById('propHalfSolid').checked,
      emission: parseFloat(document.getElementById('propEmission').value) || 0,
      atlas: document.getElementById('propAtlas').value,
      defaultColor: currentColor,
    };
    const layerData = {};
    layerOrder.forEach(name => {
      if (name !== '_all') {
        layerData[name] = { frames: layers[name].frames, animSpeed: layers[name].animSpeed };
      }
    });
    if (Object.keys(layerData).length > 0) data.layers = layerData;
    return data;
  }

  function spriteToBase64() {
    const ts = parseInt(document.getElementById('propTileSize').value) || canvasW;
    const tileW = parseInt(document.getElementById('propTileW').value) || 1;
    const tileH = parseInt(document.getElementById('propTileH').value) || 1;
    const directions = document.getElementById('propDirections').value;

    let numDirs = 1;
    if (directions === '4dir') numDirs = 3;
    else if (directions === '8dir') numDirs = 5;

    const frameW = ts * tileW;
    const frameH = ts * tileH;
    const spriteW = frameW * totalFrames * numDirs;
    const spriteH = frameH;

    const c = document.createElement('canvas');
    c.width = spriteW;
    c.height = spriteH;
    const cx = c.getContext('2d');

    const scaleX = ts / canvasW;
    const scaleY = ts / canvasH;

    for (let d = 0; d < numDirs; d++) {
      for (let f = 0; f < totalFrames; f++) {
        const grid = framesData[f] || framesData[0];
        if (!grid) continue;
        const dx = (d * totalFrames + f) * frameW;
        for (let r = 0; r < grid.length; r++) {
          for (let c2 = 0; c2 < grid[r].length; c2++) {
            const color = grid[r][c2];
            if (color) {
              cx.fillStyle = color;
              cx.fillRect(dx + c2 * scaleX, r * scaleY, scaleX, scaleY);
            }
          }
        }
      }
    }

    return c.toDataURL('image/png');
  }

  async function saveEntity() {
    const entityId = document.getElementById('propName').value.trim().replace(/\s+/g, '_').toLowerCase();
    if (!entityId) {
      setSaveStatus('\u26A0\uFE0F Nombre inv\u00E1lido', '#f85149');
      return;
    }
    const entityData = getEntityData();
    const spriteBase64 = spriteToBase64();

    setSaveStatus('\u231B Guardando...', '#ffd700');

    try {
      const res = await fetch('/api/entidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, entityData, spriteBase64 }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus('\u2705 Guardado: ' + entityId, '#3fb950');
        loadEntityList();
      } else {
        setSaveStatus('\u274C Error: ' + (data.error || 'desconocido'), '#f85149');
      }
    } catch (err) {
      setSaveStatus('\u274C Error de red', '#f85149');
    }
  }

  function setSaveStatus(msg, color) {
    const el = document.getElementById('saveStatus');
    el.textContent = msg;
    el.style.color = color || '#8b949e';
    el.style.opacity = '1';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      if (el.textContent === msg) {
        el.style.opacity = '0';
        setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 300);
      }
    }, 4000);
  }

  document.getElementById('btnGuardar').addEventListener('click', saveEntity);

  async function loadEntityList() {
    const container = document.getElementById('entityList');
    try {
      const res = await fetch('/api/entidades');
      const entities = await res.json();
      if (!Array.isArray(entities) || entities.length === 0) {
        container.innerHTML = '<p class="muted">Sin entidades</p>';
        return;
      }
      container.innerHTML = '';
      entities.forEach(e => {
        const div = document.createElement('div');
        div.className = 'entity-item';
        div.innerHTML = '<span class="entity-name">' + e.id + '</span>' +
          '<span class="entity-atlas">' + (e.atlas || 'mundo') + '</span>' +
          '<span class="entity-del" data-id="' + e.id + '">\u2715</span>';
        div.addEventListener('click', () => loadEntityForEdit(e.id));
        const delBtn = div.querySelector('.entity-del');
        delBtn.addEventListener('click', ev => {
          ev.stopPropagation();
          deleteEntity(e.id);
        });
        container.appendChild(div);
      });
    } catch (err) {
      container.innerHTML = '<p class="muted">Error al cargar</p>';
    }
  }

  function highlightEntityInList(id) {
    document.querySelectorAll('.entity-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.entity-item').forEach(el => {
      const nameEl = el.querySelector('.entity-name');
      if (nameEl && nameEl.textContent === id) {
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  async function loadEntityForEdit(id) {
    setSaveStatus('\u231B Cargando ' + id + '...', '#ffd700');
    const ts = Date.now();

    try {
      const entRes = await fetch('/api/entidades?t=' + ts);
      const entities = await entRes.json();
      const ent = entities.find(e => e.id === id);
      if (!ent) return;

      const atlasName = ent.atlas || 'mundo';
      const atlasRes = await fetch('/generated/atlas_' + atlasName + '.json?t=' + ts);
      const atlas = await atlasRes.json();
      const spriteMeta = atlas.sprites[id];
      if (!spriteMeta) {
        setSaveStatus('\u26A0\uFE0F Entidad no encontrada en atlas', '#f85149');
        return;
      }

      const fw = spriteMeta.frameW || 32;
      const fh = spriteMeta.frameH || 32;

      document.getElementById('propName').value = ent.id;
      document.getElementById('propType').value = ent.type || 'tile';
      document.getElementById('propAtlas').value = atlasName;
      document.getElementById('propSolid').checked = !!ent.solid;
      document.getElementById('propFrames').value = ent.frames || 1;
      document.getElementById('propAnimSpeed').value = ent.animSpeed || 0;
      document.getElementById('propTileSize').value = ent.tileSize || fw;
      document.getElementById('propTileW').value = ent.tileW || 1;
      document.getElementById('propTileH').value = ent.tileH || 1;
      document.getElementById('propDirections').value = ent.directions || 'none';
      document.getElementById('propMirror').checked = ent.mirror !== false;
      document.getElementById('propHalfBlock').checked = !!ent.halfBlock;
      document.getElementById('propBlockVision').checked = !!ent.blockVision;
      document.getElementById('propHalfSolid').checked = !!ent.halfSolid;
      document.getElementById('propEmission').value = ent.emission || 0;
      document.getElementById('canvasW').value = fw;
      document.getElementById('canvasH').value = fh;

      canvasW = fw;
      canvasH = fh;
      totalFrames = ent.frames || 1;
      currentFrame = 0;
      initFrames();
      initLayers();

      if (ent.layers && Object.keys(ent.layers).length > 0) {
        layers = {};
        layerOrder = [];
        Object.keys(ent.layers).forEach(name => {
          layers[name] = { frames: ent.layers[name].frames, animSpeed: ent.layers[name].animSpeed || 0 };
          layerOrder.push(name);
        });
        activeLayer = layerOrder[0];
      }

      renderLayerTabs();
      syncFrameNav();
      highlightEntityInList(id);

      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);

        for (let f = 0; f < totalFrames && f < framesData.length; f++) {
          const grid = framesData[f];
          if (!grid) continue;
          const sx = spriteMeta.x + f * fw;
          const sy = spriteMeta.y;
          const imageData = cx.getImageData(sx, sy, fw, fh);
          const readW = Math.min(fw, canvasW);
          const readH = Math.min(fh, canvasH);
          for (let r = 0; r < readH; r++) {
            for (let c2 = 0; c2 < readW; c2++) {
              const idx = (r * fw + c2) * 4;
              const alpha = imageData.data[idx + 3];
              if (alpha > 128) {
                const hex = '#' + [0,1,2].map(i => imageData.data[idx + i].toString(16).padStart(2, '0')).join('');
                grid[r][c2] = hex;
              } else {
                grid[r][c2] = null;
              }
            }
          }
        }
        render();
        renderPreview();
        setCurrentColor(spriteMeta.color || '#ffffff');
        setSaveStatus('\uD83D\uDCC2 Cargado: ' + id, '#58a6ff');
      };
      img.onerror = () => {
        setSaveStatus('\u274C Error al cargar imagen del atlas', '#f85149');
      };
      img.src = '/generated/atlas_' + atlasName + '.png?t=' + ts;
    } catch (err) {
      setSaveStatus('\u274C Error al cargar entidad', '#f85149');
    }
  }

  async function deleteEntity(id) {
    const modalOverlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = 'Eliminar entidad';
    document.getElementById('modalBody').innerHTML = '<p>\u00BFEliminar <strong>' + id + '</strong>? Esta acci\u00F3n no se puede deshacer.</p>';
    modalOverlay.style.display = 'flex';
    document.getElementById('modalCancel').onclick = () => { modalOverlay.style.display = 'none'; };
    document.getElementById('modalOk').onclick = async () => {
      modalOverlay.style.display = 'none';
      try {
        const res = await fetch('/api/entidades/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          setSaveStatus('\uD83D\uDDD1\uFE0F Eliminado: ' + id, '#f85149');
          loadEntityList();
          if (document.getElementById('propName').value === id) {
            document.getElementById('propName').value = 'nuevo_tile';
          }
        }
      } catch (err) {
        setSaveStatus('\u274C Error al eliminar', '#f85149');
      }
    };
  }

  function init() {
    renderPalette();
    setCurrentColor('#ffffff');
    canvasW = 32;
    canvasH = 32;
    totalFrames = 1;
    currentFrame = 0;
    zoom = 8;
    document.getElementById('zoomLabel').textContent = '800%';
    document.getElementById('propMirror').disabled = document.getElementById('propDirections').value === 'none';
    initFrames();
    initLayers();
    syncFrameNav();
    render();
    renderPreview();
    loadEntityList();
  }

  init();

})();
