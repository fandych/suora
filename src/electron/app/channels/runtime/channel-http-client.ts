import { requestHttp } from "@/electron/infrastructure/http-client"

export type HttpRequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  timeoutMs?: number
  signal?: AbortSignal
}

export type HttpResponse = {
  status: number
  headers: Record<string, string | string[] | undefined>
  text: string
  data: unknown
}

export { requestHttp }
