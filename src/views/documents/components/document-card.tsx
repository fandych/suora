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
      <CardHeader className="pb-3">
        <CardTitle className="truncate text-base">{document.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
          {document.summary || "No description yet."}
        </div>
      </CardContent>
    </Card>
  )
}
