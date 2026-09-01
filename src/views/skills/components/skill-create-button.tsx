import { useRef, useState } from "react"
import { useNavigate } from "react-router"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createSkill, importSkillArchive } from "@/data/repositories/skill-repository"
import { CreateSplitButton } from "@/views/components/create-split-button"

type SkillCreateButtonProps = {
  className?: string
}

export function SkillCreateButton({ className }: SkillCreateButtonProps) {
  const navigate = useNavigate()
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
      const detail = await importSkillArchive(file)
      emitDataChanged("/skills")
      navigate(`/skills/${detail.skill.id}`)
    } finally {
      setIsWorking(false)
      event.target.value = ""
    }
  }

  return (
    <>
      <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={(event) => void handleImport(event)} />
      <CreateSplitButton className={className} createLabel="Create" disabled={isWorking} onCreate={handleCreate} onImport={() => importInputRef.current?.click()} />
    </>
  )
}
