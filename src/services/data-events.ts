const DATA_EVENT_NAME = "suora:data-changed"

type DataChangedDetail = { route: string }

export function emitDataChanged(route: string) {
  window.dispatchEvent(new CustomEvent<DataChangedDetail>(DATA_EVENT_NAME, { detail: { route } }))
}

export function subscribeToDataChanges(handler: (route: string) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<DataChangedDetail>).detail.route)
  window.addEventListener(DATA_EVENT_NAME, listener)
  return () => window.removeEventListener(DATA_EVENT_NAME, listener)
}
