import type { Feature, Geometry, Polygon } from 'geojson'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisPanel, type SelectedSource } from './features/analysis/AnalysisPanel'
import { keepAnalysisFor } from './features/analysis/analysisSelection'
import { choroplethClasses, colorByDistrict } from './features/analysis/choropleth'
import { DistrictStatsPanel } from './features/analysis/DistrictStatsPanel'
import type { AnalysisResponse, DistrictStatsResponse } from './services/analysis'
import { AppLayout } from './components/AppLayout'
import { FeatureDetailsPanel } from './features/details/FeatureDetailsPanel'
import { useFeatureDetail, type SourceSelection } from './features/details/useFeatureDetail'
import { CreateFeatureForm } from './features/drawing/CreateFeatureForm'
import { DrawingToolbar } from './features/drawing/DrawingToolbar'
import { UserFeaturePanel } from './features/drawing/UserFeaturePanel'
import type { DrawMode, DrawRequest } from './features/drawing/useTerraDraw'
import { useUserFeatures } from './features/drawing/useUserFeatures'
import { SystemStatus } from './features/health/SystemStatus'
import { LayerPanel } from './features/layers/LayerPanel'
import { MapView, type FocusRequest, type Selection } from './features/map/MapView'
import { bboxOf } from './features/map/geometry'
import type { LayerKey } from './features/map/layerIds'
import { FACILITY_LABELS, type BasemapId } from './features/map/mapStyle'
import { useSourceLayers } from './features/map/useSourceLayers'
import { SearchPanel } from './features/search/SearchPanel'
import type { FacilityType, SourceFeatureDetail, SourceLayerId } from './services/sourceLayers'
import type { UserFeature, UserGeometry } from './services/userFeatures'

const NO_HIGHLIGHT: Record<SourceLayerId, number[]> = { districts: [], facilities: [] }

