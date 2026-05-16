(function() {

  let sourceImage = null;
  let imgNaturalW = 0;
  let imgNaturalH = 0;
  let zoom = 1;
  let fitZoom = 1;
  let selections = [];
  let selIdCounter = 0;
  let activeSelIndex = -1;
  let isDragging = false;
  let dragStart = null;
  let dragCurrent = null;
  let dragSelIndex = -1;
  let isDirty = false;

  const canvas = document.getElementById('spriteCanvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');
  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas.getContext('2d');

  const SELECTION_COLORS = [
    'rgba(31,111,235,0.25)', 'rgba(248,81,73,0.25)',
    'rgba(63,185,80,0.25)', 'rgba(255,215,0,0.25)',
    'rgba(163,113,247,0.25)', 'rgba(255,138,76,0.25)',
  ];

  function snap(val) {
    const gs = parseInt(document.getElementById('gridSize').value) || 32;
    if (!document.getElementById('chkSnap').checked) return val;
    return Math.round(val / gs) * gs;
  }

  function getImageCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX / zoom;
    const y = (e.clientY - rect.top) * scaleY / zoom;
    return { x, y };
  }

  function resizeCanvas() {
    if (!sourceImage) {
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientHeight;
      return;
    }
    const w = Math.round(imgNaturalW * zoom);
    const h = Math.round(imgNaturalH * zoom);
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function render() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!sourceImage) return;

    ctx.drawImage(sourceImage, 0, 0, imgNaturalW * zoom, imgNaturalH * zoom);

    const z = zoom;
    selections.forEach((sel, idx) => {
      const isActive = idx === activeSelIndex;
      const color = SELECTION_COLORS[idx % SELECTION_COLORS.length];
      const rx = sel.rect.x * z;
      const ry = sel.rect.y * z;
      const rw = sel.rect.w * z;
      const rh = sel.rect.h * z;

      ctx.fillStyle = color;
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = isActive ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(rx, ry, rw, rh);

      if (isActive) {
        ctx.strokeStyle = '#1f6feb';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx - 1, ry - 1, rw + 2, rh + 2);
        ctx.setLineDash([]);

        drawHandles(rx, ry, rw, rh);
      }
    });

    if (isDragging && dragStart && dragCurrent) {
      let x = Math.min(dragStart.x, dragCurrent.x) * z;
      let y = Math.min(dragStart.y, dragCurrent.y) * z;
      let w = Math.abs(dragCurrent.x - dragStart.x) * z;
      let h = Math.abs(dragCurrent.y - dragStart.y) * z;
      if (document.getElementById('chkSnap').checked) {
        const gs = parseInt(document.getElementById('gridSize').value) || 32;
        x = Math.min(snap(dragStart.x), snap(dragCurrent.x)) * z;
        y = Math.min(snap(dragStart.y), snap(dragCurrent.y)) * z;
        w = Math.abs(snap(dragCurrent.x) - snap(dragStart.x)) * z;
        h = Math.abs(snap(dragCurrent.y) - snap(dragStart.y)) * z;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    if (document.getElementById('chkGrid').checked && sourceImage) {
      drawGrid(z);
    }
  }

  function drawGrid(z) {
    const gs = parseInt(document.getElementById('gridSize').value) || 32;
    const gsPx = gs * z;
    if (gsPx < 6) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= imgNaturalW; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x * z, 0);
      ctx.lineTo(x * z, imgNaturalH * z);
      ctx.stroke();
    }
    for (let y = 0; y <= imgNaturalH; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y * z);
      ctx.lineTo(imgNaturalW * z, y * z);
      ctx.stroke();
    }
  }

  function drawHandles(x, y, w, h) {
    const hs = 5;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1f6feb';
    ctx.lineWidth = 1;
    const handles = [
      [x, y], [x + w / 2, y], [x + w, y],
      [x, y + h / 2], [x + w, y + h / 2],
      [x, y + h], [x + w / 2, y + h], [x + w, y + h],
    ];
    handles.forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  }

  function hitTestSelection(imgX, imgY) {
    for (let i = selections.length - 1; i >= 0; i--) {
      const r = selections[i].rect;
      if (imgX >= r.x && imgX <= r.x + r.w && imgY >= r.y && imgY <= r.y + r.h) {
        return i;
      }
    }
    return -1;
  }

  function addSelection(rect) {
    const ts = parseInt(document.getElementById('gridSize').value) || 32;
    const w = Math.max(rect.w, ts);
    const h = Math.max(rect.h, ts);
    const sel = {
      id: ++selIdCounter,
      name: 'seleccion_' + selIdCounter,
      type: 'tile',
      solid: false,
      atlas: 'mundo',
      tileSize: ts,
      tileW: 1,
      tileH: 1,
      directions: 'none',
      mirror: true,
      halfBlock: false,
      blockVision: false,
      halfSolid: false,
      frames: Math.max(1, Math.round(w / ts)),
      animSpeed: 0,
      rect: { x: rect.x, y: rect.y, w, h },
    };
    selections.push(sel);
    activeSelIndex = selections.length - 1;
    isDirty = true;
    updateUI();
    render();
  }

  function updateActiveSelection(prop, value) {
    if (activeSelIndex < 0 || activeSelIndex >= selections.length) return;
    selections[activeSelIndex][prop] = value;
    isDirty = true;
    syncPropForm();
    renderSelectionsList();
    renderPreview();
    render();
  }

  function deleteActiveSelection() {
    if (activeSelIndex < 0) return;
    selections.splice(activeSelIndex, 1);
    activeSelIndex = selections.length > 0 ? Math.min(activeSelIndex, selections.length - 1) : -1;
    isDirty = true;
    updateUI();
    render();
  }

  function selectSelection(idx) {
    activeSelIndex = idx;
    syncPropForm();
    renderSelectionsList();
    renderPreview();
    render();
  }

  function updateUI() {
    const hasSel = selections.length > 0;
    const hasActive = activeSelIndex >= 0;
    document.getElementById('selCount').textContent = '(' + selections.length + ')';
    document.getElementById('noSelectionMsg').hidden = hasActive;
    document.getElementById('propForm').hidden = !hasActive;
    document.getElementById('btnGuardarSel').disabled = !hasActive;
    document.getElementById('btnDeleteSel').disabled = !hasActive;
    document.getElementById('btnGuardarTodo').disabled = selections.length === 0;
    renderSelectionsList();
    syncPropForm();
    if (hasActive) renderPreview();
  }

  function renderSelectionsList() {
    const container = document.getElementById('selectionsList');
    container.innerHTML = '';
    selections.forEach((sel, idx) => {
      const item = document.createElement('div');
      item.className = 'sel-item' + (idx === activeSelIndex ? ' active' : '');

      const thumb = document.createElement('canvas');
      thumb.className = 'sel-thumb';
      thumb.width = 28;
      thumb.height = 28;
      const tc = thumb.getContext('2d');
      if (sourceImage) {
        tc.drawImage(sourceImage, sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h, 0, 0, 28, 28);
      }

      const name = document.createElement('span');
      name.className = 'sel-name';
      name.textContent = sel.name || 'sin_nombre';

      const dim = document.createElement('span');
      dim.className = 'sel-dim';
      dim.textContent = sel.rect.w + '×' + sel.rect.h;

      const del = document.createElement('span');
      del.className = 'sel-del';
      del.textContent = '\u2715';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (idx === activeSelIndex) {
          deleteActiveSelection();
        } else {
          selections.splice(idx, 1);
          if (activeSelIndex >= idx) activeSelIndex--;
          isDirty = true;
          updateUI();
          render();
        }
      });

      item.appendChild(thumb);
      item.appendChild(name);
      item.appendChild(dim);
      item.appendChild(del);
      item.addEventListener('click', () => selectSelection(idx));
      container.appendChild(item);
    });
  }

  function syncPropForm() {
    if (activeSelIndex < 0 || !selections[activeSelIndex]) {
      document.getElementById('noSelectionMsg').hidden = false;
      document.getElementById('propForm').hidden = true;
      return;
    }
    document.getElementById('noSelectionMsg').hidden = true;
    document.getElementById('propForm').hidden = false;

    const sel = selections[activeSelIndex];
    document.getElementById('propName').value = sel.name || '';
    document.getElementById('propPos').textContent = '(' + sel.rect.x + ', ' + sel.rect.y + ')';
    document.getElementById('propSize').textContent = sel.rect.w + ' × ' + sel.rect.h + ' px';
    document.getElementById('propType').value = sel.type;
    document.getElementById('propAtlas').value = sel.atlas || 'mundo';
    document.getElementById('propSolid').checked = sel.solid;
    document.getElementById('propTileSize').value = sel.tileSize;
    document.getElementById('propTileW').value = sel.tileW || 1;
    document.getElementById('propTileH').value = sel.tileH || 1;
    document.getElementById('propDirections').value = sel.directions || 'none';
    document.getElementById('propMirror').checked = sel.mirror !== false;
    document.getElementById('propHalfBlock').checked = sel.halfBlock || false;
    document.getElementById('propBlockVision').checked = sel.blockVision || false;
    document.getElementById('propHalfSolid').checked = sel.halfSolid || false;
    document.getElementById('propFrames').value = sel.frames;
    document.getElementById('propAnimSpeed').value = sel.animSpeed;
    document.getElementById('framesAuto').textContent = '(auto: ' + Math.max(1, Math.round(sel.rect.w / sel.tileSize)) + ')';
    document.getElementById('propMirror').disabled = sel.directions === 'none';
  }

  function renderPreview() {
    if (activeSelIndex < 0 || !sourceImage) {
      previewCanvas.width = 0;
      previewCanvas.height = 0;
      document.getElementById('previewSize').textContent = '—';
      return;
    }
    const sel = selections[activeSelIndex];
    const ts = sel.tileSize;
    const frames = sel.frames;
    const pw = ts * frames;
    const ph = ts;
    const scale = Math.min(128 / pw, 128 / ph, 4);
    previewCanvas.width = pw * scale;
    previewCanvas.height = ph * scale;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    for (let f = 0; f < frames; f++) {
      const sx = sel.rect.x + f * (sel.rect.w / frames);
      previewCtx.drawImage(sourceImage, sx, sel.rect.y, sel.rect.w / frames, sel.rect.h,
        f * ts * scale, 0, ts * scale, ph * scale);
    }

    document.getElementById('previewSize').textContent = ts + '×' + ts + ' px, ' + frames + ' frame' + (frames > 1 ? 's' : '');
  }

  function zoomTo(z) {
    zoom = Math.max(0.1, Math.min(z, 32));
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    render();
  }

  function zoomFit() {
    if (!sourceImage) return;
    const pad = 20;
    const availW = wrapper.clientWidth - pad;
    const availH = wrapper.clientHeight - pad;
    const zx = availW / imgNaturalW;
    const zy = availH / imgNaturalH;
    fitZoom = Math.min(zx, zy, 4);
    zoomTo(fitZoom);
  }

  async function saveSelection(idx) {
    const sel = selections[idx];
    if (!sel) return false;
    const entityId = sel.name.trim().replace(/\s+/g, '_').toLowerCase();
    if (!entityId) {
      setSaveStatus('\u26A0\uFE0F Nombre inv\u00E1lido en selecci\u00F3n ' + (idx + 1), '#f85149');
      return false;
    }

    const frames = sel.frames;
    const ts = sel.tileSize;
    const spriteW = ts * frames;
    const spriteH = ts;
    const frameW = sel.rect.w / frames;

    const c = document.createElement('canvas');
    c.width = spriteW;
    c.height = spriteH;
    const cx = c.getContext('2d');

    for (let f = 0; f < frames; f++) {
      const sx = sel.rect.x + f * frameW;
      cx.drawImage(sourceImage, sx, sel.rect.y, frameW, sel.rect.h,
        f * ts, 0, ts, spriteH);
    }

    const spriteBase64 = c.toDataURL('image/png');
    const entityData = {
      type: sel.type,
      name: sel.name,
      solid: sel.solid,
      frames: frames,
      animSpeed: sel.animSpeed,
      tileSize: ts,
      tileW: sel.tileW || 1,
      tileH: sel.tileH || 1,
      directions: sel.directions || 'none',
      mirror: sel.mirror !== false,
      halfBlock: sel.halfBlock || false,
      blockVision: sel.blockVision || false,
      halfSolid: sel.halfSolid || false,
      atlas: sel.atlas || 'mundo',
      defaultColor: '#888888',
    };

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
        return true;
      } else {
        setSaveStatus('\u274C Error: ' + (data.error || 'desconocido'), '#f85149');
        return false;
      }
    } catch (err) {
      setSaveStatus('\u274C Error de red', '#f85149');
      return false;
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

  function showModal(title, bodyHtml, onOk) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('modalCancel').onclick = () => document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('modalOk').onclick = () => {
      document.getElementById('modalOverlay').style.display = 'none';
      onOk();
    };
  }

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
        const hasSprite = e.hasSprite ? ' \u2714' : ' \u2716';
        div.innerHTML = '<span class="entity-name">' + e.id + '</span><span class="entity-atlas">' + (e.atlas || 'mundo') + '</span><span style="font-size:0.7rem;color:#484f58">' + hasSprite + '</span>';
        container.appendChild(div);
      });
    } catch (err) {
      container.innerHTML = '<p class="muted">Error al cargar</p>';
    }
  }

  function loadImage(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        imgNaturalW = img.naturalWidth;
        imgNaturalH = img.naturalHeight;
        document.querySelector('.drop-zone').classList.add('has-image');
        document.getElementById('imageInfo').hidden = false;
        document.getElementById('imageInfo').textContent = imgNaturalW + '×' + imgNaturalH + ' px';
        document.getElementById('emptyState').style.display = 'none';
        selections = [];
        activeSelIndex = -1;
        selIdCounter = 0;
        isDirty = false;
        updateUI();
        zoomFit();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('fileInput').addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) loadImage(e.target.files[0]);
  });

  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  const dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
  });

  canvas.addEventListener('mousedown', e => {
    if (!sourceImage) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const pos = getImageCoords(e);
    const hit = hitTestSelection(pos.x, pos.y);

    if (hit >= 0) {
      selectSelection(hit);
      dragSelIndex = hit;
      isDragging = true;
      const sel = selections[hit];
      dragStart = { x: pos.x - sel.rect.x, y: pos.y - sel.rect.y };
      dragCurrent = { x: pos.x, y: pos.y };
    } else {
      selectSelection(-1);
      const gs = parseInt(document.getElementById('gridSize').value) || 32;
      dragSelIndex = -1;
      isDragging = true;
      dragStart = {
        x: document.getElementById('chkSnap').checked ? snap(pos.x) : pos.x,
        y: document.getElementById('chkSnap').checked ? snap(pos.y) : pos.y,
      };
      dragCurrent = { ...dragStart };
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!sourceImage || !isDragging) return;
    const pos = getImageCoords(e);

    if (dragSelIndex >= 0) {
      const sel = selections[dragSelIndex];
      const gs = parseInt(document.getElementById('gridSize').value) || 32;
      let newX = pos.x - dragStart.x;
      let newY = pos.y - dragStart.y;
      if (document.getElementById('chkSnap').checked) {
        newX = snap(newX);
        newY = snap(newY);
      }
      newX = Math.max(0, Math.min(newX, imgNaturalW - sel.rect.w));
      newY = Math.max(0, Math.min(newY, imgNaturalH - sel.rect.h));
      sel.rect.x = newX;
      sel.rect.y = newY;
      syncPropForm();
      renderSelectionsList();
      render();
      renderPreview();
    } else {
      dragCurrent = {
        x: document.getElementById('chkSnap').checked ? snap(pos.x) : pos.x,
        y: document.getElementById('chkSnap').checked ? snap(pos.y) : pos.y,
      };
      updateCoordStatus(pos);
      render();
    }
  });

  function updateCoordStatus(pos) {
    const el = document.getElementById('coordStatus');
    if (isDragging && dragStart && !(dragSelIndex >= 0)) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.abs(dragCurrent.x - dragStart.x);
      const h = Math.abs(dragCurrent.y - dragStart.y);
      el.textContent = '(' + Math.round(dragStart.x) + ', ' + Math.round(dragStart.y) + ') → (' +
        Math.round(dragCurrent.x) + ', ' + Math.round(dragCurrent.y) + ')  —  ' +
        Math.round(w) + '×' + Math.round(h) + ' px';
    } else if (pos) {
      el.textContent = '(' + Math.round(pos.x) + ', ' + Math.round(pos.y) + ')';
    } else {
      el.textContent = '';
    }
  }

  canvas.addEventListener('mouseup', e => {
    if (!sourceImage || !isDragging) return;
    isDragging = false;

    if (dragSelIndex >= 0) {
      dragSelIndex = -1;
      dragStart = null;
      dragCurrent = null;
      return;
    }

    if (dragStart && dragCurrent) {
      let x = Math.min(dragStart.x, dragCurrent.x);
      let y = Math.min(dragStart.y, dragCurrent.y);
      let w = Math.abs(dragCurrent.x - dragStart.x);
      let h = Math.abs(dragCurrent.y - dragStart.y);
      const minSize = parseInt(document.getElementById('gridSize').value) || 32;
      if (w >= minSize && h >= minSize) {
        addSelection({ x, y, w, h });
      }
    }

    dragStart = null;
    dragCurrent = null;
    document.getElementById('coordStatus').textContent = '';
    render();
  });

  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      dragStart = null;
      dragCurrent = null;
      render();
    }
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!sourceImage) return;
    const pos = getImageCoords(e);
    const hit = hitTestSelection(pos.x, pos.y);
    if (hit >= 0) {
      selectSelection(hit);
      deleteActiveSelection();
    }
  });

  document.getElementById('zoomIn').addEventListener('click', () => zoomTo(zoom * 1.25));
  document.getElementById('zoomOut').addEventListener('click', () => zoomTo(zoom / 1.25));
  document.getElementById('zoomFit').addEventListener('click', zoomFit);

  document.getElementById('chkSnap').addEventListener('change', render);
  document.getElementById('chkGrid').addEventListener('change', render);
  document.getElementById('gridSize').addEventListener('change', render);

  document.getElementById('propName').addEventListener('input', e => {
    updateActiveSelection('name', e.target.value);
  });
  document.getElementById('propType').addEventListener('change', e => {
    updateActiveSelection('type', e.target.value);
  });
  document.getElementById('propAtlas').addEventListener('change', e => {
    updateActiveSelection('atlas', e.target.value);
  });
  document.getElementById('propSolid').addEventListener('change', e => {
    updateActiveSelection('solid', e.target.checked);
  });
  document.getElementById('propTileSize').addEventListener('change', e => {
    const ts = parseInt(e.target.value) || 32;
    const sel = selections[activeSelIndex];
    if (sel) {
      sel.tileSize = Math.max(4, Math.min(ts, 256));
      sel.frames = Math.max(1, Math.round(sel.rect.w / sel.tileSize));
      document.getElementById('propFrames').value = sel.frames;
      document.getElementById('framesAuto').textContent = '(auto: ' + sel.frames + ')';
      isDirty = true;
      renderPreview();
      renderSelectionsList();
    }
  });
  document.getElementById('propFrames').addEventListener('change', e => {
    const f = parseInt(e.target.value) || 1;
    const sel = selections[activeSelIndex];
    if (sel) {
      sel.frames = Math.max(1, Math.min(f, 64));
      sel.tileSize = Math.round(sel.rect.w / sel.frames);
      document.getElementById('propTileSize').value = sel.tileSize;
      document.getElementById('framesAuto').textContent = '(auto: ' + Math.max(1, Math.round(sel.rect.w / sel.tileSize)) + ')';
      isDirty = true;
      renderPreview();
      renderSelectionsList();
    }
  });
  document.getElementById('propAnimSpeed').addEventListener('change', e => {
    updateActiveSelection('animSpeed', parseFloat(e.target.value) || 0);
  });

  document.getElementById('propTileW').addEventListener('change', e => {
    updateActiveSelection('tileW', Math.max(1, parseInt(e.target.value) || 1));
  });
  document.getElementById('propTileH').addEventListener('change', e => {
    updateActiveSelection('tileH', Math.max(1, parseInt(e.target.value) || 1));
  });
  document.getElementById('propDirections').addEventListener('change', e => {
    updateActiveSelection('directions', e.target.value);
    document.getElementById('propMirror').disabled = e.target.value === 'none';
  });
  document.getElementById('propMirror').addEventListener('change', e => {
    updateActiveSelection('mirror', e.target.checked);
  });
  document.getElementById('propHalfBlock').addEventListener('change', e => {
    updateActiveSelection('halfBlock', e.target.checked);
  });
  document.getElementById('propBlockVision').addEventListener('change', e => {
    updateActiveSelection('blockVision', e.target.checked);
  });
  document.getElementById('propHalfSolid').addEventListener('change', e => {
    updateActiveSelection('halfSolid', e.target.checked);
  });

  document.getElementById('btnGuardarSel').addEventListener('click', () => {
    if (activeSelIndex >= 0) saveSelection(activeSelIndex);
  });

  document.getElementById('btnDeleteSel').addEventListener('click', deleteActiveSelection);

  document.getElementById('btnGuardarTodo').addEventListener('click', async () => {
    if (selections.length === 0) return;
    const names = selections.map(s => s.name.trim().replace(/\s+/g, '_').toLowerCase());
    const emptyNames = names.filter(n => !n);
    if (emptyNames.length > 0) {
      showModal('Nombres requeridos',
        '<p>Completá el nombre de todas las selecciones antes de guardar.</p>',
        () => {});
      return;
    }
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      showModal('Nombres duplicados',
        '<p>Las siguientes entidades tienen nombres repetidos:</p><p><strong>' + [...new Set(duplicates)].join(', ') + '</strong></p><p>Corregí los nombres antes de guardar.</p>',
        () => {});
      return;
    }

    document.getElementById('btnGuardarTodo').disabled = true;
    document.getElementById('btnGuardarTodo').textContent = '\u231B Guardando...';
    let ok = 0, fail = 0;
    for (let i = 0; i < selections.length; i++) {
      const result = await saveSelection(i);
      if (result) ok++; else fail++;
    }
    document.getElementById('btnGuardarTodo').textContent = 'Guardar Todo';
    document.getElementById('btnGuardarTodo').disabled = false;
    setSaveStatus('\u2705 ' + ok + ' guardadas' + (fail > 0 ? ', ' + fail + ' fallaron' : ''), fail > 0 ? '#f85149' : '#3fb950');
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (activeSelIndex >= 0) deleteActiveSelection();
    }
    if (e.key === 'Escape') {
      selectSelection(-1);
    }
  });

  function init() {
    loadEntityList();
    updateUI();
    render();
  }

  init();

})();
