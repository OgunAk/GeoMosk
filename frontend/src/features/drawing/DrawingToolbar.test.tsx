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
  it('alan çizerken "Çizimi bitir" düğmesi ve sağ tıklama ipucu görünür', async () => {
    const props = setup({ kind: 'draw', mode: 'polygon', token: 1 })

    expect(screen.getByText(/en az 3 köşeden sonra bitirmek için sağ tıklayın/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Çizimi bitir' }))

    expect(props.onFinish).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Alan' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('nokta çiziminde bitirme düğmesi gösterilmez (tek tıklama yeter)', () => {
    setup({ kind: 'draw', mode: 'point', token: 1 })

    expect(screen.queryByRole('button', { name: 'Çizimi bitir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Çizimi iptal et' })).toBeInTheDocument()
  })

  it('çizim yokken yalnız mod düğmeleri vardır; bitirme yöntemi altta açıklanır', async () => {
    const props = setup({ kind: 'off', token: 0 })

    expect(screen.getByText('Çizgi ve alan çizimini bitirmek için haritada sağ tıklayın.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Çizimi iptal et' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Çizgi' }))
    expect(props.onStart).toHaveBeenCalledWith('linestring')
  })
})
