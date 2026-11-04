import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, type RefObject } from 'react'

const MIDDLE_BUTTON = 1

/**
 * Orta tuşa (tekerleğe) basılı tutup sürükleyerek haritayı kaydırma. MapLibre yalnız sol tuşla kaydırır.
 * Orta tuş olayları yakalama aşamasında durdurulur: Terra Draw onları tıklama sanıp köşe eklemesin,
 * MapLibre seçim yapmasın, tarayıcının otomatik kaydırma (autoscroll) imleci açılmasın.
 * Harita örneği oluşturulduktan sonra çağrılmalıdır (mapRef dolu olmalı).
 */
export function useMiddleMousePan(mapRef: RefObject<MapLibreMap | null>) {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const container = map.getCanvasContainer()
    // Sürükleme durumu efektin kendi nesnesinde (yeniden atanan değişken yerine).
    const drag: { last: { x: number; y: number } | null } = { last: null }

    const swallow = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const onMove = (e: PointerEvent) => {
      if (!drag.last) return
      map.panBy([drag.last.x - e.clientX, drag.last.y - e.clientY], { animate: false })
      drag.last = { x: e.clientX, y: e.clientY }
    }

    const end = () => {
      drag.last = null
      container.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp, true)
    }

    function onUp(e: PointerEvent) {
      if (e.button !== MIDDLE_BUTTON) return
      swallow(e)
      end()
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== MIDDLE_BUTTON) return
      swallow(e)
      map.stop() // süren yakınlaştırma/kaydırma animasyonunu kes
      drag.last = { x: e.clientX, y: e.clientY }
      container.style.cursor = 'grabbing'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, true)
    }

    // mousedown/auxclick: tarayıcı varsayılanlarını (autoscroll, orta tık açma) ve eski fare olaylarını engeller.
    const onMouse = (e: MouseEvent) => {
      if (e.button === MIDDLE_BUTTON) swallow(e)
    }

    container.addEventListener('pointerdown', onDown, true)
    container.addEventListener('mousedown', onMouse, true)
    container.addEventListener('mouseup', onMouse, true)
    container.addEventListener('auxclick', onMouse, true)
    return () => {
      end()
      container.removeEventListener('pointerdown', onDown, true)
      container.removeEventListener('mousedown', onMouse, true)
      container.removeEventListener('mouseup', onMouse, true)
      container.removeEventListener('auxclick', onMouse, true)
    }
  }, [mapRef])
}
