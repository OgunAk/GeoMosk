import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDistance, type AnalysisResponse } from '../../services/analysis'
import { FACILITY_LABELS } from '../map/mapStyle'
import type { FacilityType } from '../../services/sourceLayers'
import { AnalysisPanel, type SavedArea, type SelectedSource } from './AnalysisPanel'

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
    savedAreas: [] as SavedArea[],
    facilityTypes: Object.keys(FACILITY_LABELS) as FacilityType[],
    pickedPoint: null as [number, number] | null,
    pickingPoint: false,
    drawingArea: false,
    result: null as AnalysisResponse | null,
    onDrawArea: vi.fn(),
    onPickPoint: vi.fn(),
    onResult: vi.fn(),
    onDraftChange: vi.fn(),
    onSaveDrawnArea: vi.fn(),
    onClearInput: vi.fn(),
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
    const props = setup({ selected: { ref: { layerId: 'districts', id: 12 }, label: 'Nilüfer', isArea: true, measurable: true } })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Sınır üzerindeki tesisler dahil' }))
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/analysis/within')
    expect(JSON.parse(init.body)).toEqual({ sourceFeature: { layerId: 'districts', id: 12 }, includeBoundary: false })
    expect(props.onResult).toHaveBeenCalled()
  })

  it('nokta (tesis) seçiliyken alan analizi devre dışıdır', () => {
    setup({ selected: { ref: { layerId: 'facilities', id: 5 }, label: 'Eczane', isArea: false, measurable: false } })
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
  })

  it('tampon için metre sınırlarını doğrular ve radiusMeters gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('buffer', [10])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ selected: { ref: { layerId: 'facilities', id: 5 }, label: 'Hastane', isArea: false, measurable: false } })
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

  it('nokta seçildikten sonra koordinatı gösterir ve düğme "Başka nokta seç" olur', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('nearest', [5])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ pickedPoint: [29.06, 40.19] })
    await userEvent.click(screen.getByRole('radio', { name: 'En yakın N' }))

    expect(screen.getByText('40.19000, 29.06000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Başka nokta seç' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Tür'), 'hospital')
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ point: { type: 'Point', coordinates: [29.06, 40.19] }, n: 5, type: 'hospital' })
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

  it('ölçüm: seçili ilçe için sourceFeature gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('measure', [])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ selected: { ref: { layerId: 'districts', id: 12 }, label: 'Nilüfer', isArea: true, measurable: true } })
    await userEvent.click(screen.getByRole('radio', { name: 'Ölçüm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/analysis/measure')
    expect(JSON.parse(init.body)).toEqual({ sourceFeature: { layerId: 'districts', id: 12 } })
  })

  it('ölçüm: nokta seçiliyken desteklenmez, istek atılmaz', async () => {
    setup({ selected: { ref: { layerId: 'facilities', id: 5 }, label: 'Eczane', isArea: false, measurable: false } })
    await userEvent.click(screen.getByRole('radio', { name: 'Ölçüm' }))
    expect(screen.getByText(/Desteklenmeyen ölçüm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
  })

  it('ölçüm sonucunu metre/km² ve hesap SRID değeriyle gösterir', () => {
    const result: AnalysisResponse = {
      ...response('measure', []),
      input: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { role: 'area', label: 'Nilüfer' } },
      measurement: {
        geometryType: 'MultiPolygon',
        lengthMeters: null,
        areaSquareMeters: 515_234_567.8,
        perimeterMeters: 152_345.6,
        calculationSrid: 32635,
        calculationCrs: 'WGS 84 / UTM zone 35N',
        method: 'ST_Area',
        geodesicCheck: { lengthMeters: null, areaSquareMeters: 515_240_000, relativeDifference: -0.0000105 },
      },
    }
    setup({ result })
    const dl = screen.getByLabelText('Ölçüm sonuçları')
    expect(dl).toHaveTextContent('Alan')
    expect(dl).toHaveTextContent('515,23 km²')
    expect(dl).toHaveTextContent('152,35 km')
    expect(dl).not.toHaveTextContent('Uzunluk')
    expect(screen.getByText(/EPSG:32635/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Analiz sonuçları' })).not.toBeInTheDocument()
  })

  const square = (x: number) => ({ type: 'Polygon' as const, coordinates: [[[x, 40], [x + 0.1, 40], [x + 0.1, 40.1], [x, 40]]] })
  const nilufer: SelectedSource = { ref: { layerId: 'districts', id: 12 }, label: 'Nilüfer', isArea: true, measurable: true }

  it('haritada yalnız bazı türler işaretliyse analiz bu türlerle istenir ve panelde yazar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('within', [])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ selected: nilufer, facilityTypes: ['hospital'] })

    expect(screen.getByText('Yalnız işaretli türler: Hastane.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).types).toEqual(['hospital'])
  })

  it('hiç tür işaretli değilse tesis analizi çalışmaz; ölçüm çalışır', async () => {
    setup({ selected: nilufer, facilityTypes: [] })

    expect(screen.getByText(/en az bir tesis türü işaretleyin/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: 'Ölçüm' }))
    expect(screen.getByRole('button', { name: 'Analizi çalıştır' })).toBeEnabled()
  })

  it('en yakın N: Tür kutusu yalnız işaretli türleri sunar, Tümü işaretli türleri gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('nearest', [])))
    vi.stubGlobal('fetch', fetchMock)
    setup({ pickedPoint: [29.06, 40.19], facilityTypes: ['hospital', 'pharmacy'] })
    await userEvent.click(screen.getByRole('radio', { name: 'En yakın N' }))

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Tümü', 'Hastane', 'Eczane'])
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).types).toEqual(['hospital', 'pharmacy'])
  })

  it('çizim bölümünde kaydedilen alan analiz listesinde gelir ve kayıtlı çizim olarak gönderilir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(response('within', [])))
    vi.stubGlobal('fetch', fetchMock)
    const saved = [{ id: 'a1', name: 'Eski alan', geometry: square(29) }, { id: 'b2', name: 'Yeni alan', geometry: square(29.2) }]
    const props = setup({ savedAreas: saved })
    await userEvent.click(screen.getByRole('radio', { name: /Çizilen alan/ }))

    expect(screen.getByRole('combobox', { name: 'Alan seçin' })).toHaveValue('b2') // en son kaydedilen
    expect(props.onDraftChange).toHaveBeenLastCalledWith(saved[1].geometry)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Alan seçin' }), 'a1')
    await userEvent.click(screen.getByRole('button', { name: 'Analizi çalıştır' }))

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sourceFeature).toEqual({ layerId: 'user-features', id: 'a1' })
  })

  it('kaydedilmemiş alan listede öne çıkar, kaydedilebilir ve haritaya taslak olarak bildirilir', async () => {
    const area = square(29)
    const props = setup({ drawnArea: area, savedAreas: [{ id: 'a1', name: 'Eski alan', geometry: square(29.2) }] })
    await userEvent.click(screen.getByRole('radio', { name: /Çizilen alan/ }))

    expect(screen.getByRole('combobox', { name: 'Alan seçin' })).toHaveDisplayValue('Kaydedilmemiş alan')
    expect(props.onDraftChange).toHaveBeenLastCalledWith(area)
    await userEvent.click(screen.getByRole('button', { name: 'Alanı kaydet' }))
    expect(props.onSaveDrawnArea).toHaveBeenCalledOnce()
  })

  it('seçilen nokta haritaya bildirilir ve Temizle ile silinebilir', async () => {
    const props = setup({ pickedPoint: [29.06, 40.19] })
    await userEvent.click(screen.getByRole('radio', { name: 'En yakın N' }))

    expect(props.onDraftChange).toHaveBeenLastCalledWith({ type: 'Point', coordinates: [29.06, 40.19] })
    await userEvent.click(screen.getByRole('button', { name: 'Temizle' }))
    expect(props.onClearInput).toHaveBeenCalledOnce()
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
