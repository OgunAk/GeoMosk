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

Planlanan, Faz 0'da bilinçli olarak yazılmayan belgeler (master prompt §22): `ARCHITECTURE.md`, `ROADMAP.md`, `DATABASE.md`, `API-CONTRACT.md`, `DATA-SOURCES.md`, `TEST-PLAN.md`, `DELIVERY-CHECKLIST.md`, `CLAUDE-CODE-SETUP.md`, `docs/adr/`, `README.md`.
