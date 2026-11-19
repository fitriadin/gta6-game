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
  return effects;
}

/** One skid segment: a dark line laid down between two rear-wheel positions. */
export function addSkid(effects, x1, y1, x2, y2) {
  effects.skids.push({ x1, y1, x2, y2, life: EFFECTS.skidLife });
  if (effects.skids.length > EFFECTS.maxSkids) {
    effects.skids.splice(0, effects.skids.length - EFFECTS.maxSkids);
  }
}

/** A drifting puff: 'dust' (pale, at the beach) or 'smoke' (grey, from tyres or a wreck). */
export function addPuff(effects, x, y, kind = 'dust') {
  const life = kind === 'smoke' ? EFFECTS.smokeLife : EFFECTS.puffLife;
  effects.puffs.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 24,
    vy: -18 - Math.random() * 22,
    size: 7 + Math.random() * 8,
    life,
    maxLife: life,
    kind,
  });
  if (effects.puffs.length > EFFECTS.maxPuffs) {
    effects.puffs.splice(0, effects.puffs.length - EFFECTS.maxPuffs);
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

/** Dust and smoke puffs, drawn above the cars. */
export function drawPuffs(context, effects, visible) {
  context.save();
  for (const puff of effects.puffs) {
    if (puff.x < visible.x || puff.x > visible.x + visible.width || puff.y < visible.y || puff.y > visible.y + visible.height) continue;
    const fraction = puff.life / puff.maxLife;
    const alpha = puff.kind === 'smoke' ? 0.34 * fraction : 0.28 * fraction;
    context.fillStyle = puff.kind === 'smoke' ? `rgba(70, 70, 76, ${alpha.toFixed(3)})` : `rgba(216, 196, 150, ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(puff.x, puff.y, puff.size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
