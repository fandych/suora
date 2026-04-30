// Voice Interaction — Speech-to-Text and Text-to-Speech using the Web Speech API.
// No external dependencies required.

import { readCached, writeCached } from '@/services/fileStorage'
import { safeParse, safeStringify } from '@/utils/safeJson'

// ─── Types ──────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'speaking'

export interface VoiceSettings {
  enabled: boolean
  language: string        // BCP 47 language tag, e.g. 'en-US', 'zh-CN'
  rate: number            // speech rate 0.1-10
  pitch: number           // pitch 0-2
  volume: number          // volume 0-1
  autoSend: boolean       // auto-send after speech recognition completes
  voiceName?: string      // preferred voice name
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: false,
  language: 'en-US',
  rate: 1,
  pitch: 1,
  volume: 1,
  autoSend: false,
}

// ─── Speech Recognition (STT) ──────────────────────────────────────

// Use 'any' for SpeechRecognition since TypeScript doesn't have built-in types
// for the vendor-prefixed webkitSpeechRecognition in all environments.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Check if the Web Speech API is available. */
export function isSpeechRecognitionAvailable(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

let recognitionInstance: any = null

interface STTCallbacks {
  onResult: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
  onEnd: () => void
}

/**
 * Start listening for speech input.
 */
export function startListening(settings: VoiceSettings, callbacks: STTCallbacks): void {
  if (!isSpeechRecognitionAvailable()) {
    callbacks.onError('Speech recognition not available in this browser')
    return
  }

  stopListening()

  const win = window as any
  const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition

  if (!SpeechRecognitionCtor) {
    callbacks.onError('Speech recognition not supported')
    return
  }

  const recognition = new SpeechRecognitionCtor()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = settings.language
  recognition.maxAlternatives = 1

  recognition.onresult = (event: any) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    if (finalTranscript) {
      callbacks.onResult(finalTranscript, true)
    } else if (interimTranscript) {
      callbacks.onResult(interimTranscript, false)
    }
  }

  recognition.onerror = (event: any) => {
    const friendlyMessages: Record<string, string> = {
      'network': 'Network connection failed — check your internet',
      'no-speech': 'No speech detected — please try again',
      'audio-capture': 'Microphone not available — check permissions',
      'not-allowed': 'Microphone access denied — enable it in system settings',
      'aborted': 'Speech recognition was cancelled',
      'service-not-allowed': 'Speech service not available in this environment',
    }
    const code = event.error || 'unknown'
    callbacks.onError(friendlyMessages[code] || `Speech recognition error: ${code}`)
  }

  recognition.onend = () => {
    recognitionInstance = null
    callbacks.onEnd()
  }

  recognitionInstance = recognition
  recognition.start()
}

/**
 * Stop listening for speech input.
 */
export function stopListening(): void {
  if (recognitionInstance) {
    try { recognitionInstance.stop() } catch { /* ignore */ }
    recognitionInstance = null
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Speech Synthesis (TTS) ────────────────────────────────────────

/** Check if speech synthesis is available. */
export function isSpeechSynthesisAvailable(): boolean {
  return 'speechSynthesis' in window
}

/**
 * Get available speech synthesis voices, optionally filtered by language.
 */
export function getAvailableVoices(lang?: string): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisAvailable()) return []
  const voices = speechSynthesis.getVoices()
  if (lang) {
    return voices.filter((v) => v.lang.startsWith(lang.split('-')[0]))
  }
  return voices
}

/**
 * Speak text using speech synthesis.
 * Returns a promise that resolves when speaking is done.
 */
export function speak(text: string, settings: VoiceSettings): Promise<void> {
  const TTS_TIMEOUT_MS = 30_000

  const speechPromise = new Promise<void>((resolve, reject) => {
    if (!isSpeechSynthesisAvailable()) {
      reject(new Error('Speech synthesis not available'))
      return
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = settings.language
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    utterance.volume = settings.volume

    // Try to use preferred voice, with language-based fallback
    if (settings.voiceName) {
      const voice = speechSynthesis.getVoices().find((v) => v.name === settings.voiceName)
      if (voice) {
        utterance.voice = voice
      } else {
        // Fallback: match by language prefix
        const langPrefix = settings.language.split('-')[0]
        const fallback = speechSynthesis.getVoices().find((v) => v.lang.startsWith(langPrefix))
        if (fallback) utterance.voice = fallback
      }
    }

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(new Error(e.error))

    speechSynthesis.speak(utterance)
  })

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<void>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      speechSynthesis.cancel()
      reject(new Error('Speech synthesis timed out after 30 seconds'))
    }, TTS_TIMEOUT_MS)
  })

  return Promise.race([speechPromise, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  })
}

/**
 * Stop any ongoing speech synthesis.
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisAvailable()) {
    speechSynthesis.cancel()
  }
}

// ─── Voice settings persistence ─────────────────────────────────────

const VOICE_SETTINGS_KEY = 'suora-voice-settings'

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = readCached(VOICE_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS }
    return { ...DEFAULT_VOICE_SETTINGS, ...safeParse<Partial<VoiceSettings>>(raw) }
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS }
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  writeCached(VOICE_SETTINGS_KEY, safeStringify(settings))
}
