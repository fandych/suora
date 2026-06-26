import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '@/store/appStore';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { useI18n } from '@/hooks/useI18n';
import { ChannelPlatformIcon, getPlatformDisplayName } from './ChannelIcons';
import { ChannelMessageBubble, formatChannelAbsoluteTime, formatChannelRelativeTime, normalizeChannelDirection } from './ChannelComponents';
import { Button as UiButton } from "@/components/catalyst-ui/button";
import { Input as UiInput, Select as UiSelect } from "@/components/catalyst-ui/form-controls";
import { workbenchDetailSectionClass, workbenchSectionDescriptionClass, workbenchSectionEyebrowClass, workbenchSectionTitleClass, workbenchSummaryLabelClass, workbenchSummaryStatClass, workbenchSummaryValueClass } from '@/components/catalyst-ui/workbench';
function PanelShell({ eyebrow, title, description, action, children, }: {
    eyebrow: string;
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (<section className={workbenchDetailSectionClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={workbenchSectionEyebrowClass}>{eyebrow}</div>
          <h3 className={workbenchSectionTitleClass}>{title}</h3>
          {description && <p className={`${workbenchSectionDescriptionClass} mt-2 max-w-3xl leading-6`}>{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>);
}
function PanelStat({ label, value, accent = false }: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (<div className={workbenchSummaryStatClass(accent)}>
      <div className={workbenchSummaryLabelClass}>{label}</div>
      <div className={`${workbenchSummaryValueClass} ${accent ? 'text-accent' : ''}`}>{value}</div>
    </div>);
}
function EmptyPanelState({ icon, title, description }: {
    icon: string;
    title: string;
    description: string;
}) {
    return (<div className="flex h-full min-h-56 flex-col items-center justify-center rounded-4xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-3xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
        <IconifyIcon name={icon} size={18} color="currentColor"/>
      </div>
      <h4 className="text-[15px] font-semibold text-text-primary">{title}</h4>
      <p className="mt-2 max-w-md text-[12px] leading-6 text-text-muted">{description}</p>
    </div>);
}
function StatusPill({ children, tone = 'neutral' }: {
    children: ReactNode;
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}) {
    const toneClass = tone === 'accent'
        ? 'bg-accent/12 text-accent'
        : tone === 'success'
            ? 'bg-green-500/12 text-green-400'
            : tone === 'warning'
                ? 'bg-amber-500/12 text-amber-400'
                : tone === 'danger'
                    ? 'bg-red-500/12 text-red-400'
                    : 'bg-surface-3 text-text-muted';
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>;
}
// ─── Channel Message History Panel ─────────────────────────────────
export function ChannelMessageHistory({ channelId }: {
    channelId?: string;
}) {
    const { t, locale } = useI18n();
    const { channelMessages, channels, channelUsers, clearChannelMessages } = useAppStore();
    const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
    const [userFilter, setUserFilter] = useState<string>('all'); // 'all' or a senderId
    const [query, setQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const channelSenders = useMemo(() => channelId ? Object.values(channelUsers).filter((user) => user.channelId === channelId) : [], [channelId, channelUsers]);
    const scopedMessages = useMemo(() => channelMessages.filter((message) => !channelId || message.channelId === channelId), [channelId, channelMessages]);
    const getChannel = useCallback((id: string) => channels.find((channel) => channel.id === id), [channels]);
    const directionCounts = useMemo(() => scopedMessages.reduce((counts, message) => {
        counts[normalizeChannelDirection(message.direction)] += 1;
        return counts;
    }, { incoming: 0, outgoing: 0 }), [scopedMessages]);
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = useMemo(() => scopedMessages
        .filter((message) => filter === 'all' || normalizeChannelDirection(message.direction) === filter)
        .filter((message) => userFilter === 'all' || message.senderId === userFilter)
        .filter((message) => {
        if (!normalizedQuery)
            return true;
        const channelName = getChannel(message.channelId)?.name || '';
        return [
            message.content,
            message.senderName,
            message.senderId,
            channelName,
            message.status,
            normalizeChannelDirection(message.direction),
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    })
        .sort((left, right) => left.timestamp - right.timestamp), [filter, getChannel, normalizedQuery, scopedMessages, userFilter]);
    const totalMessages = scopedMessages.length;
    const selectedChannel = useMemo(() => channelId ? channels.find((channel) => channel.id === channelId) : undefined, [channelId, channels]);
    const latestMessage = filtered.at(-1);
    // Auto-scroll to the latest visible item when the channel receives new messages.
    const prevMsgCountRef = useRef(totalMessages);
    useEffect(() => {
        if (totalMessages > prevMsgCountRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        prevMsgCountRef.current = totalMessages;
    }, [totalMessages]);
    return (<div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden p-5">
      <PanelShell eyebrow={t('channels.messages', 'Messages')} title={selectedChannel ? selectedChannel.name : t('channels.messageStream', 'Message Stream')} description={t('channels.messageStreamHint', 'Review inbound and outbound traffic for this channel, then narrow the stream by direction or by a specific sender.')} action={<UiButton unstyled type="button" onClick={() => clearChannelMessages(channelId)} className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14">
            {t('common.clear', 'Clear')}
          </UiButton>}>
        <div className="grid gap-3 sm:grid-cols-4">
          <PanelStat label={t('channels.messages', 'Messages')} value={String(totalMessages)} accent/>
          <PanelStat label={t('channels.filtered', 'Filtered')} value={String(filtered.length)}/>
          <PanelStat label={t('channels.users', 'Users')} value={String(channelSenders.length)}/>
          <PanelStat label={t('channels.latest', 'Latest')} value={latestMessage ? formatChannelRelativeTime(latestMessage.timestamp, locale) : t('channels.noActivityYet', 'No activity yet')}/>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">{t('channels.searchMessages', 'Search messages')}</span>
            <IconifyIcon name="ui-search" size={15} color="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55"/>
            <UiInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('channels.searchMessagesPlaceholder', 'Search content, sender, status, or channel…')} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted/55"/>
          </label>
          <div className="flex flex-wrap gap-2 xl:justify-end">
          {(['all', 'incoming', 'outgoing'] as const).map((value) => (<UiButton unstyled key={value} type="button" onClick={() => setFilter(value)} className={`rounded-2xl border px-3.5 py-2 text-[10px] font-semibold transition-colors ${filter === value ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'}`}>
              {value === 'all'
                ? `${t('channels.filterAll', 'All')} · ${totalMessages}`
                : value === 'incoming'
                    ? `${t('channels.filterIncoming', 'Incoming')} · ${directionCounts.incoming}`
                    : `${t('channels.filterOutgoing', 'Outgoing')} · ${directionCounts.outgoing}`}
            </UiButton>))}
          {channelSenders.length > 1 && (<>
              <label className="sr-only" htmlFor="channel-user-filter">{t('channels.filterByUser', 'Filter by user')}</label>
              <UiSelect id="channel-user-filter" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} aria-label={t('channels.filterByUser', 'Filter by user')} wrapperClassName="max-w-44" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-2 text-[10px] text-text-primary">
                <option value="all">{t('channels.allUsers', 'All users')}</option>
                {channelSenders.map((user) => (<option key={user.senderId} value={user.senderId}>
                    {user.senderName} ({user.messageCount})
                  </option>))}
              </UiSelect>
            </>)}
          {(query || filter !== 'all' || userFilter !== 'all') && (<UiButton unstyled type="button" onClick={() => { setQuery(''); setFilter('all'); setUserFilter('all'); }} className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3.5 py-2 text-[10px] font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary">
              {t('channels.resetFilters', 'Reset filters')}
            </UiButton>)}
          </div>
        </div>
      </PanelShell>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-scroll overscroll-contain rounded-4xl border border-border-subtle/55 bg-surface-0/35 px-5 py-4 pr-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        {filtered.length === 0 ? (<EmptyPanelState icon="action-chat" title={totalMessages === 0 ? t('channels.noMessagesYet', 'No messages yet') : t('channels.noMatchingMessages', 'No matching messages')} description={totalMessages === 0 ? t('channels.messagesAppearHere', 'Messages from connected channels will appear here.') : t('channels.adjustMessageFilters', 'Adjust the search, direction, or sender filter to widen this stream.')}/>) : (<div className="space-y-2.5">
            {filtered.map((msg, index) => {
                const previous = filtered[index - 1];
                const showDivider = !previous || new Date(previous.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                return (<div key={msg.id}>
                  {showDivider && (<div className="sticky top-0 z-10 my-3 flex justify-center">
                      <span className="rounded-full border border-border-subtle/55 bg-surface-1/90 px-3 py-1 text-[10px] font-medium text-text-muted shadow-sm backdrop-blur">
                        {formatChannelAbsoluteTime(msg.timestamp, locale)}
                      </span>
                    </div>)}
                  <ChannelMessageBubble msg={msg} showChannel={!channelId ? (getChannel(msg.channelId)?.name || msg.channelId) : undefined}/>
                </div>);
            })}
          </div>)}
      </div>
    </div>);
}
// ─── Channel Health Monitor Panel ──────────────────────────────────
export function ChannelHealthMonitor({ singleChannelId }: {
    singleChannelId?: string;
}) {
    const { t } = useI18n();
    const { channels, channelHealth, setChannelHealth } = useAppStore();
    const [checking, setChecking] = useState(false);
    const targetChannels = useMemo(() => singleChannelId ? channels.filter((channel) => channel.id === singleChannelId) : channels, [channels, singleChannelId]);
    const checkHealth = useCallback(async () => {
        setChecking(true);
        for (const channel of targetChannels) {
            try {
                const result = await window.electron.invoke('channel:healthCheck', channel.id) as {
                    success?: boolean;
                    health?: {
                        isHealthy: boolean;
                        latencyMs: number;
                        error?: string;
                    };
                    error?: string;
                };
                if (result.success && result.health) {
                    setChannelHealth(channel.id, {
                        channelId: channel.id,
                        isHealthy: result.health.isHealthy,
                        lastCheckAt: Date.now(),
                        latencyMs: result.health.latencyMs,
                        errorCount: result.health.isHealthy ? 0 : (channelHealth[channel.id]?.errorCount || 0) + 1,
                        lastError: result.health.error,
                    });
                }
            }
            catch {
                setChannelHealth(channel.id, {
                    channelId: channel.id,
                    isHealthy: false,
                    lastCheckAt: Date.now(),
                    errorCount: (channelHealth[channel.id]?.errorCount || 0) + 1,
                    lastError: t('channels.healthCheckFailed', 'Health check failed'),
                });
            }
        }
        setChecking(false);
    }, [targetChannels, channelHealth, setChannelHealth]);
    const healthyCount = useMemo(() => targetChannels.filter((channel) => channelHealth[channel.id]?.isHealthy).length, [channelHealth, targetChannels]);
    const unhealthyCount = useMemo(() => targetChannels.filter((channel) => channelHealth[channel.id] && !channelHealth[channel.id]?.isHealthy).length, [channelHealth, targetChannels]);
    const uncheckedCount = targetChannels.length - healthyCount - unhealthyCount;
    return (<div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell eyebrow={t('channels.health', 'Health')} title={t('channels.healthStatus', 'Channel Health Status')} description={t('channels.deliveryHealthHint', 'Run active probes and compare latency, failure count, and last-check time for every configured channel in scope.')} action={<UiButton unstyled type="button" onClick={() => void checkHealth()} disabled={checking} className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18 disabled:opacity-50">
            <span className="inline-flex items-center gap-1.5">{checking ? t('channels.checking', 'Checking…') : <><IconifyIcon name="ui-search" size={14} color="currentColor"/> {t('channels.checkAll', 'Check All')}</>}</span>
          </UiButton>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.healthy', 'Healthy')} value={String(healthyCount)} accent/>
          <PanelStat label={t('channels.unhealthy', 'Unhealthy')} value={String(unhealthyCount)}/>
          <PanelStat label={t('channels.notChecked', 'Not checked')} value={String(uncheckedCount)}/>
        </div>
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {targetChannels.length === 0 ? (<EmptyPanelState icon="ui-warning" title={t('channels.noChannelsConfigured', 'No channels configured')} description={t('channels.noChannelsConfiguredHint', 'Create a channel first so the health monitor has something to probe.')}/>) : (<div className="grid gap-3 xl:grid-cols-2">
            {targetChannels.map((channel) => {
                const health = channelHealth[channel.id];
                const tone = !health ? 'neutral' : health.isHealthy ? 'success' : 'danger';
                return (<article key={channel.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/70 text-accent shadow-sm">
                        <ChannelPlatformIcon platform={channel.platform} size={18} customIcon={channel.customPlatformIcon}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[14px] font-semibold text-text-primary">{channel.name}</h4>
                          <StatusPill tone={tone}>{health ? (health.isHealthy ? t('channels.healthy', 'Healthy') : t('channels.unhealthy', 'Unhealthy')) : t('channels.notChecked', 'Not checked')}</StatusPill>
                        </div>
                        <p className="mt-1 text-[11px] text-text-muted/75">{getPlatformDisplayName(channel.platform)}</p>
                      </div>
                    </div>
                    {health?.latencyMs !== undefined && <span className="text-[11px] font-medium text-text-secondary">{health.latencyMs}ms</span>}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.lastChecked', 'Last Checked')}</div>
                      <div className="mt-1 text-text-primary">{health?.lastCheckAt ? new Date(health.lastCheckAt).toLocaleString() : t('channels.notChecked', 'Not checked')}</div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.errors', 'Errors')}</div>
                      <div className="mt-1 text-text-primary">{health?.errorCount ?? 0}</div>
                    </div>
                  </div>

                  {health?.lastError && (<div className="mt-4 rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] leading-6 text-red-400 wrap-break-word">
                      <div className="font-semibold text-red-400">{t('channels.lastError', 'Last error')}</div>
                      <p className="mt-2">{health.lastError}</p>
                    </div>)}
                </article>);
            })}
          </div>)}
      </div>
    </div>);
}
// ─── Channel Debug / Mock Mode ─────────────────────────────────────
export function ChannelDebugPanel({ defaultChannelId }: {
    defaultChannelId?: string;
}) {
    const { t } = useI18n();
    const { channels } = useAppStore();
    const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId || channels[0]?.id || '');
    const [mockMessage, setMockMessage] = useState('');
    const [debugLog, setDebugLog] = useState<Array<{
        time: string;
        text: string;
        tone: 'info' | 'success' | 'error';
    }>>([]);
    const [logQuery, setLogQuery] = useState('');
    const [logToneFilter, setLogToneFilter] = useState<'all' | 'info' | 'success' | 'error'>('all');
    const [sending, setSending] = useState(false);
    useEffect(() => {
        setSelectedChannelId(defaultChannelId || channels[0]?.id || '');
    }, [channels, defaultChannelId]);
    const selectedChannel = useMemo(() => channels.find((channel) => channel.id === selectedChannelId), [channels, selectedChannelId]);
    const errorCount = useMemo(() => debugLog.filter((entry) => entry.tone === 'error').length, [debugLog]);
    const filteredLog = useMemo(() => {
        const normalized = logQuery.trim().toLowerCase();
        return debugLog.filter((entry) => {
            const toneMatches = logToneFilter === 'all' || entry.tone === logToneFilter;
            const queryMatches = !normalized || entry.text.toLowerCase().includes(normalized) || entry.time.toLowerCase().includes(normalized) || entry.tone.includes(normalized);
            return toneMatches && queryMatches;
        });
    }, [debugLog, logQuery, logToneFilter]);
    const sendMock = async () => {
        if (!selectedChannelId || !mockMessage.trim())
            return;
        setSending(true);
        const time = new Date().toLocaleTimeString();
        setDebugLog((prev) => [...prev, {
                time,
                text: t('channels.debugSendingMock', 'Sending mock: "{message}"').replace('{message}', mockMessage),
                tone: 'info',
            }]);
        try {
            const result = await window.electron.invoke('channel:debugSend', selectedChannelId, mockMessage) as {
                success?: boolean;
                error?: string;
            };
            if (result.success) {
                setDebugLog((prev) => [...prev, {
                        time: new Date().toLocaleTimeString(),
                        text: t('channels.debugMockSuccess', 'Mock message processed successfully'),
                        tone: 'success',
                    }]);
            }
            else {
                setDebugLog((prev) => [...prev, {
                        time: new Date().toLocaleTimeString(),
                        text: result.error
                            ? t('channels.debugError', 'Error: {message}').replace('{message}', result.error)
                            : t('channels.statusFailed', 'Failed'),
                        tone: 'error',
                    }]);
            }
        }
        catch (err) {
            setDebugLog((prev) => [...prev, {
                    time: new Date().toLocaleTimeString(),
                    text: t('channels.debugError', 'Error: {message}').replace('{message}', err instanceof Error ? err.message : String(err)),
                    tone: 'error',
                }]);
        }
        setMockMessage('');
        setSending(false);
    };
    return (<div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell eyebrow={t('channels.debug', 'Debug')} title={t('channels.debugMockMode', 'Debug / Mock Mode')} description={t('channels.debugMockModeHint', 'Send simulated inbound events without connecting to a real platform, then inspect the exact local debug log produced by the handler.')} action={debugLog.length > 0 ? (<UiButton unstyled type="button" onClick={() => setDebugLog([])} className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14">
            {t('common.clear', 'Clear')}
          </UiButton>) : undefined}>
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.channel', 'Channel')} value={selectedChannel?.name || t('common.none', 'None')} accent/>
          <PanelStat label={t('settings.entries', 'Entries')} value={String(debugLog.length)}/>
          <PanelStat label={t('settings.errors', 'Errors')} value={String(errorCount)}/>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[0.75fr_1.25fr_auto]">
          <UiSelect value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} aria-label={t('channels.selectChannel', 'Select channel')} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-3 text-sm text-text-primary">
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name} ({getPlatformDisplayName(channel.platform)})</option>)}
          </UiSelect>
              <UiInput value={mockMessage} onChange={(e) => setMockMessage(e.target.value)} placeholder={t('channels.mockMessagePlaceholder', 'Type a mock message...')} wrapperClassName="w-full" onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void sendMock();
            } }} controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-3 text-sm text-text-primary placeholder:text-text-muted/55"/>
          <UiButton unstyled type="button" onClick={() => void sendMock()} disabled={sending || !mockMessage.trim() || !selectedChannelId} className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
            {sending ? t('common.sending', 'Sending…') : t('common.send', 'Send')}
          </UiButton>
        </div>

        {debugLog.length > 0 && (<div className="mt-3 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">{t('channels.searchDebugLog', 'Search debug log')}</span>
              <IconifyIcon name="ui-search" size={15} color="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55"/>
              <UiInput value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder={t('channels.searchDebugLogPlaceholder', 'Search local trace…')} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted/55"/>
            </label>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {(['all', 'info', 'success', 'error'] as const).map((tone) => (<UiButton unstyled key={tone} type="button" onClick={() => setLogToneFilter(tone)} className={`rounded-2xl border px-3.5 py-2 text-[10px] font-semibold transition-colors ${logToneFilter === tone ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'}`}>
                  {tone === 'all' ? t('channels.filterAll', 'All') : tone === 'info' ? t('channels.logInfo', 'Info') : tone === 'success' ? t('channels.logSuccess', 'Success') : t('channels.logError', 'Error')}
                </UiButton>))}
            </div>
          </div>)}
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-4xl border border-border-subtle/55 bg-surface-0/35 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        {debugLog.length === 0 ? (<EmptyPanelState icon="ui-search" title={t('channels.debugLogEmpty', 'Debug log will appear here')} description={t('channels.debugLogEmptyHint', 'Send a mock message to the selected channel and the local execution trace will start filling this panel.')}/>) : filteredLog.length === 0 ? (<EmptyPanelState icon="ui-search" title={t('channels.noMatchingLogs', 'No matching log entries')} description={t('channels.adjustLogFilters', 'Adjust the trace search or severity filter to show more local events.')}/>) : (<div className="space-y-2 font-mono text-xs">
            {filteredLog.map((entry, index) => (<div key={`${entry.time}-${index}`} className={`rounded-2xl border px-4 py-3 ${entry.tone === 'error' ? 'border-red-500/18 bg-red-500/8' : entry.tone === 'success' ? 'border-green-500/18 bg-green-500/8' : 'border-border-subtle/45 bg-surface-2/55'}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="shrink-0 rounded bg-surface-0/60 px-1.5 py-0.5 text-text-muted">[{entry.time}]</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${entry.tone === 'error' ? 'bg-red-500/12 text-red-400' : entry.tone === 'success' ? 'bg-green-500/12 text-green-400' : 'bg-accent/10 text-accent'}`}>
                    {entry.tone}
                  </span>
                  <span className={`min-w-0 flex-1 wrap-break-word ${entry.tone === 'error' ? 'text-red-400' : entry.tone === 'success' ? 'text-green-400' : 'text-text-secondary'}`}>
                    {entry.text}
                  </span>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
// ─── Channel Users Panel (multi-user tracking) ────────────────────
export function ChannelUsersPanel({ channelId }: {
    channelId: string;
}) {
    const { t, locale } = useI18n();
    const { channelUsers, clearChannelUsers } = useAppStore();
    const users = useMemo(() => Object.values(channelUsers)
        .filter((user) => user.channelId === channelId)
        .sort((left, right) => right.lastActiveAt - left.lastActiveAt), [channelId, channelUsers]);
    const activeTodayCount = useMemo(() => users.filter((user) => Date.now() - user.lastActiveAt < 86400000).length, [users]);
    const totalMessages = useMemo(() => users.reduce((sum, user) => sum + user.messageCount, 0), [users]);
    return (<div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell eyebrow={t('channels.users', 'Users')} title={t('channels.channelUsers', 'Channel Users')} description={t('channels.channelUsersHint', 'Track who is active on this channel, how much they have messaged, and what recent conversational context is still attached to them.')} action={users.length > 0 ? (<UiButton unstyled type="button" onClick={() => clearChannelUsers(channelId)} className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14">
            {t('channels.clearUsers', 'Clear Users')}
          </UiButton>) : undefined}>
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.users', 'Users')} value={String(users.length)} accent/>
          <PanelStat label={t('channels.activeToday', 'Active Today')} value={String(activeTodayCount)}/>
          <PanelStat label={t('channels.messages', 'Messages')} value={String(totalMessages)}/>
        </div>
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {users.length === 0 ? (<EmptyPanelState icon="ui-user" title={t('channels.noUsersYet', 'No users yet')} description={t('channels.noUsersYetHint', 'Users will appear here once messages arrive and the channel has enough activity to build conversation context.')}/>) : (<div className="grid gap-3 xl:grid-cols-2">
            {users.map((user) => (<article key={user.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-linear-to-br from-accent/20 to-accent/5 shadow-sm">
                      <ChannelPlatformIcon platform={user.platform} size={18}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-text-primary truncate">{user.senderName}</div>
                      <div className="mt-1 text-[11px] text-text-muted/75 truncate">{user.senderId}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-text-secondary">
                    <div className="font-semibold text-accent">{user.messageCount} {t('channels.messages', 'messages')}</div>
                    <div className="mt-1 text-text-muted/75">{formatChannelRelativeTime(user.lastActiveAt, locale, t('channels.noActivityYet', 'No activity yet'))}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.firstSeen', 'First Seen')}</div>
                    <div className="mt-1 text-text-primary">{new Date(user.firstSeenAt).toLocaleString()}</div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.lastActive', 'Last Active')}</div>
                    <div className="mt-1 text-text-primary">{new Date(user.lastActiveAt).toLocaleString()}</div>
                  </div>
                </div>

                {user.conversationHistory.length > 0 && (<div className="mt-4 rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.recentContext', 'Recent Context')}</div>
                    <div className="mt-3 space-y-2">
                      {user.conversationHistory.slice(-3).map((entry, index) => (<div key={`${entry.timestamp}-${index}`} className="flex items-start gap-2 text-[11px]">
                          <span className={`mt-0.5 shrink-0 font-medium ${entry.role === 'user' ? 'text-accent/80' : 'text-green-400/80'}`}>
                            {entry.role === 'user' ? '→' : '←'}
                          </span>
                          <span className="text-text-secondary wrap-break-word">{entry.content}</span>
                        </div>))}
                    </div>
                  </div>)}
              </article>))}
          </div>)}
      </div>
    </div>);
}


