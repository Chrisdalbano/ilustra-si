# Illustration engine

Implemented all five styles in small, dependency-free TypeScript modules under `lib/`. `lib/types.ts` is unchanged. `lib/index.ts` exports the exact contract (`STYLES`, `defaults`, `render`, `toSVG`, `demoRaster`) and re-exports its types. No `app/` files were changed.

- **Stipple:** seeded rejection sampling, with an inverse-CDF fallback for sparse images; discrete weighted Voronoi cells found by exact spatial-grid nearest search; density-weighted Lloyd centroids. Squared darkness is the density weight. Quadrature is capped at 160 pixels along the longest edge; output stays in the original raster coordinates. Dots optionally vary with tone.
- **One line:** stipple points, spatial-grid nearest-neighbour open tour, then seeded 2-opt. The budget is `effort × pointCount × 100` candidate moves. Only shorter replacements are accepted. A nonblank source produces exactly one continuous stroke.
- **Hatch:** layered tone thresholds, rotated scanlines, smooth seeded wobble, and bisection of run boundaries against both the image rectangle and threshold. Default angles are 45, -45, 0, and 90 degrees.
- **Contour:** Gaussian-smoothed Sobel gradients, perpendicular midpoint-integrated streamlines, direction smoothing, a spacing grid, and Jobard-Lefer style side seeding plus fallback seeds for disconnected regions. Separation increases in lighter regions. Flat areas use a horizontal flow.
- **Scribble:** a tone-weighted anchor tour carrying one continuous loop path. Dark areas increase loop radius and slow the centre's motion, increasing ink density.

Raster helpers include Mulberry32 randomness, bilinear sampling with clamped borders, separable Gaussian blur, Sobel gradients, and contrast/gamma adjustment. The seeded 480×480 demo is an analytically shaded sphere, soft cast shadow, and gradient ground.

Independent strokes are ordered nearest-next, optionally reversed, to reduce pen-up travel. Statistics count drawing points and centreline pen-down distance; pen-up travel is excluded. Dots count as 0.01-unit segments, matching SVG export. `stats.ms` is elapsed render time, so it is intentionally excluded from determinism comparisons. Coordinates are in raster units, within `[0, width - 1] × [0, height - 1]`.

## UI integration

Use `STYLES[style].options` to build sliders, and `defaults(style)` for a fresh options object. Keys are:

| Style | Options |
| --- | --- |
| stipple | `pointCount`, `iterations`, `dotSize`, `varySize` (0/1), `contrast` |
| oneline | `pointCount`, `effort`, `lineWidth` |
| hatch | `spacing`, `layers`, `wobble`, `baseAngle` (degrees) |
| contour | `spacing`, `length` (raster units), `smoothing` (0–1) |
| scribble | `turns`, `loopSize`, `jitter` (0–1) |

Missing/nonfinite option values use defaults; out-of-range values are clamped. Invalid raster dimensions, nonfinite/out-of-range pixels, unknown styles, and nonfinite seeds throw descriptive errors. Inputs are not mutated. Seed state uses the low 32 bits.

Synchronous usage, from a module in the repository root:

```ts
import { defaults, demoRaster, render, toSVG } from './lib/index'

const illustration = render({
  raster: demoRaster(42), style: 'oneline',
  seed: 42, options: defaults('oneline'),
}, (phase, ratio, preview) => {
  // ratio is monotonic 0..1; preview is an optional partial stroke list.
})
const svg = toSVG(illustration, { ink: '#24211d', paper: '#faf7ef' })
```

For interactive work, create the worker client-side (e.g. inside `onMounted`). Example paths below assume an `app/components/` component:

```ts
import { defaults, demoRaster } from '../../lib/index'
import type { RenderRequest, WorkerMessage } from '../../lib/types'

const worker = new Worker(new URL('../../lib/worker.ts', import.meta.url), { type: 'module' })
worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  if (data.type === 'progress') { /* display phase, ratio, optional preview */ }
  if (data.type === 'done') { /* replay data.illustration.strokes and offer toSVG export */ }
  if (data.type === 'error') { /* display data.message */ }
}
const source = demoRaster(42)
const raster = { ...source, values: source.values.slice() } // retain the source for later edits
const request: RenderRequest = { raster, style: 'oneline', options: defaults('oneline'), seed: 42 }
worker.postMessage(request, [raster.values.buffer])
// Terminate on component cleanup, or to cancel a render before starting another.
```

