// The player on foot: movement with building collision, facing, stamina, health,
// and the "press E" prompt when a stealable car is near. When the player is in a
// car, vehicles.js drives and this module stands aside; enter/exit live there.

import { CITY, PARKED_CAR, PLAYER } from './config.js';
import { circleHitsBuilding, nearestParkedCar } from './city.js';
import { nearestVehicle } from './vehicles.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle,
    health: PLAYER.maxHealth,
    stamina: PLAYER.sprintStamina,
    winded: false,
    moving: false,
    running: false,
    walkCycle: 0,
    nearCar: null,
    inCar: null,
  };
}

/** Move the player one fixed step. `move` is a normalised {x, y}; `sprint` is held Space.
 * `vehicles` (when given) is the live vehicle list, so the car prompt covers parked
 * and traffic cars; without it the prompt falls back to the city's parked cars. */
export function stepPlayer(player, city, move, sprint, dt, vehicles = null) {
  if (player.inCar) {
    // Driving: the car carries the player; the prompt is the exit prompt instead.
    player.nearCar = null;
    player.moving = false;
    player.running = false;
    return;
  }
  const wantsToMove = move.x !== 0 || move.y !== 0;

  // Stamina: sprint drains, rest refills; empty means winded until half full again.
  if (sprint && wantsToMove && !player.winded) {
    player.stamina -= dt;
    if (player.stamina <= 0) {
      player.stamina = 0;
      player.winded = true;
    }
  } else {
    player.stamina = Math.min(PLAYER.sprintStamina, player.stamina + PLAYER.staminaRecover * dt);
    if (player.winded && player.stamina > PLAYER.sprintStamina / 2) player.winded = false;
  }

  const running = sprint && wantsToMove && !player.winded;
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.moving = wantsToMove;
  player.running = running;

  if (wantsToMove) {
    player.angle = Math.atan2(move.y, move.x) + Math.PI / 2;
    player.walkCycle += dt * (running ? 13 : 8);
    // Move axis by axis so sliding along a wall feels natural.
    const nextX = player.x + move.x * speed * dt;
    if (!circleHitsBuilding(city, nextX, player.y, PLAYER.radius)) player.x = nextX;
    const nextY = player.y + move.y * speed * dt;
    if (!circleHitsBuilding(city, player.x, nextY, PLAYER.radius)) player.y = nextY;
  }

  // The sea is a wall: the player can walk the beach but not swim out.
  player.x = Math.max(CITY.seaWidth + 6, Math.min(CITY.width - PLAYER.radius, player.x));
  player.y = Math.max(PLAYER.radius, Math.min(CITY.height - PLAYER.radius, player.y));

  // The car prompt: the nearest stealable car within reach — parked or in traffic.
  player.nearCar = vehicles
    ? nearestVehicle(vehicles, player.x, player.y, PARKED_CAR.promptRange)
    : nearestParkedCar(city, player.x, player.y, PARKED_CAR.promptRange);
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  return player.health <= 0;
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.maxHealth, player.health + amount);
}
