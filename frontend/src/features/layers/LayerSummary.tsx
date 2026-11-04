import type { SourceLayersState } from '../map/useSourceLayers'
import { FACILITY_COLORS, FACILITY_LABELS } from '../map/mapStyle'
import type { FacilityType } from '../../services/sourceLayers'

interface LayerSummaryProps {
  state: SourceLayersState
  onRetry: () => void
}

/** Yüklenen katmanların sayıları, tesis türü lejantı ve kaynak atfı. */
export function LayerSummary({ state, onRetry }: LayerSummaryProps) {
  return (
    <section aria-labelledby="layer-summary-title" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 id="layer-summary-title" className="font-semibold text-slate-900">
        Veri katmanları
      </h2>
      {state.kind === 'loading' && <p className="mt-2 text-slate-600">Yükleniyor…</p>}
      {state.kind === 'error' && (
        <div className="mt-2">
          <p className="text-red-700">Katman verisi alınamadı.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Tekrar dene
          </button>
        </div>
      )}
      {state.kind === 'loaded' && (
        <>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt>İlçe sınırları</dt>
            <dd className="text-right tabular-nums">{state.districts.meta.returned}</dd>
            <dt>Sağlık tesisleri</dt>
            <dd className="text-right tabular-nums">{state.facilities.meta.returned}</dd>
          </dl>
          {(state.districts.meta.hasMore || state.facilities.meta.hasMore) && (
            <p role="status" className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-900">
              Kayıt sınırı aşıldı; haritada verinin yalnızca bir kısmı gösteriliyor.
            </p>
          )}
          <ul className="mt-3 space-y-1" aria-label="Tesis türleri">
            {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((type) => (
              <li key={type} className="flex items-center gap-2">
                <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: FACILITY_COLORS[type] }} />
                {FACILITY_LABELS[type]}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Veri: © OpenStreetMap katkıcıları, ODbL.
          </p>
        </>
      )}
    </section>
  )
}
