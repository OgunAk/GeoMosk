import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SourceFeatureDetail } from '../../services/sourceLayers'
import { FeatureEditor } from './FeatureEditor'

function facility(name: string | null, sourceName: string | null, description: string | null = null): SourceFeatureDetail {
  return {
    type: 'Feature',
    id: 42,
    geometry: { type: 'Point', coordinates: [29.06, 40.19] },
    properties: {
      layer: 'facilities', name, sourceName, description, facilityType: 'hospital', osmType: 'node', osmId: 1,
      representativePoint: false, tags: {}, osmUrl: 'https://www.openstreetmap.org/node/1', localEditUpdatedAt: null,
    },
  }
}

function setup(feature = facility('Kaynak Ad', 'Kaynak Ad')) {
  const props = { layer: 'facilities' as const, feature, etag: '"0"', onSaved: vi.fn(), onReload: vi.fn(), onCancel: vi.fn() }
  render(<FeatureEditor {...props} />)
  return props
}

const json = (status: number, body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } })

describe('FeatureEditor', () => {
  it('yalnızca değişen alanı If-Match ile gönderir ve sonucu bildirir', async () => {
    const saved = facility('Yeni Ad', 'Kaynak Ad')
    const fetchMock = vi.fn().mockResolvedValue(json(200, saved, '"812"'))
    vi.stubGlobal('fetch', fetchMock)
    const props = setup()

    const name = screen.getByLabelText('Ad (yerel)')
    await userEvent.clear(name)
    await userEvent.type(name, '  Yeni Ad ')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/facilities/42')
    expect(init.method).toBe('PATCH')
    expect(init.headers['If-Match']).toBe('"0"')
    expect(JSON.parse(init.body)).toEqual({ name: 'Yeni Ad' }) // açıklama gönderilmez → değişmez
    expect(props.onSaved).toHaveBeenCalledWith(saved, '"812"')
  })

  it('boş ad kaydedilmez', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setup()

    await userEvent.clear(screen.getByLabelText('Ad (yerel)'))

    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
    expect(screen.getByText(/Ad boş olamaz/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('412 çakışmasında değişikliği kaydetmez ve güncel kaydı yüklemeyi önerir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(412, { title: 'Kayıt bu arada değişti.' })))
    const props = setup()

    await userEvent.type(screen.getByLabelText('Açıklama'), 'not')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Güncel kaydı yükle' }))

    expect(props.onSaved).not.toHaveBeenCalled()
    expect(props.onReload).toHaveBeenCalledOnce()
  })

  it('yerel ad varken kaynak adına dönüş name: null gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, facility('Kaynak Ad', 'Kaynak Ad'), '"9"'))
    vi.stubGlobal('fetch', fetchMock)
    setup(facility('Yerel Ad', 'Kaynak Ad'))

    await userEvent.click(screen.getByRole('button', { name: 'Kaynak adına dön' }))

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: null })
  })

  it('ağ hatasında anlaşılır mesaj gösterir ve formu korur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    setup()

    await userEvent.type(screen.getByLabelText('Açıklama'), 'taslak')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kaydedilemedi')
    expect(screen.getByLabelText('Açıklama')).toHaveValue('taslak')
  })
})
