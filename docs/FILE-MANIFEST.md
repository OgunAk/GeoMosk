# Dosya manifesti

Makine tarafından denetlenen liste: `scripts/agent-setup.manifest.json` (`node scripts/verify-agent-setup.mjs`).
"Statik doğrulama" = verify-agent-setup / hook testleri. "Runtime keşfi" = Claude Code'un dosyayı oturumda gerçekten yüklediğinin gözlenmesi.

| yol | amaç | oluşturuldu/güncellendi | statik doğrulama | runtime keşfi | kanıt | kullanılacak faz |
|---|---|---|---|---|---|---|
| `CLAUDE.md` | Kısa operasyonel proje talimatı | güncellendi (araç bölümü korundu) | geçti | oturum başında yüklenir; yeni içerik bir sonraki oturumda | verify-agent-setup | tümü |
| `.claude/CLAUDE.md` | Kurulu araç skill notu | korundu (değişmedi) | — | önceki oturumda yüklendi | — | tümü |
| `.claude/settings.json` | İzin deny listesi + PostToolUse hook | güncellendi (`{}` → içerik) | geçti | **gözlendi**: hook bu oturumda tetiklendi | PROGRESS Faz 0 (hook probu) | tümü |
| `.claude/agents/architect.md` | Mimari/ADR ajanı | oluşturuldu | geçti | **gözlendi**: Agent tür listesine eklendi (7 ajanın tümü) | PROGRESS Faz 0 | 1, 2 |
| `.claude/agents/backend-engineer.md` | REST/DTO/validasyon ajanı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 1-6 |
| `.claude/agents/frontend-engineer.md` | UI/MapLibre/çizim ajanı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 1-6 |
| `.claude/agents/postgis-specialist.md` | Şema/migration/spatial SQL ajanı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 2, 5, 6 |
| `.claude/agents/gis-specialist.md` | Veri/CRS/lisans ajanı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 2, 6 |
| `.claude/agents/qa-engineer.md` | Faz kapısı/test ajanı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 1-8 |
| `.claude/agents/code-reviewer.md` | Salt-okunur inceleme ajanı (`tools` kısıtlı) | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 4-8 |
| `.claude/skills/dotnet-api/SKILL.md` | Endpoint iş akışı | oluşturuldu | geçti | **gözlendi**: oturum skill listesine eklendi | PROGRESS Faz 0 | 1-6 |
| `.claude/skills/ef-migrations/SKILL.md` | Migration iş akışı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 2+ |
| `.claude/skills/spatial-analysis/SKILL.md` | Analiz iş akışı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 5, 6 |
| `.claude/skills/maplibre/SKILL.md` | Harita/çizim iş akışı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 2-6 |
| `.claude/skills/geojson-validation/SKILL.md` | GeoJSON doğrulama | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | 2, 4 |
| `.claude/skills/project-validation/SKILL.md` | Faz kapısı iş akışı | oluşturuldu | geçti | **gözlendi** | PROGRESS Faz 0 | tümü |
| `.claude/skills/playwright-cli/` | Tarayıcı doğrulama (kurulu araç) | korundu | geçti | önceden kurulu | docs/AI-TOOLS.md | 1+ |
| `.claude/skills/graphify/` | Elle /graphify (`disable-model-invocation: true` korunur) | korundu | geçti (ayar denetlendi) | önceden kurulu | docs/AI-TOOLS.md | isteğe bağlı |
| `.claude/rules/architecture.md` | Katman/bağımlılık kuralları (koşulsuz) | oluşturuldu | geçti | denenmedi — koşulsuz kurallar oturum başında yüklenir | — | tümü |
| `.claude/rules/security.md` | Güvenlik kuralları (koşulsuz) | oluşturuldu | geçti | denenmedi — koşulsuz kurallar oturum başında yüklenir | — | tümü |
| `.claude/rules/coding-standards.md` | C#/TS/Node standartları (`paths`) | oluşturuldu | geçti; `scripts/**/*.mjs` eşleşiyor, diğerleri dizin oluşunca | denenmedi | verify-agent-setup --verbose | 1+ |
| `.claude/rules/spatial-data.md` | Bağlayıcı CRS/SRID kuralları (`paths`) | oluşturuldu | geçti; dizinler Faz 1-2'de oluşacak | denenmedi | verify-agent-setup --verbose | 2+ |
| `.claude/rules/frontend.md` | Frontend kuralları (`paths`) | oluşturuldu | geçti; `frontend/` Faz 1'de oluşacak | denenmedi | verify-agent-setup --verbose | 1+ |
| `.claude/rules/testing.md` | Test kuralları (`paths`) | oluşturuldu | geçti; `scripts/hooks/tests/**` eşleşiyor | denenmedi | verify-agent-setup --verbose | 1+ |
| `scripts/hooks/validate-changed-files.mjs` | PostToolUse hafif dosya doğrulayıcı | oluşturuldu | 17/17 fixture testi | **gözlendi**: bozuk JSON'da exit 2 | PROGRESS Faz 0 | tümü |
| `scripts/hooks/tests/validate-changed-files.test.mjs` | Hook fixture testleri (boşluklu yol, bozuk stdin, timeout, eksik yaml…) | oluşturuldu | `npm run test:hooks` geçti | — | PROGRESS Faz 0 | tümü |
| `scripts/lib/frontmatter.mjs` | Ortak frontmatter kontrolleri | oluşturuldu | testlerle dolaylı | — | — | tümü |
| `scripts/verify-agent-setup.mjs` | Manifest tabanlı altyapı doğrulayıcı | oluşturuldu | exit 0 | — | PROGRESS Faz 0 | 0, 7, 8 |
| `scripts/validate-project.mjs` | `--phase 0..8` / `--full` faz kapısı | oluşturuldu | `--phase 0` exit 0 | — | PROGRESS Faz 0 | tümü |
| `scripts/agent-setup.manifest.json` | Denetlenecek dosya listesi | oluşturuldu | JSON parse | — | — | 0 |
| `package.json`, `package-lock.json` | Kök araç paketi (`yaml@2.9.1`) | oluşturuldu | JSON parse; `npm install` başarılı | — | ADR-0003 | tümü |
| `.gitignore` | Sırlar/ham veri/derleme çıktıları | güncellendi (ekleme) | — | — | — | tümü |
| `docs/REQUIREMENTS.md` | Gereksinim izlenebilirlik matrisi (33 PDF + proje satırları) | oluşturuldu | matris kontrolü geçti | — | validate-project --phase 0 | tümü |
| `docs/PROGRESS.md` | Faz durumu ve raporlar | oluşturuldu | geçti | — | — | tümü |
| `docs/DECISIONS.md` | ADR-0001..0004 | oluşturuldu | geçti | — | — | tümü |
| `docs/DEVELOPER-REVIEW.md` | Geliştirici kontrol noktaları | oluşturuldu | geçti | — | — | 4, 8 |
| `docs/FILE-MANIFEST.md` | Bu dosya | oluşturuldu | geçti | — | — | tümü |
| `docs/AI-TOOLS.md` | Araç kurulum kaydı | korundu | geçti (UTF-8) | — | — | tümü |

## Faz 1 dosyaları

| yol | amaç | oluşturuldu/güncellendi | statik doğrulama | runtime keşfi | kanıt | kullanılacak faz |
|---|---|---|---|---|---|---|
| `global.json`, `backend/Directory.*.props`, `backend/GeoScope.sln` + 5 proje | .NET 9 solution, merkezi paket sürümleri | oluşturuldu | `dotnet build` 0 uyarı | `dotnet test` 8/8 | PROGRESS Faz 1 | tümü |
| `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `.env.example` | Container ortamı | oluşturuldu | `docker compose config` | compose up + tarayıcı akışı | PROGRESS Faz 1 | tümü |
| `frontend/` (Vite react-ts) | UI iskeleti, health durumu | oluşturuldu | typecheck/lint/build | Vitest 3/3, Playwright CLI | PROGRESS Faz 1 | tümü |
| `.github/workflows/ci.yml` | CI | oluşturuldu | — | çalıştırılmadı (uzak depo yok) | — | 1, 7 |
| `.gitattributes` | LF satır sonu | oluşturuldu | — | — | — | tümü |
| `docs/ARCHITECTURE.md`, `ROADMAP.md`, `TEST-PLAN.md`, `README.md` | Faz 1 belgeleri | oluşturuldu | — | — | — | tümü |
| `docs/screenshots/faz1-system-status.png` | Çalışan uygulamadan ekran görüntüsü | oluşturuldu | — | Playwright CLI | TEST-PLAN | 8 |

## Faz 2 dosyaları

| yol | amaç | oluşturuldu/güncellendi | statik doğrulama | runtime keşfi | kanıt | kullanılacak faz |
|---|---|---|---|---|---|---|
| `scripts/import/{overpass-queries,fetch-osm,load-osm}.mjs`, `scripts/import/Dockerfile`, `.dockerignore` | OSM edinme ve PostGIS importu | oluşturuldu | hook `node --check` | gerçek import + ImportPipelineTests | PROGRESS Faz 2 | 2, 8 |
| `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` | Gerçek veri snapshot'ı (ODbL) | oluşturuldu | checksum (`validate-project --phase 2`) | import 17/911 | DATA-SOURCES | 2, 8 |
| `data/raw/osm-bursa.manifest.json` | Son indirmenin manifesti | oluşturuldu | JSON | — | DATA-SOURCES | 2 |
| `data/test-fixtures/osm-mini/` | SENTETİK import fixture'ı | oluşturuldu | checksum | ImportPipelineTests | README (fixture) | 2+ |
| `backend/GeoScope.Domain/**`, `Infrastructure/Persistence/**`, `Infrastructure/Features/**`, `Api/Controllers/**`, `Api/OpenApi/**` | Entity, şema, sorgu, GeoJSON API | oluşturuldu | build 0 uyarı | 41/41 test | PROGRESS Faz 2 | 2+ |
| `docker/db/initdb/10-app-role.sh`, `docker/db/sql/app-role.sql` | Kısıtlı uygulama rolü | oluşturuldu | — | var olan + yeni volume'da çalıştı | DATABASE | 2+ |
| `.config/dotnet-tools.json` | dotnet-ef 9.0.22 | oluşturuldu | — | migration add | — | 2+ |
| `frontend/src/features/{map,layers}/**`, `services/sourceLayers.ts` | Harita ve katman özeti | oluşturuldu | typecheck/lint | Vitest 6/6, Playwright CLI | `docs/screenshots/faz2-map.png` | 2+ |
| `docs/DATA-SOURCES.md`, `DATABASE.md`, `API-CONTRACT.md` | Faz 2 belgeleri | oluşturuldu | `validate-project --phase 2` | — | — | tümü |

Henüz yazılmayan belgeler (ilgili fazda): `DELIVERY-CHECKLIST.md` (Faz 8), `CLAUDE-CODE-SETUP.md`, `docs/adr/`.
