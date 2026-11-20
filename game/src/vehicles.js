// Cars: the player's stolen ride, parked cars waiting to be taken, and the
// traffic that shares the roads. One vehicle object covers all three — a parked
// car becomes the player's car when stolen and a parked car again when left.
//
// Driving is arcade physics with a drift model: velocity is split into a forward
// component (engine, brakes, drag) and a lateral component (grip kills it, the
// handbrake lets it live, which is what a slide is). Traffic is kinematic instead:
// each car follows its road's lane, brakes for the car ahead, and sometimes turns
// at an intersection. All cars collide with buildings and with each other.

import { CITY, SPEED_KMH, TRAFFIC, VEHICLES } from './config.js';
import { circleHitsBuilding, isRoad, nearestRoadPoint } from './city.js';

let nextId = 1;

/** The direction a car with this angle faces: sprites point up at angle 0. */
export function forwardOf(angle) {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/** The car's right-hand side, for lane offsets and wheel positions. */
export function rightOf(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function carDimensions(model) {
  const tune = VEHICLES[model] || VEHICLES.sedan;
  return { length: tune.length, width: tune.width };
}

/** Collision radius: a circle that covers the car's corners loosely (car-vs-car only). */
export function carRadius(model) {
  const { length, width } = carDimensions(model);
  return Math.hypot(length, width) / 2 - 4;
}

/**
 * Does the car body touch a building at (x, y) with this angle? Two small
 * circles — one at each axle — hug the car's real shape far better than one big
 * circle, so a car can brush a kerb without "hitting" the building behind it.
 */
export function carHitsBuilding(city, model, x, y, angle) {
  const { length, width } = carDimensions(model);
  const forward = forwardOf(angle);
  const radius = width / 2 + 4;
  const half = length / 2 - 8;
  return !!(
    circleHitsBuilding(city, x + forward.x * half, y + forward.y * half, radius) ||
    circleHitsBuilding(city, x - forward.x * half, y - forward.y * half, radius)
  );
}

/** How deep a circle sinks into the nearest building (0 when clear). */
function circleBuildingDepth(city, x, y, r) {
  let worst = 0;
  for (const building of city.buildings) {
    const nearestX = Math.max(building.x, Math.min(x, building.x + building.width));
    const nearestY = Math.max(building.y, Math.min(y, building.y + building.height));
    const depth = r - Math.hypot(x - nearestX, y - nearestY);
    if (depth > worst) worst = depth;
  }
  return worst;
}

/**
 * How deep the car body sinks into buildings at (x, y) with this angle — the
 * two axle circles' penetrations added up, 0 when clear. A car that turned its
 * nose into a wall (rotation is not collision-checked) can still back out when
 * the move does not sink it deeper, instead of being wedged forever.
 */
export function carOverlapDepth(city, model, x, y, angle) {
  const { length, width } = carDimensions(model);
  const forward = forwardOf(angle);
  const radius = width / 2 + 4;
  const half = length / 2 - 8;
  return (
    circleBuildingDepth(city, x + forward.x * half, y + forward.y * half, radius) +
    circleBuildingDepth(city, x - forward.x * half, y - forward.y * half, radius)
  );
}

export function makeVehicle(model, colour, x, y, angle, state = 'parked') {
  const id = nextId;
  nextId += 1;
  return {
    id,
    model,
    colour,
    x,
    y,
    angle,
    // Signed forward speed (negative = reversing) plus the full velocity vector.
    speed: 0,
    vx: 0,
    vy: 0,
    state,
    damage: 0,
    // Damage the player personally dealt to this car, from collisions and
    // bullets: the destroyCar star only fires when the player's share is
    // substantial (see checkExplosions in combat.js) — a car the police
    // wrecked, or one a chain blast set off, is not the player's crime.
    playerDamage: 0,
    driver: null,
    // Traffic AI: which road it follows, which way, and how fast it cruises.
    axis: 'v',
    roadPos: x,
    dir: 1,
    cruise: TRAFFIC.cruiseMin,
    turnCooldown: 0,
    braking: false,
    smokeTimer: 0,
    // Seconds until this car can take impact damage again: without a cooldown,
    // two cars grinding against each other take damage every step and melt.
    hitCooldown: 0,
  };
}

nextId = 1;

/** The lane centre for a road: right-hand traffic, so the offset is to the right of travel. */
function laneCentre(axis, roadPos, dir) {
  if (axis === 'v') return { axis, line: roadPos - dir * TRAFFIC.laneOffset };
  return { axis, line: roadPos + dir * TRAFFIC.laneOffset };
}

/** Pick a random road point near (focusX, focusY), between minDist and maxDist away. */
function randomRoadPoint(city, focusX, focusY, minDist, maxDist, random) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const vertical = random() < 0.5;
    if (vertical) {
      const road = city.vRoads[Math.floor(random() * city.vRoads.length)];
      const y = 100 + random() * (city.height - 200);
      const d = Math.hypot(road.x - focusX, y - focusY);
      if (d >= minDist && d <= maxDist) return { axis: 'v', roadPos: road.x, x: road.x, y, dir: random() < 0.5 ? -1 : 1 };
    } else {
      const road = city.hRoads[Math.floor(random() * city.hRoads.length)];
      const x = CITY.seaWidth + CITY.beachWidth + 100 + random() * (city.width - CITY.seaWidth - CITY.beachWidth - 200);
      const d = Math.hypot(x - focusX, road.y - focusY);
      if (d >= minDist && d <= maxDist) return { axis: 'h', roadPos: road.y, x, y: road.y, dir: random() < 0.5 ? -1 : 1 };
    }
  }
  return null;
}

