import { SessionList } from './SessionList'
import { ChatMain } from './ChatMain'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'

export function ChatLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('chat-sessions', 340)

  return (
    <>
      <SessionList width={panelWidth} />
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={260} maxWidth={560} />
      <ChatMain />
    </>
  )
}
