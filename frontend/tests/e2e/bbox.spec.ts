import { expect, test, type Page } from '@playwright/test'

// PDF "bbox ile filtreleme": tesisler görünen alana göre istenir (ADR-0016). Gerçek veri, gerçek tarayıcı.

const facilityRequests = (page: Page) => {
  const urls: URL[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.pathname === '/api/facilities' && u.searchParams.has('bbox')) urls.push(u)
  })
  return urls
}

const loadedFacilities = (page: Page) =>
  page.evaluate(() => {
    const data = window.__geoscopeMap!.getSource('src-facilities')?.serialize().data as { features?: unknown[] } | undefined
    return data?.features?.length ?? -1
  })

async function settle(page: Page) {
  await page.waitForTimeout(600) // VIEW_DEBOUNCE_MS (250) + istek
  await page.waitForFunction(() => window.__geoscopeMap!.loaded())
}

test('tesisler görünen kutuyla istenir; kutu içi kaydırma yeni istek atmaz, dışına çıkınca yeni kutu istenir', async ({ page }) => {
  const requests = facilityRequests(page)
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: /Sağlık tesisleri/ })).toBeVisible()
  await settle(page)

  // İlk istek: bbox parametreli, ilk görünümü (Bursa geneli) kapsıyor; gerçek verinin tamamı (911) sığar.
  expect(requests).toHaveLength(1)
  const [w, s, e, n] = requests[0].searchParams.get('bbox')!.split(',').map(Number)
  expect(w).toBeLessThan(29.06)
  expect(e).toBeGreaterThan(29.06)
  expect(s).toBeLessThan(40.19)
  expect(n).toBeGreaterThan(40.19)
  await expect.poll(() => loadedFacilities(page)).toBe(911)
  await expect(page.getByText(/görünen alana göre \(bbox\) yüklenir/)).toBeVisible()

  // Kutunun içinde yakınlaşma: sınır aşılmadığı için yeni istek yok.
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [29.06, 40.19], zoom: 12 }))
  await settle(page)
  expect(requests).toHaveLength(1)

  // Açılış kutusu (zoom 8 görünümü + %50 pay) ≈ 10° genişliğinde; içinde kalan her hareket mevcut veriyle karşılanır.
  // Kutunun dışına çıkınca (doğuda, Bursa dışı, zoom 13) yeni ve çok daha küçük kutu istenir; orada tesis yok.
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [36.5, 39.0], zoom: 13 }))
  await settle(page)
  await expect.poll(() => requests.length).toBe(2)
  const second = requests[1].searchParams.get('bbox')!.split(',').map(Number)
  expect(second[2] - second[0]).toBeLessThan((e - w) / 10)
  await expect.poll(() => loadedFacilities(page)).toBe(0)

  // Bursa merkezine zoom 13'te dönünce yalnız o çevrenin tesisleri gelir (911'den az, sıfırdan çok).
  await page.evaluate(() => window.__geoscopeMap!.jumpTo({ center: [29.06, 40.19], zoom: 13 }))
  await settle(page)
  await expect.poll(() => requests.length).toBe(3)
  await expect.poll(() => loadedFacilities(page)).toBeGreaterThan(0)
  expect(await loadedFacilities(page)).toBeLessThan(911)
})
