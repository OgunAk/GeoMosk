import type { FeatureCollection } from 'geojson'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type ErrorEvent,
  type FilterSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapSourceDataEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './maplibreSetup'
import { useEffect, useRef, useState } from 'react'
import type { FacilityType, SourceLayerId } from '../../services/sourceLayers'
import type { UserFeatureCollection } from '../../services/userFeatures'
import { useTerraDraw, type DrawCallbacks, type DrawRequest } from '../drawing/useTerraDraw'
import type { UserFeaturesState } from '../drawing/useUserFeatures'
import type { SourceLayersState } from './useSourceLayers'
import { useMiddleMousePan } from './useMiddleMousePan'
import type { Bbox } from './geometry'
import {
  BURSA_CENTER,
  CLICKABLE_LAYERS,
  INITIAL_ZOOM,
  LAYER_IDS,
  LAYER_ORDER,
  LAYER_OF_RENDERING,
  OVERLAY_GROUPS,
  SOURCE_IDS,
  type LayerKey,
} from './layerIds'
import { ANALYSIS_COLOR, BASEMAPS, HIGHLIGHT_COLOR, SELECTED_COLOR, USER_COLOR, facilityColorExpression, type BasemapId } from './mapStyle'
import type { AnalysisResponse } from '../../services/analysis'
import { WMS_LAYER, wmsTileUrl } from './wms'
import { VIEW_DEBOUNCE_MS } from './bboxLoading'

export interface Selection {
  layer: LayerKey
  /** Kaynak katmanlarda sayı, kullanıcı çizimlerinde UUID metni. */
  id: number | string
}

export interface FocusRequest {
  bbox: Bbox
  /** Aynı kutuya tekrar zoom istenebilsin diye her istekte artar. */
  token: number
}

interface MapViewProps {
  layers: SourceLayersState
  userFeatures: UserFeaturesState
  basemap: BasemapId
  visibility: Record<LayerKey, boolean>
  selection: Selection | null
  highlight: Record<SourceLayerId, number[]>
  focus: FocusRequest | null
  draw: DrawRequest
  drawCallbacks: DrawCallbacks
  /** Artınca açık çizgi/alan çizimi bitirilir ("Çizimi bitir" düğmesi). */
  finishSignal: number
  /** Haritada gösterilen tesis türleri (lejant filtresi). */
  facilityTypes: FacilityType[]
  /** Son analiz sonucu: girdi geometrisi + eşleşen tesisler. */
  analysis: AnalysisResponse | null
  /** true iken harita tıklaması seçim yerine nokta verir (en yakın N). */
  pickingPoint: boolean
  onPickPoint: (lngLat: [number, number]) => void
  /** Harici WMS raster katmanı (CORINE 2018) görünür mü. */
  wmsVisible: boolean
  /** A05 choropleth: ilçe id → sınıf rengi; null iken katman gizli. */
  choropleth: Record<number, string> | null
  /** Geometrisi düzenlenen kullanıcı çizimi: kayıtlı hali gizlenir, taslakla üst üste görünmez. */
  editingId: string | null
  onSelect: (selection: Selection | null) => void
  /** Harita hareketi bitince görünen kutu (debounce'lu); tesisler buna göre yüklenir. */
  onViewChange: (view: Bbox) => void
}

const HIT_TOLERANCE_PX = 5
/** Haritada tesise tek tıklayınca yaklaşılan zoom (arama sonucuna zoom'un maxZoom'uyla aynı). Daha yakındaysa uzaklaşılmaz. */
const FACILITY_CLICK_ZOOM = 16

declare global {
  interface Window {
    /** Uçtan uca testler ve tanılama için salt-okunur erişim (veri içermez, yalnızca harita örneği). */
    __geomoskMap?: MapLibreMap
  }
}

