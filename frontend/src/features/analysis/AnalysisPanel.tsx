import type { Feature, Point, Polygon } from 'geojson'
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import {
  MAX_N,
  MAX_RADIUS_METERS,
  formatDistance,
  runBuffer,
  runNearest,
  runWithin,
  type AnalysisKind,
  type AnalysisResponse,
  type MatchProperties,
  type SourceRef,
} from '../../services/analysis'
import type { FacilityType } from '../../services/sourceLayers'
import { FACILITY_LABELS } from '../map/mapStyle'

/** Panelin analiz kaynağı olarak kullanabileceği mevcut seçim. */
export interface SelectedSource {
  ref: SourceRef
  label: string
  /** Alan analizi yalnız alanlarla (ilçe, Polygon çizim) yapılabilir. */
  isArea: boolean
}

interface AnalysisPanelProps {
  selected: SelectedSource | null
  drawnArea: Polygon | null
  pickedPoint: [number, number] | null
  pickingPoint: boolean
  drawingArea: boolean
  result: AnalysisResponse | null
  onDrawArea: () => void
  onPickPoint: () => void
  onResult: (result: AnalysisResponse | null) => void
  onSelectMatch: (feature: Feature<Point, MatchProperties>) => void
  onShowAll: () => void
}

const KINDS: { kind: AnalysisKind; label: string }[] = [
  { kind: 'within', label: 'Alan içindekiler' },
  { kind: 'buffer', label: 'Tampon (yakınlık)' },
  { kind: 'nearest', label: 'En yakın N' },
]

