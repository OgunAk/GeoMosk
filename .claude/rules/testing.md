---
paths:
  - "backend/GeoScope.Tests/**"
  - "frontend/tests/**"
  - "frontend/src/**/*.test.ts"
  - "frontend/src/**/*.test.tsx"
  - "data/test-fixtures/**"
  - "scripts/hooks/tests/**"
  - "scripts/validate-project.mjs"
---

# Test kuralları

- Testler özellikle birlikte yazılır; son güne bırakılmaz. Uygulamanın aynısını tekrar eden değersiz testlerle sayı şişirilmez.
- **Gerçek PostGIS zorunlu:** Entegrasyon/spatial/API testleri gerçek PostgreSQL+PostGIS (Testcontainers veya belgeli ayrı test DB) ile. EF InMemory/SQLite bunun yerine sayılmaz. Docker ve ayrı DB yoksa durum `engelli`.
- Test DB'si ayrı ad/connection string ile; uygulama/kullanıcı DB'sine karşı test çalışmaz. Kullanıcı volume'ları silinmez.
- **Bağımsız referans:** Beklenen değer uygulamanın aynı formülünden türetilmez. Mesafe için bilinen jeodezik değer, alan için bağımsız hesap; tolerans testten önce yöntemle gerekçelendirilir.
- Zorunlu kapsam (master prompt §14): migration (boş/ileri/tekrar), import idempotency ve override koruma, geometri doğrulama (null/empty/yanlış tip/GeometryCollection/kapalı olmayan halka/self-intersection/aşırı vertex/body), eksen sırası, sınır/delik/MultiPolygon, buffer eşiği, nearest (N=0/1/üst/fazla N/eşit mesafe), ölçüm, istatistik (sıfır ilçe/tekil atama), CRUD (allowlist/null/sürüm çakışması), bbox/pagination, SQL injection/XSS, altlık değişimi, üç çizim türü.
- **Başarısız test silinmez,** `Skip` ile gizlenmez, tolerans gerekçesiz büyütülmez; kök neden düzeltilir veya açık engel olarak kaydedilir.
- Sonuç raporu: komut, exit code, geçen/başarısız sayısı ve hata kanıtı. Çalıştırılmayan test "geçti" sayılmaz.
- E2E: Playwright gerçek tarayıcıda; WebGL yoksa mock haritayla görsel başarı iddia edilmez. Dış tile bağımlılığı kontrollü fixture ile azaltılır; gerçek iki altlık ayrıca denenir.
- Testler birbirinin görünmez durumuna bağımlı olmaz; deterministik fixture ve sıralama (`id` bağ kırıcı).
- Sentetik fixture `data/test-fixtures/` altında, dosya başında sentetik olduğu belirtilerek.
