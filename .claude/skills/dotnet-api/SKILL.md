---
name: dotnet-api
description: GeoScope ASP.NET Core REST endpoint'i ekleme/değiştirme iş akışı (gereksinim → DTO/OpenAPI → validasyon → servis/veri erişimi → ProblemDetails → API testi). backend/GeoScope.Api veya Application altında endpoint, DTO ya da hata davranışı değiştirirken kullan.
---

# dotnet-api

## Girdi
- REQUIREMENTS satır ID'si (ör. C04, A02) ve `docs/API-CONTRACT.md`'deki ilgili bölüm.
- Varsa mevcut controller/servis ve testler.

## İş akışı
1. **Gereksinim:** Satırın kabul testini oku. Endpoint sözleşmede yoksa önce `docs/API-CONTRACT.md`'ye ekle (method/path, girdi, çıktı, durum kodları, birim, limit).
2. **DTO/OpenAPI:** `GeoScope.Application` altında request/response DTO. GeoJSON yanıtı Feature/FeatureCollection; `id` stabil. PATCH DTO'sunda "gönderilmedi" ile `null` ayrımı açık tip ile (ör. `Optional<T>` benzeri) modellenir.
3. **Validasyon:** Biçim hatası → 400; geometri/semantik → 422 (alan hataları ile). Limitler konfigürasyondan: liste 250/2000, N 1..100, radius (0, 50000] m, ≤10.000 vertex, body ≤2 MiB.
4. **Servis/veri erişimi:** Async + `CancellationToken`; okuma `AsNoTracking`; spatial SQL parametreli (bkz. `spatial-analysis` skill'i).
5. **ProblemDetails:** Merkezi exception handling; `traceId` var; SQL/stack trace yok. 404/409/412/413 sözleşmeye uygun.
6. **Controller:** İnce adaptör; `POST` → 201 + `Location`, `PATCH` → 200, `DELETE` → 204.
7. **Test:** Başarılı + en az bir hata yolu; gerçek PostGIS ile API testi (`GeoScope.Tests`).

## Komutlar
- `dotnet build backend/GeoScope.sln` (planlanan, Faz 1)
- `dotnet test backend/GeoScope.Tests` (planlanan, Faz 1)
- `node scripts/validate-project.mjs --phase 1`

## Hata yolları
- Build kırık: önce derleme hatasını düzelt, kapsamı genişletme.
- Entegrasyon testi Docker olmadığı için çalışmıyor: durumu `engelli` kaydet, InMemory ile ikame etme.
- Sözleşme ile frontend tipi uyumsuz: `frontend-engineer` ile eşle, iki tarafı aynı değişiklikte güncelle.

## Tamamlanma ölçütü
OpenAPI'de görünür, testler geçer (exit code kayıtlı), `docs/API-CONTRACT.md` ve REQUIREMENTS satırı güncel.
