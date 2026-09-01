import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createChannel, listChannels } from "@/data/repositories/channel-repository"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"

const ChannelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listChannels(), [])

  const handleCreate = async () => {
    const item = await createChannel()
    navigate(`/channels/${item.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Channels" description="Manage channel definitions through the module bridge." actions={<Button onClick={handleCreate}>New channel</Button>} />
      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading channels..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No channels yet" description="Create the first channel configuration." /> : null}
          {!isLoading && !error && data?.length
            ? data.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.kind}</CardDescription>
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