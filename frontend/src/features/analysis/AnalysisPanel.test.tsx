import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDistance, type AnalysisResponse } from '../../services/analysis'
import { AnalysisPanel, type SelectedSource } from './AnalysisPanel'

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

function response(analysis: AnalysisResponse['analysis'], distances: number[], parameters: Record<string, unknown> = {}): AnalysisResponse {
  return {
    analysis,
    input: { type: 'Feature', geometry: { type: 'Point', coordinates: [29.06, 40.19] }, properties: { role: 'point' } },
    matches: {
      type: 'FeatureCollection',
      features: distances.map((d, i) => ({
        type: 'Feature',
        id: i + 1,
        geometry: { type: 'Point', coordinates: [29.06, 40.19] },
        properties: { layer: 'facilities', name: `Tesis ${i + 1}`, sourceName: null, description: null, facilityType: 'pharmacy', osmType: 'node', osmId: i, representativePoint: false, distanceMeters: d, rank: analysis === 'nearest' ? i + 1 : undefined },
      })),
      meta: { returned: distances.length, limit: 500, offset: 0, hasMore: false },
    },
    parameters,
  }
}

function setup(overrides: Partial<Parameters<typeof AnalysisPanel>[0]> = {}) {
  const props = {
    selected: null as SelectedSource | null,
    drawnArea: null,
    pickedPoint: null as [number, number] | null,
    pickingPoint: false,
    drawingArea: false,
    result: null as AnalysisResponse | null,
    onDrawArea: vi.fn(),
    onPickPoint: vi.fn(),
    onResult: vi.fn(),
    onSelectMatch: vi.fn(),
    onShowAll: vi.fn(),
  }
  Object.assign(props, overrides)
  render(<AnalysisPanel {...props} />)
  return props
}

describe('formatDistance', () => {
  it('metre ve km değerlerini Türkçe biçimde gösterir', () => {
    expect(formatDistance(852.4)).toBe('852 m')
    expect(formatDistance(1705.3)).toBe('1,71 km')
    expect(formatDistance(12_345)).toBe('12,35 km')
  })
})

describe('AnalysisPanel', () => {
  it('alan analizi seçili ilçe yokken çalıştırılamaz, ilçe seçilince sourceFeature ile istek atar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('within', [])))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup({ selected: { ref: { layerId: 'districts', id: 12 }, label: 'Nilüfer', isArea: true } })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Sınır üzerindeki tesisler dahil' }))
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/analysis/within')
    expect(JSON.parse(init.body)).toEqual({ sourceFeature: { layerId: 'districts', id: 12 }, includeBoundary: false })
    expect(props.onResult).toHaveBeenCalled()
  })

  it('nokta (tesis) seçiliyken alan analizi devre dışıdır', () => {
    setup({ selected: { ref: { layerId: 'facilities', id: 5 }, label: 'Eczane', isArea: false } })
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
  })

  it('tampon için metre sınırlarını doğrular ve radiusMeters gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('buffer', [10])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ selected: { ref: { layerId: 'facilities', id: 5 }, label: 'Hastane', isArea: false } })
    await userEvent.click(screen.getByRole('radio', { name: 'Tampon (yakınlık)' }))
    const radius = screen.getByLabelText(/Mesafe \(metre/)

    await userEvent.clear(radius)
    await userEvent.type(radius, '60000')
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
    expect(screen.getByText(/en çok 50.000 m/)).toBeInTheDocument()

    await userEvent.clear(radius)
    await userEvent.type(radius, '1500')
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ sourceFeature: { layerId: 'facilities', id: 5 }, radiusMeters: 1500 })
  })

  it('en yakın N için nokta seçimi ister, N ve tür gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('nearest', [5])))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()
    await userEvent.click(screen.getByRole('radio', { name: 'En yakın N' }))
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Haritada nokta seç' }))
    expect(props.onPickPoint).toHaveBeenCalled()
  })

  it('en yakın N sonuçlarını sıra ve mesafeyle listeler; tıklama seçimi bildirir', async () => {
    const props = setup({ result: response('nearest', [120, 980, 1705]) })

    const list = screen.getByRole('list', { name: 'Analiz sonuçları' })
    expect(list).toHaveTextContent('1.Tesis 1')
    expect(list).toHaveTextContent('120 m')
    expect(list).toHaveTextContent('1,71 km')
    expect(screen.getByText('En yakın 3 tesis (kuş uçuşu)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Tesis 2/ }))
    expect(props.onSelectMatch).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  })

  it('sunucu hatasını gösterir', async () => {
    const problem = { title: 'x', errors: { geometry: ['Geçersiz geometri: kendini kesiyor (29.1, 40.1).'] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(problem), { status: 422 })))
    setup({ drawnArea: { type: 'Polygon', coordinates: [[[29, 40], [29.1, 40], [29.1, 40.1], [29, 40]]] } })
    await userEvent.click(screen.getByRole('radio', { name: /Çizilen alan/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('kendini kesiyor')
  })
})
