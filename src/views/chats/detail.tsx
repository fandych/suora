import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { appendAssistantChatMessage, appendUserChatMessage, getChatDetail } from "@/data/repositories/chat-repository"
import { getChatRuntimeSettings, saveChatRuntimeSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { streamChatAgentResponse, type ChatAgentEvent } from "@/services/ai-service"

const ChatDetailPage = () => {
  const { chatId } = useParams<{ chatId: string }>()
  const [draft, setDraft] = useState("")
  const [toolEvents, setToolEvents] = useState<ChatAgentEvent[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [isResponding, setIsResponding] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<ChatRuntimeSettings | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { data, error, isLoading, reload, setData } = useAsyncResource(
    () => getChatDetail(chatId ?? ""),
    [chatId]
  )
  const { data: runtimeSettings, error: settingsError, isLoading: settingsLoading, reload: reloadSettings, setData: setRuntimeSettings } = useAsyncResource(
    () => getChatRuntimeSettings(),
    []
  )

  useEffect(() => {
    if (runtimeSettings) {
      setSettingsDraft(runtimeSettings)
    }
  }, [runtimeSettings])

  const combinedError = error ?? settingsError

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
    if (!chatId || !draft.trim() || !settingsDraft || isResponding) {
      return
    }

    const next = await appendUserChatMessage(chatId, draft)
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
        const withAssistant = await appendAssistantChatMessage(chatId, finalText.trim())
        setData(withAssistant)
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

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.chat.title ?? "Chats"}
        description={data?.chat.summary || "Persistent local chat sessions backed by SQLite and AI SDK tool loops."}
        actions={isResponding ? <Button variant="outline" onClick={handleStop}>Stop</Button> : null}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto grid h-full max-w-6xl gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          {isLoading ? <LoadingCard title="Loading chat session..." /> : null}
          {settingsLoading ? <LoadingCard title="Loading chat runtime settings..." /> : null}
          {combinedError ? <ErrorCard error={combinedError} onRetry={() => { reload(); reloadSettings() }} /> : null}
          {!isLoading && !settingsLoading && !combinedError && data && settingsDraft ? (
            <>
              <Card className="min-h-128">
                <CardHeader>
                  <CardTitle>Conversation</CardTitle>
                  <CardDescription>Messages are stored in desktop SQLite. Assistant replies stream through AI SDK and Electron network proxy.</CardDescription>
                </CardHeader>
                <CardContent className="flex h-120 flex-col gap-4">
                  <ScrollArea className="flex-1 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3">
                      {data.messages.map((message) => (
                        <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground" : "max-w-[85%] rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border"}>
                          <div className="mb-1 text-xs uppercase tracking-wide opacity-70">{message.role}</div>
                          <div>{message.content}</div>
                        </div>
                      ))}
                      {toolEvents.map((event, index) => (
                        <div key={`${event.type}-${index}`} className="max-w-[90%] rounded-xl border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground">
                          {event.type === "tool-call" ? `tool ${event.toolName} called with ${JSON.stringify(event.input)}` : null}
                          {event.type === "tool-result" ? `tool ${event.toolName} returned ${event.output}` : null}
                          {event.type === "error" ? `error: ${event.error}` : null}
                        </div>
                      ))}
                      {isResponding && streamingText ? (
                        <div className="max-w-[85%] rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border">
                          <div className="mb-1 text-xs uppercase tracking-wide opacity-70">assistant</div>
                          <div>{streamingText}</div>
                        </div>
                      ) : null}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about documents, workflows, or skills..." disabled={isResponding} />
                    <Button onClick={handleSend} disabled={isResponding}>Send</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Runtime settings</CardTitle>
                  <CardDescription>Closest current slice to the legacy suora model and proxy config experience.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Provider type</div>
                      <NativeSelect value={settingsDraft.model.providerType} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, providerType: event.target.value as ChatRuntimeSettings["model"]["providerType"] } })}>
                        <NativeSelectOption value="ollama">Ollama</NativeSelectOption>
                        <NativeSelectOption value="openai">OpenAI</NativeSelectOption>
                        <NativeSelectOption value="anthropic">Anthropic</NativeSelectOption>
                        <NativeSelectOption value="google">Google</NativeSelectOption>
                        <NativeSelectOption value="openai-compatible">OpenAI Compatible</NativeSelectOption>
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Provider ID</div>
                      <Input value={settingsDraft.model.providerId} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, providerId: event.target.value } })} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground">Model ID</div>
                      <Input value={settingsDraft.model.modelId} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: { ...settingsDraft.model, modelId: event.target.value } })} />
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
                    <div className="mb-3 font-medium">Proxy</div>
                    <div className="space-y-3">
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

                  <div className="space-y-2 rounded-xl border p-3">
                    {modelMeta.map(([label, value]) => (
                      <div key={label}>
                        <div className="text-muted-foreground">{label}</div>
                        <div className="font-medium break-all">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveSettings}>Save settings</Button>
                    <Button variant="outline" onClick={reloadSettings}>Reload</Button>
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