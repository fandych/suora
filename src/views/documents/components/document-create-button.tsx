import { useRef, useState } from "react"
import { useNavigate } from "react-router"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createDocumentWithMetadata, importDocumentArchive, previewDocumentArchiveImport } from "@/data/repositories/document-repository"
import type { ArchiveImportPlan, ArchiveImportStrategy } from "@/lib/resource-files"
import { ArchiveImportDialog } from "@/views/components/archive-import-dialog"
import { CreateSplitButton } from "@/views/components/create-split-button"
import { DocumentCreateDialog } from "@/views/documents/components/document-create-dialog"

type DocumentCreateButtonProps = {
  className?: string
}

export function DocumentCreateButton({ className }: DocumentCreateButtonProps) {
  const navigate = useNavigate()
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [archivePlan, setArchivePlan] = useState<ArchiveImportPlan | null>(null)
  const [archiveStrategy, setArchiveStrategy] = useState<ArchiveImportStrategy>("overwrite")
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [description, setDescription] = useState("")
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
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
      const plan = await previewDocumentArchiveImport(file, archiveStrategy)
      setArchiveFile(file)
      setArchivePlan(plan)
      setIsImportDialogOpen(true)
    } finally {
      setIsWorking(false)
      event.target.value = ""
    }
  }

  const handleConfirmImport = async () => {
    if (!archiveFile) {
      return
    }

    setIsWorking(true)
    try {
      const detail = await importDocumentArchive(archiveFile, archiveStrategy)
      emitDataChanged("/documents")
      navigate(`/documents/${detail.document.id}`)
      setIsImportDialogOpen(false)
      setArchivePlan(null)
      setArchiveFile(null)
    } finally {
      setIsWorking(false)
    }
  }

  const handleStrategyChange = async (strategy: ArchiveImportStrategy) => {
    setArchiveStrategy(strategy)
    if (!archiveFile) {
      return
    }

    const nextPlan = await previewDocumentArchiveImport(archiveFile, strategy)
    setArchivePlan(nextPlan)
  }

  return (
    <>
      <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={(event) => void handleImport(event)} />
      <CreateSplitButton className={className} createLabel="Create" disabled={isWorking} onCreate={() => setIsOpen(true)} onImport={() => importInputRef.current?.click()} />
      <DocumentCreateDialog description={description} onDescriptionChange={setDescription} onOpenChange={setIsOpen} onSubmit={handleCreate} onTitleChange={setTitle} open={isOpen} title={title} />
      <ArchiveImportDialog description="Review duplicate paths, resolved filenames, and import warnings before creating the document workspace." isSubmitting={isWorking} onConfirm={() => void handleConfirmImport()} onOpenChange={setIsImportDialogOpen} onStrategyChange={(strategy) => void handleStrategyChange(strategy)} open={isImportDialogOpen} plan={archivePlan} strategy={archiveStrategy} title="Import document archive" />
    </>
  )
}
