# `sprite.js` — Sistema de Sprites Multi-Atlas

Gestiona la carga de múltiples atlas de sprites (uno por categoría: `mundo`, `entidades`, `ui`, `efectos`) y el dibujado de entidades con soporte para direcciones, mirror y animación.

## Arquitectura Multi-Atlas

En lugar de un único `atlas.png`, el sistema carga archivos separados por grupo:

| Grupo | Archivo | Propósito |
|-------|---------|-----------|
| `mundo` | `atlas_mundo.png/.json` | Tiles de terreno, paredes, objetos del mundo |
| `entidades` | `atlas_entidades.png/.json` | Personajes, NPCs, enemigos |
| `ui` | `atlas_ui.png/.json` | Fuentes, iconos, elementos de HUD (futuro) |
| `efectos` | `atlas_efectos.png/.json` | Partículas, efectos visuales (futuro) |

## Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `atlases` | `object` | `{}` | Diccionario `{ nombre: { img, json } }` con los atlas cargados |
| `loaded` | `boolean` | `false` | `true` una vez que al menos un atlas terminó de cargarse |
| `animTimers` | `object` | `{}` | Temporizadores internos por entityId para animación |

## Getters backward-compatibles

| Getter | Retorno | Propósito |
|--------|---------|-----------|
| `atlas` | `HTMLImageElement` | Imagen del atlas `mundo` (compatibilidad con código legacy) |
| `atlasJson` | `object` | JSON del atlas `mundo` |
| `atlasImage` | `HTMLImageElement` | Referencia directa a `atlas` |

## Métodos

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `load()` | — | `Promise<void>` | Detecta grupos disponibles en `public/generated/` y los carga via `fetch`. Setea `loaded = true` |
| `getEntity(entityId)` | `entityId: string` | `object \| null` | Busca una entidad por ID en todos los atlas cargados. Retorna sus datos del JSON o `null` |
| `getAtlas(name)` | `name: string` | `object \| null` | Retorna el objeto `{ img, json }` de un grupo, o `null` si no existe |
| `getAtlasNames()` | — | `string[]` | Lista de nombres de grupos cargados |
| `getImageData(name)` | `name: string` | `ImageData \| null` | Retorna el ImageData del atlas (construido lazy y cacheado) |
| `getFrame(entityId, frameIndex, direction)` | `entityId, frameIndex: number, direction?: string` | `object \| null` | Obtiene el frame de una entidad, resolviendo dirección y mirror. Retorna `{ sx, sy, sw, sh, atlasName, mirror }` |
| `getAnimFrame(entityId, dt, direction)` | `entityId, dt: number, direction?: string` | `object \| null` | Versión animada: avanza el frame según `animSpeed` y llama a `getFrame()` |
| `resetAnim(entityId)` | `entityId` | `void` | Reinicia el temporizador de animación de una entidad |
| `draw(ctx, entityId, dx, dy, dw, dh, frameIndex, direction)` | `ctx, entityId, dx, dy, dw, dh, frameIndex?, direction?` | `boolean` | Dibuja un frame de entidad en el canvas. Aplica mirror con `ctx.scale(-1, 1)` si el frame lo requiere |
| `drawAnim(ctx, entityId, dx, dy, dw, dh, dt, direction)` | `ctx, entityId, dx, dy, dw, dh, dt, direction?` | `boolean` | Versión animada de `draw()` |

## Sistema de Direcciones

Las entidades pueden tener `dirFrames` en el JSON del atlas:

```json
{
  "dirFrames": {
    "up": 0,
    "right": 4,
    "down": 8,
    "left": 4
  }
}
```

- `"4dir"`: 3 bloques en el spritesheet (up, right, down). Left usa mirror de right
- `"8dir"`: 5 bloques (up, upRight, right, downRight, down)
- El valor numérico es el frame offset dentro del spritesheet

Mirror automático: cuando el frame tiene `mirror: true`, los `draw()` y `drawAnim()` aplican `ctx.scale(-1, 1)` horizontalmente.

## Dependencias

ninguna
