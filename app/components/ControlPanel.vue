<script setup lang="ts">
import type { OptionDef } from '../../lib/types'
import { PALETTES } from '../utils/ink'

defineProps<{ optionDefs: OptionDef[]; sourceName: string; isDemo: boolean }>()
const options = defineModel<Record<string, number>>('options', { required: true })
const seed = defineModel<number>('seed', { required: true })
const detail = defineModel<number>('detail', { required: true })
const palette = defineModel<string>('palette', { required: true })
const emit = defineEmits<{ file: [file: File]; demo: [] }>()

const picker = ref<HTMLInputElement>()
const camera = ref<HTMLInputElement>()

function picked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('file', file)
  input.value = ''
}
function setOption(key: string, event: Event) {
  options.value = { ...options.value, [key]: Number((event.target as HTMLInputElement).value) }
}
function setSeed(event: Event) {
  const v = Math.floor(Number((event.target as HTMLInputElement).value))
  if (Number.isFinite(v)) seed.value = Math.max(0, Math.min(999999, v))
}
const reroll = () => { seed.value = Math.floor(Math.random() * 999999) + 1 }
const decimals = (step: number) => (String(step).split('.')[1]?.length ?? 0)
const show = (def: OptionDef, v: number | undefined) =>
  def.min === 0 && def.max === 1 && def.step === 1 ? (v ? 'on' : 'off') : (v ?? def.default).toFixed(decimals(def.step))
</script>

<template>
  <div class="panel">
    <section>
      <h2>Photo</h2>
      <p class="current">{{ isDemo ? 'Showing the built-in demo.' : sourceName }}</p>
      <div class="buttons">
        <button type="button" class="primary" @click="picker?.click()">Choose a photo</button>
        <button type="button" class="camera" @click="camera?.click()">Take a photo</button>
        <button v-if="!isDemo" type="button" @click="emit('demo')">Back to demo</button>
      </div>
      <input ref="picker" type="file" accept="image/*" hidden @change="picked">
      <input ref="camera" type="file" accept="image/*" capture="environment" hidden @change="picked">
      <p class="note">Or drop one on the paper, or paste one. Your photo never leaves this device.</p>
      <label class="slider">
        <span class="label">Detail <output>{{ detail }} px</output></span>
        <input v-model.number="detail" type="range" min="240" max="960" step="40">
      </label>
    </section>

    <section>
      <h2>Settings</h2>
      <label v-for="def in optionDefs" :key="def.key" class="slider">
        <span class="label">{{ def.label }} <output>{{ show(def, options[def.key]) }}</output></span>
        <input
          type="range"
          :min="def.min"
          :max="def.max"
          :step="def.step"
          :value="options[def.key] ?? def.default"
          @input="setOption(def.key, $event)"
        >
      </label>
      <div class="seed">
        <label>
          <span class="label">Seed</span>
          <input type="number" min="0" max="999999" :value="seed" @change="setSeed">
        </label>
        <button type="button" @click="reroll">Reroll</button>
      </div>
    </section>

    <section>
      <h2>Ink and paper</h2>
      <div class="palettes" role="radiogroup" aria-label="Ink and paper">
        <button
          v-for="pal in PALETTES"
          :key="pal.id"
          type="button"
          role="radio"
          :aria-checked="palette === pal.id"
          :title="pal.name"
          @click="palette = pal.id"
        >
          <span class="swatch" :style="{ background: pal.paper }"><span :style="{ background: pal.ink }" /></span>
          <span class="name">{{ pal.name }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: 32px; align-content: start; }
section { display: grid; gap: 14px; }
h2 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.current { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
.note { margin: 0; font-size: 14px; line-height: 1.5; color: var(--fg-secondary); }
.buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.camera { display: none; }
@media (pointer: coarse) { .camera { display: inline-block; } }
.slider { display: grid; gap: 6px; }
.label { display: flex; justify-content: space-between; font-size: 14px; color: var(--fg-secondary); }
output { font: 13px var(--font-mono); color: var(--fg-primary); font-variant-numeric: tabular-nums; }
.seed { display: flex; align-items: end; gap: 8px; }
.seed label { display: grid; gap: 6px; flex: 1; }
.seed input {
  font: 15px var(--font-mono);
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  background: var(--bg-canvas);
  color: var(--fg-primary);
  border-radius: 0;
  width: 100%;
}
.palettes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.palettes button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  background: transparent;
  color: var(--fg-primary);
  border: 1px solid var(--border);
  cursor: pointer;
}
.palettes button[aria-checked='true'] { border-color: var(--fg-primary); box-shadow: inset 0 0 0 1px var(--fg-primary); }
.swatch {
  flex: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
}
.swatch span { width: 12px; height: 2px; transform: rotate(-35deg); }
</style>
