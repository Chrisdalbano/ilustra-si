import { describe, expect, it, vi } from 'vitest'
import { DOMParser } from '@xmldom/xmldom'
import { defaults, demoRaster, render, STYLES, toSVG } from '../lib/index.ts'
import type { Illustration, Raster, StyleId, WorkerMessage } from '../lib/types.ts'
import { curve, gaussianBlur, random, sample, sobel } from '../lib/raster.ts'
import { PointGrid } from '../lib/grid.ts'
import { improveTour, nearestTour, orderStrokes, penLength } from '../lib/routing.ts'
import { installWorker } from '../lib/worker.ts'
import type { RenderWorkerScope } from '../lib/worker.ts'

const styles = Object.keys(STYLES) as StyleId[]
function splitRaster(width = 128, height = 128): Raster {
  return { width, height, values: Float32Array.from({ length: width * height }, (_, i) => i % width < width / 2 ? 0.12 : 0.88) }
}
function constant(value: number, width = 32, height = 32): Raster {
  return { width, height, values: new Float32Array(width * height).fill(value) }
}

function inkHalves(ill: Illustration): [number, number] {
  let dark = 0, light = 0
  const split = ill.width / 2
  for (const { points: p, width } of ill.strokes) {
    if (p.length === 2) {
      const area = Math.PI * (width / 2) ** 2
      if (p[0]! < split) dark += area; else light += area
    }
    for (let i = 2; i < p.length; i += 2) {
      const x0 = p[i - 2]!, x1 = p[i]!
      const ink = Math.hypot(x1 - x0, p[i + 1]! - p[i - 1]!) * width
      let fraction = x0 < split ? 1 : 0
      if ((x0 < split) !== (x1 < split)) {
        const t = (split - x0) / (x1 - x0)
        fraction = x0 < split ? t : 1 - t
      }
      dark += ink * fraction; light += ink * (1 - fraction)
    }
  }
  return [dark, light]
}

