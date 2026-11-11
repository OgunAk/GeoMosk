import type { MultiPolygon, Point } from 'geojson'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchDistricts,
  fetchFacilities,
  type DistrictProperties,
  type FacilityProperties,
  type PagedCollection,
} from '../../services/sourceLayers'
import { bboxParam } from './bboxLoading'
import type { Bbox } from './geometry'

type Districts = PagedCollection<MultiPolygon, DistrictProperties>
type Facilities = PagedCollection<Point, FacilityProperties>

export type SourceLayersState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'loaded'
      districts: Districts
      /** Son yüklenen kutudaki tesisler (bbox ile; ADR-0016). */
      facilities: Facilities
      /** Gösterilen tesislerin istendiği kutu. */
      facilitiesBbox: Bbox
      /** Yeni kutunun isteği sürüyor; o gelene kadar önceki tesisler gösterilir (titreme yok). */
      facilitiesPending: boolean
      /** Yeni kutunun isteği başarısız oldu; gösterilen tesisler önceki kutuya ait (kullanıcıya bildirilir). */
      facilitiesStale: boolean
    }

type FacilitiesResult = { key: string; bbox: Bbox; data: Facilities } | 'error' | null

/**
 * İlçeler (17 kayıt) tek istekte; tesisler verilen kutuya göre yüklenir. Kutu değişince önceki istek iptal edilir
 * (AbortController) ve yalnız güncel kutunun yanıtı yazılır. Hata olursa eldeki veri korunur.
 * <c>refresh</c> görünen veriyi korurak arka planda yeniler (düzenleme sonrası); <c>retry</c> hatadan sonra baştan yükler.
 */
export function useSourceLayers(facilityBbox: Bbox | null) {
  const [attempt, setAttempt] = useState(0)
  const [districts, setDistricts] = useState<Districts | 'error' | null>(null)
  const [facilities, setFacilities] = useState<FacilitiesResult>(null)
  // Başarısız olan kutu ve deneme: yeniden deneme (attempt artışı) başlayınca uyarı kalkar, istek sürüyor görünür.
  const [failed, setFailed] = useState<{ key: string; attempt: number } | null>(null)
  const key = facilityBbox ? bboxParam(facilityBbox) : ''

  useEffect(() => {
    const controller = new AbortController()
    fetchDistricts(controller.signal)
      .then(setDistricts)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('İlçe verisi alınamadı', error)
        setDistricts((current) => (current && current !== 'error' ? current : 'error'))
      })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (!key) return
    // Kutu, içeriğini temsil eden key'den okunur: aynı kutunun yeni dizi kimliği istek doğurmaz.
    const bbox = key.split(',').map(Number) as Bbox
    const controller = new AbortController()
    fetchFacilities(bbox, controller.signal)
      .then((data) => setFacilities({ key, bbox, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('Tesis verisi alınamadı', error)
        setFailed({ key, attempt })
        setFacilities((current) => (current && current !== 'error' ? current : 'error'))
      })
    return () => controller.abort()
  }, [attempt, key])

  const retry = useCallback(() => {
    setDistricts(null)
    setFacilities(null)
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])

  // Kimlik yalnız veri değişince değişir: harita efektleri buna bağlı ve her render'da veriyi yeniden yüklememeli.
  const state = useMemo<SourceLayersState>(() => {
    if (districts === 'error' || facilities === 'error') return { kind: 'error' }
    if (!districts || !facilities) return { kind: 'loading' }
    const behind = facilities.key !== key
    const stale = behind && failed?.key === key && failed.attempt === attempt
    return {
      kind: 'loaded',
      districts,
      facilities: facilities.data,
      facilitiesBbox: facilities.bbox,
      facilitiesPending: behind && !stale,
      facilitiesStale: stale,
    }
  }, [districts, facilities, key, failed, attempt])

  return { state, retry, refresh }
}
