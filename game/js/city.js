// Solmar Bay: an original sun-soaked coastal city, built once from a seed.
// Roads form a grid; blocks hold buildings, a park, a plaza and the beachfront.
// Nothing here is copied from any commercial game: street and place names are ours.
import { makeRng } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 72;
export const BEACH_Y = 2180;

export const STREETS_V = ['Coral Ave', 'Palm Row', 'Marina Blvd', 'Sunset St', 'Cactus Ln', 'Harbor Way', 'Fiesta Rd', 'Loma St'];
export const STREETS_H = ['Ocean Dr', 'Seabreeze Ave', 'Tropicana St', 'Flamingo Rd', 'Bayside Ln', 'Pelican Way'];

// Road centre lines (vertical x, horizontal y).
export const ROADS_X = [240, 640, 1040, 1440, 1840, 2240, 2640, 2960];
export const ROADS_Y = [240, 640, 1040, 1440, 1840, 2080];

export const LANDMARKS = [
  { id: 'diner', name: "Rosa's Diner", x: 1040, y: 640, kind: 'diner' },
  { id: 'garage', name: 'Solmar Auto Garage', x: 2240, y: 1040, kind: 'garage' },
  { id: 'docks', name: 'Solmar Docks', x: 2960, y: 2080, kind: 'docks' },
  { id: 'park', name: 'Palmera Park', x: 1240, y: 1240, kind: 'park' },
  { id: 'bank', name: 'Bay Trust Bank', x: 1840, y: 640, kind: 'bank' },
  { id: 'safehouse', name: "Leo's Safehouse", x: 640, y: 1840, kind: 'safehouse' },
  { id: 'hospital', name: 'Solmar General', x: 2640, y: 640, kind: 'hospital' },
  { id: 'police', name: 'Solmar PD HQ', x: 1440, y: 1840, kind: 'police' },
  { id: 'pier', name: 'Sunset Pier', x: 1600, y: 2280, kind: 'pier' },
];

const ROOF_COLORS = ['#b5543f', '#c07a45', '#8a6f5c', '#a34d5e', '#5c7a8a', '#7a8a5c', '#96563f', '#6b5a8a'];
const WALL_COLORS = ['#e8d9b8', '#d9c2a3', '#e3cfa8', '#cbb59a', '#d8c8a8', '#e0d0b0'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Buildings fill every block that is not the park, the beach or a landmark lot.
  for (let col = 0; col < ROADS_X.length - 1; col += 1) {
    for (let row = 0; row < ROADS_Y.length - 1; row += 1) {
      const x0 = ROADS_X[col] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[row] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[col + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[row + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Palmera Park sits in the middle block; the beach strip stays open.
      if (col === 2 && row === 2) {
        for (let i = 0; i < 26; i += 1) {
          trees.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), r: rng.range(9, 15) });
        }
        continue;
      }
      if (y0 > BEACH_Y - 220) continue;
      const count = rng.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(70, 150);
        const h = rng.range(70, 130);
        const bx = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const by = rng.range(y0, Math.max(y0 + 1, y1 - h));
        // Keep buildings from overlapping each other in the same block.
        if (buildings.some((b) => bx < b.x + b.w + 12 && bx + w + 12 > b.x && by < b.y + b.h + 12 && by + h + 12 > b.y)) continue;
        const tall = rng.chance(0.22);
        buildings.push({
          x: bx, y: by, w, h,
          roof: rng.pick(ROOF_COLORS), wall: rng.pick(WALL_COLORS),
          tall, floors: tall ? rng.int(4, 7) : rng.int(1, 2),
          seed: rng.int(0, 999999),
        });
      }
      // A couple of palms on each block corner.
      for (let i = 0; i < 3; i += 1) {
        trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(8, 13) });
      }
    }
  }

  // Landmark lots get their own low building, set back into the block beside
  // the intersection so the roads stay open — the marker stays on the corner.
  for (const lm of LANDMARKS) {
    if (lm.kind === 'park' || lm.kind === 'pier') continue;
    const bx = lm.x + 130 - 70; const by = lm.y + 110 - 46;
    // Clear any generated building the landmark lot would overlap.
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (bx < b.x + b.w + 8 && bx + 140 + 8 > b.x && by < b.y + b.h + 8 && by + 92 + 8 > b.y) {
        buildings.splice(i, 1);
      }
    }
    buildings.push({
      x: bx, y: by, w: 140, h: 92,
      roof: lm.kind === 'police' ? '#3f5a8a' : lm.kind === 'bank' ? '#8a7a3f' : '#b5543f',
      wall: '#e8d9b8', tall: lm.kind === 'bank', floors: lm.kind === 'bank' ? 5 : 1,
      seed: 7, landmark: lm.id, name: lm.name,
    });
  }

  // Street lamps along the roads.
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      lamps.push({ x: x + ROAD_W / 2 + 6, y: y - ROAD_W / 2 - 6 });
    }
  }

  return { buildings, trees, lamps, rng };
}

// True when the point is on a road (drivable asphalt).
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

// Nearest road centre line and which axis it runs on.
export function nearestRoad(x, y) {
  let best = { axis: 'v', at: ROADS_X[0], d: Infinity };
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { axis: 'v', at: rx, d };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { axis: 'h', at: ry, d };
  }
  return best;
}

// A point is blocked when it falls inside a building (with a small margin).
export function hitsBuilding(city, x, y, margin = 2) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

export function clampToWorld(x, y, m = 20) {
  return {
    x: Math.max(m, Math.min(WORLD_W - m, x)),
    y: Math.max(m, Math.min(WORLD_H - m, y)),
  };
}
