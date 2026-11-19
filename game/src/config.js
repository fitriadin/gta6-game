// Every tuning number, colour and key binding in one place. Solmar City is a top-down
// open world: the city is a fixed-size world in world units (pixels at zoom 1), and the
// renderer scales a 1280x720 logical view to the window, so no rule below depends on the
// screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Logical view size the renderer scales to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The whole city, in world units. The sea eats the western strip; the beach sits beside it. */
export const CITY = {
  width: 5200,
  height: 4000,
  seaWidth: 420,
  beachWidth: 150,
  roadGap: 520,
  roadWidth: 96,
  avenueWidth: 132,
  blockInset: 26,
};

/** Seed used when no ?seed= is given, so plain loads and screenshots agree. */
export const DEFAULT_SEED = 1;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  maxHealth: 100,
  /** Seconds of sprint before the runner is briefly winded. */
  sprintStamina: 6,
  staminaRecover: 2.2,
};

/** Parked cars the player can walk up to (chunk 2 makes them drivable). */
export const PARKED_CAR = { width: 34, height: 62, promptRange: 64 };

/** How world-units-per-second translate to the km/h on the speedometer. */
export const SPEED_KMH = 0.22;

/** Per-model driving feel. `turn` is radians per second at full lock and full speed. */
export const VEHICLES = {
  sedan: { maxSpeed: 640, accel: 430, brake: 950, reverseMax: 150, turn: 2.7, grip: 9, length: 66, width: 36 },
  taxi: { maxSpeed: 660, accel: 460, brake: 950, reverseMax: 150, turn: 2.8, grip: 9, length: 66, width: 36 },
  van: { maxSpeed: 520, accel: 340, brake: 850, reverseMax: 130, turn: 2.2, grip: 7.5, length: 74, width: 40 },
  truck: { maxSpeed: 460, accel: 280, brake: 750, reverseMax: 110, turn: 1.9, grip: 6.5, length: 92, width: 44 },
  // The pursuit car is the fastest thing in the city, but only just: a sedan
  // (640) or taxi (660) gains on it slowly down a straight, and the pursuit
  // sheds more speed in corners (see police.js). At 720/500 the pack was
  // strictly better than any stealable car in every stat — seven escape probes
  // never opened a gap beyond the spawn distance, so the heat could never be
  // lost and the "lose the heat" missions were uncompletable.
  police: { maxSpeed: 680, accel: 460, brake: 1000, reverseMax: 160, turn: 2.9, grip: 9.5, length: 66, width: 36 },
};

/** Traffic: how many cars share the roads, how fast they cruise, where they recycle. */
export const TRAFFIC = {
  count: 14,
  cruiseMin: 210,
  cruiseMax: 320,
  laneOffset: 24,
  /** A car this far ahead (world units) makes traffic brake. */
  stopGap: 110,
  /** Recycle distance from the camera, in world units. */
  spawnMin: 900,
  spawnMax: 1450,
  despawn: 1750,
  turnChance: 0.3,
  /** Seconds between intersection turn decisions for one car. */
  turnCooldown: 2.5,
};

/** Pedestrians: crowd size, walking pace, and what scares them. */
export const PEDS = {
  count: 36,
  walkMin: 55,
  walkMax: 95,
  fleeSpeed: 250,
  /** A fast car inside this radius makes nearby peds panic and run. */
  panicRadius: 200,
  panicSpeed: 260,
  /** A stolen car scares peds this far away. */
  stealRadius: 260,
  spawnMin: 500,
  spawnMax: 1200,
  despawn: 1500,
  /** Fraction of peds that stand and chat in pairs instead of walking. */
  chatFraction: 0.2,
};

