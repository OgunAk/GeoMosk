import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { FacilityType } from '../../services/sourceLayers'
import { LAYER_IDS, SOURCE_IDS } from './layerIds'

// Faz 2 altlığı: OSM standart raster karoları. Kullanım politikası: hafif/demo kullanım ve görünür atıf.
// İkinci altlık ve altlık değiştirici Faz 3'te (M05).
export const baseStyle: StyleSpecification = {
  version: 8,
  sources: {
    [SOURCE_IDS.basemap]: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
    },
  },
  layers: [{ id: LAYER_IDS.basemap, type: 'raster', source: SOURCE_IDS.basemap }],
}

/** Tesis türü renkleri; lejant ve harita aynı tabloyu kullanır (renk tek bilgi taşıyıcısı değildir: lejantta ad var). */
export const FACILITY_COLORS: Record<FacilityType, string> = {
  hospital: '#c0392b',
  clinic: '#d35400',
  doctors: '#8e44ad',
  dentist: '#2980b9',
  pharmacy: '#16a085',
  other_healthcare: '#7f8c8d',
}

export const FACILITY_LABELS: Record<FacilityType, string> = {
  hospital: 'Hastane',
  clinic: 'Klinik / sağlık merkezi',
  doctors: 'Muayenehane',
  dentist: 'Diş hekimi',
  pharmacy: 'Eczane',
  other_healthcare: 'Diğer sağlık hizmeti',
}

export const facilityColorExpression: ExpressionSpecification = [
  'match',
  ['get', 'facilityType'],
  ...Object.entries(FACILITY_COLORS).flat(),
  '#7f8c8d',
] as unknown as ExpressionSpecification