export function MapView(props: MapViewProps) {
  const { layers, userFeatures, basemap, visibility, selection, highlight, focus, draw, drawCallbacks, finishSignal, facilityTypes, editingId, onSelect } =
    props
  const { analysis, pickingPoint, onPickPoint, choropleth, wmsVisible } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const appliedBasemap = useRef<BasemapId>(basemap)
  const onSelectRef = useRef(onSelect)
  const drawingRef = useRef(false)
  // Her style.load'da artar: altlık değişince kaynak/katmanlar bu sayaçla yeniden kurulur.
  const [styleRevision, setStyleRevision] = useState(0)
  const [basemapError, setBasemapError] = useState(false)
  const [wmsError, setWmsError] = useState(false)

  const suspendDraw = useTerraDraw(mapRef, styleRevision, draw, drawCallbacks, finishSignal)

  const pickRef = useRef<((lngLat: [number, number]) => void) | null>(null)
  const onViewChangeRef = useRef(props.onViewChange)

  useEffect(() => {
    onSelectRef.current = onSelect
    onViewChangeRef.current = props.onViewChange
    drawingRef.current = draw.kind !== 'off'
    pickRef.current = pickingPoint ? onPickPoint : null
  })

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
      if (e.sourceId === SOURCE_IDS.wms) return setWmsError(true) // harici WMS: ayrı uyarı
      const ours = Object.values(SOURCE_IDS).filter((id) => id !== SOURCE_IDS.basemap) as string[]
      if (e.sourceId && !ours.includes(e.sourceId) && !e.sourceId.startsWith('td')) setBasemapError(true)
    }
    // WMS karosu başarıyla gelince önceki hata uyarısı kalkar (servis geçici olarak yanıt vermemiş olabilir).
    const onSourceData = (e: MapSourceDataEvent) => {
      if (e.sourceId === SOURCE_IDS.wms && e.tile) setWmsError(false)
    }
    const hitAt = (e: MapMouseEvent) => {
      const available = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      if (!available.length) return undefined
      // İnce çizgi ve küçük noktalar için ±5 px tolerans; aday çoksa CLICKABLE_LAYERS önceliği (kullanıcı > tesis > ilçe).
      const { x, y } = e.point
      const hits = map.queryRenderedFeatures([[x - HIT_TOLERANCE_PX, y - HIT_TOLERANCE_PX], [x + HIT_TOLERANCE_PX, y + HIT_TOLERANCE_PX]], {
        layers: [...available],
      })
      for (const layerId of available) {
        const hit = hits.find((h) => h.layer.id === layerId)
        if (hit) return hit
      }
      return undefined
    }
    const onClick = (e: MapMouseEvent) => {
      if (drawingRef.current) return // çizim/düzenleme sırasında tıklama seçim yapmaz
      if (pickRef.current) return pickRef.current([e.lngLat.lng, e.lngLat.lat]) // en yakın N için nokta seçimi
      const hit = hitAt(e)
      if (!hit) return onSelectRef.current(null)
      const layer = LAYER_OF_RENDERING[hit.layer.id]
      const id = layer === 'user-features' ? (hit.properties.featureId as string) : hit.id
      if (id === undefined) return
      onSelectRef.current({ layer, id: layer === 'user-features' ? String(id) : Number(id) })
      // Geliştirici demosu (2026-11-06): tesise tek tıklama yaklaştırır. İlçe tıklaması haritayı oynatmaz (analiz için seçim).
      if (layer === 'facilities' && hit.geometry.type === 'Point') {
        const [lng, lat] = hit.geometry.coordinates
        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), FACILITY_CLICK_ZOOM), duration: 600 })
      }
    }
    const onMove = (e: MapMouseEvent) => {
      if (drawingRef.current) return
      map.getCanvas().style.cursor = pickRef.current ? 'crosshair' : hitAt(e) ? 'pointer' : ''
    }

    // Görünen kutu: kamera oluşturulunca hemen (altlık karolarını beklemeden), sonra her hareketin bitiminden VIEW_DEBOUNCE_MS sonra.
    const viewTimer: { id?: ReturnType<typeof setTimeout> } = {}
    const emitView = () => {
      const b = map.getBounds()
      onViewChangeRef.current([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    }
    const onMoveEnd = () => {
      clearTimeout(viewTimer.id)
      viewTimer.id = setTimeout(emitView, VIEW_DEBOUNCE_MS)
    }
    viewTimer.id = setTimeout(emitView, 0)
    map.on('moveend', onMoveEnd)

    map.on('style.load', onStyleLoad)
    map.on('error', onError)
    map.on('sourcedata', onSourceData)
    map.on('click', onClick)
    map.on('mousemove', onMove)
    mapRef.current = map
    window.__geomoskMap = map
    return () => {
      clearTimeout(viewTimer.id)
      map.off('moveend', onMoveEnd)
      map.off('style.load', onStyleLoad)
      map.off('error', onError)
      map.off('sourcedata', onSourceData)
      map.off('click', onClick)
      map.off('mousemove', onMove)
      map.remove()
      mapRef.current = null
      if (window.__geomoskMap === map) delete window.__geomoskMap
    }
  }, [])

  // Harita oluşturma efektinden sonra: orta tuşla sürükleyerek kaydırma.
  useMiddleMousePan(mapRef)

  // Altlık değişimi: çizim taslağı saklanır, stil tamamen değişir (diff kapalı), katmanlar style.load sonrası yeniden kurulur.
  useEffect(() => {
    const map = mapRef.current
    if (!map || appliedBasemap.current === basemap) return
    appliedBasemap.current = basemap
    suspendDraw()
    map.setStyle(BASEMAPS[basemap].style, { diff: false })
  }, [basemap, suspendDraw])

  // Kaynak katman verisi ve katmanlar (idempotent): kaynak varsa yalnızca veri güncellenir.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0 || layers.kind !== 'loaded') return
    upsertGeoJson(map, SOURCE_IDS.districts, layers.districts)
    upsertGeoJson(map, SOURCE_IDS.facilities, layers.facilities)
    ensureSourceLayers(map)
    enforceLayerOrder(map)
  }, [styleRevision, layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0 || userFeatures.kind !== 'loaded') return
    upsertGeoJson(map, SOURCE_IDS.userFeatures, withFeatureIdProperty(userFeatures.collection))
    ensureUserLayers(map)
    enforceLayerOrder(map)
  }, [styleRevision, userFeatures])

  // Analiz sonucu: girdi (alan/tampon/nokta) + en yakın N için kuş uçuşu bağlantılar; eşleşen tesisler halkayla vurgulanır.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0) return
    upsertGeoJson(map, SOURCE_IDS.analysis, analysisCollection(analysis))
    ensureAnalysisLayers(map)
    enforceLayerOrder(map)
    const ids = analysis ? analysis.matches.features.map((f) => Number(f.id)) : []
    if (map.getLayer(LAYER_IDS.analysisMatches)) map.setFilter(LAYER_IDS.analysisMatches, idFilter(ids))
  }, [styleRevision, analysis, layers])

  // Harici WMS: kaynak ve katman her stilde yeniden kurulur; yalnız görünürken karo istenir.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0) return
    if (!map.getSource(SOURCE_IDS.wms)) {
      map.addSource(SOURCE_IDS.wms, { type: 'raster', tiles: [wmsTileUrl()], tileSize: 256, attribution: WMS_LAYER.attribution })
    }
    addOnce(map, {
      id: LAYER_IDS.wms,
      type: 'raster',
      source: SOURCE_IDS.wms,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': WMS_LAYER.opacity },
    })
    map.setLayoutProperty(LAYER_IDS.wms, 'visibility', wmsVisible ? 'visible' : 'none')
    enforceLayerOrder(map)
  }, [styleRevision, wmsVisible])

  // A05 choropleth: renkler ilçe id'sine göre match ifadesiyle; altlık değişiminde de yeniden uygulanır.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0 || !map.getLayer(LAYER_IDS.districtsChoropleth)) return
    const entries = Object.entries(choropleth ?? {})
    map.setFilter(LAYER_IDS.districtsChoropleth, idFilter(entries.map(([id]) => Number(id))))
    map.setPaintProperty(
      LAYER_IDS.districtsChoropleth,
      'fill-color',
      entries.length === 0
        ? 'rgba(0,0,0,0)'
        : (['match', ['id'], ...entries.flatMap(([id, color]) => [Number(id), color]), 'rgba(0,0,0,0)'] as unknown as string),
    )
  }, [styleRevision, layers, choropleth])

  // Görünürlük, vurgu, seçim ve düzenlenen kaydın gizlenmesi: her stil yenilemesinden sonra da yeniden uygulanır.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRevision === 0) return
    for (const layer of Object.keys(OVERLAY_GROUPS) as LayerKey[]) {
      for (const id of OVERLAY_GROUPS[layer]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility[layer] ? 'visible' : 'none')
      }
    }
    if (map.getLayer(LAYER_IDS.facilities)) {
      // Tür filtresi tesis noktalarına ve vurgu/seçim halkalarına birlikte uygulanır.
      const types = ['in', ['get', 'facilityType'], ['literal', facilityTypes]]
      const withTypes = (f: FilterSpecification) => ['all', f, types] as unknown as FilterSpecification
      map.setFilter(LAYER_IDS.facilities, types as unknown as FilterSpecification)
      map.setFilter(LAYER_IDS.districtsHighlight, idFilter(highlight.districts))
      map.setFilter(LAYER_IDS.facilitiesHighlight, withTypes(idFilter(highlight.facilities)))
      map.setFilter(LAYER_IDS.districtsSelected, idFilter(selection?.layer === 'districts' ? [selection.id as number] : []))
      map.setFilter(LAYER_IDS.facilitiesSelected, withTypes(idFilter(selection?.layer === 'facilities' ? [selection.id as number] : [])))
    }
    if (map.getLayer(LAYER_IDS.userPoint)) {
      const selectedUser = selection?.layer === 'user-features' && selection.id !== editingId ? String(selection.id) : ''
      map.setFilter(LAYER_IDS.userFill, userFilter('Polygon', editingId))
      map.setFilter(LAYER_IDS.userLine, userFilter(null, editingId))
      map.setFilter(LAYER_IDS.userPoint, userFilter('Point', editingId))
      map.setFilter(LAYER_IDS.userSelectedLine, selectedUserFilter(selectedUser, false))
      map.setFilter(LAYER_IDS.userSelectedPoint, selectedUserFilter(selectedUser, true))
    }
  }, [styleRevision, layers, userFeatures, visibility, highlight, selection, editingId, facilityTypes])

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
      {wmsVisible && wmsError && (
        <p role="alert" className="absolute top-12 left-1/2 -translate-x-1/2 rounded bg-amber-50 px-3 py-1 text-sm text-amber-900 shadow">
          WMS servisi (CORINE) yanıt vermiyor; diğer katmanlar çalışıyor.
        </p>
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

/** Geometri tipine göre (null: çizgi + alan kenarı) ve düzenlenen kaydı hariç tutan filtre. */
function userFilter(type: 'Point' | 'Polygon' | null, editingId: string | null): FilterSpecification {
  const typeCondition = type ? ['==', ['geometry-type'], type] : ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]]
  return ['all', typeCondition, ['!=', ['get', 'featureId'], editingId ?? '']] as unknown as FilterSpecification
}

