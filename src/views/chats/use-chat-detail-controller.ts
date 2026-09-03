import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useNavigate, useParams } from "react-router"

import { useAsyncResource } from "@/hooks/use-async-resource"
import { listAgents } from "@/data/repositories/agent-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { appendAssistantChatMessage, appendUserChatMessage, createChat, getChatDetail, updateChatMessageParts } from "@/data/repositories/chat-repository"
import { getChatDraft, getChatSessionSettings, saveChatDraft, saveChatSessionSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { saveDocxFile, savePdfFile, saveTextFile } from "@/lib/browser-files"
import { showToast } from "@/lib/app-toast"
import { retryBuiltInToolActivity } from "@/services/ai-tools"
import { streamChatAgentResponse, type ChatAgentEvent, type ChatAttachment } from "@/services/ai-service"
import { applyEventToAssistantResponseParts, finalizeAssistantResponseParts, updateAssistantToolActivity } from "@/views/chats/assistant-response-parts"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"
import type { ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"

type ChatProviderType = ChatRuntimeSettings["model"]["providerType"]

function isChatProviderType(value: string): value is ChatProviderType {
  return ["ollama", "openai", "anthropic", "openai-compatible", "google"].includes(value)
}

export function useChatDetailController() {
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
  const [assistantResponseMessageId, setAssistantResponseMessageId] = useState<string | null>(null)
  const [assistantResponseParts, setAssistantResponseParts] = useState<AssistantResponsePart[]>([])
  const [isDraftHydrated, setIsDraftHydrated] = useState(false)
  const skipRouteResetRef = useRef(false)
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
  const { data: sessionSettings, error: settingsError, isLoading: settingsLoading, reload: reloadSettings, setData: setSessionSettings } = useAsyncResource(
    () => getChatSessionSettings(activeChatId),
    [activeChatId]
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
  const combinedError = (activeChatId ? error : null) ?? settingsError
  const modelValue = useMemo(() => {
    if (!settingsDraft) {
      return ""
    }

    return `${settingsDraft.model.providerId}::${settingsDraft.model.modelId}`
  }, [settingsDraft])

  useEffect(() => {
    setActiveChatId(chatId ?? null)
  }, [chatId])

  useEffect(() => {
    if (!sessionSettings) {
      return
    }

    setSettingsDraft(sessionSettings.runtime)
    setSelectedAgentId(sessionSettings.selectedAgentId)
  }, [sessionSettings])

  useEffect(() => {
    if (selectedAgentId || !agents.some((agent) => agent.id === "agent-general-assistant")) {
      return
    }

    setSelectedAgentId("agent-general-assistant")
  }, [agents, selectedAgentId])

  useEffect(() => {
    if (skipRouteResetRef.current) {
      skipRouteResetRef.current = false
      return
    }

    setAssistantResponseMessageId(null)
    setToolEvents([])
    setStreamingText("")
    setIsResponding(false)
    setAssistantResponseParts([])
    setIsDraftHydrated(false)
  }, [chatId])

  useEffect(() => {
    let cancelled = false

    void getChatDraft(activeChatId).then((savedDraft) => {
      if (cancelled) {
        return
      }

      setDraft(savedDraft)
      setIsDraftHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [activeChatId])

  useEffect(() => {
    if (!isDraftHydrated) {
      return
    }

    const handle = window.setTimeout(() => {
      void saveChatDraft(activeChatId, draft)
    }, 150)

    return () => window.clearTimeout(handle)
  }, [activeChatId, draft, isDraftHydrated])

  const persistChatSessionSettings = (nextRuntime: ChatRuntimeSettings, nextAgentId: string, toastTitle?: string) => {
    void saveChatSessionSettings(activeChatId ?? null, {
      runtime: nextRuntime,
      selectedAgentId: nextAgentId,
    }).then((saved) => {
      setSessionSettings(saved)
      setSettingsDraft(saved.runtime)
      setSelectedAgentId(saved.selectedAgentId)
      if (toastTitle) {
        showToast({ title: toastTitle, description: `Using ${saved.runtime.model.modelId}.`, type: "success" })
      }
    }).catch((nextError) => {
      showToast({ title: "Settings save failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    })
  }

  const applyRuntimeSettings = (nextRuntime: ChatRuntimeSettings) => {
    setSettingsDraft(nextRuntime)
    persistChatSessionSettings(nextRuntime, selectedAgentId, "Model updated")
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
      await saveChatSessionSettings(created.chat.id, {
        runtime: settingsDraft,
        selectedAgentId,
      })
      emitDataChanged("/chats")
      setAssistantResponseParts([{ id: "assistant-stream", type: "text", content: "", isPending: true }])
      skipRouteResetRef.current = true
      navigate(`/chats/${created.chat.id}`, { replace: true })
    }

    if (!workingChatId || !baseDetail) {
      return
    }

    const outgoingText = draft.trim() || attachments.map((attachment) => `[Attachment] ${attachment.name}`).join("\n")
    const next = await appendUserChatMessage(workingChatId, outgoingText)
    setData(next)
    emitDataChanged("/chats")
    setDraft("")
    setToolEvents([])
    setStreamingText("")
    setAssistantResponseMessageId(null)
    setAssistantResponseParts([{ id: "assistant-stream", type: "text", content: "", isPending: true }])
    setIsResponding(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let finalText = ""
      let errorPartIndex = 0
      let streamedParts: AssistantResponsePart[] = []

      for await (const event of streamChatAgentResponse(next.messages, settingsDraft, {
        abortSignal: abortController.signal,
        selectedAgentId: selectedAgentId || undefined,
        attachments,
      })) {
        if (event.type === "error") {
          errorPartIndex += 1
        }

        streamedParts = applyEventToAssistantResponseParts(streamedParts, event, errorPartIndex)
        setAssistantResponseParts(streamedParts)

        if (event.type === "text-delta") {
          finalText += event.text
          setStreamingText((value) => value + event.text)
          continue
        }

        setToolEvents((value) => [...value, event])
      }

      const finalizedParts = finalizeAssistantResponseParts(streamedParts)
      if (finalText.trim() || finalizedParts.length > 0) {
        const withAssistant = await appendAssistantChatMessage(workingChatId, finalText.trim(), finalizedParts)
        setData(withAssistant)
        setAssistantResponseMessageId(withAssistant.messages[withAssistant.messages.length - 1]?.id ?? null)
        setAssistantResponseParts(finalizedParts)
        emitDataChanged("/chats")
      }
    } catch (nextError) {
      setToolEvents((value) => [...value, { type: "error", error: nextError instanceof Error ? nextError.message : String(nextError) }])
      showToast({ title: "Response failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    } finally {
      abortControllerRef.current = null
      setIsResponding(false)
      setAssistantResponseParts((current) => finalizeAssistantResponseParts(current))
      setAttachments([])
    }
  }

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const handleRetryTool = async (messageId: string | null, activity: ChatToolActivity) => {
    try {
      const output = await retryBuiltInToolActivity({ toolName: activity.toolName, input: activity.input })
      if (messageId && activeChatId && data?.messages.some((message) => message.id === messageId)) {
        const message = data.messages.find((item) => item.id === messageId)
        if (message?.parts?.length) {
          const nextParts = updateAssistantToolActivity(message.parts, activity.id, { output, error: undefined })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        setAssistantResponseParts((current) => updateAssistantToolActivity(current, activity.id, { output, error: undefined }))
      }
      showToast({ title: "Tool retried", description: `${activity.toolName} completed successfully.`, type: "success" })
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError)
      if (messageId && activeChatId && data?.messages.some((item) => item.id === messageId)) {
        const target = data.messages.find((item) => item.id === messageId)
        if (target?.parts?.length) {
          const nextParts = updateAssistantToolActivity(target.parts, activity.id, { error: message })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        setAssistantResponseParts((current) => updateAssistantToolActivity(current, activity.id, { error: message }))
      }
      showToast({ title: "Tool retry failed", description: message, type: "error" })
    }
  }

  const buildTranscript = () => {
    const messageBlocks = (selectedChat?.messages ?? []).map((message) => `${message.role.toUpperCase()}\n${message.content}`).join("\n\n")
    const assistantBlocks = assistantResponseParts.map((part) => {
      if (part.type === "text") {
        return part.content ? `ASSISTANT\n${part.content}` : ""
      }

      if (part.activity.error) {
        return `TOOL ERROR ${part.activity.toolName}\n${part.activity.error}`
      }

      if (part.activity.output) {
        return `TOOL RESULT ${part.activity.toolName}\n${part.activity.output}`
      }

      return `TOOL CALL ${part.activity.toolName}\n${JSON.stringify(part.activity.input ?? {}, null, 2)}`
    }).filter(Boolean).join("\n\n")

    return [messageBlocks, assistantBlocks].filter(Boolean).join("\n\n")
  }

  const handleExportChat = async (format: "markdown" | "pdf" | "docx") => {
    const baseName = `${selectedChat?.chat.title || "chat"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "chat"
    const transcript = buildTranscript()

    if (format === "markdown") {
      const result = await saveTextFile(`${baseName}.md`, transcript, "text/markdown;charset=utf-8")
      if (!result.canceled) {
        showToast({ title: "Export complete", description: result.path ?? `${baseName}.md saved.`, type: "success" })
      }
      return
    }

    if (format === "pdf") {
      const result = await savePdfFile(`${baseName}.pdf`, transcript)
      if (!result.canceled) {
        showToast({ title: "Export complete", description: result.path ?? `${baseName}.pdf saved.`, type: "success" })
      }
      return
    }

    const result = await saveDocxFile(`${baseName}.docx`, transcript)
    if (!result.canceled) {
      showToast({ title: "Export complete", description: result.path ?? `${baseName}.docx saved.`, type: "success" })
    }
  }

  return {
    activeProviderType,
    activeChatId,
    agents,
    assistantResponseMessageId,
    assistantResponseParts,
    attachments,
    autoScroll,
    combinedError,
    draft,
    groupedProviders,
    handleAttachmentChange,
    handleExportChat,
    handleRetryTool,
    handleSend,
    handleStop: () => {
      abortControllerRef.current?.abort()
      showToast({ title: "Response stopped", description: "Assistant generation was cancelled.", type: "warning", timeout: 2500 })
    },
    isLoading,
    isResponding,
    modelValue,
    onModelChange: (value: string) => {
      const [providerId, modelId] = value.split("::")
      const provider = groupedProviders.find((item) => item.id === providerId)
      if (!provider || !settingsDraft) {
        return
      }

      applyRuntimeSettings({
        ...settingsDraft,
        model: {
          ...settingsDraft.model,
          providerId: provider.id,
          providerType: isChatProviderType(provider.providerType) ? provider.providerType : settingsDraft.model.providerType,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          modelId,
        },
      })
    },
    onSelectedAgentChange: (value: string) => {
      setSelectedAgentId(value)
      if (settingsDraft) {
        persistChatSessionSettings(settingsDraft, value)
      }
    },
    removeAttachment,
    reload,
    reloadSettings,
    selectedAgentId,
    selectedChat,
    setAutoScroll,
    setDraft,
    settingsDraft,
    settingsLoading,
    supportsAttachments,
    toolEvents,
    streamingText,
  }
}

async function fileToPayload(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })
}