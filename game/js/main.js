// Solmar Bay: boot, the game loop, and every system talking to each other.
// The game is one canvas, plain ES modules, no network requests.
import { makeRng, hashSeed } from './rng.js';
import { buildCity, LANDMARKS } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, playerPunch, hurtPlayer } from './player.js';
import {
  spawnTraffic, spawnParked, driveCar, updateTraffic, collideCars, nearestCar, makeCar,
} from './vehicles.js';
import { spawnPeds, updatePeds, knockPed } from './pedestrians.js';
import {
  spawnPoliceCar, updatePoliceCar, updateOfficer, makeOfficer, heatTick, addHeat, wantedForLevel,
} from './police.js';
import {
  createMissionState, startMission, updateMissions, updateTaxi, startTaxiFare,
  currentMission, objectiveText,
} from './missions.js';
import { drawWorld, drawHUD, drawTitle, drawPaused, drawEnd } from './render.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const SAVE_X = 640; const SAVE_Y = 1840; // Leo's Safehouse
const HOSPITAL = { x: 2640, y: 640 };

function makeWorld(seed) {
  return {
    seed, time: 0, wanted: 0, coolTimer: 0, lastCrime: '',
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0, faresDone: 0, busted: 0, wasted: 0 },
    skids: [], sparks: [], policeCars: [], policeTimer: 0, officerTimer: 0,
    audio: null,
  };
}

export function createGame(canvas) {
  const seed = 20261119;
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const audio = createAudio();
  const world = makeWorld(seed);
  world.audio = audio;

  const game = {
    canvas, ctx: canvas.getContext('2d'),
    rng, city, audio, world,
    input: createInput(canvas),
    player: createPlayer(SAVE_X, SAVE_Y),
    cars: [], peds: [], officers: [],
    missions: createMissionState(),
    save: loadSave(),
    screen: 'title',
    endKind: null,
    cam: { x: SAVE_X, y: SAVE_Y, w: 1280, h: 800 },
    camZoom: 1,
    _titleButtons: [],
    _shot: null,
    _doneCount: 0,
  };

  game.resetWorld = (newRng) => {
    game.rng = newRng ?? makeRng(world.seed);
    game.cars = [...spawnTraffic(game.rng, 14), ...spawnParked(game.rng, 10, game.city)];
    game.peds = spawnPeds(game.rng, 26);
    game.officers = [];
    world.policeCars = [];
    world.wanted = 0; world.coolTimer = 0;
    world.skids = []; world.sparks = [];
    world.time = 0;
    game.player.inCar = null;
    game.missions = createMissionState();
  };

  game.resetWorld(rng);
  return game;
}

// ---- shared helpers ----

function carCorners(car) {
  const c = Math.cos(car.angle); const s = Math.sin(car.angle);
  const hw = car.w / 2; const hh = car.h / 2;
  return [
    { x: car.x + c * hw - s * hh, y: car.y + s * hw + c * hh },
    { x: car.x + c * hw + s * hh, y: car.y + s * hw - c * hh },
    { x: car.x - c * hw - s * hh, y: car.y - s * hw + c * hh },
    { x: car.x - c * hw + s * hh, y: car.y - s * hw - c * hh },
  ];
}

function carHitsBuilding(game, car) {
  const { city } = game;
  for (const pt of carCorners(car)) {
    for (const b of city.buildings) {
      if (pt.x > b.x && pt.x < b.x + b.w && pt.y > b.y && pt.y < b.y + b.h) return true;
    }
  }
  return false;
}

function addSparks(game, x, y, n = 6) {
  for (let i = 0; i < n; i += 1) {
    game.world.sparks.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, a: 1 });
  }
}

function respawn(game, kind) {
  const p = game.player;
  if (p.inCar) { p.inCar.driver = 'parked'; p.inCar.speed = 0; p.inCar = null; }
  p.x = kind === 'busted' ? SAVE_X : HOSPITAL.x;
  p.y = kind === 'busted' ? SAVE_Y : HOSPITAL.y;
  p.health = 100;
  p.money = Math.max(0, p.money - 100);
  game.world.wanted = 0;
  game.world.coolTimer = 0;
  for (const c of [...game.world.policeCars]) {
    const i = game.cars.indexOf(c);
    if (i >= 0) game.cars.splice(i, 1);
  }
  game.world.policeCars = [];
  game.officers = [];
  game.screen = 'play';
  writeSave(game);
}

// ---- the per-frame update ----

