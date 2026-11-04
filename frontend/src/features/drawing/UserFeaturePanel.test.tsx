import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UserFeaturePanel } from './UserFeaturePanel'

const feature = {
  type: 'Feature',
  id: 'f1',
  geometry: { type: 'Point', coordinates: [29.06, 40.19] },
  properties: { layer: 'user-features', name: 'Toplanma noktası', description: null, geometryType: 'Point', createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z' },
}

const json = (status: number, body: unknown, etag?: string) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } })

function setup() {
  const props = {
    id: 'f1',
    draftGeometry: null,
    onStartGeometryEdit: vi.fn(),
    onEndGeometryEdit: vi.fn(),
    onChanged: vi.fn(),
    onDeleted: vi.fn(),
    onClose: vi.fn(),
    onZoom: vi.fn(),
  }
  render(<UserFeaturePanel {...props} />)
  return props
}

describe('UserFeaturePanel', () => {
  it('silme onay ister ve If-Match ile siler', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(200, feature, '"7"')).mockResolvedValueOnce(json(204, null))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    await userEvent.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('"Toplanma noktası" kalıcı olarak silinsin mi?')
    expect(fetchMock).toHaveBeenCalledTimes(1) // onaysız silme yok
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }))

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/features/f1')
    expect(init.method).toBe('DELETE')
    expect(init.headers['If-Match']).toBe('"7"')
    expect(props.onDeleted).toHaveBeenCalledOnce()
  })

  it('silmeden vazgeçilebilir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(200, feature, '"7"')))
    const props = setup()

    await userEvent.click(await screen.findByRole('button', { name: 'Sil' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hayır' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(props.onDeleted).not.toHaveBeenCalled()
  })

  it('412 çakışmasında değişikliği uygulamaz ve güncel kaydı yüklemeyi önerir', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, feature, '"7"'))
      .mockResolvedValueOnce(json(412, { title: 'Kayıt bu arada değişti.' }))
      .mockResolvedValueOnce(json(200, { ...feature, properties: { ...feature.properties, name: 'Başkasının adı' } }, '"9"'))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    await userEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const name = screen.getByLabelText('Ad')
    await userEvent.clear(name)
    await userEvent.type(name, 'Benim adım')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Güncel kaydı yükle' }))

    expect(await screen.findByRole('heading', { name: 'Başkasının adı' })).toBeInTheDocument()
    expect(props.onChanged).not.toHaveBeenCalled()
  })

  it('geometri düzenlemesini başlatır; taslak yokken kaydet kapalıdır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(200, feature, '"7"')))
    const props = setup()

    await userEvent.click(await screen.findByRole('button', { name: 'Geometriyi düzenle' }))

    expect(props.onStartGeometryEdit).toHaveBeenCalledWith(feature.geometry)
    expect(screen.getByRole('button', { name: 'Geometriyi kaydet' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    expect(props.onEndGeometryEdit).toHaveBeenCalled()
  })
})
