import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DistrictStatsResponse } from '../../services/analysis'
import { DistrictStatsPanel } from './DistrictStatsPanel'

const stats: DistrictStatsResponse = {
  analysis: 'district-stats',
  facilityType: null,
  districts: [
    { id: 1, name: 'Osmangazi', facilityCount: 300, multiMatchCount: 1 },
    { id: 2, name: 'Büyükorhan', facilityCount: 0, multiMatchCount: 0 },
    { id: 3, name: 'Nilüfer', facilityCount: 120, multiMatchCount: 0 },
  ],
  totals: { facilities: 425, assigned: 420, unassigned: 5, multiMatch: 1 },
  policy: 'Tekil atama: …',
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('DistrictStatsPanel', () => {
  it('türe göre istek atar ve sonucu bildirir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(stats))
    vi.stubGlobal('fetch', fetchMock)
    const onStats = vi.fn()
    render(<DistrictStatsPanel stats={null} selectedDistrictId={null} onStats={onStats} onSelectDistrict={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Tesis türü'), 'hospital')
    await userEvent.click(screen.getByRole('button', { name: 'Hesapla' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analysis/district-stats?type=hospital')
    expect(onStats).toHaveBeenCalledWith(stats)
  })

  it('tabloyu çoktan aza, sıfır ilçeyle, toplamlar ve lejantla gösterir; satır ilçeyi seçer', async () => {
    const onSelect = vi.fn()
    render(<DistrictStatsPanel stats={stats} selectedDistrictId={3} onStats={vi.fn()} onSelectDistrict={onSelect} />)
    const table = screen.getByRole('table', { name: 'İlçe başına tesis sayısı' })
    const cells = within(table).getAllByRole('row').slice(1).map((r) => r.textContent)
    expect(cells).toEqual(['Osmangazi300', 'Nilüfer120', 'Büyükorhan0'])
    expect(screen.getByText(/atanamayan \(hiçbir ilçe sınırı içinde değil\) 5/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Harita lejantı' })).getByText('0 tesis')).toBeInTheDocument()
    expect(within(table).getAllByRole('row')[2]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Büyükorhan' }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('400 hatasını gösterir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'x', errors: { type: ['Geçersiz tesis türü.'] } }), { status: 400 })))
    render(<DistrictStatsPanel stats={null} selectedDistrictId={null} onStats={vi.fn()} onSelectDistrict={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hesapla' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Geçersiz tesis türü')
  })
})
