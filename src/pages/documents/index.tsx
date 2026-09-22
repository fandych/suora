import { useEffect } from "react"
import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PageHeader from "@/pages/components/page-header"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { subscribeToDataChanges } from "@/services/data-events"
import { DocumentApi } from "@/services/document-service"
import { DocumentCard } from "@/pages/documents/components/document-card"

const DocumentsPage = () => {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => DocumentApi.listAll(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/documents") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("documents.page.title", "Documents")} />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title={t("documents.page.loading", "Loading documents...")} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? (
            <SummaryCardGrid
              emptyTitle={t("documents.page.empty.title", "No documents yet")}
              emptyDescription={t(
                "documents.page.empty.description",
                "Create the first document space to manage content, settings, and graph links.",
              )}
              items={data}
              renderItem={(document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onOpen={(nextDocumentId) => navigate(`/documents/${nextDocumentId}`)}
                />
              )}
            />
          ) : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard
              title={t("documents.page.empty.title", "No documents yet")}
              description={t(
                "documents.page.empty.description",
                "Create the first document space to manage content, settings, and graph links.",
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default DocumentsPage
