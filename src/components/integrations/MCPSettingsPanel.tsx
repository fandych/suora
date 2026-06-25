import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { SidePanel } from '@/components/layout/SidePanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useI18n } from '@/hooks/useI18n';
import type { MCPServerConfig } from '@/types';
import { confirm } from '@/services/confirmDialog';
import { toast } from '@/services/toast';
import { WorkbenchEmptyState } from '@/components/catalyst-ui/workbench-empty-state';
import { Button as UiButton } from '@/components/catalyst-ui/button';
import { Checkbox } from '@/components/catalyst-ui/checkbox';
import { createMcpServerDraft, parseKeyValueLines, stringifyKeyValueLines, testMcpServerConnection, validateMcpServerConfig, } from '@/services/mcpSystem';
import { Input as UiInput, Select as UiSelect, TextArea as UiTextArea } from "@/components/catalyst-ui/form-controls";
import { workbenchDangerButtonClass, workbenchDetailSectionClass, workbenchHeroSectionClass, workbenchNeutralButtonClass, workbenchPrimaryButtonClass, workbenchSectionDescriptionClass, workbenchSectionEyebrowClass, workbenchSectionTitleClass, workbenchSidebarAccentActionClass, workbenchSidebarCardClass, workbenchSidebarDescriptionClass, workbenchSidebarEmptyClass, workbenchSidebarIconClass, workbenchSidebarItemClass, workbenchSidebarMetaClass, workbenchSidebarPillClass, workbenchSidebarPrimaryActionClass, workbenchSidebarSearchInputClass, workbenchSidebarTitleClass, workbenchSummaryLabelClass, workbenchSummaryStatClass, workbenchSummaryValueClass } from '@/components/catalyst-ui/workbench';
/* ── tiny helpers ─────────────────────────────────────────────── */
const statusMeta: Record<string, {
    dot: string;
    bg: string;
}> = {
    connected: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20' },
    connecting: { dot: 'bg-amber-400 animate-pulse', bg: 'bg-amber-500/12 text-amber-400 border-amber-500/20' },
    failed: { dot: 'bg-red-400', bg: 'bg-red-500/12 text-red-400 border-red-500/20' },
    disconnected: { dot: 'bg-zinc-500', bg: 'bg-surface-3 text-text-muted border-border-subtle' },
};
const transportIcons: Record<string, string> = { stdio: 'ui-terminal', http: 'ui-link', sse: 'ui-link', ws: 'ui-link' };
function StatusBadge({ status, label }: {
    status?: string;
    label: string;
}) {
    const s = statusMeta[status || 'disconnected'] ?? statusMeta.disconnected;
    return (<span className={`inline-flex items-center gap-1.5 text-[10px] leading-none px-2 py-1 rounded-full border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {label}
    </span>);
}
function SectionLabel({ children }: {
    children: React.ReactNode;
}) {
    return <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{children}</p>;
}
function SummaryStat({ label, value, accent = false }: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (<div className={workbenchSummaryStatClass(accent)}>
      <div className={workbenchSummaryLabelClass}>{label}</div>
      <div className={`${workbenchSummaryValueClass} ${accent ? 'text-accent' : ''}`}>{value}</div>
    </div>);
}
function EditorSection({ eyebrow, title, description, children, }: {
    eyebrow: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (<section className={workbenchDetailSectionClass}>
      <div className="mb-5">
        <div className={workbenchSectionEyebrowClass}>{eyebrow}</div>
        <h3 className={workbenchSectionTitleClass}>{title}</h3>
        {description && <p className={workbenchSectionDescriptionClass}>{description}</p>}
      </div>
      {children}
    </section>);
}
function FieldLabel({ children }: {
    children: React.ReactNode;
}) {
    return <label className="block text-[11px] font-medium text-text-muted">{children}</label>;
}
function formatLastConnected(timestamp: number | undefined, t: (key: string, defaultValue?: string) => string) {
    if (!timestamp)
        return t('mcp.neverConnected', 'Never connected');
    return new Date(timestamp).toLocaleString();
}
const inputCls = 'w-full px-4 py-3 rounded-2xl bg-surface-2/80 border border-border-subtle/60 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors';
const selectCls = inputCls;
const textareaCls = 'w-full px-4 py-3 rounded-3xl bg-surface-2/80 border border-border-subtle/60 text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors resize-none';
/* ── component ────────────────────────────────────────────────── */
export function MCPSettingsPanel() {
    const { t } = useI18n();
    const [panelWidth, setPanelWidth] = useResizablePanel('mcp', 340);
    const { mcpServers, addMcpServer, updateMcpServer, removeMcpServer, setMcpServerStatus, } = useAppStore();
    const [selectedId, setSelectedId] = useState<string | null>(mcpServers[0]?.id ?? null);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const selected = useMemo(() => mcpServers.find((s) => s.id === selectedId) ?? null, [mcpServers, selectedId]);
    const [form, setForm] = useState<MCPServerConfig | null>(null);
    const [envInput, setEnvInput] = useState('');
    const [headersInput, setHeadersInput] = useState('');
    const [testing, setTesting] = useState(false);
    const filteredServers = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();
        if (!query)
            return mcpServers;
        return mcpServers.filter((server) => {
            const haystacks = [
                server.name,
                server.transport,
                server.scope,
                server.command || '',
                server.url || '',
                ...(server.tools || []),
            ];
            return haystacks.some((value) => value.toLowerCase().includes(query));
        });
    }, [mcpServers, deferredSearchQuery]);
    const isExistingServerForm = form ? mcpServers.some((server) => server.id === form.id) : false;
    useEffect(() => {
        if (selectedId && mcpServers.some((server) => server.id === selectedId))
            return;
        if (mcpServers.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId(mcpServers[0].id);
    }, [mcpServers, selectedId]);
    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'connected':
                return t('mcp.connected', 'Connected');
            case 'connecting':
                return t('mcp.connecting', 'Connecting');
            case 'failed':
                return t('mcp.failed', 'Failed');
            default:
                return t('mcp.disconnected', 'Disconnected');
        }
    };
    const getScopeLabel = (scope: MCPServerConfig['scope']) => (scope === 'workspace'
        ? t('mcp.scopeWorkspace', 'workspace')
        : t('mcp.scopeUser', 'user'));
    const getTransportLabel = (transport: MCPServerConfig['transport']) => {
        switch (transport) {
            case 'stdio':
                return t('mcp.transportStdio', 'Stdio');
            case 'http':
                return t('mcp.transportHttp', 'HTTP');
            case 'sse':
                return t('mcp.transportSse', 'SSE');
            case 'ws':
                return t('mcp.transportWs', 'WebSocket');
            default:
                return transport;
        }
    };
    const startCreate = () => {
        const draft = createMcpServerDraft();
        setForm(draft);
        setEnvInput('');
        setHeadersInput('');
        setSelectedId(null);
    };
    const startEdit = (server: MCPServerConfig) => {
        setForm(server);
        setSelectedId(server.id);
        setEnvInput(stringifyKeyValueLines(server.env));
        setHeadersInput(stringifyKeyValueLines(server.headers));
    };
    const handleSave = () => {
        if (!form)
            return;
        const next: MCPServerConfig = {
            ...form,
            env: parseKeyValueLines(envInput),
            headers: parseKeyValueLines(headersInput),
        };
        const errors = validateMcpServerConfig(next);
        if (errors.length > 0) {
            toast.error(t('mcp.invalidConfigTitle', 'Invalid MCP server config'), errors.join('\n'));
            return;
        }
        const exists = mcpServers.some((s) => s.id === next.id);
        if (exists)
            updateMcpServer(next.id, next);
        else
            addMcpServer(next);
        setSelectedId(next.id);
        setForm(null);
    };
    const handleDelete = async (id: string) => {
        const target = mcpServers.find((s) => s.id === id);
        if (!target)
            return;
        const ok = await confirm({
            title: t('mcp.deleteTitle', 'Delete MCP server?'),
            body: t('mcp.deleteBody', '"{name}" will be removed.').replace('{name}', target.name),
            danger: true,
            confirmText: t('common.delete', 'Delete'),
        });
        if (!ok)
            return;
        const nextSelectedId = mcpServers.find((server) => server.id !== id)?.id ?? null;
        removeMcpServer(id);
        if (selectedId === id)
            setSelectedId(nextSelectedId);
        if (form?.id === id)
            setForm(null);
    };
    const handleTest = async (server: MCPServerConfig) => {
        setTesting(true);
        setMcpServerStatus(server.id, 'connecting');
        const result = await testMcpServerConnection(server);
        if (result.ok) {
            updateMcpServer(server.id, { tools: result.tools || [] });
            setMcpServerStatus(server.id, 'connected');
        }
        else {
            setMcpServerStatus(server.id, 'failed', result.error || t('mcp.unknownError', 'Unknown error'));
        }
        setTesting(false);
    };
    const detailView = selected && !form ? (<div className="space-y-6 animate-in fade-in duration-200">
      <section className={workbenchHeroSectionClass}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <IconifyIcon name={transportIcons[selected.transport] || 'ui-plugin'} size={28} color="currentColor"/>
            </div>
            <div className="min-w-0 flex-1">
              <div className={workbenchSectionEyebrowClass}>{t('mcp.serverOverview', 'Server Overview')}</div>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{selected.name}</h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('mcp.serverOverviewHint', 'Inspect transport details, connection health, and discovered capabilities before exposing this server to the workspace runtime.')}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{getTransportLabel(selected.transport)}</span>
                <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{getScopeLabel(selected.scope)}</span>
                <StatusBadge status={selected.status} label={getStatusLabel(selected.status)}/>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-96 xl:grid-cols-1">
            <SummaryStat label={t('common.status', 'Status')} value={getStatusLabel(selected.status)} accent={selected.status === 'connected'}/>
            <SummaryStat label={t('mcp.discoveredToolsLabel', 'Tools')} value={String(selected.tools?.length ?? 0)}/>
            <SummaryStat label={t('mcp.lastConnected', 'Last Connected')} value={selected.lastConnectedAt ? new Date(selected.lastConnectedAt).toLocaleDateString() : t('mcp.never', 'Never')}/>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <UiButton unstyled type="button" onClick={() => updateMcpServer(selected.id, { enabled: !selected.enabled })} className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${selected.enabled ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}>
            {selected.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
          </UiButton>
          <UiButton unstyled type="button" onClick={() => startEdit(selected)} className={workbenchNeutralButtonClass}>
            {t('common.edit', 'Edit')}
          </UiButton>
          <UiButton unstyled type="button" onClick={() => void handleTest(selected)} disabled={testing} className={`inline-flex items-center gap-2 ${workbenchPrimaryButtonClass} disabled:opacity-50`}>
            <IconifyIcon name="ui-plugin" size={14} color="currentColor"/>
            {testing ? t('models.testing', 'Testing...') : t('mcp.testConnection', 'Test Connection')}
          </UiButton>
          <UiButton unstyled type="button" onClick={() => void handleDelete(selected.id)} className={workbenchDangerButtonClass}>
            {t('common.delete', 'Delete')}
          </UiButton>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-6">
          <EditorSection eyebrow={t('mcp.connection', 'Connection')} title={selected.transport === 'stdio' ? t('mcp.process', 'Process') : t('mcp.endpoint', 'Endpoint')} description={t('mcp.connectionSectionHint', 'Review the exact command or endpoint shape that the runtime will use when it attempts to connect.')}>
            <div className="space-y-3 text-sm text-text-secondary">
              {selected.transport === 'stdio' ? (<>
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
                </>) : (<>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.url', 'URL')}</SectionLabel>
                    <code className="text-[12px] break-all text-text-primary">{selected.url || '—'}</code>
                  </div>
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                    <SectionLabel>{t('mcp.headers', 'Headers')}</SectionLabel>
                    <pre className="whitespace-pre-wrap text-[12px] text-text-primary">{stringifyKeyValueLines(selected.headers) || '—'}</pre>
                  </div>
                </>)}
            </div>
          </EditorSection>

          <EditorSection eyebrow={t('mcp.discoveredToolsLabel', 'Tools')} title={t('mcp.discoveredTools', 'Discovered Tools ({count})').replace('{count}', String(selected.tools?.length ?? 0))} description={t('mcp.discoveredToolsHint', 'These are the capabilities the app currently associates with this server after the latest successful test.')}>
            {selected.tools && selected.tools.length > 0 ? (<div className="flex flex-wrap gap-2">
                {selected.tools.map((tool) => (<span key={tool} className="inline-flex items-center gap-1.5 rounded-2xl border border-border-subtle/55 bg-surface-0/60 px-3 py-2 text-[11px] font-mono text-text-secondary">
                    <IconifyIcon name="ui-plugin" size={12} color="currentColor"/>
                    {tool}
                  </span>))}
              </div>) : (<div className="rounded-3xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">{t('mcp.noDiscoveredTools', 'No tools discovered yet. Run a connection test to populate this list.')}</div>)}
          </EditorSection>
        </div>

        <div className="space-y-6">
          <EditorSection eyebrow={t('mcp.general', 'General')} title={t('mcp.runtimeState', 'Runtime State')} description={t('mcp.runtimeStateHint', 'Use this summary to decide whether the server is ready for day-to-day use or still needs more setup.')}>
            <div className="space-y-3">
              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-secondary">
                <div>{t('mcp.scope', 'Scope')}: <span className="font-semibold text-text-primary">{getScopeLabel(selected.scope)}</span></div>
                <div className="mt-2">{t('common.status', 'Status')}: <span className="font-semibold text-text-primary">{getStatusLabel(selected.status)}</span></div>
                <div className="mt-2">{t('mcp.lastConnected', 'Last Connected')}: <span className="font-semibold text-text-primary">{formatLastConnected(selected.lastConnectedAt, t)}</span></div>
              </div>

              {selected.error ? (<div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <div className="font-medium">{t('mcp.latestError', 'Latest error')}</div>
                  <div className="mt-1 break-all">{selected.error}</div>
                </div>) : (<div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-muted">
                  {t('mcp.noRecentErrors', 'No recent connection errors recorded for this server.')}
                </div>)}
            </div>
          </EditorSection>
        </div>
      </div>
    </div>) : null;
    const formView = form ? (<div className="space-y-6 animate-in fade-in duration-200">
      <section className={workbenchHeroSectionClass}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <IconifyIcon name="ui-plugin" size={28} color="currentColor"/>
            </div>
            <div className="min-w-0 flex-1">
              <div className={workbenchSectionEyebrowClass}>{isExistingServerForm ? t('mcp.editServer', 'Edit MCP Server') : t('mcp.newServer', 'New MCP Server')}</div>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{form.name || t('mcp.newServer', 'New MCP Server')}</h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('mcp.formHeroHint', 'Describe the server, choose its transport, and capture enough runtime detail that testing and discovery can happen without guesswork.')}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-96 xl:grid-cols-1">
            <SummaryStat label={t('mcp.transport', 'Transport')} value={getTransportLabel(form.transport)} accent/>
            <SummaryStat label={t('mcp.scope', 'Scope')} value={getScopeLabel(form.scope)}/>
            <SummaryStat label={t('common.mode', 'Mode')} value={isExistingServerForm ? t('common.edit', 'Edit') : t('common.new', 'New')}/>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-6">
          <EditorSection eyebrow={t('mcp.general', 'General')} title={t('mcp.identityAndScope', 'Identity & Scope')} description={t('mcp.identityAndScopeHint', 'Name the server clearly and decide whether it belongs to this workspace or your broader user profile.')}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel>
                {t('common.name', 'Name')}
                <UiInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} wrapperClassName="mt-1.5" controlClassName={inputCls} placeholder={t('mcp.namePlaceholder', 'My MCP Server')}/>
              </FieldLabel>
              <FieldLabel>
                {t('mcp.scope', 'Scope')}
                <UiSelect value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as MCPServerConfig['scope'] })} title={t('mcp.scope', 'Scope')} wrapperClassName="mt-1.5" controlClassName={selectCls}>
                  <option value="workspace">{t('mcp.scopeWorkspace', 'workspace')}</option>
                  <option value="user">{t('mcp.scopeUser', 'user')}</option>
                </UiSelect>
              </FieldLabel>
              <FieldLabel>
                {t('mcp.transport', 'Transport')}
                <UiSelect value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as MCPServerConfig['transport'] })} title={t('mcp.transport', 'Transport')} wrapperClassName="mt-1.5" controlClassName={selectCls}>
                  <option value="stdio">{getTransportLabel('stdio')}</option>
                  <option value="http">{getTransportLabel('http')}</option>
                  <option value="sse">{getTransportLabel('sse')}</option>
                  <option value="ws">{getTransportLabel('ws')}</option>
                </UiSelect>
              </FieldLabel>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none rounded-2xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-secondary">
                  <Checkbox checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} color="blue" />
                  <span>{t('common.enabled', 'Enabled')}</span>
                </label>
              </div>
            </div>
          </EditorSection>

          <EditorSection eyebrow={form.transport === 'stdio' ? t('mcp.process', 'Process') : t('mcp.endpoint', 'Endpoint')} title={form.transport === 'stdio' ? t('mcp.runtimeProcess', 'Runtime Process') : t('mcp.remoteEndpoint', 'Remote Endpoint')} description={form.transport === 'stdio' ? t('mcp.runtimeProcessHint', 'Provide the executable command and arguments that launch the MCP server locally.') : t('mcp.remoteEndpointHint', 'Provide the remote URL and any required headers needed to talk to the MCP server.')}>
            <div className="space-y-4">
              {form.transport === 'stdio' ? (<>
                  <FieldLabel>
                    {t('mcp.command', 'Command')}
                    <UiInput value={form.command || ''} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder={t('mcp.commandPlaceholder', 'npx')} wrapperClassName="mt-1.5" controlClassName={inputCls}/>
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.arguments', 'Arguments')} <span className="font-normal text-text-muted/60">({t('mcp.spaceSeparated', 'space separated')})</span>
                    <UiInput value={(form.args || []).join(' ')} onChange={(e) => setForm({ ...form, args: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [] })} placeholder={t('mcp.argsPlaceholder', '-y @modelcontextprotocol/server-filesystem C:/workspace')} wrapperClassName="mt-1.5" controlClassName={`${inputCls} font-mono text-xs`}/>
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.environmentVariables', 'Environment Variables')} <span className="font-normal text-text-muted/60">({t('mcp.keyValuePerLine', 'KEY=VALUE per line')})</span>
                    <UiTextArea value={envInput} onChange={(e) => setEnvInput(e.target.value)} rows={5} wrapperClassName="mt-1.5" controlClassName={textareaCls} placeholder={t('mcp.envPlaceholder', 'API_KEY=sk-...\nNODE_ENV=production')}/>
                  </FieldLabel>
                </>) : (<>
                  <FieldLabel>
                    {t('mcp.url', 'URL')}
                    <UiInput value={form.url || ''} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={t('mcp.urlPlaceholder', 'https://mcp.example.com')} wrapperClassName="mt-1.5" controlClassName={`${inputCls} font-mono text-xs`}/>
                  </FieldLabel>
                  <FieldLabel>
                    {t('mcp.headers', 'Headers')} <span className="font-normal text-text-muted/60">({t('mcp.keyValuePerLine', 'KEY=VALUE per line')})</span>
                    <UiTextArea value={headersInput} onChange={(e) => setHeadersInput(e.target.value)} rows={5} wrapperClassName="mt-1.5" controlClassName={textareaCls} placeholder={t('mcp.headersPlaceholder', 'Authorization=Bearer token\nContent-Type=application/json')}/>
                  </FieldLabel>
                </>)}
            </div>
          </EditorSection>
        </div>

        <div className="space-y-6">
          <EditorSection eyebrow={t('common.save', 'Save')} title={t('mcp.reviewAndSave', 'Review & Save')} description={t('mcp.reviewAndSaveHint', 'Save writes the server config into the local store. Run a test after saving to confirm transport and tool discovery.')}>
            <div className="space-y-4">
              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-4 text-sm text-text-secondary">
                <div>{t('common.name', 'Name')}: <span className="font-semibold text-text-primary">{form.name || t('mcp.newServer', 'New MCP Server')}</span></div>
                <div className="mt-2">{t('mcp.transport', 'Transport')}: <span className="font-semibold text-text-primary">{getTransportLabel(form.transport)}</span></div>
                <div className="mt-2">{t('mcp.scope', 'Scope')}: <span className="font-semibold text-text-primary">{getScopeLabel(form.scope)}</span></div>
              </div>

              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-4 text-sm text-text-muted">
                {form.transport === 'stdio'
            ? t('mcp.stdioGuide', 'For stdio servers, the runtime only validates command shape here; process spawning and deep inspection happen when the server is actually used.')
            : t('mcp.remoteGuide', 'For remote servers, the built-in test performs a lightweight fetch to validate reachability before tools are populated.')}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <UiButton unstyled type="button" onClick={handleSave} className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
                  {t('common.save', 'Save')}
                </UiButton>
                <UiButton unstyled type="button" onClick={() => setForm(null)} className="rounded-2xl bg-surface-2 px-5 py-3 text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary">
                  {t('common.cancel', 'Cancel')}
                </UiButton>
              </div>
            </div>
          </EditorSection>
        </div>
      </div>
    </div>) : null;
    return (<>
      <SidePanel title={t('mcp.title', 'MCP Servers')} width={panelWidth} action={<UiButton unstyled type="button" onClick={startCreate} className={workbenchSidebarAccentActionClass}>
            + {t('common.add', 'Add')}
          </UiButton>}>
        <div className="module-sidebar-stack px-3 pb-3 pt-3 space-y-3">
          <div className={workbenchSidebarCardClass}>
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"/>
              <UiInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('mcp.searchServers', 'Search servers...')} wrapperClassName="w-full" controlClassName={workbenchSidebarSearchInputClass}/>
            </div>
            <div className={workbenchSidebarMetaClass}>
              <span>{filteredServers.length} {t('common.results', 'results')}</span>
              {searchQuery.trim() && <span>{mcpServers.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          <div className="space-y-2">
            {filteredServers.length === 0 ? (<div className={workbenchSidebarEmptyClass}>
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-plugin" size={18} color="currentColor"/>
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{searchQuery.trim() ? t('mcp.noMatchingServers', 'No matching servers.') : t('mcp.noServersYet', 'No servers yet')}</p>
                <p className="mt-1 text-[10px] text-text-muted/60">{searchQuery.trim() ? t('mcp.adjustFilters', 'Adjust the search query or clear it to see all servers.') : t('mcp.clickAddToStart', 'Click + Add to get started')}</p>
              </div>) : (filteredServers.map((server) => {
            const isActive = selectedId === server.id || form?.id === server.id;
            const toolsCount = server.tools?.length ?? 0;
            return (<UiButton unstyled key={server.id} type="button" className={workbenchSidebarItemClass(isActive)} onClick={() => { setSelectedId(server.id); setForm(null); }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className={workbenchSidebarIconClass}>
                          <IconifyIcon name={transportIcons[server.transport] || 'ui-plugin'} size={16} color="currentColor"/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={workbenchSidebarTitleClass}>{server.name}</span>
                            {!server.enabled && <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">{t('common.off', 'Off')}</span>}
                          </div>
                          <p className={workbenchSidebarDescriptionClass}>{server.transport === 'stdio' ? server.command || t('mcp.commandMissing', 'Command not configured') : server.url || t('mcp.urlMissing', 'URL not configured')}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                            <span className={workbenchSidebarPillClass}>{getTransportLabel(server.transport)}</span>
                            <span className={workbenchSidebarPillClass}>{getScopeLabel(server.scope)}</span>
                            <span className={workbenchSidebarPillClass}>{t('mcp.toolsCount', `${toolsCount} tools`).replace('{count}', String(toolsCount))}</span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={server.status} label={getStatusLabel(server.status)}/>
                    </div>
                  </UiButton>);
        }))}
          </div>
        </div>
      </SidePanel>

      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={420}/>

      <div className="module-canvas flex-1 min-w-0 overflow-y-auto px-5 py-6 xl:px-8 xl:py-8">
        {!form && !selected ? (<WorkbenchEmptyState icon={<IconifyIcon name="ui-plugin" size={30} color="currentColor"/>} title={t('mcp.selectServer', 'Select a server or create a new one')} description={t('mcp.selectServerHint', 'Configure MCP servers to extend your AI\'s capabilities')} actions={(<UiButton unstyled type="button" onClick={startCreate} className={workbenchSidebarPrimaryActionClass}>
                + {t('common.add', 'Add')}
              </UiButton>)}/>) : (formView || detailView)}
      </div>
    </>);
}



