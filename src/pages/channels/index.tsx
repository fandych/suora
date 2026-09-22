import { useEffect } from "react"
import { useNavigate } from "react-router"

import { subscribeToDataChanges } from "@/services/data-events"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { ChannelApi } from "@/services/channel-service"
import PageHeader from "@/pages/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { ChannelCard } from "@/pages/channels/components/channel-card"

const ChannelsPage = () => {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => ChannelApi.listAll(), [])
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
      <PageHeader title={t("channels.page.title", "Channels")} />
      <div
        className={`flex-1 p-6 ${!isLoading && !error && boundChannels.length === 0 ? "flex items-center justify-center" : ""}`}
      >
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title={t("channels.page.loading", "Loading channels...")} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && boundChannels.length === 0 ? (
            <EmptyCard
              title={t("channels.page.empty.title", "No bound channels yet")}
              description={t(
                "channels.page.empty.description",
                "Bind a channel from the secondary sidebar to show it here.",
              )}
            />
          ) : null}
          {!isLoading && !error && boundChannels.length ? (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {boundChannels.map((item) => (
                <ChannelCard key={item.id} channel={item} onOpen={(channelId) => navigate(`/channels/${channelId}`)} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelsPage
