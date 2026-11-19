// Short-lived marks on the world: skid marks that linger on the asphalt and
// fade slowly, dust kicked up at the beach, and tyre smoke from a slide. Skids
// are drawn on the ground (under the cars); puffs float above it. Everything is
// capped so a long drift session cannot grow the lists without bound.

import { EFFECTS } from './config.js';

export function createEffects() {
  const effects = { skids: [], puffs: [] };
  // Bound helpers so callers write fx.addSkid(...) instead of importing the functions.
  effects.addSkid = (x1, y1, x2, y2) => addSkid(effects, x1, y1, x2, y2);
  effects.addPuff = (x, y, kind) => addPuff(effects, x, y, kind);
  effects.addMuzzle = (x, y, angle) => addMuzzle(effects, x, y, angle);
  effects.addSparks = (x, y) => addSparks(effects, x, y);
  effects.addExplosion = (x, y) => addExplosion(effects, x, y);
  return effects;
}

/** One skid segment: a dark line laid down between two rear-wheel positions. */
export function addSkid(effects, x1, y1, x2, y2) {
  effects.skids.push({ x1, y1, x2, y2, life: EFFECTS.skidLife });
  if (effects.skids.length > EFFECTS.maxSkids) {
    effects.skids.splice(0, effects.skids.length - EFFECTS.maxSkids);
  }
}

/** A drifting puff: 'dust' (pale, at the beach), 'smoke' (grey, from tyres or a
 * wreck), 'fire' (orange, an explosion's heart), 'spark' (bright, fast, a hit or
 * a muzzle) or 'flash' (the blink of a gunshot). Velocity and size can be given;
 * otherwise they are randomised. */
export function addPuff(effects, x, y, kind = 'dust', vx = null, vy = null, size = null) {
  const life =
    kind === 'smoke'
      ? EFFECTS.smokeLife
      : kind === 'fire'
        ? EFFECTS.fireLife
        : kind === 'spark'
          ? EFFECTS.sparkLife
          : kind === 'flash'
            ? EFFECTS.flashLife
            : EFFECTS.puffLife;
  effects.puffs.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    vx: vx === null ? (Math.random() - 0.5) * 24 : vx,
    vy: vy === null ? -18 - Math.random() * 22 : vy,
    size: size === null ? 7 + Math.random() * 8 : size,
    life,
    maxLife: life,
    kind,
  });
  if (effects.puffs.length > EFFECTS.maxPuffs) {
    effects.puffs.splice(0, effects.puffs.length - EFFECTS.maxPuffs);
  }
}

/** The blink of a gunshot: a bright flash at the muzzle plus a couple of sparks. */
export function addMuzzle(effects, x, y, angle) {
  addPuff(effects, x, y, 'flash', Math.cos(angle) * 60, Math.sin(angle) * 60, 10);
  addPuff(effects, x, y, 'flash', 0, 0, 6);
  for (let i = 0; i < 2; i += 1) {
    const spread = angle + (Math.random() - 0.5) * 0.8;
    const speed = 180 + Math.random() * 160;
    addPuff(effects, x, y, 'spark', Math.cos(spread) * speed, Math.sin(spread) * speed, 3 + Math.random() * 2);
  }
}

/** A burst of bright sparks where a bullet or a fist landed. */
export function addSparks(effects, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 220;
    addPuff(effects, x, y, 'spark', Math.cos(angle) * speed, Math.sin(angle) * speed, 3 + Math.random() * 3);
  }
}

/** A car blowing up: a fireball, a column of smoke, and sparks thrown wide. */
export function addExplosion(effects, x, y) {
  for (let i = 0; i < 10; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 26;
    addPuff(
      effects,
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      'fire',
      Math.cos(angle) * (40 + Math.random() * 80),
      Math.sin(angle) * (40 + Math.random() * 80) - 40,
      18 + Math.random() * 22,
    );
  }
  for (let i = 0; i < 8; i += 1) {
    addPuff(effects, x, y, 'smoke', (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 14 + Math.random() * 14);
  }
  for (let i = 0; i < 12; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 380;
    addPuff(effects, x, y, 'spark', Math.cos(angle) * speed, Math.sin(angle) * speed, 3 + Math.random() * 3);
  }
}

export function stepEffects(effects, dt) {
  for (let i = effects.skids.length - 1; i >= 0; i -= 1) {
    effects.skids[i].life -= dt;
    if (effects.skids[i].life <= 0) effects.skids.splice(i, 1);
  }
  for (let i = effects.puffs.length - 1; i >= 0; i -= 1) {
    const puff = effects.puffs[i];
    puff.life -= dt;
    if (puff.life <= 0) {
      effects.puffs.splice(i, 1);
      continue;
    }
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vy -= 12 * dt;
    puff.size += 14 * dt;
  }
}

/** Skid marks, drawn on the ground before the cars. */
export function drawSkids(context, effects, visible) {
  context.save();
  context.lineCap = 'round';
  context.lineWidth = 5;
  for (const skid of effects.skids) {
    if (skid.x1 < visible.x || skid.x1 > visible.x + visible.width || skid.y1 < visible.y || skid.y1 > visible.y + visible.height) continue;
    const alpha = Math.min(0.5, 0.5 * (skid.life / EFFECTS.skidLife) + 0.12);
    context.strokeStyle = `rgba(18, 18, 22, ${alpha.toFixed(3)})`;
    context.beginPath();
    context.moveTo(skid.x1, skid.y1);
    context.lineTo(skid.x2, skid.y2);
    context.stroke();
  }
  context.restore();
}

/** Dust, smoke, fire and sparks, drawn above the cars. */
export function drawPuffs(context, effects, visible) {
  context.save();
  for (const puff of effects.puffs) {
    if (puff.x < visible.x || puff.x > visible.x + visible.width || puff.y < visible.y || puff.y > visible.y + visible.height) continue;
    const fraction = puff.life / puff.maxLife;
    let colour;
    if (puff.kind === 'smoke') colour = `rgba(70, 70, 76, ${(0.34 * fraction).toFixed(3)})`;
    else if (puff.kind === 'fire') colour = `rgba(255, ${Math.round(120 + 80 * fraction)}, 30, ${(0.85 * fraction).toFixed(3)})`;
    else if (puff.kind === 'spark') colour = `rgba(255, 232, 130, ${(0.95 * fraction).toFixed(3)})`;
    else if (puff.kind === 'flash') colour = `rgba(255, 244, 180, ${(0.95 * fraction).toFixed(3)})`;
    else colour = `rgba(216, 196, 150, ${(0.28 * fraction).toFixed(3)})`;
    context.fillStyle = colour;
    context.beginPath();
    context.arc(puff.x, puff.y, puff.size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
