// Rendering kaynak/katman kimlikleri tek yerde. DB katman adlarıyla (districts/facilities) karıştırılmaz.
export const SOURCE_IDS = {
  basemap: 'basemap-osm',
  districts: 'src-districts',
  facilities: 'src-facilities',
  userFeatures: 'src-user-features',
  analysis: 'src-analysis',
} as const

export const LAYER_IDS = {
  basemap: 'lyr-basemap-osm',
  districtsFill: 'lyr-districts-fill',
  districtsChoropleth: 'lyr-districts-choropleth',
  districtsLine: 'lyr-districts-line',
  districtsHighlight: 'lyr-districts-highlight',
  districtsSelected: 'lyr-districts-selected',
  facilities: 'lyr-facilities-circle',
  facilitiesHighlight: 'lyr-facilities-highlight',
  facilitiesSelected: 'lyr-facilities-selected',
  userFill: 'lyr-user-fill',
  userLine: 'lyr-user-line',
  userPoint: 'lyr-user-point',
  userSelectedLine: 'lyr-user-selected-line',
  userSelectedPoint: 'lyr-user-selected-point',
  analysisFill: 'lyr-analysis-fill',
  analysisLine: 'lyr-analysis-line',
  analysisPoint: 'lyr-analysis-point',
  analysisMatches: 'lyr-analysis-matches',
} as const

/** Uygulama katman anahtarları (panel/seçim). */
export type LayerKey = 'districts' | 'facilities' | 'user-features'

/** Görünürlüğü katman anahtarıyla birlikte değişen rendering katmanları. */
export const OVERLAY_GROUPS: Record<LayerKey, readonly string[]> = {
  districts: [LAYER_IDS.districtsFill, LAYER_IDS.districtsChoropleth, LAYER_IDS.districtsLine, LAYER_IDS.districtsHighlight, LAYER_IDS.districtsSelected],
  facilities: [LAYER_IDS.facilities, LAYER_IDS.facilitiesHighlight, LAYER_IDS.facilitiesSelected],
  'user-features': [LAYER_IDS.userFill, LAYER_IDS.userLine, LAYER_IDS.userPoint, LAYER_IDS.userSelectedLine, LAYER_IDS.userSelectedPoint],
}

/** Tıklamayla seçilebilen katmanlar; öncelik sırası (kullanıcı çizimi > tesis > ilçe). */
export const CLICKABLE_LAYERS = [
  LAYER_IDS.userPoint,
  LAYER_IDS.userLine,
  LAYER_IDS.userFill,
  LAYER_IDS.facilities,
  LAYER_IDS.districtsFill,
] as const

export const LAYER_OF_RENDERING: Record<string, LayerKey> = {
  [LAYER_IDS.userPoint]: 'user-features',
  [LAYER_IDS.userLine]: 'user-features',
  [LAYER_IDS.userFill]: 'user-features',
  [LAYER_IDS.facilities]: 'facilities',
  [LAYER_IDS.districtsFill]: 'districts',
}

/** Bursa il merkezi civarı; [boylam, enlem]. */
export const BURSA_CENTER: [number, number] = [29.06, 40.19]
export const INITIAL_ZOOM = 8
