import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import {
  loadVoiceSettings,
  saveVoiceSettings,
  isSpeechRecognitionAvailable,
  isSpeechSynthesisAvailable,
  getAvailableVoices,
  getMicrophonePermissionState,
  requestMicrophoneStream,
  stopMicrophoneStream,
  speak,
  stopSpeaking,
  type MicrophonePermissionState,
  type VoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from '@/services/voiceInteraction'
import {
  SettingsOverview,
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
} from './panelUi'
import { Checkbox } from '@/components/catalyst-ui/checkbox'
import { Button as UiButton } from '@/components/catalyst-ui/button'
import { Input as UiInput, Select as UiSelect } from '@/components/catalyst-ui/form-controls'

export function VoiceSettings() {
  const { t } = useI18n()
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [testText, setTestText] = useState('')
  const [ttsError, setTtsError] = useState('')
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermissionState>('unknown')
  const [microphoneMessage, setMicrophoneMessage] = useState('')
  const voiceLanguageOptions = [
    { value: 'en-US', label: t('settings.voiceLanguageEnUs', 'English (US)') },
    { value: 'en-GB', label: t('settings.voiceLanguageEnGb', 'English (UK)') },
    { value: 'zh-CN', label: t('settings.voiceLanguageZhCn', 'Chinese (Simplified)') },
    { value: 'zh-TW', label: t('settings.voiceLanguageZhTw', 'Chinese (Traditional)') },
    { value: 'ja-JP', label: t('settings.voiceLanguageJaJp', 'Japanese') },
    { value: 'ko-KR', label: t('settings.voiceLanguageKoKr', 'Korean') },
    { value: 'es-ES', label: t('settings.voiceLanguageEsEs', 'Spanish') },
    { value: 'fr-FR', label: t('settings.voiceLanguageFrFr', 'French') },
    { value: 'de-DE', label: t('settings.voiceLanguageDeDe', 'German') },
  ]

  useEffect(() => {
    setVoiceSettings(loadVoiceSettings())
    void getMicrophonePermissionState().then(setMicrophonePermission)

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
  const microphonePermissionLabel = microphonePermission === 'granted'
    ? t('settings.microphonePermissionGranted', 'Granted')
    : microphonePermission === 'prompt'
      ? t('settings.microphonePermissionPrompt', 'Needs approval')
      : microphonePermission === 'denied'
        ? t('settings.microphonePermissionDenied', 'Denied')
        : microphonePermission === 'unsupported'
          ? t('settings.microphonePermissionUnsupported', 'Unavailable')
          : t('settings.microphonePermissionUnknown', 'Unknown')
  const selectedVoiceLabel = voiceSettings.voiceName || t('settings.default', 'Default')
  const selectedLanguageLabel = voiceLanguageOptions.find((option) => option.value === voiceSettings.language)?.label || voiceSettings.language
  const refreshMicrophonePermission = async () => {
    setMicrophoneMessage('')
    const access = await requestMicrophoneStream()
    setMicrophonePermission(access.state)
    if (access.ok) {
      stopMicrophoneStream(access.stream)
      setMicrophoneMessage(t('settings.microphoneAccessReady', 'Microphone access is ready for voice input.'))
      return
    }
    setMicrophoneMessage(access.message ?? t('settings.microphonePermissionDenied', 'Denied'))
  }

  return (
    <div className="space-y-6">
      <SettingsOverview
        description={t('settings.voiceWorkbenchDesc', 'Tune speech recognition, output voice, cadence, and quick test playback so voice interactions feel intentional instead of bolted on.')}
        statsClassName="grid gap-2 sm:grid-cols-2 xl:w-md xl:grid-cols-4"
        stats={(
          <>
            <SettingsStat label={t('settings.voice', 'Voice')} value={voiceSettings.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={selectedLanguageLabel} />
            <SettingsStat label={t('settings.voiceName', 'Voice')} value={selectedVoiceLabel} />
            <SettingsStat label={t('settings.availableVoices', 'Voices')} value={String(voices.length)} />
          </>
        )}
      />

      <SettingsSection
        eyebrow={t('settings.voiceSettings', 'Voice Settings')}
        title={t('settings.captureAndPlayback', 'Capture & Playback')}
        description={t('settings.captureAndPlaybackDesc', 'Configure the speech language, active synthesized voice, and sending behavior used by chat composition and spoken responses.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <SettingsToggleRow
              label={t('settings.enableVoice', 'Enable Voice Interaction')}
              description={t('settings.enableVoiceDesc', 'Turn on speech capture and text-to-speech capabilities across the chat workbench.')}
              checked={voiceSettings.enabled}
              onChange={() => updateSettings({ enabled: !voiceSettings.enabled })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.language', 'Language')}</label>
                <UiSelect
                  value={voiceSettings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  aria-label={t('settings.language', 'Language')}
                  wrapperClassName="w-full"
                >
                  {voiceLanguageOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </UiSelect>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.voiceName', 'Voice')}</label>
                <UiSelect
                  value={voiceSettings.voiceName || ''}
                  onChange={(e) => updateSettings({ voiceName: e.target.value || undefined })}
                  aria-label={t('settings.voiceName', 'Voice')}
                  wrapperClassName="w-full"
                >
                  <option value="">{t('settings.default', 'Default')}</option>
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>
                  ))}
                </UiSelect>
              </div>
            </div>

            <label className="rounded-md border border-border-subtle bg-surface-2/55 p-3 flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={voiceSettings.autoSend}
                onChange={(v) => updateSettings({ autoSend: v })}
                color="blue"
              />
              <span className="text-sm text-text-secondary">{t('settings.autoSendSpeech', 'Auto-send after speech recognition')}</span>
            </label>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.speechRate', 'Speech Rate')} ({voiceSettings.rate.toFixed(1)})</label>
              <UiInput
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.rate}
                onChange={(e) => updateSettings({ rate: parseFloat(e.target.value) })}
                aria-label={t('settings.speechRate', 'Speech Rate')}
                className="w-full cursor-pointer accent-accent"
              />
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>{t('settings.slower', 'Slower')}</span>
                <span>{t('settings.faster', 'Faster')}</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.pitch', 'Pitch')} ({voiceSettings.pitch.toFixed(1)})</label>
              <UiInput
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={voiceSettings.pitch}
                onChange={(e) => updateSettings({ pitch: parseFloat(e.target.value) })}
                aria-label={t('settings.pitch', 'Pitch')}
                className="w-full cursor-pointer accent-accent"
              />
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>{t('settings.lower', 'Lower')}</span>
                <span>{t('settings.higher', 'Higher')}</span>
              </div>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('settings.voiceFineTuneHint', 'These controls affect synthesized playback only, so you can tune response cadence without changing recognition settings.')}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.status', 'Status')}
        title={t('settings.runtimeReadiness', 'Runtime Readiness')}
        description={t('settings.runtimeReadinessDesc', 'Check what the current Electron runtime can actually support before assuming speech capture or playback is available.')}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${recognitionAvailable ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-sm font-medium text-text-primary">{t('settings.speechRecognition', 'Speech Recognition')}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              {recognitionAvailable ? t('settings.sttAvailable', 'Speech Recognition (STT): Available') : t('settings.sttUnavailable', 'Speech Recognition (STT): Not Available')}
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${voiceAvailable ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-sm font-medium text-text-primary">{t('settings.speechSynthesis', 'Speech Synthesis')}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              {voiceAvailable ? t('settings.ttsAvailable', 'Speech Synthesis (TTS): Available') : t('settings.ttsUnavailable', 'Speech Synthesis (TTS): Not Available')}
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <div className="text-sm font-medium text-text-primary">{t('settings.availableVoices', 'Available voices')}</div>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-text-primary">{voices.length}</p>
            <p className="mt-1 text-[12px] text-text-muted">{selectedVoiceLabel}</p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${microphonePermission === 'granted' ? 'bg-success' : microphonePermission === 'prompt' ? 'bg-warning' : microphonePermission === 'denied' ? 'bg-danger' : 'bg-text-muted'}`} />
              <span className="text-sm font-medium text-text-primary">{t('settings.microphonePermission', 'Microphone Permission')}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">{microphonePermissionLabel}</p>
            <UiButton type="button" outline className="mt-3" onClick={() => void refreshMicrophonePermission()}>
              {t('settings.checkMicrophoneAccess', 'Check microphone access')}
            </UiButton>
            {microphoneMessage && <p className={`mt-3 text-[12px] leading-relaxed ${microphonePermission === 'denied' ? 'text-danger' : 'text-text-muted'}`}>{microphoneMessage}</p>}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.testSpeech', 'Test Speech')}
        title={t('settings.speechLab', 'Speech Lab')}
        description={t('settings.speechLabDesc', 'Run a quick playback test with the exact language, pitch, and rate you configured above before enabling voice in real workflows.')}
      >
        <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.testSpeech', 'Test Speech')}</label>
            <UiInput
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder={t('settings.testSpeechPlaceholder', 'Type text to speak…')}
              wrapperClassName="w-full"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <UiButton
              type="button"
              color="blue"
              onClick={() => {
                if (!testText) return
                setTtsError('')
                speak(testText, voiceSettings).catch((err) => {
                  setTtsError(err instanceof Error ? err.message : t('settings.speechSynthesisFailed', 'Speech synthesis failed'))
                })
              }}
            >
              <IconifyIcon name="ui-speaker" size={14} color="currentColor" />
              {t('settings.speak', 'Speak')}
            </UiButton>
            <UiButton type="button" outline onClick={stopSpeaking}>
              {t('settings.stop', 'Stop')}
            </UiButton>
          </div>

          {ttsError && <p className="text-sm text-danger">{ttsError}</p>}
        </div>
      </SettingsSection>
    </div>
  )
}