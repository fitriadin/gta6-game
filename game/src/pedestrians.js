// The people of Solmar Bay: walkers on the sidewalks, chatty pairs at corners,
// drivers behind the wheels of traffic cars, and — when something scary happens —
// runners. Peds walk the sidewalk lines that border the roads, so they never need
// pathfinding: at an intersection they may turn onto the crossing road, and at a
// road's end they turn around. Fleeing is the only time a ped leaves the sidewalk,
// and then they run straight away from the danger, sliding along buildings.

import { CITY, PEDS } from './config.js';
import { circleHitsBuilding } from './city.js';
import { carDimensions } from './vehicles.js';

const SHIRTS = ['#c94f43', '#3f7fc9', '#e8e4da', '#d8a03c', '#5f9e6e', '#7a5fc9', '#e07840', '#4ecdc4', '#f2e6b8', '#8a94a6'];
const SKINS = ['#e8b98a', '#c98d5e', '#8a5a34', '#f2c9a0', '#6e4423'];

let nextPedId = 1;

function randomSidewalkPoint(city, focusX, focusY, minDist, maxDist, random) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const vertical = random() < 0.5;
    if (vertical) {
      const road = city.vRoads[Math.floor(random() * city.vRoads.length)];
      const side = random() < 0.5 ? -1 : 1;
      const x = road.x + side * (road.width / 2 + 12);
      const y = 80 + random() * (city.height - 160);
      const d = Math.hypot(x - focusX, y - focusY);
      if (d >= minDist && d <= maxDist) {
        return { axis: 'v', roadPos: road.x, side, x, y, dir: random() < 0.5 ? -1 : 1 };
      }
    } else {
      const road = city.hRoads[Math.floor(random() * city.hRoads.length)];
      const side = random() < 0.5 ? -1 : 1;
      const x = CITY.seaWidth + CITY.beachWidth + 80 + random() * (city.width - CITY.seaWidth - CITY.beachWidth - 160);
      const y = road.y + side * (road.width / 2 + 12);
      const d = Math.hypot(x - focusX, y - focusY);
      if (d >= minDist && d <= maxDist) {
        return { axis: 'h', roadPos: road.y, side, x, y, dir: random() < 0.5 ? -1 : 1 };
      }
    }
  }
  return null;
}

function makePed(city, focusX, focusY, random, state = 'walk') {
  const point = randomSidewalkPoint(city, focusX, focusY, 60, PEDS.spawnMax, random);
  const ped = {
    id: nextPedId,
    x: point ? point.x : city.spawn.x,
    y: point ? point.y : city.spawn.y,
    angle: 0,
    speed: PEDS.walkMin + random() * (PEDS.walkMax - PEDS.walkMin),
    state,
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    skin: SKINS[Math.floor(random() * SKINS.length)],
    walkCycle: random() * Math.PI * 2,
    axis: point ? point.axis : 'v',
    roadPos: point ? point.roadPos : city.spawn.x,
    side: point ? point.side : 1,
    dir: point ? point.dir : 1,
    idleUntil: 0,
    fleeUntil: 0,
    fleeX: 0,
    fleeY: 0,
    car: null,
    chatUntil: 0,
    // Combat (chunk 3): health, and the 'down' state — a ped who was hit hard
    // lies on the ground until downUntil, then gets up and walks away.
    health: 100,
    downUntil: 0,
    officer: false,
  };
  nextPedId += 1;
  return ped;
}

/** A ped's sidewalk line: the road's edge plus a step onto the pavement. */
function sidewalkLine(ped, city) {
  const roads = ped.axis === 'v' ? city.vRoads : city.hRoads;
  const road = roads.find((r) => (ped.axis === 'v' ? r.x : r.y) === ped.roadPos);
  const half = road ? road.width / 2 : 48;
  return ped.roadPos + ped.side * (half + 12);
}

/**
 * Build the crowd: walkers and chat pairs on the sidewalks near the spawn, plus
 * one driver ped riding invisibly in every traffic car.
 */
