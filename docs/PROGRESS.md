# GeoScope — İlerleme kaydı

## Kısa durum (4 Kasım 2026)
- **Son doğrulanan faz:** Faz 0 — Analiz ve ajan altyapısı (statik kapı geçti; runtime kısmi, ayrıntı aşağıda).
- **Git:** Faz 0, `faz-0-altyapi` dalında commit edildi (geliştirici birleştirecek).
- **Docker:** Geliştirici Docker Desktop'ı başlattı; daemon 29.6.2 yanıt veriyor.
- **Sonraki adım:** Faz 1 — `global.json` (.NET 9 SDK, ADR-0001), backend solution + 5 proje, Npgsql/NTS paket sürümlerini NuGet'ten doğrulama, Vite+React+TS frontend, `docker-compose.yml` (sürüm etiketli PostGIS), live/ready health, CI iskeleti. Faz 1'de `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/TEST-PLAN.md` oluşturulacak.
- **İlgili master prompt bölümleri:** §5 (mimari), §9 (API), §15 (yol haritası), §17 (Docker/CI).

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
| 1 | bekliyor | — | — |
