import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type WorkflowPreferenceDialogProps = {
  open: boolean
  title: string
  summary: string
  readOnly: boolean
  onOpenChange: (open: boolean) => void
  onTitleChange: (value: string) => void
  onSummaryChange: (value: string) => void
}

export function WorkflowPreferenceDialog({
  open,
  title,
  summary,
  readOnly,
  onOpenChange,
  onTitleChange,
  onSummaryChange,
}: WorkflowPreferenceDialogProps) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftSummary, setDraftSummary] = useState(summary)

  useEffect(() => {
    if (open) {
      setDraftTitle(title)
      setDraftSummary(summary)
    }
  }, [open, summary, title])

  const handleSave = () => {
    onTitleChange(draftTitle)
    onSummaryChange(draftSummary)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit workflow</DialogTitle>
          <DialogDescription>Update the workflow name and description.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={readOnly}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workflow-name">Name</FieldLabel>
              <Input id="workflow-name" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Workflow name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="workflow-description">Description</FieldLabel>
              <Textarea id="workflow-description" value={draftSummary} onChange={(event) => setDraftSummary(event.target.value)} rows={5} placeholder="Workflow description" />
            </Field>
          </FieldGroup>
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={readOnly}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}