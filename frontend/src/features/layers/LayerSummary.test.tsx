import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SourceLayersState } from '../map/useSourceLayers'
import { LayerSummary } from './LayerSummary'

const meta = (returned: number, hasMore = false) => ({ returned, limit: 2000, offset: 0, hasMore })

function loaded(hasMore: boolean): SourceLayersState {
  return {
    kind: 'loaded',
    districts: { type: 'FeatureCollection', features: [], meta: meta(17) },
    facilities: { type: 'FeatureCollection', features: [], meta: meta(911, hasMore) },
  }
}

describe('LayerSummary', () => {
  it('katman sayılarını ve kaynak atfını gösterir', () => {
    render(<LayerSummary state={loaded(false)} onRetry={() => {}} />)

    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('911')).toBeInTheDocument()
    expect(screen.getByText(/OpenStreetMap katkıcıları, ODbL/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sayfa sınırı aşıldığında eksik veriyi bildirir', () => {
    render(<LayerSummary state={loaded(true)} onRetry={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('yalnızca bir kısmı')
  })

  it('hata durumunda tekrar dene çağırır', async () => {
    const onRetry = vi.fn()
    render(<LayerSummary state={{ kind: 'error' }} onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
