<script setup lang="ts">
import type { usePlotter } from '../composables/usePlotter'

const props = defineProps<{
  plotter: ReturnType<typeof usePlotter>
  width: number
  height: number
  ink: string
  paper: string
  sourceUrl: string
  peeking: boolean
  busy: boolean
  ratio: number
  dragging: boolean
}>()

const canvas = ref<HTMLCanvasElement>()
const nib = ref<HTMLElement>()
const sheet = ref<HTMLElement>()
let observer: ResizeObserver | undefined

onMounted(() => {
  props.plotter.attach(canvas.value!, nib.value!)
  let frame = 0
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => props.plotter.resize())
  })
  observer.observe(sheet.value!)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="desk" :class="{ dragging }">
    <div
      ref="sheet"
      class="sheet"
      :style="{ '--ratio': `${width} / ${height}`, '--w': width, '--h': height, background: paper, color: ink }"
    >
      <canvas ref="canvas" class="ink" role="img" aria-label="The drawing" />
      <img v-if="sourceUrl" class="source" :class="{ on: peeking }" :src="sourceUrl" alt="The source photo">
      <div ref="nib" class="nib" aria-hidden="true"><span class="ring" /><span class="tip" /></div>
      <div class="progress" :class="{ on: busy }" :style="{ transform: `scaleX(${busy ? ratio : 0})` }" />
      <p v-if="peeking" class="tag">Source</p>
    </div>
    <p v-if="dragging" class="drop">Drop to draw</p>
  </div>
</template>

<style scoped>
.desk {
  position: relative;
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vw, 56px);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  min-height: 320px;
}
.desk.dragging { outline: 2px dashed var(--accent-lead); outline-offset: -10px; }
.sheet {
  position: relative;
  aspect-ratio: var(--ratio);
  width: min(100%, calc(70vh * var(--w) / var(--h)));
  box-shadow: 0 1px 1px rgb(24 25 22 / 0.08), 0 18px 40px -18px rgb(24 25 22 / 0.35);
  overflow: hidden;
  transition: background-color 0.3s;
}
/* Faint paper tooth. */
.sheet::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.08;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
.ink, .source { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.source { object-fit: fill; opacity: 0; transition: opacity 0.15s; pointer-events: none; filter: grayscale(1); }
.source.on { opacity: 1; }
.nib {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s;
  will-change: transform;
}
.ring, .tip { position: absolute; border-radius: 50%; transition: transform 0.12s ease-out, opacity 0.12s; }
.ring {
  left: -9px;
  top: -9px;
  width: 18px;
  height: 18px;
  border: 1.5px solid currentColor;
  opacity: 0.55;
}
.tip { left: -2px; top: -2px; width: 4px; height: 4px; background: currentColor; }
.nib[data-down='false'] .ring { transform: translate(3px, -4px) scale(1.35); opacity: 0.3; }
.nib[data-down='false'] .tip { opacity: 0; }
.progress {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: var(--accent-lead);
  transform-origin: left;
  opacity: 0;
  transition: transform 0.15s linear, opacity 0.3s;
}
.progress.on { opacity: 1; }
.tag {
  position: absolute;
  left: 12px;
  bottom: 10px;
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  background: var(--p-ink);
  padding: 4px 8px;
}
.drop {
  position: absolute;
  inset: auto 0 18px;
  margin: 0;
  text-align: center;
  font-weight: 600;
  color: var(--accent-lead);
}
</style>
