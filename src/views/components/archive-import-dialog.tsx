import { AlertCircleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ArchiveImportPlan, ArchiveImportStrategy } from "@/lib/resource-files"

type ArchiveImportDialogProps = {
  description: string
  isSubmitting?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  onStrategyChange: (strategy: ArchiveImportStrategy) => void
  open: boolean
  plan: ArchiveImportPlan | null
  strategy: ArchiveImportStrategy
  title: string
}

function getStatusLabel(status: ArchiveImportPlan["entries"][number]["status"]) {
  switch (status) {
    case "ready":
      return "Ready"
    case "renamed":
      return "Renamed"
    case "overwritten":
      return "Overwrite"
    case "skipped":
      return "Skipped"
    case "error":
      return "Error"
  }
}

function getStatusVariant(status: ArchiveImportPlan["entries"][number]["status"]) {
  switch (status) {
    case "ready":
      return "secondary"
    case "renamed":
      return "outline"
    case "overwritten":
      return "default"
    case "skipped":
      return "outline"
    case "error":
      return "destructive"
  }
}

export function ArchiveImportDialog({ description, isSubmitting = false, onConfirm, onOpenChange, onStrategyChange, open, plan, strategy, title }: ArchiveImportDialogProps) {
  const readyEntries = plan?.entries.filter((entry) => entry.resolvedPath) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-sm font-medium">Conflict strategy</div>
              <NativeSelect value={strategy} onChange={(event) => onStrategyChange(event.target.value as ArchiveImportStrategy)}>
                <NativeSelectOption value="overwrite">Overwrite later duplicates</NativeSelectOption>
                <NativeSelectOption value="rename">Rename duplicates</NativeSelectOption>
                <NativeSelectOption value="skip">Skip duplicates</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium">Import summary</div>
              <div className="mt-1 text-muted-foreground">{plan ? `${plan.importCount} file entries ready to import.` : "Load a zip archive to inspect its contents."}</div>
              {plan?.issues.length ? <div className="mt-3 space-y-2">{plan.issues.map((issue, index) => <div key={`${issue.path}-${index}`} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${issue.severity === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-background text-muted-foreground"}`}><AlertCircleIcon className="mt-0.5 size-4 shrink-0" /><div><div className="font-medium">{issue.path || "Archive"}</div><div>{issue.message}</div></div></div>)}</div> : null}
            </div>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Archive path</TableHead>
                  <TableHead>Resolved path</TableHead>
                  <TableHead>Kind</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan?.entries.map((entry) => (
                  <TableRow key={`${entry.normalizedPath}-${entry.kind}-${entry.status}`}>
                    <TableCell><Badge variant={getStatusVariant(entry.status)}>{getStatusLabel(entry.status)}</Badge></TableCell>
                    <TableCell className="capitalize">{entry.conflictSource === "workspace" ? "Workspace" : entry.conflictSource === "archive" ? "Archive" : "New"}</TableCell>
                    <TableCell className="max-w-56 truncate">{entry.normalizedPath}</TableCell>
                    <TableCell className="max-w-56 truncate">{entry.resolvedPath ?? entry.message ?? "Not importable"}</TableCell>
                    <TableCell className="capitalize">{entry.kind}</TableCell>
                  </TableRow>
                ))}
                {!plan ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Select a zip archive to preview its entries.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {readyEntries.length > 0 ? <div className="text-xs text-muted-foreground">Directories are kept for structure preview. Only importable file entries are persisted.</div> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={!plan || plan.hasBlockingIssues || readyEntries.length === 0 || isSubmitting}>{isSubmitting ? "Importing..." : "Import archive"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
