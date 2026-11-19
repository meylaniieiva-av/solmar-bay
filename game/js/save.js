// Save and load for Solmar Bay, in localStorage. Money, missions, position and
// stats survive a reload; the city itself is rebuilt from its seed.
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { exists: false };
    const data = JSON.parse(raw);
    return { exists: true, ...data };
  } catch {
    return { exists: false };
  }
}

export function writeSave(game) {
  try {
    const data = {
      money: game.player.money,
      x: game.player.inCar ? game.player.inCar.x : game.player.x,
      y: game.player.inCar ? game.player.inCar.y : game.player.y,
      missionIndex: game.missions.index,
      done: game.missions.done,
      stats: game.world.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
