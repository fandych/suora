import { useEffect, useMemo, useRef, useState } from "react"
import { PaperclipIcon, XIcon, MicIcon, SendHorizonalIcon } from "lucide-react"
import { useNavigate, useParams } from "react-router"

import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { ChatMessageItem } from "@/views/chats/components/chat-message-item"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listAgents } from "@/data/repositories/agent-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { appendAssistantChatMessage, appendUserChatMessage, createChat, getChatDetail } from "@/data/repositories/chat-repository"
import { getChatRuntimeSettings, saveChatRuntimeSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { downloadText, exportTextAsDocx, exportTextAsPdf } from "@/lib/browser-files"
import { streamChatAgentResponse, type ChatAgentEvent, type ChatAttachment } from "@/services/ai-service"
import { ScrollArea } from "@/components/ui/scroll-area"

type ChatProviderType = ChatRuntimeSettings["model"]["providerType"]

function isChatProviderType(value: string): value is ChatProviderType {
  return ["ollama", "openai", "anthropic", "openai-compatible", "google"].includes(value)
}

const ChatDetailPage = () => {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState("")
  const [toolEvents, setToolEvents] = useState<ChatAgentEvent[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [isResponding, setIsResponding] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<ChatRuntimeSettings | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(chatId ?? null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageViewportRef = useRef<HTMLDivElement | null>(null)

  const { data, error, isLoading, reload, setData } = useAsyncResource(
    async () => {
      if (!activeChatId) {
        return null
      }

      return getChatDetail(activeChatId)
    },
    [activeChatId]
  )
  const { data: runtimeSettings, error: settingsError, isLoading: settingsLoading, reload: reloadSettings, setData: setRuntimeSettings } = useAsyncResource(
    () => getChatRuntimeSettings(),
    []
  )
  const { data: agentsData } = useAsyncResource(() => listAgents(), [])
  const { data: providerData } = useAsyncResource(() => listConfiguredModelProviders(), [])
  const agents = useMemo(() => agentsData ?? [], [agentsData])
  const providers = useMemo(() => providerData ?? [], [providerData])
  const selectedChat = data
  const groupedProviders = providers.filter((provider) => provider.models.length > 0)
  const selectedModelRecord = providers.flatMap((provider) => provider.models).find((model) => model.id === settingsDraft?.model.modelId) ?? null
  const activeProviderType = providers.find((provider) => provider.id === settingsDraft?.model.providerId)?.providerType ?? settingsDraft?.model.providerType ?? "openai"
  const supportsAttachments = Boolean(selectedModelRecord?.capabilities?.includes("vision") || ["anthropic", "google", "openai"].includes(activeProviderType))

  useEffect(() => {
    setActiveChatId(chatId ?? null)
  }, [chatId])

  useEffect(() => {
    if (runtimeSettings) {
      setSettingsDraft(runtimeSettings)
    }
  }, [runtimeSettings])

  useEffect(() => {
    if (!selectedAgentId && agents.some((agent) => agent.id === "agent-general-assistant")) {
      setSelectedAgentId("agent-general-assistant")
    }
  }, [agents, selectedAgentId])

  useEffect(() => {
    if (!autoScroll) {
      return
    }

    const viewport = messageViewportRef.current?.querySelector("[data-slot='scroll-area-viewport']") as HTMLDivElement | null
    if (!viewport) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
    })

    return () => window.cancelAnimationFrame(frame)
  }, [autoScroll, selectedChat?.messages, toolEvents, streamingText])

  const combinedError = (activeChatId ? error : null) ?? settingsError

  const modelValue = useMemo(() => {
    if (!settingsDraft) {
      return ""
    }

    return `${settingsDraft.model.providerId}::${settingsDraft.model.modelId}`
  }, [settingsDraft])

  const applyRuntimeSettings = (next: ChatRuntimeSettings) => {
    setSettingsDraft(next)
    void saveChatRuntimeSettings(next).then((saved) => {
      setRuntimeSettings(saved)
      setSettingsDraft(saved)
    })
  }

  const handleSend = async () => {
    if ((!draft.trim() && attachments.length === 0) || !settingsDraft || isResponding) {
      return
    }

    let workingChatId = activeChatId
    let baseDetail = selectedChat

    if (!workingChatId || !baseDetail) {
      const created = await createChat()
      workingChatId = created.chat.id
      baseDetail = created
      setActiveChatId(created.chat.id)
      setData(created)
      emitDataChanged("/chats")
      navigate(`/chats/${created.chat.id}`, { replace: true })
    }

    if (!workingChatId || !baseDetail) {
      return
    }

    const outgoingText = draft.trim() || attachments.map((attachment) => `[Attachment] ${attachment.name}`).join("\n")
    const next = await appendUserChatMessage(workingChatId, outgoingText)
    setData(next)
    setDraft("")
    setToolEvents([])
    setStreamingText("")
    setIsResponding(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let finalText = ""

      for await (const event of streamChatAgentResponse(next.messages, settingsDraft, {
        abortSignal: abortController.signal,
        selectedAgentId: selectedAgentId || undefined,
        attachments,
      })) {
        if (event.type === "text-delta") {
          finalText += event.text
          setStreamingText((value) => value + event.text)
          continue
        }

        setToolEvents((value) => [...value, event])
      }

      if (finalText.trim()) {
        const withAssistant = await appendAssistantChatMessage(workingChatId, finalText.trim())
        setData(withAssistant)
        emitDataChanged("/chats")
      }
    } catch (nextError) {
      setToolEvents((value) => [...value, { type: "error", error: nextError instanceof Error ? nextError.message : String(nextError) }])
    } finally {
      abortControllerRef.current = null
      setIsResponding(false)
      setStreamingText("")
      setAttachments([])
    }
  }

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const nextAttachments = await Promise.all(files.map(async (file) => ({
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      kind: file.type.startsWith("image/") ? "image" as const : "file" as const,
      data: await fileToPayload(file),
    })))

    setAttachments((current) => [...current, ...nextAttachments])
    event.target.value = ""
  }

  const removeAttachment = (attachmentName: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.name !== attachmentName))
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const buildTranscript = () => {
    const messageBlocks = (selectedChat?.messages ?? []).map((message) => `${message.role.toUpperCase()}\n${message.content}`).join("\n\n")
    const toolBlocks = toolEvents.map((event) => {
      if (event.type === "tool-call") {
        return `TOOL CALL ${event.toolName}\n${JSON.stringify(event.input, null, 2)}`
      }
      if (event.type === "tool-result") {
        return `TOOL RESULT ${event.toolName}\n${event.output}`
      }
      if (event.type === "error") {
        return `ERROR\n${event.error}`
      }
      return ""
    }).join("\n\n")
    return [messageBlocks, streamingText ? `ASSISTANT (STREAMING)\n${streamingText}` : "", toolBlocks].filter(Boolean).join("\n\n")
  }

  const handleExportChat = async (format: "markdown" | "pdf" | "docx") => {
    const baseName = `${selectedChat?.chat.title || "chat"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "chat"
    const transcript = buildTranscript()
    if (format === "markdown") {
      downloadText(`${baseName}.md`, transcript, "text/markdown;charset=utf-8")
      return
    }
    if (format === "pdf") {
      await exportTextAsPdf(`${baseName}.pdf`, transcript)
      return
    }
    await exportTextAsDocx(`${baseName}.docx`, transcript)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader
        title={selectedChat?.chat.title ?? "New chat"}
        description={selectedChat?.chat.summary || "Use the workbench to resume a session or start a fresh conversation thread."}
        actions={
          <>
            <Badge variant="outline">Chat workbench</Badge>
            {isResponding ? <Button variant="outline" onClick={handleStop}>Stop</Button> : null}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {activeChatId && isLoading ? <LoadingCard title="Loading chat session..." /> : null}
        {settingsLoading ? <LoadingCard title="Loading chat runtime settings..." /> : null}
        {combinedError ? <ErrorCard error={combinedError} onRetry={() => { reload(); reloadSettings() }} /> : null}
        {!settingsLoading && !combinedError && settingsDraft ? (
          <Card size="sm" className="min-h-0 flex-1 rounded-2xl py-0 shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              <CardContent className="grow min-h-0 -mb-(--card-spacing) px-0">
                <div ref={messageViewportRef} className="h-full min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 border-t bg-muted/20 px-(--card-spacing) py-4">
                      {selectedChat?.messages.map((message) => (
                        <ChatMessageItem key={message.id} content={message.content} createdAt={message.createdAt} label={message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "System"} providerType={activeProviderType} role={message.role} />
                      ))}
                      {toolEvents.map((event, index) => (
                        <ChatMessageItem key={`${event.type}-${index}`} content={event.type === "tool-call" ? `tool ${event.toolName} called with ${JSON.stringify(event.input, null, 2)}` : event.type === "tool-result" ? `tool ${event.toolName} returned ${event.output}` : event.type === "error" ? `error: ${event.error}` : event.text} label="Tool event" kind="tool" providerType={activeProviderType} role="system" />
                      ))}
                      {isResponding && streamingText ? (
                        <ChatMessageItem content={streamingText} label="Assistant" providerType={activeProviderType} role="assistant" />
                      ) : null}
                      <div className="h-px shrink-0" />
                    </div>
                  </ScrollArea>
                </div>
                {!selectedChat && !isResponding ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    <div className="w-full max-w-2xl rounded-2xl border border-dashed bg-background/88 px-6 py-12 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-xs">
                      Start typing below to create a new chat. Existing sessions stay available in the sidebar.
                    </div>
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="flex-none flex-col items-stretch gap-3 bg-card">
              <div className="flex min-w-0 items-end gap-2">
                <Input className="h-11 min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about documents, workflows, or skills..." disabled={isResponding} />
                {supportsAttachments ? (
                  <>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void handleAttachmentChange(event)} />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isResponding}>
                      <PaperclipIcon />
                    </Button>
                  </>
                ) : null}
              </div>
              {attachments.length ? (
                <AttachmentGroup>
                  {attachments.map((attachment) => (
                    <Attachment key={`${attachment.name}-${attachment.data.length}`} size="sm">
                      <AttachmentMedia variant={attachment.kind === "image" ? "image" : "icon"}>
                        {attachment.kind === "image" ? <img src={attachment.data} alt={attachment.name} className="size-full object-cover" /> : <PaperclipIcon className="size-4" />}
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>{attachment.name}</AttachmentTitle>
                        <AttachmentDescription>{attachment.mediaType}</AttachmentDescription>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction size="icon-xs" variant="ghost" onClick={() => removeAttachment(attachment.name)}>
                          <XIcon />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </AttachmentGroup>
              ) : null}
              <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <NativeSelect className="min-w-0 w-full sm:w-32" size="sm" value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                    <NativeSelectOption value="">Agent</NativeSelectOption>
                    {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
                  </NativeSelect>
                  <NativeSelect className="min-w-0 w-full sm:w-44" size="sm" value={modelValue} onChange={(event) => {
                    const [providerId, modelId] = event.target.value.split("::")
                    const provider = groupedProviders.find((item) => item.id === providerId)
                    if (!provider || !settingsDraft) {
                      return
                    }

                    const nextSettings = {
                      ...settingsDraft,
                      model: {
                        ...settingsDraft.model,
                        providerId: provider.id,
                        providerType: isChatProviderType(provider.providerType) ? provider.providerType : settingsDraft.model.providerType,
                        baseUrl: provider.baseUrl,
                        apiKey: provider.apiKey,
                        modelId,
                      },
                    }
                    applyRuntimeSettings(nextSettings)
                  }}>
                    <NativeSelectOption value="">Model</NativeSelectOption>
                    {groupedProviders.map((provider) => (
                      <NativeSelectOptGroup key={provider.id} label={provider.title}>
                        {provider.models.map((model) => <NativeSelectOption key={`${provider.id}-${model.id}`} value={`${provider.id}::${model.id}`}>{model.name}</NativeSelectOption>)}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                  <label className="flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                    <span>Auto scroll</span>
                    <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="h-8 text-xs" />}>Export</DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36 min-w-36">
                      <DropdownMenuItem onClick={() => void handleExportChat("markdown")}>Markdown</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleExportChat("pdf")}>PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleExportChat("docx")}>DOCX</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
                  <Button size="sm" variant="outline" disabled>
                    <MicIcon />
                  </Button>
                  <Button size="sm" onClick={() => void handleSend()} disabled={isResponding || (!draft.trim() && attachments.length === 0)}>
                    <SendHorizonalIcon />
                    Send
                  </Button>
                </div>
              </div>
              </CardFooter>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

async function fileToPayload(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })
}

export default ChatDetailPage