// ilustra.si — the contract between the illustration algorithms (lib/) and the UI (app/).
// A photo goes in, pen strokes come out. No ML model, no network: everything
// runs in the browser, inside a Web Worker, and is deterministic for a given
// (image, style, options, seed).

export type StyleId =
  | 'stipple' // weighted Voronoi stippling (Lloyd relaxation)
  | 'oneline' // a single continuous line through the stipples (TSP: greedy + 2-opt)
  | 'hatch' // cross-hatching that follows tone, layered by darkness
  | 'contour' // flow-field strokes following image gradients
  | 'scribble' // one looping scribble whose density follows tone

export interface StyleDef {
  id: StyleId
  name: string
  blurb: string // one line, plain
  /** Option definitions the UI renders as sliders. */
  options: OptionDef[]
}

export interface OptionDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
}

/** Greyscale source, already downscaled by the UI. values[i] in 0..1, 0 = black. */
export interface Raster {
  width: number
  height: number
  values: Float32Array
}

/** A polyline in output units (same coordinate space as the Raster). */
export interface Stroke {
  /** Flat [x0, y0, x1, y1, ...]. A single point (length 2) is a dot. */
  points: Float32Array
  /** Stroke width in output units. */
  width: number
}

export interface Illustration {
  width: number
  height: number
  style: StyleId
  seed: number
  /** In drawing order, so the UI can replay the pen. */
  strokes: Stroke[]
  stats: { strokes: number; points: number; penLength: number; ms: number }
}

export interface RenderRequest {
  raster: Raster
  style: StyleId
  options: Record<string, number>
  seed: number
}

/** Messages the worker posts back. */
export type WorkerMessage =
  | { type: 'progress'; phase: string; ratio: number; preview?: Stroke[] }
  | { type: 'done'; illustration: Illustration }
  | { type: 'error'; message: string }

// ---- Functions lib/index.ts must export -----------------------------------
//
// STYLES: Record<StyleId, StyleDef>
// render(req: RenderRequest, onProgress?: (phase: string, ratio: number, preview?: Stroke[]) => void): Illustration
//        pure and synchronous; lib/worker.ts wraps it with the WorkerMessage protocol
// toSVG(ill: Illustration, opts?: { ink?: string; paper?: string | null }): string
//        compact, plotter-friendly SVG (one <path> per stroke, no transforms)
// defaults(style: StyleId): Record<string, number>
// demoRaster(seed: number): Raster   // a procedural test image so the site can draw before any upload
