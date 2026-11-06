import { describe, expect, it } from 'vitest'
import { WMS_LAYER, wmsTileUrl } from './wms'

describe('wmsTileUrl', () => {
  it('WMS 1.1.1 GetMap isteğini EPSG:3857 ve MapLibre bbox yer tutucusuyla kurar', () => {
    const url = new URL(wmsTileUrl().replace('{bbox-epsg-3857}', '1,2,3,4'))
    expect(url.origin + url.pathname).toBe(WMS_LAYER.serviceUrl)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetMap',
      LAYERS: '12',
      SRS: 'EPSG:3857',
      FORMAT: 'image/png',
      TRANSPARENT: 'true',
      BBOX: '1,2,3,4',
    })
    // Yer tutucu kodlanmadan kalmalı; aksi halde MapLibre değiştiremez.
    expect(wmsTileUrl()).toContain('BBOX={bbox-epsg-3857}')
  })
})
