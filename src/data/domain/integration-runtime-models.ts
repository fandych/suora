export type IntegrationExecutionResult = {
  ok: boolean
  status: number
  body: string
  request?: { url: string; method: string; headers: Record<string, string>; body: string | null }
  response?: { status: number; headers: Record<string, string | string[]>; body: string; json?: unknown }
}
