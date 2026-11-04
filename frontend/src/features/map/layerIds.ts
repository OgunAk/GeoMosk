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
  facilities: 'lyr-facilities-circle',
} as const

/** Bursa il merkezi civarı; [boylam, enlem]. */
export const BURSA_CENTER: [number, number] = [29.06, 40.19]
export const INITIAL_ZOOM = 8
