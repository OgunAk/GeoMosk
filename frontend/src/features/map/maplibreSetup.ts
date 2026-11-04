import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre 6 worker'ı ana modülün yanında arar; Vite paketlediğinde dosya orada olmadığından (404)
// worker'ı ayrı asset olarak yayımlayıp adresini açıkça veriyoruz. Harita oluşturulmadan önce çalışmalı.
setWorkerUrl(workerUrl)
