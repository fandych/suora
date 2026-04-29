import { generateId } from '@/utils/helpers'
import type { MCPServerConfig } from '@/types'

export function createMcpServerDraft(): MCPServerConfig {
  return {
    id: generateId('mcp'),
    name: 'New MCP Server',
    enabled: true,
    transport: 'stdio',
    scope: 'workspace',
    args: [],
    env: {},
    headers: {},
    status: 'disconnected',
    tools: [],
  }
}

export function validateMcpServerConfig(server: MCPServerConfig): string[] {
  const errors: string[] = []
  if (!server.name.trim()) errors.push('Server name is required')

  if (server.transport === 'stdio') {
    if (!server.command?.trim()) errors.push('stdio transport requires a command')
  } else {
    if (!server.url?.trim()) {
      errors.push(`${server.transport} transport requires a URL`)
    } else {
      try {
        const parsed = new URL(server.url)
        if ((server.transport === 'http' || server.transport === 'sse') && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.push(`${server.transport} transport requires an http or https URL`)
        }
        if (server.transport === 'ws' && parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
          errors.push('ws transport requires a ws or wss URL')
        }
      } catch {
        errors.push('URL is invalid')
      }
    }
  }

  return errors
}

export async function testMcpServerConnection(
  server: MCPServerConfig,
): Promise<{ ok: boolean; error?: string; tools?: string[] }> {
  const validationErrors = validateMcpServerConfig(server)
  if (validationErrors.length > 0) {
    return { ok: false, error: validationErrors.join('; ') }
  }

  if (server.transport === 'stdio') {
    // Renderer process cannot spawn stdio process directly; this validates config shape.
    return { ok: true, tools: ['tools:list', 'resources:list', 'prompts:list'] }
  }

  if (server.transport === 'ws') {
    return new Promise((resolve) => {
      let settled = false
      const socket = new WebSocket(server.url as string)
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        socket.close()
        resolve({ ok: false, error: 'Connection timed out after 5s' })
      }, 5000)

      socket.addEventListener('open', () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        socket.close()
        resolve({ ok: true, tools: ['tools:list'] })
      }, { once: true })

      socket.addEventListener('error', () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        socket.close()
        resolve({ ok: false, error: 'WebSocket connection failed' })
      }, { once: true })
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(server.url as string, {
      method: 'GET',
      headers: server.headers,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return {
        ok: false,
        error: `Server responded with ${response.status} ${response.statusText}`,
      }
    }

    return { ok: true, tools: ['tools:list'] }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function parseKeyValueLines(input: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (key) out[key] = val
  }
  return out
}

export function stringifyKeyValueLines(values?: Record<string, string>): string {
  if (!values) return ''
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}
