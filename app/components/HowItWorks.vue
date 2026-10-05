<script setup lang="ts">
const ENTRIES = [
  {
    name: 'Stipple',
    body: 'Dots are scattered with more of them where the photo is dark, then each dot moves to the tone-weighted centre of its Voronoi cell. Repeat that a few times (Lloyd relaxation) and the dots spread out evenly without losing the shading.',
  },
  {
    name: 'One line',
    body: 'The stipple dots become stops on a travelling-salesman tour, built by always walking to the nearest unvisited dot. Then 2-opt swaps pairs of edges whenever that makes the route shorter, which untangles most of the crossings.',
  },
  {
    name: 'Hatch',
    body: 'The photo is split into tone thresholds, and each darker threshold adds another layer of parallel lines at a new angle. Lines start and stop where the tone crosses its threshold, with a little wobble so they read as drawn.',
  },
  {
    name: 'Contour',
    body: 'The image gradient points from light to dark, and these lines run perpendicular to it, around shapes, like contours on a map. New lines are seeded at a set distance beside existing ones, so they never crowd, and they spread further apart where the photo is light.',
  },
  {
    name: 'Scribble',
    body: 'One pen wanders from dark patch to dark patch while drawing small loops. Where the photo is darker the loops get bigger and the pen slows down, so more ink lands there.',
  },
]
</script>

<template>
  <section id="how" class="how">
    <h2>How it works</h2>
    <p class="lede">
      No model, no server. Each style is a small piece of computational geometry that runs in a worker thread in your browser, and the same photo, settings and seed always give the same drawing.
    </p>
    <dl>
      <div v-for="e in ENTRIES" :key="e.name">
        <dt>{{ e.name }}</dt>
        <dd>{{ e.body }}</dd>
      </div>
    </dl>
    <p class="plotter">
      The SVG is plotter-ready: one path per stroke, no fills, no transforms, ordered to keep pen-up travel short. Open it in the AxiDraw extension for Inkscape, or whatever drives your plotter, and set the scale there.
      A plain-text summary for crawlers and language models is at <a href="/llms.txt">/llms.txt</a>.
    </p>
  </section>
</template>

<style scoped>
.how { display: grid; gap: 32px; }
h2 { margin: 0; font-size: clamp(32px, 4.4vw, 60px); font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
.lede, .plotter { margin: 0; max-width: 62ch; font-size: 18px; line-height: 1.55; color: var(--fg-secondary); }
dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0; border-top: 1px solid var(--fg-primary); }
dl > div { padding: 20px 24px 28px 0; border-bottom: 1px solid var(--border); }
dt { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 10px; }
dd { margin: 0; font-size: 15px; line-height: 1.6; color: var(--fg-secondary); }
</style>
