import { useEffect, useState } from 'react'
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
import {
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
  settingsCheckboxClass,
  settingsFieldCardClass,
  settingsHintClass,
  settingsInputClass,
  settingsLabelClass,
  settingsPrimaryButtonClass,
  settingsRangeClass,
  settingsSelectClass,
  settingsSecondaryButtonClass,
  settingsSurfaceCardClass,
} from './panelUi'

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

  const updateSettings = (patch: Partial<VoiceSettings>) => {
    const updated = { ...voiceSettings, ...patch }
    setVoiceSettings(updated)
    saveVoiceSettings(updated)
  }

  const voiceAvailable = isSpeechSynthesisAvailable()
  const recognitionAvailable = isSpeechRecognitionAvailable()
  const selectedVoiceLabel = voiceSettings.voiceName || t('settings.default', 'Default')

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.voiceSettings', 'Voice Settings')}</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{t('settings.voiceWorkbench', 'Speech Workbench')}</h2>
            <p className="mt-2 text-[14px] leading-7 text-text-secondary/82">
              {t('settings.voiceWorkbenchDesc', 'Tune speech recognition, output voice, cadence, and quick test playback so voice interactions feel intentional instead of bolted on.')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-md xl:grid-cols-4">
            <SettingsStat label={t('settings.voice', 'Voice')} value={voiceSettings.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={voiceSettings.language} />
            <SettingsStat label={t('settings.voiceName', 'Voice')} value={selectedVoiceLabel} />
            <SettingsStat label={t('settings.availableVoices', 'Voices')} value={String(voices.length)} />
          </div>
        </div>
      </section>

      <SettingsSection
        eyebrow={t('settings.voiceSettings', 'Voice Settings')}
        title={t('settings.captureAndPlayback', 'Capture & Playback')}
        description={t('settings.captureAndPlaybackDesc', 'Configure the speech language, active synthesized voice, and sending behavior used by chat composition and spoken responses.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
          <div className={`${settingsFieldCardClass} space-y-4`}>
            <SettingsToggleRow
              label={t('settings.enableVoice', 'Enable Voice Interaction')}
              description={t('settings.enableVoiceDesc', 'Turn on speech capture and text-to-speech capabilities across the chat workbench.')}
              checked={voiceSettings.enabled}
              onChange={() => updateSettings({ enabled: !voiceSettings.enabled })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={settingsLabelClass}>{t('settings.language', 'Language')}</label>
                <select
                  value={voiceSettings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  aria-label="Voice language"
                  className={settingsSelectClass}
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
                <label className={settingsLabelClass}>{t('settings.voiceName', 'Voice')}</label>
                <select
                  value={voiceSettings.voiceName || ''}
                  onChange={(e) => updateSettings({ voiceName: e.target.value || undefined })}
                  aria-label="Voice name"
                  className={settingsSelectClass}
                >
                  <option value="">{t('settings.default', 'Default')}</option>
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>
                  ))}
                </select>
              </div>
            </div>

            <label className={`${settingsSurfaceCardClass} flex items-center gap-3 cursor-pointer`}>
              <input
                type="checkbox"
                checked={voiceSettings.autoSend}
                onChange={(e) => updateSettings({ autoSend: e.target.checked })}
                className={settingsCheckboxClass}
              />
              <span className="text-sm text-text-secondary">{t('settings.autoSendSpeech', 'Auto-send after speech recognition')}</span>
            </label>
          </div>

          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div>
              <label className={settingsLabelClass}>{t('settings.speechRate', 'Speech Rate')} ({voiceSettings.rate.toFixed(1)})</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.rate}
                onChange={(e) => updateSettings({ rate: parseFloat(e.target.value) })}
                aria-label="Speech rate"
                className={settingsRangeClass}
              />
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>{t('settings.slower', 'Slower')}</span>
                <span>{t('settings.faster', 'Faster')}</span>
              </div>
            </div>

            <div>
              <label className={settingsLabelClass}>{t('settings.pitch', 'Pitch')} ({voiceSettings.pitch.toFixed(1)})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={voiceSettings.pitch}
                onChange={(e) => updateSettings({ pitch: parseFloat(e.target.value) })}
                aria-label="Voice pitch"
                className={settingsRangeClass}
              />
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>{t('settings.lower', 'Lower')}</span>
                <span>{t('settings.higher', 'Higher')}</span>
              </div>
            </div>

            <p className={settingsHintClass}>{t('settings.voiceFineTuneHint', 'These controls affect synthesized playback only, so you can tune response cadence without changing recognition settings.')}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.status', 'Status')}
        title={t('settings.runtimeReadiness', 'Runtime Readiness')}
        description={t('settings.runtimeReadinessDesc', 'Check what the current Electron runtime can actually support before assuming speech capture or playback is available.')}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className={settingsFieldCardClass}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${recognitionAvailable ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-sm font-medium text-text-primary">{t('settings.speechRecognition', 'Speech Recognition')}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              {recognitionAvailable ? t('settings.sttAvailable', 'Speech Recognition (STT): Available') : t('settings.sttUnavailable', 'Speech Recognition (STT): Not Available')}
            </p>
          </div>

          <div className={settingsFieldCardClass}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${voiceAvailable ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-sm font-medium text-text-primary">{t('settings.speechSynthesis', 'Speech Synthesis')}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              {voiceAvailable ? t('settings.ttsAvailable', 'Speech Synthesis (TTS): Available') : t('settings.ttsUnavailable', 'Speech Synthesis (TTS): Not Available')}
            </p>
          </div>

          <div className={settingsFieldCardClass}>
            <div className="text-sm font-medium text-text-primary">{t('settings.availableVoices', 'Available voices')}</div>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-text-primary">{voices.length}</p>
            <p className="mt-1 text-[12px] text-text-muted">{selectedVoiceLabel}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.testSpeech', 'Test Speech')}
        title={t('settings.speechLab', 'Speech Lab')}
        description={t('settings.speechLabDesc', 'Run a quick playback test with the exact language, pitch, and rate you configured above before enabling voice in real workflows.')}
      >
        <div className={`${settingsFieldCardClass} space-y-4`}>
          <div>
            <label className={settingsLabelClass}>{t('settings.testSpeech', 'Test Speech')}</label>
            <input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder={t('settings.testSpeechPlaceholder', 'Type text to speak…')}
              className={settingsInputClass}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (!testText) return
                setTtsError('')
                speak(testText, voiceSettings).catch((err) => {
                  setTtsError(err instanceof Error ? err.message : 'Speech synthesis failed')
                })
              }}
              className={settingsPrimaryButtonClass}
            >
              <IconifyIcon name="ui-speaker" size={14} color="currentColor" />
              {t('settings.speak', 'Speak')}
            </button>
            <button type="button" onClick={stopSpeaking} className={settingsSecondaryButtonClass}>
              {t('settings.stop', 'Stop')}
            </button>
          </div>

          {ttsError && <p className="text-sm text-danger">{ttsError}</p>}
        </div>
      </SettingsSection>
    </div>
  )
}