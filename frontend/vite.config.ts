/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      // Geliştirmede tarayıcı aynı origin'e (/api) istek atar; Vite yerel API'ye aktarır.
      proxy: {
        '/api': env.VITE_DEV_API_PROXY ?? 'http://localhost:5080',
      },
    },
    build: {
      // MapLibre GL tek ve bölünemez bir kütüphane (≈1050 kB, gzip ≈287 kB); uyarı eşiği yalnız onu kapsayacak kadar yükseltildi.
      // Uygulama kodu ayrı parçada (≈67 kB). Ölçüm: docs/TEST-PLAN.md "Performans".
      chunkSizeWarningLimit: 1100,
      rolldownOptions: {
        output: {
          // Büyük ve seyrek değişen kütüphaneler ayrı parçalarda: uygulama kodu değişince tarayıcı önbelleği korunur.
          codeSplitting: {
            groups: [
              { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
              { name: 'terra-draw', test: /node_modules[\\/]terra-draw/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
