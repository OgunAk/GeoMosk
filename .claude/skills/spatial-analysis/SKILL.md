---
name: spatial-analysis
description: GeoMosk PostGIS analiz iş akışı (girdi tipi/CRS → birim ve sınır semantiği → parametreli SQL → indeks → doğruluk/performans testi → harita çıktısı). Alan içinde (A01), buffer (A02), en yakın N (A03), metrik ölçüm (A04) veya ilçe başına sayım (A05) analizini yazarken ya da değiştirirken kullan.
---

# spatial-analysis

## Girdi
Analiz ID'si (A01-A05), API sözleşmesindeki request şekli (`sourceFeature {layerId,id}` **veya** `geometry`, tam olarak biri).

## İş akışı
1. **Girdi tipi/CRS:** Kaynak referansı verilmişse geometriyi sunucudan oku; istemci kopyasına güvenme. Doğrudan geometri 4326, tip allowlist'i, validity ve vertex limiti ile doğrulanır.
2. **Birim ve sınır semantiği:**
   - A01: varsayılan sınır dahil `ST_Covers(area, f.geom)`; hariç mod `ST_Within`. MultiPolygon ve delik test edilir.
   - A02: seçim `ST_DWithin(f.geom::geography, src::geography, @radius)` (metre). Görsel buffer `ST_Buffer(src::geography, @radius)::geometry` yaklaşık poligondur; seçimde kullanılmaz. Kaynak ID ile hariç tutulur.
   - A03: `ORDER BY ST_Distance(f.geom::geography, @p::geography), f.id LIMIT @n`. 4326 `<->` metrik sıralama değildir.
   - A04: `ST_Transform(geom, <metrik SRID>)` sonrası `ST_Length` / `ST_Area` / `ST_Perimeter`; aday EPSG:32635, gerçek extent ile doğrulanır. Geography sonucu yalnızca çapraz kontrol.
   - A05: tekil atama (önce iç eşleşme, sonra deterministik ilçe ID), `LEFT JOIN ... COUNT(f.id)`; atanamayanlar ayrı.
3. **SQL:** Parametreli; string interpolation yok. Sonuçta ham metre/m² + birim + `calculationSrid`/yöntem.
4. **İndeks:** `geom` GiST + `(geom::geography)` expression GiST. `EXPLAIN (ANALYZE, BUFFERS)` çıktısını `scripts/sql/` altına kaydet; küçük tabloda seq scan otomatik hata değildir.
5. **Doğruluk testi:** Bağımsız referans (bilinen iki nokta arası jeodezik mesafe, elle hesaplanmış UTM alanı). Tolerans testten önce yöntemle gerekçelendirilir. Eşik içi/dışı/tam sınır, boş sonuç, eşit mesafe, N > kayıt sayısı.
6. **Harita çıktısı:** Sonuç FeatureCollection; frontend geçici analiz katmanında gösterir, metrik değerleri backend'den alır.

## Komutlar
- `node scripts/validate-project.mjs --phase 5`
- `dotnet test backend/GeoMosk.Tests --filter Category=Spatial` (planlanan, Faz 5)

## Hata yolları
Projeksiyon kullanım alanı dışı → 422 ve açıklama. Point için ölçüm → "desteklenmeyen ölçüm" (0 dönme). Kaynak geometri yanlış tip → 422.

## Tamamlanma ölçütü
API + UI + gerçek PostGIS doğruluk testleri geçer; REQUIREMENTS satırı kanıt dosyasıyla güncellenir.
