import type { Map as MapLibreMap } from 'maplibre-gl'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { UserGeometry } from '../../services/userFeatures'

export type DrawMode = 'point' | 'linestring' | 'polygon'

/** Harita çizim isteği. token her yeni istekte artar; aynı mod tekrar istenebilir. */
export type DrawRequest =
  | { kind: 'off'; token: number }
  | { kind: 'draw'; mode: DrawMode; token: number }
  | { kind: 'edit'; geometry: UserGeometry; token: number }

export interface DrawCallbacks {
  /** Yeni çizim tamamlandı (kayıt formu açılır; taslak haritada kalır). */
  onComplete: (geometry: UserGeometry) => void
  /** Düzenlenen taslağın geometrisi değişti. */
  onDraftChange: (geometry: UserGeometry) => void
}

const MODE_OF: Record<UserGeometry['type'], DrawMode> = { Point: 'point', LineString: 'linestring', Polygon: 'polygon' }

/**
 * Terra Draw yaşam döngüsü. Altlık değişince stil (ve Terra Draw katmanları) silinir: taslak önce saklanır,
 * çizim durdurulur, yeni stil yüklenince yeni bir örnekle geri yüklenir (taslak kaybolmaz).
 * Döndürülen fonksiyon setStyle'dan hemen önce çağrılmalı.
 */
export function useTerraDraw(
  mapRef: RefObject<MapLibreMap | null>,
  styleRevision: number,
  request: DrawRequest,
  callbacks: DrawCallbacks,
  /** Her artışta açık çizgi/alan çizimi bitirilir (0 = hiç istenmedi). */
  finishSignal: number,
): () => void {
  // Render'a katılmayan değiştirilebilir durum: etkin örnek, stil değişimi boyunca saklanan taslak, son istek/geri çağrılar.
  // Efektlerde yerel değişkene alınır; cleanup ref'e değil bu yerel nesneye dokunur.
  const storeRef = useRef<Store>({ instance: null, draft: null, request, callbacks })

  useEffect(() => {
    storeRef.current.callbacks = callbacks
    storeRef.current.request = request
  })

  // setStyle'dan hemen önce: taslağı sakla, örneği durdur (yeni stilde yeni örnek taslağı geri yükler).
  const suspend = useCallback(() => {
    const store = storeRef.current
    const instance = store.instance
    if (!instance || instance.stopped) return
    store.draft = snapshotOf(instance.draw)
    stop(instance)
  }, [])

  // Her stil yüklenişinde yeni Terra Draw örneği (adaptör kendi kaynak/katmanlarını yeni stile ekler).
  useEffect(() => {
    const store = storeRef.current
    const map = mapRef.current
    if (!map || styleRevision === 0) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: 'td' }),
      modes: [
        new TerraDrawPointMode(),
        new TerraDrawLineStringMode(),
        new TerraDrawPolygonMode(),
        new TerraDrawSelectMode({
          flags: {
            point: { feature: { draggable: true } },
            linestring: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
            polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
          },
        }),
      ],
    })
    draw.start()

    const geometryOf = (id: string | number) => draw.getSnapshotFeature(id)?.geometry as UserGeometry | undefined
    draw.on('finish', (id, context) => {
      const geometry = geometryOf(id)
      if (!geometry) return
      if (store.request.kind === 'draw' && context.action === 'draw') {
        draw.setMode('static') // form açıkken ikinci bir çizim başlamasın
        store.callbacks.onComplete(geometry)
      } else if (store.request.kind === 'edit') {
        store.callbacks.onDraftChange(geometry)
      }
    })

    // Stil değişiminden önce saklanan taslak geri yüklenir; yoksa güncel istek uygulanır.
    const saved = store.draft
    store.draft = null
    if (saved && saved.features.length > 0) {
      draw.addFeatures(saved.features)
      draw.setMode(saved.mode)
      if (saved.mode === 'select' && saved.features[0].id !== undefined) draw.selectFeature(saved.features[0].id)
    } else {
      applyRequest(draw, store.request)
    }

    const instance: Instance = { draw, stopped: false }
    store.instance = instance
    return () => {
      // suspend() çağrılmadıysa (ör. beklenmeyen stil yenilemesi) taslak burada saklanır.
      if (!instance.stopped) {
        store.draft = snapshotOf(draw)
        stop(instance)
      }
    }
  }, [mapRef, styleRevision])

  // "Çizimi bitir": Terra Draw çizgi/alan modları Enter ile bitirir ve tuşu harita tuvalinden dinler.
  // Düğme aynı olayı tuvale gönderir; klavye ve düğme tek yoldan geçer (yeterli köşe yoksa çizim sürer).
  useEffect(() => {
    if (finishSignal === 0) return
    const canvas = mapRef.current?.getCanvas()
    if (!canvas || storeRef.current.request.kind !== 'draw') return
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
  }, [finishSignal, mapRef])

  // İstek değişince (yeni çizim, düzenleme, kapatma) mevcut örneğe uygulanır.
  // token, aynı içerikli isteklerin de yeniden uygulanmasını sağlar.
  useEffect(() => {
    const instance = storeRef.current.instance
    if (instance && !instance.stopped) applyRequest(instance.draw, request)
  }, [request])

  return suspend
}

interface Store {
  instance: Instance | null
  draft: SavedDraft | null
  request: DrawRequest
  callbacks: DrawCallbacks
}

interface Instance {
  draw: TerraDraw
  stopped: boolean
}

interface SavedDraft {
  features: GeoJSONStoreFeatures[]
  mode: string
}

function snapshotOf(draw: TerraDraw): SavedDraft {
  return { features: draw.getSnapshot(), mode: draw.getMode() }
}

function stop(instance: Instance) {
  instance.stopped = true
  try {
    instance.draw.stop()
  } catch {
    // Stil zaten değiştiyse adaptör katmanları yoktur; durdurma hatası önemsizdir.
  }
}

function applyRequest(draw: TerraDraw, request: DrawRequest) {
  draw.clear()
  if (request.kind === 'off') {
    draw.setMode('static')
  } else if (request.kind === 'draw') {
    draw.setMode(request.mode)
  } else {
    const [result] = draw.addFeatures([
      { type: 'Feature', geometry: request.geometry, properties: { mode: MODE_OF[request.geometry.type] } },
    ])
    draw.setMode('select')
    if (result?.valid && result.id !== undefined) draw.selectFeature(result.id)
  }
}
