import type { Raster, Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { clamp, sample } from './raster.ts'
import { stipplePoints } from './stipple.ts'
import { improveTour, nearestTour } from './routing.ts'

export function scribble(r: Raster, o: Record<string, number>, rng: () => number, progress: Progress): Stroke[] {
  const anchors = stipplePoints(r, Math.min(450, Math.max(50, Math.round(o.turns! / 4))), 2, 1, rng,
    (phase, ratio) => progress(phase, ratio * 0.2))
  if (!anchors.length) return []
  const tour = improveTour(nearestTour(anchors, r.width, r.height), anchors.length * 30, rng)
  const n = tour.length / 2, times = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    const x = tour[2 * i]!, y = tour[2 * i + 1]!, px = tour[2 * i - 2]!, py = tour[2 * i - 1]!
    const darkness = 1 - sample(r, (x + px) / 2, (y + py) / 2)
    times[i] = times[i - 1]! + Math.hypot(x - px, y - py) * (0.15 + 2 * darkness)
  }
  const samples = Math.round(o.turns!) * 12, points = new Float32Array((samples + 1) * 2)
  const phase = rng() * Math.PI * 2
  let segment = 1
  for (let i = 0; i <= samples; i++) {
    const time = times[n - 1]! * i / samples
    while (segment < n - 1 && times[segment]! < time) segment++
    const fraction = (time - times[segment - 1]!) / Math.max(1e-12, times[segment]! - times[segment - 1]!)
    const cx = tour[2 * segment - 2]! * (1 - fraction) + tour[2 * segment]! * fraction
    const cy = tour[2 * segment - 1]! * (1 - fraction) + tour[2 * segment + 1]! * fraction
    const darkness = 1 - sample(r, cx, cy), angle = i / 12 * Math.PI * 2 + phase
    const radius = o.loopSize! * (0.3 + 0.7 * darkness) * (1 + o.jitter! * 0.45 * Math.sin(angle * 0.173 + phase))
    const wobble = o.jitter! * Math.sin(angle * 0.37 + phase)
    points[2 * i] = clamp(cx + radius * Math.cos(angle + wobble), 0, r.width - 1)
    points[2 * i + 1] = clamp(cy + radius * Math.sin(angle), 0, r.height - 1)
    if (i % 2400 === 0) progress('Looping scribble', 0.25 + 0.7 * i / samples,
      i ? [{ points: points.slice(0, 2 * i + 2), width: 0.65 }] : undefined)
  }
  return [{ points, width: 0.65 }]
}
