// Solmar Bay, generated from a seed: a road grid with two avenues, blocks holding
// buildings, parks or parking lots, a beach and sea along the west edge, palms, lamps
// and parked cars. Deterministic: the same seed always builds the same city, which is
// what makes screenshots repeatable. Pure data — no DOM, so it runs in Node too.

import { CITY, DISTRICTS, PARKED_CAR } from './config.js';
import { createRandom } from './random.js';

const ROOFS = ['roofA', 'roofB', 'roofC', 'roofD', 'roofE', 'roofF'];
const WALLS = ['wallA', 'wallB', 'wallC'];
const CAR_COLOURS = ['#c94f43', '#3f7fc9', '#e8e4da', '#2f2f33', '#d8a03c', '#5f9e6e', '#7a5fc9', '#c9c9c9'];

/** Vertical road centre-lines: the grid plus one wide avenue through downtown. */
function verticalRoads() {
  const roads = [];
  const first = CITY.seaWidth + CITY.beachWidth + CITY.roadWidth / 2 + 40;
  for (let x = first; x < CITY.width - 120; x += CITY.roadGap) roads.push({ x, width: CITY.roadWidth, avenue: false });
  roads.push({ x: 2650, width: CITY.avenueWidth, avenue: true });
  roads.sort((a, b) => a.x - b.x);
  return roads;
}

function horizontalRoads() {
  const roads = [];
  for (let y = CITY.roadGap / 2; y < CITY.height - 120; y += CITY.roadGap) roads.push({ y, width: CITY.roadWidth, avenue: false });
  roads.push({ y: 1850, width: CITY.avenueWidth, avenue: true });
  roads.sort((a, b) => a.y - b.y);
  return roads;
}

/** The district a point sits in, by the region table in config. */
export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x && x < district.x + district.width && y >= district.y && y < district.y + district.height) {
      return district.name;
    }
  }
  return 'Solmar Bay';
}

