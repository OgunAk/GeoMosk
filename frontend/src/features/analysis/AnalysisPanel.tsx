import type { Feature, Geometry, Point, Polygon } from 'geojson'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import {
  MAX_N,
  MAX_RADIUS_METERS,
  formatArea,
  formatDistance,
  runBuffer,
  runMeasure,
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
  /** Ölçüm (A04) yalnız çizgi ve alanlarda; nokta desteklenmez. */
  measurable: boolean
}

/** Analizde kullanılabilen, kaydedilmiş alan çizimi. */
export interface SavedArea {
  id: string
  name: string
  geometry: Polygon
}

/** Listede kaydedilmemiş (geçici) alanı temsil eder; kayıtlı çizimlerin UUID'siyle çakışmaz. */
const TEMPORARY_AREA = 'temporary'

interface AnalysisPanelProps {
  selected: SelectedSource | null
  /** Analiz panelinden çizilen, henüz kaydedilmemiş alan. */
  drawnArea: Polygon | null
  /** Çizim araçlarıyla kaydedilmiş alanlar (eskiden yeniye). */
  savedAreas: SavedArea[]
  /** Haritada işaretlenen tesis türleri; analizler bunlarla sınırlanır. */
  facilityTypes: FacilityType[]
  pickedPoint: [number, number] | null
  pickingPoint: boolean
  drawingArea: boolean
  result: AnalysisResponse | null
  onDrawArea: () => void
  onPickPoint: () => void
  onResult: (result: AnalysisResponse | null) => void
  /** Analiz çalışmadan önce haritada gösterilecek girdi (seçilen nokta veya alan). */
  onDraftChange: (draft: Geometry | null) => void
  /** Kaydedilmemiş alanı kayıt formuna gönderir. */
  onSaveDrawnArea: () => void
  /** Seçilen noktayı ve kaydedilmemiş alanı temizler. */
  onClearInput: () => void
  onSelectMatch: (feature: Feature<Point, MatchProperties>) => void
  onShowAll: () => void
}

const KINDS: { kind: AnalysisKind; label: string }[] = [
  { kind: 'within', label: 'Alan içindekiler' },
  { kind: 'buffer', label: 'Tampon (yakınlık)' },
  { kind: 'nearest', label: 'En yakın N' },
  { kind: 'measure', label: 'Ölçüm' },
]

