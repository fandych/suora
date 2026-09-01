import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createChat, listChats } from "@/data/repositories/chat-repository"

const ChatIndexPage = () => {
    const navigate = useNavigate()
    const { data, error, isLoading, reload } = useAsyncResource(() => listChats(), [])

    const handleCreate = async () => {
        const detail = await createChat()
        navigate(`/chats/${detail.chat.id}`)
    }

    return (
        <div className="flex min-h-full flex-col bg-background">
            <PageHeader
                title="Chats"
                description="Persistent local chat sessions grouped by recent activity."
                actions={<Button onClick={handleCreate}>New chat</Button>}
            />

            <div className="flex-1 p-6">
                <div className="mx-auto flex max-w-5xl flex-col gap-4">
                    {isLoading ? <LoadingCard title="Loading chats..." /> : null}
                    {error ? <ErrorCard error={error} onRetry={reload} /> : null}
                    {!isLoading && !error && data?.length === 0 ? (
                        <EmptyCard title="No chats yet" description="Create the first chat to start storing local message history." />
                    ) : null}
                    {!isLoading && !error && data?.length
                        ? data.map((chat) => (
                            <Card key={chat.id}>
                                <CardHeader>
                                    <CardTitle>{chat.title}</CardTitle>
                                    <CardDescription>{chat.summary || "No summary yet."}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button variant="outline" onClick={() => navigate(`/chats/${chat.id}`)}>
                                        Open chat
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                        : null}
                </div>
            </div>
        </div>
    )
};

export default ChatIndexPage;