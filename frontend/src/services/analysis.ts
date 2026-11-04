import type { Feature, FeatureCollection, Geometry, Point, Polygon } from 'geojson'
import { requestJson } from './apiClient'
import type { FacilityProperties, FacilityType, PageMeta } from './sourceLayers'

// Sözleşme: docs/API-CONTRACT.md "Analizler", backend/GeoScope.Api/Controllers/AnalysisController.cs
export type AnalysisKind = 'within' | 'buffer' | 'nearest' | 'measure'

export interface MatchProperties extends FacilityProperties {
  /** Tampon ve en yakın N'de sferoid üzerinde metre (kuş uçuşu). */
  distanceMeters?: number
  rank?: number
}

export interface AnalysisResponse {
  analysis: AnalysisKind
  input: Feature<Geometry, { role: 'area' | 'buffer' | 'point' | 'line'; label?: string | null }>
  matches: FeatureCollection<Point, MatchProperties> & { meta: PageMeta }
  parameters: Record<string, unknown>
  /** Yalnız A04 ölçümünde. */
  measurement?: Measurement | null
}

/** A04: ham değerler metre/m²; EPSG:32635'e ST_Transform sonrası. geodesicCheck yalnız çapraz kontrol (geography). */
export interface Measurement {
  geometryType: string
  lengthMeters: number | null
  areaSquareMeters: number | null
  perimeterMeters: number | null
  calculationSrid: number
  calculationCrs: string
  method: string
  geodesicCheck: { lengthMeters: number | null; areaSquareMeters: number | null; relativeDifference: number }
}

/** A05: ilçe başına tesis sayısı, tekil atama. */
export interface DistrictStatsRow {
  id: number
  name: string
  facilityCount: number
  /** Bu ilçeye atanan ama birden çok ilçenin sınırında/örtüşmesinde kalan tesis sayısı. */
  multiMatchCount: number
}

export interface DistrictStatsResponse {
  analysis: 'district-stats'
  facilityType: FacilityType | null
  districts: DistrictStatsRow[]
  totals: { facilities: number; assigned: number; unassigned: number; multiMatch: number }
  policy: string
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

export function runMeasure(input: { sourceFeature: SourceRef } | { geometry: Geometry }) {
  return post('measure', input)
}

export function fetchDistrictStats(type?: FacilityType | '', signal?: AbortSignal) {
  const query = type ? `?type=${encodeURIComponent(type)}` : ''
  return requestJson<DistrictStatsResponse>(`/api/analysis/district-stats${query}`, { signal }).then((r) => r.data)
}

/** m² değerini Türkçe biçimde gösterir (1 km² = 1.000.000 m²); yalnızca görüntü. */
export function formatArea(squareMeters: number): string {
  if (squareMeters < 1_000_000) return `${Math.round(squareMeters).toLocaleString('tr-TR')} m²`
  return `${(squareMeters / 1_000_000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`
}

/** Metre değerini Türkçe biçimde gösterir; hesap verisi yuvarlanmaz, yalnızca görüntü. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters).toLocaleString('tr-TR')} m`
  return `${(meters / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}
