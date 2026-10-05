<script setup lang="ts">
import { STYLES, defaults, demoRaster, toSVG } from '../../lib/index'
import type { Illustration, Raster, StyleId } from '../../lib/types'
import { PALETTES, download, imageToRaster, prepareInk, rasterToCanvas, traceStrokes } from '../utils/ink'

interface Source { image: CanvasImageSource; width: number; height: number; url: string; name: string; isDemo: boolean }

const STYLE_IDS = Object.keys(STYLES) as StyleId[]
const DEMO_SEED = 42

const style = ref<StyleId>('oneline')
const optionsByStyle = ref(Object.fromEntries(STYLE_IDS.map(id => [id, defaults(id)])) as Record<StyleId, Record<string, number>>)
const options = computed({
  get: () => optionsByStyle.value[style.value],
  set: (v) => { optionsByStyle.value = { ...optionsByStyle.value, [style.value]: v } },
})
const seed = ref(DEMO_SEED)
const detail = ref(480)
const paletteId = ref('ink')
const palette = computed(() => PALETTES.find(p => p.id === paletteId.value) ?? PALETTES[0]!)

const source = shallowRef<Source | null>(null)
const size = ref({ width: 480, height: 480 })
const illustration = shallowRef<Illustration | null>(null)
const peeking = ref(false)
const dragging = ref(false)
const notice = ref('')
const copied = ref(false)

const renderer = useRenderer()
const plotter = usePlotter()
let raster: Raster | null = null
let demo: Source | null = null
let reducedMotion = false

function rebuildRaster() {
  if (!source.value) return
  const s = source.value
  raster = imageToRaster(s.image, s.width, s.height, detail.value)
  size.value = { width: raster.width, height: raster.height }
}

/** Fresh content (new photo, new style) replays; tweaks show the finished drawing. */
function draw(replay: boolean) {
  if (!raster) return
  const copy: Raster = { width: raster.width, height: raster.height, values: raster.values.slice() }
  if (palette.value.light) for (let i = 0; i < copy.values.length; i++) copy.values[i] = 1 - copy.values[i]!
  renderer.render(
    { raster: copy, style: style.value, options: { ...options.value }, seed: seed.value },
    {
      onPreview: strokes => plotter.preview(strokes, copy.width, copy.height),
      onDone: (ill) => {
        illustration.value = ill
        plotter.load(ill, replay && !reducedMotion)
      },
    },
  )
}

let timer: ReturnType<typeof setTimeout> | undefined
function drawSoon() {
  clearTimeout(timer)
  timer = setTimeout(() => draw(false), 220)
}

watch(style, () => {
  clearTimeout(timer)
  draw(true)
})
// Watch the store, not the computed: switching style must not also queue a tweak render.
watch([optionsByStyle, seed], drawSoon)
watch(detail, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    rebuildRaster()
    draw(false)
  }, 220)
})
watch(() => palette.value.ink, ink => plotter.setInk(ink))
watch(() => !!palette.value.light, () => {
  clearTimeout(timer)
  draw(false)
})

function useSource(next: Source) {
  const previous = source.value
  if (previous && !previous.isDemo) URL.revokeObjectURL(previous.url)
  source.value = next
  rebuildRaster()
  draw(true)
}

async function openFile(file: Blob, name = 'Pasted image') {
  notice.value = ''
  if (!file.type.startsWith('image/')) {
    notice.value = 'That file is not an image.'
    return
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
    useSource({ image: bitmap, width: bitmap.width, height: bitmap.height, url: URL.createObjectURL(file), name, isDemo: false })
  } catch {
    notice.value = 'This browser could not read that image. Try a JPEG or PNG.'
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = [...(event.dataTransfer?.files ?? [])].find(f => f.type.startsWith('image/'))
  if (file) openFile(file, file.name)
  else notice.value = 'Drop an image file (JPEG, PNG, WebP).'
}
function onDragLeave(event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dragging.value = false
}
function onPaste(event: ClipboardEvent) {
  const item = [...(event.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
  const file = item?.getAsFile()
  if (file) {
    event.preventDefault()
    openFile(file)
  }
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const canvas = rasterToCanvas(demoRaster(DEMO_SEED))
  demo = { image: canvas, width: canvas.width, height: canvas.height, url: canvas.toDataURL(), name: 'Demo', isDemo: true }
  useSource(demo)
  window.addEventListener('paste', onPaste)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('paste', onPaste)
})

// ---- export -------------------------------------------------------------

const fileBase = computed(() => `ilustra-${illustration.value?.style ?? 'drawing'}-${illustration.value?.seed ?? 0}`)
const plotterSVG = () => toSVG(illustration.value!, { ink: palette.value.ink, paper: null })

function saveSVG() {
  download(`${fileBase.value}.svg`, new Blob([plotterSVG()], { type: 'image/svg+xml' }))
}
function savePNG(factor: number) {
  const ill = illustration.value!
  const canvas = document.createElement('canvas')
  canvas.width = ill.width * factor
  canvas.height = ill.height * factor
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = palette.value.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(factor, factor)
  prepareInk(ctx, palette.value.ink)
  traceStrokes(ctx, ill.strokes)
  canvas.toBlob(blob => blob && download(`${fileBase.value}@${factor}x.png`, blob), 'image/png')
}
async function copySVG() {
  try {
    await navigator.clipboard.writeText(plotterSVG())
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    notice.value = 'The clipboard is not available here. Use Download SVG instead.'
  }
}

const n = (v: number) => Math.round(v).toLocaleString('en-US')
const stats = computed(() => {
  const s = illustration.value?.stats
  if (!s) return ''
  return `${n(s.strokes)} ${s.strokes === 1 ? 'stroke' : 'strokes'} · ${n(s.points)} points · ${n(s.penLength)} px of pen · ${n(s.ms)} ms`
})
</script>

<template>
  <div class="page">
    <header class="top">
      <a href="/" class="mark">ilustra.si</a>
      <nav><a href="#how">How it works</a></nav>
    </header>

    <section class="hero">
      <h1>A photo, drawn in ink.</h1>
      <p>
        Give it a photo and watch it drawn as a pen illustration, one stroke at a time.
        There is no model and no server, only geometry running in your browser.
        Export the SVG and put it on a plotter.
      </p>
    </section>

    <section
      class="bench"
      aria-label="Drawing"
      @dragover.prevent="dragging = true"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="stage">
        <div class="styles" role="tablist" aria-label="Style">
          <button
            v-for="id in STYLE_IDS"
            :key="id"
            type="button"
            role="tab"
            :aria-selected="style === id"
            @click="style = id"
          >
            {{ STYLES[id].name }}
          </button>
        </div>
        <p class="blurb">{{ STYLES[style].blurb }}</p>

        <StageView
          :plotter="plotter"
          :width="size.width"
          :height="size.height"
          :ink="palette.ink"
          :paper="palette.paper"
          :source-url="source?.url ?? ''"
          :peeking="peeking"
          :busy="renderer.busy.value"
          :ratio="renderer.ratio.value"
          :dragging="dragging"
        />
        <ReplayBar :plotter="plotter" :disabled="!plotter.ready.value" @peek="peeking = $event" />

        <p class="status" aria-live="polite">
          <template v-if="renderer.error.value">Something went wrong: {{ renderer.error.value }}</template>
          <template v-else-if="renderer.busy.value">{{ renderer.phase.value }} · {{ Math.round(renderer.ratio.value * 100) }}%</template>
          <template v-else>{{ stats }}</template>
        </p>
        <p v-if="notice" class="notice" role="alert">{{ notice }}</p>

        <div class="export">
          <button type="button" class="primary" :disabled="!illustration" @click="saveSVG">Download SVG</button>
          <button type="button" :disabled="!illustration" @click="savePNG(2)">PNG 2&times;</button>
          <button type="button" :disabled="!illustration" @click="savePNG(4)">PNG 4&times;</button>
          <button type="button" :disabled="!illustration" @click="copySVG">{{ copied ? 'Copied' : 'Copy SVG' }}</button>
        </div>
      </div>

      <ControlPanel
        v-model:options="options"
        v-model:seed="seed"
        v-model:detail="detail"
        v-model:palette="paletteId"
        class="controls"
        :option-defs="STYLES[style].options"
        :source-name="source?.name ?? ''"
        :is-demo="source?.isDemo ?? true"
        @file="openFile($event, $event.name)"
        @demo="demo && useSource(demo)"
      />
    </section>

    <HowItWorks class="below" />

    <footer class="foot">
      <a href="https://chrisdalbano.com">Made by Chris D'Albano</a>
      <span>The domain ilustra.si is for sale. <a href="https://chrisdalbano.com">Get in touch</a>.</span>
      <a href="/llms.txt">llms.txt</a>
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 28px 0;
}
.mark { font-weight: 700; font-size: 20px; letter-spacing: -0.02em; color: var(--fg-primary); text-decoration: none; }
.top nav a { color: var(--fg-secondary); font-size: 15px; text-decoration: none; }
.top nav a:hover { color: var(--fg-primary); }
.hero {
  padding: clamp(16px, 3vw, 40px) 0 clamp(28px, 3.5vw, 48px);
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 24px clamp(24px, 4vw, 64px);
  align-items: end;
}
h1 {
  margin: 0;
  font-size: clamp(42px, 6.2vw, 96px);
  line-height: 0.95;
  letter-spacing: -0.045em;
  font-weight: 600;
}
.hero p { margin: 0; max-width: 46ch; font-size: clamp(16px, 1.3vw, 19px); line-height: 1.55; color: var(--fg-secondary); }
@media (max-width: 760px) { .hero { grid-template-columns: 1fr; } }
.bench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: clamp(24px, 3.5vw, 56px);
  align-items: start;
}
.stage { min-width: 0; }
.styles { display: flex; flex-wrap: wrap; gap: 4px 24px; border-bottom: 1px solid var(--border); }
.styles button {
  font: inherit;
  font-size: clamp(17px, 1.6vw, 21px);
  font-weight: 500;
  letter-spacing: -0.01em;
  padding: 10px 0 12px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--fg-muted);
  cursor: pointer;
}
.styles button:hover { color: var(--fg-primary); }
.styles button[aria-selected='true'] { color: var(--fg-primary); border-bottom-color: var(--accent-lead); }
.blurb { margin: 14px 0 18px; color: var(--fg-secondary); font-size: 15px; }
.status { margin: 14px 0 0; font: 13px/1.5 var(--font-mono); color: var(--fg-secondary); min-height: 1.5em; font-variant-numeric: tabular-nums; }
.notice { margin: 8px 0 0; font-size: 14px; color: var(--accent-lead); }
.export { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.controls { position: sticky; top: 24px; padding-top: 8px; }
.below { margin-top: var(--section-py); padding-top: var(--section-py); border-top: 1px solid var(--border); }
.foot {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: var(--section-py);
  padding: 28px 0 40px;
  border-top: 1px solid var(--border);
  font-size: 14px;
}
.foot a { color: var(--fg-secondary); }
@media (max-width: 480px) {
  .styles { gap: 4px 14px; }
  .styles button { font-size: 16px; }
}
@media (max-width: 900px) {
  .bench { grid-template-columns: 1fr; }
  .controls { position: static; }
}
</style>
