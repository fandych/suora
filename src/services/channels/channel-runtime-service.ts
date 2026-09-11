import type { ChannelSummary } from "@/data/domain/models"
import { ensureChannelCatalogItems } from "@/data/repositories/channel-catalog"
import { projectIpc } from "@/lib/ipc"

type ListChannels = () => Promise<ChannelSummary[]>

export async function syncChannelRuntimeRegistration(listChannels: ListChannels) {
  await projectIpc.channels.registerRuntime()
  const channels = await listChannels()
  const hasEnabledChannels = channels.some((item) => item.enabled)
  const hasEnabledWebhookTransport = channels.some((item) => item.enabled && item.connectionMode === "webhook")

  if (hasEnabledWebhookTransport) {
    await projectIpc.channels.startRuntime()
    return
  }

  if (!hasEnabledChannels) {
    const status = await projectIpc.channels.getRuntimeStatus() as { running: boolean }
    if (status.running) await projectIpc.channels.stopRuntime()
  }
}

export async function restoreChannelRuntime(listChannels: ListChannels) {
  await ensureChannelCatalogItems()
  const channels = await listChannels()
  await projectIpc.channels.registerRuntime()
  if (channels.some((item) => item.enabled && item.connectionMode === "webhook")) {
    await projectIpc.channels.startRuntime()
  }
}

export function getChannelRuntimeStatus() {
  return projectIpc.channels.getRuntimeStatus() as Promise<{ running: boolean }>
}

export function startChannelRuntime() {
  return projectIpc.channels.startRuntime()
}

export function stopChannelRuntime() {
  return projectIpc.channels.stopRuntime()
}

export async function getChannelWebhookRuntimeUrl(channelId: string) {
  return projectIpc.channels.getWebhookUrl({ id: channelId }) as Promise<{ success?: boolean; url?: string }>
}

export function getChannelAccessToken(channelId: string) {
  return projectIpc.channels.getAccessToken(channelId)
}

export function getChannelStreamStatus(channelId: string) {
  return projectIpc.channels.getStreamStatus(channelId)
}

export function runChannelHealthCheck(channelId: string) {
  return projectIpc.channels.healthCheck(channelId)
}
