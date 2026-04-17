import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import {
  rebuildIndexFromStore,
  getIndex,
  getIndexStats,
  searchSimilar,
} from '@/services/vectorMemory'

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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.vectorMemoryIndex', 'Vector Memory Index')}</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{kbStats.totalMemories}</div>
            <div className="text-xs text-text-muted mt-1">{t('settings.totalMemories', 'Total Memories')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{kbStats.indexSize}</div>
            <div className="text-xs text-text-muted mt-1">{t('settings.indexedEntries', 'Indexed Entries')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{kbStats.vocabularySize}</div>
            <div className="text-xs text-text-muted mt-1">{t('settings.vocabularySize', 'Vocabulary Size')}</div>
          </div>
        </div>
        <button
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
          className="px-4 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {kbRebuilding ? t('settings.rebuilding', 'Rebuilding…') : <><IconifyIcon name="ui-refresh" size={14} color="currentColor" /> {t('settings.rebuildIndex', 'Rebuild Index')}</>}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          {t('settings.rebuildIndexDesc', 'The index is automatically maintained when memories are added or removed. Use rebuild to recalculate all TF-IDF weights from scratch.')}
        </p>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.testSemanticSearch', 'Test Semantic Search')}</h3>
        <div className="flex gap-2 mb-3">
          <input
            value={kbQuery}
            onChange={(e) => setKbQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                let index = getIndex()
                if (index.size === 0) index = rebuildIndexFromStore()
                setKbResults(searchSimilar(index, kbQuery, 10))
              }
            }}
            placeholder={t('settings.searchPlaceholder', 'Enter a query to test semantic search…')}
            className="flex-1 px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => {
              let index = getIndex()
              if (index.size === 0) index = rebuildIndexFromStore()
              setKbResults(searchSimilar(index, kbQuery, 10))
            }}
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {t('settings.search', 'Search')}
          </button>
        </div>
        {kbResults.length > 0 && (
          <div className="space-y-2">
            {kbResults.map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-xs bg-surface-2 rounded-lg px-3 py-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono">{r.score.toFixed(3)}</span>
                <span className="text-text-secondary break-all">{r.content}</span>
              </div>
            ))}
          </div>
        )}
        {kbQuery && kbResults.length === 0 && (
          <p className="text-xs text-text-muted">{t('settings.noResults', 'No results. Try rebuilding the index or adding some memories first.')}</p>
        )}
      </div>
    </div>
  )
}
