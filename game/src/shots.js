// The screenshot scenes behind ?shot=start|play|drive|chase (chunk 4 adds mission).
// Each one stages the real game at a fixed, scenic state from the given seed, so the
// same seed always gives the same frame. The main loop paints the staged scene twice
// and then sets window.__shotReady for the screenshot.

import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stepPlayer } from './player.js';
import { addTrafficCar, makeVehicle, stealVehicle } from './vehicles.js';

/**
 * Set `state` to the named scene and return the screen to draw. Unknown names stage
 * the title, so a typo still yields a usable frame.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    // On foot in Downtown, next to a parked car so the "press E" prompt shows,
    // with the HUD and minimap live.
    state.player.x = 2612;
    state.player.y = 2150;
    state.player.angle = Math.PI;
    state.player.health = 100;
    state.money = 0;
    state.wanted = 0;
    state.objective = 'Explore Solmar Bay';
    state.cam.snap(state.player.x, state.player.y);
    // A few still steps so the near-car prompt is populated.
    for (let i = 0; i < 5; i += 1) stepPlayer(state.player, state.city, { x: 0, y: 0 }, false, 1 / 60, state.vehicles);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'drive') {
    // Driving a stolen sedan south down the Downtown avenue, mid-traffic: cars
    // ahead and oncoming, pedestrians on both sidewalks, the speedometer live.
    state.money = 250;
    state.wanted = 0;
    state.objective = 'Cruise the Downtown avenue';
    const car = makeVehicle('sedan', '#c94f43', 2626, 1500, Math.PI, 'parked');
    state.vehicles.push(car);
    stealVehicle(state.player, car);
    car.speed = 420;
    car.vx = 0;
    car.vy = 420;
    // Traffic ahead in the same lane, oncoming in the northbound lane, and a
    // car crossing on the east-west road — all inside the 1280x720 frame.
    addTrafficCar(state.vehicles, { model: 'taxi', colour: '#f5c542', x: 2626, y: 1230, angle: Math.PI, axis: 'v', roadPos: 2650, dir: 1, cruise: 280, speed: 280 });
    addTrafficCar(state.vehicles, { model: 'van', colour: '#5f9e6e', x: 2674, y: 1300, angle: 0, axis: 'v', roadPos: 2650, dir: -1, cruise: 240, speed: 240 });
    addTrafficCar(state.vehicles, { model: 'sedan', colour: '#3f7fc9', x: 2674, y: 1760, angle: 0, axis: 'v', roadPos: 2650, dir: -1, cruise: 300, speed: 300 });
    addTrafficCar(state.vehicles, { model: 'sedan', colour: '#e8e4da', x: 2350, y: 1324, angle: Math.PI / 2, axis: 'h', roadPos: 1300, dir: 1, cruise: 260, speed: 260 });
    addTrafficCar(state.vehicles, { model: 'taxi', colour: '#f5c542', x: 2950, y: 1826, angle: -Math.PI / 2, axis: 'h', roadPos: 1850, dir: -1, cruise: 290, speed: 290 });
    // A few pedestrians onto the avenue sidewalks, so the street feels alive.
    const spots = [
      { x: 2568, y: 1350, angle: Math.PI },
      { x: 2568, y: 1620, angle: 0 },
      { x: 2732, y: 1420, angle: Math.PI },
      { x: 2732, y: 1780, angle: 0 },
      { x: 2568, y: 1900, angle: Math.PI },
      { x: 2732, y: 1180, angle: 0 },
    ];
    spots.forEach((spot, index) => {
      const ped = state.peds[index];
      if (!ped || ped.state === 'driver') return;
      ped.state = 'walk';
      ped.x = spot.x;
      ped.y = spot.y;
      ped.angle = spot.angle;
      ped.walkCycle = index * 1.3;
    });
    // A skid mark or two behind the car: this theft was not gentle.
    if (state.effects) {
      state.effects.addSkid(2612, 1560, 2616, 1640);
      state.effects.addSkid(2640, 1560, 2644, 1640);
    }
    state.cam.snap(state.player.x, state.player.y);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    // A police chase down the Downtown avenue: the player in a stolen sedan,
    // three police cars on their tail with lights flashing, three wanted stars
    // lit, skid marks behind, and a traffic car scattering ahead.
    state.money = 450;
    state.wanted = 3;
    state.objective = 'Lose the police';
    if (state.police) state.police.wanted = 3;
    const car = makeVehicle('sedan', '#c94f43', 2626, 1500, Math.PI, 'parked');
    state.vehicles.push(car);
    stealVehicle(state.player, car);
    car.speed = 480;
    car.vx = 0;
    car.vy = 480;
    // Three pursuit cars: two tight behind in the same lane, one pulling
    // alongside to box the player in. Odd ids flash red, even ones blue, so
    // the frozen frame shows both colours.
    const pursuit = [
      { x: 2626, y: 1690, angle: Math.PI },
      { x: 2626, y: 1820, angle: Math.PI },
      { x: 2678, y: 1580, angle: Math.PI },
    ];
    pursuit.forEach((spot) => {
      const cop = makeVehicle('police', '#f2f2f2', spot.x, spot.y, spot.angle, 'police');
      cop.role = 'chase';
      cop.stuckTimer = 0;
      cop.reverseUntil = 0;
      cop.blockUntil = 0;
      cop.boxSide = 1;
      cop.speed = 460;
      cop.vx = 0;
      cop.vy = 460;
      state.vehicles.push(cop);
      if (state.police) state.police.cars.push(cop);
    });
    // A taxi ahead, braking out of the way.
    addTrafficCar(state.vehicles, { model: 'taxi', colour: '#f5c542', x: 2626, y: 1230, angle: Math.PI, axis: 'v', roadPos: 2650, dir: 1, cruise: 280, speed: 280 });
    // Skid marks from the chase: a swerve behind the player's car.
    if (state.effects) {
      state.effects.addSkid(2608, 1520, 2618, 1620);
      state.effects.addSkid(2636, 1520, 2646, 1620);
      state.effects.addSkid(2618, 1620, 2604, 1720);
      state.effects.addSkid(2646, 1620, 2632, 1720);
    }
    state.cam.snap(state.player.x, state.player.y);
    return { screen: SCREEN_PLAY };
  }

  // start: the title over the city, framed with the beach and sea on the left and
  // downtown's towers on the right. The player stands on the beach road, clear of
  // the menu buttons.
  state.player.x = 880;
  state.player.y = 2300;
  state.player.angle = Math.PI;
  state.money = 0;
  state.wanted = 0;
  state.cam.snap(1180, 2050);
  return { screen: SCREEN_TITLE };
}