describe.each(styles)('%s', style => {
  it('is deterministic, bounded, finite, and reports coherent stats/progress', () => {
    const raster = splitRaster(), before = raster.values.slice()
    const request = { raster, style, seed: 731, options: {} }
    const progress: number[] = []
    const first = render(request, (phase, ratio) => { expect(phase.length).toBeGreaterThan(0); progress.push(ratio) })
    const second = render(request)
    expect(first.strokes).toEqual(second.strokes)
    expect(first.stats).toEqual({ ...second.stats, ms: first.stats.ms })
    expect(first.stats.ms).toBeGreaterThanOrEqual(0)
    expect(raster.values).toEqual(before)
    expect(first.strokes.length).toBeGreaterThan(0)
    let valid = true, points = 0, length = 0
    for (const stroke of first.strokes) {
      valid &&= stroke.points instanceof Float32Array && stroke.points.length >= 2 && stroke.points.length % 2 === 0 && stroke.width > 0
      points += stroke.points.length / 2
      length += stroke.points.length === 2 ? 0.01 : penLength(stroke.points)
      for (let i = 0; i < stroke.points.length; i += 2) {
        const x = stroke.points[i]!, y = stroke.points[i + 1]!
        valid &&= Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= raster.width - 1 && y >= 0 && y <= raster.height - 1
      }
    }
    expect(valid).toBe(true)
    expect(first.stats.points).toBe(points)
    expect(first.stats.strokes).toBe(first.strokes.length)
    expect(first.stats.penLength).toBeCloseTo(length, 8)
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(1)
    expect(progress.every((v, i) => v >= 0 && v <= 1 && (!i || v >= progress[i - 1]!))).toBe(true)
    if (style === 'oneline' || style === 'scribble') expect(first.strokes).toHaveLength(1)
  })

  it('puts measurably more ink in the dark half', () => {
    const illustration = render({ raster: splitRaster(), style, seed: 42, options: {} })
    const [dark, light] = inkHalves(illustration)
    expect(dark).toBeGreaterThan(0)
    expect(dark / Math.max(0.001, light)).toBeGreaterThan(1.4)
  })

  it('leaves white paper empty and handles tiny/rectangular inputs', () => {
    expect(render({ raster: constant(1), style, seed: 1, options: {} }).strokes).toHaveLength(0)
    for (const raster of [constant(0, 1, 1), constant(0, 1, 16), constant(0.4, 93, 17)]) {
      const illustration = render({ raster, style, seed: 7, options: { pointCount: 50, turns: 100 } })
      for (const { points } of illustration.strokes) {
        expect(Array.from(points).every((v, i) => Number.isFinite(v) && v >= 0 && v <= (i % 2 ? raster.height : raster.width) - 1)).toBe(true)
      }
    }
  })

  it('exports well-formed, plotter-friendly XML', () => {
    const illustration = render({ raster: splitRaster(48, 40), style, seed: 9, options: { pointCount: 50, turns: 100 } })
    const xml = toSVG(illustration, { ink: '#123456', paper: '#fff' })
    const errors: string[] = []
    const doc = new DOMParser({ onError: (_level, message) => errors.push(message) }).parseFromString(xml, 'image/svg+xml')
    expect(errors).toEqual([])
    expect(doc.documentElement!.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(doc.documentElement!.getAttribute('viewBox')).toBe('0 0 48 40')
    expect(doc.getElementsByTagName('path').length).toBe(illustration.strokes.length)
    expect(doc.getElementsByTagName('rect').length).toBe(1)
    expect(xml).not.toMatch(/\b(?:transform|style|class)=|<style|NaN|Infinity/)
    expect(xml).not.toMatch(/\d+\.\d{3}/)
    expect(toSVG(illustration)).not.toContain('<rect')
  })

  it('renders defaults on a 480×480 raster within four seconds', () => {
    const result = render({ raster: demoRaster(42), style, seed: 42, options: {} })
    expect(result.stats.ms).toBeLessThan(4000)
  }, 10000)
})

describe('raster helpers', () => {
  it('has repeatable, seeded randomness in [0,1)', () => {
    const a = random(3), b = random(3), c = random(4)
    const values = Array.from({ length: 1000 }, a)
    expect(values).toEqual(Array.from({ length: 1000 }, b))
    expect(values).not.toEqual(Array.from({ length: 1000 }, c))
    expect(values.every(v => v >= 0 && v < 1)).toBe(true)
  })
  it('bilinearly samples and clamps borders', () => {
    const r = { width: 2, height: 2, values: new Float32Array([0, 1, 1, 0]) }
    expect(sample(r, 0.5, 0.5)).toBe(0.5)
    expect(sample(r, -4, 0)).toBe(0)
    expect(sample(r, 9, 0)).toBe(1)
  })
  it('blurs constants, spreads an impulse symmetrically, and calculates gradients', () => {
    const blurred = gaussianBlur(constant(0.3), 1.4)
    expect(blurred.values[12]).toBeCloseTo(0.3, 6)
    const impulse = constant(0, 9, 9); impulse.values[40] = 1
    const result = gaussianBlur(impulse, 1)
    expect(result.values[40]).toBeGreaterThan(result.values[41]!)
    expect(result.values[41]).toBeCloseTo(result.values[39]!, 6)
    const ramp = { width: 9, height: 9, values: Float32Array.from({ length: 81 }, (_, i) => (i % 9) / 8) }
    const gradient = sobel(ramp)
    expect(gradient.x.values[40]).toBeCloseTo(1 / 8, 6)
    expect(gradient.y.values[40]).toBeCloseTo(0, 6)
    expect(curve(0.25, 2)).toBe(0)
    expect(curve(0.25, 1, 2)).toBe(0.5)
  })
  it('makes a seeded demo with full tonal range', () => {
    const r = demoRaster(42)
    expect(r).toEqual(demoRaster(42))
    expect(r.values).not.toEqual(demoRaster(43).values)
    let lo = 1, hi = 0
    for (const v of r.values) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    expect(lo).toBeLessThan(0.1); expect(hi).toBeGreaterThan(0.9)
  })
})

describe('routing', () => {
  it('matches exhaustive nearest search even with excluded points', () => {
    const rng = random(23), p = Float32Array.from({ length: 500 }, () => rng() * 99)
    const grid = new PointGrid(p, 100, 100, 7)
    for (let i = 0; i < p.length / 2; i++) grid.add(i)
    for (let query = 0; query < 100; query++) {
      const x = rng() * 99, y = rng() * 99, allowed = (i: number) => i % 3 === 0
      let best = -1, distance = Infinity
      for (let i = 0; i < p.length / 2; i++) if (allowed(i)) {
        const d = (p[2 * i]! - x) ** 2 + (p[2 * i + 1]! - y) ** 2
        if (d < distance) { best = i; distance = d }
      }
      expect(grid.nearest(x, y, allowed)).toBe(best)
    }
  })
  it('2-opt never lengthens or loses points, and uncrosses a known path', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = random(seed), points = Float32Array.from({ length: 200 }, () => rng() * 99)
      const tour = nearestTour(points, 100, 100), before = tour.slice()
      for (const budget of [0, 100, 10000]) {
        const result = improveTour(tour, budget, random(seed))
        expect(penLength(result)).toBeLessThanOrEqual(penLength(tour) + 1e-7)
        const pairs = (p: Float32Array) => Array.from({ length: p.length / 2 }, (_, i) => `${p[2 * i]},${p[2 * i + 1]}`).sort()
        expect(pairs(result)).toEqual(pairs(points))
      }
      expect(tour).toEqual(before)
    }
    const crossed = new Float32Array([0, 0, 10, 10, 0, 10, 10, 0])
    expect(penLength(improveTour(crossed, 100, random(2)))).toBeLessThan(penLength(crossed))
  })
  it('can reverse strokes to start at the nearest endpoint', () => {
    const strokes = [
      { points: new Float32Array([9, 0, 8, 0]), width: 1 },
      { points: new Float32Array([6, 0, 1, 0]), width: 1 },
    ]
    expect(Array.from(orderStrokes(strokes, 10, 10)[0]!.points)).toEqual([1, 0, 6, 0])
    expect(Array.from(strokes[1]!.points)).toEqual([6, 0, 1, 0])
  })
})