/** A01-A03: hesap tamamen backend'de (PostGIS); arayüz yalnız girdiyi toplar ve sonucu gösterir. */
export function AnalysisPanel(props: AnalysisPanelProps) {
  const { selected, drawnArea, pickedPoint, pickingPoint, drawingArea, result, onDrawArea, onPickPoint, onResult, onSelectMatch, onShowAll } = props
  const ids = { radius: useId(), n: useId(), type: useId() }
  const [kind, setKind] = useState<AnalysisKind>('within')
  const [areaSource, setAreaSource] = useState<'selected' | 'drawn'>('selected')
  const [includeBoundary, setIncludeBoundary] = useState(true)
  const [radius, setRadius] = useState('2000')
  const [n, setN] = useState('5')
  const [type, setType] = useState<FacilityType | ''>('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const radiusValue = Number(radius)
  const radiusValid = Number.isFinite(radiusValue) && radiusValue > 0 && radiusValue <= MAX_RADIUS_METERS
  const nValue = Number(n)
  const nValid = Number.isInteger(nValue) && nValue >= 1 && nValue <= MAX_N

  const ready =
    kind === 'within'
      ? areaSource === 'drawn'
        ? drawnArea !== null
        : selected?.isArea === true
      : kind === 'buffer'
        ? selected !== null && radiusValid
        : pickedPoint !== null && nValid

  async function onRun(e: FormEvent) {
    e.preventDefault()
    if (!ready || running) return
    setRunning(true)
    setError(null)
    try {
      const response =
        kind === 'within'
          ? await runWithin(areaSource === 'drawn' ? { geometry: drawnArea! } : { sourceFeature: selected!.ref }, includeBoundary)
          : kind === 'buffer'
            ? await runBuffer({ sourceFeature: selected!.ref }, radiusValue)
            : await runNearest(pickedPoint!, nValue, type)
      onResult(response)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'Analiz yapılamadı; bağlantıyı kontrol edin.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section aria-labelledby="analysis-title" className="rounded-lg border border-orange-200 bg-white p-4 text-sm">
      <h2 id="analysis-title" className="font-semibold text-slate-900">
        Analiz
      </h2>
      <div role="radiogroup" aria-label="Analiz türü" className="mt-2 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <label key={k.kind} className="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name="analysis-kind"
              checked={kind === k.kind}
              onChange={() => {
                setKind(k.kind)
                setError(null)
              }}
              className="accent-orange-600"
            />
            {k.label}
          </label>
        ))}
      </div>

      <form onSubmit={onRun} className="mt-3 space-y-2">
        {kind === 'within' && (
          <>
            <fieldset className="space-y-1">
              <legend className="text-xs text-slate-600">Alan</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="area-source" checked={areaSource === 'selected'} onChange={() => setAreaSource('selected')} />
                Seçili ilçe / alan çizimi: {selected?.isArea ? <strong>{selected.label}</strong> : <em className="text-slate-500">haritada bir ilçe veya alan seçin</em>}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="area-source" checked={areaSource === 'drawn'} onChange={() => setAreaSource('drawn')} />
                Çizilen alan: {drawnArea ? <strong>hazır</strong> : <em className="text-slate-500">yok</em>}
              </label>
              {areaSource === 'drawn' && (
                <button type="button" onClick={onDrawArea} disabled={drawingArea} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-50">
                  {drawingArea ? 'Alanı çizin, sonra "Çizimi bitir"' : drawnArea ? 'Yeniden çiz' : 'Haritada alan çiz'}
                </button>
              )}
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeBoundary} onChange={(e) => setIncludeBoundary(e.target.checked)} />
              Sınır üzerindeki tesisler dahil
            </label>
          </>
        )}

        {kind === 'buffer' && (
          <>
            <p>
              Kaynak: {selected ? <strong>{selected.label}</strong> : <em className="text-slate-500">haritada bir tesis, ilçe veya çizim seçin</em>}
            </p>
            <div>
              <label htmlFor={ids.radius} className="block text-xs text-slate-600">
                Mesafe (metre, en çok {MAX_RADIUS_METERS.toLocaleString('tr-TR')})
              </label>
              <input
                id={ids.radius}
                type="number"
                min={1}
                max={MAX_RADIUS_METERS}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                aria-invalid={!radiusValid}
                className="w-32 rounded border border-slate-300 px-2 py-1"
              />
              {!radiusValid && <p className="text-xs text-red-700">0'dan büyük ve en çok 50.000 m olmalı.</p>}
            </div>
          </>
        )}

        {kind === 'nearest' && (
          <>
            <p className="flex flex-wrap items-center gap-2">
              Nokta:{' '}
              {pickedPoint ? (
                <strong>
                  {pickedPoint[1].toFixed(5)}, {pickedPoint[0].toFixed(5)}
                </strong>
              ) : (
                <em className="text-slate-500">seçilmedi</em>
              )}
              <button type="button" onClick={onPickPoint} disabled={pickingPoint} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-50">
                {pickingPoint ? 'Haritaya tıklayın…' : 'Haritada nokta seç'}
              </button>
            </p>
            <div className="flex gap-3">
              <div>
                <label htmlFor={ids.n} className="block text-xs text-slate-600">
                  N (1–{MAX_N})
                </label>
                <input
                  id={ids.n}
                  type="number"
                  min={1}
                  max={MAX_N}
                  value={n}
                  onChange={(e) => setN(e.target.value)}
                  aria-invalid={!nValid}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div>
                <label htmlFor={ids.type} className="block text-xs text-slate-600">
                  Tür
                </label>
                <select id={ids.type} value={type} onChange={(e) => setType(e.target.value as FacilityType | '')} className="rounded border border-slate-300 px-2 py-1">
                  <option value="">Tümü</option>
                  {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((t) => (
                    <option key={t} value={t}>
                      {FACILITY_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={!ready || running} className="rounded bg-orange-600 px-3 py-1 text-white hover:bg-orange-700 disabled:opacity-50">
            {running ? 'Hesaplanıyor…' : 'Analizi çalıştır'}
          </button>
          {result && (
            <button type="button" onClick={() => onResult(null)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Temizle
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </form>

      {result && <AnalysisResults result={result} onSelectMatch={onSelectMatch} onShowAll={onShowAll} />}
    </section>
  )
}

function AnalysisResults({
  result,
  onSelectMatch,
  onShowAll,
}: {
  result: AnalysisResponse
  onSelectMatch: (feature: Feature<Point, MatchProperties>) => void
  onShowAll: () => void
}) {
  const { features, meta } = result.matches
  const summary =
    result.analysis === 'within'
      ? `Alan içinde ${features.length} tesis${result.parameters.includeBoundary ? ' (sınır dahil)' : ' (sınır hariç)'}`
      : result.analysis === 'buffer'
        ? `${formatDistance(Number(result.parameters.radiusMeters))} içinde ${features.length} tesis`
        : `En yakın ${features.length} tesis (kuş uçuşu)`
  return (
    <div className="mt-3 border-t border-slate-200 pt-2" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="font-medium text-slate-800">{summary}</p>
        {features.length > 0 && (
          <button type="button" onClick={onShowAll} className="text-blue-700 underline">
            Haritada göster
          </button>
        )}
      </div>
      {meta.hasMore && <p className="text-amber-800">Sonuç sınırı aşıldı; ilk {meta.limit} tesis gösteriliyor.</p>}
      {features.length === 0 && <p className="text-slate-600">Bu ölçütlere uyan tesis yok.</p>}
      <ol className="mt-1 max-h-64 space-y-1 overflow-y-auto" aria-label="Analiz sonuçları">
        {features.map((f) => (
          <li key={String(f.id)}>
            <button type="button" onClick={() => onSelectMatch(f)} className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left hover:bg-slate-100">
              {f.properties.rank !== undefined && <span className="w-6 shrink-0 text-right tabular-nums text-slate-500">{f.properties.rank}.</span>}
              <span className="flex-1">
                {f.properties.name ?? 'Adsız tesis'}
                <span className="block text-xs text-slate-600">{FACILITY_LABELS[f.properties.facilityType]}</span>
              </span>
              {f.properties.distanceMeters !== undefined && <span className="tabular-nums text-slate-700">{formatDistance(f.properties.distanceMeters)}</span>}
            </button>
          </li>
        ))}
      </ol>
      {result.analysis === 'buffer' && <p className="mt-1 text-xs text-slate-500">Haritadaki tampon yaklaşık bir çokgendir; seçim kesin mesafeyle yapılır.</p>}
    </div>
  )
}
