import { expect, test, type Page } from '@playwright/test'

// Çizim akışları gerçek tarayıcıda, gerçek API + PostGIS ile. Her test kendi oluşturduğu kaydı siler.
// Kırsal ve boş bir alan seçilir: tıklamalar mevcut kayıtlara denk gelmesin (Bursa çalışma alanı içinde).
const AREA_CENTER: [number, number] = [29.33, 40.32]

// Önceki başarısız koşulardan kalmış test kayıtlarını API ile temizle (yalnız "E2E " önekli kullanıcı çizimleri).
test.beforeEach(async ({ request }) => {
  const list = (await (await request.get('/api/features?limit=2000')).json()) as { features: { id: string; properties: { name: string } }[] }
  for (const f of list.features.filter((x) => x.properties.name.startsWith('E2E '))) {
    const current = await request.get(`/api/features/${f.id}`)
    await request.delete(`/api/features/${f.id}`, { headers: { 'If-Match': current.headers()['etag'] } })
  }
})

/** Kullanıcı çizimi haritanın kaynağına yüklenene kadar bekle (tıklama ancak o zaman isabet eder). */
async function waitForUserFeature(page: Page, name: string) {
  await page.waitForFunction(
    (n) => window.__geomoskMap!.querySourceFeatures('src-user-features').some((f) => f.properties?.name === n),
    name,
  )
}

async function openAtArea(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Kullanıcı çizimleri/ })).toBeVisible()
  await page.waitForFunction(() => Boolean(window.__geomoskMap?.getLayer('lyr-user-point')))
  // Zoom 14: test köşelerinin (merkezden en çok ±0.01°) hepsi harita alanında kalır.
  await page.evaluate((center) => window.__geomoskMap!.jumpTo({ center, zoom: 14 }), AREA_CENTER)
  await page.waitForFunction(() => window.__geomoskMap!.loaded())
}

/** Harita üzerindeki [boylam, enlem] konumunun sayfa koordinatı. */
async function screenPoint(page: Page, lonLat: [number, number]) {
  const p = await page.evaluate((ll) => window.__geomoskMap!.project(ll), lonLat)
  const box = (await page.getByTestId('map').boundingBox())!
  return { x: box.x + p.x, y: box.y + p.y }
}

async function clickAt(page: Page, lonLat: [number, number]) {
  const { x, y } = await screenPoint(page, lonLat)
  await page.mouse.click(x, y)
  await page.waitForTimeout(150) // Terra Draw tıklamaları ayrı olay olarak işlesin
}

const offset = (dLon: number, dLat: number): [number, number] => [AREA_CENTER[0] + dLon, AREA_CENTER[1] + dLat]

async function saveDraft(page: Page, name: string) {
  const form = page.getByRole('region', { name: /Yeni .* kaydet/ })
  await expect(form).toBeVisible()
  await form.getByLabel('Ad (zorunlu)').fill(name)
  await form.getByRole('button', { name: 'Kaydet' }).click()
  const panel = page.getByRole('region', { name })
  await expect(panel).toBeVisible()
  return panel
}

async function apiFeatureByName(page: Page, name: string) {
  return page.evaluate(async (n) => {
    const r = (await fetch('/api/features?limit=2000').then((x) => x.json())) as {
      features: { id: string; geometry: { type: string; coordinates: unknown }; properties: { name: string } }[]
    }
    return r.features.find((f) => f.properties.name === n) ?? null
  }, name)
}

async function deleteViaUi(page: Page, name: string) {
  const panel = page.getByRole('region', { name })
  await panel.getByRole('button', { name: 'Sil' }).click()
  await panel.getByRole('button', { name: 'Evet, sil' }).click()
  await expect(panel).toHaveCount(0)
  expect(await apiFeatureByName(page, name)).toBeNull()
}

test('nokta çizilir, kaydedilir, yenilemede korunur ve onayla silinir', async ({ page }) => {
  const name = `E2E nokta ${Date.now()}`
  await openAtArea(page)

  await page.getByRole('button', { name: 'Nokta', exact: true }).click()
  await clickAt(page, AREA_CENTER)
  const panel = await saveDraft(page, name)
  await expect(panel.getByText('Nokta', { exact: true })).toBeVisible()

  const saved = await apiFeatureByName(page, name)
  expect(saved?.geometry.type).toBe('Point')
  const [lon, lat] = saved!.geometry.coordinates as [number, number]
  expect(lon).toBeCloseTo(AREA_CENTER[0], 3) // [boylam, enlem] sırası korunur
  expect(lat).toBeCloseTo(AREA_CENTER[1], 3)

  await page.reload()
  await openAtArea(page)
  await waitForUserFeature(page, name)
  await clickAt(page, AREA_CENTER) // kayıtlı noktaya tıklayınca panel açılır
  await expect(page.getByRole('region', { name })).toBeVisible()
  await deleteViaUi(page, name)
})

