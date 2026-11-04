import { useState } from 'react'
import type { SourceFeatureDetail } from '../../services/sourceLayers'
import type { Selection } from '../map/MapView'
import { FACILITY_LABELS } from '../map/mapStyle'
import { displayName } from '../search/displayName'
import { FeatureEditor } from './FeatureEditor'
import type { DetailState } from './useFeatureDetail'

interface FeatureDetailsPanelProps {
  selection: Selection
  state: DetailState
  onClose: () => void
  onReload: () => void
  onZoom: () => void
  onSaved: (feature: SourceFeatureDetail, etag: string) => void
}

/** Seçili objenin öznitelikleri (M03). Tüm metinler düz metin olarak render edilir (HTML çalıştırılmaz). */
export function FeatureDetailsPanel({ selection, state, onClose, onReload, onZoom, onSaved }: FeatureDetailsPanelProps) {
  const [editing, setEditing] = useState(false)

  return (
    <section aria-labelledby="details-title" className="rounded-lg border border-blue-200 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 id="details-title" className="font-semibold text-slate-900">
          {state.kind === 'loaded' ? displayName(state.feature.properties) : 'Seçili kayıt'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Seçimi kapat" className="rounded px-1 text-slate-500 hover:bg-slate-100">
          ✕
        </button>
      </div>

      {state.kind === 'loading' && <p className="mt-2 text-slate-600">Yükleniyor…</p>}
      {state.kind === 'error' && (
        <div className="mt-2">
          <p className="text-red-700">{state.message}</p>
          <button type="button" onClick={onReload} className="mt-1 underline">
            Tekrar dene
          </button>
        </div>
      )}
      {state.kind === 'loaded' && (
        <Details
          key={state.etag}
          selection={selection}
          feature={state.feature}
          etag={state.etag}
          editing={editing}
          setEditing={setEditing}
          onReload={onReload}
          onZoom={onZoom}
          onSaved={(f, e) => {
            setEditing(false)
            onSaved(f, e)
          }}
        />
      )}
    </section>
  )
}

function Details({
  selection,
  feature,
  etag,
  editing,
  setEditing,
  onReload,
  onZoom,
  onSaved,
}: {
  selection: Selection
  feature: SourceFeatureDetail
  etag: string
  editing: boolean
  setEditing: (v: boolean) => void
  onReload: () => void
  onZoom: () => void
  onSaved: (feature: SourceFeatureDetail, etag: string) => void
}) {
  const p = feature.properties
  const tags = Object.entries(p.tags).filter(([k]) => !k.startsWith('name:'))
  return (
    <>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-600">Katman</dt>
        <dd>{p.layer === 'facilities' ? 'Sağlık tesisi' : 'İlçe'}</dd>
        {p.layer === 'facilities' && (
          <>
            <dt className="text-slate-600">Tür</dt>
            <dd>{FACILITY_LABELS[p.facilityType]}</dd>
            <dt className="text-slate-600">İlçe</dt>
            <dd>{p.districtName ?? 'Belirlenemedi'}</dd>
          </>
        )}
        {p.name !== p.sourceName && (
          <>
            <dt className="text-slate-600">Kaynak adı</dt>
            <dd>{p.sourceName ?? '(yok)'}</dd>
          </>
        )}
        <dt className="text-slate-600">Açıklama</dt>
        <dd className="whitespace-pre-wrap">{p.description ?? '—'}</dd>
      </dl>
      {p.layer === 'facilities' && p.representativePoint && (
        <p className="mt-2 text-xs text-slate-600">
          Not: Bu tesis kaynakta alan olarak çizilmiş; haritadaki nokta alanın içinde seçilmiş temsilî bir noktadır, giriş kapısı değildir.
        </p>
      )}

      {editing ? (
        <FeatureEditor
          layer={selection.layer}
          feature={feature}
          etag={etag}
          onSaved={onSaved}
          onReload={() => {
            setEditing(false)
            onReload()
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800">
            Düzenle
          </button>
          <button type="button" onClick={onZoom} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
            Yakınlaştır
          </button>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-slate-700">Kaynak öznitelikleri ({tags.length})</summary>
        <dl className="mt-1 grid max-h-48 grid-cols-[auto_1fr] gap-x-3 overflow-y-auto text-xs">
          {tags.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="mt-2 text-xs text-slate-500">
        Kaynak:{' '}
        <a href={p.osmUrl} target="_blank" rel="noreferrer noopener" className="underline">
          OpenStreetMap {p.osmType}/{p.osmId}
        </a>{' '}
        (© OpenStreetMap katkıcıları, ODbL). Yerel düzenlemeler OSM'ye gönderilmez.
      </p>
    </>
  )
}
