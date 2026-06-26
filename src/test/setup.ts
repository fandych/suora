import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Electron APIs
global.window = global.window || {}
global.window.electron = {
  invoke: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
}

// Mock localStorage with actual storage
const storage = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() {
    return storage.size
  },
  key: (index: number) => Array.from(storage.keys())[index] || null,
}
global.localStorage = localStorageMock as unknown as Storage

// Suppress console errors in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}

// Mock ResizeObserver (not available in jsdom, required by Headless UI anchor positioning)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver (required by Headless UI floating panels)
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: ReadonlyArray<number> = []
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

// Provide getBoundingClientRect layout stubs so Headless UI / FloatingUI
// can compute positions without throwing in jsdom
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function () {
    return { width: 200, height: 40, top: 0, left: 0, bottom: 40, right: 200, x: 0, y: 0, toJSON() { return this } }
  }
}
