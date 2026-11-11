import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Bbox } from './geometry'
import { useSourceLayers } from './useSourceLayers'

const page = (names: string[], hasMore = false) => ({
  type: 'FeatureCollection',
  features: names.map((name, i) => ({ type: 'Feature', id: i + 1, geometry: { type: 'Point', coordinates: [29, 40] }, properties: { name } })),
  meta: { returned: names.length, limit: 2000, offset: 0, hasMore },
})
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('useSourceLayers (bbox ile tesis yükleme)', () => {
  it('kutu yokken tesis istemez; kutu gelince bbox parametresiyle ister', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(url.startsWith('/api/districts') ? page(['İlçe']) : page(['Eczane']))))
    vi.stubGlobal('fetch', fetchMock)
    const { result, rerender } = renderHook(({ bbox }: { bbox: Bbox | null }) => useSourceLayers(bbox), { initialProps: { bbox: null as Bbox | null } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(result.current.state.kind).toBe('loading')

    rerender({ bbox: [28.9, 40, 29.3, 40.4] })
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'))
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain('/api/facilities?bbox=28.9,40,29.3,40.4&limit=2000')
  })

  it('kutu değişince önceki isteği iptal eder; yeni yanıt gelene kadar eski tesisler kalır', async () => {
    let resolveSecond: (r: Response) => void = () => {}
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/districts')) return Promise.resolve(ok(page(['İlçe'])))
      signals.push(init!.signal!)
      if (url.includes('bbox=1,1,2,2')) return Promise.resolve(ok(page(['Birinci'])))
      if (url.includes('bbox=3,3,4,4')) return new Promise<Response>(() => {}) // hiç dönmez → iptal edilmeli
      return new Promise<Response>((resolve) => (resolveSecond = resolve))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result, rerender } = renderHook(({ bbox }: { bbox: Bbox }) => useSourceLayers(bbox), { initialProps: { bbox: [1, 1, 2, 2] as Bbox } })
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'))

    rerender({ bbox: [3, 3, 4, 4] })
    rerender({ bbox: [5, 5, 6, 6] })
    await waitFor(() => expect(signals).toHaveLength(3))
    expect(signals[1].aborted).toBe(true) // ara kutunun isteği iptal
    const pending = result.current.state
    expect(pending.kind === 'loaded' && pending.facilitiesPending).toBe(true)
    expect(pending.kind === 'loaded' && pending.facilities.features[0].properties.name).toBe('Birinci')

    resolveSecond(ok(page(['Üçüncü'])))
    await waitFor(() => {
      const s = result.current.state
      expect(s.kind === 'loaded' && !s.facilitiesPending && s.facilities.features[0].properties.name).toBe('Üçüncü')
    })
  })

  it('tesis isteği hata verirse eldeki veri korunur', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.includes('bbox=9') ? new Response('{}', { status: 503 }) : ok(url.startsWith('/api/districts') ? page(['İlçe']) : page(['Eski']))),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result, rerender } = renderHook(({ bbox }: { bbox: Bbox }) => useSourceLayers(bbox), { initialProps: { bbox: [1, 1, 2, 2] as Bbox } })
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'))

    rerender({ bbox: [9, 9, 10, 10] })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await new Promise((r) => setTimeout(r, 20))
    const s = result.current.state
    expect(s.kind).toBe('loaded')
    expect(s.kind === 'loaded' && s.facilities.features[0].properties.name).toBe('Eski')
    // Sürekli "yükleniyor" değil: yenilemenin başarısız olduğu ayrı bildirilir (dış inceleme bulgusu).
    expect(s.kind === 'loaded' && [s.facilitiesPending, s.facilitiesStale]).toEqual([false, true])

    fetchMock.mockImplementation((url: string) => Promise.resolve(ok(url.startsWith('/api/districts') ? page(['İlçe']) : page(['Yeni']))))
    act(() => result.current.refresh())
    await waitFor(() => {
      const r = result.current.state
      expect(r.kind === 'loaded' && [r.facilitiesStale, r.facilities.features[0].properties.name]).toEqual([false, 'Yeni'])
    })
  })
})
