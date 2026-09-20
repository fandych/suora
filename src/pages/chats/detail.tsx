import { useState } from "react"
import { useNavigate } from "react-router"
import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ChatComposer } from "@/pages/chats/components/chat-composer"
import { ChatTranscript } from "@/pages/chats/components/chat-transcript"
import PageHeader from "@/pages/components/page-header"
import { RecentlyDeletedDialog } from "@/pages/components/recently-deleted-dialog"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { useChatDetailController } from "@/hooks/use-chat-detail-controller"
import { emitDataChanged } from "@/services/data-events"

const ChatDetailPage = () => {
  const controller = useChatDetailController()
  const navigate = useNavigate()
  const [isRecentlyDeletedOpen, setIsRecentlyDeletedOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader
        title={controller.selectedChat?.chat.title ?? "New chat"}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRecentlyDeletedOpen(true)}>
            <RotateCcwIcon className="size-4" />
            Recently deleted
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {controller.activeChatId && controller.isLoading && !controller.selectedChat ? (
          <LoadingCard title="Loading chat session..." />
        ) : null}
        {controller.settingsLoading && !controller.settingsDraft ? (
          <LoadingCard title="Loading chat runtime settings..." />
        ) : null}
        {controller.combinedError ? (
          <ErrorCard
            error={controller.combinedError}
            onRetry={() => {
              controller.reload()
              controller.reloadSettings()
            }}
          />
        ) : null}
        {!controller.combinedError && controller.settingsDraft ? (
          <Card size="sm" className="min-h-0 flex-1 rounded-none py-0 shadow-sm overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <CardContent className="relative flex min-h-0 flex-1 overflow-hidden -mb-(--card-spacing) px-0">
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <ChatTranscript
                    activeProviderType={controller.activeProviderType}
                    assistantResponseMessageId={controller.assistantResponseMessageId}
                    assistantResponseParts={controller.assistantResponseParts}
                    autoScroll={controller.autoScroll}
                    hasOlderMessages={controller.hasOlderMessages}
                    isLoadingOlderMessages={controller.isLoadingOlderMessages}
                    onLoadEarlierMessages={controller.handleLoadEarlierMessages}
                    onRetryTool={(messageId, activity) => void controller.handleRetryTool(messageId, activity)}
                    selectedChat={controller.selectedChat}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex-none min-h-0 flex-col items-stretch gap-3 bg-card">
                <ChatComposer
                  agents={controller.agents}
                  attachments={controller.attachments}
                  autoScroll={controller.autoScroll}
                  browserState={controller.browserInteractionState}
                  browserSessionId={controller.activeChatId}
                  draft={controller.draft}
                  exportDisabled={
                    controller.isResponding ||
                    (!controller.selectedChat && !controller.streamingText && controller.toolEvents.length === 0)
                  }
                  groupedProviders={controller.groupedProviders}
                  isResponding={controller.isResponding}
                  isStopping={controller.isStopping}
                  modelValue={controller.modelValue}
                  toolEvents={controller.toolEvents}
                  onAttachmentChange={controller.handleAttachmentChange}
                  onAutoScrollChange={controller.setAutoScroll}
                  onContinueAfterBrowser={controller.handleContinueAfterBrowser}
                  onRetryBrowser={controller.handleRetryBrowser}
                  onDraftChange={controller.setDraft}
                  onExportChat={controller.handleExportChat}
                  onModelChange={controller.onModelChange}
                  onRemoveAttachment={controller.removeAttachment}
                  onSelectedAgentChange={controller.onSelectedAgentChange}
                  onSend={controller.handleSend}
                  onStop={controller.handleStop}
                  pendingBrowserContinue={controller.pendingBrowserContinue}
                  selectedAgentId={controller.selectedAgentId}
                  settingsDraft={controller.settingsDraft}
                  supportsAttachments={controller.supportsAttachments}
                />
              </CardFooter>
            </div>
          </Card>
        ) : null}
      </div>
      <RecentlyDeletedDialog
        kind="chat"
        open={isRecentlyDeletedOpen}
        onOpenChange={setIsRecentlyDeletedOpen}
        onRestored={async (result) => {
          emitDataChanged("/chats")
          navigate(`/chats/${result.resourceId}`)
        }}
        title="Restore deleted chats"
      />
    </div>
  )
}

export default ChatDetailPage
