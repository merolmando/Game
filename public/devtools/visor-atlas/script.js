(function() {

  let atlases = {};
  let atlasNames = [];
  let entities = [];
  let entityMap = {};
  let selectedId = null;
  let zoom = 1;
  let animFrame = 0;
  let animTimer = 0;
  let searchFilter = '';
  let currentDir = '';
  let activeAtlas = '';

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

  const ATLAS_LABELS = {
    mundo: 'Mundo (tiles, estructuras)',
    entidades: 'Entidades (personajes, NPCs)',
    ui: 'UI (fuentes, iconos)',
    efectos: 'Efectos (partículas)',
  };

  function atlasLabel(name) {
    return ATLAS_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
  }

  async function loadAtlases() {
    try {
      const knownAtlases = ['mundo', 'entidades', 'ui', 'efectos'];
      const ts = Date.now();

      const results = await Promise.all(knownAtlases.map(async name => {
        try {
          const [jsonRes, img] = await Promise.all([
            fetch(`/generated/atlas_${name}.json?t=${ts}`),
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = `/generated/atlas_${name}.png?t=${ts}`;
            }),
          ]);
          const json = await jsonRes.json();
          return { name, img, json };
        } catch {
          return null;
        }
      }));

      atlases = {};
      atlasNames = [];
      for (const r of results) {
        if (r) {
          atlases[r.name] = { img: r.img, json: r.json };
          atlasNames.push(r.name);
        }
      }

      if (atlasNames.length === 0) throw new Error('No se encontraron atlases');

      buildEntityList();
      updateStats();
      renderAtlas();
      zoomFit();
    } catch (err) {
      document.getElementById('emptyState').innerHTML = '<p>Error al cargar atlas: ' + err.message + '</p>';
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
    entities = [];
    for (const name of atlasNames) {
      const atlas = atlases[name];
      if (!atlas) continue;
      const order = atlas.json.entityOrder || Object.keys(atlas.json.sprites);
      for (const id of order) {
        const s = atlas.json.sprites[id];
        const meta = entityMap[id] || {};
        entities.push({ id, atlasName: name, ...s, hasSprite: meta.hasSprite });
      }
    }
    renderEntityList();
  }

  function getFilteredEntities() {
    let list = entities;
    if (activeAtlas) {
      list = list.filter(e => e.atlasName === activeAtlas);
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter(e =>
        e.id.toLowerCase().includes(q) ||
        (e.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderEntityList() {
    const container = document.getElementById('entityList');
    const filtered = getFilteredEntities();
    container.innerHTML = '';
    filtered.forEach(e => {
      const item = document.createElement('div');
      item.className = 'entity-item' + (e.id === selectedId ? ' active' : '');
      item.innerHTML =
        '<span class="e-color" style="background:' + (e.color || '#888') + '"></span>' +
        '<span class="e-name">' + (e.name || e.id) + '</span>' +
        '<span class="e-frames">' + e.frames + 'f</span>' +
        '<span class="e-atlas-tag">' + e.atlasName + '</span>' +
        (e.hasSprite ? '<span class="e-badge" style="color:#3fb950">PNG</span>' : '<span class="e-badge">\u2014</span>') +
        '<span class="e-del" data-id="' + e.id + '">\u2715</span>';
      item.addEventListener('click', ev => {
        if (ev.target.classList.contains('e-del')) return;
        selectEntity(e.id);
      });
      container.appendChild(item);
    });
  }

  function updateStats() {
    let totalEntities = 0;
    let totalFrames = 0;
    let parts = [];
    for (const name of atlasNames) {
      const atlas = atlases[name];
      if (!atlas) continue;
      const count = Object.keys(atlas.json.sprites).length;
      const frames = Object.values(atlas.json.sprites).reduce((s, e) => s + e.frames, 0);
      totalEntities += count;
      totalFrames += frames;
      parts.push(name + ': ' + atlas.json.width + '\u00D7' + atlas.json.height);
    }
    document.getElementById('statEntities').textContent = totalEntities + ' entidades';
    document.getElementById('statFrames').textContent = totalFrames + ' frames';
    document.getElementById('statDimensions').textContent = parts.join(' | ');
  }

  function getCanvasLayout() {
    const gap = 8;
    const headerH = 22;
    const pad = 4;
    let totalH = pad;
    const sections = [];

    for (const name of atlasNames) {
      if (activeAtlas && name !== activeAtlas) continue;
      const atlas = atlases[name];
      if (!atlas) continue;
      const json = atlas.json;
      const sec = {
        name,
        label: atlasLabel(name),
        y: totalH + headerH,
        img: atlas.img,
        json,
        w: json.width,
        h: json.height,
      };
      sections.push(sec);
      totalH += headerH + json.height + gap;
    }
    totalH += pad;
    const totalW = pad * 2 + Math.max(...sections.map(s => s.w), 0);

    return { sections, totalW, totalH, headerH, gap, pad };
  }

  function resizeCanvas() {
    const layout = getCanvasLayout();
    const w = Math.round(layout.totalW * zoom);
    const h = Math.round(layout.totalH * zoom);
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function renderAtlas() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (atlasNames.length === 0) return;

    const layout = getCanvasLayout();
    const z = zoom;
    const filtered = getFilteredEntities();

    for (const sec of layout.sections) {
      const secY = sec.y * z;

      ctx.fillStyle = '#161b22';
      ctx.fillRect(0, secY - layout.headerH * z, layout.totalW * z, layout.headerH * z);

      ctx.fillStyle = '#8b949e';
      ctx.font = 'bold ' + Math.round(11 * z) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(sec.label, layout.pad * z, secY - layout.headerH * z / 2);

      ctx.drawImage(sec.img, 0, 0, sec.w, sec.h,
        layout.pad * z, secY, sec.w * z, sec.h * z);

      if (sec !== layout.sections[layout.sections.length - 1] || layout.sections.length === 1) {
        ctx.strokeStyle = 'rgba(48,54,61,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, secY + sec.h * z + layout.gap * z / 2);
        ctx.lineTo(layout.totalW * z, secY + sec.h * z + layout.gap * z / 2);
        ctx.stroke();
      }

      filtered.filter(e => e.atlasName === sec.name).forEach((e, idx) => {
        const isSelected = e.id === selectedId;
        const rx = (layout.pad + e.x) * z;
        const ry = secY + e.y * z;
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
          if (maxW > 0 && ctx.measureText(label).width > maxW) {
            while (label.length > 0 && ctx.measureText(label + '\u2026').width > maxW) label = label.slice(0, -1);
            label += '\u2026';
          }
          ctx.fillText(label, rx + 3, ry + 3);
          ctx.shadowBlur = 0;
        }
      });
    }

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

  function hitTestAtlas(cx, cy) {
    const layout = getCanvasLayout();
    const filtered = getFilteredEntities();
    for (const sec of layout.sections) {
      const secY = sec.y;
      const ox = layout.pad;
      for (let i = filtered.length - 1; i >= 0; i--) {
        const e = filtered[i];
        if (e.atlasName !== sec.name) continue;
        const ex = ox + e.x;
        const ey = secY + e.y;
        if (cx >= ex && cx <= ex + e.frameW * e.frames &&
            cy >= ey && cy <= ey + e.frameH) {
          return e.id;
        }
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
      const e = entities.find(en => en.id === hit);
      document.getElementById('badgeName').textContent = (e ? (e.name || e.id) : hit) + ' (' + hit + ')';
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
    const e = entities.find(en => en.id === id);
    const meta = entityMap[id] || {};
    if (!e) return;

    document.getElementById('noSelection').style.display = 'none';
    document.getElementById('detailContent').style.display = 'block';
    document.getElementById('detailName').textContent = e.name || id;
    document.getElementById('detailId').textContent = id + ' @ ' + e.atlasName;
    document.getElementById('dType').textContent = e.type || 'tile';
    document.getElementById('dSolid').textContent = e.solid ? 'S\u00ED' : 'No';
    document.getElementById('dFrames').textContent = e.frames;
    document.getElementById('dAnimSpeed').textContent = e.animSpeed || 0;
    document.getElementById('dPos').textContent = '(' + e.x + ', ' + e.y + ') [' + e.atlasName + ']';

    const tileW = e.tileW || 1;
    const tileH = e.tileH || 1;
    const dirs = e.dirFrames || {};
    const dirKeys = Object.keys(dirs);
    document.getElementById('dFrameSize').textContent = e.frameW + '\u00D7' + e.frameH;
    document.getElementById('dTileSize').textContent = tileW + '\u00D7' + tileH;
    document.getElementById('dDirections').textContent = dirKeys.length > 0 ? dirKeys.join(', ') : 'ninguna';
    document.getElementById('dMirror').textContent = e.mirror !== false ? 'S\u00ED' : 'No';
    document.getElementById('dHalfBlock').textContent = e.halfBlock ? 'S\u00ED' : 'No';
    document.getElementById('dBlockVision').textContent = e.blockVision ? 'S\u00ED' : 'No';
    document.getElementById('dHalfSolid').textContent = e.halfSolid ? 'S\u00ED' : 'No';
    const showHB = !!(e.halfBlock || e.blockVision || e.halfSolid);
    document.getElementById('dBlockVisionRow').style.display = showHB ? 'flex' : 'none';
    document.getElementById('dHalfSolidRow').style.display = showHB ? 'flex' : 'none';

    const emissionVal = e.emission || 0;
    const emissionColor = e.emissionColor || '#ffffff';
    if (emissionVal > 0) {
      document.getElementById('dEmission').innerHTML = emissionVal + ' <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' + emissionColor + ';vertical-align:middle;border:1px solid #30363d"></span>';
    } else {
      document.getElementById('dEmission').textContent = 'No';
    }
    document.getElementById('dHasSprite').textContent = meta.hasSprite ? '\u2705 S\u00ED' : '\u274C No (placeholder)';
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
    document.getElementById('btnDeleteEntity').onclick = () => deleteEntity(id);

    const framesPerDir = meta.frames || e.frames;
    const previewFrames = dirKeys.length > 0 ? framesPerDir : e.frames;
    const pw = e.frameW * previewFrames;
    const ph = e.frameH;
    const scale = Math.min(160 / pw, 160 / ph, 4);
    animCanvas.width = pw * scale;
    animCanvas.height = ph * scale;

    if (dirKeys.length > 0) {
      document.getElementById('directionSelector').style.display = 'block';
      const sel = document.getElementById('dirSelect');
      const prevDir = sel.value;
      sel.innerHTML = '';
      dirKeys.forEach(dir => {
        const opt = document.createElement('option');
        opt.value = dir;
        opt.textContent = dir;
        sel.appendChild(opt);
      });
      if (prevDir && dirKeys.includes(prevDir)) sel.value = prevDir;
      currentDir = sel.value;
    } else {
      document.getElementById('directionSelector').style.display = 'none';
      currentDir = '';
    }

    renderFrameStrip(e, meta);
    drawAnimFrame(e, meta, scale, 0);
  }

  function getAtlasForEntity(entityId) {
    for (const name of atlasNames) {
      const atlas = atlases[name];
      if (atlas && atlas.json.sprites[entityId]) return atlas;
    }
    return null;
  }

  function getEntityDirFrame(e, frameIdx, dir) {
    const dirs = e.dirFrames || {};
    let startFrame = 0;
    if (dir && dirs[dir] !== undefined) {
      startFrame = dirs[dir];
    }
    return startFrame + frameIdx;
  }

  function drawAnimFrame(e, meta, scale, frameIdx) {
    const atlas = getAtlasForEntity(e.id);
    if (!atlas) return;
    const s = scale || Math.min(160 / (e.frameW * e.frames), 160 / e.frameH, 4);
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    const dir = currentDir || '';
    const absFrame = getEntityDirFrame(e, frameIdx, dir);
    const mirror = dir === 'left' && e.mirror !== false;

    if (mirror) {
      animCtx.save();
      animCtx.scale(-1, 1);
      animCtx.drawImage(atlas.img,
        e.x + absFrame * e.frameW, e.y, e.frameW, e.frameH,
        -(frameIdx * e.frameW * s + e.frameW * s), 0, e.frameW * s, e.frameH * s);
      animCtx.restore();
    } else {
      animCtx.drawImage(atlas.img,
        e.x + absFrame * e.frameW, e.y, e.frameW, e.frameH,
        frameIdx * e.frameW * s, 0, e.frameW * s, e.frameH * s);
    }
  }

  function renderFrameStrip(e, meta) {
    const container = document.getElementById('frameStrip');
    const atlas = getAtlasForEntity(e.id);
    if (!atlas) return;
    container.innerHTML = '';
    const dir = currentDir || '';
    for (let f = 0; f < e.frames; f++) {
      const absFrame = getEntityDirFrame(e, f, dir);
      const c = document.createElement('canvas');
      c.width = e.frameW;
      c.height = e.frameH;
      c.style.width = (e.frameW * 2) + 'px';
      c.style.height = (e.frameH * 2) + 'px';
      c.title = 'Frame ' + (f + 1) + (dir ? ' [' + dir + ']' : '');
      if (f === animFrame) c.classList.add('active');
      const cx = c.getContext('2d');
      const mirror = dir === 'left' && e.mirror !== false;
      if (mirror) {
        cx.save();
        cx.scale(-1, 1);
        cx.drawImage(atlas.img, e.x + absFrame * e.frameW, e.y, e.frameW, e.frameH, -e.frameW, 0, e.frameW, e.frameH);
        cx.restore();
      } else {
        cx.drawImage(atlas.img, e.x + absFrame * e.frameW, e.y, e.frameW, e.frameH, 0, 0, e.frameW, e.frameH);
      }
      container.appendChild(c);
    }
  }

  function updateAnim(dt) {
    if (!selectedId) return;
    const e = entities.find(en => en.id === selectedId);
    const meta = entityMap[selectedId] || {};
    if (!e) return;
    const frameCount = Object.keys(e.dirFrames || {}).length > 0 ? (meta.frames || 4) : e.frames;
    if (frameCount <= 1) return;
    animTimer += dt;
    const speed = e.animSpeed || 0.2;
    if (animTimer >= speed) {
      animTimer = 0;
      animFrame = (animFrame + 1) % frameCount;
      const s = Math.min(160 / (e.frameW * frameCount), 160 / e.frameH, 4);
      drawAnimFrame(e, null, s, animFrame);
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
    if (atlasNames.length === 0) return;
    const layout = getCanvasLayout();
    const pad = 20;
    const availW = wrapper.clientWidth - pad;
    const availH = wrapper.clientHeight - pad;
    const zx = availW / layout.totalW;
    const zy = availH / layout.totalH;
    zoomTo(Math.min(zx, zy, 4));
  }

  function changeAtlasFilter(name) {
    activeAtlas = name;
    renderEntityList();
    renderAtlas();
    zoomFit();
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

  function addAtlasSelector() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    const group = document.createElement('div');
    group.className = 'toolbar-group';
    group.innerHTML = '<label>Atlas:</label><select id="atlasSelector"><option value="">Todos</option></select>';
    toolbar.insertBefore(group, toolbar.querySelector('#entityBadge'));
    const sel = document.getElementById('atlasSelector');
    for (const name of atlasNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = atlasLabel(name);
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => changeAtlasFilter(sel.value));
  }

  document.getElementById('dirSelect').addEventListener('change', e => {
    currentDir = e.target.value;
    animFrame = 0;
    animTimer = 0;
    const e2 = entities.find(en => en.id === selectedId);
    const meta = entityMap[selectedId] || {};
    if (e2) {
      const framesPerDir = meta.frames || e2.frames;
      const pw = e2.frameW * framesPerDir;
      const ph = e2.frameH;
      const s = Math.min(160 / pw, 160 / ph, 4);
      animCanvas.width = pw * s;
      animCanvas.height = ph * s;
      renderFrameStrip(e2, meta);
      drawAnimFrame(e2, null, s, 0);
    }
  });

  async function deleteEntity(id) {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = 'Eliminar entidad';
    document.getElementById('modalBody').innerHTML = '<p>\u00BFEliminar <strong>' + id + '</strong>? Esta acci\u00F3n no se puede deshacer.</p>';
    overlay.style.display = 'flex';
    document.getElementById('modalCancel').onclick = () => { overlay.style.display = 'none'; };
    document.getElementById('modalOk').onclick = async () => {
      overlay.style.display = 'none';
      try {
        const res = await fetch('/api/entidades/' + encodeURIComponent(id), { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Error al eliminar (' + res.status + ')');
        }
        selectedId = null;
        document.getElementById('noSelection').style.display = 'block';
        document.getElementById('detailContent').style.display = 'none';
        await loadEntityMeta();
        await loadAtlases();
      } catch (err) {
        document.getElementById('emptyState').innerHTML = '<p style="color:#f85149">Error: ' + err.message + '</p>';
      }
    };
  }

  document.getElementById('entityList').addEventListener('click', ev => {
    const del = ev.target.closest('.e-del');
    if (!del) return;
    deleteEntity(del.dataset.id);
  });

  async function init() {
    await Promise.all([loadAtlases(), loadEntityMeta()]);
    addAtlasSelector();
    requestAnimationFrame(animLoop);
  }

  init();

})();
