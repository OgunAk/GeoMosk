import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import { requestJson } from './apiClient'
import type { PageMeta } from './sourceLayers'

// Sözleşme: docs/API-CONTRACT.md "Kullanıcı çizimleri", backend/GeoScope.Api/Controllers/UserFeaturesController.cs
export type UserGeometry = Point | LineString | Polygon

export interface UserFeatureProperties {
  layer: 'user-features'
  name: string
  description: string | null
  geometryType: 'Point' | 'LineString' | 'Polygon'
  createdAt: string
  updatedAt: string
}

export type UserFeature = Feature<UserGeometry, UserFeatureProperties> & { id: string }
export type UserFeatureCollection = FeatureCollection<UserGeometry, UserFeatureProperties> & { meta: PageMeta }

/** Sunucu kuralıyla aynı: boşluklar kırpıldıktan sonra en az 3 karakter. */
export const USER_NAME_MIN = 3
export const USER_NAME_MAX = 200

/** Kırpılmış adın karakter sayısı (birleşik karakterler tek sayılır, sunucudaki StringInfo ile aynı). */
export function nameLength(name: string): number {
  return [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(name.trim())].length
}
export const USER_DESCRIPTION_MAX = 2000
export const MAX_VERTICES = 10_000

export function fetchUserFeatures(signal?: AbortSignal) {
  return requestJson<UserFeatureCollection>('/api/features?limit=2000', { signal }).then((r) => r.data)
}

export function fetchUserFeature(id: string, signal?: AbortSignal) {
  return requestJson<UserFeature>(`/api/features/${id}`, { signal })
}

export function createUserFeature(geometry: UserGeometry, name: string, description: string | null) {
  return requestJson<UserFeature>('/api/features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'Feature', geometry, properties: { name, description } }),
  })
}

export interface UserFeaturePatch {
  name?: string
  description?: string | null
  geometry?: UserGeometry
}

export function patchUserFeature(id: string, patch: UserFeaturePatch, etag: string) {
  return requestJson<UserFeature>(`/api/features/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(patch),
  })
}

export function deleteUserFeature(id: string, etag: string) {
  return requestJson<null>(`/api/features/${id}`, { method: 'DELETE', headers: { 'If-Match': etag } })
}

/** İstemci ön kontrolü; sunucu aynı kuralları yeniden uygular (yalnız kullanıcıyı erken uyarır). */
export function vertexCount(geometry: UserGeometry): number {
  switch (geometry.type) {
    case 'Point':
      return 1
    case 'LineString':
      return geometry.coordinates.length
    case 'Polygon':
      return geometry.coordinates.reduce((n, ring) => n + ring.length, 0)
  }
}

export const GEOMETRY_LABELS: Record<UserGeometry['type'], string> = {
  Point: 'Nokta',
  LineString: 'Çizgi',
  Polygon: 'Alan',
}
