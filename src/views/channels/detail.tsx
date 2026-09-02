import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getChannel, saveChannel } from "@/data/repositories/channel-repository"
import { listAgents } from "@/data/repositories/agent-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { ChannelEditorForm } from "@/views/channels/components/channel-editor-form"
import { ChannelRuntimePanel } from "@/views/channels/components/channel-runtime-panel"
import { getChannelStatusLabel, getChannelStatusVariant, hasChannelCredentialFootprint } from "@/views/channels/components/channel-utils"
import type { ChannelDetail } from "@/data/domain/models"

const ChannelDetailPage = () => {
  const { channelId } = useParams<{ channelId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getChannel(channelId ?? ""), [channelId])
  const { data: agentsData } = useAsyncResource(() => listAgents(), [])
  const [draft, setDraft] = useState<ChannelDetail | null>(null)
  const agents = agentsData ?? []

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  const persistDraft = async (nextDraft: ChannelDetail) => {
    const next = await saveChannel(nextDraft)
    setData(next)
    setDraft(next)
  }

  const handleSave = async () => {
    if (!draft) {
      return
    }

    await persistDraft(draft)
  }

  const handleHealthCheck = async () => {
    if (!draft) {
      return
    }

    const timestamp = Date.now()
    const hasCredentials = hasChannelCredentialFootprint(draft.channel)
    const isHealthy = draft.channel.enabled && hasCredentials
    const latencyMs = isHealthy ? 120 + (draft.channel.messageCount % 5) * 37 : undefined
    const errorMessage = draft.channel.enabled
      ? hasCredentials
        ? undefined
        : "Required channel credentials are incomplete for the selected platform."
      : "Channel is disabled, so runtime delivery is offline."

    const nextDraft: ChannelDetail = {
      channel: {
        ...draft.channel,
        status: draft.channel.enabled ? (isHealthy ? "active" : "error") : "inactive",
      },
      runtime: {
        ...draft.runtime,
        health: {
          isHealthy,
          lastCheckAt: timestamp,
          latencyMs,
          errorCount: isHealthy ? draft.runtime.health.errorCount : draft.runtime.health.errorCount + 1,
          lastError: errorMessage,
        },
        debugLog: [
          {
            id: crypto.randomUUID(),
            timestamp,
            tone: isHealthy ? "success" : "error",
            text: isHealthy ? "Health check passed." : errorMessage ?? "Health check failed.",
          },
          ...draft.runtime.debugLog,
        ],
      },
    }

    await persistDraft(nextDraft)
  }

  const handleSendMock = async (message: string) => {
    if (!draft || !message.trim()) {
      return
    }

    const timestamp = Date.now()
    const incomingMessage = {
      id: crypto.randomUUID(),
      direction: "incoming" as const,
      senderName: "Mock user",
      senderId: "mock-user",
      content: message.trim(),
      status: "received" as const,
      createdAt: timestamp,
    }
    const outgoingMessage = draft.channel.autoReply
      ? {
          id: crypto.randomUUID(),
          direction: "outgoing" as const,
          senderName: draft.channel.replyAgentId || "SUORA",
          senderId: draft.channel.replyAgentId || "suora",
          content: draft.channel.replyAgentId ? `Auto reply from ${draft.channel.replyAgentId}: ${message.trim()}` : `Received: ${message.trim()}`,
          status: "sent" as const,
          createdAt: timestamp + 1,
        }
      : null
    const nextMessages = outgoingMessage ? [...draft.runtime.messages, incomingMessage, outgoingMessage] : [...draft.runtime.messages, incomingMessage]
    const existingUser = draft.runtime.users.find((user) => user.senderId === "mock-user")
    const nextUsers = existingUser
      ? draft.runtime.users.map((user) => user.senderId === "mock-user"
        ? {
            ...user,
            lastActiveAt: timestamp,
            messageCount: user.messageCount + 1,
            conversationHistory: [
              ...user.conversationHistory,
              { role: "user" as const, content: message.trim(), timestamp },
              ...(outgoingMessage ? [{ role: "assistant" as const, content: outgoingMessage.content, timestamp: timestamp + 1 }] : []),
            ],
          }
        : user)
      : [
          ...draft.runtime.users,
          {
            id: crypto.randomUUID(),
            channelId: draft.channel.id,
            senderName: "Mock user",
            senderId: "mock-user",
            firstSeenAt: timestamp,
            lastActiveAt: timestamp,
            messageCount: 1,
            conversationHistory: [
              { role: "user" as const, content: message.trim(), timestamp },
              ...(outgoingMessage ? [{ role: "assistant" as const, content: outgoingMessage.content, timestamp: timestamp + 1 }] : []),
            ],
          },
        ]

    const nextDraft: ChannelDetail = {
      channel: {
        ...draft.channel,
        lastMessageAt: timestamp,
        messageCount: nextMessages.length,
        status: draft.channel.enabled ? "active" : draft.channel.status,
      },
      runtime: {
        ...draft.runtime,
        messages: nextMessages,
        users: nextUsers,
        health: {
          ...draft.runtime.health,
          isHealthy: draft.channel.enabled ? true : draft.runtime.health.isHealthy,
          lastCheckAt: timestamp,
          latencyMs: draft.channel.enabled ? 110 : draft.runtime.health.latencyMs,
        },
        debugLog: [
          {
            id: crypto.randomUUID(),
            timestamp,
            tone: "info",
            text: `Mock inbound message received on ${draft.channel.title}.`,
          },
          ...(outgoingMessage ? [{ id: crypto.randomUUID(), timestamp: timestamp + 1, tone: "success" as const, text: `Auto reply dispatched via ${draft.channel.replyAgentId || "SUORA"}.` }] : []),
          ...draft.runtime.debugLog,
        ],
      },
    }

    await persistDraft(nextDraft)
  }

  const handleClearDebug = async () => {
    if (!draft) {
      return
    }

    await persistDraft({
      ...draft,
      runtime: {
        ...draft.runtime,
        debugLog: [],
      },
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.channel.title || "Channel"}
        description="Main-branch channel configuration and runtime behavior, adapted into the new route shell."
        actions={draft ? (
          <>
            <Badge variant={getChannelStatusVariant(draft.channel.status)}>{getChannelStatusLabel(draft.channel.status)}</Badge>
            <Button size="sm" onClick={() => void handleSave()}>Save channel</Button>
          </>
        ) : null}
      />
      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {isLoading ? <LoadingCard title="Loading channel..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <ChannelEditorForm channel={draft.channel} agents={agents} onChange={(channel) => setDraft({ ...draft, channel })} onSave={() => void handleSave()} />
              <ChannelRuntimePanel detail={draft} agents={agents} onHealthCheck={() => void handleHealthCheck()} onSendMock={(message) => void handleSendMock(message)} onClearDebug={() => void handleClearDebug()} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelDetailPage