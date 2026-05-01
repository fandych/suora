export type ElectronBridge = {
  invoke: (ch: string, ...args: unknown[]) => Promise<unknown>
  on?: (channel: string, listener: (...args: unknown[]) => void) => void
  off?: (channel: string, listener: (...args: unknown[]) => void) => void
}

export function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}
