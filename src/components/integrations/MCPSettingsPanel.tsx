import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { SidePanel } from '@/components/layout/SidePanel'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useI18n } from '@/hooks/useI18n'
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

const statusMeta: Record<string, { dot: string; bg: string }> = {
  connected:    { dot: 'bg-emerald-400', bg: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20' },
  connecting:   { dot: 'bg-amber-400 animate-pulse', bg: 'bg-amber-500/12 text-amber-400 border-amber-500/20' },
  failed:       { dot: 'bg-red-400', bg: 'bg-red-500/12 text-red-400 border-red-500/20' },
  disconnected: { dot: 'bg-zinc-500', bg: 'bg-surface-3 text-text-muted border-border-subtle' },
}

const transportIcons: Record<string, string> = { stdio: 'ui-terminal', http: 'ui-link', sse: 'ui-link', ws: 'ui-link' }

function StatusBadge({ status, label }: { status?: string; label: string }) {
  const s = statusMeta[status || 'disconnected'] ?? statusMeta.disconnected
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] leading-none px-2 py-1 rounded-full border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{children}</p>
}

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div className="mb-5">
        <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
        <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-text-muted">{children}</label>
}

function formatLastConnected(timestamp: number | undefined, t: (key: string, defaultValue?: string) => string) {
  if (!timestamp) return t('mcp.neverConnected', 'Never connected')
  return new Date(timestamp).toLocaleString()
}

const inputCls = 'w-full px-4 py-3 rounded-2xl bg-surface-2/80 border border-border-subtle/60 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors'
const selectCls = inputCls
const textareaCls = 'w-full px-4 py-3 rounded-3xl bg-surface-2/80 border border-border-subtle/60 text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors resize-none'

/* ── component ────────────────────────────────────────────────── */

export function MCPSettingsPanel() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('mcp', 320)
  const {
    mcpServers,
    addMcpServer,
    updateMcpServer,
    removeMcpServer,
    setMcpServerStatus,
  } = useAppStore()

  const [selectedId, setSelectedId] = useState<string | null>(mcpServers[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const selected = useMemo(
    () => mcpServers.find((s) => s.id === selectedId) ?? null,
    [mcpServers, selectedId],
  )

  const [form, setForm] = useState<MCPServerConfig | null>(null)
  const [envInput, setEnvInput] = useState('')
  const [headersInput, setHeadersInput] = useState('')
  const [testing, setTesting] = useState(false)

  const filteredServers = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return mcpServers
    return mcpServers.filter((server) => {
      const haystacks = [
        server.name,
        server.transport,
        server.scope,
        server.command || '',
        server.url || '',
        ...(server.tools || []),
      ]
      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [mcpServers, deferredSearchQuery])

  const enabledServerCount = useMemo(() => mcpServers.filter((server) => server.enabled).length, [mcpServers])
  const connectedServerCount = useMemo(() => mcpServers.filter((server) => server.status === 'connected').length, [mcpServers])
  const discoveredToolCount = useMemo(() => mcpServers.reduce((count, server) => count + (server.tools?.length ?? 0), 0), [mcpServers])
  const isExistingServerForm = form ? mcpServers.some((server) => server.id === form.id) : false

  useEffect(() => {
    if (selectedId && mcpServers.some((server) => server.id === selectedId)) return
    if (mcpServers.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId(mcpServers[0].id)
  }, [mcpServers, selectedId])

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'connected':
        return t('mcp.connected', 'Connected')
      case 'connecting':
        return t('mcp.connecting', 'Connecting')
      case 'failed':
        return t('mcp.failed', 'Failed')
      default:
        return t('mcp.disconnected', 'Disconnected')
    }
  }

  const getScopeLabel = (scope: MCPServerConfig['scope']) => (
    scope === 'workspace'
      ? t('mcp.scopeWorkspace', 'workspace')
      : t('mcp.scopeUser', 'user')
  )

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
      toast.error(t('mcp.invalidConfigTitle', 'Invalid MCP server config'), errors.join('\n'))
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
      title: t('mcp.deleteTitle', 'Delete MCP server?'),
      body: t('mcp.deleteBody', `"${target.name}" will be removed.`).replace('{name}', target.name),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    const nextSelectedId = mcpServers.find((server) => server.id !== id)?.id ?? null
    removeMcpServer(id)
    if (selectedId === id) setSelectedId(nextSelectedId)
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
      setMcpServerStatus(server.id, 'failed', result.error || t('mcp.unknownError', 'Unknown error'))
    }
    setTesting(false)
  }

  const detailView = selected && !form ? (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <IconifyIcon name={transportIcons[selected.transport] || 'ui-plugin'} size={28} color="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('mcp.serverOverview', 'Server Overview')}</div>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{selected.name}</h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('mcp.serverOverviewHint', 'Inspect transport details, connection health, and discovered capabilities before exposing this server to the workspace runtime.')}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{selected.transport.toUpperCase()}</span>
                <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{getScopeLabel(selected.scope)}</span>
                <StatusBadge status={selected.status} label={getStatusLabel(selected.status)} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-96 xl:grid-cols-1">
            <SummaryStat label={t('common.status', 'Status')} value={getStatusLabel(selected.status)} accent={selected.status === 'connected'} />
            <SummaryStat label={t('mcp.discoveredToolsLabel', 'Tools')} value={String(selected.tools?.length ?? 0)} />
            <SummaryStat label={t('mcp.lastConnected', 'Last Connected')} value={selected.lastConnectedAt ? new Date(selected.lastConnectedAt).toLocaleDateString() : t('mcp.never', 'Never')} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateMcpServer(selected.id, { enabled: !selected.enabled })}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${selected.enabled ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
          >
            {selected.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
          </button>
          <button
            type="button"
            onClick={() => startEdit(selected)}
            className="rounded-2xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary"
          >
            {t('common.edit', 'Edit')}
          </button>
          <button
            type="button"
            onClick={() => void handleTest(selected)}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <IconifyIcon name="ui-plugin" size={14} color="currentColor" />
            {testing ? t('models.testing', 'Testing...') : t('mcp.testConnection', 'Test Connection')}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(selected.id)}
            className="rounded-2xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
          >
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-6">
          <EditorSection
            eyebrow={t('mcp.connection', 'Connection')}
            title={selected.transport === 'stdio' ? t('mcp.process', 'Process') : t('mcp.endpoint', 'Endpoint')}
            description={t('mcp.connectionSectionHint', 'Review the exact command or endpoint shape that the runtime will use when it attempts to connect.')}
          >
            <div className="space-y-3 text-sm text-text-secondary">
              {selected.transport === 'stdio' ? (
                <>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.command', 'Command')}</SectionLabel>
                    <code className="text-[12px] break-all text-text-primary">{selected.command || '—'}</code>
                  </div>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.arguments', 'Arguments')}</SectionLabel>
                    <code className="text-[12px] break-all text-text-primary">{(selected.args || []).join(' ') || '—'}</code>
                  </div>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.environmentVariables', 'Environment Variables')}</SectionLabel>
                    <pre className="whitespace-pre-wrap text-[12px] text-text-primary">{stringifyKeyValueLines(selected.env) || '—'}</pre>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.url', 'URL')}</SectionLabel>
                    <code className="text-[12px] break-all text-text-primary">{selected.url || '—'}</code>
                  </div>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.headers', 'Headers')}</SectionLabel>
                    <pre className="whitespace-pre-wrap text-[12px] text-text-primary">{stringifyKeyValueLines(selected.headers) || '—'}</pre>
                  </div>
                </>
              )}
            </div>
          </EditorSection>

          <EditorSection
            eyebrow={t('mcp.discoveredToolsLabel', 'Tools')}
            title={t('mcp.discoveredTools', 'Discovered Tools ({count})').replace('{count}', String(selected.tools?.length ?? 0))}
            description={t('mcp.discoveredToolsHint', 'These are the capabilities the app currently associates with this server after the latest successful test.')}
          >
            {selected.tools && selected.tools.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.tools.map((tool) => (
                  <span key={tool} className="inline-flex items-center gap-1.5 rounded-2xl border border-border-subtle/55 bg-surface-0/60 px-3 py-2 text-[11px] font-mono text-text-secondary">
                    <IconifyIcon name="ui-plugin" size={12} color="currentColor" />
                    {tool}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">{t('mcp.noDiscoveredTools', 'No tools discovered yet. Run a connection test to populate this list.')}</div>
            )}
          </EditorSection>
        </div>

        <div className="space-y-6">
          <EditorSection
            eyebrow={t('mcp.general', 'General')}
            title={t('mcp.runtimeState', 'Runtime State')}
            description={t('mcp.runtimeStateHint', 'Use this summary to decide whether the server is ready for day-to-day use or still needs more setup.')}
          >
            <div className="space-y-3">
              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-secondary">
                <div>{t('mcp.scope', 'Scope')}: <span className="font-semibold text-text-primary">{getScopeLabel(selected.scope)}</span></div>
                <div className="mt-2">{t('common.status', 'Status')}: <span className="font-semibold text-text-primary">{getStatusLabel(selected.status)}</span></div>
                <div className="mt-2">{t('mcp.lastConnected', 'Last Connected')}: <span className="font-semibold text-text-primary">{formatLastConnected(selected.lastConnectedAt, t)}</span></div>
              </div>

              {selected.error ? (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <div className="font-medium">{t('mcp.latestError', 'Latest error')}</div>
                  <div className="mt-1 break-all">{selected.error}</div>
                </div>
              ) : (
                <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-muted">
                  {t('mcp.noRecentErrors', 'No recent connection errors recorded for this server.')}
                </div>
              )}
            </div>
          </EditorSection>
        </div>
      </div>
    </div>
  ) : null

  const formView = form ? (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <IconifyIcon name="ui-plugin" size={28} color="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{isExistingServerForm ? t('mcp.editServer', 'Edit MCP Server') : t('mcp.newServer', 'New MCP Server')}</div>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{form.name || t('mcp.newServer', 'New MCP Server')}</h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('mcp.formHeroHint', 'Describe the server, choose its transport, and capture enough runtime detail that testing and discovery can happen without guesswork.')}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-96 xl:grid-cols-1">
            <SummaryStat label={t('mcp.transport', 'Transport')} value={form.transport.toUpperCase()} accent />
            <SummaryStat label={t('mcp.scope', 'Scope')} value={getScopeLabel(form.scope)} />
            <SummaryStat label={t('common.mode', 'Mode')} value={isExistingServerForm ? t('common.edit', 'Edit') : t('common.new', 'New')} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-6">
          <EditorSection
            eyebrow={t('mcp.general', 'General')}
            title={t('mcp.identityAndScope', 'Identity & Scope')}
            description={t('mcp.identityAndScopeHint', 'Name the server clearly and decide whether it belongs to this workspace or your broader user profile.')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel>
                {t('common.name', 'Name')}
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`mt-1.5 ${inputCls}`}
                  placeholder={t('mcp.namePlaceholder', 'My MCP Server')}
                />
              </FieldLabel>
              <FieldLabel>
                {t('mcp.scope', 'Scope')}
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as MCPServerConfig['scope'] })}
                  title={t('mcp.scope', 'Scope')}
                  className={`mt-1.5 ${selectCls}`}
                >
                  <option value="workspace">{t('mcp.scopeWorkspace', 'workspace')}</option>
                  <option value="user">{t('mcp.scopeUser', 'user')}</option>
                </select>
              </FieldLabel>
              <FieldLabel>
                {t('mcp.transport', 'Transport')}
                <select
                  value={form.transport}
                  onChange={(e) => setForm({ ...form, transport: e.target.value as MCPServerConfig['transport'] })}
                  title={t('mcp.transport', 'Transport')}
                  className={`mt-1.5 ${selectCls}`}
                >
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                  <option value="sse">sse</option>
                  <option value="ws">ws</option>
                </select>
              </FieldLabel>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none rounded-2xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  <span>{t('common.enabled', 'Enabled')}</span>
                </label>
              </div>
            </div>
          </EditorSection>

          <EditorSection
            eyebrow={form.transport === 'stdio' ? t('mcp.process', 'Process') : t('mcp.endpoint', 'Endpoint')}
            title={form.transport === 'stdio' ? t('mcp.runtimeProcess', 'Runtime Process') : t('mcp.remoteEndpoint', 'Remote Endpoint')}
            description={form.transport === 'stdio' ? t('mcp.runtimeProcessHint', 'Provide the executable command and arguments that launch the MCP server locally.') : t('mcp.remoteEndpointHint', 'Provide the remote URL and any required headers needed to talk to the MCP server.')}
          >
            <div className="space-y-4">
              {form.transport === 'stdio' ? (
                <>
                  <FieldLabel>
                    {t('mcp.command', 'Command')}
                    <input
                      value={form.command || ''}
                      onChange={(e) => setForm({ ...form, command: e.target.value })}
                      placeholder="npx"
                      className={`mt-1.5 ${inputCls}`}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.arguments', 'Arguments')} <span className="font-normal text-text-muted/60">({t('mcp.spaceSeparated', 'space separated')})</span>
                    <input
                      value={(form.args || []).join(' ')}
                      onChange={(e) => setForm({ ...form, args: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [] })}
                      placeholder="-y @modelcontextprotocol/server-filesystem C:/workspace"
                      className={`mt-1.5 ${inputCls} font-mono text-xs`}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.environmentVariables', 'Environment Variables')} <span className="font-normal text-text-muted/60">({t('mcp.keyValuePerLine', 'KEY=VALUE per line')})</span>
                    <textarea
                      value={envInput}
                      onChange={(e) => setEnvInput(e.target.value)}
                      rows={5}
                      className={`mt-1.5 ${textareaCls}`}
                      placeholder={'API_KEY=sk-...\nNODE_ENV=production'}
                    />
                  </FieldLabel>
                </>
              ) : (
                <>
                  <FieldLabel>
                    {t('mcp.url', 'URL')}
                    <input
                      value={form.url || ''}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      placeholder="https://mcp.example.com"
                      className={`mt-1.5 ${inputCls} font-mono text-xs`}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.headers', 'Headers')} <span className="font-normal text-text-muted/60">({t('mcp.keyValuePerLine', 'KEY=VALUE per line')})</span>
                    <textarea
                      value={headersInput}
                      onChange={(e) => setHeadersInput(e.target.value)}
                      rows={5}
                      className={`mt-1.5 ${textareaCls}`}
                      placeholder={'Authorization=Bearer token\nContent-Type=application/json'}
                    />
                  </FieldLabel>
                </>
              )}
            </div>
          </EditorSection>
        </div>

        <div className="space-y-6">
          <EditorSection
            eyebrow={t('common.save', 'Save')}
            title={t('mcp.reviewAndSave', 'Review & Save')}
            description={t('mcp.reviewAndSaveHint', 'Save writes the server config into the local store. Run a test after saving to confirm transport and tool discovery.')}
          >
            <div className="space-y-4">
              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-4 text-sm text-text-secondary">
                <div>{t('common.name', 'Name')}: <span className="font-semibold text-text-primary">{form.name || t('mcp.newServer', 'New MCP Server')}</span></div>
                <div className="mt-2">{t('mcp.transport', 'Transport')}: <span className="font-semibold text-text-primary">{form.transport.toUpperCase()}</span></div>
                <div className="mt-2">{t('mcp.scope', 'Scope')}: <span className="font-semibold text-text-primary">{getScopeLabel(form.scope)}</span></div>
              </div>

              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-4 text-sm text-text-muted">
                {form.transport === 'stdio'
                  ? t('mcp.stdioGuide', 'For stdio servers, the runtime only validates command shape here; process spawning and deep inspection happen when the server is actually used.')
                  : t('mcp.remoteGuide', 'For remote servers, the built-in test performs a lightweight fetch to validate reachability before tools are populated.')}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  {t('common.save', 'Save')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-2xl bg-surface-2 px-5 py-3 text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </EditorSection>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <SidePanel
        title={t('mcp.title', 'MCP Servers')}
        width={panelWidth}
        action={
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25"
          >
            + {t('common.add', 'Add')}
          </button>
        }
      >
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('mcp.registry', 'Registry')}</div>
                <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('mcp.serverCatalog', 'Server Catalog')}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('mcp.serverCatalogHint', 'Keep local processes and remote endpoints organized before they enter the runtime.')}</p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                <div className="text-xl font-semibold text-text-primary tabular-nums">{mcpServers.length}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <SummaryStat label={t('mcp.servers', 'Servers')} value={String(mcpServers.length)} accent />
              <SummaryStat label={t('common.enabled', 'Enabled')} value={String(enabledServerCount)} />
              <SummaryStat label={t('mcp.connected', 'Connected')} value={String(connectedServerCount)} />
            </div>
          </div>

          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('mcp.searchServers', 'Search servers...')}
                className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-3 text-[12px] text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{filteredServers.length} {t('common.results', 'results')}</span>
              {searchQuery.trim() && <span>{mcpServers.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          <div className="space-y-2">
            {filteredServers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-plugin" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{searchQuery.trim() ? t('mcp.noMatchingServers', 'No matching servers.') : t('mcp.noServersYet', 'No servers yet')}</p>
                <p className="mt-1 text-[10px] text-text-muted/60">{searchQuery.trim() ? t('mcp.adjustFilters', 'Adjust the search query or clear it to see all servers.') : t('mcp.clickAddToStart', 'Click + Add to get started')}</p>
              </div>
            ) : (
              filteredServers.map((server) => {
                const isActive = selectedId === server.id || form?.id === server.id
                const toolsCount = server.tools?.length ?? 0

                return (
                  <button
                    key={server.id}
                    type="button"
                    className={`w-full rounded-3xl border px-3.5 py-3.5 text-left transition-all duration-200 ${isActive ? 'border-accent/20 bg-accent/10 shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]' : 'border-transparent bg-surface-1/20 hover:bg-surface-3/55 hover:border-border-subtle/60'}`}
                    onClick={() => { setSelectedId(server.id); setForm(null) }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 text-accent shadow-sm">
                          <IconifyIcon name={transportIcons[server.transport] || 'ui-plugin'} size={16} color="currentColor" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-text-primary">{server.name}</span>
                            {!server.enabled && <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">OFF</span>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{server.transport === 'stdio' ? server.command || t('mcp.commandMissing', 'Command not configured') : server.url || t('mcp.urlMissing', 'URL not configured')}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                            <span className="rounded-full bg-surface-3/80 px-2 py-0.5 uppercase">{server.transport}</span>
                            <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{getScopeLabel(server.scope)}</span>
                            <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{t('mcp.toolsCount', `${toolsCount} tools`).replace('{count}', String(toolsCount))}</span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={server.status} label={getStatusLabel(server.status)} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </SidePanel>

      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={240} maxWidth={520} />

      <div className="flex-1 min-w-0 overflow-y-auto bg-surface-1/30 px-5 py-6 xl:px-8 xl:py-8">
        {!form && !selected ? (
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name="ui-plugin" size={30} color="currentColor" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">{t('mcp.selectServer', 'Select a server or create a new one')}</h2>
              <p className="mt-3 text-[14px] leading-7 text-text-secondary/82">{t('mcp.selectServerHint', 'Configure MCP servers to extend your AI\'s capabilities')}</p>
              <button
                type="button"
                onClick={startCreate}
                className="mt-6 rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
              >
                + {t('common.add', 'Add')}
              </button>
            </div>
          </div>
        ) : (
          formView || detailView
        )}
      </div>
    </>
  )
}
