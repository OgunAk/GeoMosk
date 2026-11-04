import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../services/apiClient'
import { fetchFeature, type SourceFeatureDetail, type SourceLayerId } from '../../services/sourceLayers'

/** Kaynak (OSM) katmanlarından bir kaydın seçimi. */
export interface SourceSelection {
  layer: SourceLayerId
  id: number
}

export type DetailState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; feature: SourceFeatureDetail; etag: string }

type Settled = Exclude<DetailState, { kind: 'none' } | { kind: 'loading' }>

/**
 * Seçili objenin tekil kaydını (kaynak etiketleri + ETag) yükler; seçim değişince eski istek iptal edilir.
 * Sonuç istek anahtarıyla saklanır: anahtar değişince "yükleniyor" render sırasında türetilir.
 */
export function useFeatureDetail(selection: SourceSelection | null) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Settled } | null>(null)
  const key = selection ? `${selection.layer}/${selection.id}/${attempt}` : null

  useEffect(() => {
    if (!selection || !key) return
    const controller = new AbortController()
    fetchFeature(selection.layer, selection.id, controller.signal)
      .then(({ data, etag }) => setResult({ key, value: { kind: 'loaded', feature: data, etag: etag ?? '"0"' } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message =
          error instanceof ApiError && error.status === 404 ? 'Kayıt bulunamadı (kaynakta kaldırılmış olabilir).' : 'Kayıt yüklenemedi.'
        setResult({ key, value: { kind: 'error', message } })
      })
    return () => controller.abort()
  }, [selection, key])

  const state: DetailState = !key ? { kind: 'none' } : result?.key === key ? result.value : { kind: 'loading' }

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const replace = useCallback(
    (feature: SourceFeatureDetail, etag: string) => {
      if (key) setResult({ key, value: { kind: 'loaded', feature, etag } })
    },
    [key],
  )

  return { state, reload, replace }
}
