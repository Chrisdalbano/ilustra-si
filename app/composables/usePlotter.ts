import type { Illustration, Stroke } from '../../lib/types'
import { prepareInk, traceStrokes } from '../utils/ink'

/**
 * Replays an illustration onto a persistent canvas, in drawing order.
 *
 * Every stroke gets a time slot. Long strokes get proportionally less time per
 * unit of length (they read as fast, confident lines), each stroke eases in
 * and out, and the pen lifts and travels between strokes. Playing forward only
 * draws the new bit of ink since the last frame; seeking backwards repaints.
 */

const BASE_SECONDS = 14

interface Timeline {
  start: Float64Array // pen down
  end: Float64Array // pen up
  cum: Float32Array[] // per stroke: cumulative drawing weight at each point
  total: number
}

function buildTimeline(strokes: Stroke[]): Timeline {
  const n = strokes.length
  const start = new Float64Array(n), end = new Float64Array(n), cum: Float32Array[] = []
  const drawW = new Float64Array(n), gapW = new Float64Array(n)
  let sumDraw = 0, sumGap = 0, px = NaN, py = NaN
  for (let i = 0; i < n; i++) {
    // c is a time axis along the stroke, not arc length: each segment costs
    // sqrt(length), so long sweeps go by quickly and dense detail gets time.
    const p = strokes[i]!.points, c = new Float32Array(p.length / 2)
    let len = 0
    for (let j = 1; j < c.length; j++) {
      const seg = Math.hypot(p[j * 2]! - p[j * 2 - 2]!, p[j * 2 + 1]! - p[j * 2 - 1]!)
      len += seg
      c[j] = c[j - 1]! + Math.sqrt(seg)
    }
    cum.push(c)
    drawW[i] = Math.pow(Math.max(len, 0.5), 0.62)
    const travel = Number.isNaN(px) ? 0 : Math.hypot(p[0]! - px, p[1]! - py)
    gapW[i] = 1 + Math.sqrt(travel) / 3
    px = p[p.length - 2]!
    py = p[p.length - 1]!
    sumDraw += drawW[i]!
    sumGap += gapW[i]!
  }
  const T = Math.min(20, BASE_SECONDS + n / 400)
  const gapShare = n <= 1 ? 0.02 : Math.min(0.3, Math.max(0.06, (n * 0.12) / T))
  const kDraw = sumDraw ? (T * (1 - gapShare)) / sumDraw : 0, kGap = sumGap ? (T * gapShare) / sumGap : 0
  let t = 0
  for (let i = 0; i < n; i++) {
    t += gapW[i]! * kGap
    start[i] = t
    t += drawW[i]! * kDraw
    end[i] = t
  }
  return { start, end, cum, total: t }
}

/**
 * Fraction of a stroke drawn after `u` (0..1) of its slot of `d` seconds:
 * a trapezoidal speed profile. The pen accelerates for at most 0.3 s, cruises,
 * then settles, so short strokes look deliberate and long ones look quick.
 */
function ease(u: number, d: number): number {
  const a = Math.min(1 / 3, 0.3 / Math.max(d, 1e-6)), v = 1 / (1 - a)
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (u < a) return (v * u * u) / (2 * a)
  if (u > 1 - a) return 1 - (v * (1 - u) * (1 - u)) / (2 * a)
  return v * (u - a / 2)
}
const smooth = (u: number) => u * u * (3 - 2 * u)

/** Index of the last point whose cumulative weight is <= s. */
function segmentAt(c: Float32Array, s: number, from = 0): number {
  let lo = from, hi = c.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (c[mid]! <= s) lo = mid
    else hi = mid - 1
  }
  return lo
}

function pointAt(p: Float32Array, c: Float32Array, k: number, s: number): [number, number] {
  if (k >= c.length - 1) return [p[p.length - 2]!, p[p.length - 1]!]
  const span = c[k + 1]! - c[k]!, f = span > 0 ? (s - c[k]!) / span : 0
  return [p[k * 2]! + (p[k * 2 + 2]! - p[k * 2]!) * f, p[k * 2 + 1]! + (p[k * 2 + 3]! - p[k * 2 + 1]!) * f]
}

