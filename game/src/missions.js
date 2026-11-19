// The story campaign: six missions for Kai Marlin, a Solmar Bay courier who runs
// jobs for Vera Solis, a fixer out of the Marina — and ends up on the wrong side
// of the Night Tide, the rival crew that wants her patch. Every name, line of
// dialogue and twist here is original; nothing comes from any other game.
//
// How it works: one mission is available at a time, in order. Its start marker
// shows on the minimap and in the world; driving or walking into it opens the
// briefing, and accepting starts the job. Each mission watches the world until
// its objectives are met (complete: reward money, next mission unlocks) or it
// fails (wasted, busted, or out of time: retry from the briefing, nothing lost).
// The missions module owns the rules; main.js owns the screens, money and sound,
// and talks to this module through the ctx callbacks (setObjective, setTarget,
// onBriefing, onComplete, onFail, toast, addWanted, forgiveWanted).

import { MISSIONS } from './config.js';
import { circleHitsBuilding, isRoad, nearestRoadPoint } from './city.js';
import { forwardOf, makeVehicle, stepPlayerVehicle } from './vehicles.js';

/** The six jobs, in story order. `start` is the marker that opens the briefing. */
export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'First Delivery',
    reward: MISSIONS.rewards.m1,
    start: MISSIONS.points.m1Start,
    briefing:
      'Vera Solis runs jobs out of the Marina, and she needs a courier she can trust. ' +
      'This one is simple: take the package down the avenue to the Marina drop-off. ' +
      'No questions, no detours — and try not to scratch the paint.',
    objective: 'Deliver the package to the Marina',
  },
  {
    id: 'm2',
    title: 'Borrowed Wheels',
    reward: MISSIONS.rewards.m2,
    start: MISSIONS.points.m2Start,
    briefing:
      'Vera needs a cab for a job, and the rank by the Marina has one waiting. ' +
      'Take it — quietly, if you can — and bring it to her garage on the west side. ' +
      'She pays for discretion, not dents.',
    objective: 'Steal the taxi at the Marina rank',
  },
  {
    id: 'm3',
    title: 'Hot Pursuit',
    reward: MISSIONS.rewards.m3,
    start: MISSIONS.points.m3Start,
    briefing:
      'The job went loud. Somebody talked, and now every patrol in Solmar Bay is ' +
      'looking for your car. Lose them — stay out of sight until the heat dies down, ' +
      'then come and find me.',
    objective: 'Lose the police',
  },
  {
    id: 'm4',
    title: 'Night Tide',
    reward: MISSIONS.rewards.m4,
    start: MISSIONS.points.m4Start,
    briefing:
      "The Night Tide crew thinks Vera's warehouse is theirs now. Three of their " +
      'drivers are on the way to prove it. Stop their cars — ram them or shoot them ' +
      'out — before they reach the doors.',
    objective: 'Wreck the Night Tide cars (0/3)',
  },
  {
    id: 'm5',
    title: 'The Long Way Home',
    reward: MISSIONS.rewards.m5,
    start: MISSIONS.points.m5Start,
    briefing:
      'A client in Palm Heights needs a crate tonight, and the police are watching ' +
      'the bridges. Take the long way home, drive fast, and get it there before the ' +
      'clock runs out. Ninety seconds. Go.',
    objective: 'Deliver the crate to Palm Heights',
  },
  {
    id: 'm6',
    title: 'King of the Bay',
    reward: MISSIONS.rewards.m6,
    start: MISSIONS.points.m6Start,
    briefing:
      'This is the big one, Kai. The Night Tide left their truck at the Palm Heights ' +
      'depot — take it, lose the three stars that come with it, and bring it to the ' +
      'Beachfront. Do this, and Solmar Bay is yours.',
    objective: 'Steal the Night Tide truck',
  },
];

/** The story's closing lines, shown on the ending screen after mission 6. */
export const ENDING_TEXT = {
  title: 'King of the Bay',
  lines: [
    'The truck is delivered, the Night Tide are finished, and Vera is already lining up the next job.',
    'Solmar Bay is yours — for now.',
  ],
  sub: 'Free roam continues. The city is still out there — drive it.',
};