function selectedUserFilter(id: string, point: boolean): FilterSpecification {
  const typeCondition = point ? ['==', ['geometry-type'], 'Point'] : ['!=', ['geometry-type'], 'Point']
  return ['all', typeCondition, ['==', ['get', 'featureId'], id]] as unknown as FilterSpecification
}

/** MapLibre GeoJSON kaynağı metin id'leri feature id olarak kullanamaz; UUID bir özelliğe kopyalanır. */
function withFeatureIdProperty(collection: UserFeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((f) => ({ ...f, properties: { ...f.properties, featureId: f.id } })),
  }
}

function upsertGeoJson(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(id)
  if (source) source.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

type LayerSpec = Parameters<MapLibreMap['addLayer']>[0]

function addOnce(map: MapLibreMap, spec: LayerSpec, beforeId?: string) {
  if (!map.getLayer(spec.id)) map.addLayer(spec, beforeId && map.getLayer(beforeId) ? beforeId : undefined)
}

function ensureSourceLayers(map: MapLibreMap) {
  // Kullanıcı katmanı önceden eklendiyse kaynak katmanları onun altına yerleşir.
  const below = map.getLayer(LAYER_IDS.userFill) ? LAYER_IDS.userFill : undefined
  const add = (spec: LayerSpec) => addOnce(map, spec, below)
  add({ id: LAYER_IDS.districtsFill, type: 'fill', source: SOURCE_IDS.districts, paint: { 'fill-color': '#2c3e50', 'fill-opacity': 0.06 } })
  add({
    id: LAYER_IDS.districtsChoropleth,
    type: 'fill',
    source: SOURCE_IDS.districts,
    filter: idFilter([]),
    paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.65 },
  })
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

function analysisCollection(analysis: AnalysisResponse | null): FeatureCollection {
  if (!analysis) return { type: 'FeatureCollection', features: [] }
  const features: FeatureCollection['features'] = [analysis.input]
  if (analysis.analysis === 'nearest' && analysis.input.geometry.type === 'Point') {
    const from = analysis.input.geometry.coordinates
    // Bağlantı çizgisi kuş uçuşu ilişkiyi gösterir; rota değildir.
    for (const m of analysis.matches.features) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [from, m.geometry.coordinates] }, properties: { role: 'connector' } })
    }
  }
  return { type: 'FeatureCollection', features }
}

