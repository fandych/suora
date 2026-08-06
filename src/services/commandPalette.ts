const COMMAND_PALETTE_OPEN_EVENT = 'suora:command-palette:open'
const SHORTCUT_RECORDING_EVENT = 'suora:shortcut-recording'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
}

export function addCommandPaletteOpenListener(handler: EventListener) {
  window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler)
  return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler)
}

export function setShortcutRecording(active: boolean) {
  window.dispatchEvent(new CustomEvent(SHORTCUT_RECORDING_EVENT, { detail: { active } }))
}

export function addShortcutRecordingListener(handler: EventListener) {
  window.addEventListener(SHORTCUT_RECORDING_EVENT, handler)
  return () => window.removeEventListener(SHORTCUT_RECORDING_EVENT, handler)
}