export function usePlotter() {
  const time = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const speed = ref(1)
  const ready = ref(false)

  let canvas: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null
  let nib: HTMLElement | null = null
  let ill: Illustration | null = null, tl: Timeline | null = null
  let ink = '#181916', scale = 1
  // Drawing cursor: how much ink is already on the canvas.
  let cStroke = 0, cSeg = 0, cLen = 0, drawnTo = 0
  let raf = 0, lastFrame = 0

  function attach(c: HTMLCanvasElement, n: HTMLElement) {
    canvas = c
    nib = n
    ctx = c.getContext('2d')
  }

  /** Sizes the backing store to the element's CSS size and device pixels. */
  function fit(width: number, height: number) {
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const cssW = canvas.clientWidth || width
    const bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round((cssW * dpr * height) / width))
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    scale = bw / width
  }

  function clear() {
    if (!canvas || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    prepareInk(ctx, ink)
  }

  /** Shows partial worker output as a faint underdrawing. */
  function preview(strokes: Stroke[], width: number, height: number) {
    stop()
    ill = null
    tl = null
    ready.value = false
    fit(width, height)
    clear()
    if (!ctx) return
    ctx.globalAlpha = 0.35
    traceStrokes(ctx, strokes)
    ctx.globalAlpha = 1
    hideNib()
  }

  function load(illustration: Illustration, autoplay: boolean) {
    stop()
    ill = illustration
    tl = buildTimeline(illustration.strokes)
    duration.value = tl.total
    ready.value = true
    fit(ill.width, ill.height)
    repaint(0)
    if (autoplay && tl.total > 0) play()
    else seek(tl.total)
  }

  /** Clears and redraws everything up to time t in one pass. */
  function repaint(t: number) {
    if (!ill || !tl || !ctx) return
    clear()
    let k = 0
    while (k < tl.end.length && tl.end[k]! <= t) k++
    traceStrokes(ctx, ill.strokes, 0, k)
    cStroke = k
    cSeg = 0
    cLen = 0
    drawnTo = t
    advance(t)
  }

  /** Draws only the ink between the cursor and time t. */
  function advance(t: number) {
    if (!ill || !tl || !ctx) return
    if (t < drawnTo) return repaint(t)
    const { strokes } = ill
    while (cStroke < strokes.length && tl.start[cStroke]! <= t) {
      const s = strokes[cStroke]!, p = s.points, c = tl.cum[cStroke]!, len = c[c.length - 1]!
      const done = tl.end[cStroke]! <= t
      const d = tl.end[cStroke]! - tl.start[cStroke]!
      const target = done ? len : ease((t - tl.start[cStroke]!) / d, d) * len
      ctx.lineWidth = s.width
      ctx.beginPath()
      if (p.length === 2 || len === 0) {
        ctx.moveTo(p[0]!, p[1]!)
        ctx.lineTo(p[0]! + 0.01, p[1]!)
      } else if (target > cLen) {
        const [x0, y0] = pointAt(p, c, cSeg, cLen)
        ctx.moveTo(x0, y0)
        const k = segmentAt(c, target, cSeg)
        for (let j = cSeg + 1; j <= k; j++) ctx.lineTo(p[j * 2]!, p[j * 2 + 1]!)
        const [x1, y1] = pointAt(p, c, k, target)
        ctx.lineTo(x1, y1)
        cSeg = k
        cLen = target
      }
      ctx.stroke()
      if (!done) break
      cStroke++
      cSeg = 0
      cLen = 0
    }
    drawnTo = t
    placeNib(t)
  }

  function placeNib(t: number) {
    if (!nib || !ill || !tl || !canvas) return
    const { strokes } = ill, n = strokes.length
    if (!n || t >= tl.total) return hideNib()
    // last stroke that has started
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (tl.start[mid]! <= t) lo = mid
      else hi = mid - 1
    }
    let x: number, y: number, down: boolean
    const i = lo, p = strokes[i]!.points
    if (t < tl.start[0]!) {
      ;[x, y] = [strokes[0]!.points[0]!, strokes[0]!.points[1]!]
      down = false
    } else if (t <= tl.end[i]!) {
      const c = tl.cum[i]!, len = c[c.length - 1]!
      const d = Math.max(1e-9, tl.end[i]! - tl.start[i]!)
      const s = ease((t - tl.start[i]!) / d, d) * len
      ;[x, y] = pointAt(p, c, segmentAt(c, s), s)
      down = true
    } else {
      const q = strokes[i + 1]!.points
      const u = smooth((t - tl.end[i]!) / Math.max(1e-9, tl.start[i + 1]! - tl.end[i]!))
      x = p[p.length - 2]! + (q[0]! - p[p.length - 2]!) * u
      y = p[p.length - 1]! + (q[1]! - p[p.length - 1]!) * u
      down = false
    }
    const k = canvas.clientWidth / ill.width
    nib.style.opacity = '1'
    nib.style.transform = `translate(${x * k}px, ${y * k}px)`
    nib.dataset.down = down ? 'true' : 'false'
  }

  function hideNib() {
    if (nib) nib.style.opacity = '0'
  }

  function frame(now: number) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    const t = Math.min(duration.value, time.value + dt * speed.value)
    time.value = t
    advance(t)
    if (t >= duration.value) {
      playing.value = false
      raf = 0
      return
    }
    raf = requestAnimationFrame(frame)
  }

  function play() {
    if (!tl || playing.value) return
    if (time.value >= duration.value) {
      time.value = 0
      repaint(0)
    }
    playing.value = true
    lastFrame = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    playing.value = false
  }

  function seek(t: number) {
    time.value = Math.max(0, Math.min(duration.value, t))
    advance(time.value)
  }

  function setInk(color: string) {
    ink = color
    if (tl) repaint(time.value)
  }

  /** Call when the element's size changes. */
  function resize() {
    if (!ill) return
    fit(ill.width, ill.height)
    repaint(time.value)
  }

  onBeforeUnmount(stop)

  return {
    time, duration, playing, speed, ready,
    attach, preview, load, play, pause: stop, seek, setInk, resize,
    skipToEnd: () => { stop(); seek(duration.value) },
  }
}
