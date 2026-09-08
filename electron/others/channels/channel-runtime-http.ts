import { requestHttp } from "@electron/ipc/common/http-client"

export async function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) {
  return requestHttp(url, options)
}
