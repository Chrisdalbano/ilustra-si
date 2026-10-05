import type { Raster, Stroke } from '../../lib/types'

/** `light` = light ink on dark paper: ink must go where the photo is bright, so the raster is inverted. */
export interface Palette { id: string; name: string; ink: string; paper: string; light?: boolean }

/** A few pairs that look like real pens on real paper. */
export const PALETTES: Palette[] = [
  { id: 'ink', name: 'Ink on paper', ink: '#181916', paper: '#f3f0e8' },
  { id: 'cobalt', name: 'Cobalt on paper', ink: '#2947d7', paper: '#f3f0e8' },
  { id: 'sepia', name: 'Sepia on cream', ink: '#4a3222', paper: '#efe5cf' },
  { id: 'white', name: 'White on black', ink: '#f1eee5', paper: '#141512', light: true },
]

/** Strokes a range of strokes, batching consecutive strokes of equal width into one path. */
export function traceStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], from = 0, to = strokes.length): void {
  let width = -1
  for (let i = from; i < to; i++) {
    const s = strokes[i]!, p = s.points
    if (p.length < 2) continue
    if (s.width !== width) {
      if (width >= 0) ctx.stroke()
      ctx.beginPath()
      width = s.width
      ctx.lineWidth = width
    }
    ctx.moveTo(p[0]!, p[1]!)
    if (p.length === 2) ctx.lineTo(p[0]! + 0.01, p[1]!)
    else for (let j = 2; j < p.length; j += 2) ctx.lineTo(p[j]!, p[j + 1]!)
  }
  if (width >= 0) ctx.stroke()
}

export function prepareInk(ctx: CanvasRenderingContext2D, ink: string): void {
  ctx.strokeStyle = ink
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

/** Paints a greyscale raster into a new canvas (used for the demo source and the compare view). */
export function rasterToCanvas(raster: Raster): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = raster.width
  canvas.height = raster.height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(raster.width, raster.height)
  for (let i = 0; i < raster.values.length; i++) {
    const v = Math.round(raster.values[i]! * 255)
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** Resamples any image so its longest side is `longest`, then converts to luminance (0 = black). */
export function imageToRaster(source: CanvasImageSource, srcWidth: number, srcHeight: number, longest: number): Raster {
  const scale = longest / Math.max(srcWidth, srcHeight)
  const width = Math.max(1, Math.round(srcWidth * scale)), height = Math.max(1, Math.round(srcHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff' // transparent pixels read as paper
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  const values = new Float32Array(width * height)
  for (let i = 0; i < values.length; i++) {
    const v = (0.2126 * data[i * 4]! + 0.7152 * data[i * 4 + 1]! + 0.0722 * data[i * 4 + 2]!) / 255
    values[i] = Math.min(1, Math.max(0, v))
  }
  return { width, height, values }
}

export function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
