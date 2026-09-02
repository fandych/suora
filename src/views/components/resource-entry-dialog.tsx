import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type ResourceEntryDialogProps = {
  description: string
  errorMessage?: string
  fieldLabel?: string
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  onValueChange: (value: string) => void
  open: boolean
  placeholder: string
  submitLabel: string
  title: string
  value: string
}

export function ResourceEntryDialog({ description, errorMessage, fieldLabel = "Path or name", onOpenChange, onSubmit, onValueChange, open, placeholder, submitLabel, title, value }: ResourceEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{fieldLabel}</div>
            <Input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} />
            {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}
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
