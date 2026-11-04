import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SourceLayersState } from '../map/useSourceLayers'
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
    onRetry: vi.fn(),
    visibility: { districts: true, facilities: true },
    onToggle: vi.fn(),
    basemap: 'osm' as const,
    onBasemapChange: vi.fn(),
    ...overrides,
  }
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

  it('altlık seçimi bildirilir', async () => {
    const props = renderPanel()

    await userEvent.click(screen.getByRole('radio', { name: /Positron/ }))

    expect(props.onBasemapChange).toHaveBeenCalledWith('positron')
  })

  it('sayfa sınırı aşıldığında eksik veriyi bildirir', () => {
    renderPanel({ state: loaded(true) })

    expect(screen.getByRole('status')).toHaveTextContent('yalnızca bir kısmı')
  })

  it('hata durumunda tekrar dene çağırır', async () => {
    const props = renderPanel({ state: { kind: 'error' } })

    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })
})
