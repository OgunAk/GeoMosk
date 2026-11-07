import { expect, test, type Page } from '@playwright/test'

// Harita örneğine yalnızca durum okumak için erişilir (window.__geomoskMap); etkileşim kullanıcı gibi yapılır.
type Probe = { layers: string[]; visibility: Record<string, string | undefined>; hasBasemapVector: boolean; zoom: number }

const EMPTY: Probe = { layers: [], visibility: {}, hasBasemapVector: false, zoom: 0 }

async function probe(page: Page): Promise<Probe> {
  return page.evaluate((empty) => {
    const map = window.__geomoskMap
    // Stil değişimi sırasında getStyle() kısa süre boş döner: "henüz hazır değil" olarak raporlanır.
    const style = map?.getStyle()
    if (!map || !style?.layers) return empty
    const ours = style.layers.map((l) => l.id).filter((id) => id.startsWith('lyr-') && id !== 'lyr-basemap-osm')
    return {
      layers: ours,
      visibility: Object.fromEntries(ours.map((id) => [id, map.getLayoutProperty(id, 'visibility') as string | undefined])),
      hasBasemapVector: 'openmaptiles' in style.sources,
      zoom: map.getZoom(),
    }
  }, EMPTY)
}

// Uygulamanın kendi rendering katmanları: 8 kaynak (ilçe/tesis + choropleth) + 5 kullanıcı çizimi + 4 analiz + 1 WMS.
const OUR_LAYER_COUNT = 18

async function openApp(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Sağlık tesisleri/ })).toBeVisible()
  await expect.poll(async () => (await probe(page)).layers.length, { timeout: 20_000 }).toBe(OUR_LAYER_COUNT)
  return errors
}

test('harita gerçek veriyle iki katmanı gösterir', async ({ page }) => {
  const errors = await openApp(page)

  const layersSection = page.getByRole('region', { name: 'Katmanlar' })
  await expect(layersSection.getByText('17')).toBeVisible()
  await expect(layersSection.getByText('911')).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap')
  expect(errors).toEqual([])
})

test('katman aç/kapa ve altlık değişiminde katmanlar ve durum korunur', async ({ page }) => {
  await openApp(page)
  await page.getByRole('checkbox', { name: /Sağlık tesisleri/ }).uncheck()
  await expect.poll(async () => (await probe(page)).visibility['lyr-facilities-circle']).toBe('none')

  await page.getByRole('radio', { name: /Positron/ }).check()

  await expect.poll(async () => (await probe(page)).hasBasemapVector, { timeout: 20_000 }).toBe(true)
  await expect.poll(async () => (await probe(page)).layers.length).toBe(OUR_LAYER_COUNT)
  const afterSwitch = await probe(page)
  expect(afterSwitch.visibility['lyr-facilities-circle']).toBe('none') // gizli kalmalı
  expect(afterSwitch.visibility['lyr-districts-line']).toBe('visible')

  await page.getByRole('checkbox', { name: /Sağlık tesisleri/ }).check()
  await page.getByRole('radio', { name: 'OSM Standart' }).check()
  await expect.poll(async () => (await probe(page)).hasBasemapVector, { timeout: 20_000 }).toBe(false)
  await expect.poll(async () => (await probe(page)).visibility['lyr-facilities-circle']).toBe('visible')
})

