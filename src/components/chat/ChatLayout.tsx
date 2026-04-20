import { SessionList } from './SessionList'
import { ChatMain } from './ChatMain'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'

export function ChatLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('chat-sessions', 360)

  return (
    <div className="chat-workbench relative flex min-h-0 flex-1 min-w-0 overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1 min-w-0 overflow-hidden">
        <SessionList width={panelWidth} />
        <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={620} />
        <ChatMain />
      </div>
    </div>
  )
}
