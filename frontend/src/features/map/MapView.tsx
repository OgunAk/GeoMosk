import type { FeatureCollection } from 'geojson'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type ErrorEvent,
  type FilterSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './maplibreSetup'
import { useEffect, useRef, useState } from 'react'
import type { SourceLayerId } from '../../services/sourceLayers'
import type { SourceLayersState } from './useSourceLayers'
import type { Bbox } from './geometry'
import { BURSA_CENTER, CLICKABLE_LAYERS, INITIAL_ZOOM, LAYER_IDS, OVERLAY_GROUPS, SOURCE_IDS } from './layerIds'
import { BASEMAPS, HIGHLIGHT_COLOR, SELECTED_COLOR, facilityColorExpression, type BasemapId } from './mapStyle'

export interface Selection {
  layer: SourceLayerId
  id: number
}

export interface FocusRequest {
  bbox: Bbox
  /** Aynı kutuya tekrar zoom istenebilsin diye her istekte artar. */
  token: number
}

interface MapViewProps {
  layers: SourceLayersState
  basemap: BasemapId
  visibility: Record<SourceLayerId, boolean>
  selection: Selection | null
  highlight: Record<SourceLayerId, number[]>
  focus: FocusRequest | null
  onSelect: (selection: Selection | null) => void
}

declare global {
  interface Window {
    /** Uçtan uca testler ve tanılama için salt-okunur erişim (veri içermez, yalnızca harita örneği). */
    __geoscopeMap?: MapLibreMap
  }
}

export function MapView({ layers, basemap, visibility, selection, highlight, focus, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const appliedBasemap = useRef<BasemapId>(basemap)
  const onSelectRef = useRef(onSelect)
  // Her style.load'da artar: altlık değişince kaynak/katmanlar bu sayaçla yeniden kurulur.
  const [styleRevision, setStyleRevision] = useState(0)
  const [basemapError, setBasemapError] = useState(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Harita örneği tekil: StrictMode çift mount'unda cleanup önceki örneği kaldırır.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAPS[appliedBasemap.current].style,
      center: BURSA_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: { compact: false },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')

    const onStyleLoad = () => {
      setBasemapError(false)
      setStyleRevision((n) => n + 1)
    }
    const onError = (e: ErrorEvent & { sourceId?: string }) => {
      // Yalnızca altlık hataları kullanıcıya gösterilir; veri katmanları API'den gelir.
      if (e.sourceId && e.sourceId !== SOURCE_IDS.districts && e.sourceId !== SOURCE_IDS.facilities) setBasemapError(true)
    }
    const onClick = (e: MapMouseEvent) => {
      const available = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      const hit = available.length ? map.queryRenderedFeatures(e.point, { layers: [...available] })[0] : undefined
      if (!hit || hit.id === undefined) return onSelectRef.current(null)
      const layer: SourceLayerId = hit.layer.id === LAYER_IDS.facilities ? 'facilities' : 'districts'
      onSelectRef.current({ layer, id: Number(hit.id) })
    }
    const onMove = (e: MapMouseEvent) => {
      const available = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      const over = available.length > 0 && map.queryRenderedFeatures(e.point, { layers: [...available] }).length > 0
      map.getCanvas().style.cursor = over ? 'pointer' : ''
    }

    map.on('style.load', onStyleLoad)
    map.on('error', onError)
    map.on('click', onClick)
    map.on('mousemove', onMove)
    mapRef.current = map
    window.__geoscopeMap = map
    return () => {
      map.off('style.load', onStyleLoad)
      map.off('error', onError)
      map.off('click', onClick)
      map.off('mousemove', onMove)
      map.remove()
      mapRef.current = null
      if (window.__geoscopeMap === map) delete window.__geoscopeMap
    }
  }, [])

  // Altlık değişimi: stil tamamen değişir; diff kapalı, katmanlar style.load sonrası yeniden kurulur.
  useEffect(() => {
    const map = mapRef.current
    if (!map || appliedBasemap.current === basemap) return
    appliedBasemap.current = basemap
    map.setStyle(BASEMAPS[basemap].style, { diff: false })
  }, [basemap])

  // Veri kaynakları ve katmanlar (idempotent): kaynak varsa yalnızca veri güncellenir.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0 || layers.kind !== 'loaded') return
    upsertGeoJson(map, SOURCE_IDS.districts, layers.districts)
    upsertGeoJson(map, SOURCE_IDS.facilities, layers.facilities)
    ensureOverlayLayers(map)
  }, [styleRevision, layers])

  // Görünürlük, vurgu ve seçim: her stil yenilemesinden sonra da yeniden uygulanır.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0 || layers.kind !== 'loaded' || !map.getLayer(LAYER_IDS.facilities)) return
    for (const layer of ['districts', 'facilities'] as const) {
      for (const id of OVERLAY_GROUPS[layer]) map.setLayoutProperty(id, 'visibility', visibility[layer] ? 'visible' : 'none')
    }
    map.setFilter(LAYER_IDS.districtsHighlight, idFilter(highlight.districts))
    map.setFilter(LAYER_IDS.facilitiesHighlight, idFilter(highlight.facilities))
    map.setFilter(LAYER_IDS.districtsSelected, idFilter(selection?.layer === 'districts' ? [selection.id] : []))
    map.setFilter(LAYER_IDS.facilitiesSelected, idFilter(selection?.layer === 'facilities' ? [selection.id] : []))
  }, [styleRevision, layers, visibility, highlight, selection])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const [minLon, minLat, maxLon, maxLat] = focus.bbox
    map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, maxZoom: 16, duration: 600 })
  }, [focus])

  return (
    <div className="absolute inset-0">
      {/* maplibre-gl.css katmansız ".maplibregl-map { position: relative }" tanımlar ve Tailwind'in katmanlı
          "absolute" sınıfını ezer; bu yüzden kap konumla değil açık boyutla doldurulur. */}
      <div ref={containerRef} className="h-full w-full" data-testid="map" aria-label="Bursa haritası" role="region" />
      {layers.kind === 'loading' && (
        <p className="absolute top-3 left-3 rounded bg-white/90 px-3 py-1 text-sm shadow">Katmanlar yükleniyor…</p>
      )}
      {basemapError && (
        <p role="alert" className="absolute top-3 left-1/2 -translate-x-1/2 rounded bg-amber-50 px-3 py-1 text-sm text-amber-900 shadow">
          Altlık karoları yüklenemedi. Veri katmanları çalışıyor; diğer altlığı deneyebilirsiniz.
        </p>
      )}
    </div>
  )
}

