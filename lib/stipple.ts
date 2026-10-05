import type { Raster, Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { clamp, curve, sample } from './raster.ts'
import { PointGrid } from './grid.ts'

/** Discrete, density-weighted Lloyd relaxation on a bounded quadrature grid. */
export function stipplePoints(r: Raster, count: number, iterations: number, contrast: number, rng: () => number, progress: Progress): Float32Array {
  const scale = Math.min(1, 160 / Math.max(r.width, r.height))
  const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale))
  const sx = (r.width - 1) / Math.max(1, w - 1), sy = (r.height - 1) / Math.max(1, h - 1)
  const density = new Float32Array(w * h), cdf = new Float64Array(w * h)
  let mass = 0, peak = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (1 - curve(sample(r, x * sx, y * sy), contrast)) ** 2
    density[y * w + x] = d
    cdf[y * w + x] = mass += d
    peak = Math.max(peak, d)
  }
  if (mass === 0) return new Float32Array()
  const points = new Float32Array(count * 2)
  let n = 0
  for (let attempt = 0; n < count && attempt < count * 64; attempt++) {
    const x = rng() * (r.width - 1), y = rng() * (r.height - 1)
    if (rng() * peak >= (1 - curve(sample(r, x, y), contrast)) ** 2) continue
    points[2 * n] = x; points[2 * n + 1] = y; n++
  }
  // Sparse images can defeat rejection sampling. Inverse-CDF sampling bounds its cost.
  while (n < count) {
    const target = rng() * mass
    let lo = 0, hi = cdf.length - 1
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (cdf[mid]! <= target) lo = mid + 1; else hi = mid }
    points[2 * n] = clamp((lo % w + rng() - 0.5) * sx, 0, r.width - 1)
    points[2 * n + 1] = clamp((Math.floor(lo / w) + rng() - 0.5) * sy, 0, r.height - 1)
    n++
  }
  progress('Seeding points', 0.15)
  const mx = new Float64Array(count), my = new Float64Array(count), weights = new Float64Array(count)
  for (let iteration = 0; iteration < iterations; iteration++) {
    const grid = new PointGrid(points, r.width, r.height, Math.max(2, Math.sqrt(r.width * r.height / count) * 2))
    for (let i = 0; i < count; i++) grid.add(i)
    mx.fill(0); my.fill(0); weights.fill(0)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const weight = density[y * w + x]!
      if (weight === 0) continue
      const px = x * sx, py = y * sy, id = grid.nearest(px, py)
      mx[id]! += px * weight; my[id]! += py * weight; weights[id]! += weight
    }
    for (let i = 0; i < count; i++) if (weights[i]! > 0) {
      points[2 * i] = mx[i]! / weights[i]!
      points[2 * i + 1] = my[i]! / weights[i]!
    }
    const preview: Stroke[] = []
    for (let i = 0; i < count; i++) preview.push({ points: points.slice(2 * i, 2 * i + 2), width: 1 })
    progress('Relaxing Voronoi cells', 0.15 + 0.8 * (iteration + 1) / Math.max(1, iterations), preview)
  }
  return points
}

export function stipple(r: Raster, o: Record<string, number>, rng: () => number, progress: Progress): Stroke[] {
  const points = stipplePoints(r, o.pointCount!, o.iterations!, o.contrast!, rng, progress)
  const strokes: Stroke[] = []
  for (let i = 0; i < points.length; i += 2) {
    const tone = 1 - curve(sample(r, points[i]!, points[i + 1]!), o.contrast!)
    strokes.push({ points: points.slice(i, i + 2), width: o.dotSize! * (o.varySize ? 0.35 + 0.9 * tone : 1) })
  }
  return strokes
}
