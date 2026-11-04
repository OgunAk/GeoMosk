import { useId, useMemo, useState } from 'react'
import { ApiError } from '../../services/apiClient'
import { fetchDistrictStats, type DistrictStatsResponse } from '../../services/analysis'
import type { FacilityType } from '../../services/sourceLayers'
import { FACILITY_LABELS } from '../map/mapStyle'
import { choroplethClasses, classLabel, type ChoroplethClass } from './choropleth'

interface DistrictStatsPanelProps {
  stats: DistrictStatsResponse | null
  selectedDistrictId: number | null
  onStats: (stats: DistrictStatsResponse | null) => void
  onSelectDistrict: (id: number) => void
}

/** A05: ilçe başına tesis sayısı (tekil atama) — tablo + haritada choropleth. Sayım backend'de (PostGIS). */
export function DistrictStatsPanel({ stats, selectedDistrictId, onStats, onSelectDistrict }: DistrictStatsPanelProps) {
  const typeId = useId()
  const [type, setType] = useState<FacilityType | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const classes = useMemo(() => (stats ? choroplethClasses(stats.districts) : []), [stats])
  const rows = useMemo(
    () => (stats ? [...stats.districts].sort((a, b) => b.facilityCount - a.facilityCount || a.name.localeCompare(b.name, 'tr')) : []),
    [stats],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      onStats(await fetchDistrictStats(type))
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'İlçe istatistiği alınamadı; bağlantıyı kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="district-stats-title" className="min-w-0 rounded-lg border border-orange-200 bg-white p-4 text-sm">
      <h2 id="district-stats-title" className="font-semibold text-slate-900">
        İlçe başına tesis sayısı
      </h2>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="min-w-0">
          <label htmlFor={typeId} className="block text-xs text-slate-600">
            Tesis türü
          </label>
          <select
            id={typeId}
            value={type}
            onChange={(e) => setType(e.target.value as FacilityType | '')}
            className="w-full min-w-0 truncate rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Tümü</option>
            {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((t) => (
              <option key={t} value={t}>
                {FACILITY_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded bg-orange-600 px-3 py-1 text-white hover:bg-orange-700 disabled:opacity-50">
          {loading ? 'Hesaplanıyor…' : stats ? 'Yenile' : 'Hesapla'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}

      {stats && (
        <div className="mt-3 border-t border-slate-200 pt-2" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-slate-800">
              {stats.facilityType ? FACILITY_LABELS[stats.facilityType] : 'Tüm tesisler'}: {stats.totals.assigned} ilçeye atandı
            </p>
            <button type="button" onClick={() => onStats(null)} className="shrink-0 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
              Kapat
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Toplam {stats.totals.facilities} tesis; atanamayan (hiçbir ilçe sınırı içinde değil) {stats.totals.unassigned}; sınırda kalıp tek ilçeye
            atanan {stats.totals.multiMatch}.
          </p>
          <Legend classes={classes} />
          <table className="mt-2 w-full table-fixed" aria-label="İlçe başına tesis sayısı">
            <thead>
              <tr className="text-left text-xs text-slate-600">
                <th className="font-normal">İlçe</th>
                <th className="w-16 text-right font-normal">Tesis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} aria-selected={r.id === selectedDistrictId} className={r.id === selectedDistrictId ? 'bg-orange-50' : undefined}>
                  <td className="truncate">
                    <button type="button" onClick={() => onSelectDistrict(r.id)} className="w-full truncate rounded px-1 text-left hover:bg-slate-100">
                      {r.name}
                    </button>
                  </td>
                  <td className="text-right tabular-nums">{r.facilityCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">{stats.policy}</p>
        </div>
      )}
    </section>
  )
}

function Legend({ classes }: { classes: ChoroplethClass[] }) {
  return (
    <ul aria-label="Harita lejantı" className="mt-2 space-y-0.5">
      {classes.map((c) => (
        <li key={c.min} className="flex items-center gap-2 text-xs">
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border border-slate-400" style={{ backgroundColor: c.color }} />
          <span className="tabular-nums">{classLabel(c)} tesis</span>
          <span className="text-slate-500">({c.districts} ilçe)</span>
        </li>
      ))}
    </ul>
  )
}
