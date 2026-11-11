import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchPanel } from './SearchPanel'

function collection(names: (string | null)[], hasMore = false) {
  return {
    type: 'FeatureCollection',
    features: names.map((name, i) => ({
      type: 'Feature',
      id: i + 1,
      geometry: { type: 'Point', coordinates: [29.0 + i / 100, 40.2] },
      properties: { layer: 'facilities', name, facilityType: 'hospital', sourceName: name, description: null, osmType: 'node', osmId: i + 1, representativePoint: false },
    })),
    meta: { returned: names.length, limit: 50, offset: 0, hasMore },
  }
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/geo+json' } })

function setup() {
  const props = { districts: [{ id: 7, name: 'Nilüfer' }], onResults: vi.fn(), onPick: vi.fn(), onShowAll: vi.fn() }
  render(<SearchPanel {...props} />)
  return props
}

describe('SearchPanel', () => {
  it('yazma bitince tek istek atar, sonuçları listeler ve vurgu için bildirir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(collection(['Devlet Hastanesi', null])))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Ad ile ara' }), 'devlet')

    expect(await screen.findByText('2 sonuç')).toBeInTheDocument()
    expect(screen.getByText('Adsız tesis')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1) // debounce: her tuş için istek atılmaz
    expect(fetchMock.mock.calls[0][0]).toBe('/api/facilities?limit=50&q=devlet')
    expect(props.onResults).toHaveBeenLastCalledWith('facilities', expect.arrayContaining([expect.objectContaining({ id: 1 })]))
  })

  it('sonuca tıklanınca seçim ve zoom için bildirir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(collection(['Devlet Hastanesi']))))
    const props = setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Ad ile ara' }), 'devlet')

    await userEvent.click(await screen.findByRole('button', { name: /Devlet Hastanesi/ }))

    expect(props.onPick).toHaveBeenCalledWith('facilities', expect.objectContaining({ id: 1 }))
  })

  it('tür ve ilçe filtreleri sorguya eklenir; sınır aşımı bildirilir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(collection(['A'], true)))
    vi.stubGlobal('fetch', fetchMock)
    setup()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tür' }), 'pharmacy')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'İlçe' }), '7')

    await waitFor(() => expect(screen.getByText('1 sonuç gösteriliyor; devamı var')).toBeInTheDocument())
    expect(fetchMock.mock.lastCall?.[0]).toBe('/api/facilities?limit=50&type=pharmacy&districtId=7')
  })

  it('devamı olan aramada sonraki sayfa keyset ile eklenir ve vurgu tüm listeyi kapsar (dış inceleme bulgusu)', async () => {
    const first = { ...collection(['A', 'B'], true), meta: { returned: 2, limit: 50, offset: 0, hasMore: true, nextAfter: 2 } }
    const second = collection(['C'])
    second.features[0].id = 3
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(first)).mockResolvedValueOnce(ok(second))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Ad ile ara' }), 'eczane')
    await userEvent.click(await screen.findByRole('button', { name: '50 sonuç daha göster' }))

    await waitFor(() => expect(screen.getByText('3 sonuç')).toBeInTheDocument())
    expect(fetchMock.mock.lastCall?.[0]).toBe('/api/facilities?limit=50&q=eczane&after=2')
    expect(props.onResults.mock.lastCall?.[1]).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '50 sonuç daha göster' })).not.toBeInTheDocument()
  })

  it('ölçüt temizlenince vurguyu kaldırır ve istek atmaz', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(collection(['A'])))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()
    const box = screen.getByRole('searchbox', { name: 'Ad ile ara' })
    await userEvent.type(box, 'a')
    await screen.findByText('1 sonuç')

    await userEvent.clear(box)

    await waitFor(() => expect(props.onResults).toHaveBeenLastCalledWith('facilities', []))
    expect(screen.queryByRole('list', { name: 'Arama sonuçları' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sunucu doğrulama hatasını gösterir', async () => {
    const problem = { title: 'One or more validation errors occurred.', errors: { q: ['Arama metni en çok 100 karakter olabilir.'] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(problem), { status: 400 })))
    setup()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Ad ile ara' }), 'x')

    expect(await screen.findByText('Arama metni en çok 100 karakter olabilir.')).toBeInTheDocument()
  })
})