const TRAFFIC_COLOURS = ['#c94f43', '#3f7fc9', '#e8e4da', '#2f2f33', '#d8a03c', '#5f9e6e', '#7a5fc9', '#c9c9c9', '#e07840'];
const TRAFFIC_MODELS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck'];

function spawnTrafficCar(city, focusX, focusY, random) {
  const point = randomRoadPoint(city, focusX, focusY, 120, TRAFFIC.spawnMax, random);
  const model = TRAFFIC_MODELS[Math.floor(random() * TRAFFIC_MODELS.length)];
  const colour = model === 'taxi' ? '#f5c542' : TRAFFIC_COLOURS[Math.floor(random() * TRAFFIC_COLOURS.length)];
  const car = makeVehicle(model, colour, point ? point.x : city.spawn.x, point ? point.y : city.spawn.y, 0, 'traffic');
  if (point) {
    car.axis = point.axis;
    car.roadPos = point.roadPos;
    car.dir = point.dir;
    car.angle = point.axis === 'v' ? (point.dir > 0 ? Math.PI : 0) : (point.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const lane = laneCentre(point.axis, point.roadPos, point.dir);
    if (point.axis === 'v') car.x = lane.line;
    else car.y = lane.line;
  }
  car.cruise = TRAFFIC.cruiseMin + random() * (TRAFFIC.cruiseMax - TRAFFIC.cruiseMin);
  car.speed = car.cruise;
  return car;
}

/**
 * Build the vehicle set: every parked car from the city becomes a parked vehicle,
 * plus a fleet of traffic cars around the spawn. The city's parked list is left
 * intact — it is the source a fresh game regenerates from — and the renderer draws
 * from this list, never from both.
 */
export function createVehicles(city, random = Math.random) {
  const vehicles = [];
  for (const parked of city.parkedCars) {
    vehicles.push(makeVehicle(parked.model, parked.colour, parked.x, parked.y, parked.angle, 'parked'));
  }
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    vehicles.push(spawnTrafficCar(city, city.spawn.x, city.spawn.y, random));
  }
  return vehicles;
}

/** Add one scripted traffic car (shots and tests place cars exactly). */
export function addTrafficCar(vehicles, options) {
  const car = makeVehicle(
    options.model || 'sedan',
    options.colour || '#3f7fc9',
    options.x,
    options.y,
    options.angle || 0,
    'traffic',
  );
  car.axis = options.axis || 'v';
  car.roadPos = options.roadPos ?? options.x;
  car.dir = options.dir || 1;
  car.cruise = options.cruise ?? TRAFFIC.cruiseMin;
  car.speed = options.speed ?? car.cruise;
  vehicles.push(car);
  return car;
}

