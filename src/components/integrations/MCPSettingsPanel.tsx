import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import type { MCPServerConfig } from '@/types'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'
import {
  createMcpServerDraft,
  parseKeyValueLines,
  stringifyKeyValueLines,
  testMcpServerConnection,
  validateMcpServerConfig,
} from '@/services/mcpSystem'

/* ── tiny helpers ─────────────────────────────────────────────── */

const statusMeta: Record<string, { dot: string; bg: string; label: string }> = {
  connected:    { dot: 'bg-emerald-400', bg: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20', label: 'Connected' },
  connecting:   { dot: 'bg-amber-400 animate-pulse', bg: 'bg-amber-500/12 text-amber-400 border-amber-500/20', label: 'Connecting' },
  failed:       { dot: 'bg-red-400', bg: 'bg-red-500/12 text-red-400 border-red-500/20', label: 'Failed' },
  disconnected: { dot: 'bg-zinc-500', bg: 'bg-surface-3 text-text-muted border-border-subtle', label: 'Disconnected' },
}

const transportIcons: Record<string, string> = { stdio: 'ui-terminal', http: 'ui-link', sse: 'ui-link', ws: 'ui-link' }

function StatusBadge({ status }: { status?: string }) {
  const s = statusMeta[status || 'disconnected'] ?? statusMeta.disconnected
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] leading-none px-2 py-1 rounded-full border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{children}</p>
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-surface-2/80 border border-border-subtle/60 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors'
const selectCls = inputCls
const textareaCls = 'w-full px-3 py-2 rounded-lg bg-surface-2/80 border border-border-subtle/60 text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors resize-none'

/* ── component ────────────────────────────────────────────────── */

export function MCPSettingsPanel() {
  const [panelWidth, setPanelWidth] = useResizablePanel('mcp', 256)
  const {
    mcpServers,
    addMcpServer,
    updateMcpServer,
    removeMcpServer,
    setMcpServerStatus,
  } = useAppStore()

  const [selectedId, setSelectedId] = useState<string | null>(mcpServers[0]?.id ?? null)
  const selected = useMemo(
    () => mcpServers.find((s) => s.id === selectedId) ?? null,
    [mcpServers, selectedId],
  )

  const [form, setForm] = useState<MCPServerConfig | null>(null)
  const [envInput, setEnvInput] = useState('')
  const [headersInput, setHeadersInput] = useState('')
  const [testing, setTesting] = useState(false)

  const startCreate = () => {
    const draft = createMcpServerDraft()
    setForm(draft)
    setEnvInput('')
    setHeadersInput('')
    setSelectedId(null)
  }

  const startEdit = (server: MCPServerConfig) => {
    setForm(server)
    setSelectedId(server.id)
    setEnvInput(stringifyKeyValueLines(server.env))
    setHeadersInput(stringifyKeyValueLines(server.headers))
  }

  const handleSave = () => {
    if (!form) return
    const next: MCPServerConfig = {
      ...form,
      env: parseKeyValueLines(envInput),
      headers: parseKeyValueLines(headersInput),
    }
    const errors = validateMcpServerConfig(next)
    if (errors.length > 0) {
      toast.error('Invalid MCP server config', errors.join('\n'))
      return
    }

    const exists = mcpServers.some((s) => s.id === next.id)
    if (exists) updateMcpServer(next.id, next)
    else addMcpServer(next)

    setSelectedId(next.id)
    setForm(null)
  }

  const handleDelete = async (id: string) => {
    const target = mcpServers.find((s) => s.id === id)
    if (!target) return
    const ok = await confirm({
      title: 'Delete MCP server?',
      body: `"${target.name}" will be removed.`,
      danger: true,
      confirmText: 'Delete',
    })
    if (!ok) return
    removeMcpServer(id)
    if (selectedId === id) setSelectedId(null)
    if (form?.id === id) setForm(null)
  }

  const handleTest = async (server: MCPServerConfig) => {
    setTesting(true)
    setMcpServerStatus(server.id, 'connecting')
    const result = await testMcpServerConnection(server)
    if (result.ok) {
      updateMcpServer(server.id, { tools: result.tools || [] })
      setMcpServerStatus(server.id, 'connected')
    } else {
      setMcpServerStatus(server.id, 'failed', result.error || 'Unknown error')
    }
    setTesting(false)
  }

  /* ── detail view (selected, no form) ─────────────────────────── */

  const detailView = selected && !form && (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center">
            <IconifyIcon name={transportIcons[selected.transport] || 'ui-plugin'} size={16} color="var(--t-accent)" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">{selected.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-text-muted">{selected.transport.toUpperCase()}</span>
              <span className="text-text-muted/40">·</span>
              <span className="text-[11px] text-text-muted">{selected.scope}</span>
              <StatusBadge status={selected.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => updateMcpServer(selected.id, { enabled: !selected.enabled })}
            className={`px-2.5 py-1.5 text-[11px] rounded-lg border transition-colors ${selected.enabled ? 'bg-emerald-500/12 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-surface-3 border-border-subtle text-text-muted hover:bg-surface-4'}`}
          >
            {selected.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={() => startEdit(selected)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg bg-surface-3/80 border border-border-subtle text-text-secondary hover:bg-surface-4 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(selected.id)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 hover:bg-red-500/15 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* connection details */}
      <div className="rounded-lg bg-surface-1/60 border border-border-subtle/50 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-border-subtle/40">
          <SectionLabel>Connection</SectionLabel>
        </div>
        <div className="px-3.5 py-3 space-y-2 text-xs">
          {selected.transport === 'stdio' ? (
            <>
              <div className="flex gap-2">
                <span className="text-text-muted w-16 shrink-0">Command</span>
                <code className="text-text-secondary font-mono text-[11px] break-all">{selected.command || '—'}</code>
              </div>
              <div className="flex gap-2">
                <span className="text-text-muted w-16 shrink-0">Args</span>
                <code className="text-text-secondary font-mono text-[11px] break-all">{(selected.args || []).join(' ') || '—'}</code>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <span className="text-text-muted w-16 shrink-0">URL</span>
              <code className="text-text-secondary font-mono text-[11px] break-all">{selected.url || '—'}</code>
            </div>
          )}
        </div>
      </div>

      {/* error */}
      {selected.error && (
        <div className="rounded-lg bg-red-500/8 border border-red-500/15 px-3.5 py-2.5 text-xs text-red-400 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span className="break-all">{selected.error}</span>
        </div>
      )}

      {/* tools */}
      {selected.tools && selected.tools.length > 0 && (
        <div>
          <SectionLabel>Discovered Tools ({selected.tools.length})</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {selected.tools.map((tool) => (
              <span key={tool} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2/80 border border-border-subtle/50 text-[11px] text-text-secondary font-mono">
                <IconifyIcon name="ui-plugin" size={10} color="currentColor" />
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* test button */}
      <button
        onClick={() => handleTest(selected)}
        disabled={testing}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        <IconifyIcon name="ui-plugin" size={14} color="currentColor" />
        {testing ? 'Testing…' : 'Test Connection'}
      </button>
    </div>
  )

  /* ── form view (create / edit) ──────────────────────────────── */

  const formView = form && (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center">
          <IconifyIcon name="ui-plugin" size={16} color="var(--t-accent)" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">
          {mcpServers.some((s) => s.id === form.id) ? 'Edit MCP Server' : 'New MCP Server'}
        </h3>
      </div>

      {/* general section */}
      <fieldset className="rounded-lg border border-border-subtle/50 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-border-subtle/40 bg-surface-1/40">
          <SectionLabel>General</SectionLabel>
        </div>
        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-text-muted font-medium">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`mt-1.5 ${inputCls}`}
                placeholder="My MCP Server"
              />
            </label>
            <label className="text-[11px] text-text-muted font-medium">
              Scope
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value as MCPServerConfig['scope'] })}
                className={`mt-1.5 ${selectCls}`}
              >
                <option value="workspace">workspace</option>
                <option value="user">user</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-text-muted font-medium">
              Transport
              <select
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as MCPServerConfig['transport'] })}
                className={`mt-1.5 ${selectCls}`}
              >
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
                <option value="ws">ws</option>
              </select>
            </label>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-border accent-accent"
                />
                <span className="text-[11px] text-text-secondary font-medium">Enabled</span>
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      {/* transport-specific section */}
      <fieldset className="rounded-lg border border-border-subtle/50 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-border-subtle/40 bg-surface-1/40">
          <SectionLabel>{form.transport === 'stdio' ? 'Process' : 'Endpoint'}</SectionLabel>
        </div>
        <div className="p-3.5 space-y-3">
          {form.transport === 'stdio' ? (
            <>
              <label className="text-[11px] text-text-muted font-medium block">
                Command
                <input
                  value={form.command || ''}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="npx"
                  className={`mt-1.5 ${inputCls}`}
                />
              </label>
              <label className="text-[11px] text-text-muted font-medium block">
                Arguments <span className="font-normal text-text-muted/60">(space separated)</span>
                <input
                  value={(form.args || []).join(' ')}
                  onChange={(e) => setForm({ ...form, args: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [] })}
                  placeholder="-y @modelcontextprotocol/server-filesystem C:/workspace"
                  className={`mt-1.5 ${inputCls} font-mono text-xs`}
                />
              </label>
              <label className="text-[11px] text-text-muted font-medium block">
                Environment Variables <span className="font-normal text-text-muted/60">(KEY=VALUE per line)</span>
                <textarea
                  value={envInput}
                  onChange={(e) => setEnvInput(e.target.value)}
                  rows={3}
                  className={`mt-1.5 ${textareaCls}`}
                  placeholder={'API_KEY=sk-...\nNODE_ENV=production'}
                />
              </label>
            </>
          ) : (
            <>
              <label className="text-[11px] text-text-muted font-medium block">
                URL
                <input
                  value={form.url || ''}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://mcp.example.com"
                  className={`mt-1.5 ${inputCls} font-mono text-xs`}
                />
              </label>
              <label className="text-[11px] text-text-muted font-medium block">
                Headers <span className="font-normal text-text-muted/60">(KEY=VALUE per line)</span>
                <textarea
                  value={headersInput}
                  onChange={(e) => setHeadersInput(e.target.value)}
                  rows={3}
                  className={`mt-1.5 ${textareaCls}`}
                  placeholder={'Authorization=Bearer token\nContent-Type=application/json'}
                />
              </label>
            </>
          )}
        </div>
      </fieldset>

      {/* actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setForm(null)}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-3/80 border border-border-subtle text-text-secondary hover:bg-surface-4 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  /* ── render ──────────────────────────────────────────────────── */

  return (
    <div className="flex h-full">
      {/* ── server list (left) ─────────────────────────────────── */}
      <div className="shrink-0 flex flex-col p-3" style={{ width: `${panelWidth}px` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Servers</span>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-accent/12 text-accent hover:bg-accent/20 border border-accent/15 transition-colors"
          >
            <span className="text-sm leading-none">+</span> Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-1.5">
          {mcpServers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-surface-2/80 border border-border-subtle/50 flex items-center justify-center mb-3">
                <IconifyIcon name="ui-plugin" size={18} color="var(--t-text-muted)" />
              </div>
              <p className="text-xs text-text-muted">No servers yet</p>
              <p className="text-[10px] text-text-muted/60 mt-0.5">Click + Add to get started</p>
            </div>
          )}
          {mcpServers.map((server) => {
            const active = selectedId === server.id && !form
            return (
              <button
                key={server.id}
                type="button"
                className={`w-full text-left rounded-lg border p-2.5 transition-all duration-150 ${
                  active
                    ? 'border-accent/25 bg-accent/6 shadow-[0_0_0_1px_rgba(var(--t-accent-rgb),0.08)]'
                    : 'border-border-subtle/50 bg-surface-1/30 hover:bg-surface-2/50 hover:border-border-subtle'
                }`}
                onClick={() => { setSelectedId(server.id); setForm(null) }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${(statusMeta[server.status || 'disconnected'] ?? statusMeta.disconnected).dot}`} />
                  <span className="text-xs font-medium text-text-primary truncate flex-1">{server.name}</span>
                  {!server.enabled && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted/70 shrink-0">OFF</span>
                  )}
                </div>
                <div className="mt-1 ml-3.5 flex items-center gap-1.5 text-[10px] text-text-muted">
                  <span className="uppercase">{server.transport}</span>
                  <span className="text-text-muted/30">·</span>
                  <span>{server.scope}</span>
                  {server.tools && server.tools.length > 0 && (
                    <>
                      <span className="text-text-muted/30">·</span>
                      <span>{server.tools.length} tools</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={400} />

      {/* ── detail / form (right) ──────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!form && !selected && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 rounded-xl bg-surface-2/60 border border-border-subtle/50 flex items-center justify-center mb-4">
              <IconifyIcon name="ui-plugin" size={22} color="var(--t-text-muted)" />
            </div>
            <p className="text-sm text-text-muted">Select a server or create a new one</p>
            <p className="text-[11px] text-text-muted/50 mt-1">Configure MCP servers to extend your AI&apos;s capabilities</p>
          </div>
        )}

        {detailView}
        {formView}
      </div>
    </div>
  )
}