export function stepGame(game, dt, override) {
  const { player, world, input } = game;
  world.time += dt;
  const inp = override ?? {
    up: input.up(), down: input.down(), left: input.left(), right: input.right(),
    action: input.action(),
  };
  const moveVec = override ? { x: inp.right ? 1 : inp.left ? -1 : 0, y: inp.down ? 1 : inp.up ? -1 : 0 } : input.moveVector();

  // Pause / mute / restart keys (real input only).
  if (!override) {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      game.screen = game.screen === 'paused' ? 'play' : 'paused';
    }
    if (input.wasPressed('KeyM')) {
      const muted = game.audio.toggleMute();
      game._muteNote = muted ? 'Muted' : 'Sound on';
      game._muteTimer = 1.5;
    }
    if (game.screen === 'paused' && input.wasPressed('KeyR')) {
      game.resetWorld(makeRng(world.seed));
      player.x = SAVE_X; player.y = SAVE_Y; player.health = 100;
      game.screen = 'play';
    }
    if (game.screen === 'paused' && input.wasPressed('KeyQ')) {
      writeSave(game);
      game.screen = 'title';
      game.save = loadSave();
    }
  }
  if (game.screen === 'paused') return;

  // --- player ---
  if (player.inCar) {
    const car = player.inCar;
    const prevX = car.x; const prevY = car.y; const prevSpeed = car.speed;
    const speed = driveCar(car, {
      up: () => inp.up, down: () => inp.down, left: () => inp.left,
      right: () => inp.right, action: () => inp.action,
    }, dt);
    if (carHitsBuilding(game, car)) {
      car.x = prevX; car.y = prevY;
      car.speed = prevSpeed * -0.25;
      car.health -= Math.min(12, Math.abs(prevSpeed) * 0.03);
      if (Math.abs(prevSpeed) > 200) {
        addSparks(game, car.x, car.y);
        game.audio.crash();
        car.smoke = Math.min(1, car.smoke + 0.3);
      }
    }
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    if (Math.abs(car.speed) > 260 && inp.action) {
      world.skids.push({ x: car.x, y: car.y, a: 0.5 });
      if (world.skids.length > 120) world.skids.shift();
    }
    if (car.health <= 0) {
      car.smoke = 1; car.speed = 0; car.driver = 'parked';
      player.inCar = null;
      player.x = car.x + 40; player.y = car.y + 30;
      addSparks(game, car.x, car.y, 10);
      game.audio.crash();
    }
    game.audio.setEngine(Math.abs(car.speed) / car.top);
    if (!override && input.wasPressed('KeyE')) {
      car.driver = 'parked'; car.speed = 0;
      player.inCar = null;
      player.x = car.x + 34; player.y = car.y + 26;
      game.audio.door();
      game.audio.stopEngine();
    }
  } else {
    game.audio.stopEngine();
    updatePlayerOnFoot(player, {
      moveVector: () => moveVec,
      run: () => input.run(),
      action: () => inp.action,
    }, game.city, dt, world);
    if (!override && input.wasPressed('Space')) {
      const hits = playerPunch(player, [...game.peds, ...game.officers]);
      if (hits.length) {
        game.audio.punch();
        for (const t of hits) {
          if (game.officers.includes(t)) {
            if (t.downTimer <= 0) {
              t.downTimer = 3;
              addHeat(world, 1, 'attacked an officer');
              addSparks(game, t.x, t.y, 4);
            }
          } else if (knockPed(t)) {
            addHeat(world, 1, 'assault');
            world.stats.pedsHit += 1;
            addSparks(game, t.x, t.y, 4);
          }
        }
      }
    }
    if (!override && input.wasPressed('KeyE')) {
      const car = nearestCar(game.cars, player.x, player.y, 64);
      if (car) {
        if (car.driver === 'parked' || car.driver === 'traffic') {
          const wasParked = car.driver === 'parked';
          car.driver = 'player';
          player.inCar = car;
          game.audio.door();
          if (!wasParked) {
            addHeat(world, 1, 'car theft');
            world.stats.carsStolen += 1;
          }
        }
      }
    }
  }

  // --- traffic ---
  for (const car of game.cars) updateTraffic(car, game.cars, game.city, dt, game.rng);

  // --- car collisions ---
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      const a = game.cars[i]; const b = game.cars[j];
      const impact = collideCars(a, b);
      if (impact > 240) {
        addSparks(game, (a.x + b.x) / 2, (a.y + b.y) / 2);
        if (a.driver === 'player' || b.driver === 'player') {
          game.audio.crash();
          const pc = a.driver === 'player' ? a : b;
          pc.health -= 8;
          if (impact > 380) addHeat(world, 1, 'reckless driving');
        }
      }
    }
  }

  // --- player car vs pedestrians ---
  if (player.inCar) {
    const car = player.inCar;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26 && Math.abs(car.speed) > 90) {
        if (knockPed(ped)) {
          addHeat(world, 1, 'hit a pedestrian');
          world.stats.pedsHit += 1;
          addSparks(game, ped.x, ped.y, 5);
          game.audio.crash();
        }
      }
    }
  }

  // --- pedestrians ---
  updatePeds(game.peds, player, game.cars, game.city, dt, game.rng, (ped) => {
    if (world.wanted === 0) addHeat(world, 1, 'reported by a witness');
  });

  // --- taxi fares: a local with a "!" hops in when Leo stops beside them ---
  if (player.inCar && Math.abs(player.inCar.speed) < 40 && !game.missions.taxi) {
    for (const ped of game.peds) {
      if (!ped.wantsTaxi || ped.state !== 'walk') continue;
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < 46) {
        ped.state = 'taxi';
        const dest = LANDMARKS[Math.floor(game.rng.next() * LANDMARKS.length)];
        startTaxiFare(game.missions, ped, dest);
        game.audio.pickup();
        break;
      }
    }
  }
  updateTaxi(game.missions, world, player, dt);
  if (game.missions.taxi && game.missions.taxi.ped.state === 'taxi') {
    game.missions.taxi.ped.x = player.x;
    game.missions.taxi.ped.y = player.y;
  }

  // --- police ---
  const target = player.inCar ? { x: player.inCar.x, y: player.inCar.y } : { x: player.x, y: player.y };
  world.policeTimer -= dt;
  const want = wantedForLevel(world.wanted);
  if (world.policeTimer <= 0) {
    world.policeTimer = 0.8;
    if (world.policeCars.length < want) {
      const car = spawnPoliceCar(game.rng, target.x, target.y);
      game.cars.push(car);
      world.policeCars.push(car);
    } else if (world.policeCars.length > want) {
      const car = world.policeCars.pop();
      const i = game.cars.indexOf(car);
      if (i >= 0) game.cars.splice(i, 1);
    }
    // Prune police cars that fell far behind when the heat is off.
    if (world.wanted === 0) {
      for (const car of [...world.policeCars]) {
        if (Math.hypot(car.x - target.x, car.y - target.y) > 1400) {
          const i = game.cars.indexOf(car);
          if (i >= 0) game.cars.splice(i, 1);
          world.policeCars.splice(world.policeCars.indexOf(car), 1);
        }
      }
    }
  }
  let anySiren = false;
  for (const car of world.policeCars) {
    const d = updatePoliceCar(car, target.x, target.y, dt, game.city);
    anySiren = true;
    // Ram the player's car.
    if (player.inCar && d < 34) {
      player.inCar.health -= 14 * dt;
      player.inCar.speed *= 0.985;
      if (Math.random() < dt * 2) addSparks(game, car.x, car.y, 2);
    }
    // On foot, an interceptor drops an officer beside Leo.
    if (!player.inCar && d < 130 && game.officers.length < 3 && world.officerTimer <= 0) {
      world.officerTimer = 2.5;
      game.officers.push(makeOfficer(game.rng, car.x + 30, car.y + 30));
    }
  }
  world.officerTimer -= dt;
  game.audio.setSiren(anySiren && world.wanted > 0);
  for (const off of game.officers) {
    updateOfficer(off, player.x, player.y, dt, game.city);
    if (off.state === 'punch' && off.punchTimer > 0.2 && hurtPlayer(player, 9)) {
      game.audio.punch();
    }
  }
  // Busted: an officer standing on Leo for a while.
  if (!player.inCar && world.wanted > 0) {
    const close = game.officers.some((o) => o.downTimer <= 0 && Math.hypot(o.x - player.x, o.y - player.y) < 26);
    player.bustedTimer = close ? player.bustedTimer + dt : Math.max(0, player.bustedTimer - dt);
    if (player.bustedTimer > 1.2) {
      world.stats.busted += 1;
      game.audio.busted();
      game.screen = 'end';
      game.endKind = 'busted';
    }
  }
  if (player.health <= 0 && game.screen === 'play') {
    world.stats.wasted += 1;
    game.audio.fail();
    game.screen = 'end';
    game.endKind = 'wasted';
  }

  // --- heat cools when Leo is unseen ---
  const nearestCop = [...world.policeCars, ...game.officers];
  const seen = nearestCop.some((c) => Math.hypot(c.x - target.x, c.y - target.y) < 520);
  heatTick(world, dt, seen);

  // --- missions ---
  const doneBefore = game.missions.done.length;
  updateMissions(game.missions, world, player, dt);
  if (game.missions.done.length > doneBefore) {
    world.stats.missionsDone = game.missions.done.length;
    writeSave(game);
  }

  // --- effects fade ---
  for (const s of world.sparks) s.a -= dt * 2.2;
  world.sparks = world.sparks.filter((s) => s.a > 0);
  if (game._muteTimer > 0) game._muteTimer -= dt;
}

