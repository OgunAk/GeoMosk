# Güvenlik kuralları (tüm oturumlar)

- **Sırlar:** `.env`, `appsettings.Local.json`, `.claude/settings.local.json`, gerçek parola/anahtar Git'e girmez. `.env.example` yalnızca değişken adları ve güvenli örnek değerler içerir. Hook özel anahtar içeriğini reddeder.
- **SQL:** Yalnızca parametreli sorgu; dinamik kolon/sıralama allowlist'ten. Kullanıcı girdisi SQL metnine birleştirilmez.
- **Girdi sınırları:** DTO allowlist; body ≤2 MiB, ≤10.000 vertex, liste üst limit 2000, N ≤100, radius ≤50.000 m. `properties.name`/`description` uzunluğu sınırlı. Korumalı alanlar (kaynak kimliği, SRID, import bilgisi) istemciden değiştirilemez.
- **Hata yanıtı:** ProblemDetails + `traceId`; SQL, stack trace, connection string veya sır içermez.
- **XSS:** UI kullanıcı/kaynak metnini HTML olarak çalıştırmaz.
- **CORS** yetkilendirme değildir; izinli origin listesi konfigürasyondan. Kimlik doğrulama PDF zorunluluğu değildir; anonim yazma API'si korumasız genel internete açılmaz (uzak yayın ayrı karar).
- **DB yetkisi:** Uygulama kullanıcısı superuser değildir; `CREATE EXTENSION postgis` yönetimi migration/kurulum adımında açıkça tanımlanır.
- **Yıkıcı işlemler:** `DROP DATABASE`, volume silme, `git push --force`, `git reset --hard`, toplu silme otomatik çalıştırılmaz. Import/migration yalnızca hedeflenen DB'ye; test DB açık kontrolle.
- **Hook/otomasyon:** Hook'lar otomatik commit/push, DB reset, uzak script çalıştırma veya sınırsız izin eklemez; kontrol modunda çalışır, dosya değiştirmez.
- **Alt süreç:** Dosya yolları shell komutuna birleştirilmez; argüman dizisi kullanılır.
- **Dış kaynak:** İndirilen veri güvenilmeyen girdidir; ayrı dizinde tutulur, çalıştırılmaz, checksum kaydedilir.
- **Uzak yayın:** GitHub'a push/yayın yalnızca kullanıcı izniyle; teslim yayın hariç tamamen hazırlanır.
- **Lisans:** Veri lisansı (OSM ODbL + atıf), yazılım lisansı ve tile hizmeti koşulları ayrı ayrı uygulanır.