export function createPedestrians(city, vehicles, random = Math.random) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    peds.push(makePed(city, city.spawn.x, city.spawn.y, random));
  }
  // Chat pairs: two peds standing face to face near a corner.
  const pairs = Math.floor(PEDS.count * PEDS.chatFraction / 2);
  for (let i = 0; i < pairs; i += 1) {
    const first = peds[i * 2];
    const second = peds[i * 2 + 1];
    if (!first || !second) break;
    first.state = 'chat';
    second.state = 'chat';
    second.x = first.x + 26;
    second.y = first.y + 8;
    first.angle = Math.atan2(second.y - first.y, second.x - first.x) + Math.PI / 2;
    second.angle = first.angle + Math.PI;
    first.chatUntil = 25 + random() * 30;
    second.chatUntil = first.chatUntil;
  }
  assignDrivers(peds, vehicles, random);
  return peds;
}

/** Give every driverless traffic car a driver ped (hidden while they drive). */
export function assignDrivers(peds, vehicles, random = Math.random) {
  for (const car of vehicles) {
    if (car.state !== 'traffic' || car.driver) continue;
    const driver = makePedFromCar(car, random);
    car.driver = driver;
    peds.push(driver);
  }
}

function makePedFromCar(car, random) {
  const ped = {
    id: nextPedId,
    x: car.x,
    y: car.y,
    angle: car.angle,
    speed: PEDS.walkMin,
    state: 'driver',
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    skin: SKINS[Math.floor(random() * SKINS.length)],
    walkCycle: 0,
    axis: car.axis,
    roadPos: car.roadPos,
    side: 1,
    dir: car.dir,
    idleUntil: 0,
    fleeUntil: 0,
    fleeX: 0,
    fleeY: 0,
    car,
    chatUntil: 0,
    health: 100,
    downUntil: 0,
    officer: false,
  };
  nextPedId += 1;
  return ped;
}

/** A driver whose car was just stolen: out on foot, running from the thief. */
export function freeDriver(driver, fromX, fromY, time) {
  if (!driver) return;
  driver.state = 'flee';
  driver.car = null;
  panicPed(driver, fromX, fromY, time);
}

/** Scare every ped near a point (a theft, a crash): they run from it. */
export function scareNearby(peds, x, y, radius, time) {
  for (const ped of peds) {
    if (ped.state === 'driver') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) panicPed(ped, x, y, time);
  }
}

export function panicPed(ped, fromX, fromY, time) {
  if (ped.state === 'driver' || ped.officer || ped.state === 'down') return;
  ped.state = 'flee';
  const dx = ped.x - fromX;
  const dy = ped.y - fromY;
  const distance = Math.hypot(dx, dy) || 1;
  ped.fleeX = dx / distance;
  ped.fleeY = dy / distance;
  ped.fleeUntil = time + 2.5 + Math.random() * 1.5;
}

function movePed(ped, city, dx, dy, dt, vehicles) {
  const nextX = ped.x + dx * dt;
  if (!circleHitsBuilding(city, nextX, ped.y, 12) && !entersCarZone(vehicles, ped.x, ped.y, nextX, ped.y)) ped.x = nextX;
  const nextY = ped.y + dy * dt;
  if (!circleHitsBuilding(city, ped.x, nextY, 12) && !entersCarZone(vehicles, ped.x, ped.y, ped.x, nextY)) ped.y = nextY;
  ped.x = Math.max(CITY.seaWidth + 8, Math.min(city.width - 12, ped.x));
  ped.y = Math.max(12, Math.min(city.height - 12, ped.y));
}

/**
 * True when the step from (fromX, fromY) to (toX, toY) would carry the ped
 * INTO a car they are not already overlapping. A ped must never walk onto a
 * car: peds who stepped in front of a nearly-stopped car were run over the
 * moment it sped up, and each one cost a star — quiet cooldowns cascaded
 * into five stars that way. A ped already overlapping a car (a freed driver
 * standing where their car was) may always walk out again, so the check is
 * per car: only a car the ped is NOT already inside blocks the step. Parked
 * and wrecked cars do not count — they cannot run anyone over, and the kerb
 * cars sit eight units from a sidewalk line, so blocking on them would pin
 * every walker on the beach promenade behind a parked car. The margin puts
 * the stop line just outside the ped-strike rectangle (38 x 19), so a ped
 * held at the edge is never inside the hit zone.
 */
