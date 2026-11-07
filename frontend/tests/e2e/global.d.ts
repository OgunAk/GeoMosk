import type { Map } from 'maplibre-gl'

// Uygulamadaki tanımın (src/features/map/MapView.tsx) e2e derlemesi için eşi.
declare global {
  interface Window {
    __geomoskMap?: Map
  }
}

export {}
