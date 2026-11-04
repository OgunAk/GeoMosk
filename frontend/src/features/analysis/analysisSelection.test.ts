import { describe, expect, it } from 'vitest'
import type { AnalysisResponse } from '../../services/analysis'
import { keepAnalysisFor } from './analysisSelection'

function result(source: { sourceLayer: string; sourceId: string } | null, matchIds: number[]): AnalysisResponse {
  return {
    analysis: source ? 'within' : 'nearest',
    input: { type: 'Feature', geometry: { type: 'Point', coordinates: [29, 40] }, properties: { role: 'area', ...(source ?? {}) } },
    matches: {
      type: 'FeatureCollection',
      features: matchIds.map((id) => ({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: [29, 40] },
        properties: { layer: 'facilities', name: 'x', sourceName: 'x', description: null, facilityType: 'pharmacy', osmType: 'node', osmId: id, representativePoint: false },
      })),
      meta: { returned: matchIds.length, limit: 500, offset: 0, hasMore: false },
    },
    parameters: {},
  }
}

describe('keepAnalysisFor', () => {
  const nilufer = result({ sourceLayer: 'districts', sourceId: '12' }, [100, 101])

  it('başka bir ilçe seçilince sonucu temizler', () => {
    expect(keepAnalysisFor(nilufer, { layer: 'districts', id: 14 })).toBe(false)
  })

  it('analiz edilen ilçenin kendisi tekrar seçilince korur', () => {
    expect(keepAnalysisFor(nilufer, { layer: 'districts', id: 12 })).toBe(true)
  })

  it('sonuç listesindeki bir tesis seçilince korur, listede olmayan tesiste temizler', () => {
    expect(keepAnalysisFor(nilufer, { layer: 'facilities', id: 101 })).toBe(true)
    expect(keepAnalysisFor(nilufer, { layer: 'facilities', id: 999 })).toBe(false)
  })

  it('kullanıcı çizimi seçilince (kaynak değilse) temizler', () => {
    expect(keepAnalysisFor(nilufer, { layer: 'user-features', id: 'a-b-c' })).toBe(false)
  })

  it('seçim kaldırılınca veya sonuç yokken bir şey değişmez', () => {
    expect(keepAnalysisFor(nilufer, null)).toBe(true)
    expect(keepAnalysisFor(null, { layer: 'districts', id: 1 })).toBe(true)
  })

  it('kaynaksız sonuçta (en yakın N) yalnız eşleşen tesisler korunur', () => {
    const nearest = result(null, [5])
    expect(keepAnalysisFor(nearest, { layer: 'facilities', id: 5 })).toBe(true)
    expect(keepAnalysisFor(nearest, { layer: 'districts', id: 12 })).toBe(false)
  })
})