function entersCarZone(vehicles, fromX, fromY, toX, toY) {
  if (!vehicles) return false;
  const MARGIN = 8;
  for (const car of vehicles) {
    if (car.state === 'parked' || car.state === 'wreck') continue;
    const { length, width } = carDimensions(car.model);
    const forward = { x: Math.sin(car.angle), y: -Math.cos(car.angle) };
    const right = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const fromAlong = (fromX - car.x) * forward.x + (fromY - car.y) * forward.y;
    const fromSide = (fromX - car.x) * right.x + (fromY - car.y) * right.y;
    const fromInside = Math.abs(fromAlong) < length / 2 + MARGIN && Math.abs(fromSide) < width / 2 + MARGIN;
    if (fromInside) continue;
    const toAlong = (toX - car.x) * forward.x + (toY - car.y) * forward.y;
    const toSide = (toX - car.x) * right.x + (toY - car.y) * right.y;
    if (Math.abs(toAlong) < length / 2 + MARGIN && Math.abs(toSide) < width / 2 + MARGIN) return true;
  }
  return false;
}

/** The nearest crossing road's centre-line, if the ped is at an intersection. */
function crossingAt(ped, city) {
  if (ped.axis === 'v') {
    for (const road of city.hRoads) {
      if (Math.abs(ped.y - road.y) < 16) return { axis: 'h', roadPos: road.y };
    }
  } else {
    for (const road of city.vRoads) {
      if (Math.abs(ped.x - road.x) < 16) return { axis: 'v', roadPos: road.x };
    }
  }
  return null;
}

function stepWalker(ped, city, vehicles, dt, time) {
  if (ped.state === 'idle') {
    if (time < ped.idleUntil) return;
    ped.state = 'walk';
  }
  if (ped.state === 'chat') {
    if (time > ped.chatUntil) {
      ped.state = 'walk';
      ped.idleUntil = 0;
    } else {
      // A chatter sways gently; the walk cycle doubles as an idle bob.
      ped.walkCycle += dt * 2;
      return;
    }
  }
  const line = sidewalkLine(ped, city);
  // Drift back onto the sidewalk line while walking along it.
  let targetX;
  let targetY;
  if (ped.axis === 'v') {
    targetX = line;
    targetY = ped.y + ped.dir * 120;
  } else {
    targetX = ped.x + ped.dir * 120;
    targetY = line;
  }
  const dx = targetX - ped.x;
  const dy = targetY - ped.y;
  const distance = Math.hypot(dx, dy) || 1;
  ped.angle = Math.atan2(dy, dx) + Math.PI / 2;
  ped.walkCycle += dt * 8;
  movePed(ped, city, (dx / distance) * ped.speed, (dy / distance) * ped.speed, dt, vehicles);

  // At an intersection, sometimes turn onto the crossing road; at a road's end, turn back.
  // A turn walks the ped across the intersection, so it waits for a gap in
  // traffic first: peds who stepped in front of a fast car were killed (+2
  // stars each), and two kills in 14 seconds sank every escape probe. A car
  // within 250 moving faster than a crawl holds the turn until it passes.
  // A SLOW car close by holds it too: the old check ignored cars under 150,
  // so a ped stepped out in front of a nearly-stopped car — and the car then
  // accelerated into them, which is how cooldowns kept taking +1s at 42–51
  // u/s with the ped at distance 0–4. A car that close is a wall of metal
  // whatever its speed; the ped waits on the sidewalk until it clears.
  const crossing = crossingAt(ped, city);
  if (crossing && Math.random() < 0.006) {
    let clear = true;
    for (const car of vehicles) {
      if (car.state === 'parked' || car.state === 'wreck') continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 140 || (Math.abs(car.speed) >= 150 && d < 250)) { clear = false; break; }
    }
    if (clear) {
      ped.axis = crossing.axis;
      ped.roadPos = crossing.roadPos;
      ped.side = Math.random() < 0.5 ? -1 : 1;
      ped.dir = Math.random() < 0.5 ? -1 : 1;
    }
  }
  if (ped.axis === 'v') {
    if (ped.y < 60 && ped.dir < 0) ped.dir = 1;
    else if (ped.y > city.height - 60 && ped.dir > 0) ped.dir = -1;
  } else {
    if (ped.x < CITY.seaWidth + CITY.beachWidth + 60 && ped.dir < 0) ped.dir = 1;
    else if (ped.x > city.width - 60 && ped.dir > 0) ped.dir = -1;
  }
  // Occasionally stop and look around for a few seconds.
  if (ped.state === 'walk' && Math.random() < 0.0012) {
    ped.state = 'idle';
    ped.idleUntil = time + 2 + Math.random() * 4;
  }
}

