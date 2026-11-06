---
name: ef-migrations
description: GeoMosk EF Core + Npgsql/NetTopologySuite migration iş akışı (mevcut şema incelemesi → ileri migration → SQL gözden geçirme → boş ve var olan DB testi → geri alma planı). Tablo, kolon, geometri tipi, constraint veya GiST/geography indeksi eklerken ya da değiştirirken kullan. Reset/drop varsayılan değildir.
---

# ef-migrations

## Girdi
Şema değişiklik ihtiyacı (REQUIREMENTS ID), `docs/DATABASE.md`, mevcut `backend/GeoScope.Infrastructure/Migrations/`.

## İş akışı
1. **İncele:** Mevcut model snapshot ve son migration'ı oku. Uygulanmış migration'ı asla düzenleme; yeni ileri migration yaz.
2. **Model:** Entity configuration'da geometri tipi ve SRID açık: `HasColumnType("geometry(Point,4326)")` vb. `NOT NULL`, unique kaynak anahtarı (`source + source_object_type + source_id`).
3. **Migration oluştur:** `dotnet ef migrations add <Ad> --project backend/GeoScope.Infrastructure --startup-project backend/GeoScope.Api` (planlanan, Faz 1 — `dotnet-tools.json` ile).
4. **SQL gözden geçir:** `dotnet ef migrations script --idempotent` (planlanan, Faz 1) çıktısında: `CREATE EXTENSION IF NOT EXISTS postgis` yönetimi, GiST indeksleri, `geography` expression index, CHECK (`ST_SRID`, `ST_IsValid`, `NOT ST_IsEmpty`, tip) var mı.
5. **Test:** Boş test DB'sinde tümünü uygula; önceki migration'daki DB'ye ileri uygula; ikinci kez uygula (no-op). `pg_indexes` ile indeks doğrula.
6. **Geri alma planı:** `Down` metodunun veri kaybı etkisini PR/PROGRESS notuna yaz. Veri kaybettiren `Down` yalnızca bilinçli karar ile.

## Kontrol sorgusu
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('districts','health_facilities','user_features');
```

## Hata yolları
- Provider/EF sürüm uyumsuzluğu: Npgsql.EntityFrameworkCore.PostgreSQL ve NTS paketinin aynı major'ünü NuGet'ten doğrula; ADR'ye yaz.
- Migration test DB dışında bir DB'ye işaret ediyor: dur, connection string'i kontrol et. Kullanıcı DB'si drop/reset edilmez.
- `EnsureCreated` migration sistemiyle karıştırılmaz.

## Tamamlanma ölçütü
Boş/var olan DB'de migration testleri geçer, indeksler doğrulanır, `docs/DATABASE.md` güncel.
