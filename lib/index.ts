import type { Illustration, RenderRequest, Stroke, StyleId } from './types.ts'
import { STYLES, optionsFor } from './styles.ts'
import type { Progress } from './styles.ts'
import { random } from './raster.ts'
import { stipple } from './stipple.ts'
import { oneline } from './oneline.ts'
import { hatch } from './hatch.ts'
import { contour } from './contour.ts'
import { scribble } from './scribble.ts'
import { orderStrokes, penLength } from './routing.ts'

export type * from './types.ts'
export { STYLES, defaults } from './styles.ts'
export { demoRaster } from './raster.ts'
export { toSVG } from './svg.ts'

const algorithms = { stipple, oneline, hatch, contour, scribble }

export function render(req: RenderRequest, onProgress?: (phase: string, ratio: number, preview?: Stroke[]) => void): Illustration {
  const start = performance.now(), { raster, style, seed } = req
  if (!Object.hasOwn(STYLES, style)) throw new Error(`Unknown illustration style: ${style}`)
  if (!Number.isInteger(raster.width) || !Number.isInteger(raster.height) || raster.width < 1 || raster.height < 1 ||
    !(raster.values instanceof Float32Array) || raster.values.length !== raster.width * raster.height) {
    throw new Error('Raster must have positive integer dimensions and a matching Float32Array')
  }
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite')
  for (const v of raster.values) if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error('Raster values must be finite and in 0..1')
  let previous = 0
  const progress: Progress = (phase, ratio, preview) => {
    previous = Math.max(previous, Math.min(0.98, ratio * 0.98))
    onProgress?.(phase, previous, preview)
  }
  progress('Preparing raster', 0)
  const raw = algorithms[style as StyleId](raster, optionsFor(style, req.options), random(seed), progress)
  progress('Ordering strokes', 0.99)
  const strokes = orderStrokes(raw, raster.width, raster.height)
  let points = 0, length = 0
  for (const stroke of strokes) {
    points += stroke.points.length / 2
    length += stroke.points.length === 2 ? 0.01 : penLength(stroke.points)
  }
  const illustration: Illustration = {
    width: raster.width, height: raster.height, style, seed, strokes,
    stats: { strokes: strokes.length, points, penLength: length, ms: performance.now() - start },
  }
  onProgress?.('Done', 1)
  return illustration
}
