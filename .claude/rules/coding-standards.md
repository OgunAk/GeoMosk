---
paths:
  - "backend/**/*.cs"
  - "backend/**/*.csproj"
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
  - "scripts/**/*.mjs"
---

# Kodlama standartları

## Genel
- Kod tanımlayıcıları İngilizce, kullanıcı arayüzü ve belgeler Türkçe.
- Yorumlar yalnızca neden, birim, sınır davranışı veya beklenmeyen karar için. Satırı tekrar eden yorum yazılmaz.
- Hata yutulmaz; anlamlı mesajla yukarı taşınır veya ProblemDetails'e dönüşür.
- Sihirli sayı yerine adlandırılmış sabit/konfigürasyon (limitler: liste 250/2000, N 1..100, radius ≤50.000 m, ≤10.000 vertex, body ≤2 MiB).

## C# / ASP.NET Core
- `Nullable` etkin, `TreatWarningsAsErrors` en azından Domain/Application'da hedeflenir.
- Tüm DB çağrıları async ve `CancellationToken` alır; okuma sorgularında `AsNoTracking`.
- Raw SQL yalnızca parametreli (`FromSql` interpolasyonu parametreleştirir; `FromSqlRaw` + string birleştirme yasak). Dinamik kolon/sıralama allowlist'ten.
- Yapılandırılmış log (`ILogger` mesaj şablonu); kişisel veri ve sır loglanmaz.
- Dosya kapsamlı namespace, `sealed` varsayılanı sınıflarda gerektiğinde, record DTO'lar.

## TypeScript / React
- `strict` TypeScript; `any` yerine sözleşme tipleri (`src/services/`).
- Bileşen başına tek sorumluluk; harita lifecycle'ı hook içinde (`src/features/map/`).
- Raw HTML render (`dangerouslySetInnerHTML`, popup `setHTML` ile kullanıcı verisi) yasak; `setDOMContent`/text kullan.
- Ağ istekleri `AbortController` destekli; hata/boş/yükleniyor durumları ayrı.

## Node script'leri (`scripts/`)
- ESM (`.mjs`), yalnızca Node yerleşik modülleri + kök `package.json` devDependency'leri.
- Alt süreç `execFile`/`spawn` + argüman dizisi; shell string birleştirme yok.
- Yollar `path.resolve` ile proje köküne göre; kök dışı reddedilir.
