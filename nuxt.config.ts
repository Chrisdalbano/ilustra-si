// ilustra.si — static site (nuxt generate), hosted on GitHub Pages.
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: true,
  nitro: { preset: 'github-pages' },
  css: ['@fontsource-variable/inter', '~/assets/css/tokens.css', '~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en', 'data-variant': 'paper' },
      title: 'ilustra.si',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Turn any photo into a pen illustration with pure algorithms. No AI model.' },
      ],
    },
  },
})