/** The nearest stealable car (parked or in traffic) within range of a point. */
export function nearestVehicle(vehicles, x, y, range, exclude = null) {
  let best = null;
  let bestDistance = range;
  for (const car of vehicles) {
    if (car === exclude) continue;
    if (car.state !== 'parked' && car.state !== 'traffic') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best;
}

/**
 * Steal a car: it becomes the player's, the player rides inside it, and the
 * driver (if any) is handed back so the caller can set them fleeing on foot.
 */
export function stealVehicle(player, vehicle) {
  const driver = vehicle.driver;
  vehicle.driver = null;
  vehicle.state = 'player';
  vehicle.speed = 0;
  vehicle.vx = 0;
  vehicle.vy = 0;
  player.inCar = vehicle;
  player.x = vehicle.x;
  player.y = vehicle.y;
  player.angle = vehicle.angle;
  player.nearCar = null;
  player.moving = false;
  return driver;
}

/** Step out of the car onto the road beside it (driver's side first). */
export function exitVehicle(player, vehicle, city) {
  const forward = forwardOf(vehicle.angle);
  const right = rightOf(vehicle.angle);
  const { width } = carDimensions(vehicle.model);
  const spots = [
    { x: vehicle.x - right.x * (width / 2 + 18), y: vehicle.y - right.y * (width / 2 + 18) },
    { x: vehicle.x + right.x * (width / 2 + 18), y: vehicle.y + right.y * (width / 2 + 18) },
    { x: vehicle.x + forward.x * 60, y: vehicle.y + forward.y * 60 },
    { x: vehicle.x - forward.x * 60, y: vehicle.y - forward.y * 60 },
  ];
  let spot = spots[0];
  for (const candidate of spots) {
    if (!circleHitsBuilding(city, candidate.x, candidate.y, 14) && candidate.x > CITY.seaWidth + 8) {
      spot = candidate;
      break;
    }
  }
  vehicle.state = 'parked';
  vehicle.speed = 0;
  vehicle.vx = 0;
  vehicle.vy = 0;
  player.inCar = null;
  player.x = spot.x;
  player.y = spot.y;
  player.angle = vehicle.angle;
}

/** Speedometer reading, km/h. */
export function vehicleKmh(vehicle) {
  return Math.round(Math.abs(vehicle.speed) * SPEED_KMH);
}

function damageVehicle(vehicle, amount) {
  vehicle.damage = Math.min(100, vehicle.damage + amount);
}

/** Damage a car from outside the module (bullets, explosions). Chunk 3. */
export function damageCar(vehicle, amount) {
  damageVehicle(vehicle, amount);
}

/**
 * Drive the player's car one fixed step. `drive` is { throttle: -1..1, steer:
 * -1..1, handbrake: bool }. `fx` collects skid marks and smoke; `onCrash` is
 * called with the impact speed when the car hits something hard.
 */
export function stepPlayerVehicle(vehicle, city, drive, dt, fx, onCrash) {
  const tune = VEHICLES[vehicle.model] || VEHICLES.sedan;
  const forward = forwardOf(vehicle.angle);
  const right = rightOf(vehicle.angle);
  // Split velocity into forward and lateral parts.
  let vf = vehicle.vx * forward.x + vehicle.vy * forward.y;
  let vl = vehicle.vx * right.x + vehicle.vy * right.y;

  // A wrecked car barely moves: damage above 70 chokes the engine.
  const health = vehicle.damage > 70 ? 1 - (vehicle.damage - 70) / 30 : 1;
  const maxSpeed = tune.maxSpeed * (0.25 + 0.75 * health);

  if (drive.throttle > 0) vf += tune.accel * drive.throttle * dt * (0.35 + 0.65 * health);
  else if (drive.throttle < 0) {
    if (vf > 12) vf -= tune.brake * dt;
    else vf = Math.max(-tune.reverseMax, vf + tune.accel * 0.55 * drive.throttle * dt);
  }
  // Drag and rolling resistance.
  vf -= vf * 0.35 * dt;
  if (drive.handbrake) vf -= vf * 2.2 * dt;
  vf = Math.max(-tune.reverseMax, Math.min(maxSpeed, vf));

  // Steering: no turn at a standstill, full lock once rolling, reversed when reversing.
  const speedFactor = Math.min(1, Math.abs(vf) / 170);
  const steerAmount = drive.steer * tune.turn * speedFactor * (vf < 0 ? -1 : 1);
  vehicle.angle += steerAmount * dt;
  // Recompute the frame after steering.
  const fwd = forwardOf(vehicle.angle);
  const rgt = rightOf(vehicle.angle);
  // Grip kills lateral slide; the handbrake barely grips, so the car slides.
  const grip = drive.handbrake ? tune.grip * 0.22 : tune.grip;
  vl *= Math.exp(-grip * dt);
  vehicle.vx = fwd.x * vf + rgt.x * vl;
  vehicle.vy = fwd.y * vf + rgt.y * vl;
  vehicle.speed = vf;

  const radius = carDimensions(vehicle.model).width / 2 + 4;
  const prevX = vehicle.x;
  const prevY = vehicle.y;
  // Move axis by axis so the car slides along walls instead of sticking. A move
  // is allowed when it does not sink the car deeper into a building than it
  // already is — a car wedged by a turn can back out, while a clear car still
  // cannot drive into a wall at all.
  const nextX = vehicle.x + vehicle.vx * dt;
  const depthNowX = carOverlapDepth(city, vehicle.model, vehicle.x, vehicle.y, vehicle.angle);
  if (
    carOverlapDepth(city, vehicle.model, nextX, vehicle.y, vehicle.angle) <= depthNowX + 0.01 &&
    nextX > CITY.seaWidth + radius &&
    nextX < CITY.width - radius
  ) {
    vehicle.x = nextX;
  } else {
    const impact = Math.abs(vehicle.vx);
    vehicle.vx *= -0.3;
    if (impact > 140 && vehicle.hitCooldown <= 0) {
      vehicle.hitCooldown = 0.5;
      damageVehicle(vehicle, impact / 90);
      if (onCrash) onCrash(impact);
    }
  }
  const nextY = vehicle.y + vehicle.vy * dt;
  const depthNowY = carOverlapDepth(city, vehicle.model, vehicle.x, vehicle.y, vehicle.angle);
  if (
    carOverlapDepth(city, vehicle.model, vehicle.x, nextY, vehicle.angle) <= depthNowY + 0.01 &&
    nextY > radius &&
    nextY < CITY.height - radius
  ) {
    vehicle.y = nextY;
  } else {
    const impact = Math.abs(vehicle.vy);
    vehicle.vy *= -0.3;
    if (impact > 140 && vehicle.hitCooldown <= 0) {
      vehicle.hitCooldown = 0.5;
      damageVehicle(vehicle, impact / 90);
      if (onCrash) onCrash(impact);
    }
  }

  // Skid marks from the rear wheels while sliding or handbrake-turning.
  const sliding = Math.abs(vl) > 130 || (drive.handbrake && Math.abs(vf) > 220);
  if (sliding && fx) {
    const { length, width } = carDimensions(vehicle.model);
    const rearX = vehicle.x - fwd.x * (length / 2 - 6);
    const rearY = vehicle.y - fwd.y * (length / 2 - 6);
    const prevRearX = prevX - fwd.x * (length / 2 - 6);
    const prevRearY = prevY - fwd.y * (length / 2 - 6);
    for (const side of [-1, 1]) {
      const ox = rgt.x * (width / 2 - 4) * side;
      const oy = rgt.y * (width / 2 - 4) * side;
      fx.addSkid(prevRearX + ox, prevRearY + oy, rearX + ox, rearY + oy);
    }
    if (Math.random() < 0.5) fx.addPuff(rearX, rearY, 'smoke');
  }
  // A battered car smokes from under the bonnet.
  if (vehicle.damage > 55 && fx) {
    vehicle.smokeTimer -= dt;
    if (vehicle.smokeTimer <= 0) {
      vehicle.smokeTimer = 0.12;
      fx.addPuff(vehicle.x + fwd.x * 20, vehicle.y + fwd.y * 20, 'smoke');
    }
  }
}

function angleTowards(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > maxStep) diff = maxStep;
  else if (diff < -maxStep) diff = -maxStep;
  return current + diff;
}

