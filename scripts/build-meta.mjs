import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

// Vite is already supplied by Nuxt/Vitest; its loader works on supported Node 22
// versions without relying on experimental native TypeScript stripping.
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { demoRaster, render, toSVG } = await server.ssrLoadModule('/lib/index.ts')
  const illustration = render({ raster: demoRaster(42), style: 'oneline', seed: 42, options: {} })
  const publicDir = new URL('../public/', import.meta.url)
  await mkdir(publicDir, { recursive: true })
  const files = {
    'llms.txt': `# ilustra.si\n\nTurn a photo into a pen-and-ink illustration drawn stroke by stroke, then export plotter-ready SVG.\n\nAll rendering runs client-side in the browser in a Web Worker. Photos are not uploaded. There is no AI model, machine learning inference, or rendering service. The core is dependency-free TypeScript computational geometry.\n\nAlgorithms:\n- Stipple: density-weighted Voronoi stippling with Lloyd relaxation and grid-accelerated nearest search.\n- One line: spatial-grid nearest-neighbour travelling-salesman tour with budgeted 2-opt improvement.\n- Hatch: tone-thresholded layered cross-hatching, clipped into runs with seeded wobble.\n- Contour: gradient-perpendicular streamlines with Jobard-Lefer style spacing and seeding.\n- Scribble: one continuous looping path with tone-dependent radius and traversal speed.\n\nExperiment page: https://ilustra.si/flint-hills draws the Flint Hills series 1/(n^3 sin^2 n) for n up to 10^7 as a log-log skyline with the same pen engine, after the September 2026 result that the irrationality exponent of pi is 2 (openai/math family 017). Spike heights at the convergents p_k/q_k of pi follow (alpha_{k+1} + q_{k-1}/q_k)^2 / (pi^3 q_k).\n\nhttps://ilustra.si/\n`,
    'robots.txt': 'User-agent: *\nAllow: /\n\nSitemap: https://ilustra.si/sitemap.xml\n',
    'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://ilustra.si/</loc></url><url><loc>https://ilustra.si/flint-hills</loc></url></urlset>\n',
    'demo.svg': toSVG(illustration, { ink: '#24211d', paper: '#faf7ef' }),
  }
  await Promise.all(Object.entries(files).map(([name, text]) => writeFile(new URL(name, publicDir), text)))
  console.log(`Wrote ${Object.keys(files).join(', ')} (demo: ${illustration.stats.ms.toFixed(0)} ms)`)
} finally {
  await server.close()
}
