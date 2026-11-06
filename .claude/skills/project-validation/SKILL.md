---
name: project-validation
description: GeoMosk faz kabul kapısı ve teslim doğrulaması (--phase 0..8 veya --full → komutlar → kanıt → requirement matrisi → geçiş/engel kararı). Bir fazı bitirmeden, PROGRESS.md'yi güncellemeden veya "doğrulandı" demeden önce kullan.
---

# project-validation

## Girdi
Faz numarası (0-8) veya tam teslim; `docs/PROGRESS.md`, `docs/REQUIREMENTS.md`.

## İş akışı
1. **Komut:** `node scripts/validate-project.mjs --phase <N>` veya `node scripts/validate-project.mjs --full`. Kısa yol: `npm run validate -- --phase <N>`.
2. **Ne yapar:** Faz için gerekli dosyaların varlığını, tanımlı komutları (build/test/lint) gerçekten çalıştırarak exit code'larını, requirement matrisi kurallarını (kanıtsız `doğrulandı` yok) kontrol eder. Faz 0'da ayrıca `node scripts/verify-agent-setup.mjs` ve `npm run test:hooks` çalışır.
3. **Kanıt:** Script çıktısındaki her kontrolün sonucu ve exit code'u PROGRESS.md faz raporuna yazılır. Çalışmayan kontrol "geçti" sayılmaz.
4. **Matris:** İlgili REQUIREMENTS satırlarının `Durum` ve `Kanıt/dosya` sütunlarını güncelle. Kanıt yoksa `devam ediyor` veya `engelli`.
5. **Karar:** Tüm zorunlu kontroller geçtiyse faz `doğrulandı`; dış engel (Docker kapalı, ağ yok) varsa `engelli` + uygulanabilir alternatif.

## Çıkış kodları
- `0`: fazın zorunlu kontrolleri geçti.
- `1`: en az bir kontrol başarısız.
- `3`: faz henüz uygulanmadığı için kontrol edilemedi (gerekli dosya/komut yok).

## Faz raporu biçimi
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

## Hata yolları
Script'in kendisi hata verirse (ör. `yaml` eksik → `npm install`) bunu düzelt; kontrolü atlayıp fazı geçmiş sayma.

## Tamamlanma ölçütü
Script exit code 0, PROGRESS.md ve REQUIREMENTS.md güncel, kalan riskler kayıtlı.