/** Is another vehicle (or the player on foot) in the way ahead of this car?
 * Only things roughly in the same lane count — an oncoming car in the other
 * lane must not make traffic brake. */
function blockedAhead(car, vehicles, player, city) {
  const forward = forwardOf(car.angle);
  const right = rightOf(car.angle);
  for (const other of vehicles) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const distance = Math.hypot(dx, dy);
    if (distance > TRAFFIC.stopGap || distance < 1) continue;
    const ahead = (dx * forward.x + dy * forward.y) / distance;
    const lateral = Math.abs(dx * right.x + dy * right.y);
    if (ahead > 0.72 && lateral < 30) return true;
  }
  if (player && !player.inCar) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 90 && distance > 1) {
      const ahead = (dx * forward.x + dy * forward.y) / distance;
      const lateral = Math.abs(dx * right.x + dy * right.y);
      if (ahead > 0.8 && lateral < 30) return true;
    }
  }
  return false;
}

/** The nearest crossing road's centre-line, if this car is sitting on an intersection. */
function crossingAt(car, city) {
  if (car.axis === 'v') {
    for (const road of city.hRoads) {
      if (Math.abs(car.y - road.y) < 14) return road.y;
    }
  } else {
    for (const road of city.vRoads) {
      if (Math.abs(car.x - road.x) < 14) return road.x;
    }
  }
  return null;
}

