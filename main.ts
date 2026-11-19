// Solmar Bay — the entry program for make.fun's gta6-01 bounty (program/v1).
// Node 22, standard library only. It hands the game in: copies this repository's
// game/ and screenshots/ into the output directory and writes dossier.json there,
// the summary the judge reads, using the kit's vendored buildDossier library.
//
// Run it locally the same way the grader does, with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself while developing with `node serve.ts`, then open
// http://localhost:8080 in a desktop browser.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (see the kit's RULES.txt, "The gate").
// The dossier builder enforces the text cap; the checks below refuse an entry
// the scorer would refuse, so a bad local run fails loudly instead of silently.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countTree(dir, seen = { files: 0, bytes: 0 }) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) countTree(path, seen);
    else if (name.isFile()) {
      seen.files += 1;
      seen.bytes += statSync(path).size;
    }
  }
  return seen;
}

function main() {
  mkdirSync(outDir, { recursive: true });

  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing: the game cannot be entered without it');
  }
  const gameSize = countTree(gameDir);
  if (gameSize.files > DOSSIER_OPTIONS.game_max_files) {
    throw new Error(`game/ holds ${gameSize.files} files, over the 993-file cap`);
  }
  if (gameSize.bytes > DOSSIER_OPTIONS.game_max_bytes) {
    throw new Error(`game/ is ${gameSize.bytes} bytes, over the 48 MiB cap`);
  }

  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_OPTIONS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Solmar Bay entry written to ${outDir} (${dossier.length} dossier bytes)`);
}

main();