/** Police: how many units hunt the player per wanted level, and how the heat fades. */
export const POLICE = {
  maxStars: 5,
  /** Pursuit cars wanted at each star level (index = stars). */
  carsByStars: [0, 1, 1, 2, 3, 4],
  /** Foot officers wanted at each star level. */
  officersByStars: [0, 1, 2, 2, 3, 3],
  /** Stars at which roadblocks start appearing ahead of the player. */
  roadblockStars: 3,
  roadblockCooldown: 28,
  /** Clean seconds out of sight before one star drops off. */
  decaySeconds: 18,
  /** No police unit this close counts as "out of sight" for the decay timer. */
  hiddenRange: 650,
  /** A pursuit car farther than this from the player gives up the chase and
   * leaves: without a give-up range the pack can never be shaken, and the heat
   * could never decay at all. Matches hiddenRange, so a car that gives up is
   * also out of decay range and the heat starts dropping right away. */
  giveUpRange: 650,
  spawnCarMin: 550,
  spawnCarMax: 950,
  spawnOfficerMin: 300,
  spawnOfficerMax: 520,
  despawnRange: 1700,
  officerSpeed: 265,
  officerRunSpeed: 320,
  arrestRange: 26,
  /** Seconds an officer must hold onto the player (on foot) to make the bust. */
  arrestSeconds: 1.4,
  punchDamage: 6,
  punchCooldown: 0.9,
  /** Damage to the player when a police car slams into their car. */
  ramDamage: 5,
  ramCooldown: 1,
  /** Where a busted player wakes up: the station steps on the Downtown avenue. */
  station: { x: 2650, y: 780 },
  sirenRange: 900,
  /** Wanted stars each crime is worth. */
  crime: { steal: 1, hitPed: 1, killPed: 2, shootNearPolice: 1, destroyCar: 1, hitOfficer: 1, downOfficer: 2 },
};

/** Combat: the pistol, the punch, bullets and what an explosion does. */
export const COMBAT = {
  pistolDamage: 34,
  pistolCooldown: 0.26,
  driveByCooldown: 0.34,
  /** Drive-by spread in radians each way — shooting from a moving car is wild. */
  driveBySpread: 0.09,
  bulletSpeed: 1400,
  bulletLife: 0.9,
  meleeDamage: 34,
  meleeRange: 46,
  meleeCooldown: 0.45,
  explosionRadius: 130,
  explosionDamage: 70,
  /** Car damage at which the car catches fire and blows up. */
  wreckDamage: 100,
};

/** Missions: the story campaign's tuning — rewards, timers, and every marker
 * point (start markers, delivery points, and where the mission vehicles wait).
 * All points sit on roads, so a marker is always reachable by car. */
export const MISSIONS = {
  /** How close the player must get to a marker to trigger or complete it. */
  markerRadius: 110,
  /** The timed delivery's limit, in seconds. */
  m5TimeLimit: 90,
  /** Money each mission pays, by mission id. */
  rewards: { m1: 250, m2: 400, m3: 500, m4: 800, m5: 900, m6: 1500 },
  /** Where the rival cars start the warehouse fight (roads around the warehouse). */
  // Rival spawns sit ~1040 out (two blocks) on the roads into the M4 start:
  // at 520 they converged on the player in under a second and rammed the car
  // to a wreck before a shot could land (playtest run 5: 2 rivals wrecked,
  // then wasted after 2s). Two blocks gives the player time to get rolling
  // and pick them off as they arrive.
  rivalSpawns: [
    { x: 2218, y: 1820, angle: Math.PI },
    { x: 1178, y: 2860, angle: Math.PI / 2 },
    { x: 3258, y: 2860, angle: -Math.PI / 2 },
  ],
  points: {
    // M1: Vera's pickup on the Downtown avenue, delivery down to the Marina.
    m1Start: { x: 2650, y: 1850 },
    m1Target: { x: 2650, y: 3300 },
    // M2: the taxi waits at the Marina rank; Vera's garage is on the west side.
    m2Start: { x: 2650, y: 3300 },
    m2Taxi: { x: 1154, y: 3230 },
    m2Garage: { x: 1178, y: 3380 },
    // M3: starts at the garage, where the last job ends.
    m3Start: { x: 1178, y: 3380 },
    // M4: Vera's warehouse, between Downtown and the Marina.
    m4Start: { x: 2218, y: 2860 },
    // M5: a crate from the Beachfront to the far side of Palm Heights.
    m5Start: { x: 658, y: 260 },
    m5Target: { x: 4818, y: 3380 },
    // M6: the Night Tide truck waits at the Palm Heights depot; the Beachfront
    // drop-off is where the story ends.
    m6Start: { x: 4818, y: 3380 },
    m6Truck: { x: 4794, y: 3230 },
    m6Target: { x: 658, y: 3650 },
  },
};

