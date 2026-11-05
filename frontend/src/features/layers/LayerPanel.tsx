import type { SourceLayersState } from '../map/useSourceLayers'
import type { LayerKey } from '../map/layerIds'
import { BASEMAPS, FACILITY_COLORS, FACILITY_LABELS, USER_COLOR, type BasemapId } from '../map/mapStyle'
import type { FacilityType } from '../../services/sourceLayers'

interface LayerPanelProps {
  state: SourceLayersState
  /** Kullanıcı çizimi sayısı; yüklenmediyse null. */
  userCount: number | null
  /** Kullanıcı çizimleri liste sınırını (2000) aştı: haritada hepsi yok. */
  userHasMore?: boolean
  onRetry: () => void
  visibility: Record<LayerKey, boolean>
  onToggle: (layer: LayerKey, visible: boolean) => void
  basemap: BasemapId
  onBasemapChange: (basemap: BasemapId) => void
  /** Haritada gösterilen tesis türleri (geliştirici geri bildirimi G2). */
  facilityTypes: Record<FacilityType, boolean>
  onToggleFacilityType: (type: FacilityType, visible: boolean) => void
}

const LAYER_TITLES: Record<LayerKey, string> = {
  districts: 'İlçe sınırları',
  facilities: 'Sağlık tesisleri',
  'user-features': 'Kullanıcı çizimleri',
}

/** Katman aç/kapa (M02), altlık seçimi (M05), sayılar, tesis türü lejantı ve kaynak atfı. */
export function LayerPanel(props: LayerPanelProps) {
  const { state, userCount, userHasMore = false, onRetry, visibility, onToggle, basemap, onBasemapChange, facilityTypes, onToggleFacilityType } = props
  const facilityCounts = Object.fromEntries((Object.keys(FACILITY_LABELS) as FacilityType[]).map((t) => [t, 0])) as Record<FacilityType, number>
  if (state.kind === 'loaded') for (const f of state.facilities.features) facilityCounts[f.properties.facilityType]++
  return (
    <section aria-labelledby="layer-panel-title" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 id="layer-panel-title" className="font-semibold text-slate-900">
        Katmanlar
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
          <ul className="mt-2 space-y-1">
            {(['districts', 'facilities'] as const).map((layer) => (
              <li key={layer}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibility[layer]}
                    onChange={(e) => onToggle(layer, e.target.checked)}
                    className="size-4 accent-blue-700"
                  />
                  <span className="flex-1">{LAYER_TITLES[layer]}</span>
                  <span className="tabular-nums text-slate-600">{state[layer].meta.returned}</span>
                </label>
              </li>
            ))}
            <li>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility['user-features']}
                  onChange={(e) => onToggle('user-features', e.target.checked)}
                  className="size-4 accent-blue-700"
                />
                <span aria-hidden className="inline-block size-3 rounded-sm" style={{ backgroundColor: USER_COLOR }} />
                <span className="flex-1">{LAYER_TITLES['user-features']}</span>
                <span className="tabular-nums text-slate-600">{userCount ?? '…'}</span>
              </label>
            </li>
          </ul>
          {(state.districts.meta.hasMore || state.facilities.meta.hasMore || userHasMore) && (
            <p role="status" className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-900">
              Kayıt sınırı aşıldı; haritada verinin yalnızca bir kısmı gösteriliyor.
            </p>
          )}
          <fieldset className="mt-3" disabled={!visibility.facilities}>
            <legend className="text-slate-700">Tesis türleri (haritada göster)</legend>
            <ul className="mt-1 space-y-1">
              {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((type) => (
                <li key={type}>
                  <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={facilityTypes[type]}
                      onChange={(e) => onToggleFacilityType(type, e.target.checked)}
                      className="size-4 accent-blue-700"
                    />
                    <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: FACILITY_COLORS[type] }} />
                    <span className="flex-1">{FACILITY_LABELS[type]}</span>
                    <span className="tabular-nums text-slate-500">{facilityCounts[type]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      )}
      <fieldset className="mt-4">
        <legend className="font-medium text-slate-900">Altlık</legend>
        {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
          <label key={id} className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="basemap"
              value={id}
              checked={basemap === id}
              onChange={() => onBasemapChange(id)}
              className="size-4 accent-blue-700"
            />
            {BASEMAPS[id].label}
          </label>
        ))}
      </fieldset>
      <p className="mt-3 text-xs text-slate-500">Veri: © OpenStreetMap katkıcıları, ODbL.</p>
    </section>
  )
}
