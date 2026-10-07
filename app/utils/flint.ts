// The Flint Hills skyline: f(n) = 1 / (n^3 sin^2 n) for n = 1 .. N, binned on a
// log-log canvas so the same engine that draws photos can draw a theorem.
//
// Background: the irrationality exponent of pi is 2 (openai/math, family 017,
// Lean-checked September 2026). One consequence is that this series converges.
// The spikes are the integers n that land unusually close to a multiple of pi,
// which are exactly the numerators of pi's continued-fraction convergents.

import type { Raster } from '../../lib/types'

export const N_MAX = 10_000_000
export const LOG_X_MAX = 7 // log10(N_MAX)
export const LOG_Y_TOP = 2 // 10^2 at the top of the sheet
export const LOG_Y_BOTTOM = -21 // 10^-21 at the bottom

/** Convergents p/q of pi with p <= ~1.8e12, with the spike at n = p measured at 200 digits (mpmath). */
export interface Convergent {
  k: number
  p: number
  q: number
  aNext: number // next partial quotient a_{k+1}
  alpha: number // complete quotient alpha_{k+1} = [a_{k+1}; a_{k+2}, ...]
  measured: number // 1 / (p^3 sin^2 p)
}

export const CONVERGENTS: Convergent[] = [
  { k: 0, p: 3, q: 1, aNext: 7, alpha: 7.0625, measured: 1.8598 },
  { k: 1, p: 22, q: 7, aNext: 15, alpha: 15.9966, measured: 1.1987 },
  { k: 2, p: 333, q: 106, aNext: 1, alpha: 1.0034, measured: 3.48e-4 },
  { k: 3, p: 355, q: 113, aNext: 292, alpha: 292.6346, measured: 24.598 },
  { k: 4, p: 103993, q: 33102, aNext: 1, alpha: 1.5758, measured: 2.43e-6 },
  { k: 5, p: 104348, q: 33215, aNext: 1, alpha: 1.7367, measured: 7.254e-6 },
  { k: 6, p: 208341, q: 66317, aNext: 1, alpha: 1.3575, measured: 1.679e-6 },
  { k: 7, p: 312689, q: 99532, aNext: 2, alpha: 2.7974, measured: 3.887e-6 },
  { k: 8, p: 833719, q: 265381, aNext: 1, alpha: 1.2541, measured: 3.226e-7 },
  { k: 9, p: 1146408, q: 364913, aNext: 3, alpha: 3.935, measured: 1.921e-6 },
  { k: 10, p: 4272943, q: 1360120, aNext: 1, alpha: 1.0695, measured: 4.244e-8 },
  { k: 11, p: 5419351, q: 1725033, aNext: 14, alpha: 14.3867, measured: 4.305e-6 },
  { k: 12, p: 80143857, q: 25510582, aNext: 2, alpha: 2.5859, measured: 8.901e-9 },
  { k: 13, p: 165707065, q: 52746197, aNext: 1, alpha: 1.7069, measured: 2.934e-9 },
  { k: 14, p: 245850922, q: 78256779, aNext: 1, alpha: 1.4146, measured: 1.798e-9 },
  { k: 15, p: 411557987, q: 131002976, aNext: 2, alpha: 2.4118, measured: 2.229e-9 },
  { k: 16, p: 1068966896, q: 340262731, aNext: 2, alpha: 2.4283, measured: 7.502e-10 },
  { k: 17, p: 2549491779, q: 811528438, aNext: 2, alpha: 2.3346, measured: 3.014e-10 },
  { k: 18, p: 6167950454, q: 1963319607, aNext: 2, alpha: 2.9883, measured: 1.901e-10 },
  { k: 19, p: 14885392687, q: 4738167652, aNext: 1, alpha: 1.0118, measured: 1.385e-11 },
  { k: 20, p: 21053343141, q: 6701487259, aNext: 84, alpha: 84.3975, measured: 3.486e-8 },
  { k: 21, p: 1783366216531, q: 567663097408, aNext: 2, alpha: 2.5158, measured: 3.63e-13 },
]

/** Spike height predicted from the continued fraction alone: (alpha_{k+1} + q_{k-1}/q_k)^2 / (pi^3 q_k). */
export function predictedHeight(c: Convergent): number {
  const prev = CONVERGENTS[c.k - 1]
  const tail = prev ? prev.q / c.q : 0
  return (c.alpha + tail) ** 2 / (Math.PI ** 3 * c.q)
}

/** The rough version with only the next partial quotient: a^2 / (pi^3 q). */
export function roughHeight(c: Convergent): number {
  return c.aNext ** 2 / (Math.PI ** 3 * c.q)
}

export const term = (n: number) => 1 / (n * n * n * Math.sin(n) ** 2)

