import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getChannel, saveChannel } from "@/data/repositories/channel-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"

const ChannelDetailPage = () => {
  const { channelId } = useParams<{ channelId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getChannel(channelId ?? ""), [channelId])
  const [title, setTitle] = useState("")
  const [platform, setPlatform] = useState("")

  useEffect(() => {
    if (data) {
      setTitle(data.title)
      setPlatform(data.kind)
    }
  }, [data])

  const handleSave = async () => {
    if (!data) {
      return
    }
    const next = await saveChannel({ id: data.id, title, platform })
    setData(next)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={title || "Channel"} description="Channel configuration via the module bridge." actions={data ? <Button onClick={handleSave}>Save channel</Button> : null} />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? <LoadingCard title="Loading channel..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data ? (
            <Card>
              <CardHeader>
                <CardTitle>Channel config</CardTitle>
                <CardDescription>Edit channel title and platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Channel title" />
                <Input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="Platform" />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelDetailPage