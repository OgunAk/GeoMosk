# GeoScope | Claude Code Türkçe Master Prompt

**Belge tarihi:** 4 Kasım 2026  
**Amaç:** Gereksinim analizi, Claude Code proje altyapısı, faz bazlı uygulama geliştirme, doğrulama ve teslimi tek talimatta birleştirmek.

## Kullanım

Bu dosyayı GeoScope proje köküne koy. `Ödev - Web Tabanlı CBS.pdf` dosyasını da Claude Code'un okuyabildiği proje dizinine ekle. Claude Code'u proje kökünde açıp şu talimatı ver:

> `GEOSCOPE_MASTER_PROMPT.md` dosyasını ve ödev PDF'sini oku. Aşağıdaki çalışma talimatını uygula: önce Faz 0 kapsamında gereksinimleri, mimariyi ve gerçek Claude Code yapılandırma dosyalarını oluşturup doğrula; sonra bağımlılık sırasıyla uygulamayı geliştir, test et ve teslim edilebilir hale getir. Mevcut dosyaları koru; yalnızca plan sunup durma.

Bu belge uygulamanın kendisi değildir. Aşağıda adı geçen proje dosyalarını oluşturma ve uygulamayı geliştirme görevi Claude Code'a verilmektedir. Dosyaların oluşturulduğu veya uygulamanın test edildiği bu belgeyle iddia edilmez.

**Kaynak durumu:** Ödev PDF'sinin iki sayfası okunmuş ve görsel olarak kontrol edilmiştir. Önceki “Geliştirme Yol Haritası” konuşmasındaki proje planı, master prompt ve agents/skills/rules önerileri birleştirilmiştir. Önceki uzun mesajların erişilebilir metni kısmen kesildiğinden görünmeyen bölümün birebir aktarıldığı iddia edilmez; bu talimat kendi başına kullanılabilecek şekilde tamamlanmıştır. Ödev maddelerinin birincil kaynağı PDF'dir.

---

# CLAUDE CODE'A VERİLEN ÇALIŞMA TALİMATI

## 1. Rolün, hedefin ve çalışma yetkin

GeoScope için teknik lider olarak çalış. Yazılım mimarisi, C#/ASP.NET Core, PostgreSQL/PostGIS, CBS, React/TypeScript, MapLibre, test ve teslim sorumluluklarını birlikte üstlen. Gerektiğinde aşağıda tanımlanan uzman alt ajanları kullan.

Hedefin, gerçek açık lisanslı konumsal veri kullanan, PDF gereksinimlerini karşılayan, başka bir geliştiricinin yeniden kurabildiği bir Web GIS uygulamasını **gerçek proje dosyalarıyla geliştirmektir**. Önceki plandaki “bu aşamada yalnızca plan hazırla” sınırlaması bu yeni görev için geçerli değildir. Önce planla ve çalışma altyapısını kur; Faz 0 doğrulandıktan sonra uygulama koduna geç.

- Çalışma dizinini, mevcut dosyaları, Git durumunu ve geçerli proje talimatlarını incele. Mevcut uygulama varsa sıfırdan yeniden yazmak yerine eksikleri tamamla.
- Küçük, geri alınabilir yerel değişiklikler ve testler için her adımda tekrar onay isteme. Kapsamı etkileyen gerçek belirsizlikleri kısa sorularla çöz; bağımsız işleri sürdür.
- Kullanıcı değişikliklerini silme, ilgisiz dosyaları değiştirme, veri kaybına yol açan komutları otomatik çalıştırma. Uzak depoya gönderim/yayınlama için mevcut kullanıcı yetkisini kontrol et; yoksa teslimi tamamen hazırla ve yalnızca son yayın adımında izin iste.
- Dosya sistemi erişimin varsa dosyaları gerçekten yaz. Erişim yoksa bunu açıkla; tam dosya içeriklerini sun fakat oluşturulmuş gibi raporlama.
- Kusursuzluk garantisi verme. Derleme, test, veri doğrulama ve inceleme kanıtıyla hata riskini azalt.
- Dokümantasyon ve kullanıcıya açıklamalar Türkçe, kod tanımlayıcıları tutarlı İngilizce olsun. Arayüz Türkçe olsun; gerekçesiz çok dil altyapısı kurma.

## 2. Kaynak önceliği ve gereksinim izlenebilirliği

Ürün gereksinimlerinde sıralama: kullanıcının güncel açık kararı, ödev PDF'si, bu belgedeki proje kararları, önceki planın önerileri. Bir çelişki ödev uyumluluğunu etkiliyorsa görünür şekilde kaydet. PDF'yi baştan sona yeniden oku; sayfa ve başlık referanslarını doğrula. PDF erişilemiyorsa bulduğunu iddia etme; aşağıdaki aktarımı kullanarak hazırlığa devam et, kaynak doğrulamasını bekleyen iş olarak işaretle.

`docs/REQUIREMENTS.md` içinde aşağıdaki sütunlarla tek kaynak matrisi oluştur:

`ID | Kaynak/sayfa/başlık | Gereksinim | Sınıf | Teknik karşılık | Faz | Kabul testi | Kanıt/dosya | Durum`

Sınıflar: **PDF zorunlu**, **PDF tercih**, **PDF seçenek**, **PDF opsiyonel**, **değerlendirme ölçütü**, **bu promptun proje kararı**, **gelecek geliştirme**. Bir öneriyi PDF zorunluluğu gibi sunma. Durumlar: `bekliyor`, `devam ediyor`, `doğrulandı`, `engelli`, `kapsam dışı`. Doğrulama kanıtı olmayan satır `doğrulandı` olamaz.

### 2.1. PDF'den aktarılmış tam gereksinim listesi

| ID | Gereksinim | Kaynak | Sınıf / kabul özeti |
|---|---|---|---|
| T01 | Backend .NET Core / ASP.NET Core olmalı; .NET 9 tercih ediliyor. | s.1 Teknoloji | .NET zorunlu, 9 tercih; seçilen SDK ile build |
| T02 | PostgreSQL + PostGIS kullanılmalı. | s.1 Teknoloji | Zorunlu; gerçek DB bağlantısı ve PostGIS sürümü |
| T03 | ORM serbest; EF Core + Npgsql.NetTopologySuite tercih ediliyor. | s.1 Teknoloji | Tercih; seçilen paketlerin gerçek adlarını/uyumunu doğrula |
| T04 | Harita MapLibre GL JS olmalı. | s.1 Teknoloji | Zorunlu; çalışan harita |
| T05 | Frontend vanilla JS veya framework olabilir. | s.1 Teknoloji | Serbest; React proje kararıdır |
| D01 | İnternetten gerçek, açık lisanslı konumsal veri temin edilmeli. | s.1 §1 | Zorunlu; doğrulanmış kaynak ve lisans |
| D02 | Dışarıdan temin edilen veri en az iki farklı geometri tipi içermeli. | s.1 §1 | Zorunlu; nokta + poligon; kullanıcı çizimleri bu koşulun yerine geçmez |
| D03 | Konu/kaynak serbest; OSM, Overpass, Geofabrik, İBB, data.gov.tr, Natural Earth, geoBoundaries örnek verilmiş. | s.1 §1 | Kaynak örnekleri zorunlu değil |
| D04 | Veriler PostgreSQL/PostGIS'e yüklenmeli; import aracı serbest. | s.1 §1 | Zorunlu; yeniden çalıştırılabilir import |
| D05 | Geometri kolonları SRID 4326 ve GiST indeksli olmalı. | s.1 §1 | Zorunlu; şema ve veri üzerinde doğrulama |
| D06 | Veri kaynağı, lisansı, yükleme adımları README'de bulunmalı. | s.1 §1 | Zorunlu; kaynak başına kayıt |
| M01 | Açılışta MapLibre haritası gösterilmeli. | s.1 §2 | Zorunlu; gerçek veriyle açılış testi |
| M02 | Veri setleri açılıp kapatılabilen katmanlar olarak gösterilmeli. | s.1 §2 | Zorunlu; GeoJSON servis etme PDF'de seçenek, bu projede karar |
| M03 | Objeye tıklayınca öznitelikler popup veya yan panelde gösterilmeli. | s.1 §2 | Zorunlu |
| M04 | Öznitelik arama/filtreleme, sonuç vurgulama ve objeye zoom olmalı. | s.1 §2 | Zorunlu; yalnızca liste filtresi yeterli değil |
| M05 | En az iki farklı altlık arasında geçiş olmalı. | s.1 §2 | Zorunlu; ikisi de erişilebilir ve atıflı |
| C01 | Kayıtların ad/açıklama gibi sözel bilgileri düzenlenebilmeli. | s.1 §3 | Zorunlu; içe aktarılan kayıtlar için de uygulama içi düzenleme sağla |
| C02 | Point, polyline ve polygon çizilip kaydedilebilmeli. | s.1 §3 | Zorunlu; GeoJSON polyline karşılığı LineString |
| C03 | Çizimler ayrı kullanıcı katmanında tutulmalı. | s.1 §3 | Zorunlu; kaynak veriyle karıştırma |
| C04 | Ekleme/güncelleme/silme REST API üzerinden yapılmalı. | s.1 §3 | Zorunlu; kalıcı CRUD ve yenileme testi |
| A00 | Aşağıdaki beş analizden en az üçü backend'de PostGIS veya NTS ile yapılmalı, sonuçlar haritada gösterilmeli. | s.2 §4 | Zorunlu seçim; frontend hesabı tek başına yeterli değil |
| A01 | Çizilen veya seçilen poligon içinde kalan objeleri listele. | s.2 §4 | Analiz seçeneği; MVP'de seçildi |
| A02 | Seçilen obje etrafında kullanıcı mesafesiyle metre cinsinden buffer; içindeki objeler ve tampon haritada. | s.2 §4 | Analiz seçeneği; MVP'de seçildi |
| A03 | Tıklanan noktaya en yakın N obje, mesafeleriyle. | s.2 §4 | Analiz seçeneği; MVP'de seçildi |
| A04 | Seçilen objenin alanı/uzunluğu metrik birimde; hesapta uygun metrik SRID. | s.2 §4 | Analiz seçeneği; güçlü teslim hedefi |
| A05 | Her poligon içindeki nokta sayısı; tablo ve/veya tematik harita. | s.2 §4 | Analiz seçeneği; güçlü teslim hedefi |
| O01 | Harici WMS raster kaynak olarak gösterilebilir; TUCBS örnektir. | s.2 §5 | Açıkça opsiyonel |
| L01 | Proje GitHub gibi bir platforma yüklenmeli. | s.2 Teslim | Zorunlu teslim koşulu; uzak yayın durumu ayrı doğrulanır |
| L02 | README: kurulum, teknolojiler, kaynak/lisans, import ve varsa giriş bilgileri. | s.2 Teslim | Zorunlu; gerçek kişisel sırları yayımlama |
| L03 | Import script'i veya SQL dump repoda; büyük dosya için indirme bağlantısı olabilir. | s.2 Teslim | Zorunlu; erişim ve tekrarlanabilirlik testi |
| Q01 | Katmanlı/okunabilir mimari ve anlamlı API. | s.2 Değerlendirme | Değerlendirme ölçütü |
| Q02 | Geometrik doğruluk, bilinçli SRID/birim kullanımı. | s.2 Değerlendirme | Değerlendirme ölçütü |
| Q03 | Büyüyen veri için indeks, bbox, sayfalama vb. önlemler. | s.2 Değerlendirme | Değerlendirme ölçütü; ölçümle kanıtla |

