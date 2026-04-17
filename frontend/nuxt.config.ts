import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/google-fonts', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      title: 'Estate Commission Flow',
      htmlAttrs: { lang: 'en-GB' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Operations dashboard for estate agency transactions and commission settlements.',
        },
      ],
    },
  },

  googleFonts: {
    display: 'swap',
    preload: true,
    families: {
      Manrope: [400, 500, 600, 700, 800],
      Inter: [400, 500, 600, 700],
    },
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  imports: {
    dirs: ['stores/**', 'composables/**'],
  },
});
