import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import { useAsyncResource } from "@/hooks/use-async-resource"
import { AgentApi } from "@/services/agent-service"
import { getChatDetail, updateChatMessageParts, saveChatSessionSettings } from "@/services/chat-service"
import type { ChatDetail, ChatRuntimeSettings } from "@/types/chat"
import { ModelApi } from "@/services/model-service"
import { hasAppBridge } from "@/services/bridge"
import { ToolApi } from "@/services/tool-service"
import { subscribeToBrowserState } from "@/services/browser-state-listener"
import { showToast } from "@/services/toast-service"
import type { ChatAttachment } from "@/types/chat"
import { deriveChatBrowserInteractionState } from "@/lib/chat/browser-status"
import { mergeChatDetail } from "@/lib/chat/merge-chat-detail"
import { resolveFallbackRuntime } from "@/lib/chat/chat-controller-utils"
import { useChatExportActions } from "@/hooks/use-chat-export-actions"
import { useChatAttachmentActions } from "@/hooks/use-chat-attachment-actions"
import { ChatApi } from "@/services/chat-service"
import { subscribeToChatRuntime, type ChatRuntimePayload } from "@/services/chat-runtime-listener"
import {
  toAssistantResponseParts,
  updateAssistantToolActivity,
  type AssistantResponsePart,
} from "@/lib/chat/response-parts"
import type { ChatToolActivity } from "@/pages/chats/components/chat-tool-event-item"
import {
  getChatRuntimeSnapshot,
  patchChatRuntimeParts,
  setPendingBrowserContinue,
  startChatRun,
  stopChatRun,
  subscribeToChatRuntimeStore,
} from "@/stores/chat-runtime-store"

