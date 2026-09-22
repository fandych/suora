import { MicIcon, PaperclipIcon, SendHorizonalIcon, SquareIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { ResourceSelector } from "@/components/resource-selector"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAppIntl } from "@/lib/i18n"
import { getLocalizedAgentTitle } from "@/lib/agent-localization"
import type { AgentSummary, ProviderConfigRecord } from "@/types/agent"
import type { ChatAgentEvent, ChatAttachment, ChatRuntimeSettings } from "@/types/chat"
import type { ChatBrowserInteractionState } from "@/lib/chat/browser-status"
import { ChatBrowserStatusBar } from "@/pages/chats/components/chat-browser-status-bar"
import { ChatExportButtons } from "@/pages/chats/components/chat-export-buttons"
import { ChatStatusLine } from "@/pages/chats/components/chat-status-line"

type SpeechRecognitionResultAlternativeLike = {
  transcript?: string
}

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionResultAlternativeLike
}

type SpeechRecognitionEventLike = {
  error?: string
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionEventLike) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = {
  new (): SpeechRecognitionLike
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

type ChatComposerProps = {
  agents: AgentSummary[]
  attachments: ChatAttachment[]
  autoScroll: boolean
  browserState?: ChatBrowserInteractionState
  browserSessionId?: string | null
  draft: string
  exportDisabled?: boolean
  groupedProviders: ProviderConfigRecord[]
  isResponding: boolean
  isStopping?: boolean
  modelValue: string
  toolEvents: ChatAgentEvent[]
  onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  onAutoScrollChange: (value: boolean) => void
  onDraftChange: (value: string) => void
  onExportChat: (format: "markdown" | "pdf" | "docx") => Promise<void>
  onContinueAfterBrowser: () => void
  onRetryBrowser?: () => void
  onModelChange: (value: string) => void
  onRemoveAttachment: (attachmentId: string) => void
  onSelectedAgentChange: (value: string) => void
  onSend: () => Promise<void>
  onStop: () => void
  pendingBrowserContinue?: boolean
  selectedAgentId: string
  settingsDraft: ChatRuntimeSettings
  supportsAttachments: boolean
}

function getRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null
  }

  return (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null
}

