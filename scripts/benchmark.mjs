import { createServer } from 'vite'
import { cpus, platform, arch } from 'node:os'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { render, demoRaster, STYLES } = await server.ssrLoadModule('/lib/index.ts')
  console.log(`${process.version}; ${platform()} ${arch()}; ${cpus()[0]?.model}`)
  const raster = demoRaster(42)
  for (const style of Object.keys(STYLES)) {
    const runs = Array.from({ length: 3 }, () => render({ raster, style, seed: 42, options: {} }))
    const times = runs.map(r => Math.round(r.stats.ms))
    console.log(`${style}: ${times.join(', ')} ms; ${runs[0].stats.strokes} strokes; ${runs[0].stats.points} points`)
    if (Math.max(...times) >= 4000) process.exitCode = 1
  }
} finally { await server.close() }
