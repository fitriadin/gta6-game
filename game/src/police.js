// The law in Solmar Bay: the wanted system, the pursuit cars, the foot officers
// who can make a bust, and the roadblocks at high heat. Wanted stars rise when the
// player commits a crime and fall again after a long clean stretch out of sight —
// the police only forget a face they cannot see.
//
// Police cars are ordinary vehicles with state 'police', driven through the same
// arcade physics as the player's car (so they skid, ram and wreck like one), and
// officers are peds with the officer flag, stepped here instead of by pedestrians.js.

import { CITY, POLICE } from './config.js';
import { circleHitsBuilding, isRoad, nearestRoadPoint } from './city.js';
import { carRadius, forwardOf, makeVehicle, rightOf, stepPlayerVehicle } from './vehicles.js';
import { panicPed, scareNearby, setPedDown } from './pedestrians.js';
import { damagePlayer } from './player.js';

const OFFICER_SHIRT = '#1e3a5f';
const OFFICER_SKINS = ['#e8b98a', '#c98d5e', '#8a5a34', '#f2c9a0', '#6e4423'];
const POLICE_COLOUR = '#f2f2f2';

let nextOfficerId = 100000;

/** Fresh police state: no heat, no units on the street. */
export function createPolice() {
  return {
    wanted: 0,
    cars: [],
    officers: [],
    cleanTime: 0,
    spawnTimer: 0,
    roadblockTimer: 0,
    roadblockCars: [],
    ramCooldown: 0,
    sirenLevel: 0,
  };
}

/** Raise the heat, clamped at five stars; any crime resets the clean timer. */
export function addWanted(police, amount, time) {
  police.wanted = Math.min(POLICE.maxStars, Math.max(0, police.wanted + amount));
  police.cleanTime = 0;
  void time;
  return police.wanted;
}

/** Distance to the nearest police unit (car or officer), or Infinity when none is out. */
export function nearestPoliceDistance(police, x, y) {
  let best = Infinity;
  for (const car of police.cars) best = Math.min(best, Math.hypot(car.x - x, car.y - y));
  for (const officer of police.officers) best = Math.min(best, Math.hypot(officer.x - x, officer.y - y));
  return best;
}

/** Pull every unit off the street and clear the heat (busted, or the trail went cold). */
export function clearPolice(police, vehicles, peds) {
  for (const car of police.cars) {
    const index = vehicles.indexOf(car);
    if (index >= 0) vehicles.splice(index, 1);
  }
  for (const officer of police.officers) {
    const index = peds.indexOf(officer);
    if (index >= 0) peds.splice(index, 1);
  }
  police.cars = [];
  police.officers = [];
  police.roadblockCars = [];
  police.wanted = 0;
  police.cleanTime = 0;
  police.sirenLevel = 0;
}

/** A random point on a road between minDist and maxDist from (x, y), or null. */
function randomRoadPoint(city, x, y, minDist, maxDist) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let point;
    if (Math.random() < 0.5) {
      const road = city.vRoads[Math.floor(Math.random() * city.vRoads.length)];
      const py = 100 + Math.random() * (city.height - 200);
      point = { x: road.x, y: py, axis: 'v', roadPos: road.x, dir: Math.random() < 0.5 ? -1 : 1 };
    } else {
      const road = city.hRoads[Math.floor(Math.random() * city.hRoads.length)];
      const px = CITY.seaWidth + CITY.beachWidth + 100 + Math.random() * (city.width - CITY.seaWidth - CITY.beachWidth - 200);
      point = { x: px, y: road.y, axis: 'h', roadPos: road.y, dir: Math.random() < 0.5 ? -1 : 1 };
    }
    const d = Math.hypot(point.x - x, point.y - y);
    if (d >= minDist && d <= maxDist) return point;
  }
  return null;
}

function spawnPoliceCar(police, ctx, role = 'chase') {
  const point = randomRoadPoint(ctx.city, ctx.player.x, ctx.player.y, POLICE.spawnCarMin, POLICE.spawnCarMax);
  const x = point ? point.x : ctx.player.x + 700;
  const y = point ? point.y : ctx.player.y;
  const angle = point ? (point.axis === 'v' ? (point.dir > 0 ? Math.PI : 0) : (point.dir > 0 ? Math.PI / 2 : -Math.PI / 2)) : 0;
  const car = makeVehicle('police', POLICE_COLOUR, x, y, angle, 'police');
  car.role = role;
  car.stuckTimer = 0;
  car.reverseUntil = 0;
  car.blockUntil = 0;
  car.boxSide = police.cars.length % 2 === 0 ? 1 : -1;
  if (point) {
    car.axis = point.axis;
    car.roadPos = point.roadPos;
    car.dir = point.dir;
  }
  ctx.vehicles.push(car);
  police.cars.push(car);
  return car;
}

