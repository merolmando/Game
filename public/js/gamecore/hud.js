const HUD = {
  config: null,
  enabled: true,
  messages: [],

  async init() {
    try {
      const res = await fetch('/api/hud?name=default&t=' + Date.now());
      if (res.ok) {
        this.config = await res.json();
        console.log('[HUD] Configuraci\u00F3n cargada:', this.config.name, '(' + (this.config.elements || []).length + ' elementos)');
      } else {
        console.log('[HUD] Sin configuraci\u00F3n, HUD desactivado');
      }
    } catch (err) {
      console.warn('[HUD] No se pudo cargar la configuraci\u00F3n:', err.message);
    }
  },

  render(ctx, player) {
    if (!this.config || !this.enabled || !this.config.elements) return;
    const elements = this.config.elements;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el.visible) continue;
      this.drawElement(ctx, el, player);
    }
  },

  drawElement(ctx, el, player) {
    switch (el.type) {
      case 'bar': this.drawBar(ctx, el, player); break;
      case 'text': this.drawText(ctx, el, player); break;
      case 'minimap': this.drawMinimap(ctx, el, player); break;
      case 'inventory-slot': this.drawInventorySlot(ctx, el, player); break;
      case 'image': this.drawImage(ctx, el); break;
      case 'message-log': this.drawMessageLog(ctx, el); break;
    }
  },

  resolveRef(ref) {
    if (!ref || typeof ref !== 'string') return 0;
    const parts = ref.split('.');
    let val = window;
    for (const part of parts) {
      if (val === undefined || val === null) return 0;
      val = val[part];
    }
    return val !== undefined && val !== null ? val : 0;
  },

  resolveText(text) {
    if (!text) return '';
    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, ref) => {
      const val = this.resolveRef(ref);
      return val !== 0 ? String(val) : match;
    });
  },

  drawBar(ctx, el, player) {
    const val = this.resolveRef(el.valueRef);
    const max = this.resolveRef(el.maxRef);
    const ratio = max > 0 ? Math.min(val / max, 1) : 0;
    const x = el.x, y = el.y, w = el.width, h = el.height;

    ctx.fillStyle = el.bgColor || '#1a1a2e';
    ctx.fillRect(x, y, w, h);

    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    const fillW = (w - 4) * ratio;
    ctx.fillStyle = el.fillColor || '#f44';
    ctx.fillRect(x + 2, y + 2, Math.max(0, fillW), h - 4);

    if (el.label && el.showLabel) {
      ctx.fillStyle = '#f0e6d0';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelText = el.label + ' ' + Math.round(val) + '/' + Math.round(max);
      ctx.fillText(labelText, x + w + 6, y + h / 2);
    }
  },

  drawText(ctx, el, player) {
    let text = this.resolveText(el.text);
    const x = el.x, y = el.y;

    if (el.font === 'sprite' && el.spriteFont && Sprite.loaded && Sprite.getEntity(el.spriteFont)) {
      this.drawSpriteText(ctx, text, x, y, el.spriteFont, el.color || '#f0e6d0', el.fontSize || 14);
    } else {
      ctx.font = (el.fontSize || 14) + 'px sans-serif';
      ctx.fillStyle = el.color || '#f0e6d0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, x, y);
    }
  },

  drawSpriteText(ctx, text, x, y, fontEntityId, color, size) {
    const info = Sprite.getEntity(fontEntityId);
    if (!info) {
      ctx.font = (size || 14) + 'px sans-serif';
      ctx.fillStyle = color || '#f0e6d0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, x, y);
      return;
    }

    let cursorX = x;
    const charH = size;

    if (color) {
      ctx.fillStyle = color;
    }

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (charCode === 32) { cursorX += size * 0.5; continue; }
      const frameIndex = charCode - 32;
      if (frameIndex < 0 || frameIndex >= info.frames) { cursorX += size * 0.3; continue; }

      const frame = Sprite.getFrame(fontEntityId, frameIndex);
      if (frame) {
        const atlasName = frame.atlasName || 'mundo';
        const atlas = Sprite.getAtlas(atlasName);
        if (atlas && atlas.img) {
          ctx.drawImage(atlas.img, frame.sx, frame.sy, frame.sw, frame.sh, cursorX, y, size, charH);
        }
        cursorX += size;
      } else {
        cursorX += size * 0.5;
      }
    }
  },

  drawMinimap(ctx, el, player) {
    const x = el.x, y = el.y, w = el.width, h = el.height;

    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    if (!Map.current) return;
    const scale = el.scale || 4;
    const grid = Map.getGrid('estructura') || Map.getGrid('terreno');
    if (!grid) return;

    const mw = Math.min(Map.current.width, Math.floor(w / scale));
    const mh = Math.min(Map.current.height, Math.floor(h / scale));

    for (let row = 0; row < mh; row++) {
      for (let col = 0; col < mw; col++) {
        const tile = grid[row] && grid[row][col];
        const info = tile && Map.current.tileColors ? Map.current.tileColors[tile] : null;
        ctx.fillStyle = info ? info.color : '#333';
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }

    if (player) {
      const px = x + Math.floor(player.x * scale);
      const py = y + Math.floor(player.y * scale);
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, scale * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f44';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + player.dirX * scale * 2.5, py + player.dirY * scale * 2.5);
      ctx.stroke();
    }
  },

  drawInventorySlot(ctx, el, player) {
    const x = el.x, y = el.y, s = Math.min(el.width, el.height);

    ctx.fillStyle = el.bgColor || '#0d1117';
    ctx.fillRect(x, y, s, s);
    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, s, s);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = (s * 0.3) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String((el.slot !== undefined ? el.slot : 0) + 1), x + s / 2, y + s / 2);
  },

  drawImage(ctx, el) {
    const x = el.x, y = el.y, w = el.width, h = el.height;

    if (el.entityId && Sprite.loaded) {
      const found = Sprite._findEntity(el.entityId);
      if (found && found.img) {
        ctx.drawImage(found.img, found.data.x, found.data.y, found.data.frameW, found.data.frameH, x, y, w, h);
        return;
      }
    }

    ctx.fillStyle = el.bgColor || '#1a1a2e';
    ctx.fillRect(x, y, w, h);
  },

  drawMessageLog(ctx, el) {
    const x = el.x, y = el.y, w = el.width, h = el.height;

    ctx.fillStyle = el.bgColor || 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    if (el.borderColor) {
      ctx.strokeStyle = el.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.fillStyle = el.textColor || '#f0e6d0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const messages = this.messages || [];
    const maxVisible = Math.max(1, Math.floor((h - 8) / 13));
    const start = Math.max(0, messages.length - maxVisible);
    for (let i = start; i < messages.length; i++) {
      ctx.fillText(messages[i], x + 4, y + 4 + (i - start) * 13);
    }
  },

  addMessage(msg) {
    if (!this.messages) this.messages = [];
    this.messages.push(String(msg));
    if (this.messages.length > (this.config ? (this.config.maxMessages || 50) : 50)) {
      this.messages.splice(0, this.messages.length - 50);
    }
  },
};
