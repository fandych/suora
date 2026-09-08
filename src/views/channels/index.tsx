import { useEffect } from "react"
import { useNavigate } from "react-router"

import { subscribeToDataChanges } from "@/data/repositories/data-events"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listChannels } from "@/data/repositories/channel-repository"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { ChannelCard } from "@/views/channels/components/channel-card"

const ChannelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listChannels(), [])
  const boundChannels = data?.filter((channel) => channel.bindingState === "connected") ?? []

  useEffect(() => {
    return subscribeToDataChanges((route) => {
      if (route === "/channels") {
        reload()
      }
    })
  }, [reload])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Channels" />
      <div className={`flex-1 p-6 ${!isLoading && !error && boundChannels.length === 0 ? "flex items-center justify-center" : ""}`}>
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading channels..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && boundChannels.length === 0 ? <EmptyCard title="No bound channels yet" description="Bind a channel from the secondary sidebar to show it here." /> : null}
          {!isLoading && !error && boundChannels.length
            ? <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {boundChannels.map((item) => (
                <ChannelCard key={item.id} channel={item} onOpen={(channelId) => navigate(`/channels/${channelId}`)} />
              ))}
            </div>
            : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelsPage