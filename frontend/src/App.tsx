import { AppLayout } from './components/AppLayout'
import { SystemStatus } from './features/health/SystemStatus'

export default function App() {
  return (
    <AppLayout sidePanel={<SystemStatus />}>
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">
        Harita, gerçek veri içe aktarıldıktan sonra bu alanda gösterilecek.
      </div>
    </AppLayout>
  )
}