test('çizgi ve alan çizilir; alanın adı ve geometrisi düzenlenir', async ({ page }) => {
  const lineName = `E2E çizgi ${Date.now()}`
  const areaName = `E2E alan ${Date.now()}`
  await openAtArea(page)

  // Çizgi: köşeler + sağ tıklamayla bitir; sağ tıklama köşe eklememeli.
  await page.getByRole('button', { name: 'Çizgi', exact: true }).click()
  await clickAt(page, offset(-0.004, -0.002))
  await clickAt(page, offset(0, 0.002))
  await clickAt(page, offset(0.004, -0.002))
  const finishAt = await screenPoint(page, offset(0.006, 0.002))
  await page.mouse.click(finishAt.x, finishAt.y, { button: 'right' })
  await saveDraft(page, lineName)
  const line = await apiFeatureByName(page, lineName)
  expect(line?.geometry.type).toBe('LineString')
  expect((line!.geometry.coordinates as unknown[]).length).toBe(3) // fare imleci ek köşe olarak kaydedilmez
  await page.getByRole('region', { name: lineName }).getByRole('button', { name: 'Seçimi kapat' }).click()

  // Alan: üç köşe + "Çizimi bitir" düğmesi; ilk noktaya tıklamak gerekmez, alan otomatik kapanır.
  await page.getByRole('button', { name: 'Alan', exact: true }).click()
  await clickAt(page, offset(-0.003, 0.004))
  await clickAt(page, offset(0.003, 0.004))
  await clickAt(page, offset(0.003, 0.008))
  // Çizim sürerken orta tuşla kaydırmak köşe eklememeli.
  const mid = await screenPoint(page, offset(0, 0.006))
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(mid.x + 40, mid.y + 20, { steps: 5 })
  await page.mouse.up({ button: 'middle' })
  await page.getByRole('button', { name: 'Çizimi bitir' }).click()
  const panel = await saveDraft(page, areaName)
  const before = await apiFeatureByName(page, areaName)
  expect(before?.geometry.type).toBe('Polygon')
  const ring = (before!.geometry.coordinates as number[][][])[0]
  expect(ring.length).toBe(4) // 3 köşe + kapanış
  expect(ring[0]).toEqual(ring[3])

  // Geometri düzenleme: bir köşeyi sürükle, kaydet.
  await panel.getByRole('button', { name: 'Geometriyi düzenle' }).click()
  await page.waitForTimeout(300)
  const from = await screenPoint(page, offset(0.003, 0.008))
  const to = await screenPoint(page, offset(0.006, 0.010))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await panel.getByRole('button', { name: 'Geometriyi kaydet' }).click()
  await expect(panel.getByRole('button', { name: 'Geometriyi düzenle' })).toBeVisible()
  const after = await apiFeatureByName(page, areaName)
  expect(JSON.stringify(after?.geometry.coordinates)).not.toBe(JSON.stringify(before?.geometry.coordinates))

  // Sözel düzenleme
  await panel.getByRole('button', { name: 'Düzenle', exact: true }).click()
  await panel.getByLabel('Açıklama').fill('E2E açıklama')
  await panel.getByRole('button', { name: 'Kaydet' }).click()
  await expect(panel.getByRole('definition').filter({ hasText: 'E2E açıklama' })).toBeVisible()

  await deleteViaUi(page, areaName)
  await waitForUserFeature(page, lineName)
  await clickAt(page, offset(0, 0.002)) // çizgiyi köşesinden seç
  await expect(page.getByRole('region', { name: lineName })).toBeVisible()
  await deleteViaUi(page, lineName)
})

test('altlık değişince taslak korunur ve doğru konumla kaydedilir', async ({ page }) => {
  const name = `E2E altlık ${Date.now()}`
  await openAtArea(page)
  await page.getByRole('button', { name: 'Nokta', exact: true }).click()
  await clickAt(page, AREA_CENTER)
  await expect(page.getByRole('region', { name: /Yeni nokta kaydet/ })).toBeVisible()

  await page.getByRole('radio', { name: /Positron/ }).check()
  // Geçiş sırasında getStyle() kısa süre boş döner.
  await page.waitForFunction(() => 'openmaptiles' in (window.__geomoskMap!.getStyle()?.sources ?? {}))
  await page.waitForFunction(() => (window.__geomoskMap!.getStyle()?.layers ?? []).some((l) => l.id.startsWith('td')))

  await saveDraft(page, name)
  const saved = await apiFeatureByName(page, name)
  expect((saved!.geometry.coordinates as number[])[0]).toBeCloseTo(AREA_CENTER[0], 3)
  await deleteViaUi(page, name)
})

test('sunucu hatasında taslak ve form korunur, tekrar denenince kaydedilir', async ({ page }) => {
  const name = `E2E hata ${Date.now()}`
  await openAtArea(page)
  await page.route('**/api/features', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Hizmet geçici olarak kullanılamıyor.' }) })
      : route.continue(),
  )

  await page.getByRole('button', { name: 'Nokta', exact: true }).click()
  await clickAt(page, AREA_CENTER)
  const form = page.getByRole('region', { name: /Yeni nokta kaydet/ })
  await form.getByLabel('Ad (zorunlu)').fill(name)
  await form.getByRole('button', { name: 'Kaydet' }).click()
  await expect(form.getByRole('alert')).toContainText('Hizmet geçici olarak kullanılamıyor')
  await expect(form.getByLabel('Ad (zorunlu)')).toHaveValue(name) // form ve taslak duruyor
  expect(await apiFeatureByName(page, name)).toBeNull()

  await page.unroute('**/api/features')
  await form.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByRole('region', { name })).toBeVisible()
  await deleteViaUi(page, name)
})
