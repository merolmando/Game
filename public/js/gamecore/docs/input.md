# `input.js` — Sistema de Input

Captura eventos de teclado y expone un API unificada para consultar el estado de las teclas. Los nombres de tecla se normalizan a minúsculas.

## Variables globales

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `keys` | `object` | Mapa `{ tecla: boolean }` — se actualiza con cada `keydown`/`keyup`. Ej: `keys['w'] === true` mientras W está presionada |

## Event listeners

| Evento | Qué hace |
|--------|----------|
| `document.addEventListener('keydown', e)` | Setea `keys[e.key.toLowerCase()] = true`. Previene scroll con `e.preventDefault()` para las flechas direccionales |
| `document.addEventListener('keyup', e)` | Setea `keys[e.key.toLowerCase()] = false` |

## Métodos de `Input`

| Método | Teclas que detecta | En modo 2D | En modo ray |
|--------|--------------------|------------|-------------|
| `isDown(key)` | cualquier tecla (string) | Útil para consultas genéricas | — |
| `isForward()` | `w`, `↑` | Mover arriba (dy = -1) | Avanzar en dirección del vector dir |
| `isBackward()` | `s`, `↓` | Mover abajo (dy = +1) | Retroceder en dirección opuesta |
| `isLeft()` | `a`, `←` | Mover izquierda (dx = -1) | Rotar cámara a la izquierda |
| `isRight()` | `d`, `→` | Mover derecha (dx = +1) | Rotar cámara a la derecha |
| `isStrafeLeft()` | `q` | — | Strafear perpendicular a la izquierda |
| `isStrafeRight()` | `e` | — | Strafear perpendicular a la derecha |

**Nota:** `isDown(key)` es el método base; los demás wrappers llaman a `isDown()` internamente. Esto permite re-mapear teclas cambiando solo el string en el wrapper.

## Dependencias

ninguna
