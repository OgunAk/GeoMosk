import { useCallback, useEffect, useState } from 'react'
import { fetchUserFeatures, type UserFeatureCollection } from '../../services/userFeatures'

export type UserFeaturesState = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; collection: UserFeatureCollection }

/** Kullanıcı çizimleri katmanı. refresh mevcut veriyi gösterirken arka planda yeniler. */
export function useUserFeatures() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<UserFeaturesState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchUserFeatures(controller.signal)
      .then((collection) => setState({ kind: 'loaded', collection }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('Kullanıcı çizimleri alınamadı', error)
        setState((current) => (current.kind === 'loaded' ? current : { kind: 'error' }))
      })
    return () => controller.abort()
  }, [attempt])

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, refresh }
}
