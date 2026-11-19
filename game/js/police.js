// The Solmar Police Department: a wanted level from 0 to 5 stars, patrol cars
// that chase Leo, foot officers who try to bust him, and heat that cools off
// when Leo breaks line of sight and stays quiet.
import { makeRng } from './rng.js';
import { ROADS_X, ROADS_Y, WORLD_W, WORLD_H, clampToWorld, hitsBuilding } from './city.js';

export const MAX_WANTED = 5;

export function wantedForLevel(level) {
  // How many police cars hunt Leo at each star level.
  return [0, 1, 2, 3, 4, 6][level] ?? 0;
}

export function makePoliceCar(rng, x, y) {
  return {
    x, y, angle: 0, speed: 0,
    type: 'SPD Interceptor', color: '#2a2a32', w: 48, h: 24,
    accel: 520, top: 540,
    driver: 'police', health: 100, smoke: 0,
    stuck: 0, siren: true, id: Math.floor(rng.next() * 1e9),
  };
}

export function makeOfficer(rng, x, y) {
  return {
    x, y, angle: 0, speed: 108, state: 'chase', // chase | punch
    shirt: '#2a3a5a', pants: '#1a1a22', skin: '#e8b88a',
    punchTimer: 0, punchCooldown: 0, downTimer: 0, dead: false,
  };
}

export function spawnPoliceCar(rng, tx, ty) {
  // Appear on a road a little way from the target, never on top of Leo.
  let x = tx; let y = ty;
  for (let i = 0; i < 12; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(120, (vertical ? WORLD_H : WORLD_W) - 120);
    x = vertical ? road : along;
    y = vertical ? along : road;
    if (Math.hypot(x - tx, y - ty) > 420) break;
  }
  const car = makePoliceCar(rng, x, y);
  car.angle = Math.atan2(ty - y, tx - x);
  return car;
}

// A police car chases the target: steer toward it, ram it, slow when close
// enough to let officers out (handled by the caller when Leo is on foot).
// It never drives through a building: blocked, it turns away and tries again.
export function updatePoliceCar(car, tx, ty, dt, city) {
  const dx = tx - car.x; const dy = ty - car.y;
  const d = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 1.4));
  car.angle += steer;
  const targetSpeed = d > 60 ? car.top : 120;
  car.speed += (targetSpeed - car.speed) * Math.min(1, 1.8 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (city && hitsBuilding(city, nx, ny, 12)) {
    car.angle += 1.4 * dt;
    car.speed *= 0.5;
    return d;
  }
  car.x = nx; car.y = ny;
  const c = clampToWorld(car.x, car.y, 30);
  car.x = c.x; car.y = c.y;
  return d;
}

export function updateOfficer(off, tx, ty, dt, city) {
  if (off.downTimer > 0) { off.downTimer -= dt; return; }
  const dx = tx - off.x; const dy = ty - off.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    off.state = 'punch';
    if (off.punchCooldown <= 0) { off.punchTimer = 0.25; off.punchCooldown = 0.9; }
  } else {
    off.state = 'chase';
    off.angle = Math.atan2(dy, dx);
    const nx = off.x + Math.cos(off.angle) * off.speed * dt;
    const ny = off.y + Math.sin(off.angle) * off.speed * dt;
    if (!city || !hitsBuilding(city, nx, ny, 4)) { off.x = nx; off.y = ny; }
  }
  if (off.punchTimer > 0) off.punchTimer -= dt;
  if (off.punchCooldown > 0) off.punchCooldown -= dt;
}

// Heat: gain stars for crimes, lose them by staying unseen and out of trouble.
export function heatTick(world, dt, playerVisible) {
  if (world.wanted === 0) return;
  if (!playerVisible) {
    world.coolTimer += dt;
    const need = 14 + world.wanted * 6;
    if (world.coolTimer > need) {
      world.wanted -= 1;
      world.coolTimer = 0;
    }
  } else {
    world.coolTimer = 0;
  }
}

export function addHeat(world, amount, reason) {
  const before = world.wanted;
  world.wanted = Math.min(MAX_WANTED, world.wanted + amount);
  world.coolTimer = 0;
  if (world.wanted > before) world.lastCrime = reason;
  return world.wanted > before;
}
