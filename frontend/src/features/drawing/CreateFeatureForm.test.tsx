import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UserGeometry } from '../../services/userFeatures'
import { CreateFeatureForm } from './CreateFeatureForm'

const polygon: UserGeometry = {
  type: 'Polygon',
  coordinates: [[[29.0, 40.1], [29.1, 40.1], [29.1, 40.2], [29.0, 40.1]]],
}

const json = (status: number, body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } })

function setup(geometry: UserGeometry = polygon) {
  const props = { geometry, onSaved: vi.fn(), onCancel: vi.fn() }
  render(<CreateFeatureForm {...props} />)
  return props
}

describe('CreateFeatureForm', () => {
  it('RFC 7946 Feature gövdesiyle kaydeder ve sonucu bildirir', async () => {
    const created = { type: 'Feature', id: 'abc', geometry: polygon, properties: { name: 'Park alanı' } }
    const fetchMock = vi.fn().mockResolvedValue(json(201, created, '"5"'))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    expect(screen.getByRole('heading')).toHaveTextContent('Yeni alan kaydet')
    expect(screen.getByText('Alan, 4 köşe')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Ad (zorunlu)'), '  Park alanı ')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/features')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ type: 'Feature', geometry: polygon, properties: { name: 'Park alanı', description: null } })
    expect(props.onSaved).toHaveBeenCalledWith(created, '"5"')
  })

  it('ad boşken kaydetmez', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setup()

    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sunucu geometri hatasını gösterir, formu korur ve tekrar gönderime izin verir', async () => {
    const problem = { title: 'One or more validation errors occurred.', status: 422, errors: { geometry: ['Geçersiz geometri: kendini kesiyor (29.05, 40.15).'] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, problem)))
    const props = setup()

    await userEvent.type(screen.getByLabelText('Ad (zorunlu)'), 'Hatalı alan')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('kendini kesiyor')
    expect(screen.getByLabelText('Ad (zorunlu)')).toHaveValue('Hatalı alan')
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled()
    expect(props.onSaved).not.toHaveBeenCalled()
  })

  it('kayıt sürerken ikinci gönderimi engeller', async () => {
    let resolve!: (r: Response) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    vi.stubGlobal('fetch', fetchMock)
    setup()

    await userEvent.type(screen.getByLabelText('Ad (zorunlu)'), 'Alan')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kaydediliyor…' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolve(json(201, { type: 'Feature', id: 'x', geometry: polygon, properties: {} }, '"1"'))
  })

  it('çok fazla köşeli geometriyi göndermeden uyarır', () => {
    const coords = Array.from({ length: 10_001 }, (_, i) => [29 + i / 1e6, 40.1])
    vi.stubGlobal('fetch', vi.fn())
    setup({ type: 'LineString', coordinates: coords })

    expect(screen.getByText(/En çok 10000 köşe/)).toBeInTheDocument()
  })
})
