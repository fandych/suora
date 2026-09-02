import { useEffect, useMemo, useRef, useState } from "react"
import { MicIcon, SendHorizonalIcon } from "lucide-react"
import { useNavigate, useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Message, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport } from "@/components/ui/message-scroller"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { ChatDetail } from "@/data/domain/models"
import { listAgents } from "@/data/repositories/agent-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { appendAssistantChatMessage, appendUserChatMessage, createChat, getChatDetail } from "@/data/repositories/chat-repository"
import { getChatRuntimeSettings, saveChatRuntimeSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { exportTextAsDocx, exportTextAsPdf, downloadText } from "@/lib/browser-files"
import { streamChatAgentResponse, type ChatAgentEvent } from "@/services/ai-service"

type ChatProviderType = ChatRuntimeSettings["model"]["providerType"]

function isChatProviderType(value: string): value is ChatProviderType {
  return ["ollama", "openai", "anthropic", "openai-compatible", "google"].includes(value)
}

function buildTranscript(detail: ChatDetail, streamingText: string, toolEvents: ChatAgentEvent[]) {
  const messageBlocks = detail.messages.map((message) => `${message.role.toUpperCase()}\n${message.content}`).join("\n\n")
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
  const abortControllerRef = useRef<AbortController | null>(null)

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
  const { data: providerData } = useAsyncResource(() => listModelProviders(), [])
  const agents = agentsData ?? []
  const providers = providerData ?? []
  const selectedProvider = providers.find((provider) => provider.id === settingsDraft?.model.providerId) ?? providers.find((provider) => provider.providerType === settingsDraft?.model.providerType) ?? null
  const providerModels = selectedProvider?.models ?? []
  const selectedChat = data

  useEffect(() => {
    setActiveChatId(chatId ?? null)
  }, [chatId])

  useEffect(() => {
    if (runtimeSettings) {
      setSettingsDraft(runtimeSettings)
    }
  }, [runtimeSettings])

  const combinedError = (activeChatId ? error : null) ?? settingsError

  const modelMeta = useMemo(() => {
    if (!settingsDraft) {
      return []
    }

    return [
      ["Provider", settingsDraft.model.providerType],
      ["Model", settingsDraft.model.modelId],
      ["Base URL", settingsDraft.model.baseUrl],
    ]
  }, [settingsDraft])

  const handleSaveSettings = async () => {
    if (!settingsDraft) {
      return
    }

    const next = await saveChatRuntimeSettings(settingsDraft)
    setRuntimeSettings(next)
    setSettingsDraft(next)
  }

  const handleSend = async () => {
    if (!draft.trim() || !settingsDraft || isResponding) {
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

    const next = await appendUserChatMessage(workingChatId, draft)
    setData(next)
    setDraft("")
    setToolEvents([])
    setStreamingText("")
    setIsResponding(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let finalText = ""

      for await (const event of streamChatAgentResponse(next.messages, settingsDraft, abortController.signal)) {
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
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const handleExport = async (format: "markdown" | "pdf" | "docx") => {
    if (!selectedChat) {
      return
    }

    const transcript = buildTranscript(selectedChat, streamingText, toolEvents)
    const baseName = `${selectedChat.chat.title || "chat"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "chat"

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
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={selectedChat?.chat.title ?? "New chat"}
        description={selectedChat?.chat.summary || "Start a fresh session from the main canvas. Your historical sessions remain in the sidebar."}
        actions={isResponding ? <Button variant="outline" onClick={handleStop}>Stop</Button> : null}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden p-3">
        <div className="grid min-h-0 w-full min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
          {activeChatId && isLoading ? <LoadingCard title="Loading chat session..." /> : null}
          {settingsLoading ? <LoadingCard title="Loading chat runtime settings..." /> : null}
          {combinedError ? <ErrorCard error={combinedError} onRetry={() => { reload(); reloadSettings() }} /> : null}
          {!settingsLoading && !combinedError && settingsDraft ? (
            <>
              <Card className="min-h-0 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Chat content</CardTitle>
                      <CardDescription>{selectedChat ? "Continue the active session or branch from the latest reply." : "This canvas stays empty until you send the first message."}</CardDescription>
                    </div>
                    <Badge variant={isResponding ? "default" : "outline"}>{isResponding ? "Streaming" : "Idle"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                  <MessageScroller className="min-h-0 flex-1 rounded-xl border bg-muted/20">
                    <MessageScrollerViewport className="p-3">
                      <MessageScrollerContent>
                        {selectedChat?.messages.map((message, index) => (
                          <MessageScrollerItem key={message.id} scrollAnchor={autoScroll && index === selectedChat.messages.length - 1 && !isResponding}>
                            <Message align={message.role === "user" ? "end" : "start"}>
                              <MessageContent>
                                <MessageHeader>{message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "System"}</MessageHeader>
                                <Bubble variant={message.role === "user" ? "default" : message.role === "assistant" ? "outline" : "muted"} align={message.role === "user" ? "end" : "start"}>
                                  <BubbleContent>{message.content}</BubbleContent>
                                </Bubble>
                                <MessageFooter>{new Date(message.createdAt).toLocaleString()}</MessageFooter>
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        ))}
                        {toolEvents.map((event, index) => (
                          <MessageScrollerItem key={`${event.type}-${index}`}>
                            <Message>
                              <MessageContent>
                                <MessageHeader>Tool event</MessageHeader>
                                <Bubble variant={event.type === "error" ? "destructive" : "muted"}>
                                  <BubbleContent>
                                    {event.type === "tool-call" ? `tool ${event.toolName} called with ${JSON.stringify(event.input)}` : null}
                                    {event.type === "tool-result" ? `tool ${event.toolName} returned ${event.output}` : null}
                                    {event.type === "error" ? `error: ${event.error}` : null}
                                  </BubbleContent>
                                </Bubble>
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        ))}
                        {isResponding && streamingText ? (
                          <MessageScrollerItem scrollAnchor={autoScroll}>
                            <Message>
                              <MessageContent>
                                <MessageHeader>Assistant</MessageHeader>
                                <Bubble variant="outline">
                                  <BubbleContent>{streamingText}</BubbleContent>
                                </Bubble>
                                <MessageFooter>Streaming response...</MessageFooter>
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        ) : null}
                        {!selectedChat && !isResponding ? (
                          <MessageScrollerItem scrollAnchor>
                            <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed bg-background/70 px-6 py-10 text-center text-sm text-muted-foreground">
                              Start a new chat from here. Pick an agent or model below, then send the first message.
                            </div>
                          </MessageScrollerItem>
                        ) : null}
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton />
                  </MessageScroller>

                  <div className="rounded-xl border bg-background p-3">
                    <div className="flex items-end gap-2">
                      <Input className="h-10 w-full" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about documents, workflows, or skills..." disabled={isResponding} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <NativeSelect size="sm" value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                          <NativeSelectOption value="">Agent</NativeSelectOption>
                          {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
                        </NativeSelect>
                        <NativeSelect size="sm" value={settingsDraft.model.modelId} onChange={(event) => {
                          const providerType = selectedProvider?.providerType && isChatProviderType(selectedProvider.providerType)
                            ? selectedProvider.providerType
                            : settingsDraft.model.providerType
                          setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, providerType, providerId: selectedProvider?.id || settingsDraft.model.providerId, modelId: event.target.value } })
                        }}>
                          <NativeSelectOption value="">Model</NativeSelectOption>
                          {providerModels.map((model) => <NativeSelectOption key={model.id} value={model.id}>{model.name}</NativeSelectOption>)}
                        </NativeSelect>
                        <label className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                          <span>Auto scroll</span>
                          <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
                        </label>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>Export</DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-36 min-w-36">
                            <DropdownMenuItem onClick={() => void handleExport("pdf")}>PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleExport("markdown")}>Markdown</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleExport("docx")}>DOCX</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled>
                          <MicIcon />
                        </Button>
                        <Button size="sm" onClick={() => void handleSend()} disabled={isResponding || !draft.trim()}>
                          <SendHorizonalIcon />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-0 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle>Runtime controls</CardTitle>
                  <CardDescription>Keep the current session lean while still adjusting provider and proxy defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto text-sm">
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Provider type</div>
                      <NativeSelect value={settingsDraft.model.providerId} onChange={(event) => {
                        const provider = providers.find((item) => item.id === event.target.value)
                        if (!provider) {
                          return
                        }

                        const enabledModel = provider.models.find((model) => model.enabled) ?? provider.models[0]
                        setSettingsDraft({
                          ...settingsDraft,
                          model: {
                            ...settingsDraft.model,
                            providerId: provider.id,
                            providerType: isChatProviderType(provider.providerType) ? provider.providerType : settingsDraft.model.providerType,
                            baseUrl: provider.baseUrl,
                            apiKey: provider.apiKey,
                            modelId: enabledModel?.id ?? "",
                          },
                        })
                      }}>
                        {providers.map((provider) => <NativeSelectOption key={provider.id} value={provider.id}>{provider.title}</NativeSelectOption>)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Model ID</div>
                      <NativeSelect value={settingsDraft.model.modelId} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, modelId: event.target.value } })}>
                        {providerModels.map((model) => <NativeSelectOption key={model.id} value={model.id}>{model.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Base URL</div>
                      <Input value={settingsDraft.model.baseUrl} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, baseUrl: event.target.value } })} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">API key</div>
                      <Input type="password" value={settingsDraft.model.apiKey} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, apiKey: event.target.value } })} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">System prompt</div>
                      <Input value={settingsDraft.model.systemPrompt} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, systemPrompt: event.target.value } })} />
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="mb-2 font-medium">Proxy</div>
                    <div className="space-y-2.5">
                      <label className="flex items-center justify-between">
                        <span>Enable proxy</span>
                        <Switch checked={settingsDraft.proxy.enabled} onCheckedChange={(checked) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, enabled: checked } })} />
                      </label>
                      <NativeSelect value={settingsDraft.proxy.type} onChange={(event) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, type: event.target.value as ChatRuntimeSettings["proxy"]["type"] } })}>
                        <NativeSelectOption value="http">HTTP</NativeSelectOption>
                        <NativeSelectOption value="https">HTTPS</NativeSelectOption>
                        <NativeSelectOption value="socks5">SOCKS5</NativeSelectOption>
                      </NativeSelect>
                      <Input value={settingsDraft.proxy.host} placeholder="Proxy host" onChange={(event) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, host: event.target.value } })} />
                      <Input type="number" value={String(settingsDraft.proxy.port || "")} placeholder="Proxy port" onChange={(event) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, port: Number(event.target.value) } })} />
                      <Input value={settingsDraft.proxy.username} placeholder="Proxy username" onChange={(event) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, username: event.target.value } })} />
                      <Input type="password" value={settingsDraft.proxy.password} placeholder="Proxy password" onChange={(event) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, password: event.target.value } })} />
                      <label className="flex items-center justify-between">
                        <span>Ignore SSL errors</span>
                        <Switch checked={settingsDraft.proxy.ignoreSslErrors} onCheckedChange={(checked) => setSettingsDraft({ ...settingsDraft, proxy: { ...settingsDraft.proxy, ignoreSslErrors: checked } })} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-xl border p-3">
                    {modelMeta.map(([label, value]) => (
                      <div key={label}>
                        <div className="text-muted-foreground">{label}</div>
                        <div className="font-medium break-all">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveSettings}>Save settings</Button>
                    <Button size="sm" variant="outline" onClick={reloadSettings}>Reload</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChatDetailPage