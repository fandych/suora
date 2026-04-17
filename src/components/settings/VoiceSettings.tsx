import { useState, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import {
  loadVoiceSettings,
  saveVoiceSettings,
  isSpeechRecognitionAvailable,
  isSpeechSynthesisAvailable,
  getAvailableVoices,
  speak,
  stopSpeaking,
  type VoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from '@/services/voiceInteraction'

export function VoiceSettings() {
  const { t } = useI18n()
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [testText, setTestText] = useState('')
  const [ttsError, setTtsError] = useState('')

  useEffect(() => {
    setVoiceSettings(loadVoiceSettings())
    if (isSpeechSynthesisAvailable()) {
      const loadVoices = () => setVoices(getAvailableVoices())
      loadVoices()
      speechSynthesis.addEventListener('voiceschanged', loadVoices)
      return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
    return undefined
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.voiceSettings', 'Voice Settings')}</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={voiceSettings.enabled}
              onChange={(e) => {
                const updated = { ...voiceSettings, enabled: e.target.checked }
                setVoiceSettings(updated)
                saveVoiceSettings(updated)
              }}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
            />
            <span className="text-sm text-text-secondary">{t('settings.enableVoice', 'Enable Voice Interaction')}</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{t('settings.language', 'Language')}</label>
            <select
              value={voiceSettings.language}
              onChange={(e) => {
                const updated = { ...voiceSettings, language: e.target.value }
                setVoiceSettings(updated)
                saveVoiceSettings(updated)
              }}
              aria-label="Voice language"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="zh-CN">中文 (简体)</option>
              <option value="zh-TW">中文 (繁體)</option>
              <option value="ja-JP">日本語</option>
              <option value="ko-KR">한국어</option>
              <option value="es-ES">Español</option>
              <option value="fr-FR">Français</option>
              <option value="de-DE">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
              {t('settings.speechRate', 'Speech Rate')}: {voiceSettings.rate.toFixed(1)}
            </label>
            <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate}
              onChange={(e) => { const updated = { ...voiceSettings, rate: parseFloat(e.target.value) }; setVoiceSettings(updated); saveVoiceSettings(updated) }}
              aria-label="Speech rate" className="w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
              {t('settings.pitch', 'Pitch')}: {voiceSettings.pitch.toFixed(1)}
            </label>
            <input type="range" min="0" max="2" step="0.1" value={voiceSettings.pitch}
              onChange={(e) => { const updated = { ...voiceSettings, pitch: parseFloat(e.target.value) }; setVoiceSettings(updated); saveVoiceSettings(updated) }}
              aria-label="Voice pitch" className="w-full" />
          </div>

          {voices.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{t('settings.voiceName', 'Voice')}</label>
              <select
                value={voiceSettings.voiceName || ''}
                onChange={(e) => { const updated = { ...voiceSettings, voiceName: e.target.value || undefined }; setVoiceSettings(updated); saveVoiceSettings(updated) }}
                aria-label="Voice name"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
              >
                <option value="">{t('settings.default', 'Default')}</option>
                {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={voiceSettings.autoSend}
              onChange={(e) => { const updated = { ...voiceSettings, autoSend: e.target.checked }; setVoiceSettings(updated); saveVoiceSettings(updated) }}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
            />
            <span className="text-sm text-text-secondary">{t('settings.autoSendSpeech', 'Auto-send after speech recognition')}</span>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.status', 'Status')}</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSpeechRecognitionAvailable() ? 'bg-success' : 'bg-danger'}`} />
            <span className="text-text-secondary">{isSpeechRecognitionAvailable() ? t('settings.sttAvailable', 'Speech Recognition (STT): Available') : t('settings.sttUnavailable', 'Speech Recognition (STT): Not Available')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSpeechSynthesisAvailable() ? 'bg-success' : 'bg-danger'}`} />
            <span className="text-text-secondary">{isSpeechSynthesisAvailable() ? t('settings.ttsAvailable', 'Speech Synthesis (TTS): Available') : t('settings.ttsUnavailable', 'Speech Synthesis (TTS): Not Available')}</span>
          </div>
          <div className="text-text-muted mt-1">{t('settings.availableVoices', 'Available voices')}: {voices.length}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.testSpeech', 'Test Speech')}</h3>
        <div className="flex gap-2">
          <input value={testText} onChange={(e) => setTestText(e.target.value)}
            placeholder={t('settings.testSpeechPlaceholder', 'Type text to speak…')}
            className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm" />
          <button onClick={() => { if (testText) { setTtsError(''); speak(testText, voiceSettings).catch((err) => { setTtsError(err instanceof Error ? err.message : 'Speech synthesis failed') }) } }}
            className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium inline-flex items-center gap-1.5">
            <IconifyIcon name="ui-speaker" size={14} color="currentColor" /> {t('settings.speak', 'Speak')}
          </button>
          <button onClick={stopSpeaking} className="px-3 py-2 rounded-lg bg-surface-3 text-text-secondary text-sm font-medium">{t('settings.stop', 'Stop')}</button>
        </div>
        {ttsError && <p className="text-xs text-danger mt-2">{ttsError}</p>}
      </div>
    </div>
  )
}