function ensureAnalysisLayers(map: MapLibreMap) {
  // Kullanıcı katmanının altında, kaynak katmanların üstünde; tesis kaynağı yüklenmeden eşleşme katmanı eklenmez.
  const below = map.getLayer(LAYER_IDS.userFill) ? LAYER_IDS.userFill : undefined
  const add = (spec: LayerSpec) => addOnce(map, spec, below)
  add({
    id: LAYER_IDS.analysisFill,
    type: 'fill',
    source: SOURCE_IDS.analysis,
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: { 'fill-color': ANALYSIS_COLOR, 'fill-opacity': 0.15 },
  })
  add({
    id: LAYER_IDS.analysisLine,
    type: 'line',
    source: SOURCE_IDS.analysis,
    filter: ['!=', ['geometry-type'], 'Point'],
    paint: { 'line-color': ANALYSIS_COLOR, 'line-width': 2, 'line-dasharray': [3, 2] },
  })
  add({
    id: LAYER_IDS.analysisPoint,
    type: 'circle',
    source: SOURCE_IDS.analysis,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 7, 'circle-color': ANALYSIS_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  })
  if (map.getSource(SOURCE_IDS.facilities)) {
    addOnce(map, {
      id: LAYER_IDS.analysisMatches,
      type: 'circle',
      source: SOURCE_IDS.facilities,
      filter: idFilter([]),
      paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ANALYSIS_COLOR, 'circle-stroke-width': 3 },
    })
  }
}

