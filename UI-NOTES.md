# UI notes

The single-page UI for ilustra.si. Everything lives in `app/`, plus head/meta in `nuxt.config.ts` and two static files in `public/` (`og.png`, `favicon.svg`). Nothing in `lib/`, `tests/` or `scripts/` was changed.

## What's there

- `app/pages/index.vue`: holds the page state and wiring: source photo, raster, style, per-style options, seed, detail, palette, render requests, drag/drop/paste, and exports.
- `app/composables/useRenderer.ts`: runs the Web Worker (`new Worker(new URL('../../lib/worker.ts', import.meta.url), { type: 'module' })`). A request that arrives while a render is still running terminates the worker and spawns a fresh one, so stale renders never finish. Phase, ratio and error are reactive. Previews are passed through.
- `app/composables/usePlotter.ts`: the replay engine. Each stroke gets a time slot. Slot length is `length^0.62`, so long strokes move faster per pixel. There's a pen-up gap before every stroke that scales with √travel, and gaps get 6–30 % of the total. Inside a stroke the speed profile is trapezoidal (up to 0.3 s to accelerate and to settle), and time along the stroke is weighted by √(segment length), so long sweeps go quickly and dense detail gets time. Total is about 14 s at 1×, plus a little for very many strokes, capped at 20 s. Drawing forward only strokes the new ink since the last frame onto one persistent canvas. Seeking backwards repaints once, batching finished strokes by width. The nib is a DOM element moved with `transform`; it lifts (ring grows, tip fades) during pen-up travel and fades out at the end.
- `app/components/StageView.vue`: the desk, the paper sheet (aspect follows the raster, faint paper tooth), the canvas, the nib, the progress hairline, and the compare overlay.
- `app/components/ReplayBar.vue`: play/pause, scrubber, clock, 0.5/1/2/4× speed, "Skip to end", and "Hold to compare" (pointer or Space/Enter held).
- `app/components/ControlPanel.vue`: choose a photo, take a photo (shown only on coarse pointers, `capture="environment"`), back to demo, the privacy sentence, detail (240–960 px longest side, default 480), sliders generated from `STYLES[style].options` (0/1 options read on/off), seed plus Reroll, and four ink/paper pairs.
- `app/components/HowItWorks.vue`: two plain sentences per algorithm, the plotter-ready line, and a link to `/llms.txt`.
- `app/utils/ink.ts`: palettes, batched stroke tracing, image to greyscale raster (Rec. 709 luma, transparent pixels as white, `0 = black`), raster to canvas, and a download helper.

Behaviour decisions:

- On load the built-in `demoRaster(42)` goes through the same path as an uploaded photo and replays in the one-line style. 42 matches the seed of `public/demo.svg`.
- A new photo or a style change replays. Slider, seed, detail or palette tweaks are debounced (220 ms) and show the finished drawing straight away, so tuning doesn't mean waiting 14 s each time. Play replays it.
- With `prefers-reduced-motion: reduce`, every render lands on the finished drawing. Play still works if the visitor asks for it.
- "White on black" is the one light-ink palette. A white pen belongs where the photo is bright, so for that palette the UI feeds the engine `1 - value`. Otherwise it draws a photographic negative. The compare view still shows the original photo.
- SVG export and Copy SVG use `toSVG(ill, { ink, paper: null })`. There's no background rect, because a plotter would trace its outline. The PNG exports (2× and 4× of raster size) do include the paper colour.
- The compare overlay shows the uploaded photo in greyscale (CSS filter), or the demo raster. Both share the sheet's exact aspect, so they line up.
- Head: title, description, canonical `https://ilustra.si/`, Open Graph and Twitter card tags (`summary_large_image`), JSON-LD `WebApplication`, `theme-color #f3f0e8`, SVG favicon.

## OG image

`public/og.png` is a 1200×630 PNG. It was rendered from the engine's own output: `demoRaster(42)` drawn in one line, hatch and contour, serialised with `toSVG`, laid out in an HTML page with the brand tokens and Inter, then screenshotted with headless Chrome. The script was a one-off in a scratch directory and isn't in the repo, because `scripts/` is outside my scope. To regenerate it, repeat that process; `scripts/build-meta.mjs` shows how to load `lib/` through Vite in Node. The CI step `npm run meta` does not touch `og.png` or `favicon.svg`.

## Verified

- `npm.cmd test`: 35/35 pass.
- `npx.cmd nuxt typecheck`: clean, exit 0. A deliberate type error was added and removed again to confirm vue-tsc really checks `app/`.
- `npx.cmd nuxt generate`: succeeds. Prerendered `/` contains the h1, How it works, OG/Twitter/theme-color/canonical/JSON-LD. The worker is emitted as `_nuxt/worker-<hash>.js`, a self-contained 13 kB chunk with no imports, and the page chunk references it via `new Worker(new URL("worker-<hash>.js", import.meta.url), ...)`.
- In the built site, served locally:
  - Headless Chrome over the DevTools protocol: the demo starts drawing on load with no input, the clock advances in real time (0:01, 0:03, 0:07, then 0:14 and stopped), the frames show the line building up with the nib on it, and there are no console errors or exceptions. With `prefers-reduced-motion: reduce` emulated, the page shows the finished drawing at 0:14 straight away.
  - Real Chrome: all five styles render, mid-replay seeking draws correctly, palettes switch, and the inverted white-on-black works. The photo-picker path was tested with a synthetic 900×600 JPEG through the file input: the 3:2 aspect is respected and "Back to demo" appears. Hold-to-compare shows the source. With the download click intercepted, the exports produced an SVG (21 kB), a 2× PNG (428 kB) and a 4× PNG (1.0 MB). The nib hides at the end.
  - At 390 px wide (iframe in headless Chrome) the layout stacks to one column with no horizontal overflow.

## Not verified

- **Watching the replay live at 60 fps in a visible window.** The connected Chrome tab reported `visibilityState: hidden`, so requestAnimationFrame was throttled there. Real-time playback was confirmed in headless Chrome instead. The look of the motion (nib, pacing, beats) still needs a human eye, ideally while recording the 15-second clip.
- **Smoothness on a 40k-point drawing on a mid-range phone.** The design handles it, since each frame only draws new segments, but it was only exercised on a desktop.
- **Drag-and-drop and clipboard paste with real OS events.** The handlers exist, but only the file-input path was tested end to end. Camera capture needs a phone.
- **Copy SVG.** `navigator.clipboard.writeText` wasn't exercised, because a hidden tab blocks the clipboard.
- **Whether the worker sends previews for each style.** Previews are drawn at 35 % opacity when they arrive.
- **HEIC from iOS.** It relies on Safari converting to JPEG on pick, which it normally does.

## Logic notes (no lib bugs found)

- No real bugs in `lib/` turned up while wiring it.
- `stats.penLength` is in raster units, which become SVG user units/px. The UI labels it "px of pen".
- Option values like hatch/contour spacing are in raster units, so the Detail slider changes how dense the drawing is, not only its resolution. That's intended and it's why the control is called "Detail".