function idFilter(ids: number[]): FilterSpecification {
  return ['in', ['id'], ['literal', ids]] as unknown as FilterSpecification
}

function upsertGeoJson(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(id)
  if (source) source.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

function ensureOverlayLayers(map: MapLibreMap) {
  const add = (spec: Parameters<MapLibreMap['addLayer']>[0]) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec)
  }
  add({ id: LAYER_IDS.districtsFill, type: 'fill', source: SOURCE_IDS.districts, paint: { 'fill-color': '#2c3e50', 'fill-opacity': 0.06 } })
  add({ id: LAYER_IDS.districtsLine, type: 'line', source: SOURCE_IDS.districts, paint: { 'line-color': '#2c3e50', 'line-width': 1.5 } })
  add({
    id: LAYER_IDS.districtsHighlight,
    type: 'line',
    source: SOURCE_IDS.districts,
    filter: idFilter([]),
    paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 4 },
  })
  add({
    id: LAYER_IDS.districtsSelected,
    type: 'line',
    source: SOURCE_IDS.districts,
    filter: idFilter([]),
    paint: { 'line-color': SELECTED_COLOR, 'line-width': 3, 'line-dasharray': [2, 1] },
  })
  add({
    id: LAYER_IDS.facilitiesHighlight,
    type: 'circle',
    source: SOURCE_IDS.facilities,
    filter: idFilter([]),
    paint: { 'circle-radius': 10, 'circle-color': HIGHLIGHT_COLOR, 'circle-opacity': 0.7 },
  })
  add({
    id: LAYER_IDS.facilities,
    type: 'circle',
    source: SOURCE_IDS.facilities,
    paint: {
      'circle-color': facilityColorExpression,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 14, 6],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 0.8,
    },
  })
  add({
    id: LAYER_IDS.facilitiesSelected,
    type: 'circle',
    source: SOURCE_IDS.facilities,
    filter: idFilter([]),
    paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': SELECTED_COLOR, 'circle-stroke-width': 3 },
  })
}
