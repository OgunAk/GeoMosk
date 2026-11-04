import { useEffect, useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import {
  GEOMETRY_LABELS,
  USER_DESCRIPTION_MAX,
  USER_NAME_MAX,
  deleteUserFeature,
  fetchUserFeature,
  patchUserFeature,
  type UserFeature,
  type UserGeometry,
} from '../../services/userFeatures'

interface UserFeaturePanelProps {
  id: string
  /** Geometri düzenlemesi sırasında güncel taslak (harita tarafından iletilir). */
  draftGeometry: UserGeometry | null
  onStartGeometryEdit: (geometry: UserGeometry) => void
  onEndGeometryEdit: () => void
  onChanged: () => void
  onDeleted: () => void
  onClose: () => void
  onZoom: (geometry: UserGeometry) => void
}

type Loaded = { feature: UserFeature; etag: string }
type Mode = 'view' | 'edit-text' | 'edit-geometry' | 'confirm-delete'

/** Kullanıcı çizimi ayrıntısı: ad/açıklama ve geometri düzenleme, onaylı silme (C02-C04). */
export function UserFeaturePanel(props: UserFeaturePanelProps) {
  const { id, draftGeometry, onStartGeometryEdit, onEndGeometryEdit, onChanged, onDeleted, onClose, onZoom } = props
  const [loaded, setLoaded] = useState<{ id: string; value: Loaded } | null>(null)
  const [loadError, setLoadError] = useState<{ id: string; message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [mode, setMode] = useState<Mode>('view')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'conflict'; text: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchUserFeature(id, controller.signal)
      .then(({ data, etag }) => setLoaded({ id, value: { feature: data, etag: etag ?? '"0"' } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError({ id, message: error instanceof ApiError && error.status === 404 ? 'Çizim bulunamadı (silinmiş olabilir).' : 'Çizim yüklenemedi.' })
      })
    return () => controller.abort()
  }, [id, attempt])

  const current = loaded?.id === id ? loaded.value : null
  const failed = loadError?.id === id && !current ? loadError.message : null

  function reload() {
    setMessage(null)
    setMode('view')
    onEndGeometryEdit()
    setAttempt((n) => n + 1)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        setMessage({ kind: 'conflict', text: 'Çizim siz düzenlerken değişti; değişiklik uygulanmadı.' })
      } else {
        setMessage({ kind: 'error', text: error instanceof ApiError ? error.userMessage : 'İşlem tamamlanamadı; bağlantıyı kontrol edin.' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function savePatch(patch: Parameters<typeof patchUserFeature>[1]) {
    if (!current) return
    await run(async () => {
      const { data, etag } = await patchUserFeature(id, patch, current.etag)
      setLoaded({ id, value: { feature: data, etag: etag ?? current.etag } })
      setMode('view')
      onEndGeometryEdit()
      onChanged()
    })
  }

  async function remove() {
    if (!current) return
    await run(async () => {
      await deleteUserFeature(id, current.etag)
      onDeleted()
    })
  }

  return (
    <section aria-labelledby="user-feature-title" className="rounded-lg border border-pink-300 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 id="user-feature-title" className="font-semibold text-slate-900">
          {current?.feature.properties.name ?? 'Kullanıcı çizimi'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Seçimi kapat" disabled={busy} className="rounded px-1 text-slate-500 hover:bg-slate-100">
          ✕
        </button>
      </div>

      {!current && !failed && <p className="mt-2 text-slate-600">Yükleniyor…</p>}
      {failed && (
        <div className="mt-2">
          <p className="text-red-700">{failed}</p>
          <button type="button" onClick={reload} className="mt-1 underline">
            Tekrar dene
          </button>
        </div>
      )}

      {current && (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-slate-600">Katman</dt>
            <dd>Kullanıcı çizimleri</dd>
            <dt className="text-slate-600">Tür</dt>
            <dd>{GEOMETRY_LABELS[current.feature.geometry.type]}</dd>
            <dt className="text-slate-600">Açıklama</dt>
            <dd className="whitespace-pre-wrap">{current.feature.properties.description ?? '—'}</dd>
            <dt className="text-slate-600">Güncellendi</dt>
            <dd>{new Date(current.feature.properties.updatedAt).toLocaleString('tr-TR')}</dd>
          </dl>

          {mode === 'view' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode('edit-text')} className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800">
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('edit-geometry')
                  onStartGeometryEdit(current.feature.geometry)
                }}
                className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
              >
                Geometriyi düzenle
              </button>
              <button type="button" onClick={() => onZoom(current.feature.geometry)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                Yakınlaştır
              </button>
              <button type="button" onClick={() => setMode('confirm-delete')} className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50">
                Sil
              </button>
            </div>
          )}

          {mode === 'edit-text' && (
            <TextEditor
              feature={current.feature}
              busy={busy}
              onSave={(patch) => void savePatch(patch)}
              onCancel={() => {
                setMessage(null)
                setMode('view')
              }}
            />
          )}

          {mode === 'edit-geometry' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-600">
                Haritada köşeleri sürükleyin; ara noktalardan yeni köşe ekleyin. Kaydedene kadar değişiklik yalnızca taslaktır.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !draftGeometry}
                  onClick={() => draftGeometry && void savePatch({ geometry: draftGeometry })}
                  className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {busy ? 'Kaydediliyor…' : 'Geometriyi kaydet'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMessage(null)
                    setMode('view')
                    onEndGeometryEdit()
                  }}
                  className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {mode === 'confirm-delete' && (
            <div role="alertdialog" aria-labelledby="delete-question" className="mt-3 rounded bg-red-50 p-2">
              <p id="delete-question" className="text-red-900">
                "{current.feature.properties.name}" kalıcı olarak silinsin mi?
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void remove()} className="rounded bg-red-700 px-3 py-1 text-white hover:bg-red-800 disabled:opacity-50">
                  {busy ? 'Siliniyor…' : 'Evet, sil'}
                </button>
                <button type="button" disabled={busy} onClick={() => setMode('view')} className="rounded border border-slate-300 px-3 py-1 hover:bg-white">
                  Hayır
                </button>
              </div>
            </div>
          )}

          {message && (
            <div role="alert" className={`mt-2 rounded px-2 py-1 ${message.kind === 'conflict' ? 'bg-amber-50 text-amber-900' : 'text-red-700'}`}>
              {message.text}
              {message.kind === 'conflict' && (
                <button type="button" onClick={reload} className="ml-2 underline">
                  Güncel kaydı yükle
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function TextEditor({
  feature,
  busy,
  onSave,
  onCancel,
}: {
  feature: UserFeature
  busy: boolean
  onSave: (patch: { name?: string; description?: string | null }) => void
  onCancel: () => void
}) {
  const ids = { name: useId(), description: useId() }
  const [name, setName] = useState(feature.properties.name)
  const [description, setDescription] = useState(feature.properties.description ?? '')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    const patch: { name?: string; description?: string | null } = {}
    if (name.trim() !== feature.properties.name) patch.name = name.trim()
    if (description.trim() !== (feature.properties.description ?? '')) patch.description = description.trim() || null
    if (Object.keys(patch).length === 0) return onCancel()
    onSave(patch)
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2" aria-label="Çizim bilgilerini düzenle">
      <div>
        <label htmlFor={ids.name} className="block text-xs font-medium text-slate-700">
          Ad
        </label>
        <input id={ids.name} value={name} maxLength={USER_NAME_MAX} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
        {!name.trim() && <p className="text-xs text-red-700">Ad boş olamaz.</p>}
      </div>
      <div>
        <label htmlFor={ids.description} className="block text-xs font-medium text-slate-700">
          Açıklama
        </label>
        <textarea
          id={ids.description}
          value={description}
          rows={2}
          maxLength={USER_DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !name.trim()} className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50">
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
          Vazgeç
        </button>
      </div>
    </form>
  )
}
