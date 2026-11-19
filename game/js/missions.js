// Missions and story for Solmar Bay. Leo Marín comes home to Solmar Bay after
// three years away and owes a favour to Rosa, who runs the diner. Five story
// missions, then a repeatable taxi fare as a side job. All names are original.
import { LANDMARKS } from './city.js';

export const MISSIONS = [
  {
    id: 'welcome',
    title: 'Welcome Home',
    brief: "Rosa's Diner needs you. Head to the yellow marker at Rosa's Diner.",
    target: 'diner', reward: 100,
    objective: 'Go to Rosa\'s Diner',
  },
  {
    id: 'wheels',
    title: 'Wheels',
    brief: 'Rosa needs a car that cannot be traced. Steal any car (E) and bring it to the Solmar Auto Garage.',
    target: 'garage', reward: 200,
    needsCar: true,
    objective: 'Steal a car and deliver it to the garage',
  },
  {
    id: 'package',
    title: 'The Package',
    brief: 'A package waits at the Solmar Docks. Pick it up, then deliver it to Palmera Park. No questions.',
    target: 'docks', reward: 350,
    pickup: 'docks', deliver: 'park',
    objective: 'Pick up the package at the docks',
  },
  {
    id: 'heat',
    title: 'Heat',
    brief: 'The SPD is onto you. You have 3 stars — lose the cops and stay clean until the heat dies down.',
    target: null, reward: 500,
    wantedStart: 3,
    objective: 'Lose your 3-star wanted level',
  },
  {
    id: 'score',
    title: 'The Big Score',
    brief: 'Bay Trust Bank, 5 seconds at the vault door, then get the cash to the safehouse. The whole SPD will come.',
    target: 'bank', reward: 1000,
    grab: 'bank', escape: 'safehouse', grabSeconds: 5, wantedStart: 4,
    objective: 'Grab the cash at Bay Trust Bank',
  },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) ?? null;
}

export function createMissionState() {
  return {
    index: 0,              // which story mission is active
    active: null,          // runtime copy of the active mission
    done: [],              // completed mission ids
    phase: 'go',           // go | pickup | deliver | grab | escape | cooloff
    phaseTimer: 0,
    banner: null,          // { text, sub, t } shown on screen
    bannerTimer: 0,
    taxi: null,            // active taxi fare { ped, dest, timer }
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] ?? null;
}

export function startMission(state, world) {
  const m = currentMission(state);
  if (!m) return;
  state.active = { ...m };
  state.phase = m.pickup ? 'pickup' : m.grab ? 'grab' : m.wantedStart ? 'cooloff' : 'go';
  if (m.wantedStart) world.wanted = Math.max(world.wanted, m.wantedStart);
  showBanner(state, m.title, m.brief);
  state.phaseTimer = 0;
}

export function showBanner(state, text, sub) {
  state.banner = { text, sub: sub ?? '', t: 0 };
  state.bannerTimer = 4.5;
}

export function completeMission(state, world, player) {
  const m = state.active;
  if (!m) return;
  player.money += m.reward;
  state.done.push(m.id);
  state.index += 1;
  showBanner(state, `Mission passed: ${m.title}`, `+$${m.reward}  •  Total $${player.money}`);
  state.active = null;
  if (currentMission(state)) {
    state._pendingStart = 1.2; // start the next one after a breath
  } else {
    showBanner(state, 'Solmar Legend', 'Every story mission is done. The city is yours — fares pay, heat fades.');
  }
  if (world.audio) world.audio.mission();
}

// Drive the active mission forward. `pos` is Leo (or his car) in world coords.
export function updateMissions(state, world, player, dt) {
  if (state.bannerTimer > 0) state.bannerTimer -= dt;
  if (state._pendingStart) {
    state._pendingStart -= dt;
    if (state._pendingStart <= 0) { state._pendingStart = 0; startMission(state, world); }
    return;
  }
  const m = state.active;
  if (!m) return;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const at = (id, radius = 70) => {
    const lm = landmarkById(id);
    return lm && Math.hypot(px - lm.x, py - lm.y) < radius;
  };

  if (state.phase === 'go') {
    if (m.needsCar && !player.inCar) return; // still needs wheels
    if (at(m.target)) {
      if (m.pickup) { state.phase = 'pickup'; }
      else if (m.grab) { state.phase = 'grab'; state.phaseTimer = 0; }
      else completeMission(state, world, player);
    }
  } else if (state.phase === 'pickup') {
    if (at(m.pickup)) {
      state.phase = 'deliver';
      showBanner(state, 'Package collected', 'Deliver it to Palmera Park.');
      if (world.audio) world.audio.pickup();
    }
  } else if (state.phase === 'deliver') {
    if (at(m.deliver)) completeMission(state, world, player);
  } else if (state.phase === 'grab') {
    if (!at(m.grab, 90)) { state.phaseTimer = 0; return; }
    state.phaseTimer += dt;
    if (state.phaseTimer >= (m.grabSeconds ?? 5)) {
      state.phase = 'escape';
      showBanner(state, 'Cash grabbed!', 'Get to the safehouse — lose the cops on the way.');
      if (world.audio) world.audio.coin();
    }
  } else if (state.phase === 'escape') {
    if (at(m.escape)) completeMission(state, world, player);
  } else if (state.phase === 'cooloff') {
    if (world.wanted === 0) completeMission(state, world, player);
  }
}

// The repeatable side job: a local waves Leo down for a taxi ride.
export function startTaxiFare(state, ped, dest) {
  state.taxi = { ped, dest, timer: 90, fare: 50 };
  showBanner(state, 'Taxi fare', `Drop your passenger at ${dest.name}. $50 on arrival.`);
}

export function updateTaxi(state, world, player, dt) {
  const fare = state.taxi;
  if (!fare) return;
  fare.timer -= dt;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  if (fare.timer <= 0) {
    showBanner(state, 'Fare lost', 'Your passenger gave up waiting.');
    fare.ped.state = 'walk';
    state.taxi = null;
    return;
  }
  if (Math.hypot(px - fare.dest.x, py - fare.dest.y) < 70 && player.inCar) {
    player.money += fare.fare;
    showBanner(state, 'Fare complete', `+$${fare.fare}  •  Total $${player.money}`);
    if (world.audio) world.audio.coin();
    fare.ped.state = 'walk';
    fare.ped.wantsTaxi = false;
    state.taxi = null;
  }
}

// The current objective line for the HUD.
export function objectiveText(state) {
  const m = state.active;
  if (!m) {
    if (currentMission(state)) return 'Press Enter to start the next mission';
    return 'Free roam — fares pay, heat fades';
  }
  if (state.phase === 'pickup') return 'Pick up the package at the docks';
  if (state.phase === 'deliver') return 'Deliver the package to Palmera Park';
  if (state.phase === 'grab') return `Hold at the bank vault (${Math.ceil((m.grabSeconds ?? 5) - state.phaseTimer)}s)`;
  if (state.phase === 'escape') return "Escape to Leo's Safehouse";
  if (state.phase === 'cooloff') return 'Lose your wanted level';
  return m.objective;
}

// Where the yellow mission marker should point right now.
export function missionTarget(state) {
  const m = state.active;
  if (!m) return null;
  if (state.phase === 'pickup') return landmarkById(m.pickup);
  if (state.phase === 'deliver') return landmarkById(m.deliver);
  if (state.phase === 'grab') return landmarkById(m.grab);
  if (state.phase === 'escape') return landmarkById(m.escape);
  if (state.phase === 'cooloff') return null;
  return landmarkById(m.target);
}
