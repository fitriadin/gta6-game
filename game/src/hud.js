// The HUD, drawn on the canvas over the world: health bar, money, wanted stars,
// the current objective, the district name, the "press E" prompt, and a live circular
// minimap (roads, sea, parks, the player arrow). All readable at a glance.

import { CITY, FONT, MINIMAP, PALETTE, PLAYER, VIEW } from './config.js';
import { districtAt } from './city.js';
import { vehicleKmh } from './vehicles.js';

const STAR = '★';
const fonts = new Map();

function font(size, weight = 600) {
  const key = `${weight}:${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
  return fonts.get(key);
}

/** A rounded panel with a soft dark fill and a thin light border. */
function panel(context, x, y, width, height, radius = 10) {
  context.fillStyle = PALETTE.hudBg;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.strokeStyle = PALETTE.hudBorder;
  context.lineWidth = 1;
  context.stroke();
}

function drawHealth(context, state) {
  const x = 20;
  const y = 20;
  const width = 220;
  const height = 22;
  panel(context, x - 8, y - 8, width + 16, height + 34, 12);
  context.font = font(13);
  context.fillStyle = PALETTE.muted;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText('HEALTH', x, y + 1);
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.beginPath();
  context.roundRect(x, y + 8, width, height, 6);
  context.fill();
  const fraction = Math.max(0, state.player.health / PLAYER.maxHealth);
  context.fillStyle = fraction < 0.3 ? PALETTE.healthLow : PALETTE.health;
  if (fraction > 0) {
    context.beginPath();
    context.roundRect(x, y + 8, Math.max(10, width * fraction), height, 6);
    context.fill();
  }
  context.font = font(13, 700);
  context.fillStyle = PALETTE.text;
  context.textAlign = 'right';
  context.fillText(String(Math.ceil(state.player.health)), x + width, y + 1);
}

function drawMoney(context, state) {
  const text = `$${state.money.toLocaleString('en-US')}`;
  context.font = font(26, 800);
  const width = context.measureText(text).width + 28;
  const x = VIEW.width - width - 20;
  const y = 20;
  panel(context, x, y, width, 44, 12);
  context.fillStyle = PALETTE.money;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.fillText(text, x + width - 14, y + 23);
}

function drawStars(context, state) {
  const wanted = state.wanted || 0;
  context.font = font(30, 700);
  const starWidth = context.measureText(STAR).width + 4;
  const width = starWidth * 5 + 20;
  const x = VIEW.width - width - 20;
  const y = 76;
  panel(context, x, y, width, 44, 12);
  // At three stars and up the heat shows: a red rim around the stars.
  if (wanted >= 3) {
    context.strokeStyle = 'rgba(229, 83, 75, 0.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, width, 44, 12);
    context.stroke();
  }
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    context.fillStyle = i < wanted ? PALETTE.star : PALETTE.starEmpty;
    context.fillText(STAR, x + 10 + i * starWidth, y + 23);
  }
}

/** The weapon indicator: what is in hand, and how much ammo is left (endless). */
function drawWeapon(context, state) {
  const combat = state.combat;
  if (!combat) return;
  const name = combat.weapon === 'pistol' ? 'PISTOL' : String(combat.weapon).toUpperCase();
  context.font = font(17, 800);
  const nameWidth = context.measureText(name).width;
  context.font = font(17, 700);
  const ammoWidth = context.measureText('∞').width;
  const width = nameWidth + ammoWidth + 56;
  const height = 40;
  const driving = !!state.player.inCar;
  const x = VIEW.width - width - 20;
  const y = driving ? VIEW.height - height - 20 - 74 : VIEW.height - height - 20;
  panel(context, x, y, width, height, 12);
  context.fillStyle = PALETTE.accent;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText('◉', x + 12, y + 21);
  context.fillStyle = PALETTE.text;
  context.font = font(17, 800);
  context.fillText(name, x + 32, y + 21);
  context.fillStyle = PALETTE.muted;
  context.font = font(17, 700);
  context.textAlign = 'right';
  context.fillText('∞', x + width - 14, y + 21);
}

/** A big centre-screen banner: BUSTED (and, later, mission banners). */
function drawBanner(context, state) {
  const banner = state.banner;
  if (!banner || state.time >= banner.until) return;
  const fadeIn = Math.min(1, (state.time - banner.since) / 0.25);
  const fadeOut = Math.min(1, (banner.until - state.time) / 0.4);
  const alpha = Math.min(fadeIn, fadeOut);
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, alpha));
  context.font = font(72, 900);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0,0,0,0.6)';
  context.shadowBlur = 18;
  context.fillStyle = banner.colour || '#5b9cf5';
  context.fillText(banner.text, VIEW.width / 2, VIEW.height / 2 - 20);
  context.shadowBlur = 0;
  if (banner.sub) {
    context.font = font(20, 600);
    context.fillStyle = PALETTE.text;
    context.fillText(banner.sub, VIEW.width / 2, VIEW.height / 2 + 34);
  }
  context.restore();
}

/** The mouse crosshair: a small ring with a dot, where the next shot will go. */
function drawCrosshair(context, state) {
  if (!state.showCrosshair || !state.mouse) return;
  const { x, y } = state.mouse;
  context.save();
  context.strokeStyle = 'rgba(245, 185, 66, 0.95)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 11, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x - 16, y);
  context.lineTo(x - 7, y);
  context.moveTo(x + 7, y);
  context.lineTo(x + 16, y);
  context.moveTo(x, y - 16);
  context.lineTo(x, y - 7);
  context.moveTo(x, y + 7);
  context.lineTo(x, y + 16);
  context.stroke();
  context.fillStyle = 'rgba(245, 185, 66, 0.95)';
  context.beginPath();
  context.arc(x, y, 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawObjective(context, state) {
  const objective = state.objective || 'Explore Solmar Bay';
  context.font = font(17, 700);
  const width = context.measureText(objective).width + 44;
  const x = (VIEW.width - width) / 2;
  const y = 20;
  panel(context, x, y, width, 40, 20);
  context.fillStyle = PALETTE.accent;
  context.beginPath();
  context.arc(x + 20, y + 20, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = PALETTE.text;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(objective, x + 32, y + 21);
}

function drawDistrict(context, state) {
  const name = districtAt(state.player.x, state.player.y);
  context.font = font(15, 600);
  context.fillStyle = 'rgba(244, 241, 230, 0.85)';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.shadowColor = 'rgba(0,0,0,0.7)';
  context.shadowBlur = 6;
  context.fillText(name, 20, VIEW.height - MINIMAP.radius * 2 - 34);
  context.shadowBlur = 0;
}

function drawPrompt(context, state) {
  const driving = !!state.player.inCar;
  if (!driving && !state.player.nearCar) return;
  const text = driving ? 'Press E to exit the car' : 'Press E to steal the car';
  context.font = font(18, 700);
  const width = context.measureText(text).width + 48;
  const x = (VIEW.width - width) / 2;
  const y = VIEW.height - 64;
  panel(context, x, y, width, 42, 21);
  context.fillStyle = PALETTE.accent;
  context.beginPath();
  context.roundRect(x + 12, y + 10, 24, 22, 5);
  context.fill();
  context.fillStyle = '#111';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('E', x + 24, y + 22);
  context.fillStyle = PALETTE.text;
  context.textAlign = 'left';
  context.fillText(text, x + 44, y + 22);
}

/** The speedometer: only while driving, bottom-right, with the car's condition. */
function drawSpeed(context, state) {
  const car = state.player.inCar;
  if (!car) return;
  const kmh = String(vehicleKmh(car));
  context.font = font(34, 800);
  const numberWidth = context.measureText(kmh).width;
  context.font = font(15, 700);
  const unitWidth = context.measureText('km/h').width;
  const width = Math.max(150, numberWidth + unitWidth + 52);
  const height = 62;
  const x = VIEW.width - width - 20;
  const y = VIEW.height - height - 20;
  panel(context, x, y, width, height, 12);
  context.font = font(34, 800);
  context.fillStyle = PALETTE.text;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.fillText(kmh, x + width - 16 - unitWidth - 6, y + 26);
  context.font = font(15, 700);
  context.fillStyle = PALETTE.muted;
  context.fillText('km/h', x + width - 16, y + 26);
  // Damage bar under the number: green while sound, red as the car falls apart.
  const barWidth = width - 32;
  const damageFraction = 1 - car.damage / 100;
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.beginPath();
  context.roundRect(x + 16, y + height - 16, barWidth, 7, 3);
  context.fill();
  context.fillStyle = damageFraction < 0.3 ? PALETTE.healthLow : PALETTE.health;
  if (damageFraction > 0) {
    context.beginPath();
    context.roundRect(x + 16, y + height - 16, Math.max(6, barWidth * damageFraction), 7, 3);
    context.fill();
  }
}

/** The circular minimap: sea, roads, parks, buildings, the player arrow, north up. */
function drawMinimap(context, state) {
  const city = state.city;
  const cx = 20 + MINIMAP.radius;
  const cy = VIEW.height - 20 - MINIMAP.radius;
  const radius = MINIMAP.radius;
  const scale = (radius * 2) / MINIMAP.range;

  context.save();
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = '#5d8a4c';
  context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  const toMap = (wx, wy) => ({
    x: cx + (wx - state.player.x) * scale,
    y: cy + (wy - state.player.y) * scale,
  });

  // Sea.
  const sea = toMap(0, 0);
  const seaRight = toMap(CITY.seaWidth, 0);
  context.fillStyle = PALETTE.seaDeep;
  context.fillRect(cx - radius, cy - radius, seaRight.x - (cx - radius), radius * 2);
  void sea;
  // Beach.
  const beachRight = toMap(CITY.seaWidth + CITY.beachWidth, 0);
  context.fillStyle = PALETTE.beach;
  context.fillRect(seaRight.x, cy - radius, beachRight.x - seaRight.x, radius * 2);

  // Parks.
  context.fillStyle = '#4a7a3d';
  for (const park of city.parks) {
    const p = toMap(park.x, park.y);
    context.fillRect(p.x, p.y, park.width * scale, park.height * scale);
  }
  // Roads.
  context.strokeStyle = '#3d4148';
  context.lineCap = 'butt';
  for (const road of city.vRoads) {
    const p = toMap(road.x, 0);
    context.lineWidth = Math.max(2, road.width * scale);
    context.beginPath();
    context.moveTo(p.x, cy - radius);
    context.lineTo(p.x, cy + radius);
    context.stroke();
  }
  for (const road of city.hRoads) {
    const p = toMap(0, road.y);
    context.lineWidth = Math.max(2, road.width * scale);
    context.beginPath();
    context.moveTo(cx - radius, p.y);
    context.lineTo(cx + radius, p.y);
    context.stroke();
  }
  // Buildings, faint.
  context.fillStyle = 'rgba(200, 190, 170, 0.75)';
  for (const building of city.buildings) {
    const p = toMap(building.x, building.y);
    if (p.x < cx - radius - 20 || p.x > cx + radius || p.y < cy - radius - 20 || p.y > cy + radius) continue;
    context.fillRect(p.x, p.y, Math.max(2, building.width * scale), Math.max(2, building.height * scale));
  }
  // Traffic: amber dots for moving cars; police cars show blue, and so do the
  // foot officers (chunk 3) — the player can see the net closing in.
  if (state.vehicles) {
    for (const car of state.vehicles) {
      if (car.state !== 'traffic' && car.state !== 'police') continue;
      const p = toMap(car.x, car.y);
      if (p.x < cx - radius || p.x > cx + radius || p.y < cy - radius || p.y > cy + radius) continue;
      context.fillStyle = car.model === 'police' ? '#5b9cf5' : '#f5c542';
      context.beginPath();
      context.arc(p.x, p.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  if (state.peds) {
    for (const ped of state.peds) {
      if (!ped.officer || ped.state === 'down') continue;
      const p = toMap(ped.x, ped.y);
      if (p.x < cx - radius || p.x > cx + radius || p.y < cy - radius || p.y > cy + radius) continue;
      context.fillStyle = '#5b9cf5';
      context.beginPath();
      context.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }
  // The player: a white arrow pointing where they face.
  context.save();
  context.translate(cx, cy);
  context.rotate(state.player.angle);
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#111';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -11);
  context.lineTo(7, 8);
  context.lineTo(0, 4);
  context.lineTo(-7, 8);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.restore();
  // Ring + a small N marker.
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();
  context.font = font(12, 800);
  context.fillStyle = PALETTE.text;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillText('N', cx, cy - radius + 16);
}

/** Draw the whole HUD for the play screen. `screen` is the current screen name —
 * the crosshair only shows while actually playing. */
export function drawHud(context, state, screen = 'play') {
  drawHealth(context, state);
  drawMoney(context, state);
  drawStars(context, state);
  drawObjective(context, state);
  drawDistrict(context, state);
  drawPrompt(context, state);
  drawSpeed(context, state);
  drawWeapon(context, state);
  drawMinimap(context, state);
  drawBanner(context, state);
  if (screen === 'play') drawCrosshair(context, state);
}