/** Synthesized audio: engine pitch follows speed between these frequencies. */
export const AUDIO = {
  engineBaseHz: 55,
  engineTopHz: 210,
  engineGain: 0.055,
  ambientGain: 0.03,
  masterGain: 0.9,
};

/** Skid marks and dust: how long they linger, how many the world keeps. Explosions
 * throw a lot of particles at once, so the puff cap is generous. */
export const EFFECTS = {
  skidLife: 22,
  maxSkids: 400,
  maxPuffs: 240,
  puffLife: 0.9,
  smokeLife: 1.6,
  fireLife: 0.55,
  sparkLife: 0.35,
  flashLife: 0.07,
};

export const CAMERA = {
  zoom: 1,
  followSharpness: 5,
  /** How fast the title screen drifts over the city, world units per second. */
  titlePanSpeed: 46,
  shakeDecay: 6,
};

export const MINIMAP = {
  radius: 92,
  /** World units shown across the minimap's diameter. */
  range: 2200,
};

export const PALETTE = {
  backdrop: '#0d1420',
  seaDeep: '#0e5f8a',
  seaShallow: '#2b9bc4',
  beach: '#e8d5a3',
  grass: '#7fae62',
  grassDark: '#6d9c54',
  parkPath: '#d9c793',
  sidewalk: '#c9c2b2',
  road: '#3d4148',
  roadEdge: '#2e3238',
  roadMark: '#e8e2c8',
  curb: '#a9a294',
  buildingShadow: 'rgba(20, 26, 38, 0.35)',
  roofA: '#c96f4a',
  roofB: '#4a7d9c',
  roofC: '#8a94a6',
  roofD: '#b8a05e',
  roofE: '#6f8f6a',
  roofF: '#9c5f7a',
  wallA: '#e8ddc8',
  wallB: '#d5dde4',
  wallC: '#cbb9a0',
  parkTree: '#3f7d3a',
  palmTrunk: '#7a5a3a',
  palmLeaf: '#2f8f4e',
  lamp: '#f2e6b8',
  hudBg: 'rgba(10, 16, 28, 0.72)',
  hudBorder: 'rgba(255, 255, 255, 0.16)',
  text: '#f4f1e6',
  muted: '#b8c0cc',
  accent: '#f5b942',
  accentHot: '#ff7a3d',
  health: '#57c785',
  healthLow: '#e5534b',
  money: '#7ddb8a',
  star: '#f5c542',
  starEmpty: 'rgba(255, 255, 255, 0.25)',
  panel: 'rgba(13, 20, 32, 0.88)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** District names, by region of the city. */
export const DISTRICTS = [
  { name: 'Beachfront', x: 0, y: 0, width: 1150, height: 4000 },
  { name: 'Marina', x: 1150, y: 2600, width: 1700, height: 1400 },
  { name: 'Downtown', x: 1800, y: 1100, width: 1700, height: 1500 },
  { name: 'Old Town', x: 1150, y: 0, width: 2350, height: 1100 },
  { name: 'Palm Heights', x: 3500, y: 0, width: 1700, height: 4000 },
];

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-city.save.v1';

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  interact: ['KeyE'],
  melee: ['KeyF'],
  sprint: ['Space', 'ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
};
