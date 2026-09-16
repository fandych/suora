import { requestHttp, type HttpRequestOptions } from "@/electron/app/channels/runtime/channel-http-client"

export async function httpRequest(url: string, options: HttpRequestOptions = {}) {
  return requestHttp(url, options)
}