/** A01-A03: hesap tamamen backend'de (PostGIS); arayüz yalnız girdiyi toplar ve sonucu gösterir. */
export function AnalysisPanel(props: AnalysisPanelProps) {
  const { selected, drawnArea, savedAreas, facilityTypes, pickedPoint, pickingPoint, drawingArea, result } = props
  const { onDrawArea, onPickPoint, onResult, onDraftChange, onSaveDrawnArea, onClearInput, onSelectMatch, onShowAll } = props
  const ids = { radius: useId(), n: useId(), type: useId(), area: useId() }
  const [kind, setKind] = useState<AnalysisKind>('within')
  const [areaSource, setAreaSource] = useState<'selected' | 'drawn'>('selected')
  const [areaChoice, setAreaChoice] = useState(TEMPORARY_AREA)
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

  // Seçim geçersizse (alan silindi, geçici alan kaydedildi) varsa geçici alan, yoksa en son kaydedilen alan kullanılır.
  const chosenSaved = savedAreas.find((a) => a.id === areaChoice)
  const effectiveChoice = areaChoice === TEMPORARY_AREA && drawnArea ? TEMPORARY_AREA : chosenSaved ? chosenSaved.id : drawnArea ? TEMPORARY_AREA : (savedAreas.at(-1)?.id ?? '')
  const usesTemporary = effectiveChoice === TEMPORARY_AREA
  const savedArea = savedAreas.find((a) => a.id === effectiveChoice) ?? null
  const drawnGeometry = usesTemporary ? drawnArea : (savedArea?.geometry ?? null)

  const allTypes = Object.keys(FACILITY_LABELS) as FacilityType[]
  const noTypes = facilityTypes.length === 0
  const typesFilter = facilityTypes.length === allTypes.length ? undefined : facilityTypes
  const usesFacilities = kind !== 'measure'
  // Tür kutusunda seçili tür haritadan kapatılırsa kutu "Tümü"ne (görünen türlere) döner.
  const nearestType = type !== '' && facilityTypes.includes(type) ? type : ''

  const draft = useMemo<Geometry | null>(() => {
    if (kind === 'nearest') return pickedPoint ? { type: 'Point', coordinates: pickedPoint } : null
    return kind === 'within' && areaSource === 'drawn' ? drawnGeometry : null
  }, [kind, areaSource, pickedPoint, drawnGeometry])
  useEffect(() => onDraftChange(draft), [draft, onDraftChange])

  const inputReady =
    kind === 'within'
      ? areaSource === 'drawn'
        ? drawnGeometry !== null
        : selected?.isArea === true
      : kind === 'buffer'
        ? selected !== null && radiusValid
        : kind === 'measure'
          ? selected?.measurable === true
          : pickedPoint !== null && nValid
  const ready = inputReady && !(usesFacilities && noTypes)
  const clearable = result !== null || (kind === 'nearest' && pickedPoint !== null) || (kind === 'within' && areaSource === 'drawn' && usesTemporary && drawnArea !== null)

  async function onRun(e: FormEvent) {
    e.preventDefault()
    if (!ready || running) return
    setRunning(true)
    setError(null)
    try {
      const response =
        kind === 'within'
          ? await runWithin(
              areaSource === 'selected' ? { sourceFeature: selected!.ref } : usesTemporary ? { geometry: drawnArea! } : { sourceFeature: { layerId: 'user-features', id: savedArea!.id } },
              includeBoundary,
              typesFilter,
            )
          : kind === 'buffer'
            ? await runBuffer({ sourceFeature: selected!.ref }, radiusValue, typesFilter)
            : kind === 'measure'
              ? await runMeasure({ sourceFeature: selected!.ref })
              : await runNearest(pickedPoint!, nValue, nearestType, typesFilter)
      onResult(response)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'Analiz yapılamadı; bağlantıyı kontrol edin.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section aria-labelledby="analysis-title" className="min-w-0 rounded-lg border border-orange-200 bg-white p-4 text-sm">
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
                Çizilen alan: {drawnGeometry ? <strong className="min-w-0 break-words">{usesTemporary ? 'kaydedilmemiş alan' : savedArea!.name}</strong> : <em className="text-slate-500">yok</em>}
              </label>
              {areaSource === 'drawn' && (
                <div className="space-y-2 pl-5">
                  {(savedAreas.length > 0 || drawnArea) && (
                    <div>
                      <label htmlFor={ids.area} className="block text-xs text-slate-600">
                        Alan seçin
                      </label>
                      <select id={ids.area} value={effectiveChoice} onChange={(e) => setAreaChoice(e.target.value)} className="w-full min-w-0 truncate rounded border border-slate-300 px-2 py-1">
                        {drawnArea && <option value={TEMPORARY_AREA}>Kaydedilmemiş alan</option>}
                        {savedAreas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAreaChoice(TEMPORARY_AREA)
                        onDrawArea()
                      }}
                      disabled={drawingArea}
                      className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {drawingArea ? 'Alanı çizin, bitirmek için sağ tıklayın' : drawnArea ? 'Yeniden çiz' : 'Haritada alan çiz'}
                    </button>
                    {usesTemporary && drawnArea && (
                      <button type="button" onClick={onSaveDrawnArea} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100">
                        Alanı kaydet
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Çizim bölümünde kaydettiğiniz alanlar da bu listede görünür.</p>
                </div>
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
            {/* Dar yan panelde (320 px) taşmasın: bilgi ve düğme ayrı satırda, düğme tam genişlik. */}
            <div className="space-y-1">
              <p className="break-words">
                Nokta:{' '}
                {pickedPoint ? (
                  <strong className="tabular-nums">
                    {pickedPoint[1].toFixed(5)}, {pickedPoint[0].toFixed(5)}
                  </strong>
                ) : (
                  <em className="text-slate-500">seçilmedi</em>
                )}
              </p>
              <button
                type="button"
                onClick={onPickPoint}
                disabled={pickingPoint}
                className="w-full rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-50"
              >
                {pickingPoint ? 'Haritaya tıklayın…' : pickedPoint ? 'Başka nokta seç' : 'Haritada nokta seç'}
              </button>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <div className="min-w-0">
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
                  className="w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={ids.type} className="block text-xs text-slate-600">
                  Tür
                </label>
                <select
                  id={ids.type}
                  value={nearestType}
                  onChange={(e) => setType(e.target.value as FacilityType | '')}
                  className="w-full min-w-0 truncate rounded border border-slate-300 px-2 py-1"
                >
                  <option value="">Tümü</option>
                  {facilityTypes.map((t) => (
                    <option key={t} value={t}>
                      {FACILITY_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!nValid && <p className="text-xs text-red-700">N 1 ile {MAX_N} arasında tam sayı olmalı.</p>}
          </>
        )}

        {kind === 'measure' && (
          <div className="space-y-1">
            <p className="break-words">
              Obje: {selected ? <strong>{selected.label}</strong> : <em className="text-slate-500">haritada bir ilçe veya çizgi/alan çizimi seçin</em>}
            </p>
            {selected && !selected.measurable && (
              <p className="text-xs text-amber-800">Desteklenmeyen ölçüm: noktanın uzunluğu veya alanı yoktur.</p>
            )}
            <p className="text-xs text-slate-600">Çizgide uzunluk, alanda alan ve çevre; EPSG:32635 (UTM 35N) projeksiyonunda metre.</p>
          </div>
        )}

        {usesFacilities && typesFilter && (
          <p className={noTypes ? 'text-xs text-amber-800' : 'text-xs text-slate-600'}>
            {noTypes ? 'Analiz için katman panelinden en az bir tesis türü işaretleyin.' : `Yalnız işaretli türler: ${facilityTypes.map((t) => FACILITY_LABELS[t]).join(', ')}.`}
          </p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={!ready || running} className="rounded bg-orange-600 px-3 py-1 text-white hover:bg-orange-700 disabled:opacity-50">
            {running ? 'Hesaplanıyor…' : 'Analizi çalıştır'}
          </button>
          {clearable && (
            <button
              type="button"
              onClick={() => {
                onResult(null)
                onClearInput()
              }}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
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
  if (result.analysis === 'measure' && result.measurement) return <MeasurementResult result={result} onShowAll={onShowAll} />
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

function MeasurementResult({ result, onShowAll }: { result: AnalysisResponse; onShowAll: () => void }) {
  const m = result.measurement!
  const rows: [string, string, number][] = []
  if (m.lengthMeters !== null) rows.push(['Uzunluk', formatDistance(m.lengthMeters), m.lengthMeters])
  if (m.areaSquareMeters !== null) rows.push(['Alan', formatArea(m.areaSquareMeters), m.areaSquareMeters])
  if (m.perimeterMeters !== null) rows.push(['Çevre', formatDistance(m.perimeterMeters), m.perimeterMeters])
  const difference = (m.geodesicCheck.relativeDifference * 100).toLocaleString('tr-TR', { maximumFractionDigits: 3 })
  return (
    <div className="mt-3 border-t border-slate-200 pt-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 break-words font-medium text-slate-800">Ölçüm: {result.input.properties.label ?? 'seçili obje'}</p>
        <button type="button" onClick={onShowAll} className="shrink-0 text-blue-700 underline">
          Haritada göster
        </button>
      </div>
      <dl aria-label="Ölçüm sonuçları" className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([label, display, raw]) => (
          <div key={label} className="contents">
            <dt className="text-slate-600">{label}</dt>
            <dd className="tabular-nums">
              <strong>{display}</strong>
              <span className="block text-xs text-slate-500">
                {raw.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} {label === 'Alan' ? 'm²' : 'm'}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-slate-500">
        EPSG:{m.calculationSrid} ({m.calculationCrs}) projeksiyonunda, ST_Transform sonrası. Sferoid (geography) çapraz kontrolüyle fark: %{difference}.
      </p>
    </div>
  )
}
