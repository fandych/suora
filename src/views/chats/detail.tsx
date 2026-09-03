import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ChatComposer } from "@/views/chats/components/chat-composer"
import { ChatTranscript } from "@/views/chats/components/chat-transcript"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useChatDetailController } from "@/views/chats/use-chat-detail-controller"

const ChatDetailPage = () => {
  const controller = useChatDetailController()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader
        title={controller.selectedChat?.chat.title ?? "New chat"}
        description={controller.selectedChat?.chat.summary || "Use the workbench to resume a session or start a fresh conversation thread."}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {controller.activeChatId && controller.isLoading && !controller.selectedChat ? <LoadingCard title="Loading chat session..." /> : null}
        {controller.settingsLoading && !controller.settingsDraft ? <LoadingCard title="Loading chat runtime settings..." /> : null}
        {controller.combinedError ? <ErrorCard error={controller.combinedError} onRetry={() => { controller.reload(); controller.reloadSettings() }} /> : null}
        {!controller.combinedError && controller.settingsDraft ? (
          <Card size="sm" className="min-h-0 flex-1 rounded-none py-0 shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              <CardContent className="relative flex min-h-0 flex-1 overflow-hidden -mb-(--card-spacing) px-0">
                <ChatTranscript activeProviderType={controller.activeProviderType} assistantResponseMessageId={controller.assistantResponseMessageId} assistantResponseParts={controller.assistantResponseParts} autoScroll={controller.autoScroll} onRetryTool={(messageId, activity) => void controller.handleRetryTool(messageId, activity)} selectedChat={controller.selectedChat} />
              </CardContent>

              <CardFooter className="flex-none flex-col items-stretch gap-3 bg-card">
                <ChatComposer
                  agents={controller.agents}
                  attachments={controller.attachments}
                  autoScroll={controller.autoScroll}
                  draft={controller.draft}
                  exportDisabled={controller.isResponding || (!controller.selectedChat && !controller.streamingText && controller.toolEvents.length === 0)}
                  groupedProviders={controller.groupedProviders}
                  isResponding={controller.isResponding}
                  modelValue={controller.modelValue}
                  toolEvents={controller.toolEvents}
                  onAttachmentChange={controller.handleAttachmentChange}
                  onAutoScrollChange={controller.setAutoScroll}
                  onDraftChange={controller.setDraft}
                  onExportChat={controller.handleExportChat}
                  onModelChange={controller.onModelChange}
                  onRemoveAttachment={controller.removeAttachment}
                  onSelectedAgentChange={controller.onSelectedAgentChange}
                  onSend={controller.handleSend}
                  onStop={controller.handleStop}
                  selectedAgentId={controller.selectedAgentId}
                  settingsDraft={controller.settingsDraft}
                  supportsAttachments={controller.supportsAttachments}
                />
              </CardFooter>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

export default ChatDetailPage