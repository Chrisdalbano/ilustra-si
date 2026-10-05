import type { Raster, Stroke } from './types.ts'
import type { Progress } from './styles.ts'
import { sample } from './raster.ts'

export function hatch(r: Raster, o: Record<string, number>, rng: () => number, progress: Progress): Stroke[] {
  const strokes: Stroke[] = [], extent = Math.hypot(r.width, r.height)
  const offsets = [0, -90, -45, 45, 22.5, -67.5]
  for (let layer = 0; layer < o.layers!; layer++) {
    const angle = (o.baseAngle! + offsets[layer]!) * Math.PI / 180
    const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx
    const threshold = (layer + 0.5) / (o.layers! + 0.5)
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= r.width - 1 && y <= r.height - 1 && 1 - sample(r, x, y) > threshold
    for (let offset = -extent / 2; offset <= extent / 2; offset += o.spacing!) {
      const phase = rng() * Math.PI * 2
      let run: number[] = [], px = 0, py = 0, previous = false, hasPrevious = false
      for (let t = -extent / 2; t <= extent / 2 + 1; t += 1) {
        const wave = o.wobble! * (0.7 * Math.sin(t * 0.075 + phase) + 0.3 * Math.sin(t * 0.19 + phase))
        const x = (r.width - 1) / 2 + dx * t + nx * (offset + wave)
        const y = (r.height - 1) / 2 + dy * t + ny * (offset + wave)
        const current = inside(x, y)
        if (hasPrevious && current !== previous) {
          let lo = 0, hi = 1
          for (let k = 0; k < 10; k++) {
            const mid = (lo + hi) / 2
            if (inside(px + (x - px) * mid, py + (y - py) * mid) === previous) lo = mid; else hi = mid
          }
          // Choose the interior side of both the tone and rectangle boundary.
          const f = current ? hi : lo
          run.push(px + (x - px) * f, py + (y - py) * f)
        }
        if (current) run.push(x, y)
        if (!current && previous) {
          if (run.length >= 4) strokes.push({ points: new Float32Array(run), width: 0.75 })
          run = []
        }
        px = x; py = y; previous = current; hasPrevious = true
      }
      if (run.length >= 4) strokes.push({ points: new Float32Array(run), width: 0.75 })
    }
    progress('Layering hatch lines', (layer + 1) / o.layers! * 0.95, strokes.slice())
  }
  return strokes
}