export default function App() {
  const { state, retry, refresh } = useSourceLayers()
  const user = useUserFeatures()
  const [basemap, setBasemap] = useState<BasemapId>('osm')
  const [wmsVisible, setWmsVisible] = useState(false)
  const [visibility, setVisibility] = useState<Record<LayerKey, boolean>>({ districts: true, facilities: true, 'user-features': true })
  const [selection, setSelection] = useState<Selection | null>(null)
  // Analiz isteği sürerken seçim değişirse geç gelen yanıt ilgisizse gösterilmez (olay işleyicisinde okunur).
  const selectionRef = useRef<Selection | null>(null)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])
  const [highlight, setHighlight] = useState(NO_HIGHLIGHT)
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [draw, setDraw] = useState<DrawRequest>({ kind: 'off', token: 0 })
  const [pendingGeometry, setPendingGeometry] = useState<UserGeometry | null>(null)
  const [editing, setEditing] = useState<{ id: string; draft: UserGeometry | null } | null>(null)
  const [finishSignal, setFinishSignal] = useState(0)
  // --- analiz durumu ---
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [analysisArea, setAnalysisArea] = useState<Polygon | null>(null)
  const [drawingAnalysisArea, setDrawingAnalysisArea] = useState(false)
  const [pickingPoint, setPickingPoint] = useState(false)
  const [pickedPoint, setPickedPoint] = useState<[number, number] | null>(null)
  const [districtStats, setDistrictStats] = useState<DistrictStatsResponse | null>(null)
  const choropleth = useMemo(
    () => (districtStats ? colorByDistrict(districtStats.districts, choroplethClasses(districtStats.districts)) : null),
    [districtStats],
  )
  // Çizimin amacı (kayıt mı analiz alanı mı) Terra Draw geri çağrısında okunur; olay işleyicilerinde güncellenir.
  const analysisDrawRef = useRef(false)
  const [facilityTypes, setFacilityTypes] = useState<Record<FacilityType, boolean>>(
    () => Object.fromEntries(Object.keys(FACILITY_LABELS).map((t) => [t, true])) as Record<FacilityType, boolean>,
  )
  const visibleFacilityTypes = useMemo(
    () => (Object.keys(facilityTypes) as FacilityType[]).filter((t) => facilityTypes[t]),
    [facilityTypes],
  )

  const sourceSelection = useMemo<SourceSelection | null>(
    () => (selection && selection.layer !== 'user-features' ? { layer: selection.layer, id: Number(selection.id) } : null),
    [selection],
  )
  const detail = useFeatureDetail(sourceSelection)

  const showLayer = useCallback((layer: LayerKey) => setVisibility((v) => (v[layer] ? v : { ...v, [layer]: true })), [])
  const nextDraw = useCallback((request: Omit<DrawRequest, 'token'> & Partial<DrawRequest>) => {
    setDraw((d) => ({ ...request, token: d.token + 1 }) as DrawRequest)
  }, [])

  const zoomTo = useCallback((geometries: Geometry[]) => {
    const bbox = bboxOf(geometries)
    if (bbox) setFocus((f) => ({ bbox, token: (f?.token ?? 0) + 1 }))
  }, [])

  // Haritadan veya aramadan yeni seçim: sonuçla ilgisiz bir obje seçilirse eski analiz sonucu temizlenir.
  const selectObject = useCallback((next: Selection | null) => {
    setSelection(next)
    setAnalysisResult((current) => (keepAnalysisFor(current, next) ? current : null))
  }, [])

  // --- arama ---
  const onSearchResults = useCallback((layer: SourceLayerId, features: Feature[]) => {
    setHighlight({ ...NO_HIGHLIGHT, [layer]: features.map((f) => Number(f.id)) })
  }, [])
  const onPick = useCallback(
    (layer: SourceLayerId, feature: Feature) => {
      showLayer(layer) // gizli katmandaki sonuç seçilirse katman açılır; aksi halde vurgu görünmezdi
      selectObject({ layer, id: Number(feature.id) })
      zoomTo([feature.geometry])
    },
    [showLayer, zoomTo, selectObject],
  )

  // --- kaynak kayıt düzenleme ---
  const onSourceSaved = useCallback(
    (feature: SourceFeatureDetail, etag: string) => {
      detail.replace(feature, etag)
      refresh() // harita ve arama aynı (yerel) adı göstersin
    },
    [detail, refresh],
  )

  // --- çizim ---
  const endDrawing = useCallback(() => {
    setPendingGeometry(null)
    setEditing(null)
    analysisDrawRef.current = false
    setDrawingAnalysisArea(false)
    nextDraw({ kind: 'off' })
  }, [nextDraw])

  const startDraw = useCallback(
    (mode: DrawMode) => {
      analysisDrawRef.current = false
      setDrawingAnalysisArea(false)
      setPickingPoint(false)
      setSelection(null)
      setPendingGeometry(null)
      setEditing(null)
      showLayer('user-features')
      nextDraw({ kind: 'draw', mode })
    },
    [nextDraw, showLayer],
  )


  const startAnalysisArea = useCallback(() => {
    setSelection(null)
    setPendingGeometry(null)
    setEditing(null)
    setPickingPoint(false)
    analysisDrawRef.current = true
    setDrawingAnalysisArea(true)
    nextDraw({ kind: 'draw', mode: 'polygon' })
  }, [nextDraw])

  const drawCallbacks = useMemo(
    () => ({
      // Analiz için çizilen alan kayıt formuna gitmez; analizin girdisi olur ve taslak temizlenir.
      onComplete: (geometry: UserGeometry) => {
        if (analysisDrawRef.current && geometry.type === 'Polygon') {
          analysisDrawRef.current = false
          setDrawingAnalysisArea(false)
          setAnalysisArea(geometry)
          setDraw((d) => ({ kind: 'off', token: d.token + 1 }))
        } else {
          setPendingGeometry(geometry)
        }
      },
      onDraftChange: (geometry: UserGeometry) => setEditing((e) => (e ? { ...e, draft: geometry } : e)),
    }),
    [],
  )

  const selectedSource = useMemo<SelectedSource | null>(() => {
    if (!selection) return null
    if (selection.layer === 'user-features') {
      const f = user.state.kind === 'loaded' ? user.state.collection.features.find((x) => String(x.id) === String(selection.id)) : undefined
      return f ? { ref: { layerId: 'user-features', id: String(f.id) }, label: f.properties.name, isArea: f.geometry.type === 'Polygon', measurable: f.geometry.type !== 'Point' }
        : null
    }
    if (state.kind !== 'loaded') return null
    const id = Number(selection.id)
    if (selection.layer === 'districts') {
      const f = state.districts.features.find((x) => Number(x.id) === id)
      return f ? { ref: { layerId: 'districts', id }, label: f.properties.name, isArea: true, measurable: true } : null
    }
    const f = state.facilities.features.find((x) => Number(x.id) === id)
    return f ? { ref: { layerId: 'facilities', id }, label: f.properties.name ?? 'Adsız tesis', isArea: false, measurable: false } : null
  }, [selection, state, user.state])

  const onCreated = useCallback(
    (feature: UserFeature) => {
      user.refresh()
      endDrawing()
      setSelection({ layer: 'user-features', id: feature.id })
    },
    [user, endDrawing],
  )

  const selectedUserId = selection?.layer === 'user-features' ? String(selection.id) : null
  const districtOptions = useMemo(
    () =>
      state.kind === 'loaded'
        ? state.districts.features
            .map((f) => ({ id: Number(f.id), name: f.properties.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
        : [],
    [state],
  )

  return (
    <AppLayout
      sidePanel={
        <>
          {pendingGeometry && <CreateFeatureForm geometry={pendingGeometry} onSaved={onCreated} onCancel={endDrawing} />}
          {selectedUserId && (
            <UserFeaturePanel
              key={selectedUserId}
              id={selectedUserId}
              draftGeometry={editing?.id === selectedUserId ? editing.draft : null}
              onStartGeometryEdit={(geometry) => {
                setEditing({ id: selectedUserId, draft: geometry })
                nextDraw({ kind: 'edit', geometry })
              }}
              onEndGeometryEdit={() => {
                setEditing(null)
                nextDraw({ kind: 'off' })
              }}
              onChanged={user.refresh}
              onDeleted={() => {
                user.refresh()
                endDrawing()
                setSelection(null)
              }}
              onClose={() => {
                endDrawing()
                setSelection(null)
              }}
              onZoom={(geometry) => zoomTo([geometry])}
            />
          )}
          {sourceSelection && (
            <FeatureDetailsPanel
              selection={sourceSelection}
              state={detail.state}
              onClose={() => setSelection(null)}
              onReload={detail.reload}
              onZoom={() => detail.state.kind === 'loaded' && zoomTo([detail.state.feature.geometry])}
              onSaved={onSourceSaved}
            />
          )}
          <AnalysisPanel
            selected={selectedSource}
            drawnArea={analysisArea}
            pickedPoint={pickedPoint}
            pickingPoint={pickingPoint}
            drawingArea={drawingAnalysisArea}
            result={analysisResult}
            onDrawArea={startAnalysisArea}
            onPickPoint={() => {
              endDrawing()
              setPickingPoint(true)
            }}
            onResult={(result) => setAnalysisResult(result && keepAnalysisFor(result, selectionRef.current) ? result : null)}
            onSelectMatch={(f) => {
              showLayer('facilities')
              setSelection({ layer: 'facilities', id: Number(f.id) })
              zoomTo([f.geometry])
            }}
            onShowAll={() => analysisResult && zoomTo([analysisResult.input.geometry, ...analysisResult.matches.features.map((f) => f.geometry)])}
          />
          <DistrictStatsPanel
            stats={districtStats}
            selectedDistrictId={selection?.layer === 'districts' ? Number(selection.id) : null}
            onStats={(stats) => {
              setDistrictStats(stats)
              if (stats) showLayer('districts')
            }}
            onSelectDistrict={(id) => {
              const feature = state.kind === 'loaded' ? state.districts.features.find((f) => Number(f.id) === id) : undefined
              selectObject({ layer: 'districts', id })
              if (feature) zoomTo([feature.geometry])
            }}
          />
          <DrawingToolbar
            draw={draw}
            disabled={pendingGeometry !== null || editing !== null || drawingAnalysisArea}
            onStart={startDraw}
            onFinish={() => setFinishSignal((n) => n + 1)}
            onCancel={endDrawing}
          />
          <SearchPanel
            districts={districtOptions}
            onResults={onSearchResults}
            onPick={onPick}
            onShowAll={(features) => zoomTo(features.map((f) => f.geometry))}
          />
          <LayerPanel
            state={state}
            userCount={user.state.kind === 'loaded' ? user.state.collection.meta.returned : null}
            userHasMore={user.state.kind === 'loaded' && user.state.collection.meta.hasMore}
            onRetry={retry}
            visibility={visibility}
            onToggle={(layer, visible) => setVisibility((v) => ({ ...v, [layer]: visible }))}
            basemap={basemap}
            onBasemapChange={setBasemap}
            facilityTypes={facilityTypes}
            onToggleFacilityType={(type, visible) => setFacilityTypes((t) => ({ ...t, [type]: visible }))}
            wmsVisible={wmsVisible}
            onToggleWms={setWmsVisible}
          />
          <SystemStatus />
        </>
      }
    >
      <MapView
        layers={state}
        userFeatures={user.state}
        basemap={basemap}
        visibility={visibility}
        selection={selection}
        highlight={highlight}
        focus={focus}
        draw={draw}
        drawCallbacks={drawCallbacks}
        finishSignal={finishSignal}
        facilityTypes={visibleFacilityTypes}
        editingId={editing?.id ?? null}
        analysis={analysisResult}
        choropleth={choropleth}
        wmsVisible={wmsVisible}
        pickingPoint={pickingPoint}
        onPickPoint={(point) => {
          setPickedPoint(point)
          setPickingPoint(false)
        }}
        onSelect={selectObject}
      />
    </AppLayout>
  )
}
