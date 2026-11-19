// Leo Marín on foot: walk, run, punch, enter cars, take damage, get busted.
import { hitsBuilding, clampToWorld } from './city.js';

export const PLAYER_R = 13;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, money: 0,
    inCar: null,           // the car object Leo is driving, or null
    punchTimer: 0, punchCooldown: 0,
    hurtTimer: 0, bustedTimer: 0,
    moving: false, running: false,
  };
}

export function updatePlayerOnFoot(p, input, city, dt, world) {
  const v = input.moveVector();
  const len = Math.hypot(v.x, v.y);
  p.moving = len > 0;
  p.running = input.run() && len > 0;
  const speed = p.running ? 235 : 150;
  if (len > 0) {
    const nx = v.x / len; const ny = v.y / len;
    p.angle = Math.atan2(ny, nx);
    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    if (!hitsBuilding(city, p.x + stepX, p.y, PLAYER_R)) p.x += stepX;
    if (!hitsBuilding(city, p.x, p.y + stepY, PLAYER_R)) p.y += stepY;
    const c = clampToWorld(p.x, p.y, 24);
    p.x = c.x; p.y = c.y;
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  // Slow health regen while the heat is off.
  if (world.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 4 * dt);
}

// A punch: a short arc in front of Leo. Returns the hit list for the caller.
export function playerPunch(p, targets) {
  if (p.punchCooldown > 0 || p.inCar) return [];
  p.punchTimer = 0.22;
  p.punchCooldown = 0.45;
  const hx = p.x + Math.cos(p.angle) * 26;
  const hy = p.y + Math.sin(p.angle) * 26;
  const hit = [];
  for (const t of targets) {
    if (t.dead) continue;
    const d = Math.hypot(t.x - hx, t.y - hy);
    if (d < 30) hit.push(t);
  }
  return hit;
}

export function hurtPlayer(p, amount) {
  if (p.hurtTimer > 0 || p.inCar) return false;
  p.health -= amount;
  p.hurtTimer = 0.5;
  if (p.health < 0) p.health = 0;
  return true;
}
