import type { Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { PointGrid } from './grid.ts'

export function penLength(points: Float32Array): number {
  let length = 0
  for (let i = 2; i < points.length; i += 2) length += Math.hypot(points[i]! - points[i - 2]!, points[i + 1]! - points[i - 1]!)
  return length
}

export function nearestTour(points: Float32Array, width: number, height: number): Float32Array {
  const n = points.length / 2, result = new Float32Array(points.length)
  if (!n) return result
  const grid = new PointGrid(points, width, height, Math.max(2, Math.sqrt(width * height / n) * 2))
  for (let i = 0; i < n; i++) grid.add(i)
  const visited = new Uint8Array(n), allowed = (id: number) => !visited[id]
  let x = 0, y = 0
  for (let i = 0; i < n; i++) {
    const id = grid.nearest(x, y, allowed)
    visited[id] = 1
    x = points[2 * id]!; y = points[2 * id + 1]!
    result[2 * i] = x; result[2 * i + 1] = y
  }
  return result
}

/** Open-path 2-opt; only strictly shorter replacements are committed. */
export function improveTour(points: Float32Array, budget: number, rng: () => number, progress?: Progress): Float32Array {
  const p = points.slice(), n = p.length / 2
  if (n < 4) return p
  const distance = (a: number, b: number) => Math.hypot(p[2 * a]! - p[2 * b]!, p[2 * a + 1]! - p[2 * b + 1]!)
  for (let attempt = 0; attempt < budget; attempt++) {
    let i = 1 + Math.floor(rng() * (n - 2))
    let j = attempt % 2 === 0 ? Math.min(n - 2, i + 1 + Math.floor(rng() * 48)) : 1 + Math.floor(rng() * (n - 2))
    if (i > j) [i, j] = [j, i]
    if (i !== j && distance(i - 1, j) + distance(i, j + 1) < distance(i - 1, i) + distance(j, j + 1) - 1e-9) {
      for (let a = i, b = j; a < b; a++, b--) {
        const x = p[2 * a]!, y = p[2 * a + 1]!
        p[2 * a] = p[2 * b]!; p[2 * a + 1] = p[2 * b + 1]!
        p[2 * b] = x; p[2 * b + 1] = y
      }
    }
    if ((attempt & 8191) === 0) progress?.('Optimising path', attempt / Math.max(1, budget), [{ points: p.slice(), width: 0.8 }])
  }
  progress?.('Optimising path', 1)
  return p
}

export function orderStrokes(strokes: Stroke[], width: number, height: number): Stroke[] {
  if (strokes.length < 2) return strokes
  const ends = new Float32Array(strokes.length * 4)
  strokes.forEach((s, i) => {
    ends[4 * i] = s.points[0]!; ends[4 * i + 1] = s.points[1]!
    ends[4 * i + 2] = s.points[s.points.length - 2]!; ends[4 * i + 3] = s.points[s.points.length - 1]!
  })
  const grid = new PointGrid(ends, width, height, Math.max(2, Math.sqrt(width * height / strokes.length) * 2))
  for (let i = 0; i < ends.length / 2; i++) grid.add(i)
  const visited = new Uint8Array(strokes.length), ordered: Stroke[] = []
  const allowed = (id: number) => !visited[id >>> 1]
  let x = 0, y = 0
  for (let i = 0; i < strokes.length; i++) {
    const endpoint = grid.nearest(x, y, allowed), id = endpoint >>> 1, stroke = strokes[id]!
    visited[id] = 1
    let points = stroke.points
    if (endpoint % 2) {
      points = new Float32Array(points.length)
      for (let j = 0; j < points.length; j += 2) {
        points[j] = stroke.points[points.length - j - 2]!
        points[j + 1] = stroke.points[points.length - j - 1]!
      }
    }
    ordered.push({ points, width: stroke.width })
    x = points[points.length - 2]!; y = points[points.length - 1]!
  }
  return ordered
}
