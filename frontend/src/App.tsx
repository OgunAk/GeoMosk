import type { Feature, Geometry } from 'geojson'
import { useCallback, useMemo, useState } from 'react'
import { AppLayout } from './components/AppLayout'
import { FeatureDetailsPanel } from './features/details/FeatureDetailsPanel'
import { useFeatureDetail } from './features/details/useFeatureDetail'
import { SystemStatus } from './features/health/SystemStatus'
import { LayerPanel } from './features/layers/LayerPanel'
import { MapView, type FocusRequest, type Selection } from './features/map/MapView'
import { bboxOf } from './features/map/geometry'
import type { BasemapId } from './features/map/mapStyle'
import { useSourceLayers } from './features/map/useSourceLayers'
import { SearchPanel } from './features/search/SearchPanel'
import type { SourceFeatureDetail, SourceLayerId } from './services/sourceLayers'

const NO_HIGHLIGHT: Record<SourceLayerId, number[]> = { districts: [], facilities: [] }

export default function App() {
  const { state, retry, refresh } = useSourceLayers()
  const [basemap, setBasemap] = useState<BasemapId>('osm')
  const [visibility, setVisibility] = useState<Record<SourceLayerId, boolean>>({ districts: true, facilities: true })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [highlight, setHighlight] = useState(NO_HIGHLIGHT)
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const detail = useFeatureDetail(selection)

  const zoomTo = useCallback((geometries: Geometry[]) => {
    const bbox = bboxOf(geometries)
    if (bbox) setFocus((f) => ({ bbox, token: (f?.token ?? 0) + 1 }))
  }, [])

  const onSearchResults = useCallback((layer: SourceLayerId, features: Feature[]) => {
    setHighlight({ ...NO_HIGHLIGHT, [layer]: features.map((f) => Number(f.id)) })
  }, [])

  const onPick = useCallback(
    (layer: SourceLayerId, feature: Feature) => {
      // Gizli katmandaki sonuç seçilirse katman açılır; aksi halde vurgu görünmezdi.
      setVisibility((v) => (v[layer] ? v : { ...v, [layer]: true }))
      setSelection({ layer, id: Number(feature.id) })
      zoomTo([feature.geometry])
    },
    [zoomTo],
  )

  const onSaved = useCallback(
    (feature: SourceFeatureDetail, etag: string) => {
      detail.replace(feature, etag)
      refresh() // harita ve arama aynı (yerel) adı göstersin
    },
    [detail, refresh],
  )

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
          {selection && (
            <FeatureDetailsPanel
              selection={selection}
              state={detail.state}
              onClose={() => setSelection(null)}
              onReload={detail.reload}
              onZoom={() => detail.state.kind === 'loaded' && zoomTo([detail.state.feature.geometry])}
              onSaved={onSaved}
            />
          )}
          <SearchPanel
            districts={districtOptions}
            onResults={onSearchResults}
            onPick={onPick}
            onShowAll={(features) => zoomTo(features.map((f) => f.geometry))}
          />
          <LayerPanel
            state={state}
            onRetry={retry}
            visibility={visibility}
            onToggle={(layer, visible) => setVisibility((v) => ({ ...v, [layer]: visible }))}
            basemap={basemap}
            onBasemapChange={setBasemap}
          />
          <SystemStatus />
        </>
      }
    >
      <MapView
        layers={state}
        basemap={basemap}
        visibility={visibility}
        selection={selection}
        highlight={highlight}
        focus={focus}
        onSelect={setSelection}
      />
    </AppLayout>
  )
}
