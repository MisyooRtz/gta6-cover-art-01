# Vice Sunset Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn any photo into a multi-panel sunset cover in the style of a GTA poster — bold lettering, neon-sunset grades, four panels — and export it as a PNG to share. Built for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on [make.fun](https://make.fun).

**100% offline.** The app is plain static files under `app/` — no build step, no network requests, no uploads. Your photos never leave your machine.

## What it does

- **Four layouts** — Quad grid (big hero + 3 panels), Hero + side strip (hero + 3 vertical panels), Full-bleed single photo with title block, and a tilted snapshot collage.
- **Any photo, per panel** — upload per panel, drag-and-drop anywhere on the page, or load the built-in samples. "One photo in all panels" fills every panel with the same photo at a different crop.
- **Crop & position per panel** — click a panel to select it, drag to pan, scroll (or the slider) to zoom, fit/fill toggle, reset.
- **Four colour grades** — Vice Sunset (orange-pink), Neon Night (magenta/teal), Palm Dusk (purple/gold), and Noir (B&W). Plus film grain and vignette toggles, and hold-to-compare against the ungraded photo.
- **Lettering** — editable title in Anton (white or sunset-gradient fill, dark outline, drop shadow), script subtitle in Pacifico, and an editable badge ribbon. Both fonts are vendored under `app/fonts/` under the SIL Open Font License.
- **Fast export** — one click each for 1080×1080, 1080×1350 and 1920×1080 PNG, or "Export all three". Exports redraw the cover at full resolution offscreen — never an upscale of the preview.

## Run it

Any static server works. From the repo root:

```sh
python3 -m http.server 8080 --directory app
# or: npx serve app
```

Then open http://localhost:8080 — no install, no build.

## How it works

- `app/src/cover.js` — the cover engine: panel geometry per layout, photo crop/zoom, grade overlays (canvas blend modes + `ctx.filter`), title block, grain and vignette. One function paints both the preview and the full-resolution export.
- `app/src/main.js` — editor wiring: state, panel picking/dragging/zooming, uploads, drag-drop, export buttons.
- `app/src/shots.js` — fixed scenes for screenshots: `?shot=cover` renders the cover full-frame (params: `photo`, `caption`, `layout`, `grade`, `size`), `?shot=editor` renders the editor with a sample photo loaded.
- `main.ts` — the make.fun hand-in program (Node 22, stdlib only): copies `app/` and `screenshots/` to the output dir and writes `dossier.json`.

## Screenshots

| | |
|---|---|
| `screenshots/1-cover.jpg` | Landscape cover, quad grid, Vice Sunset grade |
| `screenshots/2-editor.jpg` | The editor with a sample photo loaded |
| `screenshots/3-cover.jpg` | Portrait cover, full-bleed, Neon Night grade |
| `screenshots/4-cover.jpg` | Square cover, snapshot collage, Palm Dusk grade |

## Originality & license

All art, lettering and code here are original. No Rockstar Games logo, artwork, character or font is used anywhere. The Anton and Pacifico fonts are licensed under the SIL Open Font License 1.1 (texts in `app/fonts/`). The two sample photos were made with an image model for make.fun and are free to use.

This project is licensed under the MIT License — see [LICENSE](LICENSE).
