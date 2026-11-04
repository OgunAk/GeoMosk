# GeoScope — İlerleme kaydı

## Kısa durum (4 Kasım 2026)
- **Son doğrulanan faz:** Faz 1 — Çalışan iskelet (`validate-project --phase 1` exit 0).
- **Git:** Faz 0 commit'i `faz-0-altyapi` dalında (379c637, yazar OgunAk). Faz 1 değişiklikleri `faz-1-iskelet` dalında, henüz commit edilmedi.
- **Çalışan ortam:** `docker compose up --build -d` ile db/api/web ayakta (volume `geoscope_geoscope-db`).
- **Sonraki adım:** Faz 2 — gis-specialist ile Bursa ilçe (MultiPolygon) + sağlık tesisi (Point) kaynak/lisans doğrulaması; migration'lar; tekrarlanabilir import; `docs/DATA-SOURCES.md`, `docs/DATABASE.md`; MapLibre ile ilk harita (M01).
- **Faz 2 açık kararları:** uygulama için superuser olmayan DB rolü; NTS tiplerinin Domain'de kullanımı (ADR-0002 alt kararı).
- **İlgili master prompt bölümleri:** §6 (veri), §7 (şema), §8 (CRS).

## Faz 1 raporu

```text
Faz: 1 — Çalışan iskelet
Durum: doğrulandı (CI uzakta çalıştırılmadı)
Karşılanan gereksinimler: T01, T02, T05, P03, P07 doğrulandı; T03, P05, P06 devam ediyor.
Oluşturulan/değişen dosyalar: global.json; backend/ (GeoScope.sln, Directory.Build.props,
  Directory.Packages.props, 5 proje, Dockerfile, .dockerignore); frontend/ (Vite react-ts şablonu
  create-vite@9.3.1, Tailwind 4.3.3, Vitest 4.1.12, SystemStatus, AppLayout, apiClient, Dockerfile,
  nginx.conf); docker-compose.yml; .env.example; .github/workflows/ci.yml; .gitattributes;
  docs/ARCHITECTURE.md, ROADMAP.md, TEST-PLAN.md; README.md; hook'a JSONC desteği (+3 test).
Çalıştırılan komutlar ve sonuç/exit code:
  winget install Microsoft.DotNet.SDK.9 → 9.0.320 kuruldu, exit 0
  dotnet build backend → 0 uyarı, 0 hata (ilk denemede Testcontainers kullanımdan kalkmış kurucu
    uyarısı TreatWarningsAsErrors ile hata verdi → image parametreli kurucuya geçildi)
  dotnet test backend → 8 başarılı, 0 başarısız (gerçek postgis/postgis:17-3.5 container)
  npm --prefix frontend run typecheck / lint / test (3/3) / build → hepsi exit 0
  npm run test:hooks → 20/20
  docker compose config --quiet → exit 0; docker compose up --build -d → exit 0
  GET :8080/api/health/live → 200; /api/health/ready → 200 postgisVersion 3.5.2; :5080/openapi/v1.json → 200
  docker compose stop db → ready 503, gövdede bağlantı ayrıntısı yok; start db → 200
  playwright-cli open http://127.0.0.1:8080/ → "Veritabanı: Hazır (PostGIS 3.5.2)", konsol hatası 0,
    ekran görüntüsü docs/screenshots/faz1-system-status.png
  node scripts/validate-project.mjs --phase 1 → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: yok (Faz 2+).
İnceleme bulguları ve çözümleri: Hook iki gerçek sorunu yakaladı: dotnet şablonlarından gelen BOM'lu
  JSON/csproj (temizlendi) ve tsconfig JSONC yanlış alarmı (hook düzeltildi, test eklendi). Hook ayrıca
  test dosyasındaki sahte özel anahtar kalıbını yakaladı (kalıp çalışma anında birleştirilecek şekilde
  değiştirildi). Alt ajan incelemesi yapılmadı (iskelet, kritik spatial/CRUD kodu yok).
Çalıştırılamayan kontroller ve nedeni: GitHub Actions CI — uzak depo yok. Temiz kurulum (ayrı Compose
  projesi + yeni volume) Faz 8'de. MapLibre/WebGL henüz yok.
Kalan risk/engel: .NET 9 desteği 10 Kasım 2026'da bitiyor (README'de kısıt olarak yazıldı).
  Compose DB kullanıcısı superuser (postgis image varsayılanı) → Faz 2'de ayrı uygulama rolü.
Sonraki somut adım: Faz 2 veri kaynağı doğrulaması.
```

## Faz 0 raporu