function makeOfficer(x, y) {
  const officer = {
    id: nextOfficerId,
    x,
    y,
    angle: 0,
    speed: POLICE.officerSpeed,
    state: 'officer',
    shirt: OFFICER_SHIRT,
    skin: OFFICER_SKINS[Math.floor(Math.random() * OFFICER_SKINS.length)],
    walkCycle: Math.random() * Math.PI * 2,
    axis: 'v',
    roadPos: x,
    side: 1,
    dir: 1,
    idleUntil: 0,
    fleeUntil: 0,
    fleeX: 0,
    fleeY: 0,
    car: null,
    chatUntil: 0,
    health: 100,
    downUntil: 0,
    officer: true,
    arrest: 0,
    punchTimer: 0,
  };
  nextOfficerId += 1;
  return officer;
}

function spawnOfficer(police, ctx) {
  // On a sidewalk or road near the player — never inside a building, never in the sea.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = POLICE.spawnOfficerMin + Math.random() * (POLICE.spawnOfficerMax - POLICE.spawnOfficerMin);
    const x = ctx.player.x + Math.cos(angle) * distance;
    const y = ctx.player.y + Math.sin(angle) * distance;
    if (x < CITY.seaWidth + 10 || x > ctx.city.width - 14 || y < 14 || y > ctx.city.height - 14) continue;
    if (circleHitsBuilding(ctx.city, x, y, 14)) continue;
    const officer = makeOfficer(x, y);
    ctx.peds.push(officer);
    police.officers.push(officer);
    return officer;
  }
  return null;
}

