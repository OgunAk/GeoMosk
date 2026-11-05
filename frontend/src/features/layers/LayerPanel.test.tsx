import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LayerKey } from '../map/layerIds'
import type { BasemapId } from '../map/mapStyle'
import type { SourceLayersState } from '../map/useSourceLayers'
import type { FacilityType } from '../../services/sourceLayers'
import { LayerPanel } from './LayerPanel'

const meta = (returned: number, hasMore = false) => ({ returned, limit: 2000, offset: 0, hasMore })

function loaded(hasMore = false): SourceLayersState {
  return {
    kind: 'loaded',
    districts: { type: 'FeatureCollection', features: [], meta: meta(17) },
    facilities: { type: 'FeatureCollection', features: [], meta: meta(911, hasMore) },
  }
}

function renderPanel(overrides: Partial<Parameters<typeof LayerPanel>[0]> = {}) {
  const props = {
    state: loaded(),
    userCount: 3 as number | null,
    onRetry: vi.fn<() => void>(),
    visibility: { districts: true, facilities: true, 'user-features': true },
    onToggle: vi.fn<(layer: LayerKey, visible: boolean) => void>(),
    basemap: 'osm' as BasemapId,
    onBasemapChange: vi.fn<(basemap: BasemapId) => void>(),
    facilityTypes: { hospital: true, clinic: true, doctors: true, dentist: true, pharmacy: true, other_healthcare: true },
    onToggleFacilityType: vi.fn<(type: FacilityType, visible: boolean) => void>(),
  }
  Object.assign(props, overrides)
  render(<LayerPanel {...props} />)
  return props
}

describe('LayerPanel', () => {
  it('katman sayılarını ve kaynak atfını gösterir', () => {
    renderPanel()

    expect(screen.getByRole('checkbox', { name: /İlçe sınırları/ })).toBeChecked()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('911')).toBeInTheDocument()
    expect(screen.getByText(/OpenStreetMap katkıcıları, ODbL/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('katman anahtarı görünürlüğü değiştirir', async () => {
    const props = renderPanel()

    await userEvent.click(screen.getByRole('checkbox', { name: /Sağlık tesisleri/ }))

    expect(props.onToggle).toHaveBeenCalledWith('facilities', false)
  })

  it('tesis türleri haritada ayrı ayrı gizlenebilir (geliştirici geri bildirimi G2)', async () => {
    const facility = (facilityType: FacilityType) => ({
      type: 'Feature' as const,
      id: 1,
      geometry: { type: 'Point' as const, coordinates: [29, 40] },
      properties: { layer: 'facilities' as const, name: 'x', sourceName: 'x', description: null, facilityType, osmType: 'node', osmId: 1, representativePoint: false },
    })
    const state: SourceLayersState = {
      kind: 'loaded',
      districts: { type: 'FeatureCollection', features: [], meta: meta(17) },
      facilities: { type: 'FeatureCollection', features: [facility('pharmacy'), facility('pharmacy'), facility('hospital')], meta: meta(3) },
    }
    const props = renderPanel({ state })

    const pharmacy = screen.getByRole('checkbox', { name: /Eczane/ })
    expect(pharmacy.closest('label')).toHaveTextContent('2') // türe göre sayı
    await userEvent.click(pharmacy)

    expect(props.onToggleFacilityType).toHaveBeenCalledWith('pharmacy', false)
  })

  it('tesis katmanı kapalıyken tür anahtarları devre dışıdır', () => {
    renderPanel({ visibility: { districts: true, facilities: false, 'user-features': true } })

    expect(screen.getByRole('checkbox', { name: /Hastane/ })).toBeDisabled()
  })

  it('kullanıcı çizimleri ayrı bir katman olarak sayısıyla listelenir', async () => {
    const props = renderPanel()

    const toggle = screen.getByRole('checkbox', { name: /Kullanıcı çizimleri/ })
    expect(toggle.closest('label')).toHaveTextContent('3')
    await userEvent.click(toggle)

    expect(props.onToggle).toHaveBeenCalledWith('user-features', false)
  })

  it('altlık seçimi bildirilir', async () => {
    const props = renderPanel()

    await userEvent.click(screen.getByRole('radio', { name: /Positron/ }))

    expect(props.onBasemapChange).toHaveBeenCalledWith('positron')
  })

  it('sayfa sınırı aşıldığında eksik veriyi bildirir', () => {
    renderPanel({ state: loaded(true) })

    expect(screen.getByRole('status')).toHaveTextContent('yalnızca bir kısmı')
  })

  it('kullanıcı çizimleri sınırı aşınca da eksik veriyi bildirir; aşılmadıysa uyarı yok', () => {
    renderPanel({ userHasMore: true })
    expect(screen.getByRole('status')).toHaveTextContent('yalnızca bir kısmı')
  })

  it('sınır aşılmadıysa eksik veri uyarısı yok', () => {
    renderPanel()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('hata durumunda tekrar dene çağırır', async () => {
    const props = renderPanel({ state: { kind: 'error' } })

    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })
})
