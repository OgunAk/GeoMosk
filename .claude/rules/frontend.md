---
paths:
  - "frontend/**"
---

# Frontend kuralları

- Yığın: React + TypeScript + Vite, Tailwind CSS, MapLibre GL JS, Terra Draw + MapLibre adaptörü. Sürümler lockfile ile sabit; `engines.node` tanımlı.
- Klasörler: `src/components/` ortak UI, `src/features/{map,layers,search,drawing,analysis}/`, `src/services/` API client + sözleşme tipleri, `src/hooks/`, `tests/`.
- MapLibre: instance tekil (`useRef`), cleanup'ta `remove()`; source/layer ID'leri merkezi; `style.load` sonrası idempotent yeniden kurulum ve state koruma. Altlık değişimi zorunlu regresyon testidir.
- İki altlık gerçek ve erişilebilir olmalı; kullanım koşulları/atıf doğrulanır ve haritada görünür. Demo tile sunucusunun sınırsız olduğu varsayılmaz.
- Veri: `moveend` + debounce ile bbox yükleme, `AbortController`, yarış kontrolü. Limit/sayfalama nedeniyle eksik veri kullanıcıya gösterilir; sessiz truncation yok.
- Arama sunucu tarafında tüm veri kapsamında; sonuç vurgulanır, listeden seçilince objeye zoom (bbox dışındakiler dahil).
- Çizim: draft kalıcı kayıttan ayrı; kaydetmeden ad/açıklama; API hatasında draft korunur ve "kaydedildi" denmez; çift gönderim engellenir; silmeden önce onay.
- Analiz/ölçüm değerleri backend'den. Tarayıcı önizlemesi varsa "önizleme" olarak etiketlenir.
- Güvenlik: kullanıcı/kaynak metni HTML olarak render edilmez. Internal servis adları (ör. `http://api:8080`) tarayıcıya sızmaz; API tabanı `VITE_API_BASE_URL` veya reverse proxy.
- Erişilebilirlik: form label'ları, klavye ile temel akış, odak görünürlüğü, yeterli kontrast; renk tek bilgi taşıyıcısı değil (choropleth lejantı + sayı).
- Arayüz metni Türkçe; ilgisiz dashboard kartı veya işlevsiz buton bırakılmaz.
- Doğrulama: `typecheck`, `lint`, `test`, `build` script'leri `frontend/package.json`'da tanımlı olur (Faz 1); E2E Playwright ile gerçek tarayıcıda. WebGL yoksa görsel başarı iddia edilmez.