function stepFleeing(ped, city, vehicles, dt, time) {
  ped.angle = Math.atan2(ped.fleeY, ped.fleeX) + Math.PI / 2;
  ped.walkCycle += dt * 14;
  movePed(ped, city, ped.fleeX * PEDS.fleeSpeed, ped.fleeY * PEDS.fleeSpeed, dt, vehicles);
  if (time > ped.fleeUntil) {
    // Calmed down: rejoin the nearest sidewalk as a walker.
    ped.state = 'walk';
    let best = null;
    let bestDistance = Infinity;
    for (const road of city.vRoads) {
      const d = Math.abs(ped.x - road.x);
      if (d < bestDistance) {
        bestDistance = d;
        best = { axis: 'v', roadPos: road.x, side: ped.x >= road.x ? 1 : -1 };
      }
    }
    for (const road of city.hRoads) {
      const d = Math.abs(ped.y - road.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = { axis: 'h', roadPos: road.y, side: ped.y >= road.y ? 1 : -1 };
      }
    }
    if (best) {
      ped.axis = best.axis;
      ped.roadPos = best.roadPos;
      ped.side = best.side;
      ped.dir = Math.random() < 0.5 ? -1 : 1;
    }
  }
}

/**
 * Advance every ped one fixed step: walkers walk, chatters chat, drivers ride
 * with their cars, and anyone near a fast car panics. Peds that wander too far
 * from `focus` (the camera) are recycled onto a sidewalk near it.
 */
/** Knock a ped down: they lie on the ground for `seconds`, then get up and flee.
 * Officers (chunk 3) get up and resume the chase instead. */
export function setPedDown(ped, time, seconds) {
  ped.state = 'down';
  ped.downUntil = time + seconds;
  // Lying flat: the renderer draws a 'down' ped rotated, fading out.
  ped.angle += Math.PI / 2;
}

export function stepPedestrians(peds, city, vehicles, player, dt, focus, time) {
  for (const ped of peds) {
    // Officers are police.js's to move — they chase, they never wander or panic.
    if (ped.officer) continue;
    if (ped.state === 'down') {
      if (time > ped.downUntil) {
        // Got up and walked off: recycle into a fresh walker near the camera.
        const fresh = makePed(city, focus.x, focus.y, Math.random);
        const keepId = ped.id;
        Object.assign(ped, fresh, { id: keepId });
      }
      continue;
    }
    if (ped.state === 'driver') {
      if (ped.car) {
        ped.x = ped.car.x;
        ped.y = ped.car.y;
        ped.angle = ped.car.angle;
      } else {
        ped.state = 'walk';
      }
      continue;
    }
    // Danger check: a fast car bearing down, or the player's car at speed.
    if (ped.state !== 'flee') {
      for (const car of vehicles) {
        if (car.state === 'parked') continue;
        const speed = Math.abs(car.speed);
        const distance = Math.hypot(car.x - ped.x, car.y - ped.y);
        const threat = car.state === 'player' ? PEDS.panicRadius : 90;
        if (distance < threat && speed > PEDS.panicSpeed * 0.55) {
          panicPed(ped, car.x, car.y, time);
          break;
        }
      }
    }
    if (ped.state === 'flee') stepFleeing(ped, city, vehicles, dt, time);
    else stepWalker(ped, city, vehicles, dt, time);

    // Recycle far-off peds so the crowd stays around the action.
    if (focus && Math.hypot(ped.x - focus.x, ped.y - focus.y) > PEDS.despawn) {
      const fresh = makePed(city, focus.x, focus.y, Math.random);
      const keepId = ped.id;
      Object.assign(ped, fresh, { id: keepId });
    }
  }
}
