# Vice Sunset Cover Studio

[![Make GTA 6 Cover Art](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline GTA 6-style cover-art maker for GTA VI launch week. Turn your own
photos into the iconic multi-panel poster: four panels, a Vice City sunset
grade, bold condensed title lettering and a badge ribbon — then export a
share-ready PNG in 1080 × 1080, 1080 × 1350 or 1920 × 1080.

Built for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)
bounty on [make.fun](https://make.fun).

## What it does

- **4 multi-panel layouts** — Quad Grid, Hero + Side Strip, Full Bleed, and a
  tilted Snapshot Collage.
- **4 grades** — Vice Sunset, Neon Night, Palm Dusk, Noir — built from canvas
  filters, blend overlays, deterministic grain and a vignette.
- **Your photos, your crops** — upload or drag-and-drop per panel, click to
  select, drag to pan, scroll to zoom, or use the zoom slider. Fill or fit,
  reset, shuffle crops, or put one photo in all four panels with an
  independent crop per panel.
- **Framing that keeps faces in shot** — every panel uses a "look-up" crop:
  the hero looks 45% up the photo, the side panels 72–75% up, the bottom
  panel 60% up, so full faces show in the hero and sides and the bottom
  panel keeps hat, eyes and nose above the title band. Crops are clamped so
  a panel can never go empty.
- **Title block** — a badge ribbon that always sits above the title (never
  over it), a big condensed Anton title with a gradient fill, outline and
  shadow, and a Pacifico script subtitle.
- **Hold to compare** — hold `C` (or the Compare button) to see the photos
  without the grade.
- **Fully offline** — no network requests, no upload, no watermark. Your
  photos never leave your machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` directly in desktop Chrome.

## Keyboard shortcuts

| Key | Action |
| --- | ------ |
| `1`–`4` | Switch layout |
| `G` | Cycle grade |
| `F` | Fill / fit the selected panel |
| `R` | Reset the selected panel crop |
| `S` | Shuffle all crops |
| `E` | Export PNG |
| `C` (hold) | Compare without the grade |
| `+` / `−`, arrow keys | Zoom / nudge the crop |

## How it is built

- `app/index.html` + `app/style.css` — the editor shell and its dark neon theme.
- `app/src/cover.js` — the cover engine: layouts, look-up crop math, grades,
  grain, vignette and the title block. Pure canvas 2D.
- `app/src/main.js` — the editor: state, uploads, drag-pan / wheel-zoom,
  keyboard shortcuts and the PNG export.
- `app/src/shots.js` — the fixed `?shot=` scenes used for screenshots and
  for verifying the export path.
- `app/fonts/` — Anton and Pacifico, bundled as TTFs under the SIL Open Font
  License (`OFL-Anton.txt`, `OFL-Pacifico.txt`).
- `app/samples/` — the two bundled sample photos (boulevard, pier).
- `main.ts` — the entrypoint (Node 22, standard library only): copies `app/`
  and `screenshots/` to the output directory and writes `dossier.json`.
- `serve.ts` — a tiny static server for local testing.
- `shots.json` — the screenshot scenes.

## Handing in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` checks the competition's caps first (at most 4 screenshots, each
at most 256 KiB; `app/` at most 993 files and 48 MiB) and refuses to hand in
a repo that would be refused by the scorer.

## Notes

- No Rockstar Games logo, artwork or font is used anywhere in this project.
- The sample photos are the kit's bundled samples, free to use.
- License: MIT — see [LICENSE](LICENSE).

## Screenshots

The cover and the editor, generated deterministically from the `?shot=`
scenes in `shots.json` (see `scripts/shots.mjs`).
