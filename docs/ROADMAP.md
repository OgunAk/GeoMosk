# Yol haritası

Başlangıç tahmini: 14 iş günü, tek geliştirici (master prompt §15); garanti değildir. Kritik yol:
Faz 0 → DB/CRS → gerçek veri/import → GeoJSON/API/harita → CRUD → üç analiz → test/temiz kurulum → teslim.
Her faz kapısı: `node scripts/validate-project.mjs --phase N`.

| Faz | Durum | Amaç / görevler | Kabul kriteri | Risk / önlem | Önerilen commit |
|---|---|---|---|---|---|
| 0 | doğrulandı | Gereksinim matrisi, Claude altyapısı, doğrulayıcılar | verify + hook testleri + matris; runtime keşif | — | `Faz 0: Claude Code altyapısı…` |
| 1 | doğrulandı (CI yeşil) | .NET 9 solution, Vite/React, Compose, health, CI dosyası | build/test/lint, tarayıcı→API→PostGIS | Paket uyumu → NuGet'ten doğrulandı | `Faz 1: çalışan iskelet` |
| 2 | doğrulandı | Kaynak/lisans (gis-specialist), migration (districts, health_facilities, overrides, user_features, import_history), import script'i, kalite raporu, ilk GeoJSON endpoint, MapLibre ile iki gerçek tip | D01-D06, M01; idempotent import; 4326 + GiST `pg_indexes` | Bursa verisi uygunsuz olabilir → alternatif kaynak gerekçeli; OSM way/relation→nokta kararı | `Faz 2: gerçek veri ve import` |
| 3 | bekliyor | Layers/districts/facilities API, bbox/pagination, popup/panel, sunucu tarafı arama + vurgu + zoom, iki altlık, sözel override PATCH | M02-M05, C01; altlık değişim regresyonu | Altlık hizmet koşulları/erişimi → erken deneme | `Faz 3: katman, arama, altlık` |
| 4 | bekliyor | Terra Draw, `/api/features` CRUD, validasyon, sürüm çakışması | C02-C04; refresh/import sonrası kalıcılık | Terra Draw adaptör sürümü → küçük deney | `Faz 4: çizim ve CRUD` |
| — | — | **Geliştirici kontrol noktası 2** (DEVELOPER-REVIEW.md) | Geliştirici akışı dener, küçük değişikliği yapar | — | — |
| 5 | bekliyor | A01 within, A02 buffer, A03 nearest: API + UI + doğruluk testleri + EXPLAIN | A00-A03 | Sınır semantiği, geography indeksi | `Faz 5: üç MVP analizi` |
| 6 | bekliyor | A04 metrik SRID ölçüm, A05 ilçe sayımı + choropleth | A04-A05 | UTM 35N kapsamı → extent doğrulaması | `Faz 6: ölçüm ve ilçe istatistiği` |
| 7 | bekliyor | Regresyon, performans ölçümü (p50/p95), güvenlik, erişilebilirlik, code-reviewer | Q01-Q03; kritik bulgu yok | Ölçmeden başarı yazmama | `Faz 7: sağlamlaştırma` |
| 8 | bekliyor | Temiz Compose kurulumu, README, ekran görüntüleri, teslim listesi | L01-L03; **geliştirici kontrol noktası 3** | Uzak yayın izni | `Faz 8: teslim` |
