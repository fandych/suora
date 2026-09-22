import { TriangleAlertIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIntl } from "react-intl"

type ConfirmDeleteDialogProps = {
  description: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function ConfirmDeleteDialog({ description, onConfirm, onOpenChange, open, title }: ConfirmDeleteDialogProps) {
  const intl = useIntl()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{intl.formatMessage({ id: "confirmDelete.cancel", defaultMessage: "Cancel" })}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {intl.formatMessage({ id: "confirmDelete.delete", defaultMessage: "Delete" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