export function missionById(id) {
  return MISSION_DEFS.find((def) => def.id === id) || null;
}

export function missionIndex(id) {
  return MISSION_DEFS.findIndex((def) => def.id === id);
}

/** The next mission the player has not finished yet, or null when the story is done. */
export function nextMissionId(completed) {
  const done = completed || [];
  for (const def of MISSION_DEFS) {
    if (!done.includes(def.id)) return def.id;
  }
  return null;
}

export function isStoryComplete(completed) {
  return (completed || []).length >= MISSION_DEFS.length;
}

/** Fresh mission runtime: no job running, no marker underfoot. */
export function createMissions() {
  return { active: null, markerInside: false };
}

function distanceTo(player, point) {
  return Math.hypot(player.x - point.x, player.y - point.y);
}

/** Set the wanted level to exactly `stars` (up or down) through the normal crime path. */
function setWantedTo(ctx, stars) {
  const delta = stars - ctx.police.wanted;
  if (delta !== 0) ctx.addWanted(delta);
}

/** A parked car of `model` near a point, or null — so a retried mission reuses
 * the vehicle it already put there instead of stacking up a second one. */
function parkedNear(vehicles, model, point, radius) {
  for (const car of vehicles) {
    if (car.model === model && car.state === 'parked' && Math.hypot(car.x - point.x, car.y - point.y) < radius) {
      return car;
    }
  }
  return null;
}

/** Put a mission vehicle where the job needs it (a taxi at the rank, a truck at
 * the depot), unless one is already waiting there. */
