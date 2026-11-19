// Drawing only: the city, the player and the props in, pixels out. The 1280x720
// logical view is scaled to fit the window and centred; the camera transform turns
// world coordinates into view coordinates. Screens (title, pause, game over, controls)
// are panels drawn over the living city. The HUD comes from hud.js.

import { CITY, FONT, PALETTE, VIEW } from './config.js';
import { carSprite, drawShadow, palmSprite, playerSprite, roofSprite, treeSprite } from './sprites.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CONTROLS = 'controls';

const fonts = new Map();

function font(size, weight = 600) {
  const key = `${weight}:${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
  return fonts.get(key);
}

function titleMenuItems(state) {
  const items = [{ id: 'new', label: 'New Game' }];
  if (state.hasSave) items.push({ id: 'continue', label: 'Continue' });
  items.push({ id: 'controls', label: 'Controls' });
  return items;
}

function pauseMenuItems() {
  return [
    { id: 'resume', label: 'Resume' },
    { id: 'save', label: 'Save Game' },
    { id: 'controls', label: 'Controls' },
    { id: 'restart', label: 'Restart' },
    { id: 'title', label: 'Quit to Title' },
  ];
}

/** Button rectangles for a menu, in logical view coordinates. */
function menuRects(items, top, width = 340, height = 52, gap = 12) {
  const x = (VIEW.width - width) / 2;
  return items.map((item, index) => ({ ...item, x, y: top + index * (height + gap), width, height }));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  /** Map a pointer's client coordinates to logical view coordinates. */
  function clientToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * view.ratio;
    const py = (clientY - rect.top) * view.ratio;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base for the whole city.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, city.width, city.height);
    // Mow stripes: faint alternating bands, for a little texture at no cost.
    context.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < city.height; y += 240) context.fillRect(0, y, city.width, 120);
    // Sea and beach along the west edge.
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, 0, CITY.seaWidth, city.height);
    context.fillStyle = PALETTE.seaShallow;
    context.fillRect(CITY.seaWidth - 90, 0, 90, city.height);
    // Wave lines where the water meets the sand.
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    for (let y = 40; y < city.height; y += 160) {
      context.beginPath();
      context.moveTo(CITY.seaWidth - 14, y);
      context.quadraticCurveTo(CITY.seaWidth + 6, y + 20, CITY.seaWidth - 10, y + 40);
      context.stroke();
    }
    context.fillStyle = PALETTE.beach;
    context.fillRect(CITY.seaWidth, 0, CITY.beachWidth, city.height);
    // Boardwalk strip at the beach's inner edge.
    context.fillStyle = '#cbb489';
    context.fillRect(CITY.seaWidth + CITY.beachWidth - 26, 0, 26, city.height);
  }

  function drawRoads(state) {
    const city = state.city;
    // Sidewalk halo under every road, then the asphalt, then the markings.
    for (const road of city.vRoads) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(road.x - road.width / 2 - 14, 0, road.width + 28, city.height);
    }
    for (const road of city.hRoads) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, road.y - road.width / 2 - 14, city.width, road.width + 28);
    }
    for (const road of city.vRoads) {
      context.fillStyle = PALETTE.road;
      context.fillRect(road.x - road.width / 2, 0, road.width, city.height);
    }
    for (const road of city.hRoads) {
      context.fillStyle = PALETTE.road;
      context.fillRect(0, road.y - road.width / 2, city.width, road.width);
    }
    // Centre dashes.
    context.strokeStyle = PALETTE.roadMark;
    context.lineWidth = 4;
    context.setLineDash([34, 30]);
    for (const road of city.vRoads) {
      context.beginPath();
      context.moveTo(road.x, 0);
      context.lineTo(road.x, city.height);
      context.stroke();
    }
    for (const road of city.hRoads) {
      context.beginPath();
      context.moveTo(0, road.y);
      context.lineTo(city.width, road.y);
      context.stroke();
    }
    context.setLineDash([]);
    // Kerb lines.
    context.strokeStyle = PALETTE.curb;
    context.lineWidth = 2;
    for (const road of city.vRoads) {
      context.beginPath();
      context.moveTo(road.x - road.width / 2, 0);
      context.lineTo(road.x - road.width / 2, city.height);
      context.moveTo(road.x + road.width / 2, 0);
      context.lineTo(road.x + road.width / 2, city.height);
      context.stroke();
    }
    for (const road of city.hRoads) {
      context.beginPath();
      context.moveTo(0, road.y - road.width / 2);
      context.lineTo(city.width, road.y - road.width / 2);
      context.moveTo(0, road.y + road.width / 2);
      context.lineTo(city.width, road.y + road.width / 2);
      context.stroke();
    }
  }

  function drawParks(state, visible) {
    const city = state.city;
    for (const park of city.parks) {
      if (park.x > visible.x + visible.width || park.x + park.width < visible.x || park.y > visible.y + visible.height || park.y + park.height < visible.y) continue;
      context.fillStyle = '#5d8a4c';
      context.fillRect(park.x, park.y, park.width, park.height);
      context.strokeStyle = PALETTE.parkPath;
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(park.x, park.y + park.height / 2);
      context.lineTo(park.x + park.width, park.y + park.height / 2);
      context.moveTo(park.x + park.width / 2, park.y);
      context.lineTo(park.x + park.width / 2, park.y + park.height);
      context.stroke();
    }
    for (const tree of city.trees) {
      if (tree.x < visible.x || tree.x > visible.x + visible.width || tree.y < visible.y || tree.y > visible.y + visible.height) continue;
      drawShadow(context, tree.x + 4, tree.y + 6, tree.size * 0.9, tree.size * 0.7, 0.25);
      const sprite = treeSprite(Math.round(tree.size));
      context.drawImage(sprite, tree.x - sprite.width / 2, tree.y - sprite.height / 2);
    }
  }

  function drawBuildings(state, visible) {
    for (const building of state.city.buildings) {
      if (building.x > visible.x + visible.width || building.x + building.width < visible.x || building.y > visible.y + visible.height || building.y + building.height < visible.y) continue;
      const lift = Math.min(14, 2 + building.floors * 0.45);
      // Drop shadow, offset south-east by the building's height.
      context.fillStyle = PALETTE.buildingShadow;
      context.fillRect(building.x + 10, building.y + 10 + lift, building.width, building.height);
      // South wall face, for a hint of height.
      context.fillStyle = PALETTE[building.wall] || PALETTE.wallA;
      context.fillRect(building.x, building.y + building.height, building.width, lift);
      context.fillStyle = 'rgba(0,0,0,0.15)';
      context.fillRect(building.x, building.y + building.height, building.width, 2);
      // The roof itself.
      context.drawImage(roofSprite(building), building.x, building.y);
    }
  }

  function drawProps(state, visible) {
    const city = state.city;
    for (const palm of city.palms) {
      if (palm.x < visible.x || palm.x > visible.x + visible.width || palm.y < visible.y || palm.y > visible.y + visible.height) continue;
      drawShadow(context, palm.x + 5, palm.y + 7, palm.size * 0.9, palm.size * 0.6, 0.25);
      const sprite = palmSprite(Math.round(palm.size));
      context.drawImage(sprite, palm.x - sprite.width / 2, palm.y - sprite.height / 2);
    }
    for (const lamp of city.lamps) {
      if (lamp.x < visible.x || lamp.x > visible.x + visible.width || lamp.y < visible.y || lamp.y > visible.y + visible.height) continue;
      context.fillStyle = '#3a3f47';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.lamp;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawParkedCars(state, visible) {
    for (const car of state.city.parkedCars) {
      if (car.x < visible.x - 60 || car.x > visible.x + visible.width + 60 || car.y < visible.y - 60 || car.y > visible.y + visible.height + 60) continue;
      const sprite = carSprite(car.model, car.colour);
      context.save();
      context.translate(car.x, car.y);
      drawShadow(context, 0, 2, sprite.width / 2, sprite.height / 2, 0.28);
      context.rotate(car.angle);
      context.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      context.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    drawShadow(context, player.x, player.y + 10, 14, 8, 0.3);
    const sprite = playerSprite(player.moving ? player.walkCycle : 0);
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    context.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    context.restore();
    // A soft ring under the player so they are easy to find in a busy frame.
    context.strokeStyle = 'rgba(245, 185, 66, 0.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y + 2, 20, 0, Math.PI * 2);
    context.stroke();
  }

  function drawWorld(state) {
    const cam = state.cam.camera;
    const visible = state.cam.visibleRect();
    context.save();
    context.translate(VIEW.width / 2, VIEW.height / 2);
    context.scale(cam.zoom, cam.zoom);
    context.translate(-cam.x + cam.shakeX, -cam.y + cam.shakeY);
    drawGround(state);
    drawRoads(state);
    drawParks(state, visible);
    drawBuildings(state, visible);
    drawProps(state, visible);
    drawParkedCars(state, visible);
    drawPlayer(state);
    context.restore();
    // Warm daylight tint + a soft vignette, in screen space.
    context.fillStyle = 'rgba(255, 214, 130, 0.07)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const gradient = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(10, 14, 24, 0.28)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawMenuButton(rect, selected, label) {
    context.fillStyle = selected ? PALETTE.accent : 'rgba(255,255,255,0.08)';
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.width, rect.height, 12);
    context.fill();
    context.strokeStyle = selected ? PALETTE.accent : 'rgba(255,255,255,0.22)';
    context.lineWidth = 1.5;
    context.stroke();
    text(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 8, 21, selected ? '#14100a' : PALETTE.text, 'center', 700);
  }

  function drawTitle(state) {
    // A dim veil over the city so the title reads anywhere.
    const veil = context.createLinearGradient(0, 0, 0, VIEW.height);
    veil.addColorStop(0, 'rgba(8, 12, 22, 0.55)');
    veil.addColorStop(0.55, 'rgba(8, 12, 22, 0.35)');
    veil.addColorStop(1, 'rgba(8, 12, 22, 0.65)');
    context.fillStyle = veil;
    context.fillRect(0, 0, VIEW.width, VIEW.height);

    context.save();
    context.shadowColor = 'rgba(0,0,0,0.55)';
    context.shadowBlur = 24;
    text('SOLMAR CITY', VIEW.width / 2, 190, 84, '#ffffff', 'center', 900);
    context.restore();
    text('SOLMAR BAY  ·  SUN, SEA & TROUBLE', VIEW.width / 2, 228, 19, PALETTE.accent, 'center', 700);
    text('An original open-world crime game — explore on foot, steal cars, outrun the police.', VIEW.width / 2, 262, 17, PALETTE.muted, 'center', 500);

    const items = titleMenuItems(state);
    const rects = menuRects(items, 320);
    rects.forEach((rect, index) => drawMenuButton(rect, index === state.menuIndex, rect.label));

    text('WASD move  ·  E enter car  ·  Space sprint  ·  P pause  ·  M mute', VIEW.width / 2, VIEW.height - 44, 16, PALETTE.muted, 'center', 500);
    text('Made for make.fun — AI agents build, you collect.', VIEW.width / 2, VIEW.height - 20, 13, 'rgba(184,192,204,0.75)', 'center', 500);
  }

  function drawPaused(state) {
    context.fillStyle = 'rgba(8, 12, 22, 0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('PAUSED', VIEW.width / 2, 170, 56, PALETTE.text, 'center', 900);
    const items = pauseMenuItems();
    const rects = menuRects(items, 220);
    rects.forEach((rect, index) => drawMenuButton(rect, index === state.menuIndex, rect.label));
    if (state.saveMessage) {
      text(state.saveMessage, VIEW.width / 2, 220 + items.length * 64 + 24, 17, PALETTE.money, 'center', 600);
    }
  }

  function drawOver(state) {
    context.fillStyle = 'rgba(8, 12, 22, 0.6)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('WASTED', VIEW.width / 2, 250, 84, '#e5534b', 'center', 900);
    text('Solmar Bay got the better of you this time.', VIEW.width / 2, 300, 19, PALETTE.muted, 'center', 500);
    text(`Money kept: $${state.money.toLocaleString('en-US')}`, VIEW.width / 2, 344, 19, PALETTE.text, 'center', 600);
    text('Press Enter or click to try again', VIEW.width / 2, 420, 21, PALETTE.accent, 'center', 700);
  }

  function drawControls() {
    context.fillStyle = 'rgba(8, 12, 22, 0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('CONTROLS', VIEW.width / 2, 130, 48, PALETTE.text, 'center', 900);
    const rows = [
      ['Move / drive', 'WASD or arrow keys'],
      ['Sprint / handbrake', 'Space'],
      ['Enter / exit / steal car', 'E'],
      ['Aim', 'Mouse'],
      ['Shoot', 'Left click'],
      ['Pause', 'P or Esc'],
      ['Mute', 'M'],
    ];
    rows.forEach((row, index) => {
      const y = 210 + index * 46;
      text(row[0], VIEW.width / 2 - 260, y, 20, PALETTE.text, 'left', 700);
      text(row[1], VIEW.width / 2 + 260, y, 20, PALETTE.muted, 'right', 500);
    });
    text('Press P, Esc or Enter to go back', VIEW.width / 2, 210 + rows.length * 46 + 30, 18, PALETTE.accent, 'center', 600);
  }

  /** Paint one frame: the world, then the HUD or a panel for the current screen. */
  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state);
      return;
    }
    if (screen === SCREEN_CONTROLS) {
      drawControls();
      return;
    }
    drawHud(context, state);
    if (screen === SCREEN_PLAY && state.toast && state.time < state.toastUntil) {
      context.font = font(17, 700);
      const width = context.measureText(state.toast).width + 36;
      const x = (VIEW.width - width) / 2;
      const y = VIEW.height - 120;
      context.fillStyle = PALETTE.hudBg;
      context.beginPath();
      context.roundRect(x, y, width, 40, 20);
      context.fill();
      context.fillStyle = PALETTE.text;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(state.toast, VIEW.width / 2, y + 21);
    }
    if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_OVER) drawOver(state);
  }

  /** Which title-menu item sits under logical point (x, y), or -1. */
  function titleMenuHit(state, x, y) {
    const rects = menuRects(titleMenuItems(state), 320);
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return i;
    }
    return -1;
  }

  function pauseMenuHit(x, y) {
    const rects = menuRects(pauseMenuItems(), 220);
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return i;
    }
    return -1;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, clientToLogical, titleMenuHit, pauseMenuHit, titleMenuItems, pauseMenuItems };
}
