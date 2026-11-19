// Procedural sprites, drawn once onto offscreen canvases and cached: building roofs,
// car bodies, top-down people, palms and trees. Nothing is loaded from anywhere —
// every pixel is drawn in code, so the game works fully offline.

import { PALETTE } from './config.js';

const cache = new Map();

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Fetch a cached sprite, building it on first use. */
function sprite(key, width, height, draw) {
  const found = cache.get(key);
  if (found) return found;
  const canvas = makeCanvas(width, height);
  draw(canvas.getContext('2d'), width, height);
  cache.set(key, canvas);
  return canvas;
}

/** A soft round shadow, drawn under people and cars. */
export function drawShadow(context, x, y, radiusX, radiusY, alpha = 0.3) {
  context.save();
  context.fillStyle = `rgba(15, 20, 30, ${alpha})`;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** A car body, top-down, pointing up (-y). Models: sedan, taxi, van, truck, police. */
export function carSprite(model, colour) {
  const key = `car:${model}:${colour}`;
  const dims = model === 'van' ? { w: 40, h: 74 } : model === 'truck' ? { w: 44, h: 92 } : { w: 36, h: 66 };
  return sprite(key, dims.w + 8, dims.h + 8, (ctx, w, h) => {
    const x = 4;
    const y = 4;
    const bodyW = dims.w;
    const bodyH = dims.h;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 2, y + 4, bodyW, bodyH);
    // Body with rounded corners.
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x, y, bodyW, bodyH, 9);
    ctx.fill();
    // Roof / cabin glass.
    ctx.fillStyle = model === 'truck' ? '#2b3542' : '#1d2733';
    if (model === 'truck') {
      ctx.fillRect(x + 3, y + 3, bodyW - 6, 18);
      ctx.fillStyle = '#c8cdd4';
      ctx.fillRect(x + 5, y + 26, bodyW - 10, bodyH - 32);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let rib = y + 34; rib < y + bodyH - 8; rib += 12) ctx.fillRect(x + 5, rib, bodyW - 10, 2);
    } else {
      ctx.beginPath();
      ctx.roundRect(x + 5, y + bodyH * 0.28, bodyW - 10, bodyH * 0.38, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + 7, y + bodyH * 0.3, bodyW - 14, 5);
      // Windscreens.
      ctx.fillStyle = '#22303f';
      ctx.fillRect(x + 6, y + bodyH * 0.2, bodyW - 12, 5);
      ctx.fillRect(x + 6, y + bodyH * 0.68, bodyW - 12, 5);
    }
    // Headlights and tail lights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(x + 3, y + 1, 8, 4);
    ctx.fillRect(x + bodyW - 11, y + 1, 8, 4);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(x + 3, y + bodyH - 5, 8, 4);
    ctx.fillRect(x + bodyW - 11, y + bodyH - 5, 8, 4);
    // Taxi sign.
    if (model === 'taxi') {
      ctx.fillStyle = '#f5c542';
      ctx.fillRect(x + bodyW / 2 - 8, y + bodyH * 0.44, 16, 8);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', x + bodyW / 2, y + bodyH * 0.44 + 7);
    }
    // Police livery.
    if (model === 'police') {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x, y + bodyH * 0.5, bodyW, 8);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(x + bodyW / 2 - 7, y + bodyH * 0.3, 7, 6);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + bodyW / 2, y + bodyH * 0.3, 7, 6);
    }
  });
}

/** A top-down person: head, shoulders, legs hinted by two feet. `walk` animates the stride. */
export function personSprite(shirt, skin, walk = 0) {
  const phase = Math.abs(Math.sin(walk)) > 0.5 ? 1 : 0;
  const key = `person:${shirt}:${skin}:${phase}`;
  return sprite(key, 34, 40, (ctx) => {
    const cx = 17;
    const cy = 20;
    // Feet (stride alternates with the walk phase).
    ctx.fillStyle = '#2b2b30';
    const spread = phase === 0 ? 4 : -4;
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy + 12 + spread, 3.5, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, cy + 12 - spread, 3.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body / shirt.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Arms.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx - 11, cy + 2, 3.5, 6, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 11, cy + 2, 3.5, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Hair cap.
    ctx.fillStyle = '#3a2c1e';
    ctx.beginPath();
    ctx.arc(cx, cy - 9.5, 7, Math.PI, Math.PI * 2);
    ctx.fill();
  });
}