```text
Faz: 0 — Analiz ve ajan altyapısı
Durum: doğrulandı (statik kapı) — runtime keşfi kısmi, aşağıda
Karşılanan gereksinimler: P01, P02 (proje kararı satırları). PDF satırları (T/D/M/C/A/L/Q) matriste
  izlenebilir; hiçbiri henüz uygulanmadı → "bekliyor".
Oluşturulan/değişen dosyalar: docs/FILE-MANIFEST.md'deki tablo (7 ajan, 6 skill, 6 rule, settings,
  3 script + ortak lib + hook testleri, 5 belge, kök package.json). Korunanlar: .claude/CLAUDE.md,
  playwright-cli ve graphify skill'leri (graphify disable-model-invocation: true denetleniyor),
  docs/AI-TOOLS.md, .graphifyignore. .gitignore'a yalnızca ekleme yapıldı.
Çalıştırılan komutlar ve sonuç/exit code:
  claude --version → 2.1.318 (Claude Code)
  dotnet --list-sdks → 8.0.400, 8.0.427, 10.0.302
  node --version → v24.21.0; npm 11.19.0; git 2.53.0; Docker CLI 29.6.2 (daemon kapalı)
  pypdf 5.1.0 (scratchpad) ile PDF metin çıkarımı → 2 sayfa okundu (poppler yok; görsel render yapılamadı)
  npm install → added 1 package (yaml 2.9.1), exit 0
  npm run test:hooks → 17 test, 17 geçti, 0 başarısız, exit 0
    (ilk çalıştırmada 1 gerçek hata yakalandı: TextDecoder BOM'u siliyordu → ignoreBOM: true ile düzeltildi)
  node scripts/verify-agent-setup.mjs → 35 dosya, 0 hata, 0 uyarı, exit 0
    (ilk çalıştırmada "planlanan" işareti olmayan 3 tanımsız npm komutu referansı yakalandı ve düzeltildi)
  node scripts/validate-project.mjs --phase 0 → GEÇTİ, exit 0
  node scripts/validate-project.mjs --phase 1 → 7 eksik dosya raporladı (beklenen: Faz 1 uygulanmadı)
Veri/CRS/analiz kanıtları: yok (Faz 2+).
İnceleme bulguları ve çözümleri: Bağımsız alt ajan incelemesi yapılmadı (yeni ajan tanımları bu oturumda
  yüklü değil; ana ajan kontrol listelerini uyguladı).
Çalıştırılamayan kontroller ve nedeni:
  - (Sonradan gözlendi) Ajan runtime keşfi: 7 proje ajanı aynı oturumda bir sonraki kullanıcı mesajında
    Agent aracının tür listesine eklendi; code-reviewer için "Tools: Read, Grep, Glob, Bash" kısıtı görüldü.
  - Koşulsuz rules (architecture, security) ve güncellenen CLAUDE.md: oturum başında yüklenir; yeni oturumda geçerli.
    Yol bazlı rules: ilgili dizinler (backend/, frontend/) Faz 1'de oluşunca eşleşme gözlenecek.
  - settings.json permissions.deny: .env dosyası olmadığından canlı denenmedi (statik geçerli).
  - PDF görsel (sayfa render) kontrolü: poppler yok.
Runtime'da gözlenenler:
  - Skill keşfi: 6 yeni proje skill'i yazıldıktan sonra bu oturumun skill listesine canlı eklendi.
  - Hook: .claude/settings.json'daki PostToolUse(Write|Edit) hook'u, kasıtlı bozuk JSON prob dosyası
    (hook-probe.tmp.json, sonra silindi) yazıldığında tetiklendi; "JSON parse hatası: Unexpected end of
    JSON input" mesajıyla exit 2 döndü ve Claude'a iletildi. Bu, settings.json'ın yüklendiğini de gösterir.
Kalan risk/engel: Docker daemon kapalı (Faz 1 PostGIS); .NET 10 vs PDF'nin .NET 9 tercihi (ADR-0001);
  Bursa verisinin lisans/kapsam uygunluğu Faz 2'de doğrulanacak.
Sonraki somut adım: Docker Desktop'ı başlat → Faz 1 iskeleti.
```

## Faz geçmişi
| Faz | Durum | Tarih | Kanıt |
|---|---|---|---|
| 0 | doğrulandı (statik) / runtime kısmi | 2026-11-04 | Yukarıdaki rapor |
| 1 | doğrulandı (CI uzakta çalışmadı) | 2026-11-04 | Faz 1 raporu |
| 2 | bekliyor | — | — |
