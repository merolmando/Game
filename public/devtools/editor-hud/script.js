(function() {
  let hudData = null;
  let selectedIndex = -1;
  let zoom = 1;
  let showGrid = true;
  let gameWidth = 640;
  let gameHeight = 480;
  let idCounter = 0;
  let dragState = null;
  let hudList = [];
  let atlasSprites = {};
  let atlasImages = {};

  const canvas = document.getElementById('hudCanvas');
  const ctx = canvas.getContext('2d');
  const propContent = document.getElementById('propContent');
  const elementList = document.getElementById('elementList');
  const modalOverlay = document.getElementById('modalOverlay');
  const saveStatus = document.getElementById('saveStatus');

  const DEFAULT_COLORS = {
    bgBar: '#1a1a2e', fillHp: '#f44', fillMp: '#44f', fillXp: '#ffd700',
    fillCustom: '#58a6ff', border: '#30363d', text: '#f0e6d0',
  };

  function generateId(type) {
    idCounter++;
    const prefix = type === 'inventory-slot' ? 'inv' : type;
    return prefix + '_' + idCounter;
  }

  function getDefaults(type) {
    const base = { id: generateId(type), type, x: 20, y: 20, width: 100, height: 24, visible: true };
    switch (type) {
      case 'bar':
        return { ...base, width: 200, height: 20, label: 'HP', showLabel: true, labelPosition: 'left',
          bgColor: DEFAULT_COLORS.bgBar, fillColor: DEFAULT_COLORS.fillHp, borderColor: DEFAULT_COLORS.border,
          valueRef: 'player.hp', maxRef: 'player.maxHp', direction: 'horizontal' };
      case 'text':
        return { ...base, width: 150, height: 16, text: 'Nivel: {player.level}', font: 'system',
          spriteFont: '', color: DEFAULT_COLORS.text, fontSize: 14 };
      case 'minimap':
        return { ...base, x: 500, y: 10, width: 120, height: 100, scale: 4, borderColor: DEFAULT_COLORS.border };
      case 'inventory-slot':
        return { ...base, width: 36, height: 36, slot: 0, bgColor: '#0d1117', borderColor: DEFAULT_COLORS.border };
      case 'image':
        return { ...base, width: 32, height: 32, entityId: '', bgColor: '#1a1a2e' };
      case 'message-log':
        return { ...base, width: 280, height: 80, maxMessages: 50, bgColor: 'rgba(0,0,0,0.6)',
          borderColor: DEFAULT_COLORS.border, textColor: DEFAULT_COLORS.text };
      default:
        return base;
    }
  }

  async function loadAtlasInfo() {
    atlasSprites = {};
    atlasImages = {};
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
      for (const r of results) {
        if (!r) continue;
        atlasImages[r.name] = r.img;
        const sprites = r.json.sprites || {};
        Object.keys(sprites).forEach(entityId => {
          sprites[entityId].atlasName = r.name;
          atlasSprites[entityId] = sprites[entityId];
        });
      }
    } catch {
      atlasSprites = {};
      atlasImages = {};
    }
  }

  function resizeCanvas() {
    const w = gameWidth * zoom;
    const h = gameHeight * zoom;
    canvas.width = Math.max(w, 1);
    canvas.height = Math.max(h, 1);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function render() {
    if (!hudData) return;
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid && zoom >= 0.5) {
      const gridSize = 20 * zoom;
      ctx.strokeStyle = 'rgba(48,54,61,0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (hudData.elements) {
      hudData.elements.forEach((el, i) => {
        drawElement(el, i);
      });
    }

    if (selectedIndex >= 0 && hudData.elements && hudData.elements[selectedIndex]) {
      drawSelection(hudData.elements[selectedIndex]);
    }

    const info = gameWidth + '\u00D7' + gameHeight;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#484f58';
    ctx.fillText(info, canvas.width - 6, canvas.height - 4);
  }

  function drawElement(el, index) {
    const z = zoom;
    const ex = el.x * z;
    const ey = el.y * z;
    const ew = el.width * z;
    const eh = el.height * z;

    const isSelected = index === selectedIndex;

    switch (el.type) {
      case 'bar': drawBar(el, ex, ey, ew, eh, z); break;
      case 'text': drawText(el, ex, ey, ew, eh, z); break;
      case 'minimap': drawMinimap(el, ex, ey, ew, eh, z); break;
      case 'inventory-slot': drawInventorySlot(el, ex, ey, ew, eh, z); break;
      case 'image': drawImage(el, ex, ey, ew, eh, z); break;
      case 'message-log': drawMessageLog(el, ex, ey, ew, eh, z); break;
    }

    if (!el.visible) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ex, ey, ew, eh);
      const cx = ex + ew / 2, cy = ey + eh / 2;
      ctx.fillStyle = '#484f58';
      ctx.font = Math.max(10, 14 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2205', cx, cy);
    }
  }

  function drawBar(el, ex, ey, ew, eh, z) {
    const r = 3 * z;
    ctx.fillStyle = el.bgColor || DEFAULT_COLORS.bgBar;
    roundRect(ctx, ex, ey, ew, eh, r);
    ctx.fill();

    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      roundRect(ctx, ex, ey, ew, eh, r);
      ctx.stroke();
    }

    const ratio = 0.6;
    const fw = ew * ratio;
    ctx.fillStyle = el.fillColor || DEFAULT_COLORS.fillHp;
    roundRect(ctx, ex + 2 * z, ey + 2 * z, fw - 4 * z, eh - 4 * z, 2 * z);
    ctx.fill();

    if (el.label && el.showLabel) {
      ctx.fillStyle = '#f0e6d0';
      ctx.font = 'bold ' + Math.max(8, 11 * z) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label + ' 60/100', ex + fw + 6 * z, ey + eh / 2);
    }
  }

  function drawText(el, ex, ey, ew, eh, z) {
    ctx.fillStyle = el.color || DEFAULT_COLORS.text;
    ctx.font = (el.fontSize || 14) * z + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let displayText = el.text || 'Texto';
    displayText = displayText.replace(/\{(\w+(?:\.\w+)*)\}/g, '{$1}');
    ctx.fillText(displayText, ex, ey);
  }

  function drawMinimap(el, ex, ey, ew, eh, z) {
    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, ey, ew, eh);
    }

    const cells = 4;
    const cellW = ew / cells;
    const cellH = eh / cells;
    const colors = ['#1a1a2e', '#2d2d44', '#4a7c3f', '#5c4033', '#2e6da4', '#b8860b'];
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        ctx.fillStyle = colors[(r * cells + c) % colors.length];
        ctx.fillRect(ex + c * cellW + 1, ey + r * cellH + 1, cellW - 2, cellH - 2);
      }
    }
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(ex + ew / 2, ey + eh / 2, 3 * z, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b949e';
    ctx.font = Math.max(6, 8 * z) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('minimapa', ex + ew / 2, ey + eh + 2);
  }

  function drawInventorySlot(el, ex, ey, ew, eh, z) {
    ctx.fillStyle = el.bgColor || '#0d1117';
    ctx.fillRect(ex, ey, ew, eh);
    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, ey, ew, eh);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.font = Math.max(8, 10 * z) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(el.slot + 1), ex + ew / 2, ey + eh / 2);
  }

  function drawImage(el, ex, ey, ew, eh, z) {
    if (el.entityId && atlasSprites[el.entityId]) {
      const s = atlasSprites[el.entityId];
      const img = s.atlasName ? atlasImages[s.atlasName] : null;
      if (img) {
        ctx.drawImage(img, s.x, s.y, s.frameW, s.frameH, ex, ey, ew, eh);
        return;
      }
    }
    {
      ctx.fillStyle = el.bgColor || '#1a1a2e';
      ctx.fillRect(ex, ey, ew, eh);
      ctx.fillStyle = '#484f58';
      ctx.font = Math.max(8, 12 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u25C6', ex + ew / 2, ey + eh / 2);
      if (!el.entityId) {
        ctx.fillStyle = '#484f58';
        ctx.font = Math.max(5, 7 * z) + 'px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('sin sprite', ex + ew / 2, ey + eh + 2);
      }
    }
  }

  function drawMessageLog(el, ex, ey, ew, eh, z) {
    ctx.fillStyle = el.bgColor || 'rgba(0,0,0,0.6)';
    ctx.fillRect(ex, ey, ew, eh);
    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, ey, ew, eh);
    }
    ctx.fillStyle = el.textColor || '#f0e6d0';
    ctx.font = Math.max(7, 10 * z) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const msgs = ['Mensaje 1', 'Mensaje 2', 'Mensaje 3'];
    msgs.forEach((msg, i) => {
      ctx.fillText(msg, ex + 4 * z, ey + 4 * z + i * (13 * z));
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawSelection(el) {
    const z = zoom;
    const ex = el.x * z;
    const ey = el.y * z;
    const ew = el.width * z;
    const eh = el.height * z;

    ctx.strokeStyle = '#1f6feb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ex - 2, ey - 2, ew + 4, eh + 4);
    ctx.setLineDash([]);

    const handleSize = 6;
    const handles = [
      { x: ex, y: ey },
      { x: ex + ew, y: ey },
      { x: ex, y: ey + eh },
      { x: ex + ew, y: ey + eh },
      { x: ex + ew / 2, y: ey },
      { x: ex + ew / 2, y: ey + eh },
      { x: ex, y: ey + eh / 2 },
      { x: ex + ew, y: ey + eh / 2 },
    ];
    handles.forEach(h => {
      ctx.fillStyle = '#1f6feb';
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });
  }

  function renderElementList() {
    if (!hudData || !hudData.elements || hudData.elements.length === 0) {
      elementList.innerHTML = '<p class="muted">Sin elementos</p>';
      return;
    }
    const typeIcons = { bar: '\u258C', text: 'T', minimap: '\u25C8', 'inventory-slot': '\u25A1', image: '\u25C6', 'message-log': '\u2630' };
    let html = '';
    hudData.elements.forEach((el, i) => {
      const sel = i === selectedIndex ? ' selected' : '';
      const vis = el.visible ? '' : ' hidden';
      html += '<div class="element-list-item' + sel + '" data-index="' + i + '">';
      html += '<span class="el-type">' + (typeIcons[el.type] || '?') + '</span>';
      html += '<span class="el-id">' + el.id + '</span>';
      html += '<span class="el-vis' + vis + '" data-vis="' + i + '">' + (el.visible ? '\u25C9' : '\u25CE') + '</span>';
      html += '</div>';
    });
    elementList.innerHTML = html;

    elementList.querySelectorAll('.element-list-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.el-vis')) return;
        const idx = parseInt(item.dataset.index);
        selectElement(idx);
      });
    });

    elementList.querySelectorAll('.el-vis').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.vis);
        if (hudData.elements && hudData.elements[idx]) {
          hudData.elements[idx].visible = !hudData.elements[idx].visible;
          renderElementList();
          render();
        }
      });
    });
  }

  function selectElement(index) {
    selectedIndex = index;
    renderElementList();
    showProperties(index);
    render();
  }

  function showProperties(index) {
    const actions = document.getElementById('elementActions');
    if (!hudData || !hudData.elements || !hudData.elements[index]) {
      propContent.innerHTML = '<p class="muted">Selecciona un elemento en el canvas o en la lista</p>';
      actions.style.display = 'none';
      return;
    }
    actions.style.display = '';

    const el = hudData.elements[index];
    let html = '';

    html += '<div class="prop-group">';
    html += '<div class="prop-group-label">General</div>';
    html += propField('ID', 'id', el.id, true, 'text');
    html += propField('Tipo', 'type', el.type, true, 'text');
    html += propField('X', 'x', el.x, false, 'number', { min: -100, max: gameWidth });
    html += propField('Y', 'y', el.y, false, 'number', { min: -100, max: gameHeight });
    html += propField('Ancho', 'width', el.width, false, 'number', { min: 1, max: gameWidth });
    html += propField('Alto', 'height', el.height, false, 'number', { min: 1, max: gameHeight });
    html += propField('Visible', 'visible', el.visible, false, 'checkbox');
    html += '</div>';

    switch (el.type) {
      case 'bar':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Barra</div>';
        html += propField('Etiqueta', 'label', el.label || '', false, 'text');
        html += propField('Mostrar etiq.', 'showLabel', el.showLabel, false, 'checkbox');
        html += propField('Pos. etiqueta', 'labelPosition', el.labelPosition || 'left', false, 'select', { options: ['left', 'right', 'top', 'inside'] });
        html += propField('Color fondo', 'bgColor', el.bgColor, false, 'color');
        html += propField('Color relleno', 'fillColor', el.fillColor, false, 'color');
        html += propField('Color borde', 'borderColor', el.borderColor, false, 'color');
        html += propField('Valor ref.', 'valueRef', el.valueRef || '', false, 'text', { hint: 'ej: player.hp' });
        html += propField('M\u00E1x ref.', 'maxRef', el.maxRef || '', false, 'text', { hint: 'ej: player.maxHp' });
        html += propField('Direcci\u00F3n', 'direction', el.direction || 'horizontal', false, 'select', { options: ['horizontal', 'vertical'] });
        html += '</div>';
        break;
      case 'text':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Texto</div>';
        html += propField('Texto', 'text', el.text || '', false, 'text');
        html += propField('Fuente', 'font', el.font || 'system', false, 'select', { options: ['system', 'sprite'] });
        html += propField('Font sprite', 'spriteFont', el.spriteFont || '', false, 'text', { hint: 'entityId del font' });
        html += propField('Color', 'color', el.color, false, 'color');
        html += propField('Tama\u00F1o', 'fontSize', el.fontSize || 14, false, 'number', { min: 6, max: 72 });
        html += '</div>';
        break;
      case 'minimap':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Minimapa</div>';
        html += propField('Escala', 'scale', el.scale || 4, false, 'number', { min: 1, max: 16 });
        html += propField('Color borde', 'borderColor', el.borderColor, false, 'color');
        html += '</div>';
        break;
      case 'inventory-slot':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Slot Inventario</div>';
        html += propField('Slot #', 'slot', el.slot !== undefined ? el.slot : 0, false, 'number', { min: 0, max: 99 });
        html += propField('Color fondo', 'bgColor', el.bgColor, false, 'color');
        html += propField('Color borde', 'borderColor', el.borderColor, false, 'color');
        html += '</div>';
        break;
      case 'image':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Imagen</div>';
        html += propFieldEntity('Sprite', 'entityId', el.entityId || '');
        html += propField('Color fondo', 'bgColor', el.bgColor, false, 'color');
        html += '</div>';
        break;
      case 'message-log':
        html += '<div class="prop-group">';
        html += '<div class="prop-group-label">Mensajes</div>';
        html += propField('M\u00E1x mensajes', 'maxMessages', el.maxMessages || 50, false, 'number', { min: 1, max: 500 });
        html += propField('Color fondo', 'bgColor', el.bgColor, false, 'color');
        html += propField('Color borde', 'borderColor', el.borderColor, false, 'color');
        html += propField('Color texto', 'textColor', el.textColor, false, 'color');
        html += '</div>';
        break;
    }

    propContent.innerHTML = html;
    propContent.querySelectorAll('.prop-field input, .prop-field select').forEach(input => {
      if (input.dataset.readonly) return;
      const key = input.dataset.key;
      if (!key) return;
      input.addEventListener('change', () => {
        updateElementProp(index, key, input);
      });
      input.addEventListener('input', () => {
        updateElementProp(index, key, input);
      });
    });
  }

  function propField(label, key, value, readOnly, type, extra) {
    const ro = readOnly ? ' data-readonly="1" readonly' : '';
    let input = '';
    const val = value !== undefined && value !== null ? value : '';
    switch (type) {
      case 'text':
        input = '<input type="text" value="' + escAttr(String(val)) + '" data-key="' + key + '"' + ro + '>';
        break;
      case 'number':
        const min = extra && extra.min !== undefined ? ' min="' + extra.min + '"' : '';
        const max = extra && extra.max !== undefined ? ' max="' + extra.max + '"' : '';
        input = '<input type="number" value="' + val + '" data-key="' + key + '"' + min + max + ro + '>';
        break;
      case 'checkbox':
        const chk = val ? ' checked' : '';
        input = '<input type="checkbox" data-key="' + key + '"' + chk + '>';
        break;
      case 'color':
        input = '<input type="color" value="' + escAttr(String(val)) + '" data-key="' + key + '">';
        break;
      case 'select':
        const opts = (extra && extra.options || []).map(o =>
          '<option value="' + o + '"' + (val === o ? ' selected' : '') + '>' + o + '</option>'
        ).join('');
        input = '<select data-key="' + key + '">' + opts + '</select>';
        break;
      default:
        input = '<input type="text" value="' + escAttr(String(val)) + '" data-key="' + key + '"' + ro + '>';
    }
    const hint = extra && extra.hint ? '<span class="prop-hint">' + extra.hint + '</span>' : '';
    return '<div class="prop-field"><label>' + label + '</label>' + input + hint + '</div>';
  }

  function propFieldEntity(label, key, value) {
    const opts = Object.keys(atlasSprites).map(id => {
      const e = atlasSprites[id];
      const tag = e && e.atlasName ? ' [' + e.atlasName + ']' : '';
      return '<option value="' + id + '"' + (value === id ? ' selected' : '') + '>' + id + tag + '</option>';
    }).join('');
    return '<div class="prop-field"><label>' + label + '</label><select data-key="' + key + '"><option value="">(ninguno)</option>' + opts + '</select></div>';
  }

  function escAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateElementProp(index, key, input) {
    if (!hudData.elements || !hudData.elements[index]) return;
    let val;
    if (input.type === 'checkbox') {
      val = input.checked;
    } else if (input.type === 'number') {
      val = parseFloat(input.value);
      if (isNaN(val)) val = 0;
    } else {
      val = input.value;
    }
    hudData.elements[index][key] = val;
    renderElementList();
    render();
  }

  function addElement(type) {
    if (!hudData) return;
    const el = getDefaults(type);
    el.x = 20 + (hudData.elements.length * 10) % (gameWidth - 100);
    el.y = 20 + (hudData.elements.length * 15) % (gameHeight - 60);
    hudData.elements.push(el);
    selectElement(hudData.elements.length - 1);
    if (saveStatus) {
      saveStatus.textContent = '+ ' + el.id;
      saveStatus.style.color = '#3fb950';
      setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 2000);
    }
  }

  function deleteElement(index) {
    if (!hudData.elements || index < 0 || index >= hudData.elements.length) return;
    hudData.elements.splice(index, 1);
    if (selectedIndex >= hudData.elements.length) selectedIndex = hudData.elements.length - 1;
    if (hudData.elements.length === 0) selectedIndex = -1;
    renderElementList();
    showProperties(selectedIndex);
    render();
  }

  function duplicateElement(index) {
    if (!hudData.elements || index < 0 || index >= hudData.elements.length) return;
    const orig = hudData.elements[index];
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = generateId(orig.type);
    copy.x += 10;
    copy.y += 10;
    hudData.elements.push(copy);
    selectElement(hudData.elements.length - 1);
  }

  function newHud(name, w, h) {
    hudData = {
      name: name || 'mi_hud',
      canvasWidth: w || 640,
      canvasHeight: h || 480,
      elements: [],
    };
    gameWidth = hudData.canvasWidth;
    gameHeight = hudData.canvasHeight;
    selectedIndex = -1;
    idCounter = 0;
    updateHudName();
    renderElementList();
    showProperties(-1);
    render();
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x: x / zoom, y: y / zoom };
  }

  function hitTest(cx, cy) {
    if (!hudData || !hudData.elements) return -1;
    for (let i = hudData.elements.length - 1; i >= 0; i--) {
      const el = hudData.elements[i];
      if (cx >= el.x && cx <= el.x + el.width && cy >= el.y && cy <= el.y + el.height) {
        return i;
      }
    }
    return -1;
  }

  function hitHandle(cx, cy, el) {
    const handleSize = 6 / zoom;
    const corners = [
      { x: el.x, y: el.y, type: 'nw' },
      { x: el.x + el.width, y: el.y, type: 'ne' },
      { x: el.x, y: el.y + el.height, type: 'sw' },
      { x: el.x + el.width, y: el.y + el.height, type: 'se' },
    ];
    for (const h of corners) {
      if (Math.abs(cx - h.x) <= handleSize && Math.abs(cy - h.y) <= handleSize) {
        return h.type;
      }
    }
    return null;
  }

  canvas.addEventListener('mousedown', e => {
    if (!hudData) return;
    const { x, y } = getCanvasCoords(e);
    if (selectedIndex >= 0 && hudData.elements[selectedIndex]) {
      const handle = hitHandle(x, y, hudData.elements[selectedIndex]);
      if (handle) {
        dragState = { type: 'resize', handle, index: selectedIndex, startX: x, startY: y,
          origX: hudData.elements[selectedIndex].x, origY: hudData.elements[selectedIndex].y,
          origW: hudData.elements[selectedIndex].width, origH: hudData.elements[selectedIndex].height };
        return;
      }
    }
    const idx = hitTest(x, y);
    if (idx >= 0) {
      const el = hudData.elements[idx];
      dragState = { type: 'move', index: idx, offsetX: x - el.x, offsetY: y - el.y };
      if (idx !== selectedIndex) selectElement(idx);
    } else {
      selectedIndex = -1;
      renderElementList();
      showProperties(-1);
      render();
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!dragState || !hudData) return;
    const { x, y } = getCanvasCoords(e);
    const el = hudData.elements[dragState.index];
    if (!el) return;

    if (dragState.type === 'move') {
      el.x = Math.round(x - dragState.offsetX);
      el.y = Math.round(y - dragState.offsetY);
    } else if (dragState.type === 'resize') {
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      const h = dragState.handle;
      if (h.includes('e')) { el.width = Math.max(10, dragState.origW + dx); }
      if (h.includes('w')) { el.width = Math.max(10, dragState.origW - dx); el.x = dragState.origX + dx; }
      if (h.includes('s')) { el.height = Math.max(10, dragState.origH + dy); }
      if (h.includes('n')) { el.height = Math.max(10, dragState.origH - dy); el.y = dragState.origY + dy; }
    }
    render();
  });

  canvas.addEventListener('mouseup', () => {
    if (dragState && hudData && hudData.elements[dragState.index]) {
      renderElementList();
      showProperties(selectedIndex);
    }
    dragState = null;
  });

  canvas.addEventListener('mouseleave', () => {
    dragState = null;
  });

  function updateHudName() {
    const el = document.getElementById('hudNameLabel');
    const del = document.getElementById('deleteGroup');
    if (hudData) {
      el.textContent = hudData.name || 'Sin nombre';
      del.style.display = '';
    } else {
      el.textContent = '\u2014';
      del.style.display = 'none';
    }
  }

  async function saveHud() {
    if (!hudData) return;
    setStatus('\u231B Guardando...', '#ffd700');
    try {
      const name = (hudData.name || 'hud').replace(/\s+/g, '_').toLowerCase();
      const res = await fetch('/api/hud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: hudData }),
      });
      const result = await res.json();
      if (result.ok) {
        setStatus('\u2705 Guardado: ' + name, '#3fb950');
      } else {
        setStatus('\u274C Error: ' + (result.error || 'desconocido'), '#f85149');
      }
    } catch (err) {
      setStatus('\u274C Error de red', '#f85149');
    }
  }

  async function loadHud(name) {
    try {
      const res = await fetch('/api/hud?name=' + encodeURIComponent(name) + '&t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      hudData = await res.json();
      gameWidth = hudData.canvasWidth || 640;
      gameHeight = hudData.canvasHeight || 480;
      selectedIndex = -1;
      idCounter = hudData.elements ? hudData.elements.length : 0;
      updateHudName();
      renderElementList();
      showProperties(-1);
      render();
      setStatus('\uD83D\uDCC2 Cargado: ' + name, '#58a6ff');
    } catch (err) {
      alert('Error al cargar HUD: ' + err.message);
    }
  }

  function setStatus(msg, color) {
    saveStatus.textContent = msg;
    saveStatus.style.color = color || '#8b949e';
    saveStatus.style.opacity = '1';
    setTimeout(() => {
      if (saveStatus.textContent === msg) {
        saveStatus.style.opacity = '0';
      }
    }, 3000);
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

  document.getElementById('btnNuevo').addEventListener('click', () => {
    showModal('Nuevo HUD',
      '<div class="modal-field"><label>Nombre</label><input type="text" id="fName" value="mi_hud"></div>' +
      '<div class="modal-field"><label>Ancho</label><input type="number" id="fW" value="640" min="320" max="1920"></div>' +
      '<div class="modal-field"><label>Alto</label><input type="number" id="fH" value="480" min="240" max="1080"></div>',
      () => {
        const name = document.getElementById('fName').value.trim() || 'mi_hud';
        const w = parseInt(document.getElementById('fW').value) || 640;
        const h = parseInt(document.getElementById('fH').value) || 480;
        newHud(name, w, h);
      }
    );
  });

  document.getElementById('btnAbrir').addEventListener('click', async () => {
    let optionsHtml = '';
    try {
      const res = await fetch('/api/hud?t=' + Date.now());
      const list = await res.json();
      if (Array.isArray(list)) {
        hudList = list;
        list.forEach(m => {
          const label = m.name || m.fileId;
          optionsHtml += '<option value="' + (m.name || m.fileId) + '">' + label + '</option>';
        });
      }
    } catch (e) {
      optionsHtml = '<option value="">Error al cargar lista</option>';
    }

    showModal('Abrir HUD',
      '<div class="modal-field"><label>Configuraciones guardadas</label><select id="fHudSelect">' +
      optionsHtml +
      '</select></div>',
      () => {
        const name = document.getElementById('fHudSelect').value;
        if (name) loadHud(name);
      }
    );
  });

  document.getElementById('btnGuardar').addEventListener('click', saveHud);

  document.getElementById('btnExport').addEventListener('click', () => {
    if (!hudData) return;
    const json = JSON.stringify(hudData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (hudData.name || 'hud') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('\u2B07 Exportado', '#58a6ff');
  });

  document.getElementById('btnEliminar').addEventListener('click', async () => {
    if (!hudData) return;
    const name = (hudData.name || 'hud').replace(/\s+/g, '_').toLowerCase();
    if (!confirm('\u00BFEliminar la configuraci\u00F3n HUD "' + name + '" definitivamente?')) return;
    try {
      const res = await fetch('/api/hud/' + encodeURIComponent(name), { method: 'DELETE' });
      const result = await res.json();
      if (result.ok) {
        setStatus('\uD83D\uDDD1 Eliminado: ' + name, '#f85149');
        hudData = null;
        selectedIndex = -1;
        updateHudName();
        renderElementList();
        showProperties(-1);
        render();
      } else {
        alert('Error al eliminar: ' + (result.error || 'desconocido'));
      }
    } catch (err) {
      alert('Error de red al eliminar');
    }
  });

  document.getElementById('btnDuplicate').addEventListener('click', () => {
    if (selectedIndex >= 0) duplicateElement(selectedIndex);
  });

  document.getElementById('btnDelete').addEventListener('click', () => {
    if (selectedIndex >= 0) {
      if (confirm('\u00BFEliminar elemento "' + hudData.elements[selectedIndex].id + '"?')) {
        deleteElement(selectedIndex);
      }
    }
  });

  document.querySelectorAll('.palette-element').forEach(btn => {
    btn.addEventListener('click', () => {
      addElement(btn.dataset.type);
    });
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

  document.getElementById('chkGrid').addEventListener('change', e => {
    showGrid = e.target.checked;
    render();
  });

  document.getElementById('selVista').addEventListener('change', e => {
    const [w, h] = e.target.value.split('x').map(Number);
    if (w && h && hudData) {
      hudData.canvasWidth = w;
      hudData.canvasHeight = h;
      gameWidth = w;
      gameHeight = h;
      render();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        deleteElement(selectedIndex);
      }
    }
  });

  async function init() {
    await loadAtlasInfo();
    newHud('default', 640, 480);
  }

  init();
})();