function stepTrafficCar(car, city, vehicles, player, dt) {
  car.turnCooldown -= dt;
  const lane = laneCentre(car.axis, car.roadPos, car.dir);
  // Aim at a point ahead on the lane: this steers the car onto its lane and
  // keeps it there through turns.
  let targetX;
  let targetY;
  if (car.axis === 'v') {
    targetX = lane.line;
    targetY = car.y + car.dir * 150;
  } else {
    targetX = car.x + car.dir * 150;
    targetY = lane.line;
  }
  // Recovery: a car that drifted off the road (or is about to clip a building
  // on a wide turn) aims at the nearest road point instead of its lane.
  const forward = forwardOf(car.angle);
  const lookX = car.x + forward.x * 70;
  const lookY = car.y + forward.y * 70;
  const offRoad = !isRoad(city, car.x, car.y);
  const aheadBlocked = !!circleHitsBuilding(city, lookX, lookY, 10);
  if (offRoad || aheadBlocked) {
    const roadPoint = nearestRoadPoint(city, car.x, car.y);
    targetX = roadPoint.x;
    targetY = roadPoint.y;
  }
  const desiredAngle = Math.atan2(targetX - car.x, -(targetY - car.y));
  let angleDiff = desiredAngle - car.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  car.angle = angleTowards(car.angle, desiredAngle, 3.1 * dt);

  const blocked = blockedAhead(car, vehicles, player, city);
  car.braking = blocked;
  // Slow right down for a sharp turn — a car that takes a corner at cruise speed
  // swings wide off the road. Recovery driving is slow too.
  let cruise = car.cruise;
  if (Math.abs(angleDiff) > 0.45) cruise = Math.min(cruise, 130);
  if (offRoad || aheadBlocked) cruise = Math.min(cruise, 150);
  const targetSpeed = blocked ? 0 : cruise;
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 300 * dt);
  else if (car.speed > targetSpeed) car.speed = Math.max(targetSpeed, car.speed - 700 * dt);

  // Maybe turn at an intersection; at the road's end, turn around.
  const crossing = crossingAt(car, city);
  if (crossing !== null && car.turnCooldown <= 0) {
    car.turnCooldown = TRAFFIC.turnCooldown;
    if (Math.random() < TRAFFIC.turnChance) {
      if (car.axis === 'v') {
        car.axis = 'h';
        car.roadPos = crossing;
        car.dir = Math.random() < 0.5 ? -1 : 1;
      } else {
        car.axis = 'v';
        car.roadPos = crossing;
        car.dir = Math.random() < 0.5 ? -1 : 1;
      }
    }
  }
  if (car.axis === 'v') {
    if (car.y < 70 && car.dir < 0) car.dir = 1;
    else if (car.y > city.height - 70 && car.dir > 0) car.dir = -1;
  } else {
    if (car.x < CITY.seaWidth + CITY.beachWidth + 70 && car.dir < 0) car.dir = 1;
    else if (car.x > city.width - 70 && car.dir > 0) car.dir = -1;
  }

  const heading = forwardOf(car.angle);
  car.vx = heading.x * car.speed;
  car.vy = heading.y * car.speed;
  const prevX = car.x;
  const prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // A traffic car must never end up inside a building: step back and stop.
  if (carHitsBuilding(city, car.model, car.x, car.y, car.angle)) {
    car.x = prevX;
    car.y = prevY;
    car.speed = 0;
  }
  car.x = Math.max(CITY.seaWidth + 24, Math.min(city.width - 24, car.x));
  car.y = Math.max(24, Math.min(city.height - 24, car.y));
}

