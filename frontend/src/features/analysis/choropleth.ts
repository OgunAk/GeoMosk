import type { DistrictStatsRow } from '../../services/analysis'

export interface ChoroplethClass {
  /** Dahil alt ve üst sınır (tesis sayısı). */
  min: number
  max: number
  color: string
  /** Bu sınıftaki ilçe sayısı (lejantta gösterilir). */
  districts: number
}

/** Sıfır sınıfı ayrı ve nötr; diğerleri açıktan koyuya sıralı (renk körlüğüne dayanıklı tek ton ailesi). */
export const ZERO_COLOR = '#e2e8f0'
const PALETTES: Record<number, string[]> = {
  1: ['#f97316'],
  2: ['#fbbf24', '#c2410c'],
  3: ['#fde68a', '#f97316', '#9a3412'],
  4: ['#fde68a', '#fbbf24', '#ea580c', '#9a3412'],
}

/**
 * Sınıflar: 0 ayrı sınıf; sıfırdan büyük değerler eşit sayıda ilçeye bölünür (kuantil, en çok 4 sınıf).
 * Aynı değer iki sınıfa bölünmez; sınıflar boşluksuz ve örtüşmesiz artan sırada.
 */
export function choroplethClasses(rows: DistrictStatsRow[]): ChoroplethClass[] {
  const classes: ChoroplethClass[] = []
  const zero = rows.filter((r) => r.facilityCount === 0).length
  if (zero > 0) classes.push({ min: 0, max: 0, color: ZERO_COLOR, districts: zero })

  const values = rows.map((r) => r.facilityCount).filter((v) => v > 0).sort((a, b) => a - b)
  if (values.length === 0) return classes
  const count = Math.min(4, new Set(values).size)
  const palette = PALETTES[count]
  let start = 0
  for (let c = 0; c < count && start < values.length; c++) {
    let end = c === count - 1 ? values.length - 1 : Math.ceil(((c + 1) * values.length) / count) - 1
    // Aynı değeri taşıyan ilçeler aynı sınıfta kalır.
    while (end + 1 < values.length && values[end + 1] === values[end]) end++
    classes.push({ min: values[start], max: values[end], color: palette[c], districts: end - start + 1 })
    start = end + 1
  }
  return classes
}

/** İlçe id → renk eşlemesi (MapLibre match ifadesi için). */
export function colorByDistrict(rows: DistrictStatsRow[], classes: ChoroplethClass[]): Record<number, string> {
  const result: Record<number, string> = {}
  for (const r of rows) {
    const cls = classes.find((c) => r.facilityCount >= c.min && r.facilityCount <= c.max)
    if (cls) result[r.id] = cls.color
  }
  return result
}

export function classLabel(c: ChoroplethClass): string {
  return c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`
}