// ---- drawing ----

function drawGame(game) {
  const { ctx, canvas } = game;
  const w = canvas.width; const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (game.screen === 'title') {
    drawTitle(ctx, game, w, h);
    return;
  }
  const target = game.player.inCar
    ? { x: game.player.inCar.x, y: game.player.inCar.y }
    : { x: game.player.x, y: game.player.y };
  const zoom = game.camZoom;
  const vw = w / zoom; const vh = h / zoom;
  game.cam.x += (target.x - game.cam.x) * 0.08;
  game.cam.y += (target.y - game.cam.y) * 0.08;
  game.cam.x = Math.max(vw / 2, Math.min(3200 - vw / 2, game.cam.x));
  game.cam.y = Math.max(vh / 2, Math.min(2400 - vh / 2, game.cam.y));
  game.cam.w = vw; game.cam.h = vh;
  ctx.save();
  ctx.scale(zoom, zoom);
  drawWorld(ctx, game, game.cam);
  ctx.restore();
  // Warm late-afternoon light.
  ctx.fillStyle = 'rgba(255,170,80,0.05)';
  ctx.fillRect(0, 0, w, h);
  drawHUD(ctx, game, w, h);
  if (game._muteTimer > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game._muteNote, w / 2, 30);
  }
  if (game.screen === 'paused') drawPaused(ctx, w, h);
  if (game.screen === 'end') drawEnd(ctx, game, w, h, game.endKind);
}