function ensureMissionVehicle(ctx, model, colour, point, angle) {
  if (parkedNear(ctx.vehicles, model, point, 80)) return;
  const car = makeVehicle(model, colour, point.x, point.y, angle, 'parked');
  ctx.vehicles.push(car);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Begin a mission: set up its stage, vehicles and heat. Called when the player
 * accepts the briefing (from the marker or the pause menu's Missions list). */
export function startMission(missions, id, ctx) {
  const def = missionById(id);
  if (!def) return false;
  const active = { id, stage: 0, timeLeft: 0, rivals: [], wrecked: 0 };
  missions.active = active;
  missions.markerInside = false;
  if (id === 'm1') {
    ctx.setObjective(def.objective);
    ctx.setTarget(MISSIONS.points.m1Target.x, MISSIONS.points.m1Target.y);
  } else if (id === 'm2') {
    ensureMissionVehicle(ctx, 'taxi', '#f5c542', MISSIONS.points.m2Taxi, Math.PI);
    ctx.setObjective(def.objective);
    ctx.setTarget(MISSIONS.points.m2Taxi.x, MISSIONS.points.m2Taxi.y);
  } else if (id === 'm3') {
    // The job went loud: the heat starts at two stars, whatever it was before.
    setWantedTo(ctx, 2);
    ctx.setObjective(def.objective);
    ctx.setTarget(null);
  } else if (id === 'm4') {
    // Three rival drivers roll in from the roads around the warehouse.
    const colours = ['#2f2f33', '#5f1f2e', '#1f2a5f'];
    const models = ['sedan', 'van', 'sedan'];
    active.rivals = MISSIONS.rivalSpawns.map((spot, index) => {
      const rival = makeVehicle(models[index], colours[index], spot.x, spot.y, spot.angle, 'rival');
      rival.stuckTimer = 0;
      rival.reverseUntil = 0;
      ctx.vehicles.push(rival);
      return rival;
    });
    ctx.setObjective(def.objective);
    ctx.setTarget(MISSIONS.points.m4Start.x, MISSIONS.points.m4Start.y);
  } else if (id === 'm5') {
    if (ctx.police.wanted < 1) ctx.addWanted(1);
    active.timeLeft = MISSIONS.m5TimeLimit;
    ctx.setObjective(`${def.objective} — ${formatTime(active.timeLeft)}`);
    ctx.setTarget(MISSIONS.points.m5Target.x, MISSIONS.points.m5Target.y);
  } else if (id === 'm6') {
    ensureMissionVehicle(ctx, 'truck', '#3a5a3a', MISSIONS.points.m6Truck, Math.PI);
    ctx.setObjective(def.objective);
    ctx.setTarget(MISSIONS.points.m6Truck.x, MISSIONS.points.m6Truck.y);
  }
  return true;
}

/** Take the rival cars off the street (a failed or finished job leaves no loose ends). */
function clearRivals(ctx, rivals) {
  for (const rival of rivals || []) {
    if (rival.state === 'wreck') continue;
    const index = ctx.vehicles.indexOf(rival);
    if (index >= 0) ctx.vehicles.splice(index, 1);
  }
}

function completeMission(missions, ctx, def) {
  clearRivals(ctx, missions.active ? missions.active.rivals : []);
  missions.active = null;
  // The next job's marker may already be underfoot (one job ends where the next
  // begins) — let its briefing open without making the player walk out and back in.
  missions.markerInside = false;
  if (ctx.onComplete) ctx.onComplete(def);
}

function failMission(missions, ctx, def, reason) {
  clearRivals(ctx, missions.active ? missions.active.rivals : []);
  missions.active = null;
  missions.markerInside = false;
  if (ctx.onFail) ctx.onFail(def, reason);
}

/** Fail the running job from outside (wasted or busted). Returns the failed def, or null. */
export function failActiveMission(missions, ctx, reason) {
  if (!missions.active) return null;
  const def = missionById(missions.active.id);
  failMission(missions, ctx, def, reason);
  return def;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDiffTo(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** One rival driver: floor it at the player, back off the road when wedged, and
 * reverse out when stuck — the same tricks the pursuit cars use, minus the siren. */
function stepRival(rival, ctx, dt) {
  if (rival.state === 'wreck') return;
  const player = ctx.player;
  let aimX = player.x;
  let aimY = player.y;
  const forward = forwardOf(rival.angle);
  const lookX = rival.x + forward.x * 60;
  const lookY = rival.y + forward.y * 60;
  if (!isRoad(ctx.city, rival.x, rival.y) || circleHitsBuilding(ctx.city, lookX, lookY, 4)) {
    const roadPoint = nearestRoadPoint(ctx.city, rival.x, rival.y);
    aimX = roadPoint.x;
    aimY = roadPoint.y;
  }
  const desired = Math.atan2(aimX - rival.x, -(aimY - rival.y));
  const diff = angleDiffTo(rival.angle, desired);
  const speed = Math.abs(rival.speed);
  let throttle = 1;
  let steer = clamp(diff * 2.2, -1, 1);
  let handbrake = Math.abs(diff) > 0.9 && speed > 350;
  if (Math.abs(diff) > 1.2 && speed > 220) {
    throttle = 0;
    handbrake = true;
  }
  if (speed < 25 && throttle > 0 && ctx.time >= rival.reverseUntil) {
    rival.stuckTimer += dt;
    if (rival.stuckTimer > 1.4) {
      rival.reverseUntil = ctx.time + 0.7;
      rival.stuckTimer = 0;
    }
  } else {
    rival.stuckTimer = 0;
  }
  if (ctx.time < rival.reverseUntil) {
    throttle = -0.8;
    steer = -steer;
    handbrake = false;
  }
  stepPlayerVehicle(rival, ctx.city, { throttle, steer, handbrake }, dt, ctx.effects, null);
}

function stepRivals(missions, ctx, dt) {
  const active = missions.active;
  for (const rival of active.rivals) stepRival(rival, ctx, dt);
  // A rival that just blew up: count it, and keep the heat off the books — the
  // police do not come running for gang cars that settle their own beef.
  let wrecked = 0;
  for (const rival of active.rivals) {
    if (rival.state === 'wreck') wrecked += 1;
  }
  if (wrecked > active.wrecked) {
    const fresh = wrecked - active.wrecked;
    active.wrecked = wrecked;
    if (ctx.forgiveWanted) ctx.forgiveWanted(fresh);
  }
  ctx.setObjective(`Wreck the Night Tide cars (${active.wrecked}/3)`);
  // The marker follows the nearest rival still rolling.
  let nearest = null;
  let nearestDistance = Infinity;
  for (const rival of active.rivals) {
    if (rival.state === 'wreck') continue;
    const d = Math.hypot(rival.x - ctx.player.x, rival.y - ctx.player.y);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = rival;
    }
  }
  if (nearest) ctx.setTarget(nearest.x, nearest.y);
  return wrecked >= active.rivals.length;
}

/**
 * Advance the missions one fixed step. `ctx` is { city, player, vehicles, peds,
 * police, effects, audio, time, completed, addWanted, forgiveWanted, setObjective,
 * setTarget, toast, onBriefing, onComplete, onFail }. With no job running, the
 * next job's marker shows and walking into it opens the briefing.
 */
export function stepMissions(missions, ctx, dt) {
  if (!missions.active) {
    const nextId = nextMissionId(ctx.completed);
    if (!nextId) {
      ctx.setObjective('Explore Solmar Bay');
      ctx.setTarget(null);
      return;
    }
    const def = missionById(nextId);
    ctx.setObjective(`Next job: ${def.title}`);
    ctx.setTarget(def.start.x, def.start.y);
    const inside = distanceTo(ctx.player, def.start) < MISSIONS.markerRadius;
    if (inside && !missions.markerInside) {
      missions.markerInside = true;
      if (ctx.onBriefing) ctx.onBriefing(def);
    } else if (!inside) {
      missions.markerInside = false;
    }
    return;
  }

  const active = missions.active;
  const def = missionById(active.id);
  const player = ctx.player;

  if (active.id === 'm1') {
    if (distanceTo(player, MISSIONS.points.m1Target) < MISSIONS.markerRadius) {
      completeMission(missions, ctx, def);
    }
    return;
  }

  if (active.id === 'm2') {
    if (active.stage === 0) {
      if (player.inCar && player.inCar.model === 'taxi') {
        active.stage = 1;
        ctx.setObjective("Deliver the taxi to Vera's garage");
        ctx.setTarget(MISSIONS.points.m2Garage.x, MISSIONS.points.m2Garage.y);
        if (ctx.toast) ctx.toast('Got the cab. Now get it to the garage.');
      }
      return;
    }
    if (player.inCar && player.inCar.model === 'taxi' && distanceTo(player, MISSIONS.points.m2Garage) < MISSIONS.markerRadius) {
      completeMission(missions, ctx, def);
    }
    return;
  }

  if (active.id === 'm3') {
    if (ctx.police.wanted === 0) completeMission(missions, ctx, def);
    return;
  }

  if (active.id === 'm4') {
    if (stepRivals(missions, ctx, dt)) completeMission(missions, ctx, def);
    return;
  }

  if (active.id === 'm5') {
    active.timeLeft -= dt;
    if (active.timeLeft <= 0) {
      failMission(missions, ctx, def, 'Out of time — the client found another courier.');
      return;
    }
    ctx.setObjective(`${def.objective} — ${formatTime(active.timeLeft)}`);
    if (distanceTo(player, MISSIONS.points.m5Target) < MISSIONS.markerRadius) {
      completeMission(missions, ctx, def);
    }
    return;
  }

  if (active.id === 'm6') {
    if (active.stage === 0) {
      if (player.inCar && player.inCar.model === 'truck') {
        active.stage = 1;
        // The truck comes with three stars attached.
        setWantedTo(ctx, 3);
        ctx.setObjective('Lose the heat');
        ctx.setTarget(null);
        if (ctx.toast) ctx.toast('Three stars on the truck — lose them!');
      }
      return;
    }
    if (active.stage === 1) {
      if (ctx.police.wanted === 0) {
        active.stage = 2;
        ctx.setObjective('Deliver the truck to the Beachfront');
        ctx.setTarget(MISSIONS.points.m6Target.x, MISSIONS.points.m6Target.y);
        if (ctx.toast) ctx.toast('Clean. Now bring the truck home.');
      }
      return;
    }
    if (player.inCar && player.inCar.model === 'truck' && distanceTo(player, MISSIONS.points.m6Target) < MISSIONS.markerRadius) {
      completeMission(missions, ctx, def);
    }
  }
}
