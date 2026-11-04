import type { Feature, Geometry } from 'geojson'
import { useEffect, useId, useMemo, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { ApiError } from '../../services/apiClient'
import {
  SEARCH_LIMIT,
  searchFeatures,
  type DistrictProperties,
  type FacilityProperties,
  type FacilityType,
  type PageMeta,
  type SourceLayerId,
} from '../../services/sourceLayers'
import { FACILITY_LABELS } from '../map/mapStyle'
import { displayName } from './displayName'

type ResultFeature = Feature<Geometry, DistrictProperties | FacilityProperties>

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; features: ResultFeature[]; meta: PageMeta }

type SettledSearch = Extract<SearchState, { kind: 'error' } | { kind: 'done' }>
interface SearchPanelProps {
  districts: { id: number; name: string }[]
  onResults: (layer: SourceLayerId, features: ResultFeature[]) => void
  onPick: (layer: SourceLayerId, feature: ResultFeature) => void
  onShowAll: (features: ResultFeature[]) => void
}

const DEBOUNCE_MS = 300

/**
 * Sunucu tarafı arama (M04): tüm veri kapsamında, yüklü harita sayfasıyla sınırlı değil.
 * Sonuçlar haritada vurgulanır; listeden seçim objeye zoom yapar.
 */
export function SearchPanel({ districts, onResults, onPick, onShowAll }: SearchPanelProps) {
  const ids = { q: useId(), layer: useId(), type: useId(), district: useId() }
  const [layer, setLayer] = useState<SourceLayerId>('facilities')
  const [q, setQ] = useState('')
  const [type, setType] = useState<FacilityType | ''>('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  // Sonuç, hangi ölçüt anahtarına ait olduğuyla saklanır; anahtar değişince "aranıyor" render sırasında türetilir.
  const [result, setResult] = useState<{ key: string; value: SettledSearch } | null>(null)

  // Debounce kararlı bir metin anahtarı üzerinde yapılır; her render'da yeni nesne vermek sonsuz döngü yaratırdı.
  const debouncedKey = useDebouncedValue(JSON.stringify({ layer, q: q.trim(), type, districtId }), DEBOUNCE_MS)
  const criteria = useMemo(
    () => JSON.parse(debouncedKey) as { layer: SourceLayerId; q: string; type: FacilityType | ''; districtId: number | null },
    [debouncedKey],
  )
  const hasCriteria = criteria.q.length > 0 || (criteria.layer === 'facilities' && (criteria.type !== '' || criteria.districtId !== null))

  useEffect(() => {
    if (!hasCriteria) {
      onResults(criteria.layer, []) // vurguyu temizle
      return
    }
    // Eski istek iptal edilir; geç gelen yanıt yeni sonucu ezemez.
    const controller = new AbortController()
    searchFeatures(criteria, controller.signal)
      .then((response) => {
        const features = response.features as ResultFeature[]
        setResult({ key: debouncedKey, value: { kind: 'done', features, meta: response.meta } })
        onResults(criteria.layer, features)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof ApiError ? error.userMessage : 'Arama yapılamadı.'
        setResult({ key: debouncedKey, value: { kind: 'error', message } })
      })
    return () => controller.abort()
  }, [criteria, debouncedKey, hasCriteria, onResults])

  const state: SearchState = !hasCriteria ? { kind: 'idle' } : result?.key === debouncedKey ? result.value : { kind: 'loading' }

  return (
    <section aria-labelledby="search-title" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 id="search-title" className="font-semibold text-slate-900">
        Ara ve filtrele
      </h2>
      <div className="mt-2 grid gap-2">
        <label htmlFor={ids.layer} className="sr-only">
          Aranacak katman
        </label>
        <select
          id={ids.layer}
          value={layer}
          onChange={(e) => setLayer(e.target.value as SourceLayerId)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          <option value="facilities">Sağlık tesisleri</option>
          <option value="districts">İlçeler</option>
        </select>
        <label htmlFor={ids.q} className="sr-only">
          Ad ile ara
        </label>
        <input
          id={ids.q}
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad ile ara (ör. devlet hastanesi)"
          className="rounded border border-slate-300 px-2 py-1"
        />
        {layer === 'facilities' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={ids.type} className="block text-xs text-slate-600">
                Tür
              </label>
              <select
                id={ids.type}
                value={type}
                onChange={(e) => setType(e.target.value as FacilityType | '')}
                className="w-full rounded border border-slate-300 px-2 py-1"
              >
                <option value="">Tümü</option>
                {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((t) => (
                  <option key={t} value={t}>
                    {FACILITY_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.district} className="block text-xs text-slate-600">
                İlçe
              </label>
              <select
                id={ids.district}
                value={districtId ?? ''}
                onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded border border-slate-300 px-2 py-1"
              >
                <option value="">Tümü</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3" aria-live="polite">
        {state.kind === 'loading' && <p className="text-slate-600">Aranıyor…</p>}
        {state.kind === 'error' && <p className="text-red-700">{state.message}</p>}
        {state.kind === 'done' && state.features.length === 0 && <p className="text-slate-600">Sonuç bulunamadı.</p>}
        {state.kind === 'done' && state.features.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-slate-700">
                {state.meta.hasMore ? `İlk ${SEARCH_LIMIT} sonuç gösteriliyor` : `${state.features.length} sonuç`}
              </p>
              <button
                type="button"
                onClick={() => onShowAll(state.features)}
                className="text-blue-700 underline hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Tümünü haritada göster
              </button>
            </div>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto" aria-label="Arama sonuçları">
              {state.features.map((f) => (
                <li key={String(f.id)}>
                  <button
                    type="button"
                    onClick={() => onPick(criteria.layer, f)}
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <span className="block">{displayName(f.properties)}</span>
                    {f.properties.layer === 'facilities' && (
                      <span className="block text-xs text-slate-600">{FACILITY_LABELS[f.properties.facilityType]}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
