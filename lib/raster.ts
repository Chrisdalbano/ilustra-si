import type { Raster } from './types.ts'

export const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, x))

/** Mulberry32: state and all arithmetic are explicitly 32 bit. */
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let x = Math.imul(state ^ (state >>> 15), 1 | state)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function sample(r: Raster, x: number, y: number): number {
  x = clamp(x, 0, r.width - 1)
  y = clamp(y, 0, r.height - 1)
  const ix = Math.floor(x), iy = Math.floor(y)
  const jx = Math.min(ix + 1, r.width - 1), jy = Math.min(iy + 1, r.height - 1)
  const tx = x - ix, ty = y - iy
  const a = r.values[iy * r.width + ix]! * (1 - tx) + r.values[iy * r.width + jx]! * tx
  const b = r.values[jy * r.width + ix]! * (1 - tx) + r.values[jy * r.width + jx]! * tx
  return a * (1 - ty) + b * ty
}

export function curve(value: number, contrast = 1, gamma = 1): number {
  return Math.pow(clamp((value - 0.5) * contrast + 0.5), 1 / Math.max(0.01, gamma))
}

export function gaussianBlur(r: Raster, sigma = 1): Raster {
  if (sigma <= 0) return { ...r, values: r.values.slice() }
  const radius = Math.ceil(sigma * 3), kernel = new Float32Array(2 * radius + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) sum += kernel[i + radius] = Math.exp(-i * i / (2 * sigma * sigma))
  for (let i = 0; i < kernel.length; i++) kernel[i]! /= sum
  const tmp = new Float32Array(r.values.length), values = new Float32Array(r.values.length)
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    let v = 0
    for (let k = -radius; k <= radius; k++) v += r.values[y * r.width + clamp(x + k, 0, r.width - 1)]! * kernel[k + radius]!
    tmp[y * r.width + x] = v
  }
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    let v = 0
    for (let k = -radius; k <= radius; k++) v += tmp[clamp(y + k, 0, r.height - 1) * r.width + x]! * kernel[k + radius]!
    values[y * r.width + x] = v
  }
  return { ...r, values }
}

export function sobel(r: Raster): { x: Raster; y: Raster } {
  const gx = new Float32Array(r.values.length), gy = new Float32Array(r.values.length)
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    const a = sample(r, x - 1, y - 1), b = sample(r, x, y - 1), c = sample(r, x + 1, y - 1)
    const d = sample(r, x - 1, y), f = sample(r, x + 1, y)
    const g = sample(r, x - 1, y + 1), h = sample(r, x, y + 1), i = sample(r, x + 1, y + 1)
    gx[y * r.width + x] = (c + 2 * f + i - a - 2 * d - g) / 8
    gy[y * r.width + x] = (g + 2 * h + i - a - 2 * b - c) / 8
  }
  return { x: { ...r, values: gx }, y: { ...r, values: gy } }
}

export function demoRaster(seed: number): Raster {
  const width = 480, height = 480, values = new Float32Array(width * height)
  const rng = random(seed), cx = 228 + rng() * 22, cy = 211 + rng() * 16, radius = 140
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const shadow = Math.exp(-(((x - cx - 50) / 150) ** 2) - ((y - cy - 136) / 32) ** 2)
    let v = 0.96 - 0.16 * y / height - 0.52 * shadow
    const nx = (x - cx) / radius, ny = (y - cy) / radius, d = nx * nx + ny * ny
    if (d <= 1) {
      const nz = Math.sqrt(1 - d)
      const light = Math.max(0, -0.48 * nx - 0.58 * ny + 0.66 * nz)
      v = 0.055 + 0.88 * light + 0.055 * Math.max(0, nx) * (1 - nz)
    }
    values[y * width + x] = clamp(v)
  }
  return { width, height, values }
}
