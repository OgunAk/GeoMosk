---
name: maplibre
description: GeoMosk MapLibre GL JS + Terra Draw iş akışı (source/layer kimlikleri → lifecycle → stil yenileme → seçme/vurgulama → çizim entegrasyonu → görünür doğrulama). frontend/src/features/map, layers, drawing veya analysis altında harita davranışını değiştirirken kullan.
---

# maplibre

## Girdi
İlgili REQUIREMENTS satırı (M01-M05, C02, A0x görselleştirme), `docs/API-CONTRACT.md`, mevcut `frontend/src/features/map/` (Faz 1'de oluşur).

## İş akışı
1. **Kimlikler:** Source/layer ID'lerini merkezi sabit dosyasına ekle (ör. `src/features/map/layerIds.ts`, planlanan, Faz 3). Rendering layer ID'si ≠ DB katman kimliği. Veri / seçim / çizim / analiz katmanları ayrı.
2. **Lifecycle:** Map instance `useRef` ile tekil; effect cleanup'ta `map.remove()` ve listener temizliği. StrictMode çift mount'ta duplicate yok.
3. **Stil yenileme:** Altlık değişince `style.load` sonrası source/layer/çizim kurulumunu idempotent tekrar çalıştır (`getSource` / `getLayer` kontrolü). Görünürlük, seçim, filtre ve analiz state'i React state'ten yeniden uygulanır. Atıflar görünür.
4. **Seçme/vurgulama:** Feature state veya filtreli vurgu katmanı; arama sonucu listeden seçince `fitBounds`/`flyTo`; bbox dışındaki obje için sunucudan tekil Feature getir.
5. **Bbox yükleme:** `moveend` + debounce; `AbortController` ile eski istek iptali; limit aşımında "eksik veri" göstergesi.
6. **Çizim (Terra Draw):** Point/LineString/Polygon modları; draft state kalıcı kayıttan ayrı; kaydet → API → dönen Feature kullanıcı katmanına; Terra Draw geçici objesi temizlenir (çift görünüm yok). Hata olursa draft korunur.
7. **Görünür doğrulama:** `playwright-cli` skill'i ile gerçek tarayıcıda: harita açılışı, katman aç/kapa, altlık değişimi sonrası katmanların korunması, çizim kaydı.

## Komutlar
- `npm --prefix frontend run typecheck` (planlanan, Faz 1)
- `npm --prefix frontend run test` (planlanan, Faz 1)
- `npm --prefix frontend run e2e` (planlanan, Faz 3)

## Hata yolları
- WebGL yok (headless): görsel başarı iddia etme; manuel/headed doğrulamayı eksik olarak kaydet.
- Tile servisi erişilemez: anlaşılır hata durumu, diğer altlığa geçiş mümkün.
- Terra Draw adaptör sürüm uyumsuzluğu: küçük deneyle doğrula, sürümü ADR'ye yaz.

## Tamamlanma ölçütü
Typecheck/test geçer, Playwright gözlemi kayıtlı, altlık değişimi regresyon testi geçer.
