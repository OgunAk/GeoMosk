/**
 * Harici WMS raster katmanı (PDF §5, opsiyonel). Tarayıcı karoları doğrudan servisten ister; backend'den geçmez.
 *
 * Seçim (2026-11-05, ADR-0015): Avrupa Çevre Ajansı (EEA) Copernicus CORINE Arazi Örtüsü 2018.
 * - GetCapabilities: AccessConstraints "No Limitation", Fees "No Condition Apply"; EPSG:3857 destekleniyor; katman 12 = raster.
 * - Tarayıcıdan CORS ile 200 + image/png doğrulandı; Bursa kapsamda.
 * - TUCBS (tucbs-public-api.csb.gov.tr) denendi: API ağ geçidi GetCapabilities ve GetMap'i 500 "Policy Falsified" ile reddetti
 *   (kayıt/izin gerektiriyor olmalı), bu yüzden kullanılmadı.
 * MapLibre her karo için {bbox-epsg-3857} yer tutucusunu EPSG:3857 kutusuyla doldurur (WMS 1.1.1: SRS + x,y eksen sırası).
 */
export const WMS_LAYER = {
  label: 'Arazi örtüsü — CORINE 2018 (WMS)',
  serviceUrl: 'https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer',
  layerName: '12',
  opacity: 0.6,
  attribution:
    '© European Union, Copernicus Land Monitoring Service 2018, European Environment Agency (EEA)',
} as const

export function wmsTileUrl(): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: WMS_LAYER.layerName,
    STYLES: '',
    SRS: 'EPSG:3857',
    WIDTH: '256',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
  })
  // Yer tutucu kodlanmamalı; MapLibre süslü parantezli metni arar.
  return `${WMS_LAYER.serviceUrl}?${params.toString()}&BBOX={bbox-epsg-3857}`
}
