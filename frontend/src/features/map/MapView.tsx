import type { FeatureCollection } from 'geojson'
import { Map as MapLibreMap, NavigationControl, ScaleControl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './maplibreSetup'
import { useEffect, useRef, useState } from 'react'
import type { SourceLayersState } from './useSourceLayers'
import { BURSA_CENTER, INITIAL_ZOOM, LAYER_IDS, SOURCE_IDS } from './layerIds'
import { baseStyle, facilityColorExpression } from './mapStyle'

interface MapViewProps {
  layers: SourceLayersState
}

export function MapView({ layers }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [styleReady, setStyleReady] = useState(false)

  // Harita örneği tekil: StrictMode çift mount'unda cleanup önceki örneği kaldırır.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: baseStyle,
      center: BURSA_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: { compact: false },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    const onLoad = () => setStyleReady(true)
    map.on('load', onLoad)
    mapRef.current = map
    return () => {
      map.off('load', onLoad)
      map.remove()
      mapRef.current = null
      setStyleReady(false)
    }
  }, [])

  // Kaynak/katmanlar idempotent kurulur: kaynak varsa yalnızca veri güncellenir.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || layers.kind !== 'loaded') return
    upsertGeoJson(map, SOURCE_IDS.districts, layers.districts)
    upsertGeoJson(map, SOURCE_IDS.facilities, layers.facilities)

    if (!map.getLayer(LAYER_IDS.districtsFill)) {
      map.addLayer({
        id: LAYER_IDS.districtsFill,
        type: 'fill',
        source: SOURCE_IDS.districts,
        paint: { 'fill-color': '#2c3e50', 'fill-opacity': 0.08 },
      })
    }
    if (!map.getLayer(LAYER_IDS.districtsLine)) {
      map.addLayer({
        id: LAYER_IDS.districtsLine,
        type: 'line',
        source: SOURCE_IDS.districts,
        paint: { 'line-color': '#2c3e50', 'line-width': 1.5 },
      })
    }
    if (!map.getLayer(LAYER_IDS.facilities)) {
      map.addLayer({
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
    }
  }, [styleReady, layers])

  return (
    <div className="absolute inset-0">
      {/* maplibre-gl.css katmansız ".maplibregl-map { position: relative }" tanımlar ve Tailwind'in katmanlı
          "absolute" sınıfını ezer; bu yüzden kap konumla değil açık boyutla doldurulur. */}
      <div ref={containerRef} className="h-full w-full" data-testid="map" aria-label="Bursa haritası" role="region" />
      {layers.kind === 'loading' && (
        <p className="absolute top-3 left-3 rounded bg-white/90 px-3 py-1 text-sm shadow">Katmanlar yükleniyor…</p>
      )}
    </div>
  )
}

function upsertGeoJson(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(id)
  if (source) source.setData(data)
  else map.addSource(id, { type: 'geojson', data, promoteId: 'id' })
}
