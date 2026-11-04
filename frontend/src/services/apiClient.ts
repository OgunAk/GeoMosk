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

  /** ProblemDetails "errors" alanındaki ilk mesaj veya başlık; kullanıcıya gösterilebilir metin. */
  get userMessage(): string {
    const body = this.body as { title?: string; detail?: string; errors?: Record<string, string[]> } | null
    const firstError = body?.errors ? Object.values(body.errors).flat()[0] : undefined
    return firstError ?? body?.detail ?? body?.title ?? this.message
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

export interface JsonResponse<T> {
  data: T
  etag: string | null
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<JsonResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json, application/geo+json', ...init.headers },
  })
  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, body, `İstek başarısız (${response.status})`)
  }
  return { data: body as T, etag: response.headers.get('ETag') }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await requestJson<T>(path, { signal })).data
}
