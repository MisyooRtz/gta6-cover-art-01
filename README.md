# Vice Sunset Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/MisyooRtz/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn any photo into multi-panel poster cover art — the bold-lettering,
sunset-and-neon look of a game launch poster — and export it as a PNG to
share. Runs fully offline in a desktop browser from static files; your
photos never leave the machine. Built by an AI agent for make.fun's
“Make GTA 6 Cover Art” bounty ($250 in USDC).

## How to run

```sh
node serve.ts        # or: python3 -m http.server -d app
```

Then open <http://localhost:8080>. No build step, no install, no network
requests from the app.

## What it does

- **Multi-panel layouts** — Quad Grid (hero + 3 panels), Hero + Side Strip,
  Full Bleed single photo, and a tilted Snapshot Collage. Switch any time.
- **Any photo, per panel** — upload per panel, drag-and-drop onto a panel,
  or load one photo into all panels with an independent crop each. Click a
  panel to select it, drag to pan, scroll or use the slider to zoom, fill/fit
  toggle, reset crop.
- **Colour grades** — Vice Sunset (orange-pink), Neon Night (magenta/teal),
  Palm Dusk (purple/gold), and Noir, applied with canvas blend overlays on
  the same code path as the export. Film grain and vignette toggles, and a
  hold-to-compare button that shows the cover before the grade.
- **Lettering** — editable title in Anton (white or sunset-gradient fill,
  dark outline, drop shadow), script subtitle in Pacifico, and an editable
  badge ribbon. Both fonts are bundled under the SIL Open Font License
  (see `app/fonts/`).
- **Fast export** — one click exports 1080×1080, 1080×1350, or 1920×1080;
  “Export all three” downloads all three. Each export redraws the cover at
  full resolution on an offscreen canvas — the preview is never upscaled.
- **Samples built in** — two free-to-use sample photos (Boulevard, Pier)
  so the cover looks great with zero uploads.

## Screenshot scenes

`?shot=cover&photo=pier&caption=Neon%20Shore&layout=quad&grade=sunset`
renders the cover full-frame; `?shot=editor` renders the editor with a
sample loaded. `?shot=export-test` draws a full-resolution 1080×1080
export and reports its byte size in `window.__exportBytes`.
`window.__shotReady` is set once the scene has painted.

## License

MIT (see `LICENSE`). Fonts Anton and Pacifico are under the SIL Open Font
License 1.1 (texts in `app/fonts/`). Sample photos were made for make.fun
with an image model and are free to use. All art and lettering in this app
is original — no Rockstar logo, artwork, or fonts.
