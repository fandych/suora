import { describe, expect, it, vi } from 'vitest'
import type { AppStore } from '@/store/appStore'
import { createUIPreferencesSlice } from './uiPreferencesSlice'

describe('createUIPreferencesSlice', () => {
  it('defaults the theme mode to system', () => {
    const slice = createUIPreferencesSlice(
      vi.fn() as never,
      (() => ({} as AppStore)) as never,
      {} as never,
    )

    expect(slice.theme).toBe('system')
  })
})