import { Suspense, lazy, useEffect, useState } from 'react'
import { ChatMain } from './ChatMain'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { scheduleAfterPaint } from '@/utils/scheduling'

const LazySessionList = lazy(() => import('./SessionList').then((module) => ({ default: module.SessionList })))

function SessionRailSkeleton({ width }: { width: number }) {
  return <div aria-hidden="true" style={{ width }} className="h-full shrink-0 border-r border-border-subtle/80 bg-surface-1/92" />
}

export function ChatLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('chat-sessions', 360)
  const [showSessionList, setShowSessionList] = useState(false)

  useEffect(() => {
    const scheduled = scheduleAfterPaint(() => setShowSessionList(true))
    return () => scheduled.cancel()
  }, [])

  return (
    <div className="module-workspace chat-workbench relative flex min-h-0 flex-1 min-w-0 overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1 min-w-0 overflow-hidden">
        {showSessionList ? (
          <Suspense fallback={<SessionRailSkeleton width={panelWidth} />}>
            <LazySessionList width={panelWidth} />
          </Suspense>
        ) : (
          <SessionRailSkeleton width={panelWidth} />
        )}
        <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={420} />
        <ChatMain />
      </div>
    </div>
  )
}
