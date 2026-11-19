// Combat: the pistol (mouse aim, click to shoot, on foot or drive-by from a car
// window), the F-key punch up close, and the bullets in between. Bullets are fast
// projectiles with tracer lines; they stop at buildings, dent cars, and knock peds
// down. Violence stays non-graphic: hits burst into sparks and puffs, and a figure
// who goes down lies flat and fades — no blood, no gore.
//
// A car whose damage reaches the wreck threshold blows up here too: fireball,
// smoke, shake, and damage to everything nearby, including the player.

import { COMBAT, POLICE } from './config.js';
import { circleHitsBuilding } from './city.js';
import { carDimensions, damageCar, forwardOf, rightOf } from './vehicles.js';
import { panicPed, scareNearby, setPedDown } from './pedestrians.js';
import { damagePlayer } from './player.js';
import { nearestPoliceDistance } from './police.js';

/** Fresh combat state: one pistol, unlimited ammo, no bullets in the air. */
export function createCombat() {
  return {
    bullets: [],
    cooldown: 0,
    meleeCooldown: 0,
    weapon: 'pistol',
    lastShotNearPolice: -10,
  };
}

/**
 * Fire one shot from `origin` along `angle`. `driveBy` widens the spread and
 * slows the follow-up shot. Returns the bullet, or null while cooling down.
 */
export function tryShoot(combat, origin, angle, options, ctx) {
  if (combat.cooldown > 0) return null;
  const driveBy = !!(options && options.driveBy);
  combat.cooldown = driveBy ? COMBAT.driveByCooldown : COMBAT.pistolCooldown;
  const spread = driveBy ? (Math.random() - 0.5) * 2 * COMBAT.driveBySpread : 0;
  const aim = angle + spread;
  const muzzle = {
    x: origin.x + Math.cos(aim) * 22,
    y: origin.y + Math.sin(aim) * 22,
  };
  const bullet = {
    x: muzzle.x,
    y: muzzle.y,
    vx: Math.cos(aim) * COMBAT.bulletSpeed,
    vy: Math.sin(aim) * COMBAT.bulletSpeed,
    life: COMBAT.bulletLife,
  };
  combat.bullets.push(bullet);
  if (ctx) {
    if (ctx.effects) ctx.effects.addMuzzle(muzzle.x, muzzle.y, aim);
    if (ctx.audio) ctx.audio.gunshot();
    // Firing a gun where the police can hear it is a crime in itself.
    const near = nearestPoliceDistance(ctx.police, origin.x, origin.y);
    if (near < 600 && ctx.time - combat.lastShotNearPolice > 2) {
      combat.lastShotNearPolice = ctx.time;
      if (ctx.addWanted) ctx.addWanted(POLICE.crime.shootNearPolice, 'shootNearPolice');
    }
  }
  return bullet;
}

/** Is the point inside this car's (rotated) body rectangle? */
function bulletHitsCar(bullet, car) {
  const { length, width } = carDimensions(car.model);
  const dx = bullet.x - car.x;
  const dy = bullet.y - car.y;
  const forward = forwardOf(car.angle);
  const right = rightOf(car.angle);
  const along = dx * forward.x + dy * forward.y;
  const side = dx * right.x + dy * right.y;
  return Math.abs(along) < length / 2 && Math.abs(side) < width / 2;
}

function hurtPed(combat, ped, amount, ctx) {
  // Only the first hit on a fresh ped counts as "hitting a ped" — emptying a
  // magazine into one person is one assault, not one per bullet. The kill is
  // always its own, heavier crime.
  const wasUnhurt = ped.health >= 100;
  ped.health -= amount;
  if (ped.health <= 0) {
    setPedDown(ped, ctx.time, ped.officer ? 4 : 6);
    if (ctx.addWanted) ctx.addWanted(ped.officer ? POLICE.crime.downOfficer : POLICE.crime.killPed, ped.officer ? 'downOfficer' : 'killPed');
    if (!ped.officer) scareNearby(ctx.peds, ped.x, ped.y, 260, ctx.time);
    return true;
  }
  if (ped.officer) {
    if (wasUnhurt && ctx.addWanted) ctx.addWanted(POLICE.crime.hitOfficer, 'hitOfficer');
  } else {
    panicPed(ped, ctx.player.x, ctx.player.y, ctx.time);
    if (wasUnhurt && ctx.addWanted) ctx.addWanted(POLICE.crime.hitPed, 'hitPed');
  }
  return false;
}

/** A punch (F): the nearest ped or officer in reach goes down. Returns true on a hit. */
export function tryMelee(combat, ctx) {
  if (combat.meleeCooldown > 0) return false;
  combat.meleeCooldown = COMBAT.meleeCooldown;
  const player = ctx.player;
  let best = null;
  let bestDistance = COMBAT.meleeRange;
  for (const ped of ctx.peds) {
    if (ped.state === 'driver' || ped.state === 'down') continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > bestDistance) continue;
    // A punch lands in front of the player, or on anyone right on top of them.
    const facing = { x: Math.sin(player.angle), y: -Math.cos(player.angle) };
    const inFront = distance < 30 || (dx * facing.x + dy * facing.y) / (distance || 1) > 0.2;
    if (!inFront) continue;
    best = ped;
    bestDistance = distance;
  }
  if (!best) return false;
  if (ctx.audio) ctx.audio.punch();
  if (ctx.effects) ctx.effects.addSparks(best.x, best.y);
  hurtPed(combat, best, COMBAT.meleeDamage, ctx);
  return true;
}

