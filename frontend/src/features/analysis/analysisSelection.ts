import type { AnalysisResponse } from '../../services/analysis'
import type { Selection } from '../map/MapView'

/**
 * Yeni seçimden sonra analiz sonucu ekranda kalmalı mı?
 * Kalır: seçim analizin kaynağıysa (ör. analiz edilen ilçe) ya da sonuç listesindeki bir tesisse.
 * Aksi halde (başka ilçe/tesis/çizim seçildi) eski sonuç yanıltıcı olur ve temizlenir.
 * Seçimin kaldırılması (boş alana tıklama) sonucu silmez.
 */
export function keepAnalysisFor(result: AnalysisResponse | null, selection: Selection | null): boolean {
  if (!result || !selection) return true
  const { sourceLayer, sourceId } = result.input.properties as { sourceLayer?: string | null; sourceId?: string | null }
  if (sourceLayer === selection.layer && sourceId != null && String(sourceId) === String(selection.id)) return true
  return selection.layer === 'facilities' && result.matches.features.some((f) => Number(f.id) === Number(selection.id))
}
