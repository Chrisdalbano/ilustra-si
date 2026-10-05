import type { OptionDef, StyleDef, StyleId } from './types.ts'

const option = (key: string, label: string, min: number, max: number, step: number, value: number): OptionDef =>
  ({ key, label, min, max, step, default: value })

export const STYLES: Record<StyleId, StyleDef> = {
  stipple: { id: 'stipple', name: 'Stipple', blurb: 'Weighted Voronoi dots settle into the shadows.', options: [
    option('pointCount', 'Points', 50, 6000, 50, 1800), option('iterations', 'Relaxation', 0, 20, 1, 6),
    option('dotSize', 'Dot size', 0.2, 4, 0.1, 1.2), option('varySize', 'Tone-sized dots', 0, 1, 1, 1),
    option('contrast', 'Contrast', 0.25, 3, 0.05, 1),
  ] },
  oneline: { id: 'oneline', name: 'One line', blurb: 'A single travelling-salesman path through the tones.', options: [
    option('pointCount', 'Points', 50, 6000, 50, 1600), option('effort', 'Optimisation effort', 0, 10, 1, 3),
    option('lineWidth', 'Line width', 0.1, 4, 0.1, 0.8),
  ] },
  hatch: { id: 'hatch', name: 'Hatch', blurb: 'Layers of pen hatching build up the darks.', options: [
    option('spacing', 'Spacing', 2, 24, 0.5, 6), option('layers', 'Layers', 1, 6, 1, 4),
    option('wobble', 'Wobble', 0, 2, 0.1, 0.35), option('baseAngle', 'Base angle', -90, 90, 1, 45),
  ] },
  contour: { id: 'contour', name: 'Contour', blurb: 'Evenly spaced streamlines follow the image surface.', options: [
    option('spacing', 'Spacing', 2, 20, 0.5, 6), option('length', 'Stroke length', 12, 300, 2, 100),
    option('smoothing', 'Smoothing', 0, 1, 0.05, 0.55),
  ] },
  scribble: { id: 'scribble', name: 'Scribble', blurb: 'One looping pen wanders through the shadows.', options: [
    option('turns', 'Turns', 100, 5000, 50, 1400), option('loopSize', 'Loop size', 1, 20, 0.5, 5),
    option('jitter', 'Jitter', 0, 1, 0.05, 0.25),
  ] },
}

export function defaults(style: StyleId): Record<string, number> {
  return Object.fromEntries(STYLES[style].options.map(o => [o.key, o.default]))
}

export type Progress = (phase: string, ratio: number, preview?: import('./types.ts').Stroke[]) => void

export function optionsFor(style: StyleId, options: Record<string, number>): Record<string, number> {
  return Object.fromEntries(STYLES[style].options.map(o => {
    const v = options[o.key]
    const bounded = Number.isFinite(v) ? Math.max(o.min, Math.min(o.max, v!)) : o.default
    return [o.key, o.step === 1 ? Math.round(bounded) : bounded]
  }))
}