export function ChatComposer({
  agents,
  attachments,
  autoScroll,
  browserState,
  browserSessionId,
  draft,
  exportDisabled = false,
  groupedProviders,
  isResponding,
  isStopping = false,
  modelValue,
  toolEvents,
  onAttachmentChange,
  onAutoScrollChange,
  onContinueAfterBrowser,
  onDraftChange,
  onExportChat,
  onModelChange,
  onRemoveAttachment,
  onRetryBrowser,
  onSelectedAgentChange,
  onSend,
  onStop,
  pendingBrowserContinue = false,
  selectedAgentId,
  settingsDraft,
  supportsAttachments,
}: ChatComposerProps) {
  const { t } = useAppIntl()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const draftRef = useRef(draft)
  const dictatedTranscriptRef = useRef("")
  const [isListening, setIsListening] = useState(false)
  const recognitionSupported = useMemo(() => Boolean(getRecognitionConstructor()), [])
  const canSend = draft.trim().length > 0 || attachments.length > 0
  const selectedModelFallback = useMemo(() => {
    const hasSelectedModel = groupedProviders.some(
      (provider) =>
        provider.id === settingsDraft.model.providerId &&
        provider.models.some((model) => model.id === settingsDraft.model.modelId),
    )
    if (hasSelectedModel) {
      return groupedProviders
    }

    return [
      {
        id: settingsDraft.model.providerId,
        title: settingsDraft.model.providerId,
        providerType: settingsDraft.model.providerType,
        baseUrl: settingsDraft.model.baseUrl,
        apiKey: settingsDraft.model.apiKey,
        enabled: true,
        updatedAt: 0,
        models: [{ id: settingsDraft.model.modelId, name: settingsDraft.model.modelId, enabled: true }],
      },
      ...groupedProviders,
    ]
  }, [
    groupedProviders,
    settingsDraft.model.apiKey,
    settingsDraft.model.baseUrl,
    settingsDraft.model.modelId,
    settingsDraft.model.providerId,
    settingsDraft.model.providerType,
  ])
  const selectedModelLabel = useMemo(() => {
    for (const provider of selectedModelFallback) {
      const model = provider.models.find((item) => `${provider.id}::${item.id}` === modelValue)
      if (model) {
        return model.name
      }
    }

    return t("chat.composer.model", "Model")
  }, [modelValue, selectedModelFallback, t])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    const nextHeight = Math.min(textarea.scrollHeight, 192)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > 192 ? "auto" : "hidden"
  }, [draft])

  const handleMicToggle = async () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast.add({
        title: t("chat.composer.voiceDenied.title", "Microphone access was denied"),
        description: t("chat.composer.voiceDenied.description", "Allow microphone permission to use voice input."),
        type: "error",
      })
      return
    }

    const Recognition = getRecognitionConstructor()
    if (!Recognition) {
      toast.add({
        title: t("chat.composer.voiceUnavailable.title", "Voice input unavailable"),
        description: t("chat.composer.voiceUnavailable.description", "Speech recognition is not available in this runtime."),
        type: "error",
      })
      return
    }

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => {
      recognitionRef.current = null
      dictatedTranscriptRef.current = ""
      setIsListening(false)
    }
    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      recognitionRef.current = null
      dictatedTranscriptRef.current = ""
      setIsListening(false)
      const description =
        event.error === "not-allowed"
          ? t("chat.composer.voiceError.notAllowed", "Allow microphone permission to use voice input.")
          : t("chat.composer.voiceError.generic", "Voice input failed: {error}", { error: event.error || "unknown" })
      toast.add({ title: t("chat.composer.voiceError.title", "Voice input error"), description, type: "error" })
    }
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim()

      const previousTranscript = dictatedTranscriptRef.current
      const currentDraft = draftRef.current
      const baseDraft =
        previousTranscript && currentDraft.endsWith(previousTranscript)
          ? currentDraft.slice(0, -previousTranscript.length).trimEnd()
          : currentDraft
      const nextDraft = transcript ? `${baseDraft}${baseDraft ? "\n" : ""}${transcript}` : baseDraft

      dictatedTranscriptRef.current = transcript
      onDraftChange(nextDraft)
    }

    dictatedTranscriptRef.current = ""
    recognitionRef.current = recognition
    recognition.start()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    if (!canSend || isResponding) {
      return
    }

    void onSend()
  }

  return (
    <div className="flex flex-col gap-3">
      <ChatStatusLine isResponding={isResponding} toolEvents={toolEvents} />
      {browserState ? (
        <ChatBrowserStatusBar
          browserState={browserState}
          onContinue={onContinueAfterBrowser}
          onRetry={onRetryBrowser}
          sessionId={browserSessionId}
          pendingContinue={pendingBrowserContinue}
        />
      ) : null}
      <div className="flex min-w-0 items-end gap-2">
        <Textarea
          ref={textareaRef}
          rows={1}
          className="min-h-11 max-h-48 min-w-0 flex-1 resize-none overflow-hidden"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? t("chat.composer.listening", "Listening... speak now")
              : t("chat.composer.placeholder", "Ask about documents, workflows, or skills...")
          }
        />
      </div>
      {attachments.length ? (
        <AttachmentGroup>
          {attachments.map((attachment) => (
            <Attachment key={attachment.id} size="sm">
              <AttachmentMedia variant={attachment.kind === "image" ? "image" : "icon"}>
                {attachment.kind === "image" ? (
                  <img src={attachment.data} alt={attachment.name} className="size-full object-cover" />
                ) : (
                  <PaperclipIcon />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{attachment.name}</AttachmentTitle>
                <AttachmentDescription>{attachment.mediaType}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction size="icon-xs" variant="ghost" onClick={() => onRemoveAttachment(attachment.id)}>
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ResourceSelector
            className="min-w-0 w-full sm:w-32"
            size="sm"
            value={selectedAgentId}
            emptyLabel={t("chat.composer.agent", "Agent")}
            options={agents.map((agent) => ({
              id: agent.id,
              label: getLocalizedAgentTitle(agent, t),
              enabled: !agent.isDisabled,
            }))}
            onChange={(event) => onSelectedAgentChange(event.target.value)}
          />
          <Select
            value={modelValue}
            onValueChange={(value) => {
              if (value !== null) onModelChange(value)
            }}
          >
            <SelectTrigger className="min-w-0 w-full sm:w-44" size="sm">
              <SelectValue placeholder={t("chat.composer.model", "Model")}>{selectedModelLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top" sideOffset={4} align="start">
              {selectedModelFallback.filter((provider) => provider.enabled).map((provider) => (
                <SelectGroup key={provider.id}>
                  <SelectLabel>{provider.title}</SelectLabel>
                  {provider.models.filter((model) => model.enabled).map((model) => (
                    <SelectItem key={`${provider.id}-${model.id}`} value={`${provider.id}::${model.id}`}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <label className="flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>{t("chat.composer.autoScroll", "Auto scroll")}</span>
            <Switch checked={autoScroll} onCheckedChange={onAutoScrollChange} />
          </label>
          <ChatExportButtons disabled={exportDisabled} onExport={onExportChat} />
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
          {supportsAttachments ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void onAttachmentChange(event)}
              />
              <Button size="sm" variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                <PaperclipIcon />
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => void handleMicToggle()}
            disabled={!recognitionSupported || isResponding}
          >
            {isListening ? <SquareIcon /> : <MicIcon />}
          </Button>
          {isResponding ? (
            <Button size="sm" variant="outline" type="button" onClick={onStop} disabled={isStopping}>
              <SquareIcon />
              {isStopping ? t("chat.composer.stopping", "Stopping...") : t("chat.composer.stop", "Stop")}
            </Button>
          ) : (
            <Button size="sm" type="button" onClick={() => void onSend()} disabled={!canSend}>
              <SendHorizonalIcon />
              {t("chat.composer.send", "Send")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
