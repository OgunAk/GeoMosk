# Teslim kontrol listesi

Durumlar yalnız kanıtla işaretlenir. "Yerelde hazır" ile "uzakta yayımlanmış" ayrı izlenir (master prompt §17).
Son güncelleme: 2026-11-08 (PR #15 ve #16 birleştirildikten sonra).

| # | Teslim kalemi | Durum | Kanıt / not |
|---|---|---|---|
| 1 | GitHub deposu | **yayımlandı, özel (private)** | https://github.com/OgunAk/GeoMosk (2026-11-08'de geliştirici GeoScope → GeoMosk olarak yeniden adlandırdı; eski adres yönlenir). `gh repo view` 2026-11-08: `visibility: PRIVATE`, varsayılan dal `master`. Geliştirici kararı: depo **herkese açık yapılacak** (ayarı geliştirici değiştirir; AI değiştirmez). Açık erişim doğrulanana kadar durum değişmez. |
| 2 | Kaynak kod ana dalda | hazır | `master` (2f927cf) = Faz 0-8 + sonraki geliştirmeler: PR #1-#16 geliştirici tarafından birleştirildi (son: PR #15 2026-11-07T22:59Z, PR #16 23:06Z). PR #16'nın 4 CI kontrolü (Claude altyapısı/hook, backend + gerçek PostGIS, frontend, uçtan uca Compose + Playwright) geçti; `master` push CI (2f927cf) de yeşil. |
| 3 | Migration'lar | hazır | `backend/GeoMosk.Infrastructure/Persistence/Migrations/` (4 migration; sonuncusu `SearchTrigramIndexes`, ADR-0020). Temiz kurulumda `migrate` servisi exit 0. |
| 4 | Import script'i + veri | hazır | `scripts/import/{fetch-osm,load-osm}.mjs`, gerçek snapshot `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` (checksum'lı, ≈1 MB). Dump yerine script + snapshot. |
| 5 | Lisans/atıf | hazır | Veri: © OpenStreetMap katkıcıları, ODbL 1.0 (README, DATA-SOURCES, haritada atıf). Altlık: OSM Tile Usage Policy, OpenFreeMap. Yazılım: `LICENSE` (MIT, 2026 OgunAk); logo (MOSK Bilişim), OSM verisi ve üçüncü taraf paketler hariç. Geliştirici kararı 2026-11-08 (repo public yapılacak); önceki "lisans eklenmeyecek" kararının (2026-11-05) yerine geçer. |
| 6 | README | hazır | 2026-11-08 sadeleştirildi: hızlı başlangıç, giriş bilgileri, özellikler + beş analiz/SRID, teknolojiler, veri kaynağı/lisans, veri yükleme, elle geliştirme/test, demo, kısıtlar, yapay zekâ kullanımı, ödev teslim maddeleri. Ortam değişkenleri ve sorun giderme ARCHITECTURE'a taşındı. Uygulamada giriş yok (kimlik doğrulamasız, yalnız 127.0.0.1). |
| 7 | Temiz kurulum | **doğrulandı** (2026-11-05; yeniden adlandırma sonrası 2026-11-08) | 2026-11-05: yeni `git clone` (029445b) → ayrı Compose projesi, yeni volume, farklı portlar, `.env` yok: `up --build` exit 0; `ready` 200 (PostGIS 3.5.2); import 17/911; ikinci import değişiklik yok; uygulama rolü superuser değil; E2E 22/22 üretim imajı üzerinden; yeniden başlatma sonrası çizim kalıcı. 2026-11-08 (ADR-0019): çalışma klasöründen yeni `geomosk` Compose projesi ve **yeni volume** (`geomosk_geomosk-db`): `up --build`, import 17/911, roller `geomosk`/`geomosk_app`, E2E 26/26 üretim imajı üzerinden. Bu ikinci kurulum yeni bir `git clone` değildir. |
| 8 | Test kanıtları | hazır | 2026-11-08: backend 154/154 (gerçek PostGIS, Testcontainers), Vitest 75/75, E2E 26/26 (üretim imajı), typecheck/lint temiz, `validate-project --full` exit 0. Performans: 10.000 tesiste tüm senaryolar p95 < 75 ms; ad araması 14,7 → 0,28 ms, derin sayfa 1,7 → 0,07 ms (TEST-PLAN, `scripts/sql/search-keyset-plans.2026-11-08.txt`). CI: PR #16 4/4 yeşil. |
| 9 | Ekran görüntüleri | hazır | `docs/screenshots/` — çalışan uygulamadan: README'deki `geomosk-choropleth.jpg` (2026-11-08, GeoMosk başlığı, gerçek veri); tampon 2000 m, en yakın 5, Nilüfer ölçümü (faz8-*, temiz kurulumun üretim imajından); arama/detay, WMS. Eski faz görüntüleri (ör. `faz6-choropleth.jpg`) o tarihteki kanıt olarak kalır ve başlıkta eski ad GeoScope görünür. |
| 10 | Gereksinim matrisi | güncel | `docs/REQUIREMENTS.md` |
| 11 | Geliştirici son kabulü (kontrol noktası 3) | **geliştirici incelemesi bekliyor** | `docs/DEVELOPER-REVIEW.md` — manuel demo (10/10 yapıldı) ve 8 teknik sahiplik sorusu geliştirici tarafından tamamlandı (2026-11-07/08). Kalan: geliştiricinin teslimi kabul kararı. AI bu kararı geliştirici adına yazmaz. |

## Bilinen eksikler ve dürüst notlar
- Kontrol noktası 2'de geliştiricinin **bizzat** yapacağı değişiklik ("ad en az 3 karakter") geliştiricinin isteğiyle AI tarafından
  uygulandı (DEVELOPER-REVIEW G3). Master prompt §20.1'deki "geliştiricinin bizzat uyguladığı değişiklik" kanıtı bu nedenle henüz yok;
  kontrol noktası 3'te geliştirici başka bir küçük değişikliği kendisi yapabilir.
- Klavye ile çizim yok; mesafeler kuş uçuşu; .NET 9 desteği 10 Kasım 2026'da bitiyor (README "Bilinen kısıtlar").
- Yerel kaynaklar (2026-11-08): eski `geoscope_geoscope-db` volume'u ve demo klasörü geliştirici onayıyla silindi. Uygulama
  volume'u `geomosk_geomosk-db` içinde ADR-0020 ölçümü için `geomosk_perf` performans veritabanı (911 gerçek + 9.089 SENTETİK tesis)
  duruyor; uygulama onu kullanmaz. Silmek geliştirici kararıdır: `docker compose exec db psql -U geomosk -d geomosk -c "DROP DATABASE geomosk_perf"`.
- Faz 1-8 sırasında alınan ekran görüntülerinde başlık eski ad "GeoScope"tur (geçmiş kanıt; README güncel görseli kullanır).

## Geliştiricinin yapacağı son adımlar
1. Depoyu herkese açık yapmak (GitHub → Settings → General → Danger Zone → Change visibility). Ardından 1. satır doğrulanır.
2. Kontrol noktası 3: demo ve teknik sorular tamam; teslimi kabul kararını `docs/DEVELOPER-REVIEW.md`'ye vermek.
3. İsteğe bağlı: §20.1 kapsamında kendi yaptığı küçük bir değişiklik.
