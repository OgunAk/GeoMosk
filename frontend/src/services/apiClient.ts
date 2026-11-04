// API tabanı boşsa istekler aynı origin'e gider (Vite proxy veya nginx reverse proxy).
// Container içi servis adları (ör. http://api:8080) tarayıcıya verilmez.
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, body, `İstek başarısız (${response.status})`)
  }
  return body as T
}
