# solmar-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/meylaniieiva-av/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/meylaniieiva-av/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an original open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty. Leo Marín comes home to Solmar Bay, a sun-soaked coastal city of his own — no Rockstar names, art or music anywhere. Explore the city on foot or by car, steal cars, outrun the Solmar Police Department across a 0–5 star wanted level, run five story missions for Rosa, pick up taxi fares, and pull off the Big Score at Bay Trust Bank. Keyboard and mouse, HUD with a live minimap, synthesized sound, and a save that survives a reload. Plain static files under `game/` — no build step, no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or serve `game/` with any static file server and open `index.html`.

## Play

- **WASD / arrows** — move on foot, drive in a car
- **E** — enter / leave a car (stealing a parked or traffic car raises your wanted level)
- **Space** — punch on foot, handbrake while driving
- **Shift** — run
- **P / Esc** — pause (R restart day, Q save & quit to title)
- **M** — mute

## How it is built

- `game/index.html` + `game/css/style.css` + `game/js/` — the game itself, plain ES modules: `city.js` builds Solmar Bay from a seed, `vehicles.js` drives traffic and the cars you steal, `police.js` runs the wanted level and the SPD, `pedestrians.js` walks the locals, `missions.js` runs the five-mission story and the taxi fares, `render.js` draws the world, HUD and minimap, `audio.js` synthesises every sound with WebAudio, `shots.js` stages the four screenshots deterministically (`?shot=cover|drive|foot|mission`).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
- `screenshots/` — four real renders of the game in a browser; the first by name is the cover.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8cx6jc10&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
