// Save and load through localStorage. The save holds money, missions completed,
// the player's position, the car they are driving (if any), and settings (mute).
// Autosave happens on pause; the pause screen also offers a manual save. Storage
// can be off (private windows) — then the game simply runs without persisting,
// and load returns null.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    money: 0,
    missionsCompleted: [],
    player: null,
    car: null,
    settings: { mute: false },
    savedAt: 0,
  };
}

/** Read the save, or null when there is none or it is unreadable. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
    return {
      ...defaultSave(),
      ...parsed,
      settings: { ...defaultSave().settings, ...(parsed.settings || {}) },
    };
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

/** Write the current state. Returns true when the write stuck. */
export function saveGame(state) {
  try {
    const car = state.player.inCar;
    const data = {
      version: 1,
      money: state.money,
      missionsCompleted: state.missionsCompleted || [],
      player: { x: Math.round(state.player.x), y: Math.round(state.player.y) },
      car: car
        ? {
            model: car.model,
            colour: car.colour,
            x: Math.round(car.x),
            y: Math.round(car.y),
            angle: car.angle,
            damage: Math.round(car.damage),
          }
        : null,
      settings: { mute: !!state.muted },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Apply a loaded save onto a fresh state object. The saved car (if any) lands
 * on `state.savedCar`; main.js spawns it and puts the player inside. */
export function applySave(state, save) {
  state.money = save.money || 0;
  state.missionsCompleted = Array.isArray(save.missionsCompleted) ? [...save.missionsCompleted] : [];
  if (save.player && Number.isFinite(save.player.x) && Number.isFinite(save.player.y)) {
    state.player.x = save.player.x;
    state.player.y = save.player.y;
  }
  state.savedCar = null;
  if (save.car && Number.isFinite(save.car.x) && Number.isFinite(save.car.y) && typeof save.car.model === 'string') {
    state.savedCar = { ...save.car };
  }
  state.muted = !!(save.settings && save.settings.mute);
}
