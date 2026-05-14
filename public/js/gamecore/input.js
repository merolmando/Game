// Mapa de teclas presionadas. Se actualiza con los eventos keydown/keyup.
const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  // Evita el scroll de la página con las flechas direccionales.
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

const Input = {
  // Verifica si una tecla específica está siendo presionada.
  isDown(key) {
    return !!keys[key.toLowerCase()];
  },

  // Rotación a la izquierda (A o flecha izquierda).
  isLeft() {
    return this.isDown('a') || this.isDown('arrowleft');
  },

  // Rotación a la derecha (D o flecha derecha).
  isRight() {
    return this.isDown('d') || this.isDown('arrowright');
  },

  // Avanzar (W o flecha arriba).
  isForward() {
    return this.isDown('w') || this.isDown('arrowup');
  },

  // Retroceder (S o flecha abajo).
  isBackward() {
    return this.isDown('s') || this.isDown('arrowdown');
  },

  // Strafear a la izquierda (Q).
  isStrafeLeft() {
    return this.isDown('q');
  },

  // Strafear a la derecha (E).
  isStrafeRight() {
    return this.isDown('e');
  },
};
