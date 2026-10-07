<script setup lang="ts">
import { CONVERGENTS, LOG_X_MAX, LOG_Y_BOTTOM, LOG_Y_TOP, colOf, describe, fmt, nAtCol, rowOf } from '../utils/flint'
import type { Skyline } from '../utils/flint'

const props = defineProps<{ skyline: Skyline | null }>()

const canvas = ref<HTMLCanvasElement>()
const wrap = ref<HTMLElement>()
const hover = ref<{ col: number; n: number; t: number; note: string; x: number; y: number } | null>(null)

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function paint() {
  const sky = props.skyline, el = canvas.value
  if (!sky || !el) return
  const { width, height, hist, colCount, colMax, colMedian } = sky
  el.width = width
  el.height = height
  const ctx = el.getContext('2d')!
  const ink = css('--fg-primary'), muted = css('--fg-muted'), lead = css('--accent-lead')
  ctx.clearRect(0, 0, width, height)
  // Cloud of ordinary terms, toned by density within the column.
  const img = ctx.createImageData(width, height)
  const [ir, ig, ib] = hexToRgb(ink)
  for (let c = 0; c < width; c++) {
    const total = colCount[c]!
    if (!total) continue
    const norm = Math.log1p(total)
    for (let r = 0; r < height; r++) {
      const count = hist[r * width + c]!
      if (!count) continue
      const a = norm > 0 ? Math.log1p(count) / norm : 1
      const i = (r * width + c) * 4
      img.data[i] = ir
      img.data[i + 1] = ig
      img.data[i + 2] = ib
      img.data[i + 3] = Math.round(40 + 190 * a)
    }
  }
  ctx.putImageData(img, 0, 0)
  // Needles.
  ctx.strokeStyle = ink
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c < width; c++) {
    if (!colCount[c]) continue
    const top = rowOf(Math.log10(colMax[c]!), height)
    const base = rowOf(Math.log10(colMedian[c]!), height)
    ctx.moveTo(c + 0.5, top)
    ctx.lineTo(c + 0.5, base)
  }
  ctx.stroke()
  // Named convergent spikes in the lead colour.
  ctx.strokeStyle = lead
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const cv of CONVERGENTS) {
    if (cv.p > sky.n) break
    const c = colOf(cv.p, width)
    const top = rowOf(Math.log10(cv.measured), height)
    ctx.moveTo(c + 0.5, top)
    ctx.lineTo(c + 0.5, Math.min(height, top + 10))
  }
  ctx.stroke()
  // Axis ticks: decades on x, every 6 decades on y.
  ctx.strokeStyle = muted
  ctx.lineWidth = 1
  ctx.setLineDash([2, 4])
  ctx.beginPath()
  for (let d = 1; d <= LOG_X_MAX; d++) {
    const x = Math.round((d / LOG_X_MAX) * width) - 0.5
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let L = 0; L >= LOG_Y_BOTTOM; L -= 6) {
    const y = rowOf(L, height) + 0.5
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function onMove(event: PointerEvent) {
  const sky = props.skyline, el = canvas.value
  if (!sky || !el) return
  const rect = el.getBoundingClientRect()
  const col = Math.max(0, Math.min(sky.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * sky.width)))
  // Snap to the tallest spike within a few columns, so the needles are easy to catch.
  let best = col
  for (let c = Math.max(0, col - 4); c <= Math.min(sky.width - 1, col + 4); c++) {
    if (sky.colMax[c]! > sky.colMax[best]!) best = c
  }
  if (!sky.colCount[best]) {
    hover.value = null
    return
  }
  const n = sky.colArg[best]!
  const t = sky.colMax[best]!
  hover.value = { col: best, n, t, note: describe(n), x: ((best + 0.5) / sky.width) * rect.width, y: (rowOf(Math.log10(t), sky.height) / sky.height) * rect.height }
}

