// Keyboard and mouse input. Held keys give a movement direction; one-shot presses
// (confirm, pause, interact, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse gives
// an aim position in logical view coordinates plus a click edge.

import { KEYS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MUTE = 8;
export const ACTION_CLICK = 16;

function codeSet(codes) {
  return new Set(codes);
}

const UP = codeSet(KEYS.up);
const DOWN = codeSet(KEYS.down);
const LEFT = codeSet(KEYS.left);
const RIGHT = codeSet(KEYS.right);
const INTERACT = codeSet(KEYS.interact);
const SPRINT = codeSet(KEYS.sprint);
const PAUSE = codeSet(KEYS.pause);
const MUTE = codeSet(KEYS.mute);
const CONFIRM = codeSet(KEYS.confirm);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  // Mouse position in logical view coordinates; the renderer converts from CSS pixels.
  const mouse = { x: 0, y: 0, down: false };
  let toLogical = (clientX, clientY) => ({ x: clientX, y: clientY });

  function releaseAll() {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sprint = false;
    mouse.down = false;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SPRINT.has(event.code)) held.sprint = true;
    else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SPRINT.has(event.code)) held.sprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', releaseAll);

  target.addEventListener('pointermove', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    actions |= ACTION_CLICK;
  });
  target.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** Let the renderer teach input how CSS pixels map to logical view coordinates. */
    setCoordinateMapper(mapper) {
      toLogical = mapper;
    },
    /** Normalised movement direction from the held keys: { x, y }, each in [-1, 1]. */
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** Driving throttle, independent of steering: +1 for W, -1 for S. Unlike
     * move(), holding W+A still gives full throttle (not 0.707 of it). */
    throttle() {
      return (held.up ? 1 : 0) - (held.down ? 1 : 0);
    },
    /** Driving steering, independent of throttle: +1 for D, -1 for A. */
    steer() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    sprinting() {
      return held.sprint;
    },
    mousePosition() {
      return { x: mouse.x, y: mouse.y };
    },
    mouseDown() {
      return mouse.down;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
