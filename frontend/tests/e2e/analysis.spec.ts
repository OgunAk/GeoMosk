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

test('analiz paneli hiçbir modda dar yan panelden taşmaz', async ({ page }) => {
  await openApp(page)
  // Panelin iç (padding hariç) sağ kenarını aşan görünür öğe olmamalı.
  const overflowing = () =>
    page.evaluate(() => {
      const s = document.querySelector('[aria-labelledby=analysis-title]')!
      const inner = s.getBoundingClientRect().right - parseFloat(getComputedStyle(s).paddingRight)
      return [...s.querySelectorAll<HTMLElement>('*')]
        .filter((e) => e.offsetParent !== null && e.tagName !== 'OPTION' && e.getBoundingClientRect().right > inner + 0.5)
        .map((e) => e.textContent?.trim().slice(0, 30))
    })

  for (const mode of ['Alan içindekiler', 'Tampon (yakınlık)', 'En yakın N', 'Ölçüm']) {
    await analysis(page).getByRole('radio', { name: mode }).check()
    expect(await overflowing(), mode).toEqual([])
  }
  // Nokta seçildikten sonra (koordinat metni ve "Başka nokta seç") da taşma yok.
  await analysis(page).getByRole('radio', { name: 'En yakın N' }).check()
  await analysis(page).getByRole('button', { name: 'Haritada nokta seç' }).click()
  const box = (await page.getByTestId('map').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(analysis(page).getByRole('button', { name: 'Başka nokta seç' })).toBeVisible()
  expect(await overflowing()).toEqual([])
})

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

test('başka bir ilçe seçilince eski analiz sonucu kaybolur; sonuç listesinden seçim sonucu korur', async ({ page }) => {
  await openApp(page)
  await searchAndPick(page, 'districts', 'nilufer', 'Nilüfer')
  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  const results = analysis(page).getByRole('list', { name: 'Analiz sonuçları' })
  await expect(results).toBeVisible()

  // Sonuç listesindeki bir tesise tıklamak sonucu silmez.
  await results.getByRole('button').first().click()
  await expect(results).toBeVisible()

  // Haritada başka bir ilçeye (Mudanya, boş bir noktası) tıkla: eski sonuç kaybolmalı.
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [28.86, 40.30], zoom: 11 }))
  await page.waitForFunction(() => window.__geoscopeMap!.loaded())
  const box = (await page.getByTestId('map').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect(page.getByRole('heading', { name: 'Nilüfer' })).toHaveCount(0)
  await expect(results).toHaveCount(0)
  await expect(analysis(page).getByRole('button', { name: 'Temizle' })).toHaveCount(0)
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

test('A04: ilçe alanı UTM 35N ile ölçülür; sonuç API ile aynı, sferoid farkı %0,1 altında', async ({ page }) => {
  await openApp(page)
  await searchAndPick(page, 'districts', 'nilufer', 'Nilüfer')
  await analysis(page).getByRole('radio', { name: 'Ölçüm' }).check()
  await analysis(page).getByRole('button', { name: 'Analizi çalıştır' }).click()
  const result = analysis(page).getByLabel('Ölçüm sonuçları')
  await expect(result).toContainText('km²')
  await expect(analysis(page).getByText(/EPSG:32635 \(WGS 84 \/ UTM zone 35N\) projeksiyonunda/)).toBeVisible()

  const api = await page.evaluate(async () => {
    const d = (await fetch('/api/districts?q=nilufer').then((r) => r.json())) as { features: { id: number }[] }
    const r = (await fetch('/api/analysis/measure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFeature: { layerId: 'districts', id: d.features[0].id } }),
    }).then((x) => x.json())) as { measurement: { areaSquareMeters: number; calculationSrid: number; geodesicCheck: { relativeDifference: number } } }
    return r.measurement
  })
  expect(api.calculationSrid).toBe(32635)
  expect(Math.abs(api.geodesicCheck.relativeDifference)).toBeLessThan(1e-3)
  // Nilüfer ≈ 500 km² mertebesinde (makullük; kesin doğruluk backend testlerinde bağımsız referansla).
  expect(api.areaSquareMeters / 1e6).toBeGreaterThan(300)
  expect(api.areaSquareMeters / 1e6).toBeLessThan(800)
  const shown = (api.areaSquareMeters / 1e6).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  await expect(result).toContainText(`${shown} km²`)
})

test('A05: ilçe başına tesis sayısı tabloda ve haritada; toplamlar çifte sayımsız', async ({ page }) => {
  await openApp(page)
  const panel = page.getByRole('region', { name: 'İlçe başına tesis sayısı' })
  await panel.getByRole('button', { name: 'Hesapla' }).click()
  const table = panel.getByRole('table', { name: 'İlçe başına tesis sayısı' })
  await expect(table).toBeVisible()

  const stats = await page.evaluate(async () => {
    const s = (await fetch('/api/analysis/district-stats').then((r) => r.json())) as {
      districts: { id: number; facilityCount: number }[]
      totals: { facilities: number; assigned: number; unassigned: number }
    }
    const all = (await fetch('/api/facilities?limit=2000').then((r) => r.json())) as { features: unknown[] }
    return { ...s, listed: all.features.length }
  })
  expect(stats.districts.reduce((sum, d) => sum + d.facilityCount, 0)).toBe(stats.totals.assigned)
  expect(stats.totals.assigned + stats.totals.unassigned).toBe(stats.totals.facilities)
  expect(stats.totals.facilities).toBe(stats.listed)
  await expect(table.getByRole('row')).toHaveCount(stats.districts.length + 1)
  await expect(panel.getByRole('list', { name: 'Harita lejantı' }).getByRole('listitem').first()).toBeVisible()

  // Choropleth katmanı her ilçeyi boyar ve altlık değişiminden sonra da kalır.
  const painted = () =>
    page.evaluate(() => {
      const map = window.__geoscopeMap!
      // Altlık değişirken stil yeniden kurulur; katman henüz yoksa -1 (poll tekrar dener).
      if (!map.isStyleLoaded() || !map.getLayer('lyr-districts-choropleth')) return -1
      const filter = map.getFilter('lyr-districts-choropleth') as unknown as [string, unknown, [string, number[]]]
      return filter[2][1].length
    })
  await expect.poll(painted).toBe(stats.districts.length)
  await page.getByRole('radio', { name: /Positron/ }).check()
  await expect.poll(painted).toBe(stats.districts.length)

  // Tablodan ilçe seçimi: harita seçimi ve satır vurgusu.
  await table.getByRole('button', { name: 'Nilüfer' }).click()
  await expect(table.getByRole('row', { name: /Nilüfer/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Nilüfer' })).toBeVisible()

  await panel.getByRole('button', { name: 'Kapat' }).click()
  await expect.poll(painted).toBe(0)
})