export function useChatDetailController() {
  const { chatId } = useParams<{ chatId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState("")
  const [settingsDraft, setSettingsDraft] = useState<ChatRuntimeSettings | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(chatId ?? null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const attachmentActions = useChatAttachmentActions(setAttachments)
  const [browserState, setBrowserState] = useState<{
    open: boolean
    visible: boolean
    url: string
    loading?: boolean
    error?: string
  }>({ open: false, visible: false, url: "" })

  const runtimeSnapshot = useSyncExternalStore(
    subscribeToChatRuntimeStore,
    () => getChatRuntimeSnapshot(activeChatId),
    () => getChatRuntimeSnapshot(activeChatId),
  )

  const toolEvents = runtimeSnapshot.toolEvents
  const streamingText = runtimeSnapshot.streamingText
  const isResponding = runtimeSnapshot.isResponding
  const isStopping = runtimeSnapshot.isStopping
  const assistantResponseMessageId = runtimeSnapshot.assistantResponseMessageId
  const assistantResponseParts = runtimeSnapshot.assistantResponseParts as AssistantResponsePart[]
  const pendingBrowserContinue = runtimeSnapshot.pendingBrowserContinue
  const browserInteractionState = useMemo(
    () => deriveChatBrowserInteractionState({ browserState, toolEvents, isResponding }),
    [browserState, isResponding, toolEvents],
  )

  const { data, error, isLoading, reload, setData } = useAsyncResource(async () => {
    if (!activeChatId) {
      return null
    }

    return ChatApi.get(activeChatId)
  }, [activeChatId])
  const {
    data: sessionSettings,
    error: settingsError,
    isLoading: settingsLoading,
    reload: reloadSettings,
    setData: setSessionSettings,
  } = useAsyncResource(() => ChatApi.getSessionSettings(activeChatId), [activeChatId])
  const { data: agentsData } = useAsyncResource(() => AgentApi.listAvailable(), [])
  const { data: providerData } = useAsyncResource(() => ModelApi.listAll(), [])

  const agents = useMemo(() => agentsData ?? [], [agentsData])
  const providers = useMemo(() => providerData ?? [], [providerData])
  const selectedChat = data
  const handleExportChat = useChatExportActions(selectedChat, assistantResponseParts)
  const groupedProviders = providers.filter((provider) => provider.models.length > 0)
  const selectedAgentRecord = agents.find((agent) => agent.id === selectedAgentId) ?? null
  const selectedAgentUpdatedAt = selectedAgentRecord?.updatedAt ?? null
  const selectedProviderRecord = providers.find((provider) => provider.id === settingsDraft?.model.providerId) ?? null
  const selectedModelRecord =
    selectedProviderRecord?.models.find((model) => model.id === settingsDraft?.model.modelId) ?? null
  const activeProviderType =
    providers.find((provider) => provider.id === settingsDraft?.model.providerId)?.providerType ??
    settingsDraft?.model.providerType ??
    "openai"
  const supportsAttachments = Boolean(selectedModelRecord?.capabilities?.includes("vision"))
  const hasOlderMessages = Boolean(selectedChat?.nextCursor)
  const combinedError = (activeChatId ? error : null) ?? settingsError
  const modelValue = useMemo(() => {
    if (!settingsDraft) {
      return ""
    }

    return `${settingsDraft.model.providerId}::${settingsDraft.model.modelId}`
  }, [settingsDraft])
  const [activeAgentMaxSteps, setActiveAgentMaxSteps] = useState<number | undefined>(undefined)

  useEffect(() => {
    setActiveChatId(chatId ?? null)
    setDraft("")
  }, [chatId, location.key])

  useEffect(() => {
    if (!sessionSettings) {
      return
    }

    setSettingsDraft(sessionSettings.runtime)
    setSelectedAgentId(sessionSettings.selectedAgentId)
  }, [sessionSettings])

  useEffect(() => {
    let cancelled = false
    if (!selectedAgentId) {
      setActiveAgentMaxSteps(undefined)
      return
    }

    // Keep this effect keyed to the selected agent identity and its persisted version timestamp only.
    void AgentApi.get(selectedAgentId)
      .then((detail) => {
        if (!cancelled) {
          setActiveAgentMaxSteps(detail?.config.maxSteps)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveAgentMaxSteps(undefined)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedAgentId, selectedAgentUpdatedAt])

  useEffect(() => {
    let cancelled = false

    void ToolApi.browserState(activeChatId ?? undefined)
      .then((nextState) => {
        if (!cancelled) {
          setBrowserState(nextState)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrowserState({ open: false, visible: false, url: "" })
        }
      })

    const unsubscribe = subscribeToBrowserState((payload) => {
      if (payload?.sessionId !== (activeChatId ?? "global")) {
        return
      }
      setBrowserState({
        open: Boolean(payload?.open),
        visible: Boolean(payload?.visible),
        url: typeof payload?.url === "string" ? payload.url : "",
        loading: Boolean(payload?.loading),
        error: typeof payload?.error === "string" ? payload.error : undefined,
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeChatId])

  useEffect(() => {
    const unsubscribe = subscribeToChatRuntime((payload: ChatRuntimePayload) => {
      if (payload.chatId !== activeChatId || payload.type !== "completed") {
        return
      }

      setData((current) => mergeChatDetail(current, payload.detail))
    })

    return unsubscribe
  }, [activeChatId, setData])

  const persistChatSessionSettings = useCallback(
    (nextRuntime: ChatRuntimeSettings, nextAgentId: string, toastTitle?: string) => {
      void saveChatSessionSettings(activeChatId ?? null, {
        runtime: nextRuntime,
        selectedAgentId: nextAgentId,
      })
        .then((saved) => {
          setSessionSettings(saved)
          setSettingsDraft(saved.runtime)
          setSelectedAgentId(saved.selectedAgentId)
          if (toastTitle) {
            showToast({ title: toastTitle, description: `Using ${saved.runtime.model.modelId}.`, type: "success" })
          }
        })
        .catch((nextError) => {
          showToast({
            title: "Settings save failed",
            description: nextError instanceof Error ? nextError.message : String(nextError),
            type: "error",
          })
        })
    },
    [activeChatId, setSessionSettings],
  )

  useEffect(() => {
    if (selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)) {
      return
    }

    if (!agents.some((agent) => agent.id === "agent-general-assistant")) {
      return
    }

    setSelectedAgentId("agent-general-assistant")
    if (settingsDraft) {
      persistChatSessionSettings(settingsDraft, "agent-general-assistant")
    }
  }, [agents, persistChatSessionSettings, selectedAgentId, settingsDraft])

  useEffect(() => {
    if (!settingsDraft || groupedProviders.length === 0) {
      return
    }

    // Resolve stale provider/model selections after availability changes without broadening the effect inputs.
    const fallbackRuntime = resolveFallbackRuntime(settingsDraft, groupedProviders)
    if (!fallbackRuntime) {
      return
    }

    setSettingsDraft(fallbackRuntime)
    persistChatSessionSettings(fallbackRuntime, selectedAgentId)
    showToast({
      title: "Model unavailable",
      description: `Switched to ${fallbackRuntime.model.modelId}.`,
      type: "warning",
    })
  }, [groupedProviders, persistChatSessionSettings, selectedAgentId, settingsDraft])

  const applyRuntimeSettings = (nextRuntime: ChatRuntimeSettings) => {
    setSettingsDraft(nextRuntime)
    persistChatSessionSettings(nextRuntime, selectedAgentId, "Model updated")
  }

  const handleLoadEarlierMessages = useCallback(async () => {
    if (!activeChatId || !selectedChat?.nextCursor || isLoadingOlderMessages) {
      return
    }

    try {
      setIsLoadingOlderMessages(true)
      const olderDetail = await ChatApi.get(activeChatId, { beforeCursor: selectedChat.nextCursor, limit: 200 })
      setData((current) => {
        if (!current || !olderDetail) return current
        const seen = new Set<string>()
        const mergedMessages = [...olderDetail.messages, ...current.messages].filter((message) => {
          if (seen.has(message.id)) return false
          seen.add(message.id)
          return true
        })
        return {
          ...current,
          chat: olderDetail.chat,
          messages: mergedMessages,
          nextCursor: olderDetail.nextCursor ?? null,
        } satisfies ChatDetail
      })
    } catch (nextError) {
      showToast({
        title: "Failed to load earlier messages",
        description: nextError instanceof Error ? nextError.message : String(nextError),
        type: "error",
      })
    } finally {
      setIsLoadingOlderMessages(false)
    }
  }, [activeChatId, isLoadingOlderMessages, selectedChat, setData])

  const handleSend = async (draftOverride?: string) => {
    const nextDraft = draftOverride ?? draft
    if ((!nextDraft.trim() && attachments.length === 0) || !settingsDraft || isResponding) {
      return
    }

    if (!hasAppBridge()) {
      showToast({
        title: "Desktop runtime required",
        description: "Sending messages requires the Electron runtime and IPC bridge.",
        type: "warning",
      })
      return
    }

    if (attachments.length > 0 && !supportsAttachments) {
      showToast({
        title: "Attachments not supported",
        description: "The selected model does not accept attachments.",
        type: "warning",
      })
      return
    }

    const pendingAttachments = attachments
    const outgoingDraft = nextDraft

    try {
      const resultingChatId = await startChatRun({
        activeChatId,
        selectedChatMessages: selectedChat?.messages ?? null,
        settingsDraft,
        selectedAgentId,
        draft: outgoingDraft,
        attachments: pendingAttachments,
        onChatCreated: async (createdChatId) => {
          const createdDetail = await getChatDetail(createdChatId)
          setActiveChatId(createdChatId)
          setData(createdDetail)
          navigate(`/chats/${createdChatId}`, { replace: true })
        },
        onMessagesPersisted: async (detail) => {
          setData((current) => mergeChatDetail(current, detail))
        },
        onAttachmentsConsumed: () => {
          setAttachments([])
          setDraft("")
        },
      })

      if (resultingChatId && !activeChatId) {
        setActiveChatId(resultingChatId)
      }
    } catch (nextError) {
      setPendingBrowserContinue(activeChatId, false)
      if (nextError instanceof DOMException && nextError.name === "AbortError") {
        return
      }
    }
  }

  const handleRetryTool = async (messageId: string | null, activity: ChatToolActivity) => {
    try {
      if (!activeChatId) throw new Error("A chat session is required to retry a tool.")
      const output = await ChatApi.retryToolActivity(activeChatId, {
        toolName: activity.toolName,
        input: activity.input,
      })
      if (messageId && activeChatId && data?.messages.some((message) => message.id === messageId)) {
        const message = data.messages.find((item) => item.id === messageId)
        if (message?.parts?.length) {
          const nextParts = updateAssistantToolActivity(toAssistantResponseParts(message.parts), activity.id, {
            output,
            error: undefined,
          })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        patchChatRuntimeParts(activeChatId, (current) =>
          updateAssistantToolActivity(current, activity.id, { output, error: undefined }),
        )
      }
      showToast({ title: "Tool retried", description: `${activity.toolName} completed successfully.`, type: "success" })
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError)
      if (messageId && activeChatId && data?.messages.some((item) => item.id === messageId)) {
        const target = data.messages.find((item) => item.id === messageId)
        if (target?.parts?.length) {
          const nextParts = updateAssistantToolActivity(toAssistantResponseParts(target.parts), activity.id, {
            error: message,
          })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        patchChatRuntimeParts(activeChatId, (current) =>
          updateAssistantToolActivity(current, activity.id, { error: message }),
        )
      }
      showToast({ title: "Tool retry failed", description: message, type: "error" })
    }
  }

  const handleRetryBrowser = () => {
    if (!browserState.url) {
      return
    }

    void ToolApi.browserNavigate({
      sessionId: activeChatId ?? undefined,
      url: browserState.url,
      visible: browserState.visible,
    }).catch((nextError) => {
      showToast({
        title: "浏览器重试失败",
        description: nextError instanceof Error ? nextError.message : String(nextError),
        type: "error",
      })
    })
  }

  return {
    activeProviderType,
    activeAgentMaxSteps,
    activeChatId,
    agents,
    assistantResponseMessageId,
    assistantResponseParts,
    attachments,
    browserState,
    browserInteractionState,
    pendingBrowserContinue,
    autoScroll,
    combinedError,
    draft,
    groupedProviders,
    handleLoadEarlierMessages,
    ...attachmentActions,
    handleExportChat,
    handleRetryTool,
    handleRetryBrowser,
    handleSend,
    handleContinueAfterBrowser: async () => {
      if (!activeChatId || isResponding || !settingsDraft) {
        return
      }

      setPendingBrowserContinue(activeChatId, true)
      const continuationPrompt =
        "我已完成浏览器中的操作。请读取当前页面并继续完成原任务，不要重复发送或重复执行已经完成的操作。"
      setDraft("")
      void handleSend(continuationPrompt)
    },
    handleStop: () => {
      stopChatRun(activeChatId)
      showToast({
        title: "Response stopped",
        description: "Assistant generation was cancelled.",
        type: "warning",
        timeout: 2500,
      })
    },
    isLoading,
    isLoadingOlderMessages,
    isResponding,
    isStopping,
    hasOlderMessages,
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
          providerType: provider.providerType,
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
