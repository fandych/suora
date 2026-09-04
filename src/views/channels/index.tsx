import { useEffect } from "react"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { subscribeToDataChanges } from "@/data/repositories/data-events"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createChannel, listChannels } from "@/data/repositories/channel-repository"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { getChannelBindingLabel, getChannelBindingVariant, getChannelPlatformLabel, getChannelStatusLabel, getChannelStatusVariant } from "@/views/channels/components/channel-utils"

const ChannelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listChannels(), [])

  useEffect(() => {
    return subscribeToDataChanges((route) => {
      if (route === "/channels") {
        reload()
      }
    })
  }, [reload])

  const handleCreate = async () => {
    const item = await createChannel()
    navigate(`/channels/${item.channel.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Channels" actions={<Button onClick={handleCreate}>New channel</Button>} />
      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading channels..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No channels yet" description="Create the first channel configuration." /> : null}
          {!isLoading && !error && data?.length
            ? data.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{item.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={getChannelBindingVariant(item.bindingState)}>{getChannelBindingLabel(item.bindingState)}</Badge>
                        <Badge variant={getChannelStatusVariant(item.status)}>{getChannelStatusLabel(item.status)}</Badge>
                      </div>
                    </div>
                    <CardDescription>{getChannelPlatformLabel(item.platform)} · {item.messageCount} messages{item.meta ? ` · ${item.meta}` : ""}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => navigate(`/channels/${item.id}`)}>Open channel</Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelsPage