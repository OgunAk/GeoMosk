import type { DrawMode, DrawRequest } from './useTerraDraw'

interface DrawingToolbarProps {
  draw: DrawRequest
  disabled: boolean
  onStart: (mode: DrawMode) => void
  /** Açık çizgi/alan çizimini bitirir (sağ tıklama ve Enter ile aynı). */
  onFinish: () => void
  onCancel: () => void
}

const MODES: { mode: DrawMode; label: string; hint: string }[] = [
  { mode: 'point', label: 'Nokta', hint: 'Haritada bir konuma tıklayın.' },
  {
    mode: 'linestring',
    label: 'Çizgi',
    hint: 'Köşeler için sol tıklayın; en az 2 köşeden sonra bitirmek için sağ tıklayın.',
  },
  {
    mode: 'polygon',
    label: 'Alan',
    hint: 'Köşeler için sol tıklayın; en az 3 köşeden sonra bitirmek için sağ tıklayın. Alan otomatik kapanır.',
  },
]

/** Yeni çizim başlatma (C02). Escape tuşu çizimi iptal eder. */
export function DrawingToolbar({ draw, disabled, onStart, onFinish, onCancel }: DrawingToolbarProps) {
  const active = draw.kind === 'draw' ? draw.mode : null
  const hint = MODES.find((m) => m.mode === active)?.hint
  const canFinish = active === 'linestring' || active === 'polygon'
  return (
    <section aria-labelledby="drawing-title" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 id="drawing-title" className="font-semibold text-slate-900">
        Çizim
      </h2>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Çizim türü">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            aria-pressed={active === mode}
            onClick={() => onStart(mode)}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50 aria-pressed:border-pink-600 aria-pressed:bg-pink-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {label}
          </button>
        ))}
      </div>
      {draw.kind !== 'off' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {canFinish && (
            <button type="button" onClick={onFinish} className="rounded bg-pink-700 px-3 py-1 text-white hover:bg-pink-800">
              Çizimi bitir
            </button>
          )}
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
            Çizimi iptal et
          </button>
        </div>
      )}
      {hint && (
        <p className="mt-2 text-xs text-slate-600" aria-live="polite">
          {hint}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">Çizimler kaynak verisinden ayrı "Kullanıcı çizimleri" katmanında saklanır.</p>
      <p className="mt-1 text-xs text-slate-500">Çizgi ve alan çizimini bitirmek için haritada sağ tıklayın.</p>
    </section>
  )
}
