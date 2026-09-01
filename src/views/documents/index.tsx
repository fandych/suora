import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createDocument, listDocuments } from "@/data/repositories/document-repository"

const DocumentsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listDocuments(), [])

  const handleCreate = async () => {
    const detail = await createDocument()
    navigate(`/documents/${detail.document.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Documents"
        description="Document pages with a compact tree and TipTap or Monaco editing."
        actions={<Button onClick={handleCreate}>New document</Button>}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading documents..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard title="No documents yet" description="Create the first document space to manage content, settings, and graph links." />
          ) : null}
          {!isLoading && !error && data?.length
            ? data.map((document) => (
                <Card key={document.id}>
                  <CardHeader>
                    <CardTitle>{document.title}</CardTitle>
                    <CardDescription>{document.summary || "No summary yet."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => navigate(`/documents/${document.id}`)}>
                      Open document
                    </Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default DocumentsPage