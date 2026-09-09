import { requestHttp, type HttpRequestOptions } from "@electron/ipc/common/http-client"

export async function httpRequest(url: string, options: HttpRequestOptions = {}) {
  return requestHttp(url, options)
}
