import type { Raster, Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { stipplePoints } from './stipple.ts'
import { improveTour, nearestTour } from './routing.ts'

export function oneline(r: Raster, o: Record<string, number>, rng: () => number, progress: Progress): Stroke[] {
  const points = stipplePoints(r, o.pointCount!, 4, 1, rng, (phase, ratio, preview) => progress(phase, ratio * 0.45, preview))
  if (!points.length) return []
  const tour = nearestTour(points, r.width, r.height)
  progress('Joining points', 0.5, [{ points: tour.slice(), width: o.lineWidth! }])
  const improved = improveTour(tour, Math.round(o.effort! * o.pointCount! * 100), rng,
    (phase, ratio, preview) => progress(phase, 0.5 + ratio * 0.45, preview?.map(s => ({ ...s, width: o.lineWidth! }))))
  return [{ points: improved, width: o.lineWidth! }]
}
