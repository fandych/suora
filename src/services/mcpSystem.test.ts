import { describe, expect, it } from 'vitest'
import { validateMcpServerConfig } from './mcpSystem'
import type { MCPServerConfig } from '@/types'

function server(overrides: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    id: 'mcp-1',
    name: 'Test MCP',
    enabled: true,
    transport: 'http',
    scope: 'workspace',
    status: 'disconnected',
    tools: [],
    ...overrides,
  }
}

describe('mcpSystem', () => {
  it('validates URL schemes according to transport', () => {
    expect(validateMcpServerConfig(server({ transport: 'http', url: 'ws://localhost:3000' }))).toContain('http transport requires an http or https URL')
    expect(validateMcpServerConfig(server({ transport: 'sse', url: 'file:///tmp/server' }))).toContain('sse transport requires an http or https URL')
    expect(validateMcpServerConfig(server({ transport: 'ws', url: 'https://localhost:3000' }))).toContain('ws transport requires a ws or wss URL')
    expect(validateMcpServerConfig(server({ transport: 'ws', url: 'ws://localhost:3000' }))).toEqual([])
  })
})