/**
 * Advance the bullets one fixed step. `ctx` is { city, player, vehicles, peds,
 * police, effects, audio, time, addWanted } — the addWanted callback raises the
 * heat for whatever the bullets do.
 */
export function stepCombat(combat, ctx, dt) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  combat.meleeCooldown = Math.max(0, combat.meleeCooldown - dt);
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = combat.bullets[i];
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let spent = bullet.life <= 0;
    if (!spent && circleHitsBuilding(ctx.city, bullet.x, bullet.y, 2)) {
      if (ctx.effects) ctx.effects.addSparks(bullet.x, bullet.y);
      spent = true;
    }
    if (!spent && (bullet.x < 0 || bullet.x > ctx.city.width || bullet.y < 0 || bullet.y > ctx.city.height)) {
      spent = true;
    }
    // People first: a bullet that reaches a ped stops there.
    if (!spent) {
      for (const ped of ctx.peds) {
        if (ped.state === 'driver' || ped.state === 'down') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) > 15) continue;
        if (ctx.effects) ctx.effects.addSparks(bullet.x, bullet.y);
        hurtPed(combat, ped, COMBAT.pistolDamage, ctx);
        spent = true;
        break;
      }
    }
    // Then cars — everything but the one the player is sitting in.
    if (!spent) {
      for (const car of ctx.vehicles) {
        if (car === ctx.player.inCar || car.state === 'wreck') continue;
        if (!bulletHitsCar(bullet, car)) continue;
        if (ctx.effects) ctx.effects.addSparks(bullet.x, bullet.y);
        damageCar(car, COMBAT.pistolDamage);
        car.playerDamage = (car.playerDamage || 0) + COMBAT.pistolDamage;
        if (car.state === 'police' && ctx.addWanted) ctx.addWanted(POLICE.crime.hitOfficer, 'hitOfficer');
        spent = true;
        break;
      }
    }
    if (spent) combat.bullets.splice(i, 1);
  }
}

/**
 * Blow up every car whose damage reached the wreck threshold. The explosion
 * hurts peds, the player and nearby cars (which may blow up in turn, a step
 * later), shakes the camera, and costs a star — destroying a car is a crime.
 * `ctx` is { player, vehicles, peds, police, effects, audio, cam, time, addWanted, onPlayerExitCar }.
 */
export function checkExplosions(ctx) {
  for (const car of ctx.vehicles) {
    if (car.state === 'wreck' || car.damage < COMBAT.wreckDamage) continue;
    car.state = 'wreck';
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    // A police car that blows up leaves the chase.
    if (ctx.police) {
      const index = ctx.police.cars.indexOf(car);
      if (index >= 0) ctx.police.cars.splice(index, 1);
    }
    if (ctx.effects) ctx.effects.addExplosion(car.x, car.y);
    if (ctx.audio) ctx.audio.explosion();
    if (ctx.cam) ctx.cam.addShake(16);
    // Destroying a car is a crime — but only if the PLAYER destroyed it. The
    // old code blamed the player for every explosion in the city: a chain
    // blast set off two more cars and cost +3 stars at once (run 7's M3
    // escape), and a police car ramming traffic into a wall did the same.
    // The star fires only when the player's own damage to this car is
    // substantial (one bullet is 34; a hard ram is ~7), and never for the
    // player's own car — wrecking your own ride is not a crime.
    if (
      ctx.addWanted &&
      car.state !== 'player' &&
      (car.playerDamage || 0) >= COMBAT.destroyAttribution
    ) {
      ctx.addWanted(POLICE.crime.destroyCar, 'destroyCar');
    }

    // The driver goes down with the car: out on foot, badly hurt.
    if (ctx.player.inCar === car) {
      if (ctx.onPlayerExitCar) ctx.onPlayerExitCar(car);
      damagePlayer(ctx.player, 35);
    }
    // Blast radius: peds go down, the player takes scaled damage, nearby cars
    // take a beating that may set them off next.
    let pedKilled = false;
    for (const ped of ctx.peds) {
      if (ped.state === 'driver' || ped.state === 'down') continue;
      const distance = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (distance > COMBAT.explosionRadius) continue;
      if (distance < COMBAT.explosionRadius * 0.6) {
        ped.health = 0;
        setPedDown(ped, ctx.time, ped.officer ? 4 : 6);
        if (!ped.officer) pedKilled = true;
      } else {
        panicPed(ped, car.x, car.y, ctx.time);
      }
    }
    if (pedKilled && ctx.addWanted) ctx.addWanted(POLICE.crime.killPed, 'killPed');
    const playerDistance = Math.hypot(ctx.player.x - car.x, ctx.player.y - car.y);
    if (playerDistance < COMBAT.explosionRadius && ctx.player.inCar !== car) {
      const falloff = 1 - playerDistance / COMBAT.explosionRadius;
      damagePlayer(ctx.player, Math.round(COMBAT.explosionDamage * falloff));
    }
    for (const other of ctx.vehicles) {
      if (other === car || other.state === 'wreck') continue;
      if (Math.hypot(other.x - car.x, other.y - car.y) < COMBAT.explosionRadius) {
        damageCar(other, 45);
      }
    }
  }
}
