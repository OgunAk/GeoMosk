# Geliştirici kontrol noktaları

Bu dosyaya yalnızca gerçekleşen kayıt yazılır. Geliştirici adına görüş, süre veya test sonucu yazılmaz. Yanıt yoksa durum `geliştirici incelemesi bekliyor`.

| # | Kontrol noktası | Zaman | Karar/bulgu | Geliştiricinin gerekçesi/geri bildirimi | İlgili değişiklik | Test sonucu | Durum |
|---|---|---|---|---|---|---|---|
| 1 | Kapsam/mimari | Faz 0 sonu | Bursa ilçeleri + sağlık tesisleri senaryosu; katmanlı monolit | Master prompt §22'de "geliştirici tarafından onaylanmıştır" kaydı var; bu oturumda ayrıca soru sorulmadı | docs/DECISIONS.md ADR-0002 | — | önceden onaylı (master prompt §22) |
| 2 | Ürün ve kod | Faz 4 sonu (2026-11-04) | Geliştirici uygulamayı denedi. İki iyileştirme istendi; kendi yapacağı değişikliği seçti: "Ad en az 3 karakter" | Bkz. "Geliştirici geri bildirimi (2026-11-04)" | Geri bildirim 1-2 uygulandı. Seçilen değişikliği geliştirici 2026-11-05'te AI'ya bıraktı; AI uyguladı | — | tamamlandı (G3 AI tarafından, geliştirici isteğiyle) |
| 3 | Son kabul | Faz 8 sonu | Manuel demo, teknik açıklama, teslim kapsamı | — | — | — | geliştirici incelemesi bekliyor |

## Kontrol noktası 2 — deneme rehberi (geliştirici dolduracak)

**Denenecek akış:** katman aç/kapa ve altlık değişimi; bir tesise tıklayıp yerel açıklama verme; arama ("nilufer", "devlet hastanesi");
Nokta, Çizgi ve Alan çizip kaydetme; çizimin adını ve geometrisini düzenleme; silme; sayfayı yenileyip kalıcılığı görme.

**Geri bildirim için sorular:** Panel düzeni ve bilgi önceliği anlaşılır mı? Türkçe metinler doğal mı? Çizim ipuçları yeterli mi?
Demo akışında eksik/fazla bir şey var mı?

**Geliştiricinin bizzat yapacağı küçük değişiklik (birini seçin):**
1. Kullanıcı çizimi adına en az 3 karakter kuralı: `UserFeatureRequestParser.ReadName` ve ilgili API testi (400 durumu) + `CreateFeatureForm` ipucu.
2. Arama sonuç sınırını 50'den farklı bir değere taşıyıp yapılandırılabilir yapmak: `SEARCH_LIMIT` (frontend) + `SearchPanel.test.tsx`.
3. Yeni bir tesis türü filtresi kısayolu (ör. "yalnız hastaneler" düğmesi): `SearchPanel.tsx` + bir Vitest testi.

AI desteği açıklama/inceleme ile sınırlı kalır; değişikliği geliştirici yazar. Gerçekleşince bu bölüm ve tablo satırı gerçek kayıtla güncellenir.

### Geliştirici geri bildirimi (2026-11-04, sohbetten aynen)
> "çizgi ve alan seçimi yaparken sonlandırmak için başlangıç noktasına dokunmak yerine daha basit bir bitiriş olmalı, alanda istenen şekli vermek zorlaşıyor, sağlık tesisleride kendi içinde filtrelensin, harici devam et"

Seçilen küçük değişiklik: **1. Kullanıcı çizimi adına en az 3 karakter kuralı** (geliştirici yapacak).

