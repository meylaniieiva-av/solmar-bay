// Pedestrians: Solmar locals strolling the sidewalks, who flee from danger,
// hail taxis, and report crimes they see to the police.
import { makeRng } from './rng.js';
import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, nearestRoad, hitsBuilding, clampToWorld } from './city.js';

const SHIRTS = ['#e86a6a', '#6aa8e8', '#7ac47a', '#e8c96a', '#c46ae8', '#e89a5a', '#6ad8c4', '#d8d8d8'];
const PANTS = ['#3a4a6a', '#5a3a3a', '#3a5a4a', '#2a2a2a', '#6a5a3a'];

export function makePed(rng, x, y) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52), state: 'walk', // walk | flee | down | taxi
    shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    skin: rng.pick(['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0']),
    targetX: x, targetY: y, wait: rng.range(0, 3),
    fleeTimer: 0, downTimer: 0, panic: 0,
    wantsTaxi: rng.chance(0.12),
  };
}

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    // Start on a sidewalk beside a road.
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(100, (vertical ? WORLD_H : WORLD_W) - 100);
    const side = rng.pick([-1, 1]) * (ROAD_W / 2 + 12);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    peds.push(makePed(rng, x, y));
  }
  return peds;
}

function pickSidewalkTarget(ped, rng) {
  const road = nearestRoad(ped.x, ped.y);
  const along = road.axis === 'v' ? rng.range(120, WORLD_H - 120) : rng.range(120, WORLD_W - 120);
  const side = rng.pick([-1, 1]) * (ROAD_W / 2 + 12);
  if (road.axis === 'v') { ped.targetX = road.at + side; ped.targetY = along; }
  else { ped.targetX = along; ped.targetY = road.at + side; }
}

export function updatePeds(peds, player, cars, city, dt, rng, onCrimeSeen) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.state = 'walk'; ped.wait = 1; }
      continue;
    }
    // Danger nearby: a speeding car, a punch, or Leo's wanted level.
    let danger = null;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const pd = Math.hypot(ped.x - px, ped.y - py);
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : (player.moving ? 160 : 0);
    if (pd < 110 && (playerSpeed > 200 || player.punchTimer > 0)) danger = { x: px, y: py };
    if (!danger) {
      for (const c of cars) {
        if (c.driver === 'traffic' && Math.abs(c.speed) > 120 && Math.hypot(ped.x - c.x, ped.y - c.y) < 90) {
          danger = { x: c.x, y: c.y }; break;
        }
      }
    }
    if (danger) {
      ped.state = 'flee';
      ped.fleeTimer = 1.6;
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      const c = clampToWorld(ped.x, ped.y, 24);
      ped.x = c.x; ped.y = c.y;
      if (ped.panic <= 0 && pd < 160 && onCrimeSeen) { onCrimeSeen(ped); ped.panic = 6; }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      else {
        ped.x += Math.cos(ped.angle) * 120 * dt;
        ped.y += Math.sin(ped.angle) * 120 * dt;
        const c = clampToWorld(ped.x, ped.y, 24);
        ped.x = c.x; ped.y = c.y;
        continue;
      }
    }
    if (ped.panic > 0) ped.panic -= dt;
    // Stroll: walk to a sidewalk target, pause, pick another.
    if (ped.wait > 0) { ped.wait -= dt; if (ped.wait <= 0) pickSidewalkTarget(ped, rng); continue; }
    const dx = ped.targetX - ped.x; const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) { ped.wait = rng.range(1, 4); continue; }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / d) * ped.speed * dt;
    const ny = ped.y + (dy / d) * ped.speed * dt;
    if (!hitsBuilding(city, nx, ny, 4)) { ped.x = nx; ped.y = ny; }
    else pickSidewalkTarget(ped, rng);
  }
}

// Knock a pedestrian down (punch or car hit). Returns true when it just happened.
export function knockPed(ped, seconds = 2.5) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.downTimer = seconds;
  return true;
}
