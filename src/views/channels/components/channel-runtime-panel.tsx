import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AgentSummary, ChannelDetail } from "@/data/domain/models"
import { buildChannelWebhookUrl, getChannelPlatformLabel, getChannelStatusLabel, getChannelStatusVariant } from "@/views/channels/components/channel-utils"

type ChannelRuntimePanelProps = {
  detail: ChannelDetail
  agents: AgentSummary[]
  onHealthCheck: () => void
  onSendMock: (message: string) => void
  onClearDebug: () => void
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function ChannelRuntimePanel({ detail, agents, onHealthCheck, onSendMock, onClearDebug }: ChannelRuntimePanelProps) {
  const { channel, runtime } = detail
  const [mockMessage, setMockMessage] = useState("")
  const replyAgentName = agents.find((agent) => agent.id === channel.replyAgentId)?.title ?? "No agent"
  const incomingCount = runtime.messages.filter((item) => item.direction === "incoming").length
  const outgoingCount = runtime.messages.filter((item) => item.direction === "outgoing").length
  const debugEntries = useMemo(() => [...runtime.debugLog].sort((left, right) => right.timestamp - left.timestamp), [runtime.debugLog])

  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Channel runtime</CardTitle>
          <Badge variant={getChannelStatusVariant(channel.status)}>{getChannelStatusLabel(channel.status)}</Badge>
        </div>
        <CardDescription className="text-xs">Overview, message traffic, health, and mock-mode controls aligned with main branch behavior.</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0">
        <Tabs defaultValue="overview" className="flex min-h-0 flex-col gap-3">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Platform" value={getChannelPlatformLabel(channel.platform)} />
              <StatCard label="Reply agent" value={replyAgentName} />
              <StatCard label="Webhook" value={buildChannelWebhookUrl(channel)} />
              <StatCard label="Messages" value={String(channel.messageCount)} />
              <StatCard label="Users" value={String(runtime.users.length)} />
              <StatCard label="Health" value={runtime.health.isHealthy == null ? "Not checked" : runtime.health.isHealthy ? "Healthy" : "Unhealthy"} />
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-0">
            <ScrollArea className="h-96 rounded-xl border">
              <div className="space-y-2 p-3">
                {runtime.messages.length ? runtime.messages.map((message) => (
                  <div key={message.id} className="rounded-xl border px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{message.senderName}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{message.direction} · {message.status} · {message.senderId}</div>
                    <div className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-foreground">{message.content}</div>
                  </div>
                )) : <div className="rounded-xl border border-dashed px-3 py-5 text-xs text-muted-foreground">No messages yet.</div>}
              </div>
            </ScrollArea>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StatCard label="Incoming" value={String(incomingCount)} />
              <StatCard label="Outgoing" value={String(outgoingCount)} />
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <ScrollArea className="h-96 rounded-xl border">
              <div className="space-y-2 p-3">
                {runtime.users.length ? runtime.users.map((user) => (
                  <div key={user.id} className="rounded-xl border px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-foreground">{user.senderName}</div>
                        <div className="text-[10px] text-muted-foreground">{user.senderId}</div>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div>{user.messageCount} messages</div>
                        <div>{new Date(user.lastActiveAt).toLocaleString()}</div>
                      </div>
                    </div>
                    {user.conversationHistory.length ? <div className="mt-2 space-y-1">{user.conversationHistory.slice(-3).map((entry, index) => <div key={`${entry.timestamp}-${index}`} className="text-[11px] text-muted-foreground">{entry.role}: {entry.content}</div>)}</div> : null}
                  </div>
                )) : <div className="rounded-xl border border-dashed px-3 py-5 text-xs text-muted-foreground">No users yet.</div>}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="health" className="mt-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Status" value={runtime.health.isHealthy == null ? "Not checked" : runtime.health.isHealthy ? "Healthy" : "Unhealthy"} />
              <StatCard label="Latency" value={runtime.health.latencyMs == null ? "Pending" : `${runtime.health.latencyMs}ms`} />
              <StatCard label="Errors" value={String(runtime.health.errorCount)} />
              <StatCard label="Last check" value={runtime.health.lastCheckAt ? new Date(runtime.health.lastCheckAt).toLocaleString() : "Never"} />
            </div>
            {runtime.health.lastError ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{runtime.health.lastError}</div> : null}
            <Button size="sm" variant="outline" onClick={onHealthCheck}>Run health check</Button>
          </TabsContent>

          <TabsContent value="debug" className="mt-0 space-y-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input className="h-8 text-xs" value={mockMessage} onChange={(event) => setMockMessage(event.target.value)} placeholder="Send a mock inbound message" />
              <Button size="sm" onClick={() => { onSendMock(mockMessage); setMockMessage("") }} disabled={!mockMessage.trim()}>Send mock</Button>
              <Button size="sm" variant="outline" onClick={onClearDebug} disabled={!debugEntries.length}>Clear log</Button>
            </div>
            <ScrollArea className="h-80 rounded-xl border">
              <div className="space-y-2 p-3">
                {debugEntries.length ? debugEntries.map((entry) => (
                  <div key={entry.id} className={`rounded-xl border px-3 py-2 text-xs ${entry.tone === "error" ? "border-destructive/30 bg-destructive/5" : entry.tone === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "bg-muted/20"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium uppercase tracking-[0.12em] text-muted-foreground">{entry.tone}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-foreground">{entry.text}</div>
                  </div>
                )) : <div className="rounded-xl border border-dashed px-3 py-5 text-xs text-muted-foreground">Debug log is empty.</div>}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}