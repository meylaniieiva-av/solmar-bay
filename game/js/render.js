// All drawing for Solmar Bay: the city, its cars and people, the HUD with its
// minimap, menus and banners. Everything is drawn on one canvas, so a screenshot
// always shows the game exactly as the player sees it.
import { WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, BEACH_Y, LANDMARKS } from './city.js';
import { objectiveText, missionTarget } from './missions.js';
import { MAX_WANTED } from './police.js';

const GRASS_A = '#7fae62';
const GRASS_B = '#74a158';
const SAND = '#e8d194';
const WATER = '#3a8ab5';

export function drawWorld(ctx, game, cam) {
  const { city, player, cars, peds, officers, world } = game;
  const view = { x: cam.x - cam.w / 2, y: cam.y - cam.h / 2, w: cam.w, h: cam.h };
  ctx.save();
  ctx.translate(-view.x, -view.y);

  drawGround(ctx, city, view, world);
  drawRoads(ctx, view);
  drawLandmarks(ctx, view);
  drawBuildings(ctx, city, view);
  drawTrees(ctx, city, view);
  drawMissionMarker(ctx, game, view);
  for (const ped of peds) drawPed(ctx, ped, view);
  for (const car of cars) drawCar(ctx, car, view);
  for (const off of officers) drawOfficer(ctx, off, view);
  drawPlayer(ctx, player, view);
  drawEffects(ctx, game, view);
  ctx.restore();
}

function inView(view, x, y, m = 120) {
  return x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m;
}

function drawGround(ctx, city, view, world) {
  // Grass base with a subtle checker of mowed tones.
  ctx.fillStyle = GRASS_A;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const cell = 160;
  ctx.fillStyle = GRASS_B;
  const x0 = Math.floor(view.x / cell) * cell;
  const y0 = Math.floor(view.y / cell) * cell;
  for (let x = x0; x < view.x + view.w; x += cell) {
    for (let y = y0; y < view.y + view.h; y += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) ctx.fillRect(x, y, cell, cell);
    }
  }
  // Beach and sea along the south edge.
  if (view.y + view.h > BEACH_Y) {
    ctx.fillStyle = SAND;
    ctx.fillRect(view.x, BEACH_Y, view.w, WORLD_H - BEACH_Y);
    ctx.fillStyle = WATER;
    ctx.fillRect(view.x, BEACH_Y + 90, view.w, WORLD_H - BEACH_Y - 90);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = Math.floor(view.x / 90) * 90; x < view.x + view.w; x += 90) {
      ctx.fillRect(x, BEACH_Y + 92 + ((x / 90) % 3) * 8, 46, 3);
    }
    // Sunset pier.
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(1560, BEACH_Y + 40, 80, 130);
    ctx.fillStyle = '#a87e58';
    for (let y = BEACH_Y + 46; y < BEACH_Y + 170; y += 14) ctx.fillRect(1560, y, 80, 5);
  }
}

function drawRoads(ctx, view) {
  ctx.fillStyle = '#3c3c44';
  for (const x of ROADS_X) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of ROADS_Y) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#9a9a94';
  for (const x of ROADS_X) {
    ctx.fillRect(x - ROAD_W / 2 - 10, 0, 10, WORLD_H);
    ctx.fillRect(x + ROAD_W / 2, 0, 10, WORLD_H);
  }
  for (const y of ROADS_Y) {
    ctx.fillRect(0, y - ROAD_W / 2 - 10, WORLD_W, 10);
    ctx.fillRect(0, y + ROAD_W / 2, WORLD_W, 10);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d44d';
  for (const x of ROADS_X) {
    for (let y = 20; y < WORLD_H; y += 64) ctx.fillRect(x - 2, y, 4, 30);
  }
  for (const y of ROADS_Y) {
    for (let x = 20; x < WORLD_W; x += 64) ctx.fillRect(x, y - 2, 30, 4);
  }
  // Crosswalk stripes at each intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      for (let i = -3; i <= 3; i += 1) ctx.fillRect(x + i * 10 - 3, y - ROAD_W / 2 - 8, 6, 12);
    }
  }
}

