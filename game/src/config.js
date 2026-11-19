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
  sprint: ['Space', 'ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
};
