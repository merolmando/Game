(function() {

  let atlasImg = null;
  let atlasData = null;
  let entities = [];
  let entityMap = {};
  let selectedId = null;
  let zoom = 1;
  let animFrame = 0;
  let animTimer = 0;
  let searchFilter = '';

  const canvas = document.getElementById('atlasCanvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvasWrapper');
  const animCanvas = document.getElementById('animCanvas');
  const animCtx = animCanvas.getContext('2d');

  const SELECTION_COLORS = [
    'rgba(31,111,235,0.2)', 'rgba(248,81,73,0.2)',
    'rgba(63,185,80,0.2)', 'rgba(255,215,0,0.2)',
    'rgba(163,113,247,0.2)', 'rgba(255,138,76,0.2)',
  ];

  async function loadAtlas() {
    try {
      const ts = Date.now();
      const img = new Image();
      const [jsonRes] = await Promise.all([
        fetch('/generated/atlas.json?t=' + ts),
        new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = '/generated/atlas.png?t=' + ts;
        }),
      ]);
      atlasImg = img;
      atlasData = await jsonRes.json();
      buildEntityList();
      updateStats();
      zoomFit();
      renderAtlas();
    } catch (err) {
      document.getElementById('emptyState').innerHTML = '<p>Error al cargar atlas</p>';
    }
  }

  async function loadEntityMeta() {
    try {
      const res = await fetch('/api/entidades');
      const list = await res.json();
      if (Array.isArray(list)) {
        list.forEach(e => { entityMap[e.id] = e; });
      }
    } catch {}
  }

  function buildEntityList() {
    if (!atlasData) return;
    entities = (atlasData.entityOrder || Object.keys(atlasData.sprites)).map(id => {
      const s = atlasData.sprites[id];
      const meta = entityMap[id] || {};
      return { id, ...s, hasSprite: meta.hasSprite };
    });
    renderEntityList();
  }

  function getFilteredEntities() {
    if (!searchFilter) return entities;
    const q = searchFilter.toLowerCase();
    return entities.filter(e =>
      e.id.toLowerCase().includes(q) ||
      (e.name || '').toLowerCase().includes(q)
    );
  }

  function renderEntityList() {
    const container = document.getElementById('entityList');
    const filtered = getFilteredEntities();
    container.innerHTML = '';
    filtered.forEach(e => {
      const item = document.createElement('div');
      item.className = 'entity-item' + (e.id === selectedId ? ' active' : '');
      item.innerHTML = '<span class="e-color" style="background:' + (e.color || '#888') + '"></span>' +
        '<span class="e-name">' + (e.name || e.id) + '</span>' +
        '<span class="e-frames">' + e.frames + 'f</span>' +
        (e.hasSprite ? '<span class="e-badge" style="color:#3fb950">PNG</span>' : '<span class="e-badge">—</span>');
      item.addEventListener('click', () => selectEntity(e.id));
      container.appendChild(item);
    });
  }

  function updateStats() {
    if (!atlasData) return;
    const totalFrames = Object.values(atlasData.sprites).reduce((s, e) => s + e.frames, 0);
    document.getElementById('statEntities').textContent = entities.length + ' entidades';
    document.getElementById('statFrames').textContent = totalFrames + ' frames';
    document.getElementById('statDimensions').textContent = atlasData.width + '\u00d7' + atlasData.height + ' px';
  }

  function resizeCanvas() {
    if (!atlasImg) {
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientHeight;
      return;
    }
    const w = Math.round(atlasData.width * zoom);
    const h = Math.round(atlasData.height * zoom);
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function renderAtlas() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!atlasImg || !atlasData) return;

    ctx.drawImage(atlasImg, 0, 0, atlasData.width * zoom, atlasData.height * zoom);

    const z = zoom;
    const filtered = getFilteredEntities();
    filtered.forEach((e, idx) => {
      const isSelected = e.id === selectedId;
      const rx = e.x * z;
      const ry = e.y * z;
      const rw = e.frameW * z * e.frames;
      const rh = e.frameH * z;

      ctx.fillStyle = isSelected ? 'rgba(31,111,235,0.3)' : SELECTION_COLORS[idx % SELECTION_COLORS.length];
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = isSelected ? '#1f6feb' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(rx, ry, rw, rh);

      if (z * e.frameW >= 16) {
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.font = 'bold ' + Math.max(9, Math.round(10 * z)) + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        let label = e.name || e.id;
        const maxW = rw - 6;
        if (ctx.measureText(label).width > maxW && maxW > 0) {
          while (label.length > 0 && ctx.measureText(label + '\u2026').width > maxW) {
            label = label.slice(0, -1);
          }
          label += '\u2026';
        }
        ctx.fillText(label, rx + 3, ry + 3);
        ctx.shadowBlur = 0;
      }
    });

    document.getElementById('emptyState').style.display = 'none';
  }

  function getAtlasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX / zoom,
      y: (e.clientY - rect.top) * scaleY / zoom,
    };
  }

  function hitTestAtlas(x, y) {
    const filtered = getFilteredEntities();
    for (let i = filtered.length - 1; i >= 0; i--) {
      const e = filtered[i];
      if (x >= e.x && x <= e.x + e.frameW * e.frames &&
          y >= e.y && y <= e.y + e.frameH) {
        return e.id;
      }
    }
    return null;
  }

  canvas.addEventListener('click', e => {
    const pos = getAtlasCoords(e);
    const hit = hitTestAtlas(pos.x, pos.y);
    if (hit) selectEntity(hit);
  });

  canvas.addEventListener('mousemove', e => {
    const pos = getAtlasCoords(e);
    const hit = hitTestAtlas(pos.x, pos.y);
    canvas.style.cursor = hit ? 'pointer' : 'default';
    if (hit) {
      const e = atlasData.sprites[hit];
      document.getElementById('badgeName').textContent = (e.name || hit) + ' (' + hit + ')';
    } else {
      document.getElementById('badgeName').textContent = '';
    }
  });

  function selectEntity(id) {
    if (selectedId === id) return;
    selectedId = id;
    animFrame = 0;
    animTimer = 0;
    renderEntityList();
    renderAtlas();
    showDetail(id);
  }

  function showDetail(id) {
    const e = atlasData.sprites[id];
    const meta = entityMap[id] || {};
    if (!e) return;

    document.getElementById('noSelection').style.display = 'none';
    document.getElementById('detailContent').style.display = 'block';
    document.getElementById('detailName').textContent = e.name || id;
    document.getElementById('detailId').textContent = id;
    document.getElementById('dType').textContent = e.type || 'tile';
    document.getElementById('dSolid').textContent = e.solid ? 'Sí' : 'No';
    document.getElementById('dFrames').textContent = e.frames;
    document.getElementById('dAnimSpeed').textContent = e.animSpeed || 0;
    document.getElementById('dPos').textContent = '(' + e.x + ', ' + e.y + ')';
    document.getElementById('dFrameSize').textContent = e.frameW + '\u00d7' + e.frameH;
    document.getElementById('dHasSprite').textContent = meta.hasSprite ? '\u2705 Sí' : '\u274C No (placeholder)';
    document.getElementById('dHasSprite').style.color = meta.hasSprite ? '#3fb950' : '#f85149';

    if (e.layers && Object.keys(e.layers).length > 0) {
      document.getElementById('dLayersRow').style.display = 'flex';
      document.getElementById('dLayers').textContent = Object.keys(e.layers).join(', ');
    } else {
      document.getElementById('dLayersRow').style.display = 'none';
    }

    document.getElementById('btnEditEntity').onclick = () => {
      window.location.href = '/desarrollo/herramientas/creador-tiles';
    };

    const pw = e.frameW * e.frames;
    const ph = e.frameH;
    const scale = Math.min(160 / pw, 160 / ph, 4);
    animCanvas.width = pw * scale;
    animCanvas.height = ph * scale;

    renderFrameStrip(e, meta);
    drawAnimFrame(e, meta, scale, 0);
  }

  function drawAnimFrame(e, meta, scale, frameIdx) {
    const pw = e.frameW * e.frames;
    const ph = e.frameH;
    const s = scale || Math.min(160 / pw, 160 / ph, 4);
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    animCtx.drawImage(atlasImg,
      e.x + frameIdx * e.frameW, e.y, e.frameW, e.frameH,
      frameIdx * e.frameW * s, 0, e.frameW * s, e.frameH * s);
  }

  function renderFrameStrip(e, meta) {
    const container = document.getElementById('frameStrip');
    container.innerHTML = '';
    for (let f = 0; f < e.frames; f++) {
      const c = document.createElement('canvas');
      c.width = e.frameW;
      c.height = e.frameH;
      c.style.width = (e.frameW * 2) + 'px';
      c.style.height = (e.frameH * 2) + 'px';
      c.title = 'Frame ' + (f + 1);
      if (f === animFrame) c.classList.add('active');
      const cx = c.getContext('2d');
      cx.drawImage(atlasImg, e.x + f * e.frameW, e.y, e.frameW, e.frameH, 0, 0, e.frameW, e.frameH);
      container.appendChild(c);
    }
  }

  function updateAnim(dt) {
    if (!selectedId || !atlasData) return;
    const e = atlasData.sprites[selectedId];
    if (!e || e.frames <= 1) return;
    animTimer += dt;
    const speed = e.animSpeed || 0.2;
    if (animTimer >= speed) {
      animTimer = 0;
      animFrame = (animFrame + 1) % e.frames;
      const pw = e.frameW * e.frames;
      const ph = e.frameH;
      const scale = Math.min(160 / pw, 160 / ph, 4);
      drawAnimFrame(e, null, scale, animFrame);

      document.querySelectorAll('#frameStrip canvas').forEach((c, idx) => {
        c.classList.toggle('active', idx === animFrame);
      });
    }
  }

  let lastAnimTime = 0;
  function animLoop(timestamp) {
    const dt = lastAnimTime ? (timestamp - lastAnimTime) / 1000 : 0.016;
    lastAnimTime = timestamp;
    updateAnim(dt);
    requestAnimationFrame(animLoop);
  }

  function zoomTo(z) {
    zoom = Math.max(0.1, Math.min(z, 16));
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    renderAtlas();
  }

  function zoomFit() {
    if (!atlasData) return;
    const pad = 20;
    const availW = wrapper.clientWidth - pad;
    const availH = wrapper.clientHeight - pad;
    const zx = availW / atlasData.width;
    const zy = availH / atlasData.height;
    zoomTo(Math.min(zx, zy, 4));
  }

  document.getElementById('zoomIn').addEventListener('click', () => zoomTo(zoom * 1.25));
  document.getElementById('zoomOut').addEventListener('click', () => zoomTo(zoom / 1.25));
  document.getElementById('zoomFit').addEventListener('click', zoomFit);

  document.getElementById('searchInput').addEventListener('input', e => {
    searchFilter = e.target.value;
    renderEntityList();
    renderAtlas();
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.deltaY < 0) zoomTo(zoom * 1.15);
    else zoomTo(zoom / 1.15);
  }, { passive: false });

  window.addEventListener('resize', zoomFit);

  async function init() {
    await Promise.all([loadAtlas(), loadEntityMeta()]);
    buildEntityList();
    updateStats();
    requestAnimationFrame(animLoop);
    zoomFit();
    renderAtlas();
  }

  init();

})();