const labels = computed(() => {
  const sky = props.skyline
  if (!sky) return []
  return CONVERGENTS.filter(c => c.p <= sky.n && c.p !== 3 && c.p !== 333 && c.p !== 104348 && c.p !== 208341 && c.p !== 833719 && c.p !== 4272943).map(c => ({
    text: String(c.p),
    x: (colOf(c.p, sky.width) / sky.width) * 100,
    y: (rowOf(Math.log10(c.measured), sky.height) / sky.height) * 100,
  }))
})

const xTicks = Array.from({ length: LOG_X_MAX + 1 }, (_, d) => ({ text: d === 0 ? '1' : `10${sup(d)}`, x: (d / LOG_X_MAX) * 100 }))
const yTicks = [0, -6, -12, -18].map(L => ({ text: L === 0 ? '1' : `10${sup(L)}`, y: (rowOf(L, 480) / 480) * 100 }))
function sup(d: number): string {
  const map: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }
  return String(d).split('').map(ch => map[ch] ?? ch).join('')
}

watch(() => props.skyline, () => nextTick(paint))
onMounted(paint)
</script>

<template>
  <figure ref="wrap" class="chart">
    <div class="plot" @pointermove="onMove" @pointerleave="hover = null">
      <canvas ref="canvas" :style="{ aspectRatio: skyline ? `${skyline.width} / ${skyline.height}` : '3 / 2' }" />
      <span v-for="l in labels" :key="l.text" class="label" :style="{ left: `${l.x}%`, top: `${l.y}%` }">{{ l.text }}</span>
      <div v-if="hover" class="tip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
        <b>n = {{ hover.n.toLocaleString('en-US') }}</b>
        <span>1 / (n³ sin² n) = {{ fmt(hover.t) }}</span>
        <span v-if="hover.note" class="note">{{ hover.note }}</span>
      </div>
      <span v-for="t in yTicks" :key="t.text" class="ytick" :style="{ top: `${t.y}%` }">{{ t.text }}</span>
    </div>
    <div class="xaxis">
      <span v-for="t in xTicks" :key="t.text" :style="{ left: `${t.x}%` }">{{ t.text }}</span>
    </div>
    <figcaption>
      Every integer from 1 to 10 million. Across: n, log scale. Up: 1 / (n³ sin² n), log scale, from 10⁻²¹ to 100.
      Grey is where most terms sit; each thin line is the tallest term in that column; blue marks the convergents of π. Hover to read a spike.
    </figcaption>
  </figure>
</template>

<style scoped>
.chart { margin: 0; }
.plot { position: relative; }
canvas { display: block; width: 100%; height: auto; border: 1px solid var(--border); background: var(--bg-canvas); image-rendering: auto; }
.label {
  position: absolute;
  transform: translate(6px, -115%);
  font: 12px/1 var(--font-mono);
  color: var(--accent-lead);
  pointer-events: none;
  white-space: nowrap;
}
.ytick {
  position: absolute;
  left: 6px;
  transform: translateY(-110%);
  font: 11px/1 var(--font-mono);
  color: var(--fg-muted);
  pointer-events: none;
}
.xaxis { position: relative; height: 20px; margin-top: 4px; }
.xaxis span { position: absolute; transform: translateX(-50%); font: 11px/1 var(--font-mono); color: var(--fg-muted); }
.xaxis span:first-child { transform: none; }
.xaxis span:last-child { transform: translateX(-100%); }
.tip {
  position: absolute;
  transform: translate(10px, -50%);
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  background: var(--bg-canvas);
  border: 1px solid var(--fg-primary);
  font: 13px/1.4 var(--font-mono);
  color: var(--fg-primary);
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;
  max-width: 70vw;
}
.tip .note { white-space: normal; max-width: 34ch; color: var(--fg-secondary); font-family: var(--font-sans); }
figcaption { margin-top: 10px; font-size: 14px; line-height: 1.5; color: var(--fg-secondary); max-width: 70ch; }
@media (max-width: 600px) { .label { font-size: 10px; } }
</style>
