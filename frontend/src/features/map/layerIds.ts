// Rendering kaynak/katman kimlikleri tek yerde. DB katman adlarıyla (districts/facilities) karıştırılmaz.
export const SOURCE_IDS = {
  basemap: 'basemap-osm',
  districts: 'src-districts',
  facilities: 'src-facilities',
} as const

export const LAYER_IDS = {
  basemap: 'lyr-basemap-osm',
  districtsFill: 'lyr-districts-fill',
  districtsLine: 'lyr-districts-line',
  districtsHighlight: 'lyr-districts-highlight',
  districtsSelected: 'lyr-districts-selected',
  facilities: 'lyr-facilities-circle',
  facilitiesHighlight: 'lyr-facilities-highlight',
  facilitiesSelected: 'lyr-facilities-selected',
} as const

/** Görünürlüğü katman anahtarıyla birlikte değişen rendering katmanları. */
export const OVERLAY_GROUPS = {
  districts: [LAYER_IDS.districtsFill, LAYER_IDS.districtsLine, LAYER_IDS.districtsHighlight, LAYER_IDS.districtsSelected],
  facilities: [LAYER_IDS.facilities, LAYER_IDS.facilitiesHighlight, LAYER_IDS.facilitiesSelected],
} as const

/** Tıklamayla seçilebilen katmanlar; öncelik sırası (noktalar poligonların üstünde). */
export const CLICKABLE_LAYERS = [LAYER_IDS.facilities, LAYER_IDS.districtsFill] as const

/** Bursa il merkezi civarı; [boylam, enlem]. */
export const BURSA_CENTER: [number, number] = [29.06, 40.19]
export const INITIAL_ZOOM = 8