export function generateCity(seed) {
  const random = createRandom(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const range = (min, max) => min + random() * (max - min);
  const chance = (p) => random() < p;

  const vRoads = verticalRoads();
  const hRoads = horizontalRoads();

  const buildings = [];
  const parks = [];
  const palms = [];
  const lamps = [];
  const parkedCars = [];
  const trees = [];

  // Blocks are the cells between neighbouring roads. Each block becomes buildings,
  // a park, or a parking lot, with the odds depending on its district.
  const blockEdgesX = [CITY.seaWidth + CITY.beachWidth];
  for (const road of vRoads) blockEdgesX.push(road.x - road.width / 2, road.x + road.width / 2);
  blockEdgesX.push(CITY.width);
  const blockEdgesY = [0];
  for (const road of hRoads) blockEdgesY.push(road.y - road.width / 2, road.y + road.width / 2);
  blockEdgesY.push(CITY.height);

  for (let bx = 0; bx < blockEdgesX.length - 1; bx += 2) {
    for (let by = 0; by < blockEdgesY.length - 1; by += 2) {
      const x0 = blockEdgesX[bx] + CITY.blockInset;
      const x1 = blockEdgesX[bx + 1] - CITY.blockInset;
      const y0 = blockEdgesY[by] + CITY.blockInset;
      const y1 = blockEdgesY[by + 1] - CITY.blockInset;
      const width = x1 - x0;
      const height = y1 - y0;
      if (width < 90 || height < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = random();
      const parkChance = district === 'Palm Heights' ? 0.22 : district === 'Marina' ? 0.16 : 0.1;
      const lotChance = district === 'Downtown' ? 0.12 : 0.08;

      if (roll < parkChance) {
        parks.push({ x: x0, y: y0, width, height });
        const treeCount = Math.floor((width * height) / 5200);
        for (let i = 0; i < treeCount; i += 1) {
          trees.push({ x: range(x0 + 14, x1 - 14), y: range(y0 + 14, y1 - 14), size: range(13, 20) });
        }
        continue;
      }

      if (roll < parkChance + lotChance) {
        const cols = Math.max(1, Math.floor(width / 56));
        const rows = Math.max(1, Math.floor(height / 96));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if (!chance(0.55)) continue;
            parkedCars.push({
              x: x0 + 30 + c * 56,
              y: y0 + 52 + r * 96,
              angle: chance(0.5) ? 0 : Math.PI,
              colour: pick(CAR_COLOURS),
              model: pick(['sedan', 'sedan', 'taxi', 'van']),
            });
          }
        }
        continue;
      }

      // Buildings: downtown gets tall towers, the beach gets low villas.
      const tall = district === 'Downtown';
      const count = tall ? (chance(0.6) ? 1 : 2) : chance(0.45) ? 2 : chance(0.5) ? 3 : 4;
      const slots = [];
      if (count === 1) slots.push([x0, y0, width, height]);
      else if (count === 2) {
        const split = width > height ? 'v' : 'h';
        if (split === 'v') {
          const cut = x0 + width * range(0.42, 0.58);
          slots.push([x0, y0, cut - x0 - 12, height], [cut + 12, y0, x1 - cut - 12, height]);
        } else {
          const cut = y0 + height * range(0.42, 0.58);
          slots.push([x0, y0, width, cut - y0 - 12], [x0, cut + 12, width, y1 - cut - 12]);
        }
      } else {
        const cutX = x0 + width * range(0.45, 0.55);
        const cutY = y0 + height * range(0.45, 0.55);
        slots.push(
          [x0, y0, cutX - x0 - 10, cutY - y0 - 10],
          [cutX + 10, y0, x1 - cutX - 10, cutY - y0 - 10],
          [x0, cutY + 10, cutX - x0 - 10, y1 - cutY - 10],
          [cutX + 10, cutY + 10, x1 - cutX - 10, y1 - cutY - 10],
        );
        while (slots.length > count) slots.splice(Math.floor(random() * slots.length), 1);
      }
      for (const [sx, sy, sw, sh] of slots) {
        if (sw < 60 || sh < 60) continue;
        const inset = range(4, 18);
        const bw = sw - inset * 2;
        const bh = sh - inset * 2;
        buildings.push({
          x: sx + inset,
          y: sy + inset,
          width: bw,
          height: bh,
          floors: tall ? Math.floor(range(8, 26)) : district === 'Beachfront' ? Math.floor(range(1, 4)) : Math.floor(range(2, 8)),
          roof: pick(ROOFS),
          wall: pick(WALLS),
          style: pick(['flat', 'flat', 'flat', 'peaked', 'courtyard']),
        });
      }
    }
  }

  // Palms line the beach promenade and the avenue medians.
  for (let y = 60; y < CITY.height; y += 130) {
    palms.push({ x: CITY.seaWidth + CITY.beachWidth - 30 + range(-8, 8), y: y + range(-20, 20), size: range(15, 21) });
  }
  for (let y = 120; y < CITY.height; y += 260) {
    if (chance(0.7)) palms.push({ x: 2650 + range(-14, 14), y, size: range(13, 18) });
  }
  for (let x = 900; x < CITY.width; x += 300) {
    if (chance(0.5)) palms.push({ x, y: 1850 + range(-14, 14), size: range(13, 18) });
  }

  // Lamps at road corners, every other intersection.
  for (const road of vRoads) {
    for (const h of hRoads) {
      if (chance(0.5)) lamps.push({ x: road.x + road.width / 2 + 12, y: h.y - h.width / 2 - 12 });
      if (chance(0.5)) lamps.push({ x: road.x - road.width / 2 - 12, y: h.y + h.width / 2 + 12 });
    }
  }

  // A few cars parked along the kerb for the player to walk up to. Nose-in kerb
  // parking cannot fit between the avenue and its buildings (a car is longer
  // than the kerb strip is deep), so all four park parallel along the beach
  // promenade, where no building can ever crowd them — a car left half on the
  // block margin west of the avenue used to catch the building line when its
  // new owner drove straight south.
  const kerbSpots = [
    { x: 590, y: 900, angle: 0 },
    { x: 590, y: 1600, angle: Math.PI },
    { x: 590, y: 2300, angle: 0 },
    { x: 590, y: 3000, angle: Math.PI },
  ];
  for (const spot of kerbSpots) {
    parkedCars.push({ ...spot, colour: pick(CAR_COLOURS), model: pick(['sedan', 'taxi', 'sedan', 'van']) });
  }

  const city = {
    seed,
    width: CITY.width,
    height: CITY.height,
    vRoads,
    hRoads,
    buildings,
    parks,
    palms,
    lamps,
    trees,
    parkedCars,
    /** Spawn: on the downtown avenue, facing the beach. */
    spawn: { x: 2650, y: 1850 + 320, angle: Math.PI },
  };

  return city;
}

/** True when the point is on a road (including intersections). */
export function isRoad(city, x, y) {
  for (const road of city.vRoads) {
    if (Math.abs(x - road.x) <= road.width / 2) return true;
  }
  for (const road of city.hRoads) {
    if (Math.abs(y - road.y) <= road.width / 2) return true;
  }
  return false;
}

/** The building covering the point, or null. */
export function buildingAt(city, x, y) {
  for (const building of city.buildings) {
    if (x >= building.x && x < building.x + building.width && y >= building.y && y < building.y + building.height) {
      return building;
    }
  }
  return null;
}

/** True when a circle of radius r at (x, y) touches any building. */
export function circleHitsBuilding(city, x, y, r) {
  for (const building of city.buildings) {
    const nearestX = Math.max(building.x, Math.min(x, building.x + building.width));
    const nearestY = Math.max(building.y, Math.min(y, building.y + building.height));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < r * r) return building;
  }
  return null;
}

/** The nearest point on a road centre-line to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const road of city.vRoads) {
    const d = Math.abs(x - road.x);
    if (d < bestDistance) {
      bestDistance = d;
      best = { x: road.x, y };
    }
  }
  for (const road of city.hRoads) {
    const d = Math.abs(y - road.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = { x, y: road.y };
    }
  }
  return best;
}

/** The parked car nearest (x, y) within range, or null. */
export function nearestParkedCar(city, x, y, range) {
  let best = null;
  let bestDistance = range;
  for (const car of city.parkedCars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best;
}
