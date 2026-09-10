import { getProjectBridge } from "@/lib/ipc/bridge"

export const catalogIpc = {
  list: async (route: string) => getProjectBridge().catalog.list(route),
  get: async (route: string, itemId: string) => getProjectBridge().catalog.get(route, itemId),
}
