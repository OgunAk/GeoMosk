import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, type HealthReport } from '../../services/health'

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; ready: HealthReport }

export function SystemStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth('ready', controller.signal)
      .then((ready) => setState({ kind: 'loaded', ready }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('Sistem durumu alınamadı', error)
          setState({ kind: 'error' })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setState({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return (
    <section aria-labelledby="system-status-title" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 id="system-status-title" className="text-sm font-semibold text-slate-900">
        Sistem durumu
      </h2>
      <div className="mt-2 text-sm" aria-live="polite">
        {state.kind === 'loading' && <p className="text-slate-600">Kontrol ediliyor…</p>}
        {state.kind === 'error' && (
          <div>
            <p className="text-red-700">API'ye ulaşılamıyor.</p>
            <RetryButton onClick={retry} />
          </div>
        )}
        {state.kind === 'loaded' && <ReadyDetails report={state.ready} onRetry={retry} />}
      </div>
    </section>
  )
}

function ReadyDetails({ report, onRetry }: { report: HealthReport; onRetry: () => void }) {
  const postgis = report.checks.find((c) => c.name === 'postgis')
  const version = typeof postgis?.data.postgisVersion === 'string' ? postgis.data.postgisVersion : null

  if (report.status === 'Healthy') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-600">API</dt>
        <dd className="text-green-800">Çalışıyor</dd>
        <dt className="text-slate-600">Veritabanı</dt>
        <dd className="text-green-800">Hazır{version ? ` (PostGIS ${version})` : ''}</dd>
      </dl>
    )
  }
  return (
    <div>
      <p className="text-slate-800">API çalışıyor.</p>
      <p className="text-red-700">Veritabanı hazır değil: {postgis?.description ?? 'bilinmeyen durum'}</p>
      <RetryButton onClick={onRetry} />
    </div>
  )
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded border border-slate-300 px-3 py-1 text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      Tekrar dene
    </button>
  )
}
