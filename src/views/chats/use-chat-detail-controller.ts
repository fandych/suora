import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react"
import { useNavigate, useParams } from "react-router"

import { useAsyncResource } from "@/hooks/use-async-resource"
import { getAgentDetail, listAvailableAgents } from "@/data/repositories/agent-repository"
import { getChatDetail, updateChatMessageParts } from "@/data/repositories/chat-repository"
import { getChatDraft, getChatSessionSettings, saveChatDraft, saveChatSessionSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { saveDocxFile, savePdfFile, saveTextFile } from "@/lib/browser-files"
import { hasSuoraBridge, suoraIpc } from "@/lib/ipc"
import { showToast } from "@/lib/app-toast"
import { retryToolActivity } from "@/services/ai-tools"
import type { ChatAttachment } from "@/services/ai-service"
import { deriveChatBrowserInteractionState } from "@/views/chats/chat-browser-status"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { getSkillDetail } from "@/data/repositories/skill-repository"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { buildChatTranscript, fileToChatAttachment, mergeChatAttachments, resolveFallbackRuntime } from "@/views/chats/chat-controller-utils"
import { toAssistantResponseParts, updateAssistantToolActivity } from "@/views/chats/assistant-response-parts"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"
import type { ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"
import { getChatRuntimeSnapshot, patchChatRuntimeParts, setPendingBrowserContinue, startChatRun, stopChatRun, subscribeToChatRuntime } from "@/views/chats/chat-runtime-store"

export function useChatDetailController() {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState("")
  const [settingsDraft, setSettingsDraft] = useState<ChatRuntimeSettings | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(chatId ?? null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [browserState, setBrowserState] = useState<{ open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }>({ open: false, visible: false, url: "" })
  const [isDraftHydrated, setIsDraftHydrated] = useState(false)
  const skipRouteResetRef = useRef(false)

  const runtimeSnapshot = useSyncExternalStore(
    subscribeToChatRuntime,
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
  const browserInteractionState = useMemo(() => deriveChatBrowserInteractionState({ browserState, toolEvents, isResponding }), [browserState, isResponding, toolEvents])

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
  const { data: agentsData } = useAsyncResource(() => listAvailableAgents(), [])
  const { data: providerData } = useAsyncResource(() => listConfiguredModelProviders(), [])

  const agents = useMemo(() => agentsData ?? [], [agentsData])
  const providers = useMemo(() => providerData ?? [], [providerData])
  const selectedChat = data
  const groupedProviders = providers.filter((provider) => provider.models.length > 0)
  const selectedAgentRecord = agents.find((agent) => agent.id === selectedAgentId) ?? null
  const selectedProviderRecord = providers.find((provider) => provider.id === settingsDraft?.model.providerId) ?? null
  const selectedModelRecord = selectedProviderRecord?.models.find((model) => model.id === settingsDraft?.model.modelId) ?? null
  const activeProviderType = providers.find((provider) => provider.id === settingsDraft?.model.providerId)?.providerType ?? settingsDraft?.model.providerType ?? "openai"
  const supportsAttachments = Boolean(selectedModelRecord?.capabilities?.includes("vision"))
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
  }, [chatId])

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

    void getAgentDetail(selectedAgentId).then((detail) => {
      if (!cancelled) {
        setActiveAgentMaxSteps(detail?.config.maxSteps)
      }
    }).catch(() => {
      if (!cancelled) {
        setActiveAgentMaxSteps(undefined)
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedAgentId, selectedAgentRecord?.updatedAt])

  useEffect(() => {
    if (skipRouteResetRef.current) {
      skipRouteResetRef.current = false
      return
    }
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
      void saveChatDraft(activeChatId, draft).catch((nextError) => {
        showToast({ title: "Draft save failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error", timeout: 3000 })
      })
    }, 150)

    return () => window.clearTimeout(handle)
  }, [activeChatId, draft, isDraftHydrated])

  useEffect(() => {
    let cancelled = false

    void suoraIpc.tools.browserState(activeChatId ?? undefined).then((nextState) => {
      if (!cancelled) {
        setBrowserState(nextState)
      }
    }).catch(() => {
      if (!cancelled) {
        setBrowserState({ open: false, visible: false, url: "" })
      }
    })

    const handler = (...args: unknown[]) => {
      const payload = args[1] as { sessionId?: string; open?: boolean; visible?: boolean; url?: string; loading?: boolean; error?: string } | undefined
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
    }

    window.electron?.on?.("tools:browserStateChanged", handler)

    return () => {
      cancelled = true
      window.electron?.off?.("tools:browserStateChanged", handler)
    }
  }, [activeChatId])

  const persistChatSessionSettings = useCallback((nextRuntime: ChatRuntimeSettings, nextAgentId: string, toastTitle?: string) => {
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
  }, [activeChatId, setSessionSettings])

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

    const fallbackRuntime = resolveFallbackRuntime(settingsDraft, groupedProviders)
    if (!fallbackRuntime) {
      return
    }

    setSettingsDraft(fallbackRuntime)
    persistChatSessionSettings(fallbackRuntime, selectedAgentId)
    showToast({ title: "Model unavailable", description: `Switched to ${fallbackRuntime.model.modelId}.`, type: "warning" })
  }, [groupedProviders, persistChatSessionSettings, selectedAgentId, settingsDraft])

  const applyRuntimeSettings = (nextRuntime: ChatRuntimeSettings) => {
    setSettingsDraft(nextRuntime)
    persistChatSessionSettings(nextRuntime, selectedAgentId, "Model updated")
  }

  const handleSend = async (draftOverride?: string) => {
    const nextDraft = draftOverride ?? draft
    if ((!nextDraft.trim() && attachments.length === 0) || !settingsDraft || isResponding) {
      return
    }

    if (!hasSuoraBridge()) {
      showToast({ title: "Desktop runtime required", description: "Sending messages requires the Electron runtime and IPC bridge.", type: "warning" })
      return
    }

    if (attachments.length > 0 && !supportsAttachments) {
      showToast({ title: "Attachments not supported", description: "The selected model does not accept attachments.", type: "warning" })
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
          skipRouteResetRef.current = true
          navigate(`/chats/${createdChatId}`, { replace: true })
        },
        onUserMessageSaved: (workingChatId, detail) => {
          if (workingChatId === activeChatId || (!activeChatId && detail.chat.id === workingChatId)) {
            setData(detail)
          }
          setPendingBrowserContinue(workingChatId, false)
          setDraft("")
        },
        onAssistantMessageSaved: (workingChatId, detail) => {
          if (workingChatId === activeChatId) {
            setData(detail)
          }
        },
        onFailureBeforeSave: () => {
          setDraft(outgoingDraft)
        },
        onAttachmentsConsumed: () => {
          setAttachments([])
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

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    try {
      const nextAttachments = await Promise.all(files.map((file) => fileToChatAttachment(file)))
      setAttachments((current) => mergeChatAttachments(current, nextAttachments))
    } catch (nextError) {
      showToast({ title: "Attachment unavailable", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    }
    event.target.value = ""
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  const handleRetryTool = async (messageId: string | null, activity: ChatToolActivity) => {
    try {
      const agentDetail = selectedAgentId ? await getAgentDetail(selectedAgentId).catch(() => null) : null
      const output = await retryToolActivity({ toolName: activity.toolName, input: activity.input }, {
        scopedDocuments: agentDetail ? await Promise.all((agentDetail.config.documentIds ?? []).map(async (id) => getDocumentDetail(id).catch(() => null))) : undefined,
        scopedSkills: agentDetail ? await Promise.all((agentDetail.config.skillIds ?? []).map(async (id) => getSkillDetail(id).catch(() => null))) : undefined,
        scopedWorkflows: agentDetail ? await Promise.all((agentDetail.config.workflowIds ?? []).map(async (id) => getWorkflowDetail(id).catch(() => null))) : undefined,
        scopedIntegrations: agentDetail ? await Promise.all((agentDetail.config.toolsetIds ?? []).map(async (id) => getIntegrationDetail(id).catch(() => null))) : undefined,
        browserSessionId: activeChatId ?? undefined,
      })
      if (messageId && activeChatId && data?.messages.some((message) => message.id === messageId)) {
        const message = data.messages.find((item) => item.id === messageId)
        if (message?.parts?.length) {
          const nextParts = updateAssistantToolActivity(toAssistantResponseParts(message.parts), activity.id, { output, error: undefined })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        patchChatRuntimeParts(activeChatId, (current) => updateAssistantToolActivity(current, activity.id, { output, error: undefined }))
      }
      showToast({ title: "Tool retried", description: `${activity.toolName} completed successfully.`, type: "success" })
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError)
      if (messageId && activeChatId && data?.messages.some((item) => item.id === messageId)) {
        const target = data.messages.find((item) => item.id === messageId)
        if (target?.parts?.length) {
          const nextParts = updateAssistantToolActivity(toAssistantResponseParts(target.parts), activity.id, { error: message })
          const updated = await updateChatMessageParts(activeChatId, messageId, nextParts)
          setData(updated)
        }
      } else {
        patchChatRuntimeParts(activeChatId, (current) => updateAssistantToolActivity(current, activity.id, { error: message }))
      }
      showToast({ title: "Tool retry failed", description: message, type: "error" })
    }
  }

  const handleExportChat = async (format: "markdown" | "pdf" | "docx") => {
    const baseName = `${selectedChat?.chat.title || "chat"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "chat"
    const transcript = buildChatTranscript(selectedChat, assistantResponseParts)

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

  const handleRetryBrowser = () => {
    if (!browserState.url) {
      return
    }

    void suoraIpc.tools.browserNavigate({ sessionId: activeChatId ?? undefined, url: browserState.url, visible: browserState.visible }).catch((nextError) => {
      showToast({ title: "浏览器重试失败", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
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
    handleAttachmentChange,
    handleExportChat,
    handleRetryTool,
    handleRetryBrowser,
    handleSend,
    handleContinueAfterBrowser: async () => {
      if (!activeChatId || isResponding || !settingsDraft) {
        return
      }

      setPendingBrowserContinue(activeChatId, true)
      const continuationPrompt = "我已完成浏览器中的操作。请读取当前页面并继续完成原任务，不要重复发送或重复执行已经完成的操作。"
      setDraft("")
      void handleSend(continuationPrompt)
    },
    handleStop: () => {
      stopChatRun(activeChatId)
      showToast({ title: "Response stopped", description: "Assistant generation was cancelled.", type: "warning", timeout: 2500 })
    },
    isLoading,
    isResponding,
    isStopping,
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
