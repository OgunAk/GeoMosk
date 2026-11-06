import type { ReactNode } from 'react'

interface AppLayoutProps {
  sidePanel: ReactNode
  children: ReactNode
}

export function AppLayout({ sidePanel, children }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">GeoMosk</h1>
        <p className="text-xs text-slate-600">Bursa ilçeleri ve sağlık tesisleri</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Dar ekranda panel en çok %40 yükseklikte kendi içinde kayar; harita kalan alanı doldurur ve sayfa kaydırması gerekmez. */}
        <aside
          aria-label="Araçlar ve bilgiler"
          className="max-h-[40vh] w-full shrink-0 space-y-4 overflow-y-auto border-b border-slate-200 p-4 md:max-h-none md:w-80 md:border-r md:border-b-0"
        >
          {sidePanel}
        </aside>
        {/* Harita mutlak konumla main'i doldurur. */}
        <main className="relative min-h-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
