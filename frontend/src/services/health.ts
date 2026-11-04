import { ApiError, getJson } from './apiClient'

// Sözleşme: backend/GeoScope.Api/Health/HealthResponseWriter.cs
export type HealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy'

export interface HealthCheckEntry {
  name: string
  status: HealthStatus
  description: string | null
  data: Record<string, unknown>
}

export interface HealthReport {
  status: HealthStatus
  checks: HealthCheckEntry[]
}

/** 503 de geçerli bir health yanıtıdır; gövdesini rapor olarak döndürür. */
export async function fetchHealth(kind: 'live' | 'ready', signal?: AbortSignal): Promise<HealthReport> {
  try {
    return await getJson<HealthReport>(`/api/health/${kind}`, signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && isHealthReport(error.body)) {
      return error.body
    }
    throw error
  }
}

function isHealthReport(value: unknown): value is HealthReport {
  return typeof value === 'object' && value !== null && 'status' in value && 'checks' in value
}
