---
name: geojson-validation
description: GeoMosk GeoJSON doğrulama iş akışı (yapı → koordinat/tip/sınır/topoloji → API round-trip → çıktı doğrulaması). Kullanıcı çizimi kabul eden endpoint, import edilen kaynak verisi veya GeoJSON yanıt şekli değiştiğinde kullan. RFC 7946 ve [boylam, enlem] sırasını korur.
---

# geojson-validation

## Girdi
GeoJSON Geometry/Feature/FeatureCollection (istek gövdesi, import dosyası örneği veya API yanıtı).

## İş akışı
1. **Yapı:** RFC 7946 tipleri; `crs` üyesi yok; Feature `properties` nesne veya `null`. Kullanıcı girdisinde kabul edilen tipler yalnızca Point, LineString, Polygon; GeometryCollection/Multi* sessizce dönüştürülmez → 422.
2. **Koordinat:** 2D, sonlu sayı; boylam [-180,180], enlem [-90,90]. LineString ≥2, Polygon halkası ≥4 nokta ve kapalı. Toplam ≤10.000 vertex.
3. **Bursa çalışma alanı kontrolü:** Bilinen kontrol noktası (ör. Bursa merkez ≈ boylam 29.06, enlem 40.19) ile ters koordinat tespiti; otomatik düzeltme yapılmaz, uyarı/422.
4. **Topoloji:** Sunucuda `ST_IsValid` / `ST_IsValidReason`; self-intersection reddedilir. Import'ta `ST_MakeValid` uygulanırsa tip/parça değişimi raporlanır.
5. **Round-trip:** POST → GET aynı koordinatları (hassasiyet politikası dahilinde) döndürür; PATCH geometri ve öznitelik atomik.
6. **Çıktı:** Harita yanıtları 4326, `[boylam, enlem]`; sayfalama metadata'sı belgeli foreign member/header ile.

## Komutlar
- `node scripts/hooks/validate-changed-files.mjs --file <yol>` (yalnız JSON sözdizimi/UTF-8; GeoJSON semantiği değil)
- Ham dosyada yalnız örnek inceleme: `jq '.features[0]' <dosya>` veya `head -n 25` — büyük dosya bütünüyle okunmaz.
- `dotnet test backend/GeoMosk.Tests --filter Category=GeoJson` (planlanan, Faz 4)

## Hata yolları
Bozuk JSON → 400; geçerli JSON ama geçersiz geometri → 422 ve alan hatası; aşırı boyut → 413.

## Tamamlanma ölçütü
Fixture'lar (kapalı olmayan halka, self-intersection, ters koordinat, GeometryCollection, aşırı vertex) testte kapsanmış ve geçiyor.
