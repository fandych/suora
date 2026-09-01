import { useRef, useState } from "react"
import { useNavigate } from "react-router"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createDocumentWithMetadata, importDocumentArchive } from "@/data/repositories/document-repository"
import { CreateSplitButton } from "@/views/components/create-split-button"
import { DocumentCreateDialog } from "@/views/documents/components/document-create-dialog"

type DocumentCreateButtonProps = {
  className?: string
}

export function DocumentCreateButton({ className }: DocumentCreateButtonProps) {
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement | null>(null)
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsWorking(true)
    try {
      const detail = await importDocumentArchive(file)
      emitDataChanged("/documents")
      navigate(`/documents/${detail.document.id}`)
    } finally {
      setIsWorking(false)
      event.target.value = ""
    }
  }

  return (
    <>
      <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={(event) => void handleImport(event)} />
      <CreateSplitButton className={className} createLabel="Create" disabled={isWorking} onCreate={() => setIsOpen(true)} onImport={() => importInputRef.current?.click()} />
      <DocumentCreateDialog description={description} onDescriptionChange={setDescription} onOpenChange={setIsOpen} onSubmit={handleCreate} onTitleChange={setTitle} open={isOpen} title={title} />
    </>
  )
}