describe('API and worker', () => {
  it('clamps options, returns fresh defaults, and rejects malformed input', () => {
    const d = defaults('stipple'); d.pointCount = -10
    expect(defaults('stipple').pointCount).toBe(1800)
    expect(render({ raster: constant(0), style: 'stipple', seed: 1, options: { pointCount: -10, iterations: NaN } }).strokes).toHaveLength(50)
    expect(() => render({ raster: constant(NaN), style: 'hatch', seed: 1, options: {} })).toThrow(/finite/)
    expect(() => render({ raster: { width: 2, height: 3, values: new Float32Array(1) }, style: 'hatch', seed: 1, options: {} })).toThrow(/dimensions/)
    expect(() => render({ raster: constant(0), style: 'nope' as StyleId, seed: 1, options: {} })).toThrow(/Unknown/)
  })
  it('escapes XML attributes and emits a tiny segment for dots', () => {
    const ill = render({ raster: constant(0), style: 'stipple', seed: 1, options: { pointCount: 50 } })
    const xml = toSVG(ill, { ink: 'a"&<>', paper: null })
    expect(xml).toContain('a&quot;&amp;&lt;&gt;')
    const errors: string[] = []
    const doc = new DOMParser({ onError: (_level, message) => errors.push(message) }).parseFromString(xml, 'image/svg+xml')
    expect(errors).toEqual([])
    expect(doc.getElementsByTagName('path')[0]!.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/)
  })
  it('transfers result and preview buffers without detaching algorithm state; throttles progress', () => {
    const messages: { message: WorkerMessage; time: number }[] = []
    let tick = 0, transferred = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => tick += 10)
    const scope: RenderWorkerScope = {
      onmessage: null,
      postMessage(message, transfer) {
        const copy = structuredClone(message, { transfer })
        transferred += transfer.length
        expect(transfer.every(buffer => buffer.byteLength === 0)).toBe(true)
        messages.push({ message: copy, time: tick })
      },
    }
    try {
      installWorker(scope)
      scope.onmessage!({ data: { raster: splitRaster(), style: 'oneline', seed: 1, options: { pointCount: 100, effort: 10 } } })
    } finally { clock.mockRestore() }
    const done = messages.at(-1)!.message
    expect(done.type).toBe('done')
    if (done.type === 'done') expect(done.illustration.strokes[0]!.points.length).toBe(200)
    const progress = messages.filter(m => m.message.type === 'progress')
    expect(progress.some(m => m.message.type === 'progress' && m.message.preview?.length)).toBe(true)
    for (let i = 1; i < progress.length; i++) {
      const current = progress[i]!
      if (current.message.type === 'progress' && current.message.ratio !== 1) expect(current.time - progress[i - 1]!.time).toBeGreaterThanOrEqual(50)
    }
    expect(transferred).toBeGreaterThan(1)
    scope.onmessage!({ data: { raster: constant(NaN), style: 'oneline', seed: 1, options: {} } })
    expect(messages.at(-1)!.message.type).toBe('error')
  })
})
