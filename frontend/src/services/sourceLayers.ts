import type { Feature, FeatureCollection, MultiPolygon, Point } from 'geojson'
import { getJson, requestJson } from './apiClient'

// Sözleşme: docs/API-CONTRACT.md, backend/GeoMosk.Application/Features/GeoJson.cs
export interface PageMeta {
  returned: number
  limit: number
  offset: number
  hasMore: boolean
  /** Keyset sayfalama imleci: bir sonraki istekte `after` olarak verilir; yalnız kaynak listelerinde ve hasMore iken. */
  nextAfter?: number
}

export type SourceLayerId = 'districts' | 'facilities'

export interface DistrictProperties {
  layer: 'districts'
  name: string
  sourceName: string
  description: string | null
  osmType: string
  osmId: number
}

export type FacilityType = 'hospital' | 'clinic' | 'doctors' | 'dentist' | 'pharmacy' | 'other_healthcare'

export interface FacilityProperties {
  layer: 'facilities'
  name: string | null
  sourceName: string | null
  description: string | null
  facilityType: FacilityType
  osmType: string
  osmId: number
  representativePoint: boolean
}

/** Tekil Feature yanıtındaki ek alanlar. */
export interface DetailExtras {
  tags: Record<string, string>
  osmUrl: string
  localEditUpdatedAt: string | null
  districtName?: string | null
}

export type SourceFeatureDetail =
  | Feature<MultiPolygon, DistrictProperties & DetailExtras>
  | Feature<Point, FacilityProperties & DetailExtras>

export type PagedCollection<G extends MultiPolygon | Point, P> = FeatureCollection<G, P> & { meta: PageMeta }


/** API üst sınırı (istek başına). İlçeler tek sayfada; tesisler görünen kutuya göre. Aşılırsa arayüz eksik veriyi bildirir. */
export const MAX_PAGE = 2000
export const SEARCH_LIMIT = 50
export const NAME_MAX: Record<SourceLayerId, number> = { districts: 200, facilities: 300 }
export const DESCRIPTION_MAX = 2000

export function fetchDistricts(signal?: AbortSignal) {
  return getJson<PagedCollection<MultiPolygon, DistrictProperties>>(`/api/districts?limit=${MAX_PAGE}`, signal)
}

/** Kutudaki tesisler (EPSG:4326, minLon,minLat,maxLon,maxLat); sunucuda ST_Intersects + GiST. Sınır aşılırsa meta.hasMore. */
export function fetchFacilities(bbox: readonly [number, number, number, number], signal?: AbortSignal) {
  return getJson<PagedCollection<Point, FacilityProperties>>(`/api/facilities?bbox=${bbox.join(',')}&limit=${MAX_PAGE}`, signal)
}

export interface SearchParams {
  layer: SourceLayerId
  q: string
  type?: FacilityType | ''
  districtId?: number | null
}

export function searchFeatures(params: SearchParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: String(SEARCH_LIMIT) })
  if (params.q.trim()) query.set('q', params.q.trim())
  if (params.layer === 'facilities') {
    if (params.type) query.set('type', params.type)
    if (params.districtId) query.set('districtId', String(params.districtId))
  }
  return getJson<FeatureCollection<MultiPolygon | Point, DistrictProperties | FacilityProperties> & { meta: PageMeta }>(
    `/api/${params.layer}?${query}`,
    signal,
  )
}

export function fetchFeature(layer: SourceLayerId, id: number, signal?: AbortSignal) {
  return requestJson<SourceFeatureDetail>(`/api/${layer}/${id}`, { signal })
}

/** Gönderilmeyen alan değişmez; name: null → kaynak adına dön; description: null → temizle. */
export interface OverridePatch {
  name?: string | null
  description?: string | null
}

export function patchFeature(layer: SourceLayerId, id: number, patch: OverridePatch, etag: string) {
  return requestJson<SourceFeatureDetail>(`/api/${layer}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(patch),
  })
}
