// Screenshot scenes behind ?shot=cover|drive|foot|mission. Each one stages a real
// game state from a fixed seed — a chase, a beach drive, a walk through town, the
// bank job — then plays the rules forward a few seconds with a simple autopilot,
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { makeRng, hashSeed } from './rng.js';
import { LANDMARKS } from './city.js';
import { makeCar } from './vehicles.js';
import { spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';

function placePlayerInCar(game, x, y, angle, typeIndex, speed) {
  const car = makeCar(game.rng, x, y, angle, typeIndex, { driver: 'player' });
  car.speed = speed;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x; game.player.y = y;
  return car;
}

function addPoliceChase(game, count, tx, ty) {
  for (let i = 0; i < count; i += 1) {
    const car = spawnPoliceCar(game.rng, tx, ty);
    car.speed = 380;
    game.cars.push(car);
    game.world.policeCars.push(car);
  }
}

// Interceptors already on Leo's tail, on the same road behind him, so the
// chase is in the frame from the first second.
function addPoliceTail(game, tx, ty, angle) {
  const gaps = [260, 430];
  gaps.forEach((gap, i) => {
    const bx = tx - Math.cos(angle) * gap;
    const by = ty - Math.sin(angle) * gap + (i === 0 ? -20 : 20);
    const car = makeCar(game.rng, bx, by, angle, 0, { driver: 'police' });
    car.color = '#2a2a32';
    car.type = 'SPD Interceptor';
    car.accel = 520; car.top = 540;
    car.speed = 400;
    car.siren = true;
    game.cars.push(car);
    game.world.policeCars.push(car);
  });
}

// Drive straight along the current road (no steering into blocks), walk north on
// foot, or stand still at the bank vault — whatever keeps the staged frame clean.
function autopilotInput(game) {
  const p = game.player;
  if (game._shotName === 'mission') {
    return { up: false, down: false, left: false, right: false, action: false };
  }
  if (p.inCar) {
    return { up: true, down: false, left: false, right: false, action: false };
  }
  return { up: true, down: false, left: false, right: false, action: false };
}

// Run the staged scene forward so traffic, police and peds are mid-motion.
function playForward(game, seconds) {
  const step = 1 / 30;
  for (let t = 0; t < seconds; t += step) {
    game.step(step, autopilotInput(game));
  }
}

/**
 * Set `game` to the named scene and return the screen to draw.
 * cover: a police chase downtown with a mission live; drive: a beach cruise;
 * foot: Leo on foot by the diner with locals around; mission: the bank job.
 */
export function stageShot(name, game) {
  game._shotName = name;
  game.rng = makeRng(hashSeed(`solmar-${name}`));
  game.resetWorld(game.rng);
  const p = game.player;
  const world = game.world;

  if (name === 'drive') {
    p.money = 350;
    placePlayerInCar(game, 2000, 2080, Math.PI, 1, 320); // Bay Taxi, west along the beach road
    game.missions.index = 1;
    startMission(game.missions, world);
    addPoliceChase(game, 0, p.x, p.y);
    playForward(game, 2.5);
    game.camZoom = 0.8;
  } else if (name === 'foot') {
    p.x = 1060; p.y = 760; p.angle = -Math.PI / 2;
    p.money = 100;
    game.missions.index = 0;
    startMission(game.missions, world);
    playForward(game, 2.0);
    game.camZoom = 1.0;
  } else if (name === 'mission') {
    const bank = LANDMARKS.find((l) => l.id === 'bank');
    p.x = bank.x; p.y = bank.y + 80; p.angle = -Math.PI / 2;
    p.money = 850; p.health = 82;
    game.missions.index = 4;
    startMission(game.missions, world);
    game.missions.phase = 'grab';
    game.missions.phaseTimer = 3;
    world.wanted = 2;
    addPoliceChase(game, 2, p.x, p.y);
    playForward(game, 1.5);
    game.camZoom = 0.9;
  } else {
    // cover: the chase. Leo in a Comet Sport, 3 stars, two interceptors behind,
    // mid-mission, downtown at rush hour.
    p.money = 1250; p.health = 78;
    placePlayerInCar(game, 1440, 1040, 0, 3, 420);
    game.missions.index = 3;
    startMission(game.missions, world);
    world.wanted = 3;
    addPoliceTail(game, 1440, 1040, 0);
    playForward(game, 2.0);
    game.camZoom = 0.88;
  }
  // Snap the camera onto Leo: a staged shot draws one frame, so the camera
  // never gets a chance to glide there.
  const focus = game.player.inCar ?? game.player;
  game.cam.x = focus.x;
  game.cam.y = focus.y;
  game.screen = 'play';
  return 'play';
}
