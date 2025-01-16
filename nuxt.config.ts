// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  build: {
    transpile:
      process.env.NODE_ENV === 'production'
        ? [
            'naive-ui',
            '@css-render/vue3-ssr',
            '@juggle/resize-observer'
          ]
        : ['@juggle/resize-observer']
  },

  vite: {
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
      include: [
        'naive-ui',
        '@css-render/vue3-ssr',
        '@vicons/carbon',
        '@vicons/ionicons5',
        'pinia',
        'jszip'
      ]
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'naive-ui': ['naive-ui']
          }
        }
      }
    },
    server: {
      hmr: {
        overlay: false
      }
    },
    // 开发模式性能优化
    define: {
      __VUE_OPTIONS_API__: false
    },
    // 配置缓存
    cacheDir: 'node_modules/.vite',
    ssr: {
      noExternal: ['naive-ui', '@css-render/vue3-ssr']
    }
  },

  compatibilityDate: '2025-01-14',

  nitro: {
    routeRules: {
      '/ffmpeg/**': {
        headers: {
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin'
        }
      }
    },
    devStorage: {
      data: {
        driver: 'fs',
        base: './storage'
      }
    }
  },

  app: {
    head: {
      meta: [
        { 'http-equiv': 'Cross-Origin-Embedder-Policy', content: 'require-corp' },
        { 'http-equiv': 'Cross-Origin-Opener-Policy', content: 'same-origin' }
      ]
    }
  }
})