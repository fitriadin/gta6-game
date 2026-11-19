// The camera: where the world is looked at, how big it appears, and how hard the
// view is shaking. Pure math — no DOM — so the shots can stage it directly.

import { CAMERA, CITY, VIEW } from './config.js';

export function createCamera() {
  const camera = {
    x: CITY.width / 2,
    y: CITY.height / 2,
    zoom: CAMERA.zoom,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
  };

  /** Ease toward a target point (the player), clamped so the view never leaves the city. */
  function follow(targetX, targetY, dt) {
    const k = 1 - Math.exp(-CAMERA.followSharpness * dt);
    camera.x += (targetX - camera.x) * k;
    camera.y += (targetY - camera.y) * k;
    clamp();
  }

  function clamp() {
    const halfW = VIEW.width / 2 / camera.zoom;
    const halfH = VIEW.height / 2 / camera.zoom;
    camera.x = Math.max(halfW, Math.min(CITY.width - halfW, camera.x));
    camera.y = Math.max(halfH, Math.min(CITY.height - halfH, camera.y));
  }

  /** Jump straight to a point (spawns, shot staging). */
  function snap(x, y) {
    camera.x = x;
    camera.y = y;
    clamp();
  }

  /** Add a jolt; it decays away on its own in update(). */
  function addShake(amount) {
    camera.shake = Math.min(24, camera.shake + amount);
  }

  function update(dt) {
    if (camera.shake > 0.1) {
      camera.shake *= Math.exp(-CAMERA.shakeDecay * dt);
      camera.shakeX = (Math.random() * 2 - 1) * camera.shake;
      camera.shakeY = (Math.random() * 2 - 1) * camera.shake;
    } else {
      camera.shake = 0;
      camera.shakeX = 0;
      camera.shakeY = 0;
    }
  }

  /** The world rectangle currently visible, for culling. */
  function visibleRect() {
    const halfW = VIEW.width / 2 / camera.zoom;
    const halfH = VIEW.height / 2 / camera.zoom;
    return { x: camera.x - halfW - 40, y: camera.y - halfH - 40, width: halfW * 2 + 80, height: halfH * 2 + 80 };
  }

  /** Convert a world point to logical view coordinates (for hit tests and the HUD). */
  function worldToView(worldX, worldY) {
    return {
      x: (worldX - camera.x + camera.shakeX) * camera.zoom + VIEW.width / 2,
      y: (worldY - camera.y + camera.shakeY) * camera.zoom + VIEW.height / 2,
    };
  }

  return { camera, follow, snap, addShake, update, visibleRect, worldToView };
}
