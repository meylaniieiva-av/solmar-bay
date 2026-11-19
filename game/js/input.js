// Keyboard and mouse input for Solmar Bay. WASD / arrows move and drive,
// E enters or leaves a car, Space punches (on foot) or handbrakes (driving),
// Shift runs, P pauses, M mutes, Enter confirms menus.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouse = { x: 0, y: 0, clicked: false };

  function codeOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top, clicked: true };
  });

  return {
    // Held keys, as a normalised 2D move vector (-1..1 on each axis).
    moveVector() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    up() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    down() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    action() { return keys.has('Space'); },
    // True once, on the frame the key went down.
    wasPressed(code) { return pressed.has(code); },
    // Mouse click this frame (canvas coordinates), then consumed.
    takeClick() {
      const c = mouse.clicked ? { x: mouse.x, y: mouse.y } : null;
      mouse.clicked = false;
      return c;
    },
    endFrame() { pressed.clear(); },
  };
}
