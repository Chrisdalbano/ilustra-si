import { clamp } from './raster.ts'

/** Linked buckets avoid per-cell arrays; ids index a flat coordinate buffer. */
export class PointGrid {
  readonly cols: number
  readonly rows: number
  readonly heads: Int32Array
  readonly next: Int32Array
  constructor(readonly points: Float32Array, readonly width: number, readonly height: number, readonly cell: number) {
    this.cols = Math.max(1, Math.ceil(width / cell))
    this.rows = Math.max(1, Math.ceil(height / cell))
    this.heads = new Int32Array(this.cols * this.rows).fill(-1)
    this.next = new Int32Array(points.length / 2).fill(-1)
  }
  add(id: number): void {
    const x = clamp(Math.floor(this.points[2 * id]! / this.cell), 0, this.cols - 1)
    const y = clamp(Math.floor(this.points[2 * id + 1]! / this.cell), 0, this.rows - 1)
    const key = y * this.cols + x
    this.next[id] = this.heads[key]!
    this.heads[key] = id
  }
  nearest(x: number, y: number, allowed?: (id: number) => boolean): number {
    const cx = clamp(Math.floor(x / this.cell), 0, this.cols - 1)
    const cy = clamp(Math.floor(y / this.cell), 0, this.rows - 1)
    let best = -1, distance = Infinity
    for (let ring = 0; ring < Math.max(this.cols, this.rows); ring++) {
      const left = Math.max(0, cx - ring), right = Math.min(this.cols - 1, cx + ring)
      const top = Math.max(0, cy - ring), bottom = Math.min(this.rows - 1, cy + ring)
      for (let gy = top; gy <= bottom; gy++) for (let gx = left; gx <= right; gx++) {
        if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== ring) continue
        for (let id = this.heads[gy * this.cols + gx]!; id >= 0; id = this.next[id]!) {
          if (allowed && !allowed(id)) continue
          const dx = this.points[2 * id]! - x, dy = this.points[2 * id + 1]! - y
          const d = dx * dx + dy * dy
          if (d < distance || (d === distance && id < best)) { best = id; distance = d }
        }
      }
      const edge = Math.min(left === 0 ? Infinity : x - left * this.cell,
        right === this.cols - 1 ? Infinity : (right + 1) * this.cell - x,
        top === 0 ? Infinity : y - top * this.cell,
        bottom === this.rows - 1 ? Infinity : (bottom + 1) * this.cell - y)
      if (distance <= edge * edge || edge === Infinity) break
    }
    return best
  }
  near(x: number, y: number, radius: number): boolean {
    const left = clamp(Math.floor((x - radius) / this.cell), 0, this.cols - 1)
    const right = clamp(Math.floor((x + radius) / this.cell), 0, this.cols - 1)
    const top = clamp(Math.floor((y - radius) / this.cell), 0, this.rows - 1)
    const bottom = clamp(Math.floor((y + radius) / this.cell), 0, this.rows - 1)
    for (let gy = top; gy <= bottom; gy++) for (let gx = left; gx <= right; gx++) {
      for (let id = this.heads[gy * this.cols + gx]!; id >= 0; id = this.next[id]!) {
        const dx = this.points[id * 2]! - x, dy = this.points[id * 2 + 1]! - y
        if (dx * dx + dy * dy < radius * radius) return true
      }
    }
    return false
  }
}
