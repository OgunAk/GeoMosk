import type { FeatureCollection, MultiPolygon, Point } from 'geojson'
import { getJson } from './apiClient'

// Sözleşme: backend/GeoScope.Application/Features/GeoJson.cs (FeatureCollection + "meta" foreign member)
export interface PageMeta {
  returned: number
  limit: number
  offset: number
  hasMore: boolean
}

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

export type PagedCollection<G extends MultiPolygon | Point, P> = FeatureCollection<G, P> & { meta: PageMeta }

/** API üst sınırı; Faz 2'de katmanın tamamı tek sayfada beklenir, aşılırsa arayüz eksik veriyi bildirir. */
export const MAX_PAGE = 2000

export function fetchDistricts(signal?: AbortSignal) {
  return getJson<PagedCollection<MultiPolygon, DistrictProperties>>(`/api/districts?limit=${MAX_PAGE}`, signal)
}

export function fetchFacilities(signal?: AbortSignal) {
  return getJson<PagedCollection<Point, FacilityProperties>>(`/api/facilities?limit=${MAX_PAGE}`, signal)
}
