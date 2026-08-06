import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from './ChatInput'

const mockRequestMicrophoneStream = vi.fn()
const mockStopMicrophoneStream = vi.fn()
const mockStartListening = vi.fn()
const mockStopListening = vi.fn()
const mockLoadVoiceSettings = vi.fn()
const mockSaveVoiceSettings = vi.fn()

vi.mock('@/components/chat/ChatMessages', () => ({
  formatFileSize: (value: number) => `${value}`,
}))

vi.mock('@/services/voiceInteraction', () => ({
  isSpeechRecognitionAvailable: () => true,
  startListening: (...args: unknown[]) => mockStartListening(...args),
  stopListening: (...args: unknown[]) => mockStopListening(...args),
  loadVoiceSettings: () => mockLoadVoiceSettings(),
  saveVoiceSettings: (...args: unknown[]) => mockSaveVoiceSettings(...args),
  requestMicrophoneStream: (...args: unknown[]) => mockRequestMicrophoneStream(...args),
  stopMicrophoneStream: (...args: unknown[]) => mockStopMicrophoneStream(...args),
}))

describe('ChatInput', () => {
  beforeEach(() => {
    mockRequestMicrophoneStream.mockReset()
    mockStopMicrophoneStream.mockReset()
    mockStartListening.mockReset()
    mockStopListening.mockReset()
    mockLoadVoiceSettings.mockReset()
    mockSaveVoiceSettings.mockReset()
    mockLoadVoiceSettings.mockReturnValue({
      enabled: false,
      language: 'en-US',
      rate: 1,
      pitch: 1,
      volume: 1,
      autoSend: false,
    })
    mockRequestMicrophoneStream.mockResolvedValue({
      ok: true,
      state: 'granted',
      stream: { getTracks: () => [] },
    })
  })

  it('shows the speech-to-text button and enables voice settings on first use', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={vi.fn()} disabled={false} />)

    const voiceButton = screen.getByRole('button', { name: /Voice input|语音输入/i })
    await user.click(voiceButton)

    await waitFor(() => {
      expect(mockSaveVoiceSettings).toHaveBeenCalledWith({
        enabled: true,
        language: 'en-US',
        rate: 1,
        pitch: 1,
        volume: 1,
        autoSend: false,
      })
      expect(mockStartListening).toHaveBeenCalled()
    })
  })
})