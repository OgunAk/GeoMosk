import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import {
  GEOMETRY_LABELS,
  MAX_VERTICES,
  USER_DESCRIPTION_MAX,
  USER_NAME_MAX,
  createUserFeature,
  vertexCount,
  type UserFeature,
  type UserGeometry,
} from '../../services/userFeatures'

interface CreateFeatureFormProps {
  geometry: UserGeometry
  onSaved: (feature: UserFeature, etag: string) => void
  onCancel: () => void
}

/**
 * Tamamlanan çizimin adı/açıklaması ve kaydı. Kayıt başarısız olursa taslak ve form korunur;
 * "kaydedildi" yalnızca sunucu 201 döndüğünde gösterilir. Çift gönderim düğme kilidiyle engellenir.
 */
export function CreateFeatureForm({ geometry, onSaved, onCancel }: CreateFeatureFormProps) {
  const ids = { name: useId(), description: useId() }
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vertices = vertexCount(geometry)
  const tooManyVertices = vertices > MAX_VERTICES

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !name.trim() || tooManyVertices) return
    setSaving(true)
    setError(null)
    try {
      const { data, etag } = await createUserFeature(geometry, name.trim(), description.trim() || null)
      onSaved(data, etag ?? '"0"')
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'Kaydedilemedi; bağlantıyı kontrol edin. Çiziminiz korunuyor.')
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="create-title" className="rounded-lg border border-pink-300 bg-white p-4 text-sm">
      <h2 id="create-title" className="font-semibold text-slate-900">
        Yeni {GEOMETRY_LABELS[geometry.type].toLocaleLowerCase('tr')} kaydet
      </h2>
      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <div>
          <label htmlFor={ids.name} className="block text-xs font-medium text-slate-700">
            Ad (zorunlu)
          </label>
          <input
            id={ids.name}
            value={name}
            required
            maxLength={USER_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
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
        <p className="text-xs text-slate-500">
          {GEOMETRY_LABELS[geometry.type]}, {vertices} köşe
        </p>
        {tooManyVertices && <p className="text-red-700">En çok {MAX_VERTICES} köşe kaydedilebilir.</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim() || tooManyVertices}
            className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
            Vazgeç
          </button>
        </div>
      </form>
    </section>
  )
}