/** The player figure: a teal shirt and a sun-bleached cap, so they stand out at a glance. */
export function playerSprite(walk = 0) {
  const phase = Math.abs(Math.sin(walk)) > 0.5 ? 1 : 0;
  const key = `player:${phase}`;
  return sprite(key, 36, 42, (ctx) => {
    const cx = 18;
    const cy = 21;
    ctx.fillStyle = '#23232a';
    const spread = phase === 0 ? 4 : -4;
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy + 13 + spread, 3.5, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, cy + 13 - spread, 3.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 10.5, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.ellipse(cx - 11.5, cy + 2, 3.5, 6, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 11.5, cy + 2, 3.5, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Cap: dome plus a brim pointing up (the facing direction).
    ctx.fillStyle = '#f5b942';
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 7.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 7.5, cy - 16, 15, 3);
  });
}

/** A palm tree, top-down: trunk dot and a ring of fronds. */
export function palmSprite(size) {
  const key = `palm:${size}`;
  return sprite(key, size * 2 + 8, size * 2 + 8, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = PALETTE.palmLeaf;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(size * 0.45, 0, size * 0.55, size * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#2a7a42';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.palmTrunk;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A round park tree. */
export function treeSprite(size) {
  const key = `tree:${size}`;
  return sprite(key, size * 2 + 8, size * 2 + 8, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#2f6e2e';
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8a3c';
    ctx.beginPath();
    ctx.arc(cx - size * 0.2, cy - size * 0.2, size * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a34f';
    ctx.beginPath();
    ctx.arc(cx - size * 0.25, cy - size * 0.3, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * A building roof, drawn at the building's own size: base colour, a parapet edge,
 * roof clutter (vents, AC units, a skylight) and, for tall towers, a helipad ring
 * on the very tallest. Roofs are cached per footprint so the city paints cheaply.
 */
export function roofSprite(building) {
  const key = `roof:${building.width}x${building.height}:${building.roof}:${building.style}:${building.floors}`;
  return sprite(key, Math.ceil(building.width), Math.ceil(building.height), (ctx, w, h) => {
    const base = PALETTE[building.roof] || PALETTE.roofC;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Subtle two-tone panels.
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const panel = 46;
    for (let x = 0; x < w; x += panel * 2) ctx.fillRect(x, 0, panel, h);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillRect(0, 0, 6, h);
    ctx.fillRect(w - 6, 0, 6, h);
    if (building.style === 'peaked') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.closePath();
      ctx.fill();
    } else if (building.style === 'courtyard') {
      ctx.fillStyle = '#6d9c54';
      ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
      ctx.fillStyle = '#8fb573';
      ctx.fillRect(w * 0.36, h * 0.36, w * 0.28, h * 0.28);
    }
    // Roof clutter: vents and AC boxes, placed deterministically from the size.
    const clutter = Math.min(6, Math.floor((w * h) / 9000));
    let seed = Math.floor(w * 31 + h * 17 + building.floors * 7);
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < clutter; i += 1) {
      const cw = 10 + next() * 16;
      const ch = 10 + next() * 16;
      const cx = 12 + next() * Math.max(1, w - cw - 24);
      const cy = 12 + next() * Math.max(1, h - ch - 24);
      ctx.fillStyle = next() > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.20)';
      ctx.fillRect(cx, cy, cw, ch);
    }
    // Helipad on the tallest towers.
    if (building.floors >= 20) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = `bold ${Math.round(Math.min(w, h) * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', w / 2, h / 2);
    }
  });
}
