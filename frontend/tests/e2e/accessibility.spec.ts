import { expect, test, type Page } from '@playwright/test'

// Faz 7: dar ekran, yalnız klavye ile temel akış, görünür odak ve erişilemeyen altlık servisi.

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Sağlık tesisleri/ })).toBeVisible()
  await page.waitForFunction(() => Boolean(window.__geoscopeMap?.getLayer('lyr-districts-fill')))
}

test.describe('dar ekran (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('harita görünür alanda, yatay kaydırma yok; panel kendi içinde kayar ve analiz çalışır', async ({ page }) => {
    await openApp(page)
    const map = (await page.getByTestId('map').boundingBox())!
    expect(map.y).toBeLessThan(812)
    expect(map.height).toBeGreaterThan(812 * 0.4)
    expect(map.y + map.height).toBeLessThanOrEqual(812 + 1) // sayfa kaydırması gerekmeden tamamı görünür
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    const aside = page.getByRole('complementary', { name: 'Araçlar ve bilgiler' })
    expect(await aside.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    const stats = page.getByRole('region', { name: 'İlçe başına tesis sayısı' })
    await stats.getByRole('button', { name: 'Hesapla' }).scrollIntoViewIfNeeded()
    await stats.getByRole('button', { name: 'Hesapla' }).click()
    await expect(stats.getByRole('table')).toBeVisible()
    // Panel içeriği dar ekranda yatay taşmaz.
    expect(await aside.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  })
})

test('yalnız klavye: arama → sonuç seçimi → detay paneli; odak görünür', async ({ page }) => {
  await openApp(page)
  await page.getByRole('combobox', { name: 'Aranacak katman' }).selectOption('districts')
  const box = page.getByRole('searchbox', { name: 'Ad ile ara' })
  await box.focus()
  await page.keyboard.type('nilufer')
  await expect(page.getByRole('list', { name: 'Arama sonuçları' }).getByRole('button', { name: /Nilüfer/ })).toBeVisible()

  // Tab ile sonuç düğmesine ulaşılır (fare kullanılmadan).
  let reached = false
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(() => {
      const el = document.activeElement
      return el instanceof HTMLButtonElement && Boolean(el.closest('[aria-label="Arama sonuçları"]')) && /Nilüfer/.test(el.textContent ?? '')
    })
  }
  expect(reached).toBe(true)
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).not.toBe('none') // :focus-visible halkası

  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Nilüfer' })).toBeVisible()
})

test('altlık karo servisi erişilemezse anlaşılır uyarı; veri katmanları çalışmaya devam eder', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort('connectionrefused'))
  await openApp(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Altlık karoları yüklenemedi' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__geoscopeMap!.querySourceFeatures('src-districts').length)).toBeGreaterThan(0)
})
