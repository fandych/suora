import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { ChatApi } from "@/services/chat-service"
import { subscribeToDataChanges } from "@/services/data-events"
import PageHeader from "@/pages/components/page-header"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { ChatCard } from "@/pages/chats/components/chat-card"
import { useNavigate } from "react-router"

const ChatsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => ChatApi.listAll(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/chats") {
          reload()
        }
      }),
    [reload],
  )

  const handleCreate = () => {
    navigate("/chats")
    toast.add({ title: "New draft", description: "Start typing to create a real chat.", type: "info", timeout: 2500 })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Chat Home" actions={<Button onClick={() => void handleCreate()}>New chat</Button>} />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {isLoading ? <LoadingCard title="Loading chats..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data ? (
            <SummaryCardGrid
              emptyTitle="No chats yet"
              emptyDescription="Create the first chat to start a new session."
              items={data}
              renderItem={(chat) => (
                <ChatCard key={chat.id} chat={chat} onOpen={(chatId) => navigate(`/chats/${chatId}`)} />
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChatsPage
