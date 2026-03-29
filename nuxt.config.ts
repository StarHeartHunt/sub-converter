// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],

  nitro: {
    preset: 'node-server',
  },

  app: {
    head: {
      title: 'Sub Converter - 订阅转换',
      meta: [
        { name: 'description', content: 'VPN 订阅转换工具，支持 Clash、V2Ray、Surge、QuantumultX、sing-box 等客户端' },
      ],
    },
  },
})