| # | Geri bildirim | Yorum / karşılık | Durum |
|---|---|---|---|
| G1 | Çizgi/alan bitirmek için başlangıç noktasına dokunmak zor | "Çizimi bitir" düğmesi + Enter tuşu (Terra Draw'ın bitirme tuşu tuvale gönderilir); alan otomatik kapanır; ipucu metni güncellendi. Kanıt: `DrawingToolbar.test.tsx` (3), E2E çizgi Enter ile 3 köşe, alan düğmeyle 3 köşe + kapanış | uygulandı (AI), geliştirici yeniden denemesi bekliyor |
| G2 | Sağlık tesisleri kendi içinde (türe göre) filtrelensin | Lejanttaki 6 tür, sayılarıyla haritada aç/kapa anahtarı oldu; vurgu/seçim halkalarına da uygulanır, altlık değişiminde korunur, tesis katmanı kapalıyken devre dışı. Kanıt: `LayerPanel.test.tsx` (+2), E2E "tesis türü filtresi…" | uygulandı (AI), geliştirici yeniden denemesi bekliyor |
| G3 | Seçilen değişiklik: ad en az 3 karakter | Geliştirici 2026-11-05'te "değişikliği sana bırakıyorum" dedi; AI uyguladı: `ReadName` (kırpılmış ad, grafem sayısı ≥ 3, 400), `UserFeatureApiTests` (+3 durum: "ab", "  ab  ", PATCH " x " kaydı değiştirmez; "  Çağ  " kabul), `CreateFeatureForm` ipucu + `aria-invalid`, `UserFeaturePanel` düzenleme mesajı; Vitest +1. Mevcut kısa adlı kayıtlar korunur; kural yalnız yeni ad yazılırken uygulanır | uygulandı |

## Kontrol noktası 3 — son kabul rehberi (geliştirici dolduracak)

Otomatik doğrulamalar ve teslim paketi hazır (DELIVERY-CHECKLIST, PROGRESS Faz 8). Aşağıdakiler geliştirici yapmadan "kabul edildi"
veya "manuel test geçti" yazılmaz.

1. **Manuel demo:** README "Demo senaryosu" 10 adımı kendi makinenizde (`docker compose up --build -d` + import) deneyin.
   Her adım için çalıştı/çalışmadı ve gözleminizi aşağıdaki tabloya yazın.
2. **Teknik sahiplik:** aşağıdaki soruları kendi sözlerinizle yanıtlayın; ilgili koda bakarak gösterin.
3. **Teslim kapsamı:** bilinen kısıtları (README) kabul ediyor musunuz; PR #5 birleştirme, depo erişimi ve lisans kararınız.
4. **İsteğe bağlı (§20.1):** G3'ü AI uyguladığı için, bizzat yapacağınız küçük bir değişiklik (ör. arama sonuç sınırını
   yapılandırılabilir yapmak: `SearchPanel.tsx` + `SearchPanel.test.tsx`, ya da "yalnız hastaneler" kısayolu).

| Demo adımı | Sonuç | Geliştirici notu |
|---|---|---|
| 1-10 | geliştirici incelemesi bekliyor | — |

## Teknik sahiplik soruları (master prompt §20.4)
Kod işaretçileri yanıtı bulmanız içindir; yanıtı geliştirici yazar. Yanıt yoksa durum `geliştirici incelemesi bekliyor`.

| Soru | Nereye bakmalı | Geliştiricinin yanıtı |
|---|---|---|
| Veri neden 4326 saklanıyor; metre hesabı nerede, nasıl? | `.claude/rules/spatial-data.md`; `Infrastructure/Analysis/AnalysisService.cs` (`::geography`, `ST_Transform(…, 32635)`) | geliştirici incelemesi bekliyor |
| `ST_SetSRID` ile `ST_Transform` farkı? | ADR-0013; `scripts/import/load-osm.mjs` (etiket) vs `MeasureAsync` (dönüşüm) | geliştirici incelemesi bekliyor |
| Sınırdaki tesis seçime ve ilçe sayımına nasıl giriyor? | `WithinAsync` (`ST_Covers`/`ST_Within`), `DistrictStatsAsync` (tekil atama) | geliştirici incelemesi bekliyor |
| Nearest sıralaması neden doğru; indeks hangi sorguyu hızlandırıyor? | `NearestAsync`, ADR-0012, `scripts/sql/analysis-plans.2026-11-05.txt` | geliştirici incelemesi bekliyor |
| Yeni çizim tarayıcıdan DB'ye hangi katmanlardan geçiyor? | `useTerraDraw.ts` → `CreateFeatureForm.tsx` → `services/userFeatures.ts` → `UserFeaturesController` → `UserFeatureRequests`/`UserGeometryParser` → `UserFeatureStore` → `user_features` | geliştirici incelemesi bekliyor |
| Import neden mükerrer üretmiyor, kullanıcı düzenlemesini neden ezmiyor? | `load-osm.mjs` (kaynak anahtarı upsert, `IS DISTINCT FROM`), `*_overrides` tabloları | geliştirici incelemesi bekliyor |
| Altlık değişiminde katmanlar nasıl korunuyor? | `MapView.tsx` (`style.load` → `styleRevision`, `ensure*`, `LAYER_ORDER`), `useTerraDraw.ts` (taslak saklama) | geliştirici incelemesi bekliyor |
| Bir testi bozup hatanın sebebini nasıl bulursunuz; yeni filtre nasıl eklenir? | `MeasureAndDistrictStatsApiTests.cs`; filtre: `FeatureQuery` → `SourceFeatureQueries` → `SearchPanel` | geliştirici incelemesi bekliyor |
