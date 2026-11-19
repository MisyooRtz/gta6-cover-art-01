// Vice Sunset Cover Studio — the entrypoint (Node 22, standard library only).
//
// Hands the app in: copies this repository's app/ (the offline static cover
// maker) and screenshots/ into the output directory and writes
// /output/dossier.json with the vendored make.fun library, so the judge can
// read the entry. Nothing here fetches the network or signs anything.
//
// Run it outside the grader's container with MAKEFUN_OUTPUT_DIR standing
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally while you work on it with `node serve.ts`, then
// open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this competition: more than 4 screenshots, or one
// over 256 KiB, refuses the entry, as do more than 993 files in app/, more
// than 48 MiB of app files in all, or a path under app/ over 1000 bytes.
// Check the local numbers before copying so a bad hand-in fails here,
// loudly, instead of on the server.
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
const APP_PATH_MAX_BYTES = 1000;

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function walk(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path, base));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

function checkAppTree(appDir) {
  const files = walk(appDir);
  if (files.length > APP_MAX_FILES) fail(`app/ has ${files.length} files (cap ${APP_MAX_FILES})`);
  let bytes = 0;
  for (const file of files) {
    const rel = file.slice(appDir.length + 1);
    if (Buffer.byteLength(rel, 'utf8') > APP_PATH_MAX_BYTES) fail(`app/ path too long: ${rel}`);
    bytes += statSync(file).size;
  }
  if (bytes > APP_MAX_BYTES) fail(`app/ is ${bytes} bytes (cap ${APP_MAX_BYTES})`);
  if (!existsSync(join(appDir, 'index.html'))) fail('app/index.html is missing');
}

function checkScreenshots(shotsDir) {
  if (!existsSync(shotsDir)) fail('screenshots/ is missing — generate the shots first');
  const shots = readdirSync(shotsDir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length < 3) fail(`screenshots/ has ${shots.length} images, need at least 3`);
  if (shots.length > SCREENSHOT_MAX) fail(`screenshots/ has ${shots.length} images (cap ${SCREENSHOT_MAX})`);
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > SCREENSHOT_MAX_BYTES) fail(`screenshots/${name} is ${size} bytes (cap ${SCREENSHOT_MAX_BYTES})`);
  }
  return shots;
}

const appDir = join(here, 'app');
const shotsDir = join(here, 'screenshots');
checkAppTree(appDir);
const shots = checkScreenshots(shotsDir);

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
    app_max_files: APP_MAX_FILES,
    app_max_bytes: APP_MAX_BYTES,
    app_path_max_bytes: APP_PATH_MAX_BYTES,
  }),
);

console.log(`handed in app/ and ${shots.length} screenshots (${shots.join(', ')}) to ${out}`);
