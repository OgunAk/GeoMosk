import { expect, test, type Page } from '@playwright/test'

// A01-A03 gerçek Bursa verisiyle; arayüz sonucu bağımsız API sorgularıyla karşılaştırılır.

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Sağlık tesisleri/ })).toBeVisible()
  await page.waitForFunction(() => Boolean(window.__geoscopeMap?.getLayer('lyr-analysis-fill')))
}

async function searchAndPick(page: Page, layer: 'districts' | 'facilities', q: string, name: string | RegExp) {
  await page.getByRole('combobox', { name: 'Aranacak katman' }).selectOption(layer)
  await page.getByRole('searchbox', { name: 'Ad ile ara' }).fill(q)
  await page.getByRole('list', { name: 'Arama sonuçları' }).getByRole('button', { name }).first().click()
}

const analysis = (page: Page) => page.getByRole('region', { name: 'Analiz' })
const resultNames = (page: Page) => analysis(page).getByRole('list', { name: 'Analiz sonuçları' }).getByRole('listitem')

test('ilçe içindeki tesisler, aynı politikadaki API filtresiyle aynı sayıyı verir', async ({ page }) => {
  await openApp(page)
  await searchAndPick(page, 'districts', 'nilufer', 'Nilüfer')
  await expect(analysis(page).getByText('Nilüfer', { exact: true })).toBeVisible()

  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  await expect(analysis(page).getByText(/Alan içinde \d+ tesis \(sınır dahil\)/)).toBeVisible()

  const uiCount = await resultNames(page).count()
  const apiCount = await page.evaluate(async () => {
    const d = (await fetch('/api/districts?q=nilufer').then((r) => r.json())) as { features: { id: number }[] }
    const f = (await fetch(`/api/facilities?districtId=${d.features[0].id}&limit=2000`).then((r) => r.json())) as { features: unknown[] }
    return f.features.length
  })
  expect(uiCount).toBeGreaterThan(0)
  expect(uiCount).toBe(apiCount)
  // Girdi alanı haritada çizilir.
  expect(await page.evaluate(() => window.__geoscopeMap!.querySourceFeatures('src-analysis').length)).toBeGreaterThan(0)
})

test('tesis çevresinde 2000 m tampon: tampon çizilir, tüm mesafeler sınır içinde', async ({ page }) => {
  await openApp(page)
  await searchAndPick(page, 'facilities', 'cekirge devlet', /Çekirge Devlet Hastanesi/)
  await analysis(page).getByRole('radio', { name: 'Tampon (yakınlık)' }).check()
  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  await expect(analysis(page).getByText(/2,00 km içinde \d+ tesis/)).toBeVisible()

  const api = await page.evaluate(async () => {
    const s = (await fetch('/api/facilities?q=%C3%A7ekirge%20devlet&limit=1').then((r) => r.json())) as { features: { id: number }[] }
    const r = (await fetch('/api/analysis/buffer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFeature: { layerId: 'facilities', id: s.features[0].id }, radiusMeters: 2000 }),
    }).then((x) => x.json())) as { matches: { features: { properties: { distanceMeters: number } }[] }; input: { geometry: { type: string } } }
    return { distances: r.matches.features.map((f) => f.properties.distanceMeters), type: r.input.geometry.type }
  })
  expect(api.type).toBe('Polygon')
  expect(api.distances.every((d) => d <= 2000)).toBe(true)
  expect(api.distances).toEqual([...api.distances].sort((a, b) => a - b))
  expect(await resultNames(page).count()).toBe(api.distances.length)
})

test('haritada tıklanan noktaya en yakın 5 tesis artan mesafeyle listelenir', async ({ page }) => {
  await openApp(page)
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [29.06, 40.19], zoom: 13 }))
  await analysis(page).getByRole('radio', { name: 'En yakın N' }).check()
  await analysis(page).getByRole('button', { name: 'Haritada nokta seç' }).click()
  const box = (await page.getByTestId('map').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(analysis(page).getByText(/^40\.\d+, 29\.\d+$/)).toBeVisible() // enlem, boylam gösterimi
  await expect(page.getByRole('button', { name: 'Seçimi kapat' })).toHaveCount(0) // nokta seçimi obje seçmez

  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  await expect(analysis(page).getByText('En yakın 5 tesis (kuş uçuşu)')).toBeVisible()
  const items = await resultNames(page).allTextContents()
  expect(items.map((t) => t.trim().split('.')[0])).toEqual(['1', '2', '3', '4', '5'])
  // Kuş uçuşu bağlantılar: 1 nokta + 5 çizgi.
  const features = await page.evaluate(() => window.__geoscopeMap!.getSource('src-analysis')!.serialize())
  expect(JSON.stringify(features)).toContain('connector')

  await analysis(page).getByRole('button', { name: 'Temizle' }).click()
  await expect(analysis(page).getByRole('list', { name: 'Analiz sonuçları' })).toHaveCount(0)
})

test('analiz için çizilen alan kullanıcı katmanına kaydedilmez', async ({ page }) => {
  await openApp(page)
  const before = await page.evaluate(async () => ((await fetch('/api/features').then((r) => r.json())) as { features: unknown[] }).features.length)
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [29.06, 40.19], zoom: 13 }))

  await analysis(page).getByRole('radio', { name: /Çizilen alan/ }).check()
  await analysis(page).getByRole('button', { name: 'Haritada alan çiz' }).click()
  const box = (await page.getByTestId('map').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  for (const [dx, dy] of [[-150, -100], [150, -100], [150, 100], [-150, 100]]) {
    await page.mouse.click(cx + dx, cy + dy)
    await page.waitForTimeout(150)
  }
  await page.getByRole('button', { name: 'Çizimi bitir', exact: true }).click()
  await expect(analysis(page).getByText('hazır')).toBeVisible()
  await expect(page.getByRole('region', { name: /Yeni .* kaydet/ })).toHaveCount(0) // kayıt formu açılmaz

  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  await expect(analysis(page).getByText(/Alan içinde \d+ tesis/)).toBeVisible()
  const after = await page.evaluate(async () => ((await fetch('/api/features').then((r) => r.json())) as { features: unknown[] }).features.length)
  expect(after).toBe(before)
})
