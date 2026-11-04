import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SystemStatus } from './SystemStatus'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const healthy = {
  status: 'Healthy',
  checks: [{ name: 'postgis', status: 'Healthy', description: null, data: { postgisVersion: '3.5.3' } }],
}
const unhealthy = {
  status: 'Unhealthy',
  checks: [{ name: 'postgis', status: 'Unhealthy', description: "Veritabanına veya PostGIS'e ulaşılamıyor.", data: {} }],
}

describe('SystemStatus', () => {
  it('veritabanı hazırsa PostGIS sürümünü gösterir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, healthy))
    vi.stubGlobal('fetch', fetchMock)

    render(<SystemStatus />)

    expect(await screen.findByText('Hazır (PostGIS 3.5.3)')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health/ready', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('503 yanıtında veritabanı hatasını ayrı gösterir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, unhealthy)))

    render(<SystemStatus />)

    expect(await screen.findByText(/Veritabanı hazır değil/)).toBeInTheDocument()
    expect(screen.getByText('API çalışıyor.')).toBeInTheDocument()
  })

  it('ağ hatasından sonra tekrar dene ile yeniden sorgular', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, healthy))
    vi.stubGlobal('fetch', fetchMock)

    render(<SystemStatus />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))

    expect(await screen.findByText('Hazır (PostGIS 3.5.3)')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
