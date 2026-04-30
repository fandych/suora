export type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

export function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}
