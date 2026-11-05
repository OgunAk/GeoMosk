# Teslim kontrol listesi

Durumlar yalnız kanıtla işaretlenir. "Yerelde hazır" ile "uzakta yayımlanmış" ayrı izlenir (master prompt §17).
Son güncelleme: 2026-11-05 (PR #6 birleştirildikten sonra).

| # | Teslim kalemi | Durum | Kanıt / not |
|---|---|---|---|
| 1 | GitHub deposu | **yayımlandı, özel (private)** | https://github.com/OgunAk/GeoScope — `gh repo view` 2026-11-05: `visibility: PRIVATE`, varsayılan dal `master`. Değerlendiricinin erişimi için depoyu herkese açık yapmak veya ortak çalışan eklemek **geliştiricinin kararıdır** (AI değiştirmedi). |
| 2 | Kaynak kod ana dalda | hazır | `master` = Faz 0-8: PR #1-#6 geliştirici tarafından birleştirildi (PR #5 2026-11-05T00:48Z, PR #6 01:08Z; merge commit 1e1904e). PR #6'nın 8 CI kontrolü (backend, frontend, hook, uçtan uca — push ve pull_request) geçti. |
| 3 | Migration'lar | hazır | `backend/GeoScope.Infrastructure/Persistence/Migrations/` (3 migration). Temiz kurulumda `migrate` servisi exit 0. |
| 4 | Import script'i + veri | hazır | `scripts/import/{fetch-osm,load-osm}.mjs`, gerçek snapshot `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` (checksum'lı, ≈1 MB). Dump yerine script + snapshot. |
| 5 | Lisans/atıf | hazır | Veri: © OpenStreetMap katkıcıları, ODbL 1.0 (README, DATA-SOURCES, haritada atıf). Altlık: OSM Tile Usage Policy, OpenFreeMap. Yazılım lisansı dosyası **yok**: depo sahibinin seçimi (ör. MIT) — geliştirici kararı. |
| 6 | README | hazır | Kurulum, teknolojiler, mimari, ortam, migration, veri/lisans/import, API, beş analiz + SRID/birim, testler, ekran görüntüleri, demo, kısıtlar, sorun giderme. Giriş bilgisi yok (kimlik doğrulamasız, yalnız 127.0.0.1). |
| 7 | Temiz kurulum | **doğrulandı** (2026-11-05) | Yeni `git clone` (029445b) → ayrı Compose projesi `geoscope-clean`, yeni volume, farklı portlar, `.env` yok: `up --build` exit 0 (imajlar sıfırdan); `ready` 200 (PostGIS 3.5.2); import 17/911; ikinci import 0 ekleme/0 güncelleme (17/911 değişmedi); `geoscope_app` superuser değil; E2E 22/22 **üretim imajı (nginx) üzerinden**; db + api yeniden başlatma sonrası kullanıcı çizimi kalıcı. |
| 8 | Test kanıtları | hazır | Backend 141/141 (gerçek PostGIS), Vitest 62/62, E2E 22/22 (yerel + üretim imajı), `validate-project --full` (PROGRESS Faz 8). CI: Faz 8 commit'i a501f90 (PR #6) 8/8 kontrol yeşil. |
| 9 | Ekran görüntüleri | hazır | `docs/screenshots/` — çalışan uygulamadan (faz8-* temiz kurulumun üretim imajından): tampon 2000 m, en yakın 5, Nilüfer ölçümü, choropleth, dar ekran, arama/detay. |
| 10 | Gereksinim matrisi | güncel | `docs/REQUIREMENTS.md` |
| 11 | Geliştirici son kabulü (kontrol noktası 3) | **geliştirici incelemesi bekliyor** | `docs/DEVELOPER-REVIEW.md` — manuel demo, teknik sahiplik soruları ve teslim kapsamı geliştirici tarafından yapılmadan "kabul edildi" yazılmaz. |

## Bilinen eksikler ve dürüst notlar
- Kontrol noktası 2'de geliştiricinin **bizzat** yapacağı değişiklik ("ad en az 3 karakter") geliştiricinin isteğiyle AI tarafından
  uygulandı (DEVELOPER-REVIEW G3). Master prompt §20.1'deki "geliştiricinin bizzat uyguladığı değişiklik" kanıtı bu nedenle henüz yok;
  kontrol noktası 3'te geliştirici başka bir küçük değişikliği kendisi yapabilir.
- Klavye ile çizim yok; mesafeler kuş uçuşu; .NET 9 desteği 10 Kasım 2026'da bitiyor (README "Bilinen kısıtlar").
- Temiz kurulum testinin kaynakları: container'lar durduruldu; `geoscope-clean_geoscope-db` volume'u ve `geoscope` DB'deki
  `geoscope_perf` performans veritabanı silinmedi (silme geliştirici onayıyla:
  `docker volume rm geoscope-clean_geoscope-db`, `docker compose exec db psql -U geoscope -c "DROP DATABASE geoscope_perf"`).

## Geliştiricinin yapacağı son adımlar
1. Depo görünürlüğüne/erişimine karar vermek (değerlendirici erişimi) ve isterse yazılım lisansı seçmek.
2. Kontrol noktası 3: uygulamayı kendisi açıp demo senaryosunu (README) denemek, teknik sahiplik sorularını yanıtlamak.
