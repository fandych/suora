import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DocumentSummary } from "@/data/domain/models"

type DocumentCardProps = {
  document: DocumentSummary
  onOpen: (documentId: string) => void
}

export function DocumentCard({ document, onOpen }: DocumentCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(document.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(document.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/20 text-sm font-semibold text-foreground">DOC</div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{document.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
          <div className="mt-1 truncate font-medium text-foreground">{document.title}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
          <div className="mt-1 text-sm leading-6 text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
            {document.summary || "No description yet."}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