function drawLandmarks(ctx, view) {
  for (const lm of LANDMARKS) {
    if (!inView(view, lm.x, lm.y, 200)) continue;
    if (lm.kind === 'park') {
      ctx.fillStyle = '#5d9a4e';
      ctx.beginPath(); ctx.ellipse(lm.x, lm.y, 150, 130, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7ab5d8';
      ctx.beginPath(); ctx.ellipse(lm.x + 40, lm.y - 20, 42, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8a06a';
      ctx.beginPath(); ctx.ellipse(lm.x - 30, lm.y + 40, 60, 26, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (lm.kind === 'pier') continue; // drawn with the beach
    if (lm.kind === 'park') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, lm.x, lm.y + 66);
      ctx.fillStyle = '#fff';
      ctx.fillText(lm.name, lm.x, lm.y + 65);
    }
  }
}

function drawBuildings(ctx, city, view) {
  for (const b of city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    // Drop shadow, then walls, roof, and windows.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
    }
    ctx.fillStyle = 'rgba(20,30,50,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3 + b.seed) % 4 === 0) continue; // some windows dark
        ctx.fillRect(b.x + 9 + i * 26, b.y + 9 + j * 26, 12, 12);
      }
    }
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }
}

function drawTrees(ctx, city, view) {
  for (const t of city.trees) {
    if (!inView(view, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMissionMarker(ctx, game, view) {
  const target = missionTarget(game.missions);
  if (!target) return;
  const bob = Math.sin(game.world.time * 3) * 5;
  const { x, y } = target;
  if (!inView(view, x, y, 260)) {
    // Off-screen: an arrow at the screen edge points the way.
    return;
  }
  ctx.save();
  ctx.translate(x, y - 58 + bob);
  ctx.fillStyle = '#ffd23a';
  ctx.strokeStyle = '#8a6a00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 26); ctx.lineTo(-16, 0); ctx.lineTo(-8, 0); ctx.lineTo(-8, -18);
  ctx.lineTo(8, -18); ctx.lineTo(8, 0); ctx.lineTo(16, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,210,58,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 52, 22, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawCar(ctx, car, view) {
  if (!inView(view, car.x, car.y, 80)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, -car.w / 2 + 3, -car.h / 2 + 3, car.w - 6, 8, 4); ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = '#1d2733';
  roundRect(ctx, -car.w * 0.18, -car.h / 2 + 4, car.w * 0.36, car.h - 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.8)';
  ctx.fillRect(car.w * 0.16, -car.h / 2 + 6, 4, car.h - 12);
  if (car.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-car.w / 2 + 2, -car.h / 2 + 2, car.w - 4, 6);
    ctx.fillStyle = '#d83a3a';
    ctx.fillRect(-6, -car.h / 2 - 3, 5, 4);
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(2, -car.h / 2 - 3, 5, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 0, 3);
  }
  if (car.driver === 'player') {
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.w / 2 - 3, -car.h / 2 - 3, car.w + 6, car.h + 6, 9);
    ctx.stroke();
  }
  if (car.smoke > 0.3) {
    ctx.fillStyle = `rgba(80,80,80,${Math.min(0.7, car.smoke)})`;
    ctx.beginPath(); ctx.arc(-car.w / 2, 0, 8 + Math.random() * 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped, view) {
  if (!inView(view, ped.x, ped.y, 40)) return;
  const down = ped.state === 'down';
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (down) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-5, 0, 10, 9);
  ctx.fillStyle = ped.shirt;
  ctx.fillRect(-6, -9, 12, 10);
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(0, -13, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.wantsTaxi && ped.state === 'walk') {
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 24);
  }
}

function drawOfficer(ctx, off, view) {
  if (!inView(view, off.x, off.y, 40)) return;
  const down = off.downTimer > 0;
  ctx.save();
  ctx.translate(off.x, off.y);
  if (down) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = off.pants;
  ctx.fillRect(-5, 0, 10, 9);
  ctx.fillStyle = off.shirt;
  ctx.fillRect(-6, -9, 12, 10);
  ctx.fillStyle = '#2a3a5a';
  ctx.fillRect(-6, -9, 12, 3);
  ctx.fillStyle = off.skin;
  ctx.beginPath(); ctx.arc(0, -13, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(-6, -19, 12, 4); // cap
  ctx.restore();
}

function drawPlayer(ctx, p, view) {
  if (p.inCar) return; // Leo is inside the car
  if (!inView(view, p.x, p.y, 40)) return;
  const blink = p.hurtTimer > 0 && Math.floor(p.hurtTimer * 14) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (!blink) {
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(-6, -2, 12, 11); // jeans
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-7, -11, 14, 11); // white tee
    ctx.fillStyle = '#d8a05a';
    ctx.fillRect(-7, -11, 14, 3); // jacket trim
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(8, -6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath(); ctx.arc(8, -7, 6, Math.PI, Math.PI * 2); ctx.fill(); // hair
  }
  if (p.punchTimer > 0) {
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(20, -6, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Name tag so the player is easy to find in a screenshot.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEO', p.x, p.y - 24);
}

function drawEffects(ctx, game, view) {
  const { world } = game;
  for (const s of world.skids) {
    if (!inView(view, s.x, s.y, 20)) continue;
    ctx.fillStyle = `rgba(20,20,20,${s.a})`;
    ctx.fillRect(s.x - 3, s.y - 1.5, 6, 3);
  }
  for (const s of world.sparks) {
    if (!inView(view, s.x, s.y, 20)) continue;
    ctx.fillStyle = `rgba(255,210,80,${s.a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- HUD, minimap and menus (screen space) ----

export function drawHUD(ctx, game, w, h) {
  const { player, world, missions } = game;
  ctx.save();
  ctx.textAlign = 'left';
  // Top-left: cash, health, wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, 12, 210, 84, 10); ctx.fill();
  ctx.fillStyle = '#7be07b';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${player.money}`, 24, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Health`, 24, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(74, 52, 130, 10);
  ctx.fillStyle = player.health > 30 ? '#e86a6a' : '#ff2222';
  ctx.fillRect(74, 52, 130 * Math.max(0, player.health / 100), 10);
  // Wanted stars.
  for (let i = 0; i < MAX_WANTED; i += 1) {
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = i < world.wanted ? '#ffd23a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 26, 92);
  }
  // Minimap, top-right.
  drawMinimap(ctx, game, w - 196, 12, 184, 148);
  // Mission objective, bottom-centre.
  const obj = objectiveText(missions);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const tw = ctx.measureText(obj).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w / 2 - tw / 2 - 14, h - 64, tw + 28, 34, 8); ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.textAlign = 'center';
  ctx.fillText(obj, w / 2, h - 41);
  // Banner.
  if (missions.bannerTimer > 0 && missions.banner) {
    const a = Math.min(1, missions.bannerTimer);
    ctx.globalAlpha = a;
    const lines = wrapText(ctx, missions.banner.sub, 480);
    const boxH = 40 + lines.length * 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, w / 2 - 260, 110, 520, boxH, 12); ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(missions.banner.text, w / 2, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, w / 2, 164 + i * 20));
    ctx.globalAlpha = 1;
  }
  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  const hint = player.inCar
    ? 'W/S drive • A/D steer • Space handbrake • E leave car • P pause • M mute'
    : 'WASD move • Shift run • Space punch • E enter car • P pause • M mute';
  ctx.fillText(hint, 14, h - 14);
  // Speed, bottom-right, while driving.
  if (player.inCar) {
    const mph = Math.round(Math.abs(player.inCar.speed) * 0.14);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${mph}`, w - 16, h - 44);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('mph', w - 16, h - 26);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(player.inCar.type, w - 16, h - 88);
  }
  // Wanted flash: red vignette while the heat is on.
  if (world.wanted > 0) {
    const pulse = 0.05 + 0.03 * Math.sin(world.time * 4);
    ctx.strokeStyle = `rgba(220,40,40,${pulse + 0.08})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, w, h);
  }
  ctx.restore();
}

export function drawMinimap(ctx, game, x, y, w, h) {
  const { player, cars, officers, world } = game;
  const sx = w / WORLD_W; const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,16,0.8)';
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.beginPath(); roundRect(ctx, x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = '#2e5d3a';
  ctx.fillRect(x, y, w, h);
  // Beach.
  ctx.fillStyle = '#c8b078';
  ctx.fillRect(x, y + (BEACH_Y / WORLD_H) * h, w, h - (BEACH_Y / WORLD_H) * h);
  ctx.fillStyle = '#3a8ab5';
  ctx.fillRect(x, y + ((BEACH_Y + 90) / WORLD_H) * h, w, h - ((BEACH_Y + 90) / WORLD_H) * h);
  ctx.fillStyle = '#7a7a72';
  for (const rx of ROADS_X) ctx.fillRect(x + (rx / WORLD_W) * w - 2, y, 4, h);
  for (const ry of ROADS_Y) ctx.fillRect(x, y + (ry / WORLD_H) * h, w, 4);
  // Park.
  ctx.fillStyle = '#4a8a3e';
  ctx.beginPath(); ctx.ellipse(x + (1240 / WORLD_W) * w, y + (1240 / WORLD_H) * h, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Mission marker.
  const target = missionTarget(game.missions);
  if (target) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(x + (target.x / WORLD_W) * w, y + (target.y / WORLD_H) * h, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + (target.x / WORLD_W) * w, y + (target.y / WORLD_H) * h, 7, 0, Math.PI * 2); ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#5aa8ff';
  for (const c of cars) {
    if (c.driver !== 'police') continue;
    ctx.beginPath(); ctx.arc(x + (c.x / WORLD_W) * w, y + (c.y / WORLD_H) * h, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const o of officers) {
    ctx.beginPath(); ctx.arc(x + (o.x / WORLD_W) * w, y + (o.y / WORLD_H) * h, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const pa = player.inCar ? player.inCar.angle : player.angle;
  ctx.save();
  ctx.translate(x + (px / WORLD_W) * w, y + (py / WORLD_H) * h);
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x + 6, y + h - 6);
}

export function drawTitle(ctx, game, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ff9a5a');
  g.addColorStop(0.55, '#e86a7a');
  g.addColorStop(1, '#5a3a8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath(); ctx.arc(w * 0.72, h * 0.26, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,58,0.35)';
  ctx.beginPath(); ctx.arc(w * 0.72, h * 0.26, 92, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = 'rgba(40,20,60,0.85)';
  const base = h * 0.78;
  let bx = 0;
  const widths = [70, 46, 90, 56, 110, 64, 80, 50, 96, 60, 84];
  for (let i = 0; bx < w; i += 1) {
    const bw = widths[i % widths.length];
    const bh = 90 + ((i * 53) % 130);
    ctx.fillRect(bx, base - bh, bw, bh);
    bx += bw + 14;
  }
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(0, base, w, h - base);
  ctx.fillStyle = '#e8d44d';
  for (let x = 20; x < w; x += 46) ctx.fillRect(x, base + 26, 22, 4);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.3);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23a';
  ctx.fillText('An open-world crime story', w / 2, h * 0.3 + 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Leo Marín is home. The city owes him — and he intends to collect.', w / 2, h * 0.42);
  ctx.fillText('Steal cars, outrun the SPD, run missions for Rosa, and take the Big Score.', w / 2, h * 0.42 + 26);

  const hasSave = game.save && game.save.exists;
  const buttons = hasSave
    ? ['Continue — $' + game.save.money, 'New Game']
    : ['New Game'];
  const by = h * 0.58;
  buttons.forEach((label, i) => {
    const bx2 = w / 2 - 170; const by2 = by + i * 58;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, bx2, by2, 340, 44, 10); ctx.fill();
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
    roundRect(ctx, bx2, by2, 340, 44, 10); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(label, w / 2, by2 + 29);
    game._titleButtons = game._titleButtons || [];
    game._titleButtons[i] = { x: bx2, y: by2, w: 340, h: 44, label };
  });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move / drive  •  E enter car  •  Space punch / handbrake  •  Shift run  •  P pause  •  M mute', w / 2, h * 0.58 + buttons.length * 58 + 30);
  ctx.fillText('An original game. No Rockstar names, art or music — Solmar Bay is ours.', w / 2, h - 24);
}

export function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume      M — mute      R — restart day      Q — save & quit to title', w / 2, h / 2 + 6);
}

export function drawEnd(ctx, game, w, h, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#5aa8ff' : '#ff5a5a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', w / 2, h / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The SPD caught up with Leo. $100 bail, and the heat is off — for now.'
    : 'Leo went down. Solmar General patched him up. $100 hospital bill.', w / 2, h / 2 + 12);
  ctx.fillText('Press Enter to get back on the streets', w / 2, h / 2 + 48);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
