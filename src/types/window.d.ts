/**
 * Global window electron bridge type declarations
 */
import 'react'

interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
  send: (channel: string, ...args: unknown[]) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

declare module 'react' {
  // React's InputHTMLAttributes generic must retain the upstream parameter name
  // for declaration merging; it is intentionally unused in this augmentation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
    directory?: string
  }
}

export {}
