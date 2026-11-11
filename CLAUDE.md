# GeoMosk

> Proje adı ve tüm kod adları **GeoMosk** (ADR-0019; eski kod adı GeoScope, 2026-11-08'de tamamen değiştirildi).

Bursa ilçeleri (MultiPolygon) + sağlık tesisleri (Point) gerçek açık verisiyle Web CBS uygulaması:
MapLibre haritası, katman/altlık, arama, sözel düzenleme, kullanıcı çizimi CRUD ve PostGIS analizleri.
Ödev kaynağı `ODEV_WEB_CBS.pdf`; ana kapsam `GEOMOSK_MASTER_PROMPT.md` (yerel, Git dışı; her görevde yeniden okunmaz).

## Yeni görevde önce oku
1. `docs/PROGRESS.md` — son faz, açık engeller, sonraki adım.
2. İlgili `docs/REQUIREMENTS.md` satırları ve ilgili skill (`.claude/skills/*`).
3. Yalnızca gerekiyorsa master promptun ilgili bölümü (§ numarası PROGRESS'te).

## Teknoloji (karar durumu: docs/DECISIONS.md)
- Backend: ASP.NET Core Web API, C#, .NET 9 (ADR-0001; geliştirici kararı, PDF tercihiyle uyumlu).
- DB: PostgreSQL + PostGIS (Docker Compose `db`). EF Core + Npgsql + NetTopologySuite.
- Frontend: React + TypeScript + Vite + Tailwind, MapLibre GL JS, Terra Draw.
- Test: xUnit + gerçek PostGIS; Vitest/Testing Library; Playwright.
- Sürümler sabitlenir (`global.json`, lockfile, image etiketi); `latest` yok. Paket adı/sürümü ezberden yazılmaz.

## Klasörler
| Yol | Durum |
|---|---|
| `.claude/agents/` 7 ajan, `.claude/skills/` 6 proje + 1 araç skill'i, `.claude/rules/` 6 kural | Faz 0 ✓ |
| `scripts/verify-agent-setup.mjs`, `scripts/validate-project.mjs`, `scripts/hooks/` | Faz 0 ✓ |
| `docs/` REQUIREMENTS, PROGRESS, DECISIONS, DEVELOPER-REVIEW, FILE-MANIFEST, AI-TOOLS | Faz 0 ✓ |
| `backend/GeoMosk.{Domain,Application,Infrastructure,Api,Tests}/`, `Directory.Packages.props` | Faz 1 ✓ |
| `frontend/src/{components,hooks,services,test}/`, `features/{health,map,layers,search,details,drawing,analysis}/`, `frontend/tests/e2e/` | Faz 1-5 ✓ |
| `backend/GeoMosk.{Application,Infrastructure}/Analysis/`, `scripts/sql/analysis-plans.*` | Faz 5 ✓ (A04/A05 Faz 6) |
| `scripts/import/` (fetch/load OSM), `data/samples/osm-bursa/` (gerçek), `data/test-fixtures/` (SENTETİK) | Faz 2 ✓ |
| `backend/GeoMosk.Infrastructure/Persistence/Migrations/`, `docker/db/` (rol script'leri) | Faz 2 ✓ |
| `docker-compose.yml` (db, migrate, api, web, import[tools]), `.env.example`, `.github/workflows/ci.yml` | Faz 1-2 ✓ |

Belgeler: ARCHITECTURE, ROADMAP, TEST-PLAN, DATABASE, API-CONTRACT, DATA-SOURCES, README.
DELIVERY-CHECKLIST Faz 8'de oluşturulur (master prompt §22).

## Komutlar (çalışan)
```bash
npm install                                   # kök araç bağımlılığı (yaml)
node scripts/verify-agent-setup.mjs           # Claude altyapısı statik doğrulama
npm run test:hooks                            # hook fixture testleri
node scripts/validate-project.mjs --phase 0   # faz kapısı (0..8, --full)
node scripts/hooks/validate-changed-files.mjs --file <yol>   # tek dosya elle
dotnet build backend                          # .NET 9 (global.json 9.0.320)
dotnet test backend                           # Docker gerekli: Testcontainers postgis/postgis:17-3.5
npm --prefix frontend run typecheck           # ayrıca: lint | test | build | dev
npm --prefix frontend run e2e                 # Playwright; çalışan compose + import gerekir (yerelde Chrome)
docker compose up --build -d                  # db → migrate → api → web :8080 (yalnız 127.0.0.1)
docker compose --profile tools run --rm import   # gerçek OSM snapshot'ını yükler (idempotent)
npm run import:fetch                          # Overpass'tan yeni snapshot (ağ; adil kullanım)
dotnet tool run dotnet-ef migrations add <Ad> --project backend/GeoMosk.Infrastructure --startup-project backend/GeoMosk.Infrastructure --output-dir Persistence/Migrations
```
Elle geliştirme: `docker compose up -d db migrate`, `dotnet run --project backend/GeoMosk.Api` (5080, `geomosk_app` rolü),
`npm --prefix frontend run dev` (5173, /api → 5080). DB rolleri: `docs/DATABASE.md`.

## Bağımlılık yönleri
`Domain` ← `Application` ← `Infrastructure`; `Api` → Application (+ Infrastructure yalnız DI). Frontend DB'ye bağlanmaz.
Ayrıntı: `.claude/rules/architecture.md`.

## SRID / GeoJSON (özet — bağlayıcı metin `.claude/rules/spatial-data.md`)
- Saklama EPSG:4326; GeoJSON `[boylam, enlem]`; RFC 7946, `crs` üyesi yok.
- 4326 derecesiyle metre hesabı yok. Mesafe: `geography` (`ST_DWithin` metre). Alan/uzunluk: doğrulanmış metrik SRID'ye `ST_Transform`.
- `ST_SetSRID` dönüşüm değildir. Nearest: `ST_Distance(geography)` + `id`; 4326 `<->` metrik değildir.
- Sınır: dahil `ST_Covers`, hariç `ST_Within`. Kaynak verisi ile `user_features` ayrı; override'ı import ezmez.

## Faz geçişi
Fazlar 0→8 (master prompt §15). Her faz: kısa kapsam → küçük dikey dilim → build/test → `validate-project --phase N`
→ REQUIREMENTS/PROGRESS güncelle → kapı geçtiyse sonraki faz. Faz raporu biçimi `project-validation` skill'inde.
Geliştirici kontrol noktaları: Faz 4 sonu ve Faz 8 sonu (`docs/DEVELOPER-REVIEW.md`). Faz 0 senaryo/mimari onayı master prompt §22'de kayıtlı.

## Doğrulama dürüstlüğü
- Test sonucu exit code, özet ve hata kanıtıyla raporlanır; çalıştırılmayan test "geçti" sayılmaz.
- Kanıtı olmayan gereksinim `doğrulandı` olamaz. Başarısız test silinmez/atlanmaz; tolerans gerekçesiz büyütülmez.
- EF InMemory/SQLite PostGIS testi yerine geçmez. WebGL yoksa görsel başarı iddia edilmez.
- Sentetik veri gerçek veri diye sunulmaz. Yazılmamış dosya "oluşturuldu" denmez.

## Güvenlik ve Git
- Sırlar (`.env`, `appsettings.Local.json`, `.claude/settings.local.json`) Git dışı; `.env.example` sırsız. Ayrıntı: `.claude/rules/security.md`.
- Parametreli SQL; DTO allowlist; ProblemDetails'te SQL/stack trace yok.
- DB drop/reset, volume silme, force push otomatik yapılmaz. Commit/push yalnızca kullanıcı isteyince; uzak yayın izinle.
- Hook (`PostToolUse` Write|Edit) yalnız değişen dosyayı denetler; shell ile yapılan değişiklikleri yakalamaz — asıl kapı `validate-project` ve CI.

## Ajan kullanımı
Her görevde bütün ajanları çağırma. Mimari → `architect`; spatial SQL/migration → `postgis-specialist`;
veri/CRS → `gis-specialist`; faz kapısı → `qa-engineer`; kritik değişiklik/teslim → `code-reviewer` (salt-okunur).
Aynı dosyaya eşzamanlı iki ajan yazmaz; şema/sözleşme değişikliğini ana ajan koordine eder.

## Araçlar ve bağlam maliyeti
- Kurulum durumu: docs/AI-TOOLS.md. Kurulu araç ile doğrulanmış uygulamayı ayır.
- Context7: yeni paket/sürüm, belirsiz API veya uyumsuzlukta dar kapsamlı sorgu.
  Sürümü belirt; yerel paket sürümünü doğrula. Sonucu ilgili karara kaydet.
  Kimlik doğrulama eksikse resmî dokümana dön; başarılı bağlantı iddia etme.
- C#/TypeScript LSP: sembol ve referans aramasında kullan. Build/test yerine geçmez.
- Playwright CLI: gerçek UI akışını doğrula; stabil senaryoyu kalıcı teste dönüştür.
  Windows PowerShell'de gerektiğinde playwright-cli.cmd kullan.
- node_modules, bin, obj, dist, büyük veri/dump/log dosyalarını bütünüyle okuma; ham veride `head -n 25`/`jq`.
- Her görevde bütün ajanları çağırma. Tekrarlı belge araştırması ve uzun loglardan kaçın.

## Definition of Done
Gereksinime bağlı gerçek kod uçtan uca çalışıyor; API/frontend/DB/docs aynı sözleşmede; build ve ilgili testler geçti
(komut + exit code kayıtlı); CRS/birim/sınır doğruluğu fixture ile kanıtlı; hata/boş/limit davranışı var;
REQUIREMENTS + PROGRESS + gerekli ADR güncel; açık kritik doğruluk/veri kaybı/güvenlik bulgusu yok.
