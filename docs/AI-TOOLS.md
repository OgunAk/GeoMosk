# GeoMosk AI araçları — kurulum kaydı

Tarih: 4 Kasım 2026. Proje: `C:\Users\OG\Desktop\GeoMosk`.

## Kurulum ve doğrulama

| Araç | Sürüm / kapsam | Durum |
|---|---|---|
| Claude Code | 2.1.318 | Mevcut kurulum doğrulandı |
| Context7 plugin | fa4eb54397ee, kullanıcı kapsamı | Kurulu ve etkin; servis kimlik doğrulaması bekliyor |
| C# LSP plugin | 1.0.0, kullanıcı kapsamı | Kurulu ve etkin |
| csharp-ls | 0.28.0, kullanıcı aracı | Çalıştırılabildi; sürüm doğrulandı |
| TypeScript LSP plugin | 1.0.0, kullanıcı kapsamı | Kurulu ve etkin |
| TypeScript language server | 6.0.3 | Çalıştırılabildi; sürüm doğrulandı |
| TypeScript | 7.0.2, global yardımcı araç | Uygulamanın yerel package.json sürüm seçimi değildir |
| Playwright CLI | 0.1.23 | Proje skill'i kurulu; ayrı Chrome oturumunda açma/evaluate/kapatma başarılı |
| Graphify | graphifyy 0.9.102 | Projede kullanılmadı; proje skill'i 2026-11-08'de kaldırıldı |

Uygulama kodu henüz yok: LSP'nin gerçek GeoMosk dosyalarında Claude içinden diagnostics vermesi, uygulama E2E ve gerçek repo grafı doğrulanmadı. Kurulum durumu bu kontrollerin yerine geçmez.

## İlk kullanım

1. Açık Claude Code oturumunu kapatıp yeni terminal aç.
2. `cd C:\Users\OG\Desktop\GeoMosk` ardından `claude` çalıştır.
3. `/plugin` ile Context7, csharp-lsp ve typescript-lsp durumunu kontrol et.
4. `/mcp` içinde Context7'yi seç; giriş/kimlik doğrulama akışını tarayıcıda kendin tamamla. Sonra bağlantıyı yeniden kontrol et.
5. `GEOMOSK_MASTER_PROMPT.md` ve önceki konuşmanın ödev PDF'si (`ODEV_WEB_CBS.pdf`) proje klasörüne kopyalandı. Master promptu ve PDF'yi okuyup Faz 0'ı uygulamasını iste.

## Düşük maliyetli kullanım

- Context7 yalnızca belirsiz API, sürüm veya kurulum ayrıntısında; sorgu sürüme ve soruya özel olsun.
- LSP sembol/referans bulmak için; derleme ve test ayrıca yapılır.
- Playwright frontend oluşunca kullanılır. Geometri/mesafe doğruluğu PostGIS testleriyle ölçülür.
- Master promptu her görevde tekrar okuma; kısa CLAUDE.md, ilgili faz ve PROGRESS.md kullan.
- Superpowers ve Serena kurulmadı; mevcut görev akışı ve araçlarla gereksiz örtüşmeyi önlüyoruz.

## Kaynaklar

- [Claude Code LSP](https://code.claude.com/docs/en/plugins/code-intelligence)
- [Context7](https://github.com/upstash/context7)
- [Playwright CLI](https://github.com/microsoft/playwright-cli)
- [Graphify](https://github.com/Graphify-Labs/graphify)

Graphify paket adı resmî pyproject.toml ve PyPI üzerinden doğrulandı: `graphifyy` (çift y); komut adı `graphify`. İlk otomatik kurulum denetimi ad farkı nedeniyle reddetti; resmî kaynaklarla kimlik doğrulandıktan sonra sabit sürüm kurulumu onaylandı ve tamamlandı.
