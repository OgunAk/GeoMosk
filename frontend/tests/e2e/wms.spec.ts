import { expect, test, type Page, type Route } from '@playwright/test'

// PDF §5 (opsiyonel): harici WMS raster katmanı. Dış servis bağımlılığı kontrollü fixture ile azaltılır:
// istekler yakalanıp doğrulanır ve 1×1 PNG ile yanıtlanır. Gerçek servis ayrıca elle denenir (TEST-PLAN).
const WMS_HOST = 'https://image.discomap.eea.europa.eu/**'
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Sağlık tesisleri/ })).toBeVisible()
  await page.waitForFunction(() => Boolean(window.__geomoskMap?.getLayer('lyr-wms-corine')))
}

const visibility = (page: Page) =>
  page.evaluate(() => window.__geomoskMap!.getLayoutProperty('lyr-wms-corine', 'visibility') as string)

test('WMS katmanı kapalı başlar, açılınca EPSG:3857 GetMap ister ve altlık değişiminde korunur', async ({ page }) => {
  const requests: URL[] = []
  await page.route(WMS_HOST, (route: Route) => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  await openApp(page)
  const toggle = page.getByRole('checkbox', { name: /CORINE 2018 \(WMS\)/ })

  await expect(toggle).not.toBeChecked()
  expect(await visibility(page)).toBe('none')
  expect(requests).toHaveLength(0) // kapalıyken dış servise istek yok

  await toggle.check()
  await expect.poll(() => visibility(page)).toBe('visible')
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  const p = Object.fromEntries(requests[0].searchParams)
  expect(p).toMatchObject({ SERVICE: 'WMS', REQUEST: 'GetMap', LAYERS: '12', SRS: 'EPSG:3857', FORMAT: 'image/png' })
  const bbox = p.BBOX.split(',').map(Number)
  expect(bbox).toHaveLength(4)
  // Bursa görünümü EPSG:3857 metre koordinatlarında (≈ x 3,1-3,4 milyon, y 4,7-5,0 milyon); derece değil.
  expect(bbox[0]).toBeGreaterThan(2_500_000)
  expect(bbox[3]).toBeGreaterThan(4_000_000)
  // Katman altlığın üstünde, veri katmanlarının altında.
  const order = await page.evaluate(() => window.__geomoskMap!.getStyle().layers.map((l) => l.id))
  expect(order.indexOf('lyr-wms-corine')).toBeLessThan(order.indexOf('lyr-districts-fill'))
  // Atıf haritada görünür.
  await expect(page.getByText(/Copernicus Land Monitoring Service/)).toBeVisible()

  await page.getByRole('radio', { name: /Positron/ }).check()
  await expect.poll(() => page.evaluate(() => Boolean(window.__geomoskMap!.getLayer('lyr-wms-corine'))), { timeout: 20_000 }).toBe(true)
  await expect.poll(() => visibility(page)).toBe('visible')

  await toggle.uncheck()
  await expect.poll(() => visibility(page)).toBe('none')
})

test('WMS servisi yanıt vermezse anlaşılır uyarı; diğer katmanlar çalışır', async ({ page }) => {
  await page.route(WMS_HOST, (route: Route) => route.fulfill({ status: 503, body: 'down' }))
  await openApp(page)
  await page.getByRole('checkbox', { name: /CORINE 2018 \(WMS\)/ }).check()
  await expect(page.getByRole('alert').filter({ hasText: 'WMS servisi (CORINE) yanıt vermiyor' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Altlık karoları yüklenemedi' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__geomoskMap!.querySourceFeatures('src-districts').length)).toBeGreaterThan(0)
})
