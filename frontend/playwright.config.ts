import { defineConfig } from '@playwright/test'

// Uçtan uca testler çalışan Compose ortamına karşı koşar (gerçek API + PostGIS + import edilmiş veri):
//   docker compose up --build -d && docker compose --profile tools run --rm import
//   npm --prefix frontend run e2e
// Yerelde kurulu Chrome kullanılır; CI'da PW_CHANNEL boş bırakılıp `npx playwright install chromium` çalıştırılır.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : 'chrome')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // düzenleme testi paylaşılan veriyi değiştirir; sıralı ve kendini geri alan senaryolar
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    channel,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
