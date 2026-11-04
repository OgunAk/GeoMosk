import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  patchFeature,
  type OverridePatch,
  type SourceFeatureDetail,
  type SourceLayerId,
} from '../../services/sourceLayers'

interface FeatureEditorProps {
  layer: SourceLayerId
  feature: SourceFeatureDetail
  etag: string
  onSaved: (feature: SourceFeatureDetail, etag: string) => void
  onReload: () => void
  onCancel: () => void
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string } | { kind: 'conflict' }

/**
 * Yerel ad/açıklama düzenleme (C01). Kaynak (OSM) verisi değişmez; import bu düzenlemeyi ezmez.
 * Kayıp güncellemeye karşı If-Match gönderilir; 412'de kullanıcı güncel kaydı yükler.
 */
export function FeatureEditor({ layer, feature, etag, onSaved, onReload, onCancel }: FeatureEditorProps) {
  const ids = { name: useId(), description: useId() }
  const props = feature.properties
  const hasLocalName = props.name !== props.sourceName
  const [name, setName] = useState(props.name ?? '')
  const [description, setDescription] = useState(props.description ?? '')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const nameMax = NAME_MAX[layer]
  const trimmedName = name.trim()
  const nameError = trimmedName.length === 0 ? 'Ad boş olamaz; kaynak adına dönmek için aşağıdaki düğmeyi kullanın.' : null

  async function submit(patch: OverridePatch) {
    setStatus({ kind: 'saving' })
    try {
      const { data, etag: newEtag } = await patchFeature(layer, Number(feature.id), patch, etag)
      onSaved(data, newEtag ?? etag)
      setStatus({ kind: 'idle' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) setStatus({ kind: 'conflict' })
      else setStatus({ kind: 'error', message: error instanceof ApiError ? error.userMessage : 'Kaydedilemedi; bağlantıyı kontrol edin.' })
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (nameError || status.kind === 'saving') return
    const patch: OverridePatch = {}
    if (trimmedName !== (props.name ?? '')) patch.name = trimmedName
    if (description.trim() !== (props.description ?? '')) patch.description = description.trim() || null
    if (Object.keys(patch).length === 0) return onCancel()
    void submit(patch)
  }

  const saving = status.kind === 'saving'
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2" aria-label="Yerel bilgileri düzenle">
      <div>
        <label htmlFor={ids.name} className="block text-xs font-medium text-slate-700">
          Ad (yerel)
        </label>
        <input
          id={ids.name}
          value={name}
          maxLength={nameMax}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? `${ids.name}-err` : undefined}
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
        {nameError && (
          <p id={`${ids.name}-err`} className="text-xs text-red-700">
            {nameError}
          </p>
        )}
        <p className="text-xs text-slate-500">Kaynak adı: {props.sourceName ?? '(yok)'}</p>
      </div>
      <div>
        <label htmlFor={ids.description} className="block text-xs font-medium text-slate-700">
          Açıklama
        </label>
        <textarea
          id={ids.description}
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="text-red-700">
          {status.message}
        </p>
      )}
      {status.kind === 'conflict' && (
        <div role="alert" className="rounded bg-amber-50 px-2 py-1 text-amber-900">
          Kayıt siz düzenlerken değişti; değişiklikleriniz kaydedilmedi.
          <button type="button" onClick={onReload} className="ml-2 underline">
            Güncel kaydı yükle
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || nameError !== null}
          className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
          Vazgeç
        </button>
        {hasLocalName && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit({ name: null })}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          >
            Kaynak adına dön
          </button>
        )}
      </div>
    </form>
  )
}
