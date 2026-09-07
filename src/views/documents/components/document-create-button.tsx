import { useState } from "react"
import { useNavigate } from "react-router"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createDocumentWithMetadata } from "@/data/repositories/document-repository"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DocumentCreateDialog } from "@/views/documents/components/document-create-dialog"

type DocumentCreateButtonProps = {
  className?: string
  iconOnly?: boolean
}

export function DocumentCreateButton({ className, iconOnly = false }: DocumentCreateButtonProps) {
  const navigate = useNavigate()
  const [description, setDescription] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [title, setTitle] = useState("")

  const handleCreate = async () => {
    if (!title.trim()) {
      return
    }

    setIsWorking(true)
    try {
      const detail = await createDocumentWithMetadata({ title: title.trim(), summary: description.trim() })
      emitDataChanged("/documents")
      navigate(`/documents/${detail.document.id}`)
      setIsOpen(false)
      setTitle("")
      setDescription("")
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <>
      <Button className={cn(iconOnly ? "h-8 shrink-0" : "h-8 shrink-0 whitespace-nowrap", className)} size={iconOnly ? "icon-sm" : "sm"} variant="outline" type="button" onClick={() => setIsOpen(true)} disabled={isWorking} aria-label="Create document" title="Create document">
        <PlusIcon />
        {iconOnly ? null : "Create document"}
      </Button>
      <DocumentCreateDialog description={description} onDescriptionChange={setDescription} onOpenChange={setIsOpen} onSubmit={handleCreate} onTitleChange={setTitle} open={isOpen} title={title} />
    </>
  )
}
