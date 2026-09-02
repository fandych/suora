import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type DocumentCreateDialogProps = {
  description: string
  dialogDescription?: string
  dialogTitle?: string
  onDescriptionChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  onTitleChange: (value: string) => void
  open: boolean
  submitLabel?: string
  title: string
}

export function DocumentCreateDialog({ description, dialogDescription = "Set the document name and description before the workspace scaffold is created.", dialogTitle = "Create document", onDescriptionChange, onOpenChange, onSubmit, onTitleChange, open, submitLabel = "Create document", title }: DocumentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Name</div>
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Document name" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Description</div>
            <Textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={5} placeholder="Describe the document space." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