The worker throttles intermediate progress to one message per 50 ms and always sends completion. It transfers snapshot preview buffers and the final stroke buffers. The core is synchronous; queued worker requests are processed serially. There are no request IDs or cooperative cancellation in the existing contract: terminate/recreate the worker to cancel stale work. `onProgress` consumers should treat previews as read-only.

## Validation and timings

Commands:

```sh
npm test
npx tsc -p lib/tsconfig.json
node scripts/benchmark.mjs
npm run meta
npx nuxt generate
```

All **35 Vitest tests passed**, covering per-style geometry determinism, input preservation, bounded finite coordinates, white/tiny/rectangular images, coherent statistics, monotonic progress, darker-versus-lighter ink coverage (at least 1.4× on a two-tone fixture for each style), single-stroke output, non-lengthening 2-opt, nearest-search correctness, raster helpers, XML parsing, and transfer detachment/throttling. Each style also has a 4,000 ms default-render assertion at 480×480. The only new dependency is the development-only XML parser `@xmldom/xmldom`.

Measured on 2026-10-05 with Node v22.19.0, Windows x64, AMD Ryzen 7 7800X3D. Three consecutive default renders of `demoRaster(42)` with seed 42, including stroke ordering; first run retained rather than discarded:

| Style | Run 1 | Run 2 | Run 3 | Strokes | Points |
| --- | ---: | ---: | ---: | ---: | ---: |
| stipple | 56 ms | 42 ms | 31 ms | 1,800 | 1,800 |
| oneline | 82 ms | 77 ms | 77 ms | 1 | 1,600 |
| hatch | 39 ms | 31 ms | 25 ms | 290 | 42,569 |
| contour | 44 ms | 36 ms | 30 ms | 209 | 5,958 |
| scribble | 22 ms | 18 ms | 18 ms | 1 | 16,801 |

These are desktop measurements, **not a claimed mid-laptop/browser measurement**. There is substantial headroom under four seconds, but benchmark the target browser/device before making a hardware-specific promise. Timings exclude raster upload/downsampling, worker messaging, SVG serialization, and UI replay.

Library strict type-checking, metadata generation, and Nuxt static generation passed. Nuxt emitted nonfatal existing dependency-resolution/unused-import warnings during prerendering. Browser visual inspection was unavailable because this session had no connected browser; XML validity and plotter-compatible SVG structure are covered by tests, but no physical plotter was tested.

## Metadata and deployment

`npm run meta` writes `public/llms.txt`, `robots.txt`, `sitemap.xml`, and the deterministic one-line `demo.svg`. The script uses the already-installed Vite loader only at build time; the illustration core has no runtime imports outside `lib/`. The demo SVG is a social-preview **source**; platforms requiring a raster social image will need a separate PNG conversion.

`.github/workflows/pages.yml` runs install, metadata generation, tests, library type-checking, and Nuxt generation on pushes to `main`, then uses the official configure/upload/deploy Pages actions. GitHub Pages must be configured to use GitHub Actions. `public/CNAME` and canonical metadata target `ilustra.si`. Nothing was deployed or pushed during this task.

Root changes are limited to this requested document, the requested `meta` npm script, and the development test dependency plus lockfile. The public function contract needed no changes.

## Known limits

- Render geometry is deterministic for a fixed request in the same JS environment. Floating-point transcendental functions can have tiny cross-engine differences.
- Fully white input returns no strokes, including for the continuous styles; drawing an arbitrary line would put ink on blank paper. Fixed point counts preserve relative tone within an image, rather than calibrating absolute darkness across different uniformly coloured images.
- The reduced Lloyd quadrature can miss very fine features. The engine is designed for downscaled rasters around 480×480; extreme sizes/options are not subject to the default timing guarantee.
- Flow lines follow image isophotes, not inferred 3D anatomy. Flat gradients use the fallback direction; strong noise benefits from smoothing. Scribble loops and one-line connections can cross bright gaps between dark regions to maintain continuity.
- SVG uses only explicit geometry/presentation attributes and rounds numbers to two decimals. No transforms, CSS, fills on strokes, or hidden pen-travel paths. Tiny dots use 0.01-unit round-capped segments. Units are SVG user units (normally pixels); choose physical scale and pen thickness in the plotter software. Round caps may extend half a stroke width beyond the coordinate bounds.