/** Keep a car inside the city: a shove past the edge would wedge it where the
 * movement code cannot bring it back from (a ram once left the player's car at
 * y = -8, able to move only sideways). */
function clampCarToCity(car) {
  const radius = carDimensions(car.model).width / 2 + 4;
  car.x = Math.max(CITY.seaWidth + radius, Math.min(CITY.width - radius, car.x));
  car.y = Math.max(radius, Math.min(CITY.height - radius, car.y));
}

/** Push overlapping cars apart and trade a little speed; returns true if the player was hit. */
function collideCars(vehicles, city, onPlayerCrash, dt = 1 / 60) {
  let playerHit = false;
  for (const car of vehicles) {
    if (car.hitCooldown > 0) car.hitCooldown = Math.max(0, car.hitCooldown - dt);
  }
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i];
    const ra = carRadius(a.model);
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j];
      if (a.state === 'parked' && b.state === 'parked') continue;
      const rb = carRadius(b.model);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = ra + rb - 8;
      if (distance >= minDistance || distance < 0.01) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = (minDistance - distance) / 2;
      const aMoves = a.state !== 'parked';
      const bMoves = b.state !== 'parked';
      const prevAX = a.x;
      const prevAY = a.y;
      const prevBX = b.x;
      const prevBY = b.y;
      if (aMoves) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      }
      if (bMoves) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      }
      // A shove must never push a car into a building: step back out of it.
      if (aMoves && carHitsBuilding(city, a.model, a.x, a.y, a.angle)) {
        a.x = prevAX;
        a.y = prevAY;
      }
      if (bMoves && carHitsBuilding(city, b.model, b.x, b.y, b.angle)) {
        b.x = prevBX;
        b.y = prevBY;
      }
      // ... and never out of the city (see clampCarToCity).
      if (aMoves) clampCarToCity(a);
      if (bMoves) clampCarToCity(b);
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing > 60) {
        // A light brush (closing under 140) shoves the cars but does not dent
        // them — only a real hit does damage, matching the building threshold
        // (140). Weaving through traffic at speed used to grind the car down
        // on side-swipes alone (probe 25: wrecked at 103s with the escape
        // already working, the gap past 650). One impact per car per
        // half-second: two cars leaning on each other must not take damage
        // every step until they explode.
        if (closing > 140) {
          const hit = closing / 90;
          if (a.hitCooldown <= 0) {
            a.hitCooldown = 0.5;
            damageVehicle(a, hit);
            // If the other car is the player's, this damage is the player's
            // doing — it counts toward the destroyCar attribution.
            if (b.state === 'player') a.playerDamage = (a.playerDamage || 0) + hit;
          }
          if (b.hitCooldown <= 0) {
            b.hitCooldown = 0.5;
            damageVehicle(b, hit);
            if (a.state === 'player') b.playerDamage = (b.playerDamage || 0) + hit;
          }
        }
        if (a.state === 'player' || b.state === 'player') {
          playerHit = true;
          if (onPlayerCrash) onPlayerCrash(closing);
        }
        // Trade a little speed along the impact normal.
        const push = closing * 0.35;
        if (aMoves) {
          a.vx -= nx * push;
          a.vy -= ny * push;
          if (a.state === 'player') a.speed *= 0.6;
        }
        if (bMoves) {
          b.vx += nx * push;
          b.vy += ny * push;
          if (b.state === 'player') b.speed *= 0.6;
        }
      }
    }
  }
  return playerHit;
}

/**
 * Advance all traffic one fixed step, recycle cars that wandered too far from
 * the camera, and resolve car-to-car collisions. `focus` is {x, y} to recycle
 * around (the camera); `player` lets traffic brake for the player on foot.
 */
export function stepTraffic(vehicles, city, dt, focus, player, onPlayerCrash) {
  for (const car of vehicles) {
    if (car.state !== 'traffic') continue;
    stepTrafficCar(car, city, vehicles, player, dt);
    const distance = Math.hypot(car.x - focus.x, car.y - focus.y);
    if (distance > TRAFFIC.despawn) {
      const fresh = spawnTrafficCar(city, focus.x, focus.y, Math.random);
      Object.assign(car, fresh, { id: car.id, driver: car.driver });
    }
    if (car.damage > 55) car.cruise = Math.min(car.cruise, TRAFFIC.cruiseMin * 0.7);
  }
  collideCars(vehicles, city, onPlayerCrash, dt);
}
