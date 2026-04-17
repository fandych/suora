import { useState, useRef, useEffect, useCallback } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
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

// ─── Attachment helpers ────────────────────────────────────────────

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

// ─── Chat Input ────────────────────────────────────────────────────

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

    // Surface rejections to the user so they understand why files disappeared.
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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
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

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files) }, [addFiles])
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }, [addFiles])
  const removeAttachment = useCallback((id: string) => { setAttachments((prev) => prev.filter((a) => a.id !== id)) }, [])

  // ─── Audio Recording ────────────────────────────────────────────
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
      setInterimText('Microphone access denied')
      setTimeout(() => setInterimText(''), 3000)
    }
  }, [])

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
    <div className="border-t border-border-subtle/40 bg-surface-1/40 backdrop-blur-xl px-8 py-5">
      <div className="max-w-4xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-3 px-1">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                {att.type === 'image' ? (
                  <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="w-16 h-16 rounded-xl object-cover border border-border-subtle/60" />
                ) : att.type === 'audio' ? (
                  <div className="w-16 h-16 rounded-xl border border-border-subtle/60 bg-surface-2/60 flex flex-col items-center justify-center gap-1 p-1.5">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                    <span className="text-[8px] text-text-muted font-mono leading-none">{formatFileSize(att.size)}</span>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-border-subtle/60 bg-surface-2/60 flex flex-col items-center justify-center gap-0.5 p-1.5">
                    <span className="text-sm"><IconifyIcon name="ui-file" size={15} color="currentColor" /></span>
                    <span className="text-[8px] text-text-muted uppercase font-mono leading-none">{att.name.split('.').pop()}</span>
                    <span className="text-[7px] text-text-muted/50 font-mono leading-none">{formatFileSize(att.size)}</span>
                  </div>
                )}
                <button type="button" onClick={() => removeAttachment(att.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" title="Remove">
                  <IconifyIcon name="ui-close" size={13} color="currentColor" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-b-xl truncate">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-2.5 mb-3 px-4 py-3 bg-danger/8 border border-danger/15 rounded-2xl animate-pulse">
            <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
            <span className="text-[13px] text-danger font-medium">{t('chat.recording', 'Recording…')}</span>
            <span className="text-[12px] text-danger/60 font-mono">{formatRecordingTime(recordingDuration)}</span>
            <button type="button" onClick={stopRecording} className="ml-auto text-[12px] px-3 py-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger/25 transition-colors font-medium">Stop</button>
          </div>
        )}

        <div
          className={`relative flex items-end gap-2.5 bg-surface-2/35 border rounded-3xl px-4.5 py-3 focus-within:ring-2 focus-within:ring-accent/15 focus-within:border-accent/30 transition-all ${isDragging ? 'border-accent/50 border-dashed bg-accent/5' : 'border-border-subtle/50'}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
          {isDragging && <div className="absolute inset-0 flex items-center justify-center bg-accent/8 rounded-3xl z-10 pointer-events-none"><span className="text-accent text-[14px] font-medium">Drop files here</span></div>}

          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/webm,audio/ogg,audio/mp3,audio/mpeg,audio/wav,audio/mp4,.txt,.md,.json,.csv,.xml,.yaml,.yml,.toml,.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.rb,.html,.css,.scss,.sql,.sh,.bat,.ps1,.log,.c,.cpp,.h,.swift,.kt,.dart,.lua,.r" multiple className="hidden" onChange={handleFileSelect} aria-label="Attach file" />

          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || isRecording} title="Attach file (image, audio, code, text)" className="p-2.5 rounded-xl text-text-muted/60 hover:text-accent hover:bg-accent/8 disabled:opacity-25 transition-all shrink-0 mb-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>

          <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={disabled || voiceState === 'listening'} title={isRecording ? 'Stop recording' : 'Record audio message'} className={`p-2.5 rounded-xl transition-all shrink-0 mb-0.5 ${isRecording ? 'text-danger bg-danger/10' : 'text-text-muted/60 hover:text-accent hover:bg-accent/8 disabled:opacity-25'}`}>
            {isRecording ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-danger"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>}
          </button>

          {isSpeechRecognitionAvailable() && (
            <button
              type="button"
              onClick={() => {
                if (voiceState === 'listening') { stopListening(); setVoiceState('idle') } else {
                  const settings = loadVoiceSettings()
                  setVoiceState('listening')
                  startListening(settings, {
                    onResult: (text, isFinal) => {
                      if (isFinal) { setInput((prev) => (prev ? prev + ' ' + text : text)); setInterimText(''); setVoiceState('idle')
                        if (settings.autoSend && text.trim()) { setTimeout(() => { const currentInput = (textareaRef.current?.value || '').trim(); if (currentInput) onSend(currentInput); setInput('') }, 100) }
                      } else { setInterimText(text) }
                    },
                    onError: () => { setVoiceState('idle'); setInterimText('') },
                    onEnd: () => { setVoiceState('idle'); setInterimText('') },
                  })
                }
              }}
              disabled={disabled || isRecording}
              title={voiceState === 'listening' ? 'Stop listening' : 'Voice input (speech-to-text)'}
              className={`p-2.5 rounded-xl transition-all shrink-0 mb-0.5 ${voiceState === 'listening' ? 'text-danger bg-danger/10 animate-pulse' : 'text-text-muted/60 hover:text-accent hover:bg-accent/8 disabled:opacity-25'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          )}

          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} aria-label="Message input"
            placeholder={isRecording ? t('chat.recordingAudio', 'Recording audio…') : voiceState === 'listening' ? t('chat.listening', 'Listening…') : noModel ? t('chat.selectModelOrRunPipeline', 'Select a model to chat, or say "run Morning Run pipeline"') : t('chat.messagePlaceholder', 'Send a message… (Shift+Enter for new line, paste/drag files)')}
            rows={1} disabled={disabled} className="flex-1 resize-none bg-transparent text-text-primary placeholder-text-muted/40 focus:outline-none text-[15px] leading-relaxed disabled:opacity-35 py-2.5 max-h-40" />

          {interimText && <span className="absolute left-24 right-24 bottom-3.5 text-[12px] text-accent/50 italic truncate pointer-events-none">{interimText}</span>}

          {isStreaming ? (
            <button type="button" onClick={onStop} title="Stop generating" className="px-4 py-2.5 rounded-xl bg-danger/85 text-white text-[12px] font-semibold hover:bg-danger hover:shadow-[0_2px_12px_rgba(220,38,38,0.25)] transition-all duration-200 shrink-0 flex items-center gap-2 mb-0.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg><span>Stop</span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={disabled || (!input.trim() && !attachments.length)} title="Send message" className="p-3.5 rounded-2xl bg-accent text-white hover:bg-accent-hover hover:shadow-[0_2px_12px_rgba(var(--t-accent-rgb),0.25)] disabled:opacity-15 disabled:cursor-not-allowed transition-all duration-200 shrink-0 mb-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </div>
        <p className="text-[11px] text-text-muted/45 text-center mt-2 font-medium">{t('chat.pipelineCommandHint', 'Try /pipeline list, or say "run Morning Run pipeline"')}</p>
        <p className="text-[11px] text-text-muted/30 text-center mt-2.5 font-medium">{t('chat.aiDisclaimer', 'AI can make mistakes. Please verify important information.')}</p>
      </div>
    </div>
  )
}