function angleDiffTo(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** One pursuit car: chase the player, box them in with the other cars, ram when close. */
function stepPoliceCar(car, police, ctx, dt) {
  const player = ctx.player;
  if (car.role === 'block') {
    // A roadblock car holds its ground until the player gets close or it times out.
    if (ctx.time > car.blockUntil || Math.hypot(car.x - player.x, car.y - player.y) < 150) {
      car.role = 'chase';
    } else {
      car.speed = 0;
      car.vx = 0;
      car.vy = 0;
      return;
    }
  }

  // Aim at the player, leading them a little — and the extra cars aim to the
  // sides, so the pack tries to box the player in rather than queue behind them.
  const targetX = player.x + (player.inCar ? player.inCar.vx * 0.35 : 0);
  const targetY = player.y + (player.inCar ? player.inCar.vy * 0.35 : 0);
  let aimX = targetX;
  let aimY = targetY;
  const boxIndex = police.cars.indexOf(car);
  if (boxIndex > 0 && player.inCar) {
    const right = rightOf(player.inCar.angle);
    const side = boxIndex % 2 === 0 ? 1 : -1;
    aimX = targetX + right.x * side * 95;
    aimY = targetY + right.y * side * 95;
  }
  // Off the road or about to clip a wall: get back on the asphalt first.
  if (!isRoad(ctx.city, car.x, car.y)) {
    const roadPoint = nearestRoadPoint(ctx.city, car.x, car.y);
    aimX = roadPoint.x;
    aimY = roadPoint.y;
  }

  const desired = Math.atan2(aimX - car.x, -(aimY - car.y));
  const diff = angleDiffTo(car.angle, desired);
  let throttle = 1;
  let steer = clamp(diff * 2.4, -1, 1);
  let handbrake = Math.abs(diff) > 0.9 && Math.abs(car.speed) > 350;
  // Stuck against something: back up briefly, then try again.
  if (Math.abs(car.speed) < 25 && throttle > 0) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 1.4) {
      car.reverseUntil = ctx.time + 0.7;
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
  if (ctx.time < car.reverseUntil) {
    throttle = -1;
    steer = -steer;
    handbrake = false;
  }
  stepPlayerVehicle(car, ctx.city, { throttle, steer, handbrake }, dt, ctx.effects, null);

  // Ramming the player's car hurts the player too, on a short cooldown.
  if (player.inCar && police.ramCooldown <= 0) {
    const distance = Math.hypot(car.x - player.inCar.x, car.y - player.inCar.y);
    const closing = Math.hypot(car.vx - player.inCar.vx, car.vy - player.inCar.vy);
    if (distance < carRadius(car.model) + carRadius(player.inCar.model) && closing > 200) {
      damagePlayer(player, POLICE.ramDamage);
      police.ramCooldown = POLICE.ramCooldown;
      ctx.cam.addShake(6);
      if (ctx.audio) ctx.audio.crash(0.5);
    }
  }
}

/** One foot officer: run the player down, punch them, and hold on to make the bust. */
function stepOfficer(officer, police, ctx, dt) {
  const player = ctx.player;
  if (officer.state === 'down') {
    // Knocked out cold — back on their feet when the timer runs out, good as new.
    if (ctx.time > officer.downUntil) {
      officer.state = 'officer';
      officer.health = 100;
      officer.arrest = 0;
      officer.angle -= Math.PI / 2;
    }
    return;
  }
  const dx = player.x - officer.x;
  const dy = player.y - officer.y;
  const distance = Math.hypot(dx, dy) || 1;
  officer.angle = Math.atan2(dy, dx) + Math.PI / 2;
  officer.walkCycle += dt * 11;
  // Run at the player, sliding along buildings like any other ped on foot.
  const speed = distance > 260 ? POLICE.officerRunSpeed : POLICE.officerSpeed;
  const stepX = (dx / distance) * speed * dt;
  const stepY = (dy / distance) * speed * dt;
  if (!circleHitsBuilding(ctx.city, officer.x + stepX, officer.y, 12)) officer.x += stepX;
  if (!circleHitsBuilding(ctx.city, officer.x, officer.y + stepY, 12)) officer.y += stepY;
  officer.x = Math.max(CITY.seaWidth + 8, Math.min(ctx.city.width - 12, officer.x));
  officer.y = Math.max(12, Math.min(ctx.city.height - 12, officer.y));

  if (player.inCar || distance > POLICE.arrestRange) {
    // Out of reach: the grip loosens again.
    officer.arrest = Math.max(0, officer.arrest - dt * 2);
    return;
  }
  // Hands on: punch on a timer, and hold on until the arrest completes.
  officer.arrest += dt;
  officer.punchTimer -= dt;
  if (officer.punchTimer <= 0) {
    officer.punchTimer = POLICE.punchCooldown;
    damagePlayer(player, POLICE.punchDamage);
    if (ctx.audio) ctx.audio.punch();
    if (ctx.effects) ctx.effects.addSparks(player.x, player.y);
  }
  if (officer.arrest >= POLICE.arrestSeconds && ctx.onBusted) ctx.onBusted();
}

/** Two cars parked across the road ahead of the player, lights flashing. */
function placeRoadblock(police, ctx) {
  const player = ctx.player;
  // Which road is the player on — the nearest vertical or horizontal one?
  let vRoad = null;
  let vDist = Infinity;
  for (const road of ctx.city.vRoads) {
    const d = Math.abs(player.x - road.x);
    if (d < vDist) {
      vDist = d;
      vRoad = road;
    }
  }
  let hRoad = null;
  let hDist = Infinity;
  for (const road of ctx.city.hRoads) {
    const d = Math.abs(player.y - road.y);
    if (d < hDist) {
      hDist = d;
      hRoad = road;
    }
  }
  const vertical = vDist <= hDist && vRoad && vDist < vRoad.width / 2 + 40;
  const horizontal = !vertical && hRoad && hDist < hRoad.width / 2 + 40;
  if (!vertical && !horizontal) return false;
  const car = player.inCar;
  const forward = car ? forwardOf(car.angle) : { x: 0, y: 1 };
  const ahead = 430;
  const spots = [];
  if (vertical) {
    const y = player.y + Math.sign(forward.y || 1) * ahead;
    if (y < 80 || y > ctx.city.height - 80) return false;
    spots.push({ x: vRoad.x - 26, y, angle: Math.PI / 2 });
    spots.push({ x: vRoad.x + 26, y, angle: Math.PI / 2 });
  } else {
    const x = player.x + Math.sign(forward.x || 1) * ahead;
    if (x < CITY.seaWidth + CITY.beachWidth + 80 || x > ctx.city.width - 80) return false;
    spots.push({ x, y: hRoad.y - 26, angle: 0 });
    spots.push({ x, y: hRoad.y + 26, angle: 0 });
  }
  police.roadblockCars = [];
  for (const spot of spots) {
    const blockCar = makeVehicle('police', POLICE_COLOUR, spot.x, spot.y, spot.angle, 'police');
    blockCar.role = 'block';
    blockCar.stuckTimer = 0;
    blockCar.reverseUntil = 0;
    blockCar.blockUntil = ctx.time + 25;
    blockCar.boxSide = 1;
    ctx.vehicles.push(blockCar);
    police.cars.push(blockCar);
    police.roadblockCars.push(blockCar);
  }
  return true;
}

/** The player's car hitting a ped is a crime: a bump knocks them down, a fast
 * hit kills. Downed peds get up and walk away; the heat stays. */
function checkPedStrikes(police, ctx) {
  const player = ctx.player;
  const car = player.inCar;
  if (!car) return;
  const speed = Math.abs(car.speed);
  if (speed < 120) return;
  for (const ped of ctx.peds) {
    if (ped.officer || ped.state === 'driver' || ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) > 32) continue;
    const killed = speed > 300;
    ped.health = killed ? 0 : Math.max(0, ped.health - 50);
    setPedDown(ped, ctx.time, killed ? 6 : 3);
    addWanted(police, killed ? POLICE.crime.killPed : POLICE.crime.hitPed, ctx.time);
    scareNearby(ctx.peds, ped.x, ped.y, 220, ctx.time);
    if (ctx.effects) ctx.effects.addSparks(ped.x, ped.y);
    if (ctx.audio) ctx.audio.crash(0.4);
  }
}

