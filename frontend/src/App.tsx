import { AppLayout } from './components/AppLayout'
import { SystemStatus } from './features/health/SystemStatus'
import { LayerSummary } from './features/layers/LayerSummary'
import { MapView } from './features/map/MapView'
import { useSourceLayers } from './features/map/useSourceLayers'

export default function App() {
  const { state, retry } = useSourceLayers()
  return (
    <AppLayout
      sidePanel={
        <>
          <LayerSummary state={state} onRetry={retry} />
          <SystemStatus />
        </>
      }
    >
      <MapView layers={state} />
    </AppLayout>
  )
}
