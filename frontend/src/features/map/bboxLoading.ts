import type { Bbox } from './geometry'

/**
 * Tesis katmanı görünen alana göre (bbox) yüklenir (PDF "bbox ile filtreleme"; ADR-0016).
 * İstenen kutu görünümden her yönde görünüm boyutunun yarısı kadar geniştir: küçük kaydırmalar yeni istek doğurmaz.
 */
export const BBOX_PADDING_RATIO = 0.5
/** Hareket bittikten sonra istek için bekleme (ms): sürükleme/zoom sırasında istek yağmuru olmaz. */
export const VIEW_DEBOUNCE_MS = 250

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
// API 5 ondalık basamağı (≈1 m) yeterince hassas kabul eder; daha uzun sayılar yalnız URL'i şişirir.
const round = (v: number) => Math.round(v * 1e5) / 1e5

export function expandBbox([minLon, minLat, maxLon, maxLat]: Bbox, ratio = BBOX_PADDING_RATIO): Bbox {
  const dx = (maxLon - minLon) * ratio
  const dy = (maxLat - minLat) * ratio
  return [
    round(clamp(minLon - dx, -180, 180)),
    round(clamp(minLat - dy, -90, 90)),
    round(clamp(maxLon + dx, -180, 180)),
    round(clamp(maxLat + dy, -90, 90)),
  ]
}

export function containsBbox(outer: Bbox, inner: Bbox): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3]
}

/**
 * Yeni görünüm için istenecek kutu; mevcut kutu yeterliyse null (istek yok).
 * - İlk görünüm veya görünüm mevcut kutunun dışına taştı → yeni kutu.
 * - Önceki yanıt sınıra takıldıysa (hasMore) kutu içindeki her hareket yeniden ister: yakınlaşınca eksik tesisler gelir.
 */
export function nextQueryBbox(view: Bbox, current: Bbox | null, truncated: boolean): Bbox | null {
  if (current && !truncated && containsBbox(current, view)) return null
  const next = expandBbox(view)
  return current && next.every((v, i) => v === current[i]) ? null : next
}

export function bboxParam(bbox: Bbox): string {
  return bbox.join(',')
}
