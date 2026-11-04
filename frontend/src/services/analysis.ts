import type { Feature, FeatureCollection, Geometry, Point, Polygon } from 'geojson'
import { requestJson } from './apiClient'
import type { FacilityProperties, FacilityType, PageMeta } from './sourceLayers'

// Sözleşme: docs/API-CONTRACT.md "Analizler", backend/GeoScope.Api/Controllers/AnalysisController.cs
export type AnalysisKind = 'within' | 'buffer' | 'nearest'

export interface MatchProperties extends FacilityProperties {
  /** Tampon ve en yakın N'de sferoid üzerinde metre (kuş uçuşu). */
  distanceMeters?: number
  rank?: number
}

export interface AnalysisResponse {
  analysis: AnalysisKind
  input: Feature<Geometry, { role: 'area' | 'buffer' | 'point'; label?: string | null }>
  matches: FeatureCollection<Point, MatchProperties> & { meta: PageMeta }
  parameters: Record<string, unknown>
}

/** Analiz kaynağı: kayıtlı obje (geometrisi sunucudan okunur). */
export interface SourceRef {
  layerId: 'districts' | 'facilities' | 'user-features'
  id: string | number
}

export const MAX_RADIUS_METERS = 50_000
export const MAX_N = 100

function post(path: string, body: unknown) {
  return requestJson<AnalysisResponse>(`/api/analysis/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.data)
}

export function runWithin(input: { sourceFeature: SourceRef } | { geometry: Polygon }, includeBoundary: boolean) {
  return post('within', { ...input, includeBoundary })
}

export function runBuffer(input: { sourceFeature: SourceRef } | { geometry: Geometry }, radiusMeters: number) {
  return post('buffer', { ...input, radiusMeters })
}

export function runNearest(point: [number, number], n: number, type?: FacilityType | '') {
  return post('nearest', { point: { type: 'Point', coordinates: point }, n, ...(type ? { type } : {}) })
}

/** Metre değerini Türkçe biçimde gösterir; hesap verisi yuvarlanmaz, yalnızca görüntü. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters).toLocaleString('tr-TR')} m`
  return `${(meters / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}
