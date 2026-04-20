import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import {
  rebuildIndexFromStore,
  getIndex,
  getIndexStats,
  searchSimilar,
} from '@/services/vectorMemory'
import { SettingsSection, SettingsStat, settingsInputClass } from './panelUi'

export function KnowledgeSettings() {
  const { t } = useI18n()
  const [kbStats, setKbStats] = useState({ totalMemories: 0, vocabularySize: 0, indexSize: 0 })
  const [kbQuery, setKbQuery] = useState('')
  const [kbResults, setKbResults] = useState<Array<{ id: string; content: string; score: number }>>([])
  const [kbRebuilding, setKbRebuilding] = useState(false)

  const refreshKbStats = useCallback(() => {
    const index = getIndex()
    setKbStats(getIndexStats(index))
  }, [])

  useEffect(() => {
    const index = getIndex()
    if (index.size === 0) {
      rebuildIndexFromStore()
    }
    refreshKbStats()
  }, [refreshKbStats])

  const runSearch = () => {
    let index = getIndex()
    if (index.size === 0) index = rebuildIndexFromStore()
    setKbResults(searchSimilar(index, kbQuery, 10))
  }

  const topScore = useMemo(() => kbResults[0]?.score ?? 0, [kbResults])

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.vectorMemoryIndex', 'Vector Memory Index')}
        title={t('settings.semanticMemoryLab', 'Semantic Memory Lab')}
        description={t('settings.rebuildIndexDesc', 'The index is automatically maintained when memories are added or removed. Use rebuild when you want to recompute the full TF-IDF corpus from scratch.')}
        action={
          <button
            type="button"
            onClick={() => {
              setKbRebuilding(true)
              requestAnimationFrame(() => {
                try {
                  rebuildIndexFromStore()
                  refreshKbStats()
                } finally {
                  setKbRebuilding(false)
                }
              })
            }}
            disabled={kbRebuilding}
            className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">{kbRebuilding ? t('settings.rebuilding', 'Rebuilding…') : <><IconifyIcon name="ui-refresh" size={14} color="currentColor" /> {t('settings.rebuildIndex', 'Rebuild Index')}</>}</span>
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsStat label={t('settings.totalMemories', 'Total Memories')} value={String(kbStats.totalMemories)} accent />
          <SettingsStat label={t('settings.indexedEntries', 'Indexed Entries')} value={String(kbStats.indexSize)} />
          <SettingsStat label={t('settings.vocabularySize', 'Vocabulary Size')} value={String(kbStats.vocabularySize)} />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.testSemanticSearch', 'Test Semantic Search')}
        title={t('settings.queryWorkbench', 'Query Workbench')}
        description={t('settings.queryWorkbenchHint', 'Probe the in-browser semantic index with a sample query to see what memories would be recalled first.')}
        action={
          <button
            type="button"
            onClick={runSearch}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover"
          >
            {t('settings.search', 'Search')}
          </button>
        }
      >
        <div className="flex gap-3">
          <input
            value={kbQuery}
            onChange={(event) => setKbQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                runSearch()
              }
            }}
            placeholder={t('settings.searchPlaceholder', 'Enter a query to test semantic search…')}
            className={settingsInputClass}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.resultCount', 'Result Count')}</div>
            <div className="mt-2 text-lg font-semibold text-text-primary">{kbResults.length}</div>
          </div>
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.topScore', 'Top Score')}</div>
            <div className="mt-2 text-lg font-semibold text-text-primary">{topScore.toFixed(3)}</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {kbResults.length > 0 ? (
            kbResults.map((result) => (
              <div key={result.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-[12px] leading-6 text-text-secondary wrap-break-word">{result.content}</div>
                  <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-1 text-[10px] font-medium text-accent">{result.score.toFixed(3)}</span>
                </div>
              </div>
            ))
          ) : kbQuery ? (
            <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                <IconifyIcon name="ui-search" size={18} color="currentColor" />
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.noResults', 'No results. Try rebuilding the index or adding some memories first.')}</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                <IconifyIcon name="ui-search" size={18} color="currentColor" />
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.searchReady', 'Enter a query to inspect how semantic recall will rank stored memories.')}</p>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  )
}
