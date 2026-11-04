import type { ReactNode } from 'react'

interface AppLayoutProps {
  sidePanel: ReactNode
  children: ReactNode
}

export function AppLayout({ sidePanel, children }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">GeoScope</h1>
        <p className="text-xs text-slate-600">Bursa ilçeleri ve sağlık tesisleri</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-slate-200 p-4 md:w-80 md:border-r">
          {sidePanel}
        </aside>
        {/* Harita mutlak konumla main'i doldurur; mobil (dikey) yerleşimde en az 60vh. */}
        <main className="relative min-h-[60vh] flex-1 md:min-h-0">{children}</main>
      </div>
    </div>
  )
}