test('orta tuşla sürükleyince harita kayar, seçim yapılmaz', async ({ page }) => {
  await openApp(page)
  const center = () => page.evaluate(() => window.__geomoskMap!.getCenter().toArray())
  const before = await center()
  const box = (await page.getByTestId('map').boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(start.x + 200, start.y + 100, { steps: 10 })
  await page.mouse.up({ button: 'middle' })

  const after = await center()
  expect(after[0]).toBeLessThan(before[0]) // sağa sürükleme → merkez batıya (boylam azalır)
  expect(after[1]).toBeGreaterThan(before[1]) // aşağı sürükleme → merkez kuzeye (enlem artar)
  await expect(page.getByRole('button', { name: 'Seçimi kapat' })).toHaveCount(0) // orta tık seçim açmaz
})

test('tesis türü filtresi haritaya uygulanır ve altlık değişiminde korunur', async ({ page }) => {
  await openApp(page)
  const filter = () => page.evaluate(() => JSON.stringify(window.__geomoskMap?.getFilter('lyr-facilities-circle') ?? null))

  await page.getByRole('checkbox', { name: /Eczane/ }).uncheck()
  await expect.poll(filter).not.toContain('pharmacy')
  expect(await filter()).toContain('hospital')

  await page.getByRole('radio', { name: /Positron/ }).check()
  await expect.poll(async () => (await probe(page)).hasBasemapVector, { timeout: 20_000 }).toBe(true)
  await expect.poll(async () => (await probe(page)).layers.length).toBe(OUR_LAYER_COUNT)
  await expect.poll(filter).not.toContain('pharmacy')

  await page.getByRole('checkbox', { name: /Eczane/ }).check()
  await expect.poll(filter).toContain('pharmacy')
})

test('Türkçe aksansız arama sonucu vurgular, seçer ve objeye zoom yapar', async ({ page }) => {
  await openApp(page)
  const zoomBefore = (await probe(page)).zoom

  await page.getByRole('combobox', { name: 'Aranacak katman' }).selectOption('districts')
  await page.getByRole('searchbox', { name: 'Ad ile ara' }).fill('nilufer')
  const result = page.getByRole('list', { name: 'Arama sonuçları' }).getByRole('button', { name: 'Nilüfer' })
  await expect(result).toBeVisible()
  await result.click()

  await expect(page.getByRole('heading', { name: 'Nilüfer' })).toBeVisible()
  await expect.poll(async () => (await probe(page)).zoom, { timeout: 10_000 }).toBeGreaterThan(zoomBefore)
  const filters = await page.evaluate(() => ({
    highlight: JSON.stringify(window.__geomoskMap!.getFilter('lyr-districts-highlight')),
    selected: JSON.stringify(window.__geomoskMap!.getFilter('lyr-districts-selected')),
  }))
  expect(filters.highlight).not.toContain('[]')
  expect(filters.selected).not.toContain('[]')
})

test('haritada tesise tıklayınca öznitelikler yan panelde görünür', async ({ page }) => {
  await openApp(page)
  // Bilinen gerçek kayıt: arama ile koordinatını al, harita üzerinde o piksele tıkla.
  const feature = await page.evaluate(async () => {
    const r = (await fetch('/api/facilities?q=%C3%A7ekirge%20devlet&limit=1').then((x) => x.json())) as {
      features: { geometry: { coordinates: [number, number] }; properties: { name: string } }[]
    }
    return r.features[0]
  })
  await page.evaluate(([lon, lat]) => window.__geomoskMap!.jumpTo({ center: [lon, lat], zoom: 15 }), feature.geometry.coordinates)
  await page.waitForFunction(() => window.__geomoskMap!.loaded())
  const point = await page.evaluate(([lon, lat]) => window.__geomoskMap!.project([lon, lat]), feature.geometry.coordinates)
  const box = (await page.getByTestId('map').boundingBox())!

  await page.mouse.click(box.x + point.x, box.y + point.y)

  const details = page.getByRole('region', { name: feature.properties.name })
  await expect(details).toBeVisible()
  await expect(details.getByText('Hastane', { exact: true })).toBeVisible() // lejanttaki "Hastane" ile karışmasın
  await expect(details.getByText(/temsilî bir noktadır/)).toBeVisible() // OSM way'den üretilmiş nokta
})

// Geliştirici demosu (2026-11-06): tesise tek tıklama yaklaştırır; ilçeye tıklama haritayı oynatmaz.
test('tesise tek tıklayınca harita tesise yaklaşır; ilçeye tıklama kamerayı değiştirmez', async ({ page }) => {
  await openApp(page)
  const coords = await page.evaluate(async () => {
    const r = (await fetch('/api/facilities?q=%C3%A7ekirge%20devlet&limit=1').then((x) => x.json())) as {
      features: { geometry: { coordinates: [number, number] } }[]
    }
    return r.features[0].geometry.coordinates
  })
  const box = (await page.getByTestId('map').boundingBox())!
  const camera = () =>
    page.evaluate(() => {
      const m = window.__geomoskMap!
      return { zoom: m.getZoom(), lng: m.getCenter().lng, lat: m.getCenter().lat }
    })

  // Tesisi merkezden uzakta ve zoom 13'te göster; tek tıkla.
  await page.evaluate(([lon, lat]) => window.__geomoskMap!.jumpTo({ center: [lon + 0.01, lat + 0.005], zoom: 13 }), coords)
  await page.waitForFunction(() => window.__geomoskMap!.loaded())
  const point = await page.evaluate(([lon, lat]) => window.__geomoskMap!.project([lon, lat]), coords)
  await page.mouse.click(box.x + point.x, box.y + point.y)

  await expect.poll(async () => (await camera()).zoom).toBeGreaterThanOrEqual(15.99)
  const after = await camera()
  expect(Math.abs(after.lng - coords[0])).toBeLessThan(1e-4)
  expect(Math.abs(after.lat - coords[1])).toBeLessThan(1e-4)

  // İlçe içinde boş bir yere tıklama: ilçe seçilir, kamera yerinde kalır.
  await page.evaluate(() => window.__geomoskMap!.jumpTo({ center: [28.95, 40.15], zoom: 11 }))
  await page.waitForFunction(() => window.__geomoskMap!.loaded())
  const before = await camera()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByRole('heading', { name: 'Nilüfer' })).toBeVisible()
  await page.waitForTimeout(800) // olası bir easeTo süresinden (600 ms) uzun
  expect(await camera()).toEqual(before)
})

test('yerel açıklama kaydedilir, yenilemede korunur ve geri alınır', async ({ page }) => {
  const note = `E2E notu ${Date.now()}`
  await openApp(page)
  const openNilufer = async () => {
    await page.getByRole('combobox', { name: 'Aranacak katman' }).selectOption('districts')
    await page.getByRole('searchbox', { name: 'Ad ile ara' }).fill('nilufer')
    await page.getByRole('list', { name: 'Arama sonuçları' }).getByRole('button', { name: 'Nilüfer' }).click()
    await expect(page.getByRole('heading', { name: 'Nilüfer' })).toBeVisible()
  }

  const details = page.getByRole('region', { name: 'Nilüfer' })
  // Kayıt bitene kadar beklenir (düzenleyici kapanır); aksi halde yenileme süren PATCH'i iptal eder.
  const save = async (text: string) => {
    await details.getByRole('button', { name: 'Düzenle' }).click()
    await details.getByLabel('Açıklama').fill(text)
    await details.getByRole('button', { name: 'Kaydet' }).click()
    await expect(details.getByRole('button', { name: 'Düzenle' })).toBeVisible()
  }

  await openNilufer()
  await save(note)
  await expect(details.getByRole('definition').filter({ hasText: note })).toBeVisible()

  await page.reload()
  await openApp(page)
  await openNilufer()
  await expect(details.getByRole('definition').filter({ hasText: note })).toBeVisible()

  // Paylaşılan veriyi temizle: açıklamayı kaldır.
  await save('')
  await expect(details.getByText(note)).toHaveCount(0)
})
