import { describe, expect, it } from 'vitest'
import { bboxParam, containsBbox, expandBbox, nextQueryBbox } from './bboxLoading'
import type { Bbox } from './geometry'

const view: Bbox = [29.0, 40.1, 29.2, 40.3]

describe('expandBbox', () => {
  it('her yönde görünüm boyutunun yarısı kadar genişletir ve 5 basamağa yuvarlar', () => {
    expect(expandBbox(view)).toEqual([28.9, 40.0, 29.3, 40.4])
    expect(expandBbox([29.000001, 40.1, 29.2, 40.3])[0]).toBe(28.9)
  })

  it('dünya sınırlarında kırpar (API geçersiz kutuyu 400 ile reddeder)', () => {
    expect(expandBbox([-179, -89, 179, 89])).toEqual([-180, -90, 180, 90])
  })
})

describe('nextQueryBbox', () => {
  it('ilk görünümde genişletilmiş kutu ister', () => {
    expect(nextQueryBbox(view, null, false)).toEqual(expandBbox(view))
  })

  it('görünüm mevcut kutunun içindeyse yeni istek yok (küçük kaydırma)', () => {
    const current = expandBbox(view)
    expect(nextQueryBbox([29.05, 40.15, 29.25, 40.35], current, false)).toBeNull()
  })

  it('görünüm kutudan taşarsa yeni kutu ister', () => {
    const current = expandBbox(view)
    expect(nextQueryBbox([29.3, 40.1, 29.5, 40.3], current, false)).toEqual(expandBbox([29.3, 40.1, 29.5, 40.3]))
  })

  it('önceki yanıt sınıra takıldıysa kutu içinde yakınlaşınca yeniden ister', () => {
    const current = expandBbox(view)
    const zoomedIn: Bbox = [29.05, 40.15, 29.1, 40.2]
    expect(nextQueryBbox(zoomedIn, current, true)).toEqual(expandBbox(zoomedIn))
    expect(nextQueryBbox(zoomedIn, current, false)).toBeNull()
  })

  it('aynı kutu yeniden istenmez', () => {
    expect(nextQueryBbox(view, expandBbox(view), true)).toBeNull()
  })
})

describe('containsBbox / bboxParam', () => {
  it('kenarlar dahil kapsamayı denetler ve API biçiminde yazar', () => {
    expect(containsBbox(view, view)).toBe(true)
    expect(containsBbox(view, [28.99, 40.1, 29.2, 40.3])).toBe(false)
    expect(bboxParam(view)).toBe('29,40.1,29.2,40.3')
  })
})
