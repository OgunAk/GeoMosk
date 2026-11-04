import type { Geometry, Position } from 'geojson'

export type Bbox = [minLon: number, minLat: number, maxLon: number, maxLat: number]

function* positions(geometry: Geometry): Generator<Position> {
  switch (geometry.type) {
    case 'Point':
      yield geometry.coordinates
      break
    case 'MultiPoint':
    case 'LineString':
      yield* geometry.coordinates
      break
    case 'MultiLineString':
    case 'Polygon':
      for (const part of geometry.coordinates) yield* part
      break
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) for (const ring of polygon) yield* ring
      break
    case 'GeometryCollection':
      for (const g of geometry.geometries) yield* positions(g)
      break
  }
}

/** Geometrilerin [boylam, enlem] sınırlayıcı kutusu; boşsa null. Yalnızca görüntüleme (zoom) içindir. */
export function bboxOf(geometries: Geometry[]): Bbox | null {
  let box: Bbox | null = null
  for (const g of geometries) {
    for (const [lon, lat] of positions(g)) {
      box = box
        ? [Math.min(box[0], lon), Math.min(box[1], lat), Math.max(box[2], lon), Math.max(box[3], lat)]
        : [lon, lat, lon, lat]
    }
  }
  return box
}
