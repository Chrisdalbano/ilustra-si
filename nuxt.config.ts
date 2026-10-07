// ilustra.si — static site (nuxt generate), hosted on GitHub Pages.
const SITE = 'https://ilustra.si/'
const TITLE = 'ilustra.si: photos, drawn in ink'
const DESCRIPTION = 'Turn a photo into a pen-and-ink drawing and watch it drawn stroke by stroke. Plain geometry in your browser, no model, no upload. Exports plotter-ready SVG.'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'ilustra.si',
  url: SITE,
  description: DESCRIPTION,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any (runs in a web browser)',
  browserRequirements: 'Requires JavaScript, Canvas and Web Workers.',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  image: `${SITE}og.png`,
  author: { '@type': 'Person', name: "Chris D'Albano", url: 'https://chrisdalbano.com' },
}

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: true,
  nitro: { preset: 'github-pages', prerender: { routes: ['/flint-hills'] } },
  css: ['@fontsource-variable/inter', '~/assets/css/tokens.css', '~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en', 'data-variant': 'paper' },
      title: TITLE,
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: DESCRIPTION },
        { name: 'theme-color', content: '#f3f0e8' },
        { name: 'author', content: "Chris D'Albano" },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'ilustra.si' },
        { property: 'og:url', content: SITE },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:image', content: `${SITE}og.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'The same procedural sphere drawn three ways: as one continuous line, as cross-hatching and as contour lines.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: `${SITE}og.png` },
      ],
      link: [
        { rel: 'canonical', href: SITE },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd) }],
    },
  },
})
