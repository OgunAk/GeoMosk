---
paths:
  - "backend/GeoScope.Infrastructure/**"
  - "backend/GeoScope.Application/**"
  - "backend/GeoScope.Tests/**"
  - "scripts/import/**"
  - "scripts/sql/**"
  - "data/**"
  - "frontend/src/features/analysis/**"
  - "frontend/src/features/drawing/**"
---

# Mekânsal veri kuralları (bağlayıcı)

1. **Saklama:** Kalıcı geometri EPSG:4326, `NOT NULL`, tip kısıtlı kolon (`geometry(MultiPolygon,4326)`, `geometry(Point,4326)`, kullanıcı için `geometry(Geometry,4326)` + tip CHECK). Her geometri kolonunda GiST.
2. **Eksen sırası:** GeoJSON ve NTS koordinatı `[boylam, enlem]` (X=lon, Y=lat). Ters koordinat bilinen Bursa kontrol noktalarıyla tespit edilir; otomatik "düzeltme" yapılmaz.
3. **Dereceyle metre yasağı:** 4326 `geometry` üzerinde `ST_Distance`, `ST_Length`, `ST_Area`, `ST_Buffer` sonucu metre/m² diye sunulmaz. NTS düzlemsel hesapları SRID atanınca jeodezik olmaz.
4. **Metrik hesap:** Mesafe/yakınlık için `geography` (spheroid) — `ST_DWithin(geography)` metredir. Alan/uzunluk (A04) için doğrulanmış metrik SRID'ye `ST_Transform` (aday EPSG:32635, extent ile doğrulanacak). EPSG:3857 ölçüm için kullanılmaz.
5. **`ST_SetSRID` dönüşüm değildir;** yalnızca etiket atar. Gerçek dönüşüm `ST_Transform`. Bilinmeyen kaynak CRS'ye körlemesine 4326 atanmaz.
6. **Sınır semantiği açık:** Sınır dahil `ST_Covers(area, pt)`, hariç `ST_Within(pt, area)`. `ST_Intersects` "tamamen içeride" demek değildir. Delik ve MultiPolygon test edilir.
7. **Nearest:** Kesin sıralama `ST_Distance(geography)` + `id` bağ kırıcı. 4326 `<->` derece tabanlıdır; KNN optimizasyonu referans sorguya karşı test edilmeden kullanılmaz.
8. **Buffer:** Seçim `ST_DWithin` ile; çizilen buffer yaklaşık görseldir.
9. **Parametreli SQL:** Geometri, mesafe, N, filtre değerleri parametre. String interpolation yok.
10. **Kaynak/kullanıcı ayrımı:** Import verisi (`districts`, `health_facilities`) ile `user_features` karışmaz. Kaynak anahtarı `source + source_object_type + source_id`; OSM sayısal ID tek başına benzersiz değildir. Sözel düzenleme override tablosunda; import override'ı ezmez.
11. **Sunucu yeniden doğrular:** İstemci çizimi tip/koordinat/vertex/validity açısından API'de tekrar kontrol edilir; geçersiz şekil sessizce `ST_MakeValid` ile değiştirilmez (422).
12. **Sadeleştirme** yalnızca görüntü çıktısında; kaynak geometri ve analiz doğruluğu etkilenmez.
13. **Ham veri okuma:** `data/raw/**`, `*.geojson`, `*.sql` dump'ları bütünüyle okunmaz; `head -n 25` veya `jq` ile örneklenir.
14. **Sentetik veri** yalnızca `data/test-fixtures/` altında ve açıkça etiketli; gerçek veri gereksinimini karşıladığı söylenmez.
