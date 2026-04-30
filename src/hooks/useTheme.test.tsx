import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store/appStore'
import { useTheme } from './useTheme'

function ThemeHarness() {
  useTheme()
  return null
}

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    document.documentElement.classList.remove('light')
    document.documentElement.removeAttribute('style')
    useAppStore.setState({
      theme: 'system',
      fontSize: 'medium',
      codeFont: 'default',
      accentColor: 'default',
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  it('falls back to light mode when system theme detection is unavailable', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    render(<ThemeHarness />)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })
})