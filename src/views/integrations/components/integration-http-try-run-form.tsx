import { useMemo, useRef } from "react"
import { CopyIcon, FileUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { HttpEndpointParameter, HttpIntegrationConfig } from "@/data/domain/models"
import { buildHttpEndpointUrl, getSelectedHttpEndpoint } from "@/lib/integration-http"

type HttpTryRunFormProps = {
  config: HttpIntegrationConfig
  input: string
  onChangeInput: (value: string) => void
}

type InputValues = Record<string, unknown>

type UploadedFile = {
  __suoraFile: true
  name: string
  type: string
  size: number
  dataBase64: string
}

function readInputValues(input: string): InputValues {
  try {
    const value = JSON.parse(input) as unknown
    return value && typeof value === "object" && !Array.isArray(value) ? value as InputValues : {}
  } catch {
    return {}
  }
}

function displayValue(value: unknown) {
  if (value === undefined) return ""
  return typeof value === "string" ? value : JSON.stringify(value)
}

function coerceValue(value: string, type: string) {
  if (type === "number") return Number(value) || 0
  if (type === "boolean") return value === "true"
  if (type === "array" || type === "object") {
    try { return JSON.parse(value) } catch { return type === "array" ? [] : {} }
  }
  return value
}

function toBase64(buffer: ArrayBuffer) {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  return btoa(binary)
}

function curlQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function buildCurlPreview(config: HttpIntegrationConfig, values: InputValues) {
  const endpoint = getSelectedHttpEndpoint(config)
  if (!endpoint) return "curl"
  let url = buildHttpEndpointUrl(config.baseUrl, endpoint.path)
  for (const parameter of endpoint.parameters.filter((item) => item.in === "path")) url = url.replaceAll(`{${parameter.name}}`, encodeURIComponent(String(values[parameter.name] ?? parameter.defaultValue ?? ""))).replaceAll(`:${parameter.name}`, encodeURIComponent(String(values[parameter.name] ?? parameter.defaultValue ?? "")))
  const query = new URLSearchParams()
  try { Object.entries(JSON.parse(endpoint.queryJson) as Record<string, unknown>).forEach(([key, value]) => query.set(key, String(value))) } catch { /* invalid defaults are validated on save */ }
  endpoint.parameters.filter((item) => item.in === "query").forEach((parameter) => query.set(parameter.name, String(values[parameter.name] ?? parameter.defaultValue ?? "")))
  const queryText = query.toString()
  if (queryText) url += `${url.includes("?") ? "&" : "?"}${queryText}`
  const parts = ["curl", "-X", endpoint.method, curlQuote(url)]
  try { Object.entries(JSON.parse(endpoint.headersJson) as Record<string, unknown>).forEach(([key, value]) => parts.push("-H", curlQuote(`${key}: ${String(value)}`))) } catch { /* invalid defaults are validated on save */ }
  if (config.authType !== "none") parts.push("-H", curlQuote("Authorization: [configured secret]"))
  for (const parameter of endpoint.parameters.filter((item) => item.in === "header")) parts.push("-H", curlQuote(`${parameter.name}: ${String(values[parameter.name] ?? parameter.defaultValue ?? "")}`))
  const bodyParameters = endpoint.parameters.filter((item) => item.in === "json" || item.in === "form-data")
  const canSendBody = !["GET", "HEAD"].includes(endpoint.method.toUpperCase())
  if (canSendBody && endpoint.bodyMode === "json") {
    const body = Object.fromEntries(bodyParameters.filter((item) => item.in === "json").map((item) => [item.name, values[item.name] ?? item.defaultValue ?? ""]))
    parts.push("-H", curlQuote("Content-Type: application/json"), "--data", curlQuote(JSON.stringify(body)))
  }
  if (canSendBody && (endpoint.bodyMode === "form-data" || endpoint.bodyMode === "x-www-form-urlencoded")) {
    for (const parameter of bodyParameters.filter((item) => item.in === "form-data")) {
      const value = values[parameter.name]
      const file = value && typeof value === "object" && "__suoraFile" in value ? value as UploadedFile : null
      parts.push(endpoint.bodyMode === "form-data" ? "-F" : "--data-urlencode", curlQuote(file ? `${parameter.name}=@${file.name}` : `${parameter.name}=${String(value ?? parameter.defaultValue ?? "")}`))
    }
  }
  return parts.join(" ")
}

export function IntegrationHttpTryRunForm({ config, input, onChangeInput }: HttpTryRunFormProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const endpoint = getSelectedHttpEndpoint(config)
  const values = readInputValues(input)
  const curlPreview = useMemo(() => buildCurlPreview(config, values), [config, values])
  if (!endpoint) return null

  const updateValue = (parameter: HttpEndpointParameter, value: unknown) => onChangeInput(JSON.stringify({ ...values, [parameter.name]: value }, null, 2))
  const uploadFile = async (parameter: HttpEndpointParameter, file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return
    updateValue(parameter, { __suoraFile: true, name: file.name, type: file.type, size: file.size, dataBase64: toBase64(await file.arrayBuffer()) } satisfies UploadedFile)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-muted/20 p-3 text-sm"><div className="font-medium">{endpoint.method} {endpoint.path}</div><div className="mt-1 text-xs text-muted-foreground">Fill values for the selected REST operation. Required fields are marked in the endpoint definition.</div></div>
      {endpoint.parameters.length ? endpoint.parameters.map((parameter) => {
        const fileValue = values[parameter.name] as UploadedFile | undefined
        return <div key={parameter.id} className="flex flex-col gap-2"><div><div className="text-sm font-medium">{parameter.name}{parameter.required ? " *" : ""}</div><div className="text-xs text-muted-foreground">{parameter.in} · {parameter.type}{parameter.description ? ` · ${parameter.description}` : ""}</div></div>{parameter.type === "file" ? <div className="flex items-center gap-2"><input ref={(element) => { fileInputRefs.current[parameter.id] = element }} className="hidden" type="file" onChange={(event) => void uploadFile(parameter, event.target.files?.[0])} /><Button size="sm" variant="outline" onClick={() => fileInputRefs.current[parameter.id]?.click()}><FileUpIcon />Choose file</Button><span className="truncate text-xs text-muted-foreground">{fileValue?.name ?? "No file selected (10 MB limit)"}</span></div> : parameter.type === "boolean" ? <NativeSelect value={String(values[parameter.name] ?? parameter.defaultValue ?? false)} onChange={(event) => updateValue(parameter, coerceValue(event.target.value, parameter.type))}><NativeSelectOption value="false">false</NativeSelectOption><NativeSelectOption value="true">true</NativeSelectOption></NativeSelect> : <Input type={parameter.type === "number" ? "number" : "text"} value={displayValue(values[parameter.name] ?? parameter.defaultValue)} placeholder={parameter.type === "array" || parameter.type === "object" ? `Valid JSON ${parameter.type}` : parameter.type} onChange={(event) => updateValue(parameter, coerceValue(event.target.value, parameter.type))} />}</div>
      }) : <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">This endpoint has no dynamic parameters.</div>}
      <div className="flex flex-col gap-2 rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-medium">cURL preview</div><Button size="icon-sm" variant="outline" aria-label="Copy cURL command" title="Copy cURL command" onClick={() => void navigator.clipboard.writeText(curlPreview)}><CopyIcon /></Button></div><pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{curlPreview}</pre></div>
    </div>
  )
}