export interface Skyline {
  width: number
  height: number
  /** Highest term in each column and the n that produced it. */
  colMax: Float64Array
  colArg: Uint32Array
  /** Median term of each column (0 for empty columns). */
  colMedian: Float64Array
  colCount: Uint32Array
  /** Row histogram per column, row-major: hist[row * width + col]. */
  hist: Uint32Array
  /** Running sum of the series up to N_MAX, in double precision. */
  sum: number
  n: number
}

export const colOf = (n: number, width: number) => Math.min(width - 1, Math.floor((Math.log10(n) / LOG_X_MAX) * width))
export const rowOf = (logT: number, height: number) =>
  Math.max(0, Math.min(height - 1, Math.floor(((LOG_Y_TOP - logT) / (LOG_Y_TOP - LOG_Y_BOTTOM)) * height)))
export const nAtCol = (col: number, width: number) => 10 ** ((col / width) * LOG_X_MAX)

/**
 * Bins every n up to `n` into a width x height log-log histogram. Runs in chunks
 * so the page can show progress; about a quarter of a second for 10^7 on a desktop.
 */
export async function buildSkyline(width: number, height: number, n = N_MAX, onProgress?: (ratio: number) => void): Promise<Skyline> {
  const hist = new Uint32Array(width * height)
  const colMax = new Float64Array(width)
  const colArg = new Uint32Array(width)
  const colCount = new Uint32Array(width)
  let sum = 0
  const CHUNK = 500_000
  // Column boundaries, advanced incrementally so the hot loop has one sin and one log.
  let col = 0
  let nextBoundary = 10 ** (((col + 1) / width) * LOG_X_MAX)
  for (let start = 1; start <= n; start += CHUNK) {
    const end = Math.min(n, start + CHUNK - 1)
    for (let i = start; i <= end; i++) {
      while (i >= nextBoundary && col < width - 1) {
        col++
        nextBoundary = 10 ** (((col + 1) / width) * LOG_X_MAX)
      }
      const s = Math.sin(i)
      const t = 1 / (i * i * i * s * s)
      sum += t
      const row = rowOf(Math.log10(t), height)
      hist[row * width + col]!++
      colCount[col]!++
      if (t > colMax[col]!) {
        colMax[col] = t
        colArg[col] = i
      }
    }
    onProgress?.(end / n)
    await new Promise(r => setTimeout(r, 0))
  }
  // Median from the histogram: the row holding the middle count, converted back to a term.
  const colMedian = new Float64Array(width)
  for (let c = 0; c < width; c++) {
    const total = colCount[c]!
    if (!total) continue
    let acc = 0
    for (let r = 0; r < height; r++) {
      acc += hist[r * width + c]!
      if (acc * 2 >= total) {
        colMedian[c] = 10 ** (LOG_Y_TOP - ((r + 0.5) / height) * (LOG_Y_TOP - LOG_Y_BOTTOM))
        break
      }
    }
  }
  return { width, height, colMax, colArg, colMedian, colCount, hist, sum, n }
}

/**
 * Turns the skyline into a greyscale raster for the ink engine. The cloud of
 * ordinary terms is toned by density; each column's tallest term gets a needle
 * from the cloud up to its height, so a single integer can hold a line of ink.
 */
export function skylineRaster(sky: Skyline): Raster {
  const { width, height, hist, colCount, colMax, colMedian } = sky
  const values = new Float32Array(width * height).fill(1)
  for (let c = 0; c < width; c++) {
    const total = colCount[c]!
    if (!total) continue
    const norm = Math.log1p(total)
    for (let r = 0; r < height; r++) {
      const count = hist[r * width + c]!
      if (!count) continue
      const tone = norm > 0 ? Math.log1p(count) / norm : 1
      values[r * width + c] = 1 - 0.92 * tone
    }
    // Needle: from the tallest term down to the median of the column.
    const top = rowOf(Math.log10(colMax[c]!), height)
    const base = rowOf(Math.log10(colMedian[c]!), height)
    for (let r = top; r <= base; r++) {
      values[r * width + c] = 0
      if (c + 1 < width) values[r * width + c + 1] = Math.min(values[r * width + c + 1]!, 0.15)
    }
  }
  return { width, height, values }
}

/** Describes what a given n is, if it is one of the named spikes. */
export function describe(n: number): string {
  const conv = CONVERGENTS.find(c => c.p === n)
  if (conv) return `${conv.p}/${conv.q} is convergent ${conv.k} of pi. Next partial quotient ${conv.aNext}.`
  if (n > 355 && n % 355 === 0) return `${n / 355} x 355, an echo of the 355 spike (height / ${n / 355}^5).`
  if (n > 22 && n % 22 === 0 && n < 355) return `${n / 22} x 22, an echo of the 22 spike.`
  return ''
}

export function fmt(x: number): string {
  if (x === 0) return '0'
  if (x >= 0.01 && x < 1000) return x.toPrecision(3)
  const e = Math.floor(Math.log10(x))
  const m = x / 10 ** e
  return `${m.toFixed(2)}×10^${e}`
}
