import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/ChatMessages'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useAIChat } from '@/hooks/useAIChat'
import { useI18n } from '@/hooks/useI18n'
import { DOCUMENT_EDITOR_AGENT_ID, useAppStore } from '@/store/appStore'
import type { DocumentFolder, DocumentGroup, DocumentItem, MessageAttachment, Session } from '@/types'
import { generateId } from '@/utils/helpers'

type DocumentsAssistantMode = 'create' | 'edit'
type Translate = (key: string, fallback: string) => string

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle/50 bg-surface-0/72 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className="mt-1 text-[12px] leading-5 text-text-primary">{value}</div>
    </div>
  )
}

function SuggestionButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[22px] border border-border-subtle/55 bg-surface-0/64 px-4 py-3 text-left text-[12px] leading-5 text-text-secondary transition-colors hover:border-accent/22 hover:bg-accent/8 hover:text-text-primary disabled:opacity-45"
    >
      {label}
    </button>
  )
}

function truncateValue(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1)}...`
}

function describeLocation(group: DocumentGroup | null | undefined, folder: DocumentFolder | null | undefined, t: Translate) {
  const noneLabel = t('common.none', 'None')
  return {
    groupLabel: group ? `${group.name} (${group.id})` : noneLabel,
    folderLabel: folder ? `${folder.title} (${folder.id})` : noneLabel,
  }
}

function buildContextPrompt({
  mode,
  document,
  group,
  folder,
  t,
}: {
  mode: DocumentsAssistantMode
  document?: DocumentItem | null
  group?: DocumentGroup | null
  folder?: DocumentFolder | null
  t: Translate
}) {
  const noneLabel = t('common.none', 'None')
  const { groupLabel, folderLabel } = describeLocation(group, folder, t)
  const lines = [
    t('documents.assistantContextIntro', "You are operating inside Suora's Documents module as the document assistant."),
    t('documents.assistantContextTools', 'Use list_documents, read_document, create_document, and update_document to help the user create or modify saved documents.'),
    mode === 'edit' && document
      ? t('documents.assistantContextEditTarget', 'When the user says "this document" or "current document", it refers to the target document below. Unless the user explicitly asks to create a new document, prefer update_document with this id.')
      : t('documents.assistantContextCreateTarget', 'The default goal in this session is to create a new document in the current group or folder shown below. If the user wants a different destination, pass group_id or parent_id explicitly.'),
    t('documents.assistantContextConfirm', 'Before executing create_document or update_document, first summarize the title, destination, and content changes you plan to apply. The tool layer will ask for a final confirmation.'),
    '',
    `${t('timer.assistantMode', 'Mode')}: ${mode === 'edit' ? t('documents.assistantModeEdit', 'Edit saved document') : t('documents.assistantModeCreate', 'Create saved document')}`,
    `${t('documents.assistantCurrentGroup', 'Current group')}: ${groupLabel}`,
    `${t('documents.assistantCurrentFolder', 'Current folder')}: ${folderLabel}`,
  ]

  if (!group) {
    lines.push(t('documents.assistantNoGroupHint', 'If no document group exists yet, create_document may create a default group first.'))
  }

  if (mode === 'edit' && document) {
    lines.push(
      `${t('documents.assistantTargetDocumentId', 'Target document id')}: ${document.id}`,
      `${t('documents.assistantCurrentTitle', 'Current title')}: ${document.title}`,
      `${t('documents.assistantCurrentCharacters', 'Current characters')}: ${document.markdown.length}`,
      `${t('documents.assistantCurrentContent', 'Current content preview')}: ${truncateValue(document.markdown) || noneLabel}`,
    )
  }

  return lines.join('\n')
}

function buildSessionTitle(mode: DocumentsAssistantMode, document: DocumentItem | null | undefined, t: Translate) {
  if (mode === 'edit' && document) {
    return `${t('documents.assistantLabel', 'Document assistant')} · ${document.title}`
  }
  return `${t('documents.assistantLabel', 'Document assistant')} · ${t('documents.assistantTargetDraft', 'New saved document')}`
}

export function DocumentsAssistantDrawer({
  mode,
  document,
  group,
  folder,
  onClose,
  onDocumentMutated,
}: {
  mode: DocumentsAssistantMode
  document?: DocumentItem | null
  group?: DocumentGroup | null
  folder?: DocumentFolder | null
  onClose: () => void
  onDocumentMutated?: () => void
}) {
  const {
    sessions,
    addSession,
    updateSession,
    selectedModel,
    models,
  } = useAppStore()
  const { t } = useI18n()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const contextKeyRef = useRef<string | null>(null)
  const processedToolCallsRef = useRef<Set<string>>(new Set())
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const { sendMessage, cancelStream, retryLastError, resumeFromMessage, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat({ sessionId })
  const cancelStreamRef = useRef<() => void>(() => {})
  const initialSessionRef = useRef<Session | null>(null)

  const contextKey = `${mode}:${document?.id ?? 'create'}:${group?.id ?? 'none'}:${folder?.id ?? 'root'}`
  const contextPrompt = useMemo(
    () => buildContextPrompt({ mode, document, group, folder, t }),
    [document, folder, group, mode, t],
  )

  if (!initialSessionRef.current) {
    initialSessionRef.current = {
      id: generateId('session'),
      title: buildSessionTitle(mode, document, t),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      surface: 'documents-assistant',
      agentId: DOCUMENT_EDITOR_AGENT_ID,
      modelId: selectedModel?.id,
      messages: [],
      contextPrompt,
    }
  }

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    cancelStreamRef.current = cancelStream
  }, [cancelStream])

  useEffect(() => {
    const session = initialSessionRef.current
    if (!session) return

    contextKeyRef.current = contextKey
    addSession(session)
    setSessionId(session.id)

    return () => {
      cancelStreamRef.current()
      const currentSessionId = sessionIdRef.current
      if (!currentSessionId) return
      queueMicrotask(() => {
        const store = useAppStore.getState()
        if (store.sessions.some((item) => item.id === currentSessionId)) {
          store.removeSession(currentSessionId)
        }
      })
    }
  }, [addSession])

  useEffect(() => {
    if (!sessionId) return
    const previousKey = contextKeyRef.current
    const contextChanged = Boolean(previousKey && previousKey !== contextKey)
    contextKeyRef.current = contextKey
    if (contextChanged) {
      cancelStream()
      processedToolCallsRef.current.clear()
    }

    updateSession(sessionId, {
      title: buildSessionTitle(mode, document, t),
      agentId: DOCUMENT_EDITOR_AGENT_ID,
      modelId: selectedModel?.id,
      contextPrompt,
      ...(contextChanged ? { messages: [] } : {}),
    })
  }, [cancelStream, contextKey, contextPrompt, document, mode, selectedModel?.id, sessionId, t, updateSession])

  const session = sessions.find((item) => item.id === sessionId) ?? null
  const messages = session?.messages ?? []
  const sessionModel = session?.modelId
    ? models.find((model) => model.id === session.modelId) ?? null
    : selectedModel
  const { groupLabel, folderLabel } = describeLocation(group, folder, t)

  const starterPrompts = useMemo(() => {
    if (mode === 'edit') {
      return [
        t('documents.assistantPromptEditSummary', 'Rewrite this document into a concise executive summary and keep the key decisions.'),
        t('documents.assistantPromptEditChecklist', 'Turn this document into a practical checklist with short action items.'),
        t('documents.assistantPromptEditTone', 'Keep the meaning, but make this document more professional and compact.'),
      ]
    }

    return [
      t('documents.assistantPromptCreateBrief', 'Create a document called Product Brief with sections for goals, scope, risks, and next steps.'),
      t('documents.assistantPromptCreateMeeting', 'Create a meeting note called Weekly Sync Summary with decisions, blockers, and action items.'),
      t('documents.assistantPromptCreateChecklist', 'Create a troubleshooting checklist document for the current folder and save it with concise checkboxes.'),
    ]
  }, [mode, t])

  const handleSend = useCallback((input: string, attachments?: MessageAttachment[]) => {
    if (!sessionId) return
    void sendMessage(input, attachments)
  }, [sendMessage, sessionId])

  useEffect(() => {
    const container = messagesScrollRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!onDocumentMutated) return

    let hasMutation = false
    for (const message of messages) {
      for (const toolCall of message.toolCalls ?? []) {
        if (!['create_document', 'update_document'].includes(toolCall.toolName)) continue
        if (toolCall.status !== 'completed' || processedToolCallsRef.current.has(toolCall.id)) continue
        processedToolCallsRef.current.add(toolCall.id)
        hasMutation = true
      }
    }

    if (hasMutation) onDocumentMutated()
  }, [messages, onDocumentMutated])

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-full justify-end pl-16">
      <section
        role="dialog"
        aria-label={t('documents.assistantLabel', 'Document assistant')}
        className="pointer-events-auto flex h-full w-full max-w-136 flex-col border-l border-border-subtle/55 bg-surface-0/94 shadow-[-24px_0_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
      >
        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.assistantSection', 'Side chat')}</div>
              <h2 className="mt-1 text-[20px] font-semibold text-text-primary">
                {mode === 'edit' ? t('documents.assistantTitleEdit', 'AI Edit Document') : t('documents.assistantTitleCreate', 'AI Create Document')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-text-secondary/78">
                {t('documents.assistantDescription', 'Create or modify saved documents in natural language. A confirmation step is required before changes execute.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  disabled={isStreaming}
                  className="rounded-2xl border border-border-subtle/55 bg-surface-0/70 px-3 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-danger/18 hover:bg-danger/8 hover:text-danger disabled:opacity-45"
                >
                  {t('timer.assistantClear', 'Clear')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/70 text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
                aria-label={t('documents.assistantClose', 'Close document assistant')}
                title={t('common.close', 'Close')}
              >
                <IconifyIcon name="ui-close" size={16} color="currentColor" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ContextChip label={t('timer.assistantMode', 'Mode')} value={mode === 'edit' ? t('documents.assistantModeEdit', 'Edit saved document') : t('documents.assistantModeCreate', 'Create saved document')} />
            <ContextChip label={t('timer.assistantModel', 'Model')} value={sessionModel?.name || t('timer.assistantNoModelSelected', 'No model selected')} />
            <ContextChip label={t('timer.assistantConfirmation', 'Confirmation')} value={t('documents.assistantConfirmationHint', 'create_document / update_document will ask for confirmation')} />
            <ContextChip label={t('timer.assistantTarget', 'Target')} value={document ? `${document.title} (${document.id})` : t('documents.assistantTargetDraft', 'New saved document')} />
            <ContextChip label={t('documents.assistantCurrentGroup', 'Current group')} value={groupLabel} />
            <ContextChip label={t('documents.assistantCurrentFolder', 'Current folder')} value={folderLabel} />
          </div>
        </div>

        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-[26px] border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/86 to-surface-2/72 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <IconifyIcon name="ui-sparkles" size={22} color="currentColor" />
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-text-primary">
                  {mode === 'edit'
                    ? t('documents.assistantHeroEdit', 'Tell me how you want to change this document')
                    : t('documents.assistantHeroCreate', 'Describe the document you want to create')}
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/78">
                  {mode === 'edit'
                    ? t('documents.assistantHeroEditHint', 'You can rewrite sections, tighten the tone, add headings, preserve key facts, or restructure the whole note.')
                    : t('documents.assistantHeroCreateHint', 'Describe the title, destination, structure, and the content you want saved into the document workspace.')}
                </p>
              </div>

              <div className="space-y-2">
                {starterPrompts.map((prompt) => (
                  <SuggestionButton
                    key={prompt}
                    label={prompt}
                    disabled={isStreaming || !sessionModel}
                    onClick={() => handleSend(prompt)}
                  />
                ))}
              </div>

              {!sessionModel && (
                <div className="rounded-2xl border border-warning/18 bg-warning/10 px-4 py-3 text-[12px] leading-5 text-warning">
                  {t('documents.assistantNoModel', 'No active model is available yet. Select a model in Models before using the document assistant.')}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRetry={message.isError || message.failedMidStream ? () => retryLastError() : undefined}
                  onResume={message.failedMidStream ? () => resumeFromMessage(message.id) : undefined}
                  onDelete={() => deleteMessage(message.id)}
                  onRegenerate={message.role === 'assistant' && !message.isStreaming && !message.failedMidStream ? () => regenerateMessage(message.id) : undefined}
                />
              ))}

            </div>
          )}
        </div>

        <div className="border-t border-border-subtle/55 px-5 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || !sessionModel}
            isStreaming={isStreaming}
            onStop={cancelStream}
            noModel={!sessionModel}
          />
        </div>
      </section>
    </div>
  )
}