/**
 * Advance the police one fixed step. `ctx` is { city, player, vehicles, peds,
 * effects, audio, cam, time, onBusted }. Wanted decays only while no unit can
 * see the player; the siren follows the nearest car.
 */
export function stepPolice(police, ctx, dt) {
  police.ramCooldown = Math.max(0, police.ramCooldown - dt);
  if (police.wanted <= 0) {
    police.sirenLevel = 0;
    if (ctx.audio) ctx.audio.setSiren(0);
    return;
  }

  // Spawn the pack the wanted level calls for, a unit or two at a time.
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 0.5;
    const wantCars = POLICE.carsByStars[police.wanted] || 0;
    const wantOfficers = POLICE.officersByStars[police.wanted] || 0;
    if (police.cars.length < wantCars) spawnPoliceCar(police, ctx);
    if (police.officers.length < wantOfficers) spawnOfficer(police, ctx);
  }

  // Roadblocks at high heat, while the player is driving fast.
  police.roadblockTimer -= dt;
  const blocking = police.roadblockCars.some((car) => car.role === 'block');
  if (!blocking) police.roadblockCars = [];
  if (
    police.wanted >= POLICE.roadblockStars &&
    police.roadblockTimer <= 0 &&
    !blocking &&
    ctx.player.inCar &&
    Math.abs(ctx.player.inCar.speed) > 200
  ) {
    if (placeRoadblock(police, ctx)) police.roadblockTimer = POLICE.roadblockCooldown;
    else police.roadblockTimer = 5;
  }

  for (const car of [...police.cars]) {
    // A wrecked pursuit car is out of the chase (explosions mark it 'wreck').
    if (car.state === 'wreck') {
      police.cars.splice(police.cars.indexOf(car), 1);
      continue;
    }
    // Too far behind to matter: retire it and let the spawner send a fresh one.
    if (Math.hypot(car.x - ctx.player.x, car.y - ctx.player.y) > POLICE.despawnRange) {
      const index = ctx.vehicles.indexOf(car);
      if (index >= 0) ctx.vehicles.splice(index, 1);
      police.cars.splice(police.cars.indexOf(car), 1);
      continue;
    }
    stepPoliceCar(car, police, ctx, dt);
  }
  for (const officer of [...police.officers]) {
    if (Math.hypot(officer.x - ctx.player.x, officer.y - ctx.player.y) > POLICE.despawnRange && officer.state !== 'down') {
      const index = ctx.peds.indexOf(officer);
      if (index >= 0) ctx.peds.splice(index, 1);
      police.officers.splice(police.officers.indexOf(officer), 1);
      continue;
    }
    stepOfficer(officer, police, ctx, dt);
  }

  checkPedStrikes(police, ctx);

  // Out of sight, out of mind: a long clean stretch drops a star at a time.
  const nearest = nearestPoliceDistance(police, ctx.player.x, ctx.player.y);
  if (nearest > POLICE.hiddenRange) {
    police.cleanTime += dt;
    if (police.cleanTime >= POLICE.decaySeconds) {
      police.cleanTime = 0;
      police.wanted = Math.max(0, police.wanted - 1);
      if (police.wanted === 0) clearPolice(police, ctx.vehicles, ctx.peds);
    }
  } else {
    police.cleanTime = 0;
  }

  // The siren swells as the nearest car closes in.
  let nearestCar = Infinity;
  for (const car of police.cars) nearestCar = Math.min(nearestCar, Math.hypot(car.x - ctx.player.x, car.y - ctx.player.y));
  police.sirenLevel = nearestCar === Infinity ? 0 : clamp(1 - nearestCar / POLICE.sirenRange, 0, 1);
  if (ctx.audio) ctx.audio.setSiren(police.sirenLevel);
}
