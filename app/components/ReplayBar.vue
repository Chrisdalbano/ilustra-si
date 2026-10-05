<script setup lang="ts">
import type { usePlotter } from '../composables/usePlotter'

const props = defineProps<{ plotter: ReturnType<typeof usePlotter>; disabled: boolean }>()
const emit = defineEmits<{ peek: [on: boolean] }>()

const SPEEDS = [0.5, 1, 2, 4]
const p = props.plotter

function toggle() {
  if (p.playing.value) p.pause()
  else p.play()
}
function scrub(event: Event) {
  const input = event.target as HTMLInputElement, v = Number(input.value)
  p.pause()
  // The range snaps to its step, so the last notch means "the end".
  p.seek(v >= Number(input.max) - 0.011 ? Infinity : v)
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function peekKey(event: KeyboardEvent, on: boolean) {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  if (!event.repeat) emit('peek', on)
}
</script>

<template>
  <div class="bar" :class="{ disabled }">
    <button type="button" class="play" :disabled="disabled" :aria-label="p.playing.value ? 'Pause' : 'Play'" @click="toggle">
      <svg v-if="p.playing.value" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
      <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" /></svg>
    </button>
    <input
      class="scrub"
      type="range"
      min="0"
      :max="p.duration.value || 1"
      step="0.01"
      :value="p.time.value"
      :disabled="disabled"
      aria-label="Replay position"
      :style="{ '--fill': `${(p.time.value / (p.duration.value || 1)) * 100}%` }"
      @input="scrub"
    >
    <span class="clock">{{ clock(p.time.value) }} / {{ clock(p.duration.value) }}</span>
    <div class="speeds" role="group" aria-label="Replay speed">
      <button
        v-for="s in SPEEDS"
        :key="s"
        type="button"
        :aria-pressed="p.speed.value === s"
        @click="p.speed.value = s"
      >
        {{ s }}&times;
      </button>
    </div>
    <button type="button" class="text" :disabled="disabled" @click="p.skipToEnd()">Skip to end</button>
    <button
      type="button"
      class="text"
      @pointerdown="emit('peek', true)"
      @pointerup="emit('peek', false)"
      @pointerleave="emit('peek', false)"
      @pointercancel="emit('peek', false)"
      @keydown="peekKey($event, true)"
      @keyup="peekKey($event, false)"
      @blur="emit('peek', false)"
      @contextmenu.prevent
    >
      Hold to compare
    </button>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.play {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: var(--fg-primary);
  color: var(--bg-canvas);
  border: 0;
  cursor: pointer;
}
.play svg { width: 14px; height: 14px; fill: currentColor; }
.play:disabled { opacity: 0.4; cursor: default; }
.scrub { flex: 1 1 200px; }
.clock { font: 13px/1 var(--font-mono); color: var(--fg-secondary); font-variant-numeric: tabular-nums; min-width: 8ch; }
.speeds { display: flex; border: 1px solid var(--border-strong); }
.speeds button {
  font: inherit;
  font-size: 13px;
  padding: 6px 9px;
  background: transparent;
  color: var(--fg-secondary);
  border: 0;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.speeds button + button { border-left: 1px solid var(--border); }
.speeds button[aria-pressed='true'] { background: var(--fg-primary); color: var(--bg-canvas); }
.text {
  font: inherit;
  font-size: 14px;
  padding: 6px 0;
  background: none;
  border: 0;
  color: var(--fg-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: var(--border-strong);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.text:hover { text-decoration-color: currentColor; }
.text:disabled { opacity: 0.4; cursor: default; }
</style>
