import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { TextArea } from '@/components/ui/FormControls'
import { useI18n } from '@/hooks/useI18n'
import type { MessageAttachment } from '@/types'
import { generateId } from '@/utils/helpers'
import { toast } from '@/services/toast'
import {
  isSpeechRecognitionAvailable,
  startListening,
  stopListening,
  loadVoiceSettings,
  type VoiceState,
} from '@/services/voiceInteraction'
import { formatFileSize } from './ChatMessages'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_AUDIO_SIZE = 25 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const ACCEPTED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4']
const ACCEPTED_TEXT_EXTENSIONS = [
  '.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.toml',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.rb',
  '.html', '.css', '.scss', '.sql', '.sh', '.bat', '.ps1', '.log',
  '.c', '.cpp', '.h', '.swift', '.kt', '.dart', '.lua', '.r',
]

function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  if (file.type === 'application/json' || file.type === 'application/xml') return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ACCEPTED_TEXT_EXTENSIONS.includes(ext)
}

type AttachmentRejectReason =
  | { kind: 'oversize'; limitBytes: number }
  | { kind: 'read-failed' }
  | { kind: 'unsupported' }

function fileToAttachment(
  file: File,
  onReject?: (file: File, reason: AttachmentRejectReason) => void,
): Promise<MessageAttachment | null> {
  return new Promise((resolve) => {
    if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      if (file.size > MAX_IMAGE_SIZE) { onReject?.(file, { kind: 'oversize', limitBytes: MAX_IMAGE_SIZE }); resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => { const dataUrl = reader.result as string; resolve({ id: generateId('att'), type: 'image', name: file.name, mimeType: file.type, data: dataUrl.split(',')[1], size: file.size }) }
      reader.onerror = () => { onReject?.(file, { kind: 'read-failed' }); resolve(null) }
      reader.readAsDataURL(file)
      return
    }
    if (ACCEPTED_AUDIO_TYPES.includes(file.type) || file.type.startsWith('audio/')) {
      if (file.size > MAX_AUDIO_SIZE) { onReject?.(file, { kind: 'oversize', limitBytes: MAX_AUDIO_SIZE }); resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => { const dataUrl = reader.result as string; resolve({ id: generateId('att'), type: 'audio', name: file.name, mimeType: file.type, data: dataUrl.split(',')[1], size: file.size }) }
      reader.onerror = () => { onReject?.(file, { kind: 'read-failed' }); resolve(null) }
      reader.readAsDataURL(file)
      return
    }
    if (isTextFile(file)) {
      if (file.size > MAX_FILE_SIZE) { onReject?.(file, { kind: 'oversize', limitBytes: MAX_FILE_SIZE }); resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => { resolve({ id: generateId('att'), type: 'file', name: file.name, mimeType: file.type || 'text/plain', data: reader.result as string, size: file.size }) }
      reader.onerror = () => { onReject?.(file, { kind: 'read-failed' }); resolve(null) }
      reader.readAsText(file)
      return
    }
    onReject?.(file, { kind: 'unsupported' })
    resolve(null)
  })
}

function ComposerActionButton({
  label,
  icon,
  onClick,
  disabled,
  active = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-[12px] font-medium transition-all ${
        active
          ? 'border-danger/18 bg-danger/10 text-danger'
          : 'border-border-subtle/55 bg-surface-0/65 text-text-secondary hover:border-accent/18 hover:bg-accent/10 hover:text-accent'
      } disabled:opacity-30`}
    >
      <span className="text-[13px]">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

function AttachmentTile({
  attachment,
  removeLabel,
  onRemove,
}: {
  attachment: MessageAttachment
  removeLabel: string
  onRemove: () => void
}) {
  const preview = attachment.type === 'image'
    ? `data:${attachment.mimeType};base64,${attachment.data}`
    : null

  return (
    <div className="group relative min-w-0 rounded-[22px] border border-border-subtle/55 bg-surface-0/68 p-2.5 shadow-sm">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-70 transition-opacity hover:opacity-100"
        aria-label={`${removeLabel} ${attachment.name}`}
        title={removeLabel}
      >
        <IconifyIcon name="ui-close" size={12} color="currentColor" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        {attachment.type === 'image' ? (
          <img src={preview ?? undefined} alt={attachment.name} className="h-18 w-18 shrink-0 rounded-[18px] border border-border-subtle/55 object-cover" />
        ) : (
          <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[18px] border border-border-subtle/55 bg-surface-2/75 text-accent">
            {attachment.type === 'audio'
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              : <IconifyIcon name="ui-file" size={20} color="currentColor" />}
          </div>
        )}

        <div className="min-w-0 flex-1 pt-1">
          <div className="truncate text-[12px] font-semibold text-text-primary">{attachment.name}</div>
          <div className="mt-1 text-[11px] text-text-muted/72">{formatFileSize(attachment.size)}</div>
          {attachment.type === 'audio' && attachment.duration && (
            <div className="mt-2 w-fit rounded-full bg-surface-2/80 px-2 py-1 text-[10px] text-text-muted/80">{attachment.duration}s</div>
          )}
          {attachment.type === 'file' && (
            <div className="mt-2 w-fit rounded-full bg-surface-2/80 px-2 py-1 text-[10px] uppercase text-text-muted/80">
              {attachment.name.split('.').pop()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChatInput({ onSend, disabled, isStreaming, onStop, noModel }: {
  onSend: (text: string, attachments?: MessageAttachment[]) => void
  disabled: boolean
  isStreaming?: boolean
  onStop?: () => void
  noModel?: boolean
}) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleSubmit = () => {
    const text = input.trim()
    if ((!text && !attachments.length) || disabled) return
    onSend(text, attachments.length ? attachments : undefined)
    setInput('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit() }
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    const rejections: Array<{ file: File; reason: AttachmentRejectReason }> = []
    const results = await Promise.all(
      list.map((f) =>
        fileToAttachment(f, (file, reason) => rejections.push({ file, reason })),
      ),
    )
    const valid = results.filter((r): r is MessageAttachment => r !== null)
    if (valid.length) setAttachments((prev) => [...prev, ...valid])

    for (const { file, reason } of rejections) {
      if (reason.kind === 'oversize') {
        toast.warning(
          t('chat.attachTooLarge', 'File too large'),
          `${file.name} — ${formatFileSize(file.size)} exceeds ${formatFileSize(reason.limitBytes)} limit`,
        )
      } else if (reason.kind === 'unsupported') {
        toast.warning(
          t('chat.attachUnsupported', 'Unsupported file type'),
          `${file.name} (${file.type || 'unknown'}) cannot be attached`,
        )
      } else if (reason.kind === 'read-failed') {
        toast.error(
          t('chat.attachReadFailed', 'Could not read file'),
          file.name,
        )
      }
    }
  }, [t])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const pasteFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/') || items[i].type.startsWith('audio/')) {
        const file = items[i].getAsFile()
        if (file) pasteFiles.push(file)
      }
    }
    if (pasteFiles.length) { e.preventDefault(); addFiles(pasteFiles) }
  }, [addFiles])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files) }, [addFiles])
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }, [addFiles])
  const removeAttachment = useCallback((id: string) => { setAttachments((prev) => prev.filter((a) => a.id !== id)) }, [])

  const recordingStartRef = useRef<number>(0)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recordingStartRef.current = Date.now()

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000)
        if (blob.size > 0) {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1)
            setAttachments((prev) => [...prev, { id: generateId('att'), type: 'audio', name: `recording-${ts}.${ext}`, mimeType: mimeType.split(';')[0], data: dataUrl.split(',')[1], size: blob.size, duration }])
          }
          reader.readAsDataURL(blob)
        }
        setIsRecording(false); setRecordingDuration(0)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(250)
      setIsRecording(true); setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000)
    } catch {
      setInterimText(t('chat.microphoneDenied', 'Microphone access denied'))
      setTimeout(() => setInterimText(''), 3000)
    }
  }, [t])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px' }
  }, [input])

  const formatRecordingTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="mx-auto w-full max-w-384">
      <div
        className={`relative overflow-hidden rounded-md ${
          isDragging ? 'border border-accent/45 bg-accent/5' : 'bg-surface-1/32'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-accent/10 backdrop-blur-sm">
            <span className="rounded-full border border-accent/25 bg-surface-0/80 px-4 py-2 text-[13px] font-semibold text-accent shadow-sm">{t('chat.dropFilesHere', 'Drop files here')}</span>
          </div>
        )}

        <div className="relative z-10 px-3 py-2 sm:px-3.5 sm:py-2.5">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/webm,audio/ogg,audio/mp3,audio/mpeg,audio/wav,audio/mp4,.txt,.md,.json,.csv,.xml,.yaml,.yml,.toml,.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.rb,.html,.css,.scss,.sql,.sh,.bat,.ps1,.log,.c,.cpp,.h,.swift,.kt,.dart,.lua,.r" multiple className="hidden" onChange={handleFileSelect} aria-label="Attach file" />

          {attachments.length > 0 && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {attachments.map((attachment) => (
                <AttachmentTile
                  key={attachment.id}
                  attachment={attachment}
                  removeLabel={t('common.remove', 'Remove')}
                  onRemove={() => removeAttachment(attachment.id)}
                />
              ))}
            </div>
          )}

          {isRecording && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-danger/18 bg-danger/10 px-4 py-3 text-danger shadow-sm">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <span className="text-[13px] font-semibold">{t('chat.recording', 'Recording…')}</span>
              <span className="font-mono text-[12px] text-danger/75">{formatRecordingTime(recordingDuration)}</span>
              <button type="button" onClick={stopRecording} className="ml-auto rounded-2xl bg-danger/15 px-3 py-2 text-[12px] font-semibold text-danger transition-colors hover:bg-danger/22">{t('chat.stopRecording', 'Stop recording')}</button>
            </div>
          )}

          <div className="space-y-2">
            {(voiceState === 'listening' || isRecording || attachments.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-text-muted/62">
                {voiceState === 'listening' && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">{t('chat.listening', 'Listening…')}</span>}
                {isRecording && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">{t('chat.recording', 'Recording…')}</span>}
                {attachments.length > 0 && <span>{attachments.length} {t('chat.attachmentsReady', 'attachments ready')}</span>}
              </div>
            )}

            <div className="rounded-md border border-border-subtle/55 bg-surface-0/70 px-3 py-1.5 transition-colors focus-within:border-accent/45">
              <TextArea
                ghost
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                aria-label="Message input"
                placeholder={isRecording
                  ? t('chat.recordingAudio', 'Recording audio…')
                  : voiceState === 'listening'
                    ? t('chat.listening', 'Listening…')
                    : noModel
                      ? t('chat.selectModelOrRunPipeline', 'Select a model to chat, or say "run Morning Run pipeline"')
                      : t('chat.messagePlaceholder', 'Send a message… (Shift+Enter for new line, paste/drag files)')}
                rows={1}
                disabled={disabled}
                className="w-full min-h-11 max-h-32 text-[14.5px] leading-6"
              />

              {interimText && (
                <div className="mt-2 rounded-2xl border border-accent/18 bg-accent/8 px-3 py-2 text-[12px] text-accent/80">
                  {interimText}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <ComposerActionButton
                  label={t('chat.attachFile', 'Attach file (image, audio, code, text)')}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isRecording}
                />
                <ComposerActionButton
                  label={isRecording ? t('chat.stopRecording', 'Stop recording') : t('chat.recordAudio', 'Record audio message')}
                  icon={isRecording
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={disabled || voiceState === 'listening'}
                  active={isRecording}
                />
                {isSpeechRecognitionAvailable() && (
                  <ComposerActionButton
                    label={voiceState === 'listening' ? t('chat.stopListening', 'Stop listening') : t('chat.voiceInput', 'Voice input (speech-to-text)')}
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                    onClick={() => {
                      if (voiceState === 'listening') {
                        stopListening()
                        setVoiceState('idle')
                        return
                      }

                      const settings = loadVoiceSettings()
                      setVoiceState('listening')
                      startListening(settings, {
                        onResult: (text, isFinal) => {
                          if (isFinal) {
                            setInput((prev) => (prev ? prev + ' ' + text : text))
                            setInterimText('')
                            setVoiceState('idle')
                            if (settings.autoSend && text.trim()) {
                              setTimeout(() => {
                                const currentInput = (textareaRef.current?.value || '').trim()
                                if (currentInput) onSend(currentInput)
                                setInput('')
                              }, 100)
                            }
                          } else {
                            setInterimText(text)
                          }
                        },
                        onError: () => {
                          setVoiceState('idle')
                          setInterimText('')
                        },
                        onEnd: () => {
                          setVoiceState('idle')
                          setInterimText('')
                        },
                      })
                    }}
                    disabled={disabled || isRecording}
                    active={voiceState === 'listening'}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="max-w-64 text-right text-[10px] leading-4 text-text-muted/55">
                  {t('chat.aiDisclaimer', 'AI can make mistakes. Please verify important information.')}
                </span>
                {isStreaming ? (
                  <button type="button" onClick={onStop} title={t('chat.stopGenerating', 'Stop generating')} aria-label={t('chat.stopGenerating', 'Stop generating')} className="inline-flex h-9 items-center gap-2 rounded-md bg-danger/90 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-danger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    <span>{t('chat.stopGenerating', 'Stop generating')}</span>
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={disabled || (!input.trim() && !attachments.length)} title={t('chat.send', 'Send')} aria-label={t('chat.send', 'Send')} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-[12px] font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-25">
                    <span>{t('chat.send', 'Send')}</span>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