// ---- boot ----

function resize(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function boot() {
  const canvas = document.getElementById('game');
  resize(canvas);
  window.addEventListener('resize', () => resize(canvas));
  const game = createGame(canvas);
  game.step = (dt, override) => stepGame(game, dt, override);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') ?? 1);

  if (shot) {
    game.rng = makeRng(hashSeed(`solmar-${shot}-${seed}`));
    stageShot(shot, game);
    drawGame(game);
    window.__shotReady = true;
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.screen === 'title') {
      const click = game.input.takeClick();
      if (click) {
        const btns = game._titleButtons ?? [];
        for (let i = 0; i < btns.length; i += 1) {
          const b = btns[i];
          if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
            startFromTitle(game, i, btns.length);
            break;
          }
        }
      }
      if (game.input.wasPressed('Enter')) startFromTitle(game, 0, game._titleButtons?.length ?? 1);
      if (game.input.wasPressed('KeyN')) startFromTitle(game, game._titleButtons?.length > 1 ? 1 : 0, 1);
    } else if (game.screen === 'end') {
      if (game.input.wasPressed('Enter')) respawn(game, game.endKind);
    } else {
      stepGame(game, dt, null);
    }
    drawGame(game);
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function startFromTitle(game, buttonIndex, buttonCount) {
  const wantsContinue = buttonCount > 1 && buttonIndex === 0 && game.save.exists;
  game.audio.unlock();
  game.resetWorld(makeRng(game.world.seed));
  if (wantsContinue) {
    const s = game.save;
    game.player.money = s.money ?? 0;
    game.player.x = s.x ?? SAVE_X;
    game.player.y = s.y ?? SAVE_Y;
    game.missions.index = s.missionIndex ?? 0;
    game.missions.done = s.done ?? [];
    if (currentMission(game.missions)) startMission(game.missions, game.world);
  } else {
    clearSave();
    game.player.money = 0;
    game.player.x = SAVE_X; game.player.y = SAVE_Y;
    startMission(game.missions, game.world);
  }
  game.cam.x = game.player.x; game.cam.y = game.player.y;
  game.screen = 'play';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