### 2.2. Kapsam kararı

**MVP:** Tüm zorunlu maddeler; A01 alan içinde, A02 buffer ve A03 en yakın N analizleri. Üçü de API, UI, gerçek PostGIS ve doğruluk testleriyle tamamlanacak.

**Bu görevin güçlü teslim hedefi:** MVP kapısı geçildikten sonra A04 ölçüm ve A05 mekânsal birleştirmeyi de uygula. Böylece beş analiz tamamlanmış olsun. Ek iki analizin PDF'de ayrı ayrı zorunlu olmadığını koru. Kullanıcı teslim süresini kısaltırsa önce bu ikisini açıkça ertele; zorunlu özellikleri sessizce azaltma.

**Bu promptun süreç/kalite kararları:** Claude Code altyapı dosyaları, React/TypeScript/Vite, Terra Draw, Docker Compose, otomatik testler, CI, demo ve teknik belgeler. Bunlar PDF'nin birebir zorunlu teknoloji listesi değildir; bu çalışma kapsamında uygulanacak kararlardır.

**Gelecek sürüm:** WMS, kullanıcı/rol sistemi, rapor dışa aktarımı, vektör tile, gelişmiş dashboard. Gereksinim olmadan mikroservis, Kubernetes, Redis, mesaj kuyruğu veya kapsamlı yetkilendirme ekleme. WMS'yi ancak ana teslim tamamlandıktan sonra ayrıca ele al.

## 3. Teknoloji ve sürüm kararları

| Bileşen | Başlangıç kararı | Doğrulama |
|---|---|---|
| Backend | ASP.NET Core Web API, C# | SDK, hedef framework, container runtime uyumu |
| Veritabanı | PostgreSQL + PostGIS | Desteklenen birlikte çalışan sürümler |
| Veri erişimi | EF Core + Npgsql + NetTopologySuite | EF/Npgsql/provider major sürümleri ve GeoJSON serializer |
| Frontend | React + TypeScript + Vite | Node LTS ve paket peer dependency uyumu |
| UI | Tailwind CSS, ihtiyaç kadar bileşen | Seçilen major sürümün gerçek kurulum biçimi |
| Harita/çizim | MapLibre GL JS + Terra Draw ve uyumlu adaptör | Küçük çizim/kaydetme/stil değiştirme deneyi |
| Test | xUnit, gerçek PostGIS entegrasyonu; Vitest/Testing Library; Playwright | Çalışan yerel ve CI komutları |
| Altyapı | Docker Compose; backend ve frontend Dockerfile | Temiz ortam kurulumu |
| Sözleşme | REST, GeoJSON, OpenAPI | API ile frontend tiplerinin uyumu |

PDF'de .NET 9 **tercih**, zorunlu sürüm değildir. 4 Kasım 2026 kontrolünde Microsoft desteği .NET 9 için 10 Kasım 2026, .NET 10 LTS için 14 Kasım 2028'e kadar gösteriyor. Uygulamaya başlarken güncel destek ve kurulu araçları yeniden doğrula; yeni proje için uyumlu .NET 10 LTS varsayılanını değerlendir ve gerekçeyi ADR'ye yaz. Değerlendirici açıkça .NET 9 isterse bunu esas al. [Microsoft destek politikası](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).

SDK'yı `global.json`, Node gereksinimini uygun sürüm dosyası/`engines`, npm bağımlılıklarını lockfile, Docker image'larını sürüm etiketleriyle sabitle. Körlemesine `latest` kullanma. NuGet paket isimlerini ezberden türetme; EF Core spatial provider, Npgsql NTS ve GeoJSON serileştirme paketlerinin gerçek sürümlerini doğrula. İnternet yoksa “doğrulandı” deme.

## 4. Faz 0: Önce Claude Code çalışma altyapısını gerçekten kur

Bu faz uygulama geliştirmesinin ön koşuludur. Yalnızca klasör ağacı veya örnek içerik gösterme: aşağıdaki dosyaları proje kökünde **oluştur, diskten tekrar oku, doğrula ve raporla**. Mevcut dosyaları inceleyerek birleştir.

### 4.1. Zorunlu başlangıç yapısı

```text
geoscope/
├── CLAUDE.md
├── .claude/
│   ├── settings.json
│   ├── agents/
│   │   ├── architect.md
│   │   ├── backend-engineer.md
│   │   ├── frontend-engineer.md
│   │   ├── postgis-specialist.md
│   │   ├── gis-specialist.md
│   │   ├── qa-engineer.md
│   │   └── code-reviewer.md
│   ├── skills/
│   │   ├── dotnet-api/SKILL.md
│   │   ├── ef-migrations/SKILL.md
│   │   ├── spatial-analysis/SKILL.md
│   │   ├── maplibre/SKILL.md
│   │   ├── geojson-validation/SKILL.md
│   │   └── project-validation/SKILL.md
│   └── rules/
│       ├── architecture.md
│       ├── coding-standards.md
│       ├── spatial-data.md
│       ├── frontend.md
│       ├── testing.md
│       └── security.md
├── scripts/
│   ├── hooks/validate-changed-files.mjs
│   ├── validate-project.mjs
│   └── verify-agent-setup.mjs
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── DATABASE.md
│   ├── API-CONTRACT.md
│   ├── DECISIONS.md
│   ├── DATA-SOURCES.md
│   ├── TEST-PLAN.md
│   ├── DELIVERY-CHECKLIST.md
│   ├── CLAUDE-CODE-SETUP.md
│   ├── FILE-MANIFEST.md
│   ├── PROGRESS.md
│   └── adr/
└── README.md
```

Bunlar anlamlı, projeye özgü içerikle oluşturulacak. Boş dosya, yalnızca başlık, “sonra doldurulacak” metni tamamlanmış sayılmaz. Gelecek fazın henüz uygulanmamış özelliğini tasarım olarak belgeleyebilirsin; uygulanmış gibi yazamazsın.

### 4.2. CLAUDE.md

Kök dosyayı kısa ve operasyonel tut; yaklaşık 150-200 satırı aşmamayı hedefle. Amaç/kapsam, teknoloji, gerçek klasör yolları, çalışan geliştirme/test komutları, bağımlılık yönleri, SRID/GeoJSON kuralları, faz geçişi, doğrulama dürüstlüğü, güvenlik/Git kuralları ve Definition of Done bulunsun. Ayrıntılar için ilgili rules/docs dosyalarına yönlendir. Bu master promptun tamamını kopyalayıp bağlamı şişirme.

`AGENTS.md` Claude Code yapılandırmasının yerine geçmez. Depoda varsa mevcut talimatları dikkate al; farklı araçlar için gerçekten gerekiyorsa ekle, çelişen kopya talimat deposu yaratma.

### 4.3. Uzman ajanlar

