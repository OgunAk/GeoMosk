# Mimari kuralları (tüm oturumlar)

- Katmanlı modüler monolit. Projeler: `backend/GeoMosk.Domain`, `GeoMosk.Application`, `GeoMosk.Infrastructure`, `GeoMosk.Api`, `GeoMosk.Tests`; `frontend/` ayrı Vite uygulaması.
- Bağımlılık yönü: `Domain` hiçbir katmana bağlı değil; `Application → Domain`; `Infrastructure → Application, Domain`; `Api → Application` ve yalnızca DI composition root için `Infrastructure`. Ters referans eklenmez.
- Domain HTTP, EF migration veya serileştirme ayrıntısı taşımaz. NetTopologySuite geometri tiplerinin hangi katmanda kullanıldığı `docs/DECISIONS.md` ADR'sinde belirlenir; gereksiz geometri sarmalayıcısı yazılmaz.
- Controller ince HTTP adaptörüdür; SQL ve iş kuralı Application/Infrastructure'dadır. Entity doğrudan dışarı dönmez; DTO/GeoJSON sözleşmesi kullanılır.
- Frontend veritabanına bağlanmaz; tüm okuma/yazma REST API üzerinden. Analiz ve metrik hesap backend'dedir.
- Eklenmeyecekler (gerçek ihtiyaç ve ADR olmadan): mikroservis, generic repository, ikinci Unit of Work, MediatR/CQRS, Redis, mesaj kuyruğu, Kubernetes, çok dil altyapısı, kapsamlı yetkilendirme.
- Sözleşme kaynağı `docs/API-CONTRACT.md` + çalışan OpenAPI; ikisi ve frontend tipleri aynı değişiklikte güncellenir.
- Şema yalnızca EF Core migration ile yönetilir; `EnsureCreated` kullanılmaz.
- Kaynak (import) verisi ile kullanıcı çizimleri ayrı tablolardadır; kaynak kayıt sözel düzenlemeleri override tablolarında tutulur ve import tarafından ezilmez.
- Sürümler sabitlenir: `global.json`, `engines`/lockfile, sürüm etiketli Docker image. `latest` kullanılmaz.
- Önemli karar → `docs/DECISIONS.md` (veya `docs/adr/`) kaydı. Mimari değişiklikte `architect` ajanı, teslim öncesi `code-reviewer`.
