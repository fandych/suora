const COMMAND_PALETTE_OPEN_EVENT = 'suora:command-palette:open'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
}

export function addCommandPaletteOpenListener(handler: EventListener) {
  window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler)
  return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler)
}