/** LAYER_ORDER'ı uygular; mevcut katmanlar sırayla ilk Terra Draw katmanının (yoksa en üstün) hemen altına taşınır. */
function enforceLayerOrder(map: MapLibreMap) {
  const firstDrawLayer = map.getStyle().layers.find((l) => l.id.startsWith('td'))?.id
  for (const id of LAYER_ORDER) {
    if (map.getLayer(id)) map.moveLayer(id, firstDrawLayer)
  }
}

function ensureUserLayers(map: MapLibreMap) {
  // Terra Draw katmanları (td-*) varsa kullanıcı katmanı onların altında kalır: taslak her zaman üstte.
  const tdLayer = map.getStyle().layers.find((l) => l.id.startsWith('td'))?.id
  const add = (spec: LayerSpec) => addOnce(map, spec, tdLayer)
  add({ id: LAYER_IDS.userFill, type: 'fill', source: SOURCE_IDS.userFeatures, paint: { 'fill-color': USER_COLOR, 'fill-opacity': 0.25 } })
  add({ id: LAYER_IDS.userLine, type: 'line', source: SOURCE_IDS.userFeatures, paint: { 'line-color': USER_COLOR, 'line-width': 3 } })
  add({
    id: LAYER_IDS.userPoint,
    type: 'circle',
    source: SOURCE_IDS.userFeatures,
    paint: { 'circle-radius': 7, 'circle-color': USER_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  })
  add({
    id: LAYER_IDS.userSelectedLine,
    type: 'line',
    source: SOURCE_IDS.userFeatures,
    filter: selectedUserFilter('', false),
    paint: { 'line-color': SELECTED_COLOR, 'line-width': 5, 'line-dasharray': [2, 1] },
  })
  add({
    id: LAYER_IDS.userSelectedPoint,
    type: 'circle',
    source: SOURCE_IDS.userFeatures,
    filter: selectedUserFilter('', true),
    paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': SELECTED_COLOR, 'circle-stroke-width': 3 },
  })
}
