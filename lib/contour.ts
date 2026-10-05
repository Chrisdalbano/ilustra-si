import type { Raster, Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { gaussianBlur, sample, sobel } from './raster.ts'
import { PointGrid } from './grid.ts'

export function contour(r: Raster, o: Record<string, number>, rng: () => number, progress: Progress): Stroke[] {
  const smooth = gaussianBlur(r, 0.6 + o.smoothing! * 2.4), field = sobel(smooth)
  const spacing = o.spacing!, step = Math.min(2, spacing / 3), strokes: Stroke[] = []
  const capacity = Math.ceil(r.width * r.height / (step * step) * 4) + 100
  const placed = new Float32Array(capacity * 2), grid = new PointGrid(placed, r.width, r.height, spacing)
  let used = 0
  const seeds: number[] = []
  const tone = (x: number, y: number) => 1 - sample(smooth, x, y)
  const separation = (x: number, y: number) => spacing / Math.sqrt(Math.max(0.04, tone(x, y)))
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= r.width - 1 && y <= r.height - 1
  const direction = (x: number, y: number, dx: number, dy: number): [number, number] => {
    let vx = -sample(field.y, x, y), vy = sample(field.x, x, y)
    const norm = Math.hypot(vx, vy)
    if (norm < 0.0001) return dx || dy ? [dx, dy] : [1, 0]
    vx /= norm; vy /= norm
    if (vx * dx + vy * dy < 0) { vx = -vx; vy = -vy }
    const blend = o.smoothing! * 0.75
    vx = vx * (1 - blend) + dx * blend; vy = vy * (1 - blend) + dy * blend
    const length = Math.hypot(vx, vy)
    return [vx / length, vy / length]
  }
  // Jittered fallback seeds fill disconnected tone islands. Accepted paths also
  // seed both sides at the local separation (Jobard-Lefer style propagation).
  for (let y = 0; y < r.height; y += spacing * 1.5) for (let x = 0; x < r.width; x += spacing * 1.5) {
    const px = Math.min(r.width - 1, x + rng() * spacing), py = Math.min(r.height - 1, y + rng() * spacing)
    if (rng() < tone(px, py)) seeds.push(px, py)
  }
  const maxSteps = Math.ceil(o.length! / (2 * step))
  function trace(x: number, y: number, sign: number): number[] {
    const path: number[] = []
    let [dx, dy] = direction(x, y, 0, 0)
    dx *= sign; dy *= sign
    for (let k = 0; k < maxSteps; k++) {
      const [vx, vy] = direction(x + dx * step / 2, y + dy * step / 2, dx, dy)
      const px = x + vx * step, py = y + vy * step
      if (!inside(px, py) || tone(px, py) < 0.04 || grid.near(px, py, separation(px, py) * 0.85)) break
      let loop = false
      for (let j = 0; j < path.length - 12; j += 2) if (Math.hypot(path[j]! - px, path[j + 1]! - py) < step * 1.2) { loop = true; break }
      if (loop) break
      path.push(px, py); x = px; y = py; dx = vx; dy = vy
    }
    return path
  }
  const seedLimit = Math.max(seeds.length, Math.ceil(r.width * r.height / (spacing * spacing)) * 32)
  for (let s = 0; s < seeds.length && s < seedLimit; s += 2) {
    const x = seeds[s]!, y = seeds[s + 1]!
    if (!inside(x, y) || tone(x, y) < 0.04 || grid.near(x, y, separation(x, y))) continue
    const back = trace(x, y, -1), forward = trace(x, y, 1), path: number[] = []
    for (let i = back.length - 2; i >= 0; i -= 2) path.push(back[i]!, back[i + 1]!)
    path.push(x, y, ...forward)
    if (path.length < 6 || used + path.length / 2 >= capacity) continue
    const points = new Float32Array(path)
    strokes.push({ points, width: 0.8 })
    for (let i = 0; i < points.length; i += 2) {
      placed[2 * used] = points[i]!; placed[2 * used + 1] = points[i + 1]!
      grid.add(used++)
      if (i % 12 === 0 && seeds.length < seedLimit) {
        const [dx, dy] = direction(points[i]!, points[i + 1]!, 0, 0), sep = separation(points[i]!, points[i + 1]!) * 1.1
        seeds.push(points[i]! - dy * sep, points[i + 1]! + dx * sep, points[i]! + dy * sep, points[i + 1]! - dx * sep)
      }
    }
    if (strokes.length % 32 === 0) progress('Tracing flow field', 0.1 + 0.8 * s / seedLimit, strokes.slice())
  }
  progress('Tracing flow field', 0.95, strokes.slice())
  return strokes
}
