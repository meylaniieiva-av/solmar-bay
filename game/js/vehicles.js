// Cars: traffic that drives the road grid, parked cars to steal, and the car
// Leo drives. All physics are simple arcade top-down: accelerate, steer, drift.
import { makeRng } from './rng.js';
import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, nearestRoad, hitsBuilding, clampToWorld } from './city.js';

export const CAR_TYPES = [
  { name: 'Solmar Sedan', color: '#c94f43', w: 46, h: 24, accel: 420, top: 430, price: 0 },
  { name: 'Bay Taxi', color: '#e8b73a', w: 46, h: 24, accel: 400, top: 410, price: 0 },
  { name: 'Palm Pickup', color: '#4f7a52', w: 50, h: 25, accel: 380, top: 400, price: 0 },
  { name: 'Comet Sport', color: '#3a6fd8', w: 48, h: 23, accel: 560, top: 560, price: 0 },
  { name: 'Harbor Van', color: '#d8d3c8', w: 54, h: 26, accel: 320, top: 350, price: 0 },
  { name: 'Sunset Coupe', color: '#d83a7a', w: 46, h: 23, accel: 520, top: 520, price: 0 },
];

export function makeCar(rng, x, y, angle, typeIndex, opts = {}) {
  const t = CAR_TYPES[typeIndex % CAR_TYPES.length];
  return {
    x, y, angle, speed: 0,
    type: t.name, color: t.color, w: t.w, h: t.h,
    accel: t.accel, top: t.top,
    driver: opts.driver ?? 'traffic',   // 'traffic' | 'player' | 'police' | 'parked'
    health: 100, smoke: 0,
    // Traffic AI state:
    axis: opts.axis ?? 'h', lane: opts.lane ?? 1, dir: opts.dir ?? 1,
    stuck: 0, honk: 0,
    id: opts.id ?? Math.floor(rng.next() * 1e9),
  };
}

// Spawn traffic on the roads, plus parked cars along the kerbs.
export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.chance(0.5);
    const axis = vertical ? 'v' : 'h';
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(120, (vertical ? WORLD_H : WORLD_W) - 120);
    const lane = rng.pick([-1, 1]);
    const dir = rng.pick([-1, 1]);
    const off = lane * ROAD_W / 4;
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    cars.push(makeCar(rng, x, y, angle, rng.int(0, CAR_TYPES.length - 1), { axis, lane, dir }));
  }
  return cars;
}

export function spawnParked(rng, count, city) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 30) {
    tries += 1;
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(150, (vertical ? WORLD_H : WORLD_W) - 150);
    const side = rng.pick([-1, 1]);
    const off = side * (ROAD_W / 2 + 14);
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    if (hitsBuilding(city, x, y, 4)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(makeCar(rng, x, y, angle, rng.int(0, CAR_TYPES.length - 1), { driver: 'parked' }));
  }
  return cars;
}

// Player driving: arcade handling with steering that scales with speed.
export function driveCar(car, input, dt) {
  const fwd = input.up() ? 1 : input.down() ? -0.6 : 0;
  const steer = (input.left() ? -1 : 0) + (input.right() ? 1 : 0);
  const handbrake = input.action();
  if (fwd !== 0) car.speed += fwd * car.accel * dt;
  else car.speed *= Math.pow(0.4, dt); // coast down
  if (handbrake) car.speed *= Math.pow(0.05, dt);
  // Rolling resistance and reverse cap.
  car.speed *= Math.pow(0.995, dt * 60);
  if (car.speed > car.top) car.speed = car.top;
  if (car.speed < -car.top * 0.45) car.speed = -car.top * 0.45;
  const turn = steer * 2.1 * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  car.angle += turn;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const c = clampToWorld(car.x, car.y, 30);
  if (c.x !== car.x || c.y !== car.y) { car.x = c.x; car.y = c.y; car.speed *= 0.4; }
  return Math.abs(car.speed);
}

// Traffic AI: keep to a lane, pick a new road at each intersection, slow for
// the car ahead, never leave the asphalt.
export function updateTraffic(car, cars, city, dt, rng) {
  if (car.driver !== 'traffic') return;
  const road = nearestRoad(car.x, car.y);
  const ahead = car.speed > 0 ? 46 : 26;
  const ax = car.x + Math.cos(car.angle) * ahead;
  const ay = car.y + Math.sin(car.angle) * ahead;
  let blocked = hitsBuilding(city, ax, ay, 2) !== null;
  for (const o of cars) {
    if (o === car || o.driver === 'parked') continue;
    const d = Math.hypot(o.x - ax, o.y - ay);
    if (d < 34) { blocked = true; break; }
  }
  const targetSpeed = blocked ? 0 : 150;
  car.speed += (targetSpeed - car.speed) * Math.min(1, 2.2 * dt);
  if (Math.abs(car.speed) < 4) car.stuck += dt; else car.stuck = 0;
  // At an intersection, sometimes turn onto the crossing road.
  const onCross = road.axis === 'v'
    ? ROADS_Y.some((ry) => Math.abs(car.y - ry) < 14)
    : ROADS_X.some((rx) => Math.abs(car.x - rx) < 14);
  if (onCross && Math.abs(car.speed) > 20 && rng.chance(dt * 0.9)) {
    const turnLeft = rng.chance(0.5);
    if (road.axis === 'v') {
      car.axis = 'h'; car.dir = turnLeft ? -1 : 1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.axis = 'v'; car.dir = turnLeft ? -1 : 1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  // Steer gently back onto the lane centre.
  const laneOff = car.axis === 'v' ? ROAD_W / 4 : ROAD_W / 4;
  const want = car.axis === 'v' ? road.at + car.lane * laneOff : road.at + car.lane * laneOff;
  const lateral = car.axis === 'v' ? want - car.x : want - car.y;
  const desired = car.axis === 'v'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.max(-0.25, Math.min(0.25, lateral * 0.004))
    : (car.dir > 0 ? 0 : Math.PI) + Math.max(-0.25, Math.min(0.25, lateral * 0.004));
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Keep traffic on the roads: if it drifted off, snap it back.
  const c = clampToWorld(car.x, car.y, 30);
  car.x = c.x; car.y = c.y;
}

// Simple circle-ish collision between two cars; returns impact speed.
export function collideCars(a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = (a.w + b.w) / 2 - 6;
  if (d >= min || d === 0) return 0;
  const nx = dx / d; const ny = dy / d;
  const overlap = (min - d) / 2;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;
  const impact = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.6; b.speed = avg * 0.6;
  return impact;
}

export function nearestCar(cars, x, y, maxD) {
  let best = null; let bd = maxD;
  for (const c of cars) {
    if (c.driver === 'police') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
