import type { Illustration } from './types.ts'

const number = (n: number) => String(Math.round(n * 100) / 100)
const escape = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)

export function toSVG(ill: Illustration, opts?: { ink?: string; paper?: string | null }): string {
  const ink = escape(opts?.ink ?? '#171717')
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${number(ill.width)} ${number(ill.height)}" width="${number(ill.width)}" height="${number(ill.height)}">`]
  if (opts?.paper != null) parts.push(`<rect width="${number(ill.width)}" height="${number(ill.height)}" fill="${escape(opts.paper)}"/>`)
  for (const stroke of ill.strokes) {
    const p = stroke.points
    if (p.length < 2) continue
    let d = `M${number(p[0]!)} ${number(p[1]!)}`
    if (p.length === 2) d += `L${number(p[0]! + 0.01)} ${number(p[1]!)}`
    else for (let i = 2; i < p.length; i += 2) d += `L${number(p[i]!)} ${number(p[i + 1]!)}`
    parts.push(`<path d="${d}" fill="none" stroke="${ink}" stroke-width="${number(stroke.width)}" stroke-linecap="round" stroke-linejoin="round"/>`)
  }
  parts.push('</svg>')
  return parts.join('')
}
