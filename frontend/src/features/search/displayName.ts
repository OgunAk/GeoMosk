import type { DistrictProperties, FacilityProperties } from '../../services/sourceLayers'

/** Görünen ad; OSM'de adı olmayan kayıtlar (12 tesis) için açık bir etiket. */
export function displayName(p: DistrictProperties | FacilityProperties): string {
  return p.name ?? (p.layer === 'facilities' ? 'Adsız tesis' : 'Adsız ilçe')
}
