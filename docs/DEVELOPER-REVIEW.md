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

## Teknik sahiplik soruları (Faz 8 öncesi)
Master prompt §20.4'teki sorular teslim öncesinde geliştiriciyle kod üzerinde ele alınacak; yanıtlar burada gerçek kayıt olarak tutulacak.
