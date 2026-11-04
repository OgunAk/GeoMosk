import type { MultiPolygon, Point } from 'geojson'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchDistricts,
  fetchFacilities,
  type DistrictProperties,
  type FacilityProperties,
  type PagedCollection,
} from '../../services/sourceLayers'

export type SourceLayersState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'loaded'
      districts: PagedCollection<MultiPolygon, DistrictProperties>
      facilities: PagedCollection<Point, FacilityProperties>
    }

/** İlçe ve tesis katmanlarını API'den yükler; unmount/yeniden denemede eski isteği iptal eder. */
export function useSourceLayers() {
  const [state, setState] = useState<SourceLayersState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchDistricts(controller.signal), fetchFacilities(controller.signal)])
      .then(([districts, facilities]) => setState({ kind: 'loaded', districts, facilities }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('Katman verisi alınamadı', error)
          setState({ kind: 'error' })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setState({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
