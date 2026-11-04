import { describe, expect, it } from 'vitest'
import type { DistrictStatsRow } from '../../services/analysis'
import { ZERO_COLOR, choroplethClasses, classLabel, colorByDistrict } from './choropleth'

const rows = (counts: number[]): DistrictStatsRow[] => counts.map((c, i) => ({ id: i + 1, name: `İlçe ${i + 1}`, facilityCount: c, multiMatchCount: 0 }))

describe('choroplethClasses', () => {
  it('sıfırı ayrı sınıf yapar; diğer sınıflar boşluksuz, örtüşmesiz ve tüm ilçeleri kapsar', () => {
    const data = rows([0, 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 300, 12, 7])
    const classes = choroplethClasses(data)
    expect(classes[0]).toMatchObject({ min: 0, max: 0, color: ZERO_COLOR, districts: 2 })
    expect(classes).toHaveLength(5)
    for (let i = 2; i < classes.length; i++) expect(classes[i].min).toBeGreaterThan(classes[i - 1].max)
    expect(classes.reduce((sum, c) => sum + c.districts, 0)).toBe(data.length)
    expect(new Set(classes.map((c) => c.color)).size).toBe(classes.length)
  })

  it('aynı değer iki sınıfa bölünmez; az farklı değerde sınıf sayısı düşer', () => {
    const classes = choroplethClasses(rows([4, 4, 4, 4, 9]))
    expect(classes.map(classLabel)).toEqual(['4', '9'])
    expect(classes.map((c) => c.districts)).toEqual([4, 1])
  })

  it('hepsi sıfırsa yalnız sıfır sınıfı; boş listede sınıf yok', () => {
    expect(choroplethClasses(rows([0, 0]))).toEqual([{ min: 0, max: 0, color: ZERO_COLOR, districts: 2 }])
    expect(choroplethClasses([])).toEqual([])
  })

  it('her ilçe kendi sınıfının rengini alır', () => {
    const data = rows([0, 10, 20])
    const classes = choroplethClasses(data)
    const colors = colorByDistrict(data, classes)
    expect(colors[1]).toBe(ZERO_COLOR)
    expect(colors[2]).toBe(classes.find((c) => c.min <= 10 && c.max >= 10)!.color)
    expect(colors[3]).not.toBe(colors[2])
  })
})
