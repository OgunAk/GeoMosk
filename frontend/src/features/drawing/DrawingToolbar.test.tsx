import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DrawingToolbar } from './DrawingToolbar'
import type { DrawRequest } from './useTerraDraw'

function setup(draw: DrawRequest) {
  const props = { draw, disabled: false, onStart: vi.fn(), onFinish: vi.fn(), onCancel: vi.fn() }
  render(<DrawingToolbar {...props} />)
  return props
}

describe('DrawingToolbar', () => {
  it('alan çizerken "Çizimi bitir" düğmesi ve Enter ipucu görünür (geliştirici geri bildirimi G1)', async () => {
    const props = setup({ kind: 'draw', mode: 'polygon', token: 1 })

    expect(screen.getByText(/en az 3 köşeden sonra "Çizimi bitir"/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Çizimi bitir' }))

    expect(props.onFinish).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Alan' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('nokta çiziminde bitirme düğmesi gösterilmez (tek tıklama yeter)', () => {
    setup({ kind: 'draw', mode: 'point', token: 1 })

    expect(screen.queryByRole('button', { name: 'Çizimi bitir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Çizimi iptal et' })).toBeInTheDocument()
  })

  it('çizim yokken yalnız mod düğmeleri vardır', async () => {
    const props = setup({ kind: 'off', token: 0 })

    expect(screen.queryByRole('button', { name: 'Çizimi iptal et' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Çizgi' }))
    expect(props.onStart).toHaveBeenCalledWith('linestring')
  })
})