Her `.claude/agents/*.md` dosyasında desteklenen YAML frontmatter ve somut görev talimatı bulunmalı. En az `name` ve açık `description` kullan; araç/model alanlarını kurulu sürümde doğrulamadan ekleme. Model kimliği uydurma. Ajanların varlığı onların çağrıldığı veya inceleme yaptığı anlamına gelmez. [Resmî alt ajan belgeleri](https://code.claude.com/docs/en/sub-agents).

| Ajan | Ne zaman | Sorumluluk / sınır |
|---|---|---|
| architect | İlk mimari ve önemli değişiklik | Katmanlar, ADR, bağımlılıklar; gerekçesiz yeniden yazım yok |
| backend-engineer | REST/iş kuralları | Backend, DTO, validasyon, hata yönetimi ve test |
| frontend-engineer | UI/harita/çizim | Frontend ve API entegrasyonu; backend ölçümünü tarayıcıyla ikame etmez |
| postgis-specialist | Migration, import, indeks ve analiz SQL | Şema, sorgu planı, metre doğruluğu; yıkıcı DB işlemi yok |
| gis-specialist | Veri/CRS/topoloji incelemesi | Kaynak, geometri kalitesi, projeksiyon ve sınır semantiği |
| qa-engineer | Kabul kapıları ve regresyon | Bağımsız senaryolar, gerçek test kanıtı, tekrar üretim |
| code-reviewer | Kritik değişiklik ve teslim öncesi | Öncelikli somut bulgular; varsayılan olarak inceleme, sessiz kod değişikliği yok |

Her ajan dosyasında tetikleyici, girdiler, okunacak belgeler, dosya kapsamı, araç ihtiyacı, yapamayacağı işlemler, koordinasyon, beklenen çıktı ve bitiş kriterleri yaz. Çıktı biçimi: `bulgu | önem | dosya/satır | etki | öneri | doğrulama`. Dosya kapsamları çalışma disiplinidir; gerçek bir dosya erişim güvenlik sınırıymış gibi sunma.

Birden çok ajanı sadece bağımsız işler için çalıştır; aynı dosyaya eşzamanlı yazdırma. Şema/sözleşme değişiklikleri önce ana ajan tarafından koordine edilsin. Basit düzeltmelerde bütün ajanları çağırma. Alt ajan desteği yoksa ana ajan ilgili kontrol listesini uygulasın ve bağımsız inceleme yapılmadığını kaydetsin.

### 4.4. Skills

Her skill dizininde `SKILL.md`, geçerli frontmatter, projeye özgü iş akışı, giriş/çıkış, komutlar, hata yolları ve tamamlanma ölçütleri olsun. `name` ve `description` ile amacı/çağrılma koşulunu belirt; gerçek komutlar oluştukça güncelle. [Resmî skills belgeleri](https://code.claude.com/docs/en/skills).

- `dotnet-api`: gereksinim → DTO/OpenAPI → validasyon → servis/veri erişimi → ProblemDetails → API testi.
- `ef-migrations`: mevcut şema ve migration incelemesi → ileri migration → SQL gözden geçirme → boş/var olan DB testi → geri alma planı. Reset veya drop varsayılan değildir.
- `spatial-analysis`: girdi tipi/CRS → birim ve sınır semantiği → SQL → indeks → doğruluk/performance testi → harita çıktısı.
- `maplibre`: source/layer kimlikleri → lifecycle → stil yenileme → seçme/vurgulama → çizim entegrasyonu → görünür doğrulama.
- `geojson-validation`: GeoJSON yapısı → koordinat/tip/sınır/topoloji → API round-trip → GeoJSON çıktı doğrulaması.
- `project-validation`: `--phase 0..8` ve tam teslim gibi gerçek parametreler → komutlar → kanıt → requirement matrisi → geçiş/engel kararı.

Skill bir komutu tanımladıysa ilgili script/komut gerçekten var olmalı. Çalışmayan komut listesini kullanılabilir otomasyon diye sunma.

### 4.5. Rules

Mimari ve güvenlik ilkeleri genel; backend, frontend, spatial ve test ayrıntıları gerektiğinde gerçek yollarla kapsamlı olsun. Yol bazlı kurallarda resmî `paths` frontmatter biçimini kullan. Örnek:

```yaml
---
paths:
  - "backend/**/*.cs"
  - "scripts/import/**"
  - "scripts/sql/**"
---
```

Glob örneğini gerçek dizine uyarlayıp eşleşmesini kontrol et. Kurallar için doğrulanmamış özel YAML anahtarları üretme. [Bellek ve yol bazlı kurallar](https://code.claude.com/docs/en/memory).

Rules içinde özellikle şunları bağlayıcı yap: 4326 saklama; boylam/enlem; dereceyle metre hesabı yasağı; uygun metrik SRID; parametreli SQL; kaynak ve kullanıcı verisi ayrımı; istemcideki çizimin sunucuda yeniden doğrulanması; contract uyumu; gerçek PostGIS testi; başarısız testin silinmemesi; secrets korunması.

### 4.6. Settings ve hooks

Önce `claude --version` ve kurulu sürümün desteklediği yapılandırmayı doğrula. `.claude/settings.json` oluştur; varsa mevcut izinleri koruyarak birleştir. Paylaşılan ayarlar burada; kişisel/gizli ayarlar Git'e girmeyen yerel yapılandırmada olsun. JSON parse başarısı ile Claude tarafından yüklenme başarısını ayrı doğrula. [Settings belgeleri](https://code.claude.com/docs/en/settings).

Bu proje için `scripts/hooks/validate-changed-files.mjs` oluştur ve destek doğrulanırsa `PostToolUse` olayında `Write|Edit` eşleşmesiyle hafif doğrulamaya bağla. Olay adı, matcher, command ve timeout alanlarını kurulu sürümün [hook referansıyla](https://code.claude.com/docs/en/hooks) kontrol et. Destek yoksa hook'u etkinmiş gibi gösterme; aynı script'i elle/CI'da çalıştır, uyumluluk engelini raporla.

Hook tasarım koşulları:

- Stdin JSON'unu güvenli oku; araç girdisinden dosya yolu çıkar, yolu proje köküne göre çöz ve kök dışını reddet/atla.
- Dosya adını shell komutuna birleştirme; süreçleri argüman dizisiyle çalıştır. Windows ve Linux yol/boşluk durumlarını test et.
- Yalnızca uygun değişen dosyayı kontrol et; her yazmada bütün build/test, container başlatma veya ağ çağrısı yapma.
- Kontrol modunda çalış; kendini tekrar tetikleyen otomatik düzenleme döngüsü oluşturma. Hook hata çıkışlarının o olay için gerçek davranışını test et; sonradan çalışan hook değişikliği geri almış sayılmaz.
- Shell üzerinden yapılan tüm değişikliklerin `Write|Edit` hook'una yakalanacağını varsayma. Faz doğrulama script'i ve CI asıl kalite kapısıdır.
- Hook içine otomatik commit, push, DB sıfırlama, volume silme, uzak script çalıştırma veya sınırsız izin ekleme.
- Eksik araç, bozuk JSON, ilgisiz dosya, boşluklu yol ve zaman aşımı için küçük fixture testleri yaz.

### 4.7. Dosya doğrulama ve Faz 0 kabul kapısı

`scripts/verify-agent-setup.mjs` manifest üzerinden gerekli dosyaları kontrol etsin: varlık, sıfırdan büyük anlamlı içerik, UTF-8, JSON/YAML parse, gerekli alanlar, benzersiz ajan/skill adları, göreli referanslar, script yolları, geçerli rule globları. Bağımlılık gerekiyorsa küçük ve açık bir geliştirme bağımlılığı seç; el yapımı eksik YAML parser yazma.

`docs/FILE-MANIFEST.md`: `yol | amaç | oluşturuldu/güncellendi | statik doğrulama | runtime keşfi | kanıt | kullanılacak faz`.

Kurulu Claude Code'un sunduğu ajan/skill/ayar inceleme arayüzleriyle gerçekten keşfedildiğini kontrol et. Yeniden yükleme/oturum gerekiyorsa bunu yap veya kullanıcı adımını açıkça belirt. Var olmayan bir CLI doğrulama bayrağı uydurma. Statik geçerli ama keşfi denenmemiş dosyayı ayrı işaretle.

**Faz 0 geçişi:** Gereksinim matrisi, başlangıç mimarisi/API/veri kararları, bu altyapı dosyaları ve statik kontroller tamamlanmış; kurulu ortamda ajan/skill/rules/settings yüklenmesi ve hook çalışması gözlenmiş olmalı. Runtime doğrulama mümkün değilse engeli ve uygulanabilir alternatifi açıkça raporla; Faz 0'ı yanlışlıkla geçti sayma. Kullanıcı alternatif çalışma biçimini kabul etmedikçe uygulama fazını başlatma.

## 5. Uygulama mimarisi ve dosya sorumlulukları

Katmanlı modüler monolit kullan. Mikroservis, otomatik generic repository, ikinci Unit of Work, gereksiz CQRS/MediatR kurma. Her ek soyutlama gerçek bir ihtiyacı çözmeli.

```text
backend/
  GeoScope.sln (veya seçilen SDK'nın desteklediği solution biçimi)
  GeoScope.Domain/             Entity ve temel domain kuralları
  GeoScope.Application/        DTO, kullanım senaryosu, port/servis arayüzü, validasyon
  GeoScope.Infrastructure/     DbContext, mapping, migration, import, PostGIS sorguları
  GeoScope.Api/                Controllers, DI, middleware, ProblemDetails, OpenAPI
  GeoScope.Tests/              Unit, integration, spatial ve API testleri
frontend/
  src/components/             Ortak UI
  src/features/map/           MapLibre lifecycle, source/layer yönetimi
  src/features/layers/        Katman görünürlüğü ve altlık
  src/features/search/        Filtre, sonuç listesi, zoom
  src/features/drawing/       Terra Draw ve kayıt düzenleme
  src/features/analysis/      Analiz formu, sonuç ve tematik harita
  src/services/               API client ve sözleşme tipleri
  src/hooks/                  Paylaşılan React davranışları
  tests/                      Bileşen ve uçtan uca testler
data/raw/                     Lisansı uygun kaynak snapshot'ları veya edinme manifesti
data/samples/                 Küçük, kaynağı belgeli gerçek demo verisi
data/test-fixtures/           Açıkça sentetik olarak etiketlenmiş test verisi
scripts/import/               Tekrarlanabilir veri edinme/import
scripts/sql/                  Veri kalite ve sorgu planı incelemeleri
.github/workflows/            Build, test, lint ve entegrasyon CI
docker-compose.yml
.env.example
.gitignore
README.md
```

Bağımlılıklar: `Domain` dış katmanlara bağımlı değil; `Application → Domain`; `Infrastructure → Application/Domain`; `Api → Application`, DI composition root için Infrastructure referansı. Frontend DB'ye bağlanamaz. Domain HTTP veya EF migration ayrıntıları taşımaz. NTS tiplerini hangi katmanda kullanacağını ADR ile netleştir; gereksiz geometri sarmalayıcısı yazma.

`Program.cs`: DI, configuration, middleware, OpenAPI, health ve CORS. `DbContext`/configurations: SRID, tip, index ve constraints. Spatial query servisleri: parametreli PostGIS sorguları. Controller: ince HTTP adaptörü; SQL/iş mantığı yığını değil. Entity'leri doğrudan dışarı dökmek yerine DTO/GeoJSON sözleşmesi kullan.

Async DB çağrıları, `CancellationToken`, yapılandırılmış log, request correlation/trace id, güvenli ProblemDetails, merkezi exception handling ve `AsNoTracking` okuma sorguları uygula. Migration ile şemayı yönet; `EnsureCreated` ile migration sistemini karıştırma.

## 6. Gerçek veri temini ve tekrarlanabilir import

Başlangıç senaryosu **Bursa ilçeleri + sağlık kuruluşları**. Bu bir proje seçimidir, PDF zorunluluğu değildir. Bursa verisi gerçekten uygun bulunamazsa eksik/uygunsuz veriyi varmış gibi kullanma; doğrulanmış başka açık kaynak veya konuya geçişi gerekçelendir.

1. İlçe Polygon/MultiPolygon ve sağlık tesisi Point kaynaklarını doğrula. Kaynağın kapsadığı tarih/bölge, lisans ve indirme erişimini kontrol et.
2. OSM kullanılacaksa Overpass/Geofabrik seçimini, sorguyu, etiket filtresini ve nesne tiplerini kaydet. İlçe sayısını ezberden sabitleme; güncel yetkili kaynakla karşılaştır. Eksikleri saklama.
3. `docs/DATA-SOURCES.md` içinde URL, lisans bağlantısı, atıf, indirme zamanı, sorgu/filtre, kaynak CRS, checksum, kapsam, kayıt sayısı, dönüşümler ve bilinen eksikleri tut.
4. OSM verisinin ODbL ve atıf koşullarını uygula; yazılım lisansı, veri lisansı ve tile hizmeti koşullarını birbirine karıştırma. [OSM lisans/atıf kaynağı](https://www.openstreetmap.org/copyright).
5. Sağlık tesisleri way/relation alanıysa nokta üretme kararını açıkça kaydet. `ST_PointOnSurface` gibi temsilî nokta gerçek giriş kapısı/tesis adresi değildir. Ham geometri ve kaynak nesne kimliğini izlenebilir bırak. Overpass `center` sonucunun bu garantiyi verdiğini varsayma.
6. `source + source_object_type + source_id` anahtarıyla tekrarları yönet; OSM node/way/relation sayısal ID'leri tek başına benzersiz varsayılmaz. Aynı tesisi farklı OSM nesnelerinin temsil etmesi için ayrıca raporlanabilir dedup politikası belirle.
7. İndirme → ham snapshot → staging → CRS dönüşümü → tip/topoloji doğrulama → normalizasyon → transaction/upsert → kalite raporu akışını script'e dönüştür.
8. Yeniden import aynı kaynak sürümünde mükerrer üretmemeli; kullanıcı sözel düzenlemelerini ezmemeli. Kaynaktan silinen kayıtların davranışını ve override yaşam döngüsünü belgeleyerek uygula.
9. Kısmi hata durumunda ana veri setini yarım bırakma. Başarısız import kaydını rollback dışında ayrı şekilde koru; işlenen/reddedilen/düzeltilen kayıt sayıları tutarlı olsun.
10. Bağımlılıkları container veya belgelenmiş ortam üzerinden sağla. Yalnızca geliştiricinin bilgisayarındaki QGIS'e bağlı manuel import teslim etme.

Sentetik veri doğruluk/performance testlerinde kullanılabilir; gerçek veri gereksinimini karşıladığı söylenemez. İnternet kesintisinde lisansı uygun küçük gerçek snapshot veya checksum'lı indirme alternatifiyle demo tekrar üretilebilir olsun. Büyük raw dosyaları ve sırları Git'e koyma.

## 7. PostgreSQL/PostGIS şeması ve veri bütünlüğü

`docs/DATABASE.md` kolon, veri tipi, null/default, PK/FK/unique/check, index ve migration kararlarını içersin. Aşağıdaki başlangıç tasarımını somutlaştır:

| Tablo | Temel alanlar ve geometri | Kritik kurallar |
|---|---|---|
| `districts` | `id`, kaynak anahtarları, `source_name`, kaynak attributes JSONB, `geom geometry(MultiPolygon,4326)`, import/zaman bilgileri | Kaynak anahtarı unique; geçerli, boş olmayan geometri; GiST |
| `health_facilities` | `id`, kaynak anahtarları, `source_name`, `facility_type`, attributes, `geom geometry(Point,4326)`, import/zaman bilgileri | Kaynak anahtarı unique; Point/4326; GiST |
| `district_overrides` | `district_id` PK/FK, düzenlenebilir ad/açıklama, `updated_at`, sürüm | Kaynak alanları korunur; yerel değişiklik dış kaynağa yazılmaz |
| `facility_overrides` | `facility_id` PK/FK, düzenlenebilir ad/açıklama, `updated_at`, sürüm | Import override'ı ezmez |
| `user_features` | `id` UUID, `name`, `description`, `geom geometry(Geometry,4326)`, `created_at`, `updated_at`, sürüm | Yalnızca Point/LineString/Polygon; boş/null ve geçersiz geometri yok; GiST |
| `import_history` | `id`, kaynak/sorgu/checksum, zamanlar, durum, sayılar ve güvenli hata özeti | Kaynak izlenebilirliği, başarısız denemeler dahil |

Override için ayrı tablo yerine eşdeğer güvenilir kolon tasarımı seçersen gerekçeyi ADR'ye yaz. Alan temizleme (`null`) ile “kaynak değerini kullan” ayrımını DTO/veri modelinde açık tanımla. İlçe atamasını saklamak zorunlu değil; saklanırsa geometri/import güncellemelerinde tutarlılığı sağla.

- `CREATE EXTENSION postgis` yönetimi ve gerekli kullanıcı yetkilerini açıkça tanımla; uygulama çalışma kullanıcısını gereksiz superuser yapma.
- Timestamp için `timestamptz` ve UTC kullan; API'de ISO 8601 sun.
- Geometri sütunları `NOT NULL`; SRID, tip, emptiness ve validity kuralları hem API hem mümkün olan DB constraints ile korunsun. Kabul edilmeyen GeometryCollection/Multi* kullanıcı girdilerini sessizce dönüştürme.
- Polygon → MultiPolygon normalizasyonu kaynak importunda açıkça uygulanabilir. `ST_MakeValid` tip/parça sayısını değiştirebilir; otomatik onarım sonrası yeniden kontrol et ve değişikliği raporla. Kullanıcı hatalı şekli sessizce değiştirilmesin.
- Bütün kalıcı geometry sütunlarına GiST; sık sorgulanan ad/tür/kaynak anahtarlarına uygun indeks. `%arama%` için normal B-tree yeterliymiş gibi davranma; gerekirse `pg_trgm` kararını ölç.
- Geography cast sorguları için geometry indeksinin otomatik yeterli olduğunu varsayma; gerçek sorguyla eşleşen expression index veya açık geography kolon stratejisini seç ve ölç.

Örnek indeks yaklaşımı; gerçek migration dosyasında üret ve kontrol et:

```sql
CREATE INDEX ix_health_facilities_geom
    ON health_facilities USING GIST (geom);
CREATE INDEX ix_health_facilities_geog
    ON health_facilities USING GIST ((geom::geography));
CREATE INDEX ix_districts_geom
    ON districts USING GIST (geom);
CREATE INDEX ix_user_features_geom
    ON user_features USING GIST (geom);
```

`ST_SRID`, `GeometryType`/`ST_GeometryType`, `ST_IsEmpty`, `ST_IsValid`, `ST_IsValidReason`, extent, unique anahtarlar ve satır sayılarıyla import sonrası rapor çıkar. `pg_indexes`/catalog ile indeksleri doğrula; `ANALYZE` sonrası temsilî sorgu planını kaydet.

## 8. CRS, GeoJSON ve geometrik doğruluk sözleşmesi

1. Kalıcı geometry verisi EPSG:4326. GeoJSON koordinatları `[longitude, latitude]` yani `[boylam, enlem]`. MapLibre'nin ekran projeksiyonu depolama CRS'sini değiştirmez.
2. RFC 7946 uyumlu Geometry/Feature/FeatureCollection kullan; çıktı içinde özel `crs` alanıyla farklı CRS taşıma. Harita yanıtları 4326 koordinatlı olsun. [GeoJSON standardı](https://www.rfc-editor.org/rfc/rfc7946).
3. API'de longitude `[-180,180]`, latitude `[-90,90]`, sonlu sayılar, 2D koordinat politikası, minimum vertex ve kapalı polygon halkalarını doğrula. Ters koordinatlar her zaman bu sınırları ihlal etmez; bilinen kontrol noktaları ve belgeli Bursa çalışma alanı kontrolüyle tespit et, otomatik tahminle düzeltme.
4. `ST_SetSRID` koordinat dönüştürmez; yalnızca bilinen CRS etiketini atar. Gerçek dönüşüm `ST_Transform` ile yapılır. Bilinmeyen kaynak CRS'ye körlemesine 4326 atama. [ST_Transform](https://postgis.net/docs/ST_Transform.html).
5. 4326 geometry üzerinde `ST_Distance`, `ST_Length`, `ST_Area`, `ST_Buffer` sonucunu metre/m² diye sunma. NTS'nin düzlemsel hesaplarının SRID atanınca otomatik jeodezik hale geldiğini varsayma.
6. Yakınlık/mesafe için `geography` spheroid tabanlı hesaplar tercih edilsin; kullanılan fonksiyon ve birim API metadata/docs içinde açık olsun. `ST_DWithin` geography mesafesi metredir. [ST_DWithin](https://postgis.net/docs/ST_DWithin.html).
7. **PDF'nin ölçüm maddesi uygun metrik SRID istiyor:** A04 için uygun yerel projeksiyonu seç ve `ST_Transform` sonrası alan/uzunluk hesapla. Bursa için EPSG:32635 (WGS 84 / UTM 35N) bir adaydır; gerçek dataset extent'i, geçerli kullanım alanı ve deformasyonu doğrulamadan kesinleştirme. Kapsam zona taşarsa alternatif yerel projeksiyon/strateji belirle. EPSG:3857'yi hassas yer ölçümü varsayılanı yapma.
8. Geography alan/uzunluk hesabını ölçümün karşılaştırma kontrolünde kullanabilirsin; yalnızca bunu yapıp PDF'deki metrik SRID beklentisini karşılandı sayma. Birim dönüşümleri: 1 km = 1000 m, 1 km² = 1.000.000 m²; görüntüleme için yuvarla, hesap verisini erkenden yuvarlama. [ST_Area](https://postgis.net/docs/ST_Area.html).
9. İçeride/sınırda semantiğini açıkça seç: nokta için `ST_Within(point, polygon)` sınırı dışlar; sınır dahil seçimde `ST_Covers(polygon, point)` kullanılabilir. `ST_Intersects` kesişim ifade eder; çizgi/poligonun tümünün içeride olmasıyla aynı değildir. Delikler ve MultiPolygon parçalarını test et. [ST_Covers](https://postgis.net/docs/ST_Covers.html).
10. Buffer görseli yaklaşık bir poligondur. `ST_Buffer(geography, meters)::geometry` yerel kullanım için değerlendirilebilir; büyük extents/projeksiyon sınırları için kısıtları test et. Yakındaki kayıt seçimini çizilmiş yaklaşık buffer yerine `ST_DWithin` ile yap; küçük sınır farkını belgeleyip toleransla test et. [ST_Buffer](https://postgis.net/docs/ST_Buffer.html).
11. 4326 geometry üzerinde `<->` derece tabanlıdır; doğru metrik en yakın sıralaması değildir. Geography `<->` küresel mesafe kullanırken spheroid mesafeyle sıralama farklılaşabilir. Küçük veri setinde kesin `ST_Distance(geography, geography)` sıralaması + `id` bağ kırıcı kullan. KNN optimizasyonu yapılırsa doğruluk garantisini kanıtla; sabit N×k aday alıp yeniden sıralamak her veri setinde kesin sonuç garantisi değildir. [KNN operatörü](https://postgis.net/docs/geometry_distance_knn.html).
12. Görüntüleme sadeleştirmesi kaynak geometriyi veya analiz doğruluğunu değiştirmesin. Orijinali sakla; topoloji koruyan sadeleştirmeyi yalnızca görüntü çıktısına uygula ve belgeleyerek test et.

## 9. REST API sözleşmesi

Endpoint adları proje kararıdır, PDF dayatması değildir. `docs/API-CONTRACT.md` ve çalışan OpenAPI aynı sözleşmeyi anlatsın. Her endpoint için method/path, request/query, schema, örnek, başarılı/hatalı durum kodu, tip/birim, limit, işlem akışı, güvenlik, test ve performans notu yaz.

### 9.1. Başlangıç endpoint seti

| Method | Yol | İşlev |
|---|---|---|
| GET | `/api/health/live` | Süreç canlılığı |
| GET | `/api/health/ready` | DB/PostGIS kullanılabilirliği; hassas bilgi içermez |
| GET | `/api/layers` | Katman kimliği/adı/tipi/görünüm kabiliyeti |
| GET | `/api/districts` | Bbox/öznitelik filtreli GeoJSON |
| GET | `/api/districts/{id}` | Tek ilçe Feature |
| PATCH | `/api/districts/{id}` | İzinli sözel override alanları |
| GET | `/api/facilities` | Bbox, ad, tür, ilçe ve sayfalama ile GeoJSON |
| GET | `/api/facilities/{id}` | Tek tesis Feature |
| PATCH | `/api/facilities/{id}` | İzinli sözel override alanları |
| GET | `/api/features` | Kullanıcı katmanı GeoJSON |
| GET | `/api/features/{id}` | Tek kullanıcı Feature |
| POST | `/api/features` | Point/LineString/Polygon oluştur |
| PATCH | `/api/features/{id}` | Sözel bilgi ve/veya geometri güncelle |
| DELETE | `/api/features/{id}` | Kullanıcı kaydını sil |
| POST | `/api/analysis/within` | Seçilen/çizilen polygon içindeki tesisler |
| POST | `/api/analysis/buffer` | Tampon geometrisi + yakındaki tesisler |
| POST | `/api/analysis/nearest` | Tıklanan noktaya en yakın N tesis |
| POST | `/api/analysis/measure` | Seçilen çizgi/poligonun metrik ölçümü |
| GET | `/api/analysis/district-stats` | İlçe başına tesis sayıları |

### 9.2. Ortak kurallar

- Koleksiyonlar GeoJSON FeatureCollection, tekil harita objeleri Feature olarak dönsün. Feature `id` stabil olsun; farklı katmanlarda çakışmayı UI'da katman+id ile yönet.
- Liste `bbox=minLon,minLat,maxLon,maxLat`, `q`, `limit`, `offset` veya belgeli cursor kabul etsin. Tutarlı sıralama ve üst limit olsun. Tarih çizgisini aşan bbox desteklenmiyorsa açıkça reddet.
- GeoJSON sayfalama bilgisi standardı bozmayan belgeli foreign member veya header ile taşınsın. Bir sayfa veriyi “bütün veri” gibi göstermeyi önle; kesilme/yükleme durumu görünür olsun.
- `POST /features`: `201 Created`, `Location` ve kaydedilen Feature; `PATCH`: `200`; `DELETE`: `204`. Liste boşsa `200` + boş FeatureCollection, bulunmayan tekil ID `404`.
- Hatalar ProblemDetails: bozuk biçim `400`, semantik/geometri hatası için belgeli `422`, çakışma `409` veya ETag yaklaşımında `412`, büyük payload `413`, limit `429`. Hata gövdesinde güvenli açıklama, alan hataları ve trace id; SQL/stack trace/sır yok.
- PATCH için DTO allowlist kullan. Alanın hiç gönderilmemesi ile `null` verilmesini ayır. Kaynak kimliği, import bilgisi, SRID ve diğer korumalı alanlar istemciden değiştirilemez.
- ETag/If-Match veya açık sürüm alanıyla kayıp güncellemeleri engelle. Geometri ve öznitelik güncellemesini atomik yap. Silmede stale selection/cache'i temizle.
- `properties.name` ve `properties.description` uzunluklarını sınırla. UI HTML'i ham olarak çalıştırmasın. Raw SQL parametreli olsun; dinamik kolon/sıralama yalnızca allowlist'ten seçilsin.
- Başlangıç koruma önerileri: liste varsayılan 250/üst 2000; N 1..100; radius >0 ve en çok 50.000 m; geometri en çok 10.000 vertex; body 2 MiB. Bunlar PDF koşulu değil, ölçümle ayarlanacak konfigürasyon değerleridir; bütün limitler API/UI/docs'ta tutarlı olsun.
- Query performansı için timeout ve cancellation; pahalı analizler için kontrollü istek hızı. Salt CORS'un yetkilendirme sağlamadığını kabul et.

### 9.3. Örnek girdi şekilleri

Aşağıdaki örnekleri nihai OpenAPI şemasına dönüştür; örnek koordinatlar gerçek tesis kaydı olarak sunulmaz.

```json
{
  "type": "Feature",
  "geometry": {"type": "Point", "coordinates": [29.06, 40.19]},
  "properties": {"name": "Deneme çizimi", "description": "Kullanıcı geometrisi"}
}
```

Analiz girdilerinde referans ve doğrudan geometriyi belirsiz karıştırma. `sourceFeature: {layerId, id}` veya `geometry` seçeneklerinden tam biri kabul edilsin; seçilen kaynak geometri sunucudan okunsun. İstemcinin aynı kaydın değiştirilmiş kopyasını otorite gibi göndermesine dayanma.

```json
{
  "sourceFeature": {"layerId": "facilities", "id": "123"},
  "radiusMeters": 2000,
  "targetLayer": "facilities",
  "excludeSource": true
}
```

Nearest: `point` GeoJSON Point, `n`, opsiyonel belgeli filtre; yanıt FeatureCollection ve her feature için `distanceMeters`/`rank`. Buffer: `buffer` Feature, `matches` FeatureCollection ve toplam/sayfalama/metrik metadata. Within: polygon referansı veya geometri, `includeBoundary`; yanıt FeatureCollection. Measure: metrik alan/uzunluk, birim ve `calculationSrid`, ayrıca seçili objeyi haritada gösterme. İstatistik: her ilçe geometrisi ve `facilityCount`.

## 10. Beş analiz için uygulama ve kabul tasarımı

Her analiz için `docs` içinde amaç, kullanıcı akışı, girdi tipi, sınır semantiği, SQL/servis, API, görselleştirme, indeks, edge case ve doğruluk toleransı tanımla.

### A01. Alan içinde kalanlar — MVP

- Kullanıcı ilçe/kayıtlı polygon seçer veya geçerli polygon çizer. Hedef sağlık tesisleridir.
- Varsayılan sınır dahil seçimi UI'da belirt; `ST_Covers(area, facility.geom)`. Sınır hariç mod varsa `ST_Within` ile ayrı test et. Tamamlanmamış çizimi analiz etme.
- Sonuç listesi, sayı, vurgulama ve fitBounds; boş sonuçta önceki sonuçları temizle.
- İçeride/dışarıda/kenarda/köşede/delikte/MultiPolygon'un ikinci parçasında test noktaları oluştur. Kaynak geometri yanlış tipteyse açıklayıcı hata ver.

### A02. Buffer / yakınlık — MVP

- Seçili objeye metre cinsinden kullanıcı mesafesi; UI birimi görünür, negatif/sıfır/üst limit dışı reddedilir.
- Başlangıçta tesis Point ve kullanıcı Point/LineString/Polygon seçimlerini destekle; desteklenen kaynak katman/tiplerini sözleşmede belirt.
- Yakındaki tesisleri `ST_DWithin(f.geom::geography, source::geography, @radiusMeters)` ile seç. Kaynak tesisin hariç tutulmasını ID bazlı yap; aynı koordinatta farklı tesisi yanlışlıkla eleme.
- Buffer geometrisini haritada ayrı geçici katmanda göster; mesafe/sonuç listesi backend kaynaklı olsun. Sil/yeniden çalıştır işlevi olsun.
- Tam eşik ve biraz iç/dış noktalar, boş sonuç, farklı geometri tipleri, limit ve görsel buffer yaklaşımı için tolerans testleri yaz.

Örnek parametreli sorgu iskeleti; parametreler string interpolation ile birleştirilmeyecek:

```sql
SELECT f.id,
       ST_Distance(f.geom::geography, @sourceGeometry::geography) AS distance_meters
FROM health_facilities AS f
WHERE ST_DWithin(f.geom::geography, @sourceGeometry::geography, @radiusMeters)
ORDER BY distance_meters, f.id;
```

### A03. En yakın N — MVP

- Harita tıklaması Point üretir; N kullanıcı tarafından seçilir. N=0/negatif/üst limit reddedilir.
- Doğru referans uygulama: filtrelenmiş bütün adaylarda spheroid `ST_Distance` sıralaması, `id` bağ kırıcı, `LIMIT @n`. Küçük veri için bu doğru ve basit yaklaşımı önce teslim et.
- Veri azsa N'den az kayıt döndür; sıfır mesafe ve eşit mesafeleri destekle. Opsiyonel maxDistance yoksa sonuç alanını sessizce sınırlama.
- Tıklanan nokta, numaralı sonuç vurguları, metre/km listesi; bağlantı çizgisi gösteriliyorsa bunun rota değil kuş uçuşu ilişki olduğunu belirt.
- KNN eklersen küre/spheroid ve derece farkı yüzünden yanlış aday eleme olmadığını referans sorguya karşı test et. İndeks iddiasını EXPLAIN ile kanıtla.

### A04. Metrik ölçüm — güçlü teslim

- Seçilen LineString için uzunluk, Polygon/MultiPolygon için alan; gerekiyorsa çevre ayrı etiketlensin. Point için alan/uzunluk 0 diye sessiz cevap yerine desteklenmeyen ölçüm mesajı ver.
- Doğrulanmış metrik SRID'ye dönüşüm sonrası `ST_Length` ve `ST_Area`. Poligon çevresi gerekiyorsa `ST_Perimeter`; `ST_Length(polygon)` ile çevre hesaplandığını varsayma.
- Sonuçta ham metre/m², kullanıcı dostu km/km², calculationSrid ve yöntem. Orijinal/seçili geometri haritada vurgulu kalsın.
- Projeksiyon kullanım alanı dışını reddet veya açık alternatif kullan. Bilinen metrik fixture ve bağımsız referans hesapla toleransı doğrula.

### A05. Mekânsal birleştirme — güçlü teslim

- İlçe başına tesis sayısı; boş ilçeleri `LEFT JOIN` ve `COUNT(f.id)` ile 0 göster. `COUNT(*)` hatasından kaçın.
- Sınırda/örtüşmede birden çok ilçeye uyan tesis için **tekil atama** seç: önce iç bölgede eşleşme, sonra belgeli deterministik ilçe ID sırası. Şüpheli/çoklu eşleşmeleri raporla. Atanamayan tesis sayısını ayrıca göster; toplamların anlamını açıkla.
- Her tesisin en çok bir ilçeye atandığı bu politikayı salt `ST_Intersects + GROUP BY` ile çifte sayım yaparak bozma. Çoklu sayım tercih edilirse politikayı ve toplam yorumunu bilinçli değiştir.
- Tablo + choropleth, lejant, sıfır sınıfı, tek ilçeye zoom ve ad/sayı popup. Renk tek bilgi taşıyıcısı olmasın.

## 11. Frontend ve MapLibre davranışları

Yerleşim: harita merkezde; sol panel katman/arama/analiz; seçili obje ayrıntı ve düzenleme alanı; mobilde katlanabilir panel. Gereksiz dashboard yerine ödev akışlarını kolaylaştır.

Temel bileşenler: `AppLayout`, `MapView`, `LayerPanel`, `SearchPanel`, `FeatureDetailsPanel`, `FeatureEditor`, `DrawingToolbar`, `AnalysisPanel`, `AnalysisResults`, `BasemapSwitcher`, `LoadingState`, `ErrorState`.

- MapLibre instance'ını ref/lifecycle ile tekil yönet; unmount'ta listener ve instance temizle. React StrictMode çift çalışmasında duplicate map/listener oluşmasın.
- Source/layer ID'leri merkezi ve stabil olsun. Veri, seçili obje, çizim ve analiz katmanlarının sorumluluklarını ayır; rendering layer ID'lerini DB katmanı kimliğiyle karıştırma.
- İki gerçek, erişilebilir, koşulları doğrulanmış altlık seç. Stil/tiles/sprite/glyph/CORS/API key ihtiyaçlarını dene; atıfları görünür tut. Demo sunucusunun sınırsız/garantili hizmet olduğunu varsayma.
- Stil değişince `style.load` sonrası uygulama source/layer/çizim altyapısını idempotent yeniden kur; görünürlük, seçim, filtre, çizim ve analiz state'ini koru. Altlık değişimini zorunlu regresyon testi yap.
- Arama/filtre API üzerinden tüm uygun veri kapsamında çalışsın; yalnızca yüklü bbox sayfasını filtreleyerek genel arama iddiasında bulunma. Sonuç vurgusu, listeden seçme ve bbox dışındaki objeye zoom çalışsın.
- `moveend`/debounce ile bbox yükleme; eski istekler için AbortController ve response yarış kontrolü. Filtre/bbox cache anahtarlarını doğru kur. Gerekirse TanStack Query kullan; global state bağımlılığını gerekçesiz ekleme.
- Pagination/limit nedeniyle haritada eksik veri varsa göster; sessiz truncation yok. UI loading, empty, error ve retry durumları birbirinden ayrı olsun.
- Popup/detayda kaynak alanlar, düzenlenebilir yerel alanlar ve kaynak atfı anlaşılır olsun; raw HTML enjeksiyonu yok.
- Harita resize davranışını panel açılıp kapanmasında doğrula. Klavye erişimi, form label'ları, odak, kontrast ve dokunma hedefleri makul olsun.
- Analiz ölçümleri backend'den alınsın. Tarayıcı önizlemesi varsa “önizleme” olarak ayrıştır; sunucu sonucu geldiğinde güncelle.

## 12. Çizim ve kalıcı CRUD akışı

Terra Draw + seçilen MapLibre adaptörünün sürümlerini erken küçük deneyle doğrula. Üç mod: Point, LineString, Polygon. Çizim başlat/bitir/düzenle/iptal; kaydetmeden önce ad/açıklama ve doğrulama.

1. Kullanıcı çizer; draft state kalıcı kayıttan ayrılır.
2. İstemci temel biçimi denetler; hatalı/eksik halkada kaydetme engellenir.
3. REST isteği gönderilir; sunucu yeniden boyut/tip/koordinat/topoloji denetler.
4. Transaction ile PostGIS'e yazılır; DB tarafından dönen stabil ID/geometry UI'a alınır.
5. Kullanıcı katmanı/cache güncellenir; sayfa yenilendiğinde kayıt korunur.
6. Kaydedilmiş geometriyi ve sözel alanları düzenleme, iptal ve silme çalışır. Silmeden önce UI onayı göster.

API başarısızlığında çizimi kaybetme veya “kaydedildi” mesajı verme. Çift gönderimi engelle; optimistic update varsa rollback uygula. Kayıtla çizim aracının geçici objesi üst üste iki kez görünmesin. Düzenleme sırasında altlık değişimini ve panel kapanmasını test et. Kaynak kayıtların sözel düzenlemesi OSM'ye geri yazılmaz; import güncellemesi yerel override'ları korur.

## 13. Güvenlik, hata yönetimi ve performans

### Güvenlik ve bütünlük

- SQL parametreleri, DTO allowlist, body/vertex/analiz limitleri, kontrollü CORS ve güvenli loglar zorunlu proje kalite kurallarıdır.
- `.env.example` çalıştırılabilir örnek değişken isimlerini içersin, gerçek sır içermesin. `.env`, kişisel settings, DB dosyaları ve gerçek erişim anahtarları Git dışında olsun.
- Kimlik doğrulama PDF zorunluluğu değildir. Yerel demo için eklemeyebilirsin; anonim yazma API'sini korumasız genel internete açma. Uzak yayın gerekirse erişim kısıtını ayrı karar olarak ele al.
- Hata halinde kullanıcı anlaşılır mesaj görsün; backend logu trace id ile izlenebilsin. DB bağlantı kesintisi, iptal ve timeout kontrollü ele alınsın.
- Import ve migration yalnızca amaçlanan DB'ye çalışsın. Gerçek kullanıcı DB'sini drop/reset etme. Test veritabanı ayrı ad/connection string ve açık kontrolle yönetilsin.

### Ölçülebilir performans

- GiST, geography expression index, bbox, tutarlı pagination, kolon projection, `AsNoTracking`, debounce ve cancellation temel önlemler.
- Bbox için 4326 `ST_MakeEnvelope` ve uygun uzamsal predicate; salt bbox adayı ile kesin geometri eşleşmesini gerektiğinde ayır.
- Büyük GeoJSON yanıtını limit/bbox ile kontrol et; gerektiğinde HTTP sıkıştırma ve görüntü sadeleştirmesi. Toplamları yalnızca dönen sayfanın sayısından hesaplama.
- `EXPLAIN (ANALYZE, BUFFERS)` sonuçlarını temsilî veri ve filtrelerle kaydet. Küçük tabloda sequential scan seçilmesini otomatik hata sayma; üretim benzeri büyüklükte indeks kullanımını incele.
- `docs/TEST-PLAN.md` içinde donanım, veri sayısı, concurrent istek, soğuk/sıcak ölçüm, p50/p95 ve payload boyutu yaz. Öneri başlangıç bütçesi: 10.000 tesis ve gerçek ilçelerle yerel ortamda liste/arama p95 <500 ms, temel analiz p95 <1 s; bunlar PDF şartı veya ölçülmüş sonuç değildir. Ortamına göre gerekçeyle ayarla, ölçmeden başarı yazma.
- Test için büyütülmüş sentetik dataset'i gerçek kaynak veriden ayrı tut. Büyük veri için vector tile ancak ölçülen ihtiyaç varsa sonraki sürüme alınsın.

## 14. Test stratejisi ve doğruluk kanıtı

Testler uygulamayla birlikte yazılır; son güne bırakılmaz. Birkaç mutlu yol testi yeterli değildir. Ancak implementation'ın aynısını tekrar eden değersiz testlerle sayıyı şişirme.

| Seviye | Araç/ortam | Amaç |
|---|---|---|
| Unit | xUnit | DTO validasyonu, iş kuralları, limit ve dönüşümler |
| Entegrasyon | Gerçek PostgreSQL/PostGIS, ayrı test DB/container | Migration, spatial translation, SQL, index ve kalıcılık |
| API | ASP.NET Core test host + gerçek DB | Status, ProblemDetails, GeoJSON, CRUD, filtre/pagination |
| Spatial | Deterministik fixture + bağımsız referans | CRS/birim, topoloji, sınır ve nearest doğruluğu |
| Frontend | Vitest/Testing Library | Form, hata/boş sonuç, state ve API davranışı |
| Uçtan uca | Playwright + gerçek servisler | Harita, çizim, altlık, CRUD ve analiz akışları |
| Kurulum | İzole temiz Compose projesi | Yeni clone, migration, import ve tekrar kurulum |

EF InMemory veya SQLite ile geçen test PostGIS entegrasyonu yerine sayılmaz. Testcontainers/Docker kullanılamıyorsa belgeli ayrı PostGIS bağlantısı kullan; hiçbiri yoksa entegrasyon durumunu engelli bırak.

### Zorunlu test listesi

- Boş DB'de migration; yeniden çalıştırma; var olan şemaya ileri migration; PostGIS extension ve GiST varlığı.
- Import iki kez çalıştığında mükerrer yok; kaynak verisi güncellenirken override ve kullanıcı çizimleri korunuyor.
- Her kaydın SRID/tipi/validity/extent'i; null/empty, yanlış tip, GeometryCollection, bozuk JSON, kapalı olmayan halka, self-intersection, aşırı vertex/body.
- Bilinen koordinatla boylam/enlem sırası; dereceyi metre sanan hatayı yakalayan mesafe fixture'ı. Sadece aynı hatalı formülü beklenen değerde tekrar etme.
- İç/dış/sınır/köşe/delik/MultiPolygon; seçilen boundary politikasının hem API hem UI'da tutarlılığı.
- Buffer eşiğinin içi/dışı/tam sınırı; sayısal tolerans ve görsel buffer yaklaşımı; 0/negatif/aşırı mesafe.
- Nearest N=0/1/üst limit, veri sayısından büyük N, eşit mesafe, aynı koordinat, boş veri ve filtre; referans tam sıralamaya karşı karşılaştırma.
- Ölçüm için bağımsız doğrulanmış uzunluk/alan, dönüşüm sonrası geri dönüş kontrolü, km ve km² dönüşümleri. Toleransı testten önce yöntemle gerekçelendir.
- İstatistikte sıfır ilçeler, sınır/örtüşme tekil atama, atanmayanlar ve toplam denetimi.
- CRUD'da kalıcılık, PATCH allowlist/null ayrımı, sürüm çakışması, silinmiş ID ve atomik hata davranışı.
- Bbox/arama/pagination'da stabil sıra, limit ve eksik gösterim; SQL injection/XSS örnek girdileri.
- Altlık değişiminde source/layer/çizim/analiz kaybolmuyor; çift event yok; eski API cevabı yeni filtre sonucunu ezmiyor.
- Her üç çizim türü create/read/update/delete; iptal ve DB hatasında draft korunuyor.
- Klavye ile temel form akışı; dar ekran ve panel resize; erişilemeyen tile servisinde anlaşılır hata.
- Temiz kurulum, DB restart sonrası kalıcılık, servis health/readiness ve ikinci import.

Gerçek MapLibre/WebGL testi için çalışan browser ortamı kullan. Headless ortam WebGL sağlayamıyorsa sahte harita mock'uyla görsel başarı iddia etme; browser/manuel doğrulamayı açık eksik olarak kaydet. Dış tile servisine bağlı test kırılganlığını kontrollü fixture ile azalt, gerçek iki altlığı ayrıca dene.

## 15. Bağımlılık sıralı yol haritası

14 iş günü, tek geliştirici için yaklaşık 5-6 odaklı saat/gün varsayımıyla **başlangıç tahminidir**, garanti değildir. Faz 0 ve veri riskleri nedeniyle önceki takvimi gerektiğinde güncelle; test süresini keserek süreyi tutturma. Her faz backend-frontend-veritabanı dikey akışını mümkün olduğunca beraber teslim etsin.

| Faz | Yaklaşık gün | İşler / somut çıktı | Geçiş kapısı |
|---|---|---|---|
| 0 — Analiz ve ajan altyapısı | 1 | Repo/PDF inceleme; matris; mimari/API/veri tasarımı; tüm Claude dosyaları ve validator | Dosyalar diskten doğrulandı; runtime keşfi ve hook testi; kritik belirsizlikler kayıtlı |
| 1 — Çalışan iskelet | 2 | Solution, frontend, Compose DB; DI/CORS/config; live/ready; UI'dan API/DB health; CI iskeleti | Build başarılı; tarayıcı→API→PostGIS akışı; belgeli başlatma |
| 2 — Gerçek veri dikey dilimi | 3-4 | Kaynak/lisans; migration/import; kalite; ilk GeoJSON endpoint ve haritada gerçek iki tip | İki gerçek tip DB'de 4326/GiST; idempotent import; ilk görünür veri |
| 3 — Katman, arama ve API | 5-6 | Layer/district/facility read; bbox/pagination; popup; arama/vurgu/zoom; iki altlık; sözel override | M01-M05 ve C01 uçtan uca; stil değişimi regresyonu |
| 4 — Çizim ve CRUD | 7-8 | Terra Draw; kullanıcı Feature API; create/edit/delete; validation/concurrency | Üç tip kalıcı, ayrı katman; refresh/import sonrası korunuyor |
| 5 — Üç MVP analizi | 9-10 | Within, buffer ve nearest API/UI; spatial doğruluk ve sorgu planı | Üç analiz gerçek PostGIS ile, harita+liste ve test kanıtı; MVP matrisi tamam |
| 6 — Güçlü teslim analizleri | 11 | Metrik SRID ölçüm; ilçe sayımı + tablo/choropleth | Ölçüm toleransı, sınır tekil atama ve sıfır ilçeler doğrulandı |
| 7 — Sağlamlaştırma | 12-13 | Regresyon, performans, hata/güvenlik, erişilebilirlik, code review | Kritik bulgu yok; CI/build/test; ölçümler ve kalan kısıtlar belgeli |
| 8 — Teslim | 14 | Docker temiz kurulum, README, veri lisansı/import, ekran görüntüsü/demo, Git teslim hazırlığı | Başka ortamda tekrar üretim; tüm kanıtlar; uzak platform durumu dürüst raporlu |

`docs/ROADMAP.md` içinde her fazı ayrıntılandır: amaç, önkoşul, bağımlılık, görev sırası, backend/frontend/database/test görevleri, dosyalar, risk/önlem, süre aralığı, kabul kriteri, demo çıktısı ve önerilen commit başlığı.

Kritik yol: **Faz 0 → DB/CRS doğrulaması → gerçek veri/import → GeoJSON/API/harita → CRUD → üç analiz → test/temiz kurulum → teslim**. Veri lisansı/erişimi, provider uyumu, Terra Draw adaptörü, altlık servis erişimi ve doğru metrik hesaplama erken denenir.

Sözleşme ve şema netleşince bağımsız UI bileşenleri, dokümantasyon ve test fixture hazırlığı paralel yapılabilir. Aynı migration, contract veya source/layer kaydına eşzamanlı ajan değişikliği yaptırma. Bir fazın engeli varken bağımsız hazırlık yapılabilir; engelli faz geçti diye işaretlenmez.

## 16. Her fazda zorunlu çalışma döngüsü

1. `CLAUDE.md`, ilgili rules/skill, requirement satırları ve `PROGRESS.md` oku.
2. Mevcut kod/test/Git durumunu denetle. Görevle ilgisiz kullanıcı değişikliğini koru.
3. Faz kapsamı, dokunulacak dosyalar ve kabul testlerini kısa belirt.
4. İlgili uzman ajanı yalnızca faydalıysa çağır; mimari değişiklikte architect, spatial kritik değişiklikte PostGIS/GIS incelemesi, teslim öncesi code-reviewer kullan.
5. Küçük çalışan dilimi uygula; sözleşme/migration/docs'u eşzamanlı güncelle.
6. Uygun build/typecheck/lint/unit/integration/E2E kontrollerini gerçekten çalıştır. Değişiklikle ilgili kontrol geçmeden kapsamı genişletme.
7. Başarısızlığı kök neden üzerinden düzelt; testi kaldırarak, tolerance'ı gerekçesiz büyüterek veya exception'ı yutarak gizleme.
8. Requirement ve faz kabul kriterlerini kanıtlarla kontrol et; review bulgularını kapat veya gerekçeli açık bırak.
9. `PROGRESS.md`, `ROADMAP.md`, manifest ve gerekli ADR'yi güncelle. Kullanıcıya kısa faz özeti ver.
10. Kapı geçtiyse bir sonraki faza otomatik ilerle; her rutin fazda gereksiz onay bekleme.

Faz raporu:

```text
Faz:
Durum: doğrulandı / devam ediyor / engelli
Karşılanan gereksinimler:
Oluşturulan/değişen dosyalar:
Çalıştırılan komutlar ve sonuç/exit code:
Veri/CRS/analiz kanıtları:
İnceleme bulguları ve çözümleri:
Çalıştırılamayan kontroller ve nedeni:
Kalan risk/engel:
Sonraki somut adım:
```

Komutları işletim sistemine ve gerçek dosya yollarına uyarla. `dotnet build/test`, `npm ci`, `npm run lint/typecheck/test/build`, E2E, `docker compose config` gibi komutların projede gerçekten tanımlı olmasını sağla. Örnek komutu başarı çıktısı yerine yazma.

Oturum kesilirse `PROGRESS.md` içinde son başarılı fazı, açık değişiklikleri, komut sonuçlarını, engelleri ve ilk sonraki adımı bırak. Yeniden başlayınca uygulamayı sıfırdan kurma; kayıtları ve gerçek Git durumunu karşılaştırarak devam et.

## 17. Docker, CI ve yeniden üretilebilir teslim

- Compose servisleri `db`, `api`, `web`; gerekirse ayrı migration/import profili veya tek seferlik job. Sabit ve uyumlu image sürümleri, healthcheck ve readiness retry olsun.
- Şema migration ile, kaynak verisi açık import komutuyla oluşturulsun. Her API açılışında tekrar indirme/import yapma. Üretim benzeri çok instance'da migration yarışını önle.
- Frontend container içinde API URL'si ile kullanıcının tarayıcıdan eriştiği URL farklıdır; internal service adı tarayıcıya sızmasın. Reverse proxy veya açık environment stratejisini test et.
- `.env.example`, backend appsettings ve frontend config tutarlı; gerçek parolalar yok. Public harita anahtarı gerekiyorsa public niteliğini ve domain restriction koşulunu açıkla.
- CI'da restore/install, build/typecheck/lint, unit + gerçek PostGIS entegrasyonu çalışsın. E2E ortamı destekleniyorsa ekle; atlanan kontrolü başarıya çevirmeden raporla.
- Temiz kurulum testi ayrı Compose project adı ve yeni test volume ile yapılır; mevcut kullanıcı volume'larını silme. Yalnızca bu testin oluşturduğu kaynakları temizle.
- `docker compose up --build` yanında migration/import için gerçekten çalışan komutları README'ye yaz. İlk açılışta veri yoksa anlaşılır durum ve belgeli import adımı olsun.

README şu başlıkları içersin: amaç/kapsam, özellikler, teknolojiler/sürümler, mimari, önkoşullar, Docker kurulumu, manuel geliştirme, environment, DB/migration, gerçek veri ve lisans/atıf, indirme/import/tekrar import, API/OpenAPI, beş analiz ve SRID/birim kararları, test komutları, ekran görüntüleri, demo, bilinen kısıtlar, varsa güvenli demo giriş bilgisi ve troubleshooting.

`docs/DELIVERY-CHECKLIST.md` GitHub/platform adresi, kaynak kod, migration, import script/dump/link, lisans, README, temiz kurulum, test kanıtları ve eksikleri izlesin. Yerel hazır ile uzakta yayımlanmış aynı durum değildir. Yetki yoksa yayımlama hariç bütün teslimi bitir; kullanıcıya hazır sonucu ve gerekli son adımı sun. Uzak URL'yi gerçekten doğrulamadan paylaşma.

## 18. Son demo senaryosu

1. Belgeli temiz kurulum ve import; Bursa gerçek verileriyle harita açılır.
2. İki veri katmanı açılıp kapatılır; iki altlık arasında geçilir; katmanlar kaybolmaz.
3. İlçe/tesise tıklanır; öznitelikler görünür. Ad/tür araması, vurgulama ve objeye zoom yapılır.
4. İçe aktarılan kaydın yerel ad/açıklaması düzenlenir; yenilemede korunur, tekrar import bunu ezmez.
5. Point, LineString ve Polygon çizilir; ayrı kullanıcı katmanına kaydedilir; düzenlenir, yenilemede görülür ve silinir.
6. Çizilen veya seçilen polygon içindeki tesisler listelenip haritada vurgulanır.
7. Seçili tesis için 2.000 m buffer çalışır; tampon ve sonuçlar görünür.
8. Haritada tıklanan noktaya en yakın beş tesis metre bilgisiyle listelenir.
9. Çizgi uzunluğu/poligon alanı uygun metrik SRID ile gösterilir; ilçe başına sayı tablosu ve choropleth incelenir.
10. Geçersiz geometri/boş sonuç/ağ hatası gibi bir hata senaryosu anlaşılır şekilde gösterilir.

Ekran görüntülerini çalışan uygulamadan al; mockup'ı gerçek ürün ekranı gibi teslim etme. Demo testleri önceki adımın görünmez durumuna bağımlı ve tekrarlanamaz olmasın.

## 19. Definition of Done ve yasaklar

Bir özellik ancak aşağıdaki koşullarla tamamdır:

- Gereksinime bağlı gerçek kod/dosya var; hedef davranış uçtan uca çalışıyor.
- API, frontend, DB ve dokümantasyon aynı sözleşmeyi kullanıyor.
- Derleme ve ilgili otomatik kontroller başarılı; gerekli görsel/manuel kontrol kaydedilmiş.
- Geometri tipi/CRS/birim/sınır doğruluğu ilgili fixture'larla kanıtlı.
- Hata, boş sonuç ve limit davranışları uygulanmış.
- Requirement matrisi, faz kaydı ve gerekli teknik karar güncel.
- Kritik doğruluk, veri kaybı veya güvenlik bulgusu açık değil.

**Yasaklar:** Sahte veriyi gerçek veri diye sunmak; dosyayı yazmadan oluşturuldu demek; test çalıştırmadan geçti demek; boş klasörü ajan kurulumu saymak; doğrulanmamış Claude settings/hook alanı uydurmak; 4326 derecelerini metre sanmak; SRID etiketini dönüşüm sanmak; KNN'yi doğrulamadan kesin metrik sıralama saymak; frontend hesabını backend analizinin yerine geçirmek; kaynak veriyi kullanıcı çizimleriyle karıştırmak; başarısız testleri gizlemek; gereksiz kapsam büyütmek.

Görevin sonunda toplam dosya/özellik listesi yerine karar vermeye yarayan kısa bir sonuç ver: karşılanan zorunlu gereksinimler, beş analizin durumu, test/kurulum kanıtı, oluşturulan Claude altyapısı ve runtime doğrulaması, gerçek veri kaynakları, çalıştırma adımları, bilinen eksikler ve uzak teslim durumu.

## 20. Geliştirici sahipliği ve AI ile çalışma sınırları

AI desteği bu projenin geliştirme sürecinin parçasıdır. Hedef, geliştiricinin anlamadığı ve yalnızca teslim ettiği bir çıktı değil; kararlarını verebildiği, kodunu açıklayabildiği, hatasını araştırabildiği ve bakımını yapabildiği bir projedir. Genel geçer şablon hissini gerçek proje kararları, sade uygulama ve doğrulanmış kullanıcı deneyimiyle azalt. “Tamamen insan tarafından yazılmıştır” gibi doğrulanmamış iddia üretme; değerlendirme sürecinin AI kullanımına ilişkin kuralı varsa ona uy, sorulursa katkıyı doğru anlat.

### 20.1. Sorumluluk paylaşımı

| Alan | AI'nin işi | Geliştiricinin işi / gerçek katkı kanıtı |
|---|---|---|
| Senaryo ve kapsam | Bursa veri seçeneklerini araştır, uygulanabilir alternatifleri karşılaştır | Hedef kullanıcıyı, temel kullanım senaryosunu ve teslim önceliklerini seç; gerekçesini kendi sözleriyle belirt |
| Mimari ve teknoloji | En fazla iki makul yaklaşımın maliyetini ve riskini açıkla, öneri hazırla | Seçimi incele; neden katmanlı monolit, neden bu paketler sorularını yanıtlayabilsin |
| Veri ve CBS | Kaynak/lisans raporu, import ve kalite kontrollerini hazırla | Haritada farklı bölgelerden temsilî kayıtları kaynakla karşılaştır; isim, konum ve kapsam sorunlarını not et |
| Arayüz | İşleyen ilk tasarımı ve kullanılabilir alternatifleri uygula | Panel düzeni, bilgi önceliği, Türkçe metinler ve demo akışına ilişkin somut geri bildirim ver |
| Kritik kod | Çözümü, testleri ve açıklamayı hazırla | En az bir analiz sorgusunu ve bir CRUD akışını okuyup açıklasın; küçük davranış değişikliğini bizzat uygulayıp test etsin |
| Kabul ve teslim | Otomatik testleri çalıştır, bulguları ve demo kontrol listesini hazırla | Uygulamayı kendisi açıp temel akışı denesin; kalan kısıtları kabul etsin ve demoyu kendi anlatımıyla gerçekleştirsin |

Geliştiricinin uygulayacağı küçük değişiklik göstermelik olmasın: örneğin analiz sınır davranışını mevcut seçenekler üzerinden değiştirmek, yeni bir tesis türü filtresi eklemek veya bir validasyon hatasını iyileştirip ilgili testi güncellemek. Seçenekleri beceri seviyesine göre sun; geliştiriciye ayrılan işi onun yerine tamamlayıp insan katkısı olarak kaydetme. Gerekirse açıklama ve incelemeyle destekle.

### 20.2. Üç anlamlı geliştirici kontrol noktası

Bu bölüm, önceki otomatik ilerleme talimatının yalnızca aşağıdaki kararlar bakımından istisnasıdır. Her dosya veya faz için onay isteme. Önceden verilmiş kullanıcı kararını tekrar sorma.

1. **Kapsam/mimari kontrolü — Faz 0 sonunda:** Çalışır taslak belgeleri hazırla; senaryo, veri seçimi ve başlıca mimari kararları kısa seçeneklerle geliştiriciye sun. Karar beklerken bağımsız ortam ve doğrulama hazırlıklarını yap; cevabı varsayarak “geliştirici onayladı” yazma.
2. **Ürün ve kod kontrolü — Faz 4 sonunda:** Çalışan harita/CRUD akışını geliştiricinin denemesini iste. UI geri bildirimini al; geliştiricinin bizzat yapacağı küçük değişikliği birlikte seç. Beklerken bağımsız analiz fixture'ları ve test altyapısını hazırla. İnsan katkısı adımı bekliyor diye yapılan teknik işleri tamamlanmamış gibi gösterme; durumları ayrı izle.
3. **Son kabul — Faz 8 sonunda:** Önce bütün otomatik doğrulamaları ve teslim paketini tamamla. Geliştirici manuel demo, teknik açıklama ve teslim kapsamını gözden geçirsin. Bu kontrol yapılmadan “geliştirici tarafından kabul edildi” veya “manuel test geçti” yazma.

`docs/DEVELOPER-REVIEW.md` oluştur. Her kontrol için yalnızca gerçek kayıt tut: karar/bulgu, geliştiricinin sağladığı gerekçe veya geri bildirim, ilgili değişiklik, test sonucu ve durum. Henüz yanıt alınmadıysa `geliştirici incelemesi bekliyor` yaz. Geliştirici adına görüş, çalışma süresi veya test sonucu uydurma. Bu dosyayı manifest ve teslim kontrol listesine ekle.

### 20.3. Projeye özgü ve ölçülü çıktı

- Yorumları yalnızca neden, birim, sınır davranışı veya beklenmeyen karar açıklamak için yaz. Her satırı tekrar eden yorumlar ve aynı açıklamanın birçok belgede kopyası olmasın.
- README gerçek kurulum, gerçek kararlar, gerçek ekranlar ve bilinen sınırlara odaklansın. Ölçülmemiş performans iddiaları, “kusursuz”, “enterprise-ready”, “production-ready” gibi dayanıksız sıfatlar kullanma.
- UI metinleri ve demo Bursa senaryosuna uygun olsun; ilgisiz dashboard kartları, işlevsiz butonlar ve genel şablon içeriği bırakma.
- Ajan ve süreç dosyalarını kısa, görev odaklı tut; yapılandırma dosyalarının sayısını yazılım kalitesinin kanıtı olarak sunma. Ürün davranışını açıklamayan geliştirme ayrıntılarını kullanıcı arayüzüne taşıma.
- AI izini gizlemek için kodu kasıtlı bozma, yapay hata ekleme, sahte commit geçmişi/tarih/yazar üretme veya zorunlu atıfları silme. Commit'ler gerçek çalışma adımlarını anlatsın; araçların eklediği gerekli provenance bilgilerini yanıltıcı biçimde değiştirme.
- Geliştiricinin önceki kod stili varsa inceleyip tutarlılık sağla; olmayan bir kişisel üslubu varmış gibi taklit etme. İsimlendirme, bileşen sınırları ve hata yönetimi projede tutarlı olsun.

### 20.4. Teknik sahiplik kontrolü

Teslim öncesinde geliştiricinin aşağıdaki soruları kod üzerinde gösterebilmesine yardımcı ol. Kısa açıklama yap, ardından kendi sözleriyle anlatmasını veya küçük örnek üzerinde uygulamasını iste; yanıt vermediği halde öğrenmiş sayma.

- Veriyi neden 4326 saklıyoruz; metre hesabını nerede ve nasıl yapıyoruz?
- `ST_SetSRID` ile `ST_Transform` arasındaki fark nedir?
- Polygon sınırındaki tesis seçime ve ilçe sayımına nasıl giriyor?
- Nearest sorgusunun sıralaması neden doğru; indeks hangi sorguyu hızlandırıyor?
- Yeni bir çizim tarayıcıdan DB'ye hangi dosya ve katmanlardan geçiyor?
- Import neden tekrarlı kayıt üretmiyor ve kullanıcı düzenlemesini neden ezmiyor?
- Altlık değişiminde katmanlar nasıl korunuyor?
- Bir testi bozup hatanın sebebini nasıl bulur; yeni bir filtreyi nasıl ekleriz?

Amaç değerlendiricinin AI kullanımı hakkında ne düşüneceğini garanti etmek değil, geliştiricinin gerçek teknik katkısını ve projeye hâkimiyetini ortaya koymaktır. AI kullanımıyla ilgili açıklama istenirse yalnızca gerçekleşen görev paylaşımına dayanarak kısa ve doğru bir açıklama hazırla.

### 20.5. Kurulu yardımcı araçlar ve token disiplini

GeoScope klasöründe `docs/AI-TOOLS.md` varsa gerçek kurulum durumunu buradan oku ve gerektiğinde yeniden doğrula. Context7, C#/TypeScript LSP, Playwright CLI ve Graphify bu çalışma için seçildi. Kurulu olmak, bağlantı veya uygulama testinin tamamlandığı anlamına gelmez.

- Context7 yalnızca yeni paket/sürüm veya belirsiz API için dar kapsamlı kullanılsın. Kimlik doğrulama gerekiyorsa kullanıcıya bildir; resmî belgelerle bağımsız işleri sürdür.
- LSP ile sembol/referans/diagnostics kontrolü yap; build ve testleri ayrıca çalıştır.
- Playwright CLI ile çalışan frontend'i dene; kararlı akışları kalıcı Playwright testlerine dönüştür.
- Graphify isteğe bağlıdır; skill'in `disable-model-invocation: true` ayarını koru. Boş projede graf oluşturma. Kod oluştuktan sonra geliştiricinin /graphify isteğiyle code-only analiz ve küçük sorgular kullan. Otomatik her-okumada hook, sürekli watch veya her-değişiklikte rebuild ekleme. EXTRACTED/INFERRED sonuçlarını gerçek kaynakla doğrula.
- Büyük ham veri, GeoJSON, dump, node_modules, bin/obj, çıktılar ve logları topluca bağlama alma. Token tasarrufunu ölçmeden yüzdeyle iddia etme.
- Master prompt ilk analiz içindir; her küçük görevde yeniden okunmaz ve CLAUDE.md içine kopyalanmaz. Kısa durum kaydı ve ilgili faz/skill kullanılır. Her görevde bütün ajanları başlatma.
- Kurulu proje skill'lerini Faz 0 sırasında koru; aynı işlevi ikinci bir paketle tekrar kurma. Mevcut kullanıcı ayarlarını ezme.

## 21. Şimdi başla

Önce çalışma dizinini ve mevcut projeyi incele; PDF'yi oku. Gereksinimleri ve başlangıç mimarisini belgele. Faz 0'daki `CLAUDE.md`, agents, skills, rules, settings/hook script'leri, dokümantasyon ve doğrulayıcıları **gerçek dosyalar olarak oluştur**. Diskten tekrar okuyup statik ve runtime kontrollerini yap; dosya manifestini raporla. Bölüm 20'deki geliştirici kontrol noktalarını çalışma planına ekle. Teknik kapı ve ilgili geliştirici kararı tamamlandığında Faz 1'den başlayarak roadmap'i uygula. Sadece plan sunarak veya kullanıcıdan her rutin fazda “devam” bekleyerek durma.

Teknik seçimlerin güncelliğini uygulama tarihinde ilgili resmî belgelerle yeniden kontrol et. Bu belgedeki resmî bağlantılar sürüm keşfinin başlangıcıdır; kurulu sürümün davranışının yerine geçmez. Verilen kaynak linklerini, veri lisanslarını, komutları ve kabul kanıtlarını proje belgelerinde koru.

## 22. Token Ekonomisi ve Kesintisiz Yürütme Kuralları (Öncelikli)

1. **Bağlam (Context) Koruması:** Faz 0'da `CLAUDE.md`, `.claude/**` altındaki yapılandırmalar, doğrulama scriptleri ve `docs/REQUIREMENTS.md` + `docs/PROGRESS.md` dosyalarını oluştur. Diğer `docs/*.md` dosyalarını (DATABASE, API-CONTRACT, TEST-PLAN vb.) Faz 0'da topluca yazıp context penceresini doldurma; her birini ilgili uygulama fazına başlarken oluştur ve güncelle.
2. **Sadece Özet Okuma:** Ham veri dosyalarını (`data/raw/**`, `*.geojson`, `*.sql`) asla Read aracıyla tamamen okuma; şema/örnek kontrolü için yalnızca `head -n 25` veya `jq` kullan.
3. **Faz 0 Geçiş Kilidi:** `verify-agent-setup.mjs` ve `validate-changed-files.mjs` scriptlerinin CLI üzerinden hatasız çalışması Faz 0 kapısı için yeterlidir. Oturum yeniden başlatma gerektiren runtime hook keşfi nedeniyle Faz 1'e geçişi durdurma. Bursa + Sağlık Tesisleri senaryosu ve Katmanlı Monolit mimarisi geliştirici tarafından onaylanmıştır; Faz 0 sonunda onay beklemek için durma, doğrudan Faz 1'e geç. İlk geliştirici kontrol noktasını Faz 4 sonunda uygula.
