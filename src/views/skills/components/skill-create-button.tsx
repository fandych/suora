import { useRef, useState } from "react"
import { useNavigate } from "react-router"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createSkill, importSkillArchive, previewSkillArchiveImport } from "@/data/repositories/skill-repository"
import type { ArchiveImportPlan, ArchiveImportStrategy } from "@/lib/resource-files"
import { ArchiveImportDialog } from "@/views/components/archive-import-dialog"
import { CreateSplitButton } from "@/views/components/create-split-button"

type SkillCreateButtonProps = {
  className?: string
  iconOnly?: boolean
}

export function SkillCreateButton({ className, iconOnly = false }: SkillCreateButtonProps) {
  const navigate = useNavigate()
  const [archivePlan, setArchivePlan] = useState<ArchiveImportPlan | null>(null)
  const [archiveStrategy, setArchiveStrategy] = useState<ArchiveImportStrategy>("overwrite")
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const handleCreate = async () => {
    setIsWorking(true)
    try {
      const detail = await createSkill()
      emitDataChanged("/skills")
      navigate(`/skills/${detail.skill.id}`)
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
      const plan = await previewSkillArchiveImport(file, archiveStrategy)
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
      const detail = await importSkillArchive(archiveFile, archiveStrategy)
      emitDataChanged("/skills")
      navigate(`/skills/${detail.skill.id}`)
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

    const nextPlan = await previewSkillArchiveImport(archiveFile, strategy)
    setArchivePlan(nextPlan)
  }

  return (
    <>
      <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={(event) => void handleImport(event)} />
      <CreateSplitButton className={className} createLabel="Create skill" disabled={isWorking} iconOnly={iconOnly} onCreate={handleCreate} onImport={() => importInputRef.current?.click()} />
      <ArchiveImportDialog description="Review the SKILL.md requirement, duplicate paths, and resolved import targets before creating the skill package." isSubmitting={isWorking} onConfirm={() => void handleConfirmImport()} onOpenChange={setIsImportDialogOpen} onStrategyChange={(strategy) => void handleStrategyChange(strategy)} open={isImportDialogOpen} plan={archivePlan} strategy={archiveStrategy} title="Import skill archive" />
    </>
  )
}